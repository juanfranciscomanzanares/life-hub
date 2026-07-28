import { supabase, cloudEnabled } from "./supabase";
import {
  extraerEnlacesRanking,
  buscarEnRanking,
  urlJugador,
  parsearPaginaJugador,
  parsearTotalesJugador,
} from "./tenis";

/*
  Sincronización con las webs de las federaciones.

  La descarga va por tandas y de forma incremental: las actas ya procesadas no
  se vuelven a pedir. Son PDFs de ~48 kB cada uno y webs de federaciones
  pequeñas, así que conviene no machacarlas.
*/

/*
  Los PDFs de rankings pesan medio mega y extraer su texto es lento, así que van
  de tres en tres para no agotar el tiempo de la función. Las páginas HTML, al
  ser una sola, no necesitan trocearse.
*/
const TANDA = 3;

export const FUNCION = "tenis-mesa";

async function puente(urls) {
  if (!cloudEnabled) throw new Error("Necesitas la nube configurada para sincronizar.");

  const { data, error } = await supabase.functions.invoke(FUNCION, { body: { urls } });
  if (error) throw new Error(error.message || "No se pudo contactar con el servidor.");
  if (data?.error) throw new Error(data.error);
  return data.resultados ?? [];
}

// Trocea en tandas y va informando del progreso.
async function porTandas(urls, alProgresar) {
  const salida = [];
  for (let i = 0; i < urls.length; i += TANDA) {
    const trozo = urls.slice(i, i + TANDA);
    salida.push(...(await puente(trozo)));
    alProgresar?.(Math.min(i + TANDA, urls.length), urls.length);
  }
  return salida;
}

export const URL_RANKINGS = "https://ftmrm.es/es/section/rankings-jugadores";

/*
  Partidos de liga de una temporada.

  Se usa la página de resultados POR JUGADOR de la RFETM: una sola petición
  devuelve la temporada entera más los totales oficiales. La alternativa era
  descargar unas veinte actas en PDF y juntarlas, que es más lento, castiga más
  a la federación y da menos información.

  Los totales oficiales se guardan aparte para poder contrastar: si algún día el
  parseo se desalinea, se verá porque dejarán de cuadrar con lo calculado.
*/
export async function sincronizarLiga({ config }) {
  const url = urlJugador(config.temporada, config.licencia, config.tempoNum);
  const [pagina] = await puente([url]);
  if (pagina?.error) throw new Error(`No se pudo leer tu ficha: ${pagina.error}`);

  const crudos = parsearPaginaJugador(pagina.texto, config.licencia);
  const oficiales = parsearTotalesJugador(pagina.texto);

  if (crudos.length === 0)
    throw new Error(
      "No encontré partidos tuyos en esa temporada. Revisa el número de licencia y la temporada."
    );

  const partidos = crudos.map((p) => ({
    ...p,
    /*
      La JORNADA es imprescindible en el identificador.

      Antes se usaba la fecha, pero las fichas de temporadas pasadas no la
      traen (0 de 42 en 2024-2025), así que dos partidos contra el mismo rival
      y con la misma letra en jornadas distintas compartían identificador y uno
      se perdía: salían 39 partidos y 22 victorias en vez de 42 y 23.

      Con la jornada no puede haber choque: dentro de un mismo encuentro cada
      jugador se enfrenta una sola vez a cada rival.
    */
    id: `${config.temporada}-J${p.jornada}-${p.licenciaRival}-${p.miLetra}`,
    temporada: config.temporada,
    origen: "liga",
  }));

  return { partidos, oficiales };
}

/*
  Resultados en los opens de la federación murciana.

  Se rehacen enteros en cada sincronización en vez de incrementalmente: son
  pocos PDFs y, sobre todo, cada ranking SUSTITUYE al anterior (el de después
  del III OPEN ya incluye lo del I y el II), así que quedarse con el último de
  cada temporada es lo correcto.
*/
export async function sincronizarOpens({ nombre, temporada, alProgresar }) {
  if (!nombre?.trim())
    throw new Error("Pon tu nombre en Ajustes: los rankings de opens no llevan licencia.");

  const [pagina] = await puente([URL_RANKINGS]);
  if (pagina?.error) throw new Error(`No se pudo leer la web de la federación: ${pagina.error}`);

  const todos = extraerEnlacesRanking(pagina.texto);
  const enlaces = temporada ? todos.filter((e) => e.temporada === temporada) : todos;
  const temporadas = [...new Set(todos.map((e) => e.temporada).filter(Boolean))].sort().reverse();

  if (enlaces.length === 0) return { resultados: [], temporadas, detalle: [] };

  const textos = await porTandas(
    enlaces.map((e) => e.url),
    alProgresar
  );

  const resultados = [];
  // Estado documento a documento: sin esto, "no sale nada" no distingue entre
  // no haber participado, un PDF escaneado o un fallo de descarga.
  const detalle = [];

  textos.forEach((t, i) => {
    const enlace = enlaces[i];

    if (t?.escaneado) {
      detalle.push({ prueba: enlace.nombre, estado: "escaneado" });
      return;
    }
    if (t?.error || !t?.texto) {
      detalle.push({ prueba: enlace.nombre, estado: "error", motivo: t?.error });
      return;
    }

    const hallados = buscarEnRanking(t.texto, nombre);
    if (hallados.length === 0) {
      detalle.push({ prueba: enlace.nombre, estado: "no-aparece" });
      return;
    }

    detalle.push({ prueba: enlace.nombre, estado: "ok", puesto: hallados[0].puesto });
    hallados.forEach((r) =>
      resultados.push({
        id: `${enlace.idDrive}-${r.categoria}`,
        temporada: enlace.temporada,
        prueba: enlace.nombre,
        origen: "open",
        ...r,
      })
    );
  });

  return { resultados, temporadas, detalle };
}

/*
  Sustituye por completo lo guardado de UNA temporada por lo recién descargado,
  dejando intactas las demás.

  Se reemplaza en vez de fusionar por id porque la fuente es la verdad completa
  de esa temporada: si un identificador cambia (como pasó al añadir la jornada
  para evitar choques), fusionar dejaría conviviendo las filas viejas y las
  nuevas y saldrían partidos duplicados.
*/
export function reemplazarTemporada(existentes = [], nuevos = [], temporada) {
  return [...existentes.filter((x) => x.temporada !== temporada), ...nuevos];
}
