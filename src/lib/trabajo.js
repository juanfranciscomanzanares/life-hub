/*
  Horas de trabajo: agregados por día y por semana.

  Antes cada registro llevaba un "tipo" (Ingeniería de Datos, Reuniones...) y
  los gráficos repartían las horas por ese tipo. Se quitó a propósito: una hora
  de trabajo es una hora de trabajo, y clasificarla solo añadía un paso al
  apuntarla. Lo que se agrupa ahora es el tiempo.
*/

import { redondear } from "./numeros";
import { lunesDe, porDiaDeLaSemana, porSemanas } from "./fechas";

// Se reexportan porque varios módulos ya los importaban de aquí.
export { redondear, lunesDe };

const horasDe = (e) => Number(e?.horas) || 0;

/*
  Los agregados por día y por semana los pone ahora src/lib/fechas.js, que es
  quien sabe de calendario. Aquí solo se conservan los nombres, porque son los
  que importan las secciones de trabajo.

  No es un adorno: las sesiones de estudio necesitaban exactamente lo mismo, y
  copiarlo habría duplicado también la trampa de la fecha local (una fecha ISO
  a secas se lee en UTC y en España corre la semana un día).
*/
export const horasPorDiaDeLaSemana = (log = [], hoy) => porDiaDeLaSemana(log, hoy);

export const horasPorSemana = (log = [], hoy, semanas = 8) => porSemanas(log, hoy, semanas);

export const totalHoras = (log = []) => redondear(log.reduce((a, e) => a + horasDe(e), 0));

/* ------------------------------------------------------------------ */
/*  Presencialidad: oficina vs teletrabajo, y kilómetros               */
/* ------------------------------------------------------------------ */

export const MODALIDADES = ["oficina", "teletrabajo"];

export const esModalidad = (v) => MODALIDADES.includes(v);

/*
  Reparto de horas entre oficina y teletrabajo.

  Los registros anteriores a que existiera este campo no tienen modalidad, y
  NO se reparten a ojo: van a `sinIndicar`. Meterlos en un lado u otro daría
  un porcentaje de presencialidad que parece un dato y es una suposición.
  `pctOficina` se calcula solo sobre las horas que sí están clasificadas.
*/
export function repartoModalidad(log = []) {
  const acc = { oficina: 0, teletrabajo: 0, sinIndicar: 0 };
  log.forEach((e) => {
    const clave = esModalidad(e?.modalidad) ? e.modalidad : "sinIndicar";
    acc[clave] += horasDe(e);
  });
  const clasificadas = acc.oficina + acc.teletrabajo;
  return {
    oficina: redondear(acc.oficina),
    teletrabajo: redondear(acc.teletrabajo),
    sinIndicar: redondear(acc.sinIndicar),
    total: redondear(clasificadas + acc.sinIndicar),
    pctOficina: clasificadas > 0 ? Math.round((acc.oficina / clasificadas) * 100) : null,
  };
}

/*
  Días distintos en los que se fue a la oficina, con los km de ese día.

  Los kilómetros se cuentan POR DÍA, no por registro: si una jornada
  presencial se apunta en tres actividades, el trayecto sigue siendo uno y
  sumar los km de cada fila los triplicaría.

  Cada día usa los km declarados en alguno de sus registros (el primero que
  los traiga) y, si ninguno los trae, la distancia habitual `kmPorDefecto`.
  Así el caso normal es no escribir nada, y un día suelto (ir a otra sede,
  volver a casa a comer) se puede corregir a mano sin tocar la configuración.
*/
export function diasEnOficina(log = [], kmPorDefecto = 0) {
  const base = Math.max(0, Number(kmPorDefecto) || 0);
  const porDia = new Map();

  log.forEach((e) => {
    if (!e?.fecha || e.modalidad !== "oficina") return;
    if (!porDia.has(e.fecha)) porDia.set(e.fecha, { fecha: e.fecha, horas: 0, km: null });
    const dia = porDia.get(e.fecha);
    dia.horas = redondear(dia.horas + horasDe(e));
    const km = Number(e.km);
    if (dia.km === null && Number.isFinite(km) && km > 0) dia.km = km;
  });

  return [...porDia.values()]
    .map((d) => ({ ...d, km: redondear(d.km ?? base) }))
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
}

export const kmTotales = (log = [], kmPorDefecto = 0) =>
  redondear(diasEnOficina(log, kmPorDefecto).reduce((a, d) => a + d.km, 0));

// Registros de un mes concreto (clave aaaa-mm).
export const filtrarMes = (log = [], mes) => log.filter((e) => (e?.fecha || "").slice(0, 7) === mes);

/*
  Distancia con coma decimal y sin decimales de más: 12,5 km, 30 km.
  Mismo criterio que `fmtHoras`.
*/
export const fmtKm = (n) =>
  `${Number(n || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })} km`;

// Coma decimal: el panel está en español y "7.5h" desentonaba con el resto.
export const fmtHoras = (n) =>
  `${Number(n || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })}h`;
