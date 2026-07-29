/*
  Periodos para la Analítica: semana, mes, trimestre y año.

  Todo se compara con cadenas "YYYY-MM-DD" en vez de con objetos Date. Es a
  propósito: las fechas guardadas son días sueltos, sin hora, y `new Date("2026-07-29")`
  se interpreta como UTC, así que en España a última hora de la tarde una fecha
  podía caer en el día anterior. Comparando texto no hay zona horaria que valga.
*/

export const PERIODOS = [
  { id: "semana", nombre: "Semana" },
  { id: "mes", nombre: "Mes" },
  { id: "trimestre", nombre: "Trimestre" },
  { id: "anio", nombre: "Año" },
];

const p2 = (n) => String(n).padStart(2, "0");
export const aISO = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;

// Un Date en hora LOCAL a partir de "YYYY-MM-DD", sin pasar por UTC.
export function deISO(iso) {
  const [a, m, d] = String(iso).split("-").map(Number);
  return new Date(a, (m || 1) - 1, d || 1);
}

const MESES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
const DIAS = ["L", "M", "X", "J", "V", "S", "D"];

// El lunes de la semana de esa fecha. getDay() da 0 el domingo, que aquí es el
// último día, no el primero.
export function lunesDe(fecha) {
  const d = deISO(fecha);
  const desplazamiento = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - desplazamiento);
  return d;
}

/*
  El rango que cubre un periodo, con la fecha ancla dentro.
  `desde` y `hasta` son inclusivos.
*/
export function rangoDe(periodo, ancla) {
  const d = deISO(ancla);

  if (periodo === "semana") {
    const lunes = lunesDe(ancla);
    const domingo = new Date(lunes);
    domingo.setDate(domingo.getDate() + 6);
    return {
      desde: aISO(lunes),
      hasta: aISO(domingo),
      etiqueta: `${lunes.getDate()} ${MESES[lunes.getMonth()]} – ${domingo.getDate()} ${MESES[domingo.getMonth()]}`,
    };
  }

  if (periodo === "mes") {
    const desde = new Date(d.getFullYear(), d.getMonth(), 1);
    // Día 0 del mes siguiente = último del actual, sin tablas de días por mes
    // ni casos especiales con los bisiestos.
    const hasta = new Date(d.getFullYear(), d.getMonth() + 1, 0);
    return {
      desde: aISO(desde),
      hasta: aISO(hasta),
      etiqueta: `${MESES[d.getMonth()]} ${d.getFullYear()}`,
    };
  }

  if (periodo === "trimestre") {
    const primerMes = Math.floor(d.getMonth() / 3) * 3;
    const desde = new Date(d.getFullYear(), primerMes, 1);
    const hasta = new Date(d.getFullYear(), primerMes + 3, 0);
    return {
      desde: aISO(desde),
      hasta: aISO(hasta),
      etiqueta: `T${primerMes / 3 + 1} ${d.getFullYear()}`,
    };
  }

  return {
    desde: `${d.getFullYear()}-01-01`,
    hasta: `${d.getFullYear()}-12-31`,
    etiqueta: String(d.getFullYear()),
  };
}

/*
  Mueve el ancla un periodo entero hacia atrás (-1) o hacia delante (+1).

  Para todo lo que no sea la semana hay que ponerse antes en el día 1. Si no,
  restar un mes al 31 de marzo pide el 31 de febrero, que no existe: JavaScript
  lo desborda al 3 de marzo y te deja en el mismo mes del que querías salir.
  Da igual perder el día, porque el rango se calcula desde el mes entero.
*/
export function mover(periodo, ancla, pasos) {
  const d = deISO(ancla);
  if (periodo === "semana") {
    d.setDate(d.getDate() + 7 * pasos);
    return aISO(d);
  }

  d.setDate(1);
  if (periodo === "mes") d.setMonth(d.getMonth() + pasos);
  else if (periodo === "trimestre") d.setMonth(d.getMonth() + 3 * pasos);
  else d.setFullYear(d.getFullYear() + pasos);
  return aISO(d);
}

export const enRango = (fecha, { desde, hasta }) => {
  const f = String(fecha || "").slice(0, 10);
  return Boolean(f) && f >= desde && f <= hasta;
};

const num = (v) => Number(v) || 0;
const sumar = (filas, campo) => filas.reduce((t, f) => t + num(f[campo]), 0);
const redondear = (n) => Math.round(n * 10) / 10;

