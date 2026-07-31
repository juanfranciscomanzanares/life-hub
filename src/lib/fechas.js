/*
  Días, semanas y meses. Las primitivas de calendario que comparten el trabajo y
  el estudio.

  Vivían dentro de trabajo.js, que es donde se escribieron primero. Al querer
  los mismos agregados para las sesiones de estudio, la salida fácil habría sido
  copiarlas —y ya sabemos cómo acaba eso: `redondear` estaba escrito dos veces y
  Finanzas terminó importando el de "trabajo" para cuadrar euros—. Peor aún, la
  trampa de la fecha local que hay más abajo se habría copiado mal en algún
  sitio y la semana saldría corrida un día solo en algunas pantallas.

  Todo trabaja con filas `{ fecha: "aaaa-mm-dd", horas: number }`, que es la
  forma que ya tienen tanto `lh_work_log` como `lh_study_log`.
*/

import { redondear } from "./numeros";

export const DIAS_SEMANA = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const horasDe = (e) => Number(e?.horas) || 0;

export function iso(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/*
  Fecha LOCAL, no UTC: `new Date("2026-07-29")` se interpreta como medianoche
  UTC y en España (UTC+2) eso cae el día 28 por la noche, así que la semana
  salía corrida un día. Con la hora pegada detrás, el navegador la lee en la
  zona horaria del dispositivo, que es lo que quiere decir el usuario cuando
  escribe una fecha.
*/
export function desdeISO(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function sumarDias(fechaISO, dias) {
  const d = desdeISO(fechaISO);
  if (!d) return null;
  d.setDate(d.getDate() + dias);
  return iso(d);
}

// Lunes de la semana a la que pertenece una fecha. La semana empieza en lunes,
// no en domingo: es lo que se espera aquí.
export function lunesDe(fechaISO) {
  const d = desdeISO(fechaISO);
  if (!d) return null;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

const enRango = (fecha, desde, hasta) => fecha >= desde && fecha <= hasta;

const sumar = (filas, predicado) =>
  redondear(filas.reduce((a, e) => (predicado(e) ? a + horasDe(e) : a), 0));

/* Horas de cada día (lunes a domingo) de la semana en la que cae `fecha`. */
export function porDiaDeLaSemana(filas = [], fecha) {
  const lunes = lunesDe(fecha);
  if (!lunes) return [];
  return DIAS_SEMANA.map((etiqueta, i) => {
    const dia = sumarDias(lunes, i);
    return {
      fecha: dia,
      etiqueta,
      horas: sumar(filas, (e) => e?.fecha === dia),
      esHoy: dia === fecha,
    };
  });
}

/* Las últimas `semanas` semanas, de la más antigua a la más reciente. */
export function porSemanas(filas = [], fecha, semanas = 8) {
  const lunesActual = lunesDe(fecha);
  if (!lunesActual) return [];
  const salida = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const desde = sumarDias(lunesActual, -i * 7);
    const hasta = sumarDias(desde, 6);
    const d = desdeISO(desde);
    salida.push({
      desde,
      hasta,
      etiqueta: `${d.getDate()}/${d.getMonth() + 1}`,
      horas: sumar(filas, (e) => enRango(e?.fecha, desde, hasta)),
    });
  }
  return salida;
}

/*
  Los últimos `meses` meses naturales, del más antiguo al más reciente.

  Se construyen con `new Date(año, mes - i, 1)`, que ya normaliza el salto de
  año sin restarlo a mano.
*/
export function porMeses(filas = [], fecha, meses = 6) {
  const base = desdeISO(fecha);
  if (!base) return [];
  const salida = [];
  for (let i = meses - 1; i >= 0; i--) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1);
    const clave = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    salida.push({
      clave,
      etiqueta: MESES[d.getMonth()],
      horas: sumar(filas, (e) => String(e?.fecha || "").slice(0, 7) === clave),
    });
  }
  return salida;
}
