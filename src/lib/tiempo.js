/*
  El tiempo, con Open-Meteo (https://open-meteo.com).

  Sin clave, sin registro y sin nada que se gaste: el plan gratuito no comercial
  admite 10.000 peticiones al día, y Life Hub no llega ni de lejos aunque abras
  el panel cada dos por tres.

  Por eso NO hay Edge Function de por medio, al revés que con el banco o el Aula
  Virtual: aquí no hay ninguna credencial que esconder del navegador, así que
  meter un salto por Supabase solo añadiría latencia y una pieza más que puede
  fallar.

  Este archivo es todo lógica pura (montar la URL, leer la respuesta, decidir si
  la caché sirve) más el hook que lo pega a React. Lo de pintar es cosa de quien
  lo use: aquí se devuelve un NOMBRE de icono, no un componente, para que el
  módulo siga probándose en `node` y no arrastre JSX.
*/

import { useCallback, useEffect, useRef, useState } from "react";
import { todayISO } from "./ui";

/*
  Murcia. Es un valor por defecto, no una constante grabada a fuego: el lugar se
  guarda en `lh_tiempo_lugar` y se puede cambiar en Ajustes.
*/
export const LUGAR_POR_DEFECTO = { nombre: "Murcia", lat: 37.9922, lon: -1.1307 };

const BASE = "https://api.open-meteo.com/v1/forecast";

// Una hora. El tiempo no cambia entre dos pulsaciones de F5, y así se es buen
// vecino con una API que nos deja entrar gratis.
export const CACHE_MS = 60 * 60 * 1000;

const CLAVE_CACHE = "lh_cache_tiempo";

/*
  La caché va en localStorage a pelo y NO por `usePersisted`, a propósito.

  Todo lo que pasa por el store se sincroniza con Supabase, y esto no debe:
  es un dato derivado que se regenera solo, subirlo gastaría escrituras para
  nada, y —peor— dos dispositivos en sitios distintos se pisarían la previsión
  el uno al otro. Tampoco entra en las copias de seguridad, que llevan una lista
  explícita de claves (ver src/sections/Datos.jsx).
*/

/* ------------------------------------------------------------------ */
/*  Códigos WMO                                                        */
/* ------------------------------------------------------------------ */

/*
  Open-Meteo devuelve el tiempo como un código WMO (0 despejado, 61 lluvia...).
  Se agrupan en las situaciones que de verdad cambian lo que uno hace, que son
  muchas menos que los ~28 códigos del estándar.

  `mojado` es el campo que importa para el caso real: si el sábado a las 10 se
  puede jugar al tenis o salir a correr.
*/
/*
  El tope del tramo va FUERA del objeto que se devuelve. Si estuviera dentro,
  el `...interpretarCodigo(...)` de más abajo colaría un `hasta: 3` en cada día
  de la previsión: un detalle de esta tabla asomando en los datos de la app.
*/
const CIELOS = [
  { hasta: 0, cielo: { texto: "Despejado", icono: "sol", mojado: false } },
  { hasta: 2, cielo: { texto: "Poco nuboso", icono: "sol-nubes", mojado: false } },
  { hasta: 3, cielo: { texto: "Nublado", icono: "nubes", mojado: false } },
  { hasta: 48, cielo: { texto: "Niebla", icono: "niebla", mojado: false } },
  { hasta: 57, cielo: { texto: "Llovizna", icono: "llovizna", mojado: true } },
  { hasta: 67, cielo: { texto: "Lluvia", icono: "lluvia", mojado: true } },
  { hasta: 77, cielo: { texto: "Nieve", icono: "nieve", mojado: true } },
  { hasta: 82, cielo: { texto: "Chubascos", icono: "lluvia", mojado: true } },
  { hasta: 86, cielo: { texto: "Chubascos de nieve", icono: "nieve", mojado: true } },
  { hasta: 99, cielo: { texto: "Tormenta", icono: "tormenta", mojado: true } },
];

const DESCONOCIDO = { texto: "Sin datos", icono: "nubes", mojado: false };

