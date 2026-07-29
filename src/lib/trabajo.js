/*
  Horas de trabajo: agregados por día y por semana.

  Antes cada registro llevaba un "tipo" (Ingeniería de Datos, Reuniones...) y
  los gráficos repartían las horas por ese tipo. Se quitó a propósito: una hora
  de trabajo es una hora de trabajo, y clasificarla solo añadía un paso al
  apuntarla. Lo que se agrupa ahora es el tiempo.
*/

const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

export const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

const horasDe = (e) => Number(e?.horas) || 0;

function iso(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0"),
  ].join("-");
}

/*
  Fecha local, no UTC: `new Date("2026-07-29")` se interpreta como medianoche
  UTC y en España (UTC+2) eso es el día 28 por la noche, así que la semana
  salía corrida un día.
*/
function desdeISO(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

// Lunes de la semana a la que pertenece una fecha (aaaa-mm-dd).
export function lunesDe(fechaISO) {
  const d = desdeISO(fechaISO);
  if (!d) return null;
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return iso(d);
}

// Horas de cada día (lunes a domingo) de la semana en la que cae `hoy`.
export function horasPorDiaDeLaSemana(log = [], hoy) {
  const lunes = lunesDe(hoy);
  if (!lunes) return [];
  const base = desdeISO(lunes);
  return DIAS.map((etiqueta, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const fecha = iso(d);
    const horas = log.reduce((a, e) => (e?.fecha === fecha ? a + horasDe(e) : a), 0);
    return { fecha, etiqueta, horas: redondear(horas), esHoy: fecha === hoy };
  });
}

// Horas de las últimas `semanas` semanas, de la más antigua a la más reciente.
export function horasPorSemana(log = [], hoy, semanas = 8) {
  const lunesActual = lunesDe(hoy);
  if (!lunesActual) return [];
  const base = desdeISO(lunesActual);
  const filas = [];
  for (let i = semanas - 1; i >= 0; i--) {
    const ini = new Date(base);
    ini.setDate(base.getDate() - i * 7);
    const fin = new Date(ini);
    fin.setDate(ini.getDate() + 6);
    const desde = iso(ini);
    const hasta = iso(fin);
    const horas = log.reduce(
      (a, e) => (e?.fecha >= desde && e?.fecha <= hasta ? a + horasDe(e) : a),
      0
    );
    filas.push({
      desde,
      hasta,
      etiqueta: `${ini.getDate()}/${ini.getMonth() + 1}`,
      horas: redondear(horas),
    });
  }
  return filas;
}

export const totalHoras = (log = []) => redondear(log.reduce((a, e) => a + horasDe(e), 0));

// Coma decimal: el panel está en español y "7.5h" desentonaba con el resto.
export const fmtHoras = (n) =>
  `${Number(n || 0).toLocaleString("es-ES", { maximumFractionDigits: 2 })}h`;
