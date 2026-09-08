/*
  Catálogos de la carrera: horarios, prácticas y fechas de examen.

  Son datos fijos del curso, no registros del usuario: se pueden rellenar sin
  el riesgo de los datos de ejemplo (un dispositivo nuevo no los sube a
  Supabase como si fueran tuyos, porque no pasan por `usePersisted`).

  Vivían dentro de LifeDashboard.jsx, que era el archivo que se descargaba
  siempre. Aquí viajan en el trozo de Universidad, que solo se pide al abrir
  esa sección.

  SUBJECTS y el calendario académico están en src/lib/uni.js, no aquí: los
  usan también Inicio, el modo foco y el calendario.
*/

/*
  El horario, teoría y prácticas juntas. Cada fila es una clase con su día y su
  franja; la tabla las agrupa por hora.

  Las prácticas van por subgrupo y llevan el tuyo (`subgrupo`), confirmado en el
  Aula Virtual. Antes estaban aparte, en una lista con los dos horarios posibles
  de cada asignatura, porque aún no se sabía cuál tocaba: con el subgrupo ya
  asignado, el otro horario solo estorba. El número tras el punto es el
  subgrupo, o sea 1.2 = grupo 1, subgrupo 2.
*/
export const SCHEDULE_C1 = [
  { hora: "10:00 - 11:00", dia: "jueves", subject: "Fund. Computadores", curso: "1º", aula: "A.04 Bis" },
  { hora: "15:00 - 17:00", dia: "lunes", subject: "Empresa y Emprendimiento", curso: "4º", aula: "A05" },
  { hora: "15:00 - 17:00", dia: "miercoles", subject: "Ciberseguridad", curso: "4º", aula: "A05" },
  { hora: "17:00 - 19:00", dia: "martes", subject: "Gestión de Proyectos", curso: "4º", aula: "A05" },
  { hora: "18:30 - 20:30", dia: "lunes", subject: "Infraest. Comp. Altas Prest.", curso: "3º", aula: "A.04 Bis" },

  { hora: "12:20 - 14:20", dia: "miercoles", subject: "Fund. Computadores", curso: "1º", aula: "Lab 2.1", practicas: true, subgrupo: "1.2" },
  { hora: "16:30 - 18:30", dia: "jueves", subject: "Infraest. Comp. Altas Prest.", curso: "3º", aula: "Lab 2.8", practicas: true, subgrupo: "1.2" },
  { hora: "17:00 - 18:00", dia: "lunes", subject: "Empresa y Emprendimiento", curso: "4º", practicas: true, subgrupo: "1.1" },
  { hora: "17:00 - 18:00", dia: "miercoles", subject: "Ciberseguridad", curso: "4º", practicas: true, subgrupo: "1.1" },
  { hora: "19:00 - 20:00", dia: "martes", subject: "Gestión de Proyectos", curso: "4º", practicas: true, subgrupo: "1.1" },
];

export const SCHEDULE_C2 = [
  { hora: "16:30 - 18:30", dia: "lunes", subject: "Deep Learning", curso: "3º", aula: "A.04 Bis" },
  { hora: "18:30 - 19:30", dia: "miercoles", subject: "Deep Learning", curso: "3º", aula: "Lab 2.6", practicas: true, subgrupo: "1.2" },
];

/* Sin horario de aula: prácticas en empresa / tutorías con el tutor. */
export const SIN_HORARIO_FIJO = {
  C1: [{ subject: "Prácticas Externas", curso: "4º", nota: "Horario acordado con la empresa" }],
  C2: [{ subject: "TFG", curso: "4º", nota: "Tutorías con tu tutor/a" }],
};

const DIA_INDICE = { lunes: 0, martes: 1, miercoles: 2, jueves: 3, viernes: 4 };

/*
  El horario visto como rutina semanal, que es como lo quiere el Calendario
  (día 0=lunes y hora de inicio suelta).

  Se deriva del horario en vez de copiarse: la copia a mano que había en
  Calendario.jsx ya se había desajustado —las prácticas de Gestión de Proyectos
  salían un miércoles a las 19:00, que no es ninguno de los dos subgrupos— y
  nada avisaba, porque eran dos listas sin relación.
*/
export function clasesSemanales() {
  return [...SCHEDULE_C1, ...SCHEDULE_C2].map((c) => ({
    dia: DIA_INDICE[c.dia],
    hora: c.hora.slice(0, 5),
    titulo: `${c.subject} (${c.practicas ? `prácticas ${c.subgrupo}` : "teoría"})`,
    tipo: "Universidad",
  }));
}

/* Convocatoria I (calendario de exámenes GCID 2026/27) */
export const EXAM_DATES = [
  { subject: "Empresa y Emprendimiento", fecha: "17 dic 2026", dia: "Jueves", turno: "Mañana", cuatr: "C1" },
  { subject: "Deep Learning", fecha: "21 dic 2026", dia: "Lunes", turno: "Tarde", cuatr: "C2" },
  { subject: "Ciberseguridad", fecha: "07 ene 2027", dia: "Jueves", turno: "Mañana", cuatr: "C1" },
  { subject: "Fund. Computadores", fecha: "11 ene 2027", dia: "Lunes", turno: "Tarde", cuatr: "C1" },
  { subject: "Gestión de Proyectos", fecha: "14 ene 2027", dia: "Jueves", turno: "Mañana", cuatr: "C1" },
  { subject: "Infraest. Comp. Altas Prest.", fecha: "15 ene 2027", dia: "Viernes", turno: "Tarde", cuatr: "C1" },
];

export const ESTADO_AULA = {
  abierta: { texto: "Abierta", clase: "bg-emerald-500/15 text-emerald-300" },
  proxima: { texto: "Próxima", clase: "bg-sky-500/15 text-sky-300" },
  entregada: { texto: "Entregada", clase: "bg-indigo-500/15 text-indigo-300" },
  cerrada: { texto: "Cerrada", clase: "bg-slate-700/60 text-slate-400" },
};

/*
  Vacío a propósito: un registro de ejemplo en un dispositivo nuevo se sube a
  Supabase como si fuera un dato real tuyo.

  Ya no hay INITIAL_STUDY_HOURS: las horas de estudio salen de `lh_study_log`,
  el registro con fecha, y no del contador suelto por asignatura (ver
  src/lib/estudio.js).
*/
export const INITIAL_UNI_TASKS = [];
