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

const TANDA = 8; // el mismo tope que acepta la Edge Function

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
    // Fecha y rival identifican el partido de forma estable entre sincronizaciones.
    id: `${config.temporada}-${p.fecha}-${p.licenciaRival}-${p.miLetra}`,
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
  const [pagina] = await puente([URL_RANKINGS]);
  if (pagina?.error) throw new Error(`No se pudo leer la web de la federación: ${pagina.error}`);

  const todos = extraerEnlacesRanking(pagina.texto);
  const enlaces = temporada ? todos.filter((e) => e.temporada === temporada) : todos;
  if (enlaces.length === 0)
    return { resultados: [], temporadas: [...new Set(todos.map((e) => e.temporada))] };

  const textos = await porTandas(
    enlaces.map((e) => e.url),
    alProgresar
  );

  const resultados = [];
  textos.forEach((t, i) => {
    if (t?.error || !t?.texto) return;
    buscarEnRanking(t.texto, nombre).forEach((r) =>
      resultados.push({
        id: `${enlaces[i].idDrive}-${r.categoria}`,
        temporada: enlaces[i].temporada,
        prueba: enlaces[i].nombre,
        origen: "open",
        ...r,
      })
    );
  });

  return { resultados, temporadas: [...new Set(todos.map((e) => e.temporada))] };
}

/*
  Fusiona lo nuevo con lo guardado sin duplicar. Se compara por id, que en los
  partidos combina acta y rival, y en los rankings el fichero y la categoría.
*/
export function fusionar(existentes = [], nuevos = []) {
  const porId = new Map(existentes.map((x) => [x.id, x]));
  nuevos.forEach((n) => porId.set(n.id, n));
  return [...porId.values()];
}