/*
  Ojo con el hueco vacío: `Number(null)` y `Number("")` valen 0, que es un
  código WMO válido (despejado). Sin descartarlos antes, un día al que le falta
  el `weather_code` se anunciaba como "Despejado" con toda la seguridad del
  mundo. Se comprueba el valor crudo, no el convertido.
*/
export function interpretarCodigo(codigo) {
  if (codigo === null || codigo === undefined || codigo === "") return DESCONOCIDO;
  const n = Number(codigo);
  if (!Number.isFinite(n) || n < 0) return DESCONOCIDO;
  return CIELOS.find((c) => n <= c.hasta)?.cielo ?? DESCONOCIDO;
}

/* ------------------------------------------------------------------ */
/*  Petición                                                           */
/* ------------------------------------------------------------------ */

/*
  `timezone=auto` la resuelve Open-Meteo desde las coordenadas. Es importante:
  sin eso las horas vienen en UTC y "las 10 del sábado" serían las 8, que es
  justo el tipo de error que ya costó caro en `desdeISO` (ver src/lib/fechas.js).
*/
export function urlPrevision(lugar = LUGAR_POR_DEFECTO, dias = 7) {
  const p = new URLSearchParams({
    latitude: String(lugar.lat),
    longitude: String(lugar.lon),
    current: "temperature_2m,weather_code",
    daily: "weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max",
    hourly: "temperature_2m,weather_code,precipitation_probability",
    timezone: "auto",
    forecast_days: String(dias),
  });
  return `${BASE}?${p}`;
}

const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : null);

/*
  De la respuesta de Open-Meteo (columnas paralelas) a algo con lo que se pueda
  trabajar: una lista de días y otra de horas, cada una con su fecha ya cortada.

  Open-Meteo entrega arrays alineados por índice (`time[3]` va con
  `temperature_2m_max[3]`). Se recorre por el array de tiempos y se lee el resto
  por posición; si a la API se le olvidara una columna, sale `null` y no
  revienta la pantalla.
*/
export function parsearPrevision(json) {
  if (!json || typeof json !== "object") return null;

  const d = json.daily || {};
  const h = json.hourly || {};

  const dias = (d.time || []).map((fecha, i) => ({
    fecha,
    codigo: num(d.weather_code?.[i]),
    tmax: num(d.temperature_2m_max?.[i]),
    tmin: num(d.temperature_2m_min?.[i]),
    lluvia: num(d.precipitation_probability_max?.[i]),
    ...interpretarCodigo(d.weather_code?.[i]),
  }));

  const horas = (h.time || []).map((cuando, i) => ({
    // "2026-08-09T10:00" → fecha y hora por separado, que es como se buscan.
    fecha: String(cuando).slice(0, 10),
    hora: String(cuando).slice(11, 16),
    temp: num(h.temperature_2m?.[i]),
    codigo: num(h.weather_code?.[i]),
    lluvia: num(h.precipitation_probability?.[i]),
    ...interpretarCodigo(h.weather_code?.[i]),
  }));

  const ahora = json.current
    ? { temp: num(json.current.temperature_2m), ...interpretarCodigo(json.current.weather_code) }
    : null;

  return { ahora, dias, horas };
}

export const diaDe = (prevision, fechaISO) =>
  prevision?.dias?.find((d) => d.fecha === fechaISO) ?? null;

/*
  El tiempo a una hora concreta: "¿llueve el sábado a las 10?".

  La hora se busca a la baja (las 10:30 caen en el tramo de las 10:00), porque
  Open-Meteo da datos por hora en punto y pedir "10:30" no debería devolver nada.
*/
export function horaDe(prevision, fechaISO, hora) {
  const hh = String(hora ?? "").slice(0, 2);
  if (!hh) return null;
  return prevision?.horas?.find((h) => h.fecha === fechaISO && h.hora.slice(0, 2) === hh) ?? null;
}

/* ------------------------------------------------------------------ */
/*  Caché                                                              */
/* ------------------------------------------------------------------ */

