/*
  Lee tus tareas activas del Aula Virtual de la UMU con tus credenciales
  institucionales.

  Desplegar:
    supabase functions deploy aula-virtual-sync

  No hace falta ningún secreto: a diferencia del banco, aquí no hay una clave
  de aplicación que guardar en el servidor. Cada sincronización manda tu
  usuario y contraseña de la UMU en el cuerpo de la petición (por HTTPS) SOLO
  para iniciar sesión en ese instante; esta función no los guarda en ningún
  sitio (ni en logs, ni en base de datos): se usan una vez y se descartan al
  responder.

  Por qué hace falta un servidor: el Aula Virtual no manda cabeceras CORS, así
  que el navegador no puede llamarla directamente. Y aunque las mandara, la
  cookie de sesión de Sakai no se puede compartir entre el dominio de esta app
  y aulavirtual.um.es por la política de mismo origen.

  Base técnica: el Aula Virtual de la UMU está construido sobre Sakai, no
  Moodle. Sakai expone su propia API REST oficial ("EntityBroker") en
  /direct/, la misma que usan las integraciones oficiales:
    - POST /direct/session.json?_username=..&_password=..  -> crea sesión,
      devuelve una cookie (igual que entrar por el formulario web).
    - GET  /direct/assignment/my.json  -> tus tareas en TODOS los sitios en
      los que tienes matrícula (pasados y presentes), no solo el curso activo.
    - GET  /direct/site.json  -> tus sitios (asignaturas), para poner nombre
      a la asignatura de cada tarea en vez de un id interno.
*/

// deno-lint-ignore-file no-explicit-any
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const BASE = "https://aulavirtual.um.es";

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

/* Solo usuarios con sesión en Life Hub pueden usar este puente: si no, sería
   un proxy abierto contra el Aula Virtual para probar contraseñas de cualquiera. */
async function usuarioDeLaPeticion(req: Request) {
  const auth = req.headers.get("Authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  if (!token) return null;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: `Bearer ${token}` } } }
  );
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
}

/* Sakai puede mandar varias cabeceras Set-Cookie (sesión + balanceo de carga);
   getSetCookie() las separa bien, pero no todos los runtimes la traen. */
function cookieDeSesion(res: Response) {
  const headers = res.headers as Headers & { getSetCookie?: () => string[] };
  const crudas = headers.getSetCookie
    ? headers.getSetCookie()
    : [res.headers.get("set-cookie") ?? ""].filter(Boolean);
  return crudas.map((c) => c.split(";")[0]).join("; ");
}

/*
  Inicia sesión en Sakai.

  Lo que devuelve de verdad `/direct/session.json`, comprobado contra el
  servidor de la UMU:

    credenciales buenas -> 201, el id de sesión en TEXTO PLANO (no JSON) y la
                           cookie en las cabeceras
    credenciales malas  -> 403, una página HTML de error de Tomcat, sin cookie

  La versión anterior hacía `res.json()` y exigía un campo `userId` que no
  existe en ninguno de los dos casos, así que fallaba SIEMPRE, también con la
  contraseña correcta. De ahí salió la idea de que la UMU tenía desactivada
  esta vía y de que hacía falta un navegador con CAS + 2FA: no era cierto.

  Las credenciales van en el cuerpo y no en la query string para que no acaben
  escritas en los registros de acceso del servidor.
*/
async function iniciarSesion(usuario: string, contrasena: string) {
  const res = await fetch(`${BASE}/direct/session.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: new URLSearchParams({ _username: usuario, _password: contrasena }),
  });
  const cookie = cookieDeSesion(res);

  if (res.status === 403) {
    throw new Error("El Aula Virtual ha rechazado el usuario o la contraseña.");
  }
  if (!res.ok || !cookie) {
    throw new Error(
      `El Aula Virtual respondió ${res.status} al iniciar sesión` +
        (cookie ? "." : " y no devolvió cookie de sesión.")
    );
  }
  return cookie;
}

async function get(ruta: string, cookie: string) {
  const res = await fetch(`${BASE}${ruta}`, {
    headers: { Cookie: cookie, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`El Aula Virtual respondió ${res.status} al leer ${ruta}`);
  return res.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const usuarioLH = await usuarioDeLaPeticion(req);
    if (!usuarioLH) return json({ error: "Necesitas iniciar sesión." }, 401);

    const { usuario, contrasena } = await req.json();
    if (!usuario || !contrasena) return json({ error: "Faltan usuario o contraseña de la UMU." }, 400);

    const cookie = await iniciarSesion(usuario, contrasena);

    const [tareas, sitios] = await Promise.all([
      get("/direct/assignment/my.json", cookie),
      /*
        El `_limit` no es opcional: sin él, site.json devuelve solo los 10
        primeros sitios y la mayoría de las tareas se quedan sin nombre de
        asignatura (salían como "6596_G_2025_N_N").
      */
      get("/direct/site.json?_limit=200", cookie),
    ]);

    /*
      Se devuelve el JSON recortado, no interpretado: el estado de cada tarea,
      los nombres y el agrupado se calculan en src/lib/aula.js, que sí está
      cubierto por tests. Aquí solo se quitan los campos que no se usan, que
      son casi todos: el crudo pasa de medio mega.
    */
    return json({
      sitios: (sitios?.site_collection ?? sitios?.sites ?? []).map((s: any) => ({
        id: s.entityId ?? s.id,
        titulo: s.title ?? s.entityTitle ?? s.entityId ?? s.id,
      })),
      tareas: (tareas?.assignment_collection ?? tareas?.assignments ?? []).map((a: any) => ({
        id: a.id ?? a.entityId,
        titulo: a.title ?? "",
        contexto: a.context ?? "",
        borrador: Boolean(a.draft),
        abre: a.openTimeString ?? a.openTime ?? null,
        entrega: a.dueTimeString ?? a.dueTime ?? null,
        cierra: a.closeTimeString ?? a.closeTime ?? null,
        /*
          Que la hayas entregado TÚ. `submitted` a secas no vale: Sakai crea
          una entrega vacía cuando el profesor califica, así que salían como
          entregadas 126 de 129 tareas en vez de 62.
        */
        entregada: (a.submissions ?? []).some((s: any) => s.submitted && s.userSubmission),
      })),
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
