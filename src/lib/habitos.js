/*
  Hábitos y rachas.

  El modelo anterior guardaba `{ name, streak, week: [7 booleanos] }` y no
  funcionaba:

  - `week` no decía DE QUÉ semana era, así que nunca se reiniciaba: las marcas
    del lunes pasado seguían ahí el lunes siguiente.
  - `streak` era un número que no actualizaba nadie: se creaba a 0 y se quedaba
    a 0 para siempre, así que "Mejor racha" y la racha de Inicio siempre
    marcaban cero.

  Ahora un hábito guarda las FECHAS en las que lo cumpliste:

    { id, name, hecho: ["2026-07-27", "2026-07-28", ...] }

  Con eso la semana se deduce sola, la racha se calcula de verdad y el
  histórico completo queda guardado.
*/

import { todayISO } from "./ui";

const dia = (iso) => String(iso || "").slice(0, 10);

// Suma (o resta) días a una fecha ISO, en hora local.
export function sumarDias(iso, dias) {
  const [a, m, d] = String(iso).split("-").map(Number);
  const fecha = new Date(a, (m || 1) - 1, (d || 1) + dias);
  return todayISO(fecha);
}

// Las siete fechas de la semana (lunes a domingo) que contiene `fecha`.
export function semanaDe(fecha) {
  const [a, m, d] = String(fecha).split("-").map(Number);
  const referencia = new Date(a, (m || 1) - 1, d || 1);
  // getDay() da 0 el domingo; aquí el domingo es el último día, no el primero.
  const lunes = sumarDias(fecha, -((referencia.getDay() + 6) % 7));
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i));
}

/*
  Pasa un hábito al formato nuevo. Idempotente.

  Los `week` antiguos se traen a la semana en curso: no guardaban de qué semana
  eran, así que es la única lectura posible. Se pierde poco (siete casillas) y
  no se inventa histórico.
*/
export function normalizarHabito(habito, hoy = todayISO()) {
  if (Array.isArray(habito.hecho)) return habito;

  const semana = semanaDe(hoy);
  const hecho = Array.isArray(habito.week)
    ? semana.filter((_, i) => habito.week[i])
    : [];

  const { week, streak, ...resto } = habito;
  return { ...resto, hecho };
}

export const estaHecho = (habito, fecha) => (habito.hecho ?? []).includes(dia(fecha));

export function alternarDia(habito, fecha) {
  const f = dia(fecha);
  const hecho = estaHecho(habito, f)
    ? habito.hecho.filter((x) => x !== f)
    : [...(habito.hecho ?? []), f].sort();
  return { ...habito, hecho };
}

/*
  Racha: días seguidos cumpliendo el hábito, contando hacia atrás.

  Empieza en hoy si hoy está hecho y, si no, en ayer. Es lo que hace que la
  racha no se rompa por el mero hecho de que aún no hayas marcado el día en
  curso: a media mañana todavía estás a tiempo.
*/
export function racha(habito, hoy = todayISO()) {
  const hechos = new Set(habito.hecho ?? []);
  if (hechos.size === 0) return 0;

  let cursor = hechos.has(hoy) ? hoy : sumarDias(hoy, -1);
  let total = 0;
  while (hechos.has(cursor)) {
    total += 1;
    cursor = sumarDias(cursor, -1);
  }
  return total;
}

// La racha más larga entre todos los hábitos.
export function mejorRacha(habitos = [], hoy = todayISO()) {
  return habitos.reduce((max, h) => Math.max(max, racha(h, hoy)), 0);
}

export const hechosHoy = (habitos = [], hoy = todayISO()) =>
  habitos.filter((h) => estaHecho(h, hoy)).length;
