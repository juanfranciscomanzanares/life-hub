/*
  Puente para leer las webs de las federaciones de tenis de mesa.

  Desplegar:
    supabase functions deploy tenis-mesa

  Por qué hace falta un servidor: ftmrm.es, rfetm.es y Google Drive no envían
  cabeceras CORS, así que el navegador no puede descargarlos directamente. Esta
  función los descarga y, si son PDF, devuelve su texto extraído.

  Deliberadamente NO interpreta los datos: solo devuelve texto. Todo el parseo
  vive en src/lib/tenis.js, donde está cubierto por tests con actas reales. Si
  la lógica estuviera aquí habría que duplicarla o dejarla sin probar.

  Es un proxy, así que va con lista blanca de dominios: sin ella cualquiera
  podría usarlo para pedir cualquier URL desde la infraestructura del proyecto.
*/

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { extractText, getDocumentProxy } from "https://esm.sh/unpdf@0.11.0";

const DOMINIOS = [
  "ftmrm.es",
  "www.ftmrm.es",
  "rfetm.es",
  "www.rfetm.es",
  "clubs.rfetm.es",
  "drive.google.com",
  "docs.google.com",
];

// Tope por llamada: bajar y extraer PDFs es lento y la función tiene límite de
// tiempo. El cliente va por tandas.
const MAX_URLS = 8;

/*
  Las cuatro cabeceras son necesarias: supabase-js manda además de
  `authorization` y `content-type`, la `apikey` y `x-client-info`. Si falta
  alguna, el navegador corta en la comprobación previa (preflight) y el cliente
  informa de "Failed to send a request to the Edge Function", sin que la función
  llegue a ejecutarse.
*/
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });

async function haySesion(req: Request) {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return false;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { error } = await supabase.auth.getUser();
  return !error;
}

function permitida(url: string) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && DOMINIOS.includes(u.hostname);
  } catch {
    return false;
  }
}

async function leer(url: string) {
  const res = await fetch(url, {
    redirect: "follow",
    // Sin User-Agent, algunas de estas webs responden con una página de aviso.
    headers: { "User-Agent": "Mozilla/5.0 (compatible; LifeHub/1.0)" },
  });

  /*
    No se descarta la respuesta por el código de estado.

    La ficha de jugador de la RFETM de temporadas pasadas devuelve HTTP 500 y
    aun así manda la página entera y correcta (algún aviso de PHP por dentro).
    Al tratar el 500 como error se perdía todo el histórico anterior. Se mira si
    hay cuerpo utilizable y solo se falla cuando de verdad no hay nada.
  */
  const tipo = res.headers.get("content-type") ?? "";
  const esPdf = tipo.includes("pdf") || tipo.includes("octet-stream");

  if (!esPdf) {
    const texto = await res.text();
    if (!texto.trim()) return { url, error: `HTTP ${res.status} sin contenido` };
    return { url, tipo: "html", texto, estado: res.status };
  }

  const buf = new Uint8Array(await res.arrayBuffer());
  if (buf.length === 0) return { url, error: `HTTP ${res.status} sin contenido` };

  // Comprobación real: Drive devuelve octet-stream para todo, y si el fichero
  // no existe manda una página de error que no es un PDF.
  const cabecera = new TextDecoder().decode(buf.slice(0, 5));
  if (cabecera !== "%PDF-")
    return { url, tipo: "html", texto: new TextDecoder().decode(buf), estado: res.status };

  const pdf = await getDocumentProxy(buf);
  const { text } = await extractText(pdf, { mergePages: true });

  /*
    Algunos rankings están escaneados: son imágenes dentro de un PDF y no tienen
    texto que extraer. Se avisa en vez de devolver una cadena vacía que parecería
    que el jugador no participó.
  */
  if (text.replace(/\s/g, "").length < 50)
    return { url, tipo: "pdf", texto: "", escaneado: true, estado: res.status };

  return { url, tipo: "pdf", texto: text, estado: res.status };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    if (!(await haySesion(req))) return json({ error: "Necesitas iniciar sesión." }, 401);

    const { urls } = await req.json();
    if (!Array.isArray(urls) || urls.length === 0)
      return json({ error: "Envía un array 'urls'." }, 400);
    if (urls.length > MAX_URLS)
      return json({ error: `Máximo ${MAX_URLS} URLs por llamada.` }, 400);

    const noPermitidas = urls.filter((u: string) => !permitida(u));
    if (noPermitidas.length)
      return json({ error: `Dominio no permitido: ${noPermitidas[0]}` }, 403);

    // En serie y no en paralelo: son webs de federaciones pequeñas y no tiene
    // sentido lanzarles ocho peticiones a la vez.
    const resultados = [];
    for (const url of urls) {
      try {
        resultados.push(await leer(url));
      } catch (e) {
        resultados.push({ url, error: e instanceof Error ? e.message : String(e) });
      }
    }

    return json({ resultados });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