/*
  Los tramos en los que se parte el gráfico: días si el periodo es corto, meses
  si es largo. Más de unas 31 barras deja de leerse.
*/
export function tramosDe(periodo, rango) {
  const tramos = [];

  if (periodo === "semana" || periodo === "mes") {
    const fin = deISO(rango.hasta);
    for (let d = deISO(rango.desde); d <= fin; d.setDate(d.getDate() + 1)) {
      tramos.push({
        clave: aISO(d),
        etiqueta: periodo === "semana" ? DIAS[(d.getDay() + 6) % 7] : String(d.getDate()),
        desde: aISO(d),
        hasta: aISO(d),
      });
    }
    return tramos;
  }

  const anio = deISO(rango.desde).getFullYear();
  const primerMes = deISO(rango.desde).getMonth();
  const cuantos = periodo === "trimestre" ? 3 : 12;
  for (let i = 0; i < cuantos; i++) {
    const desde = new Date(anio, primerMes + i, 1);
    const hasta = new Date(anio, primerMes + i + 1, 0);
    tramos.push({
      clave: `${desde.getFullYear()}-${p2(desde.getMonth() + 1)}`,
      etiqueta: MESES[desde.getMonth()],
      desde: aISO(desde),
      hasta: aISO(hasta),
    });
  }
  return tramos;
}

/*
  Todas las métricas de un rango.

  Las fuentes van sueltas y no leídas de dentro para que esto siga siendo una
  función pura y se pueda probar con datos inventados.

  Cuidado con dos cosas que NO se pueden repartir por periodo:
  - `lh_study_hours` es un contador por asignatura sin fecha. Por eso las horas
    de estudio salen de `lh_study_log`, que sí las fecha, y solo cuentan desde
    que existe ese registro.
  - `lh_goals` no guarda cuándo se cumplió una meta, así que "metas conseguidas"
    es una foto de ahora mismo y no del periodo. Se calcula aparte.
*/
export function metricas(datos, rango) {
  const {
    trabajo = [],
    gym = [],
    tenisSesiones = [],
    tenisPartidos = [],
    estudio = [],
    aportaciones = [],
    finanzas = [],
  } = datos;

  const enR = (f) => enRango(f.fecha, rango);

  const trabajoDelRango = trabajo.filter(enR);
  const gymDelRango = gym.filter(enR);
  const tenisDelRango = tenisSesiones.filter(enR);
  const estudioDelRango = estudio.filter(enR);
  const aportacionesDelRango = aportaciones.filter(enR);
  const finanzasDelRango = finanzas.filter(enR);

  /*
    Partidos: los oficiales de la liga y los opens vienen de `lh_tenis_partidos`,
    pero un partido de entreno que hayas apuntado a mano en `lh_tt_sesiones` con
    tipo "Partido" también cuenta como partido disputado.
  */
  const oficiales = tenisPartidos.filter(enR).length;
  const amistosos = tenisDelRango.filter((s) => String(s.tipo).toLowerCase() === "partido").length;

  return {
    horasTrabajo: redondear(sumar(trabajoDelRango, "horas")),
    horasTenis: redondear(sumar(tenisDelRango, "horas")),
    horasEstudio: redondear(sumar(estudioDelRango, "horas")),
    // Días distintos, no filas: en un mismo día hay varias filas (una por
    // ejercicio) y contarlas daría "23 días de gimnasio" en una semana.
    diasGym: new Set(gymDelRango.map((f) => f.fecha)).size,
    entrenosTenis: tenisDelRango.filter((s) => String(s.tipo).toLowerCase() !== "partido").length,
    partidos: oficiales + amistosos,
    partidosOficiales: oficiales,
    invertido: redondear(sumar(aportacionesDelRango, "monto")),
    gastos: redondear(
      finanzasDelRango.filter((f) => num(f.monto) < 0).reduce((t, f) => t + Math.abs(num(f.monto)), 0)
    ),
    ingresos: redondear(finanzasDelRango.filter((f) => num(f.monto) > 0).reduce((t, f) => t + num(f.monto), 0)),
  };
}

// La misma métrica tramo a tramo, para el gráfico de barras.
export function serie(datos, tramos, metrica) {
  return tramos.map((t) => ({
    etiqueta: t.etiqueta,
    valor: metricas(datos, t)[metrica] ?? 0,
  }));
}

// Metas cumplidas ahora mismo (lh_goals no guarda cuándo se cumplieron).
export function metasConseguidas(metas = []) {
  const cumplidas = metas.filter((m) => num(m.objetivo) > 0 && num(m.actual) >= num(m.objetivo));
  return { cumplidas: cumplidas.length, total: metas.length, lista: cumplidas };
}

// Variación porcentual contra el periodo anterior. null cuando no hay con qué
// comparar: un "+100%" desde cero no dice nada.
export function variacion(actual, previo) {
  if (!previo) return null;
  return Math.round(((actual - previo) / previo) * 100);
}
