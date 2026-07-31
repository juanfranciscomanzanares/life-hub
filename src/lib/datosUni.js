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

/* Teoría (grupo completo, sin ambigüedad de subgrupo). Cada fila es una franja
   horaria; solo se rellena la columna del día en que cae esa clase. */
export const SCHEDULE_C1 = [
  { hora: "10:00 - 11:00", dia: "jueves", subject: "Fund. Computadores", curso: "1º", aula: "A.04 Bis" },
  { hora: "15:00 - 17:00", dia: "lunes", subject: "Empresa y Emprendimiento", curso: "4º", aula: "A05" },
  { hora: "15:00 - 17:00", dia: "miercoles", subject: "Ciberseguridad", curso: "4º", aula: "A05" },
  { hora: "17:00 - 19:00", dia: "martes", subject: "Gestión de Proyectos", curso: "4º", aula: "A05" },
  { hora: "18:30 - 20:30", dia: "lunes", subject: "Infraest. Comp. Altas Prest.", curso: "3º", aula: "A.04 Bis" },
];

export const SCHEDULE_C2 = [
  { hora: "16:30 - 18:30", dia: "lunes", subject: "Deep Learning", curso: "3º", aula: "A.04 Bis" },
];

/* Sin horario de aula: prácticas en empresa / tutorías con el tutor. */
export const SIN_HORARIO_FIJO = {
  C1: [{ subject: "Prácticas Externas", curso: "4º", nota: "Horario acordado con la empresa" }],
  C2: [{ subject: "TFG", curso: "4º", nota: "Tutorías con tu tutor/a" }],
};

/* Prácticas de laboratorio: van por subgrupo (1 o 2), que aún no sabes cuál te
   toca — se confirma en el Aula Virtual o el Campus antes de empezar el curso.
   Sacado de las filas de horario entre teorías, cruzando los dos horarios
   propuestos por asignatura. */
export const PRACTICAS_C1 = [
  { subject: "Fund. Computadores", sub1: "Martes 12:00 - 13:00 (Lab 1.7)", sub2: "Miércoles 12:20 - 14:20 (Lab 2.1)" },
  { subject: "Infraest. Comp. Altas Prest.", sub1: "Martes 18:30 - 20:30 (Lab 1.0)", sub2: "Jueves 16:30 - 18:30 (Lab 2.8)" },
  { subject: "Empresa y Emprendimiento", sub1: "Lunes 17:00 - 18:00", sub2: "Martes 19:00 - 20:00" },
  { subject: "Ciberseguridad", sub1: "Miércoles 17:00 - 18:00", sub2: "Lunes 17:00 - 18:00" },
  { subject: "Gestión de Proyectos", sub1: "Martes 19:00 - 20:00", sub2: "Miércoles 17:00 - 18:00" },
];

export const PRACTICAS_C2 = [
  { subject: "Deep Learning", sub1: "Lunes 18:30 - 19:30 (Lab 1.0)", sub2: "Miércoles 18:30 - 19:30 (Lab 2.6)" },
];

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
