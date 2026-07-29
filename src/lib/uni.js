/*
  Universidad: asignaturas del curso y calendario académico oficial.

  Vive aquí y no dentro de LifeDashboard.jsx porque lo necesitan varias
  pantallas (Inicio, Foco, Calendario). Tenerlo repetido fue justo lo que pasó:
  el modo foco arrastraba una lista inventada ("Álgebra", "Cálculo"...) que no
  se parecía en nada a las asignaturas reales.
*/

export const CURSO = "2026/2027";

/* Curso 2026/2027, según resguardo de matrícula (28/07/2026) y horarios
   oficiales GCID de la Facultad de Informática (UMU). */
export const SUBJECTS = [
  "Fund. Computadores",
  "Infraest. Comp. Altas Prest.",
  "Deep Learning",
  "Gestión de Proyectos",
  "Ciberseguridad",
  "Empresa y Emprendimiento",
  "TFG",
  "Prácticas Externas",
];

/*
  Calendario académico 2026/2027 de la Facultad de Informática, aprobado en
  Consejo de Gobierno de 6 de marzo de 2026.

  Las fechas están copiadas del PDF de Secretaría General. Los tramos van con
  desde/hasta inclusivos.
*/
export const PERIODOS_UMU = [
  { id: "c1", titulo: "1er cuatrimestre", desde: "2026-09-07", hasta: "2026-12-11", tipo: "clases" },
  { id: "conv1-dic", titulo: "Convocatoria I de exámenes", desde: "2026-12-14", hasta: "2026-12-16", tipo: "examenes" },
  { id: "conv1-ene", titulo: "Convocatoria I de exámenes", desde: "2027-01-08", hasta: "2027-01-16", tipo: "examenes" },
  { id: "c2", titulo: "2º cuatrimestre", desde: "2027-01-18", hasta: "2027-05-07", tipo: "clases" },
  { id: "conv2", titulo: "Convocatoria II de exámenes", desde: "2027-05-10", hasta: "2027-05-29", tipo: "examenes" },
  { id: "conv3", titulo: "Convocatoria III de exámenes", desde: "2027-06-14", hasta: "2027-07-03", tipo: "examenes" },
];

// Días sueltos no lectivos.
export const FESTIVOS_UMU = [
  { fecha: "2026-09-15", titulo: "Romería" },
  { fecha: "2026-10-12", titulo: "Día de la Hispanidad" },
  { fecha: "2026-11-01", titulo: "Día de Todos los Santos" },
  // Patrón de la Facultad de Informática: sale en la rejilla mensual del PDF,
  // no en la tabla de festivos generales de la Universidad.
  { fecha: "2026-11-13", titulo: "San Alberto Magno (Facultad de Informática)" },
  { fecha: "2026-12-07", titulo: "Día de la Constitución" },
  { fecha: "2026-12-08", titulo: "Inmaculada Concepción" },
  { fecha: "2027-01-29", titulo: "Santo Tomás de Aquino" },
  { fecha: "2027-03-19", titulo: "San José" },
  { fecha: "2027-05-01", titulo: "Día del Trabajo" },
  { fecha: "2027-06-09", titulo: "Día de la Región de Murcia" },
];

// Periodos de vacaciones, con los dos extremos incluidos.
export const VACACIONES_UMU = [
  { titulo: "Vacaciones de Navidad", desde: "2026-12-23", hasta: "2027-01-06" },
  { titulo: "Semana Santa y Fiestas de Primavera", desde: "2027-03-22", hasta: "2027-04-04" },
];

const dia = (iso) => String(iso || "").slice(0, 10);
const dentro = (fecha, { desde, hasta }) => dia(fecha) >= desde && dia(fecha) <= hasta;