const mismoLugar = (a, b) =>
  Math.abs((a?.lat ?? 0) - (b?.lat ?? 0)) < 0.01 && Math.abs((a?.lon ?? 0) - (b?.lon ?? 0)) < 0.01;

/*
  Además de la edad se comprueba el LUGAR y que el primer día siga siendo hoy.

  Lo segundo importa más de lo que parece: una previsión guardada a las 23:50
  tiene menos de una hora a las 00:10, pero su primer día es ayer, y la pantalla
  de Inicio enseñaría el tiempo de ayer como si fuera el de hoy.
*/
export function cacheValida(entrada, { lugar, ahora = Date.now(), hoy = todayISO() } = {}) {
  if (!entrada?.datos?.dias?.length) return false;
  if (!mismoLugar(entrada.lugar, lugar)) return false;
  if (ahora - Number(entrada.pedidoEn || 0) > CACHE_MS) return false;
  return entrada.datos.dias[0].fecha === hoy;
}

function leerCache() {
  try {
    return JSON.parse(localStorage.getItem(CLAVE_CACHE) || "null");
  } catch {
    return null;
  }
}

function guardarCache(entrada) {
  try {
    localStorage.setItem(CLAVE_CACHE, JSON.stringify(entrada));
  } catch {
    /* Sin sitio en localStorage: se pedirá otra vez, que no es grave. */
  }
}

/* ------------------------------------------------------------------ */
/*  Descarga                                                           */
/* ------------------------------------------------------------------ */

export async function pedirPrevision(lugar = LUGAR_POR_DEFECTO, { dias = 7, signal } = {}) {
  const res = await fetch(urlPrevision(lugar, dias), { signal });
  if (!res.ok) throw new Error(`Open-Meteo respondió ${res.status}`);
  const datos = parsearPrevision(await res.json());
  if (!datos?.dias?.length) throw new Error("Open-Meteo no devolvió previsión");
  return datos;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

/*
  El tiempo, listo para una pantalla.

  Arranca desde la caché si sirve, así que al abrir la app el dato ya está ahí
  sin parpadeo ni petición. Un fallo NO es una pantalla de error: se devuelve
  `error` y quien lo use decide, que normalmente es no enseñar nada. Que no haya
  internet no puede romper la pantalla de Inicio.
*/
export function useTiempo(lugar = LUGAR_POR_DEFECTO, { dias = 7 } = {}) {
  const [prevision, setPrevision] = useState(() => {
    const cache = leerCache();
    return cacheValida(cache, { lugar }) ? cache.datos : null;
  });
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(null);

  // El lugar suele llegar como objeto literal y cambiaría de identidad en cada
  // render; se depende de los números, no de la referencia.
  const { lat, lon } = lugar || {};
  const vivo = useRef(true);

  useEffect(() => {
    vivo.current = true;
    return () => {
      vivo.current = false;
    };
  }, []);

  const refrescar = useCallback(
    async ({ forzar = false } = {}) => {
      const destino = { lat, lon };
      const cache = leerCache();
      if (!forzar && cacheValida(cache, { lugar: destino })) {
        setPrevision(cache.datos);
        return;
      }

      setCargando(true);
      setError(null);
      // Sin corte, una red que no responde deja el "Cargando" para siempre.
      const corte = new AbortController();
      const reloj = setTimeout(() => corte.abort(), 8000);
      try {
        const datos = await pedirPrevision(destino, { dias, signal: corte.signal });
        guardarCache({ pedidoEn: Date.now(), lugar: destino, datos });
        if (vivo.current) setPrevision(datos);
      } catch (e) {
        if (vivo.current) setError(e?.message || "No se pudo consultar el tiempo");
      } finally {
        clearTimeout(reloj);
        if (vivo.current) setCargando(false);
      }
    },
    [lat, lon, dias]
  );

  useEffect(() => {
    refrescar();
  }, [refrescar]);

  return { prevision, cargando, error, refrescar };
}
