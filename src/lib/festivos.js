/*
  Festivos nacionales y autonómicos, con Nager.Date (https://date.nager.at).

  Sin clave y sin límite de peticiones declarado. Aun así se guardan en caché un
  mes: los festivos de un año no cambian, y pedirlos en cada render sería
  maleducado además de inútil.

  NO sustituye a `FESTIVOS_UMU` (src/lib/uni.js), y conviene tener clara la
  diferencia porque se solapan a medias:

  - `FESTIVOS_UMU` es el calendario de LA FACULTAD, copiado a mano del PDF de
    Secretaría. Lleva días que ninguna API conoce (la Romería, San Alberto
    Magno) y caduca cada curso: en septiembre de 2027 hay que volver al PDF.
  - Esto son los festivos OFICIALES del país y de la comunidad, al día y para
    cualquier año. Es lo que necesitan Trabajo y el calendario fuera del curso
    2026/2027, donde el calendario académico no sabe nada.

  Cuando los dos tienen algo que decir del mismo día, manda el académico: es más
  específico y trae el nombre que el usuario reconoce.

  Aviso para el futuro: la web de documentación se ha mudado a nagerholidays.com,
  pero el endpoint de la API sigue respondiendo en date.nager.at (comprobado en
  agosto de 2026). Si algún día deja de hacerlo, es lo primero que hay que mirar.
*/

import { useCallback, useEffect, useRef, useState } from "react";

const BASE = "https://date.nager.at/api/v3/PublicHolidays";

export const PAIS_POR_DEFECTO = "ES";

/*
  Región de Murcia, en el código ISO 3166-2 que usa Nager en el campo `counties`.
  Sin esto saldrían los festivos de las diecisiete comunidades juntos y el
  calendario diría que el 28 de febrero (Día de Andalucía) es fiesta aquí.
*/
export const REGION_POR_DEFECTO = "ES-MC";

// Un mes. Los festivos de un año ya publicado no se mueven.
export const CACHE_MS = 30 * 24 * 60 * 60 * 1000;

const CLAVE_CACHE = "lh_cache_festivos";

/*
  Igual que con el tiempo: caché en localStorage a pelo, NO por `usePersisted`.
  Es un dato público que se regenera solo; sincronizarlo con Supabase sería
  gastar escrituras en algo que cualquier dispositivo puede pedir por su cuenta.
*/

export const urlFestivos = (anio, pais = PAIS_POR_DEFECTO) => `${BASE}/${anio}/${pais}`;

/* ------------------------------------------------------------------ */
/*  Lectura de la respuesta                                            */
/* ------------------------------------------------------------------ */

/*
  Nager devuelve cada festivo así:

    { date, localName, name, countryCode, global, counties, types }

  `global: true` con `counties: null` es un festivo de todo el país; si no,
  `counties` trae los códigos de las comunidades donde se celebra
  (["ES-AN"], ["ES-MC", "ES-VC"]...).

  Se filtra por región para no mezclar: el Día de Andalucía es festivo en
  Andalucía, no en Murcia, y pintarlo aquí sería decir una mentira.
*/
export function normalizarFestivos(lista, region = REGION_POR_DEFECTO) {
  if (!Array.isArray(lista)) return [];

  return lista
    .filter((f) => {
      if (!f?.date) return false;
      /*
        El endpoint se llama PublicHolidays, pero algunas entradas vienen
        marcadas como conmemoración o día bancario. Solo se filtra si el campo
        existe de verdad: si Nager dejara de mandarlo, quedarnos sin festivos
        sería peor que colar alguno de más.
      */
      if (Array.isArray(f.types) && f.types.length > 0 && !f.types.includes("Public")) return false;
      return f.global === true || (Array.isArray(f.counties) && f.counties.includes(region));
    })
    .map((f) => ({
      fecha: String(f.date).slice(0, 10),
      // `localName` viene en español ("Año Nuevo"); `name` en inglés.
      titulo: f.localName || f.name || "Festivo",
      ambito: f.global === true ? "nacional" : "regional",
    }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const festivoDe = (festivos, fechaISO) =>
  (Array.isArray(festivos) ? festivos : []).find((f) => f.fecha === String(fechaISO).slice(0, 10)) ??
  null;

export const esFestivo = (festivos, fechaISO) => festivoDe(festivos, fechaISO) !== null;

/*
  Los años que hacen falta para pintar un mes.

  Suena a tontería hasta que se abre enero: la rejilla mensual empieza en el
  lunes anterior y termina en el domingo siguiente, así que un enero puede
  enseñar días de diciembre del año pasado. Pidiendo un solo año, esos días
  saldrían sin festivo.
*/
export function aniosNecesarios(anio) {
  const n = Number(anio);
  if (!Number.isFinite(n)) return [];
  return [n - 1, n, n + 1];
}

/* ------------------------------------------------------------------ */
/*  Caché                                                              */
/* ------------------------------------------------------------------ */

// Se guarda un objeto por año: { "2026": { pedidoEn, region, dias: [...] } }.
function leerCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CLAVE_CACHE) || "null");
    return c && typeof c === "object" ? c : {};
  } catch {
    return {};
  }
}