/*
  Qué hay en el calendario académico ese día: vacaciones y festivos mandan
  sobre el cuatrimestre, porque un 8 de diciembre cae dentro del 1er
  cuatrimestre pero no hay clase.
*/
export function queHayEl(fecha) {
  const f = dia(fecha);
  if (!f) return null;

  const vacaciones = VACACIONES_UMU.find((v) => dentro(f, v));
  if (vacaciones) return { tipo: "vacaciones", titulo: vacaciones.titulo };

  const festivo = FESTIVOS_UMU.find((x) => x.fecha === f);
  if (festivo) return { tipo: "festivo", titulo: festivo.titulo };

  const periodo = PERIODOS_UMU.find((p) => dentro(f, p));
  if (periodo) return { tipo: periodo.tipo, titulo: periodo.titulo };

  return null;
}

export const esLectivo = (fecha) => queHayEl(fecha)?.tipo === "clases";

/*
  El calendario entero como eventos sueltos, listos para volcarlos en
  `lh_events`. Los periodos se marcan solo en su primer y último día: pintar
  los 68 días de un cuatrimestre llenaría el calendario de ruido y taparía lo
  que de verdad hay ese día.
*/
export function eventosDelCalendario() {
  const eventos = [];

  PERIODOS_UMU.forEach((p) => {
    eventos.push({ fecha: p.desde, titulo: `Empieza: ${p.titulo}` });
    eventos.push({ fecha: p.hasta, titulo: `Termina: ${p.titulo}` });
  });

  VACACIONES_UMU.forEach((v) => {
    eventos.push({ fecha: v.desde, titulo: `Empiezan: ${v.titulo}` });
    eventos.push({ fecha: v.hasta, titulo: `Terminan: ${v.titulo}` });
  });

  FESTIVOS_UMU.forEach((f) => eventos.push({ fecha: f.fecha, titulo: `Festivo: ${f.titulo}` }));

  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha));
}

/*
  Lo de hoy para la pantalla de Inicio.

  Solo HOY: lo que se entrega hoy y lo que pasa hoy (un examen, una cita). Lo
  vencido queda fuera a propósito. Se probó a incluirlo y el resultado fue una
  lista interminable: cualquier tarea antigua sin marcar como hecha se queda
  ahí para siempre y tapa lo que de verdad toca hoy. Lo atrasado se ve en la
  lista de tareas de Universidad, que es su sitio.

  Las tareas del Aula Virtual que ya has pasado a las tuyas no se cuentan dos
  veces; se reconocen por `aulaId`.
*/
export function urgenciasDeHoy({ tareasUni = [], tareasAula = [], eventos = [], hoy }) {
  const lista = [];
  const yaPuestas = new Set(tareasUni.map((t) => t.aulaId).filter(Boolean));

  tareasUni.forEach((t) => {
    if (t.done || dia(t.entrega) !== hoy) return;
    lista.push({ id: `tarea-${t.id}`, tipo: "entrega", titulo: t.text, detalle: t.subject, fecha: hoy });
  });

  tareasAula.forEach((t) => {
    if (yaPuestas.has(t.id)) return;
    if (dia(t.entrega ?? t.cierra) !== hoy) return;
    lista.push({ id: `aula-${t.id}`, tipo: "entrega", titulo: t.titulo, detalle: t.asignatura, fecha: hoy });
  });

  eventos.forEach((e) => {
    if (dia(e.fecha) !== hoy) return;
    const esExamen = /^ex[áa]men/i.test(String(e.titulo).trim());
    lista.push({
      id: `evento-${e.id ?? e.titulo}`,
      tipo: esExamen ? "examen" : "evento",
      titulo: e.titulo,
      detalle: esExamen ? "Examen" : "Hoy",
      fecha: hoy,
    });
  });

  // Los exámenes primero: es lo que no se puede mover de sitio.
  const orden = { examen: 0, entrega: 1, evento: 2 };
  return lista.sort((a, b) => orden[a.tipo] - orden[b.tipo] || a.titulo.localeCompare(b.titulo));
}