function guardarCache(cache) {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(cache));
  } catch {
    /* Sin sitio: se volverá a pedir. */
  }
}

/*
  La región forma parte de lo que valida la caché: si el usuario se muda y la
  cambia, lo guardado ya no le sirve aunque siga siendo reciente.
*/
export function entradaValida(entrada, { region = REGION_POR_DEFECTO, ahora = Date.now() } = {}) {
  if (!entrada || !Array.isArray(entrada.dias)) return false;
  if (entrada.region !== region) return false;
  return ahora - Number(entrada.pedidoEn || 0) <= CACHE_MS;
}

/* ------------------------------------------------------------------ */
/*  Descarga                                                           */
/* ------------------------------------------------------------------ */

export async function pedirFestivos(
  anio,
  { region = REGION_POR_DEFECTO, pais = PAIS_POR_DEFECTO, signal } = {}
) {
  const res = await fetch(urlFestivos(anio, pais), { signal });
  if (!res.ok) throw new Error(`Nager.Date respondió ${res.status}`);
  return normalizarFestivos(await res.json(), region);
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/*
  Los festivos de varios años, en una sola lista.

  Arranca con lo que haya en caché para que la primera pintada ya los tenga, y
  solo pide a la red los años que falten o hayan caducado. Un fallo se traga a
  propósito: quedarse sin festivos es perder un adorno, no romper el calendario.
*/
export function useFestivos(anios = [], { region = REGION_POR_DEFECTO } = {}) {
  // Los años llegan como array literal y cambiarían de identidad en cada
  // render; se depende de su contenido, no de la referencia.
  const clave = anios.join(",");

  const [festivos, setFestivos] = useState(() => desdeCache(clave, region));
  const [cargando, setCargando] = useState(false);
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const cargar = useCallback(async () => {
    const lista = clave ? clave.split(",") : [];
    if (lista.length === 0) return;

    const cache = leerCache();
    const faltan = lista.filter((a) => !entradaValida(cache[a], { region }));
    if (faltan.length === 0) {
      setFestivos(desdeCache(clave, region));
      return;
    }

    setCargando(true);
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 8000);
    try {
      const traidos = await Promise.all(
        faltan.map((a) =>
          pedirFestivos(a, { region, signal: corte.signal })
            .then((dias) => [a, dias])
            // Un año que falla no debe tumbar a los otros dos.
            .catch(() => null)
        )
      );
      const nuevo = { ...cache };
      traidos.filter(Boolean).forEach(([a, dias]) => {
        nuevo[a] = { pedidoEn: Date.now(), region, dias };
      });
      guardarCache(nuevo);
      if (vivo.current) setFestivos(desdeCache(clave, region));
    } catch {
      /* Sin festivos se sigue viviendo: no se enseña ningún error. */
    } finally {
      clearTimeout(reloj);
      if (vivo.current) setCargando(false);
    }
  }, [clave, region]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  return { festivos, cargando };
}

function desdeCache(clave, region) {
  if (!clave) return [];
  const cache = leerCache();
  return clave
    .split(",")
    .flatMap((a) => (entradaValida(cache[a], { region }) ? cache[a].dias : []))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}
