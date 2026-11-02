/*
  Plan físico para tenis de mesa, 12 semanas.

  Es el plan de PLAN-FISICO-TENIS-DE-MESA.md pasado a datos: rutinas de
  gimnasio, sesiones de la semana tipo, guías (calentamientos, movilidad,
  estiramientos) y fases. Aquí solo hay tablas y funciones puras, para poder
  probarlo en `node`; quien escribe en el store es la pestaña Plan del
  Gimnasio (src/sections/gym/Plan.jsx).

  Al activarlo, cada cosa va a su sitio de siempre y no a un mundo aparte:

    - las rutinas, a `lh_gym_rutinas`, para empezarlas como cualquier otra;
    - la técnica de cada ejercicio, a `lh_gym_ejercicios` como descripción;
    - las sesiones, a la rutina semanal (`lh_routine`), que es lo que leen el
      Calendario, "Hoy" de Inicio y los avisos;
    - los hitos (tests, cambios de fase, descarga), a `lh_events`.

  Todo lo que se crea lleva `plan: PLAN_ID`, para poder quitarlo de golpe del
  calendario sin tocar lo que hubieras puesto tú.

  Los nombres de los ejercicios son los del catálogo de src/lib/gym.js cuando
  existe uno equivalente ("Elevación de gemelos" y no "Gemelos de pie"): el
  progreso y los récords van por nombre, y con otro nombre el historial que ya
  tuvieras de ese ejercicio quedaría partido en dos.
*/

import { sumarDias, desdeISO } from "./fechas";
import { nuevoId } from "./id";

export const PLAN_ID = "tenis12";
export const SEMANAS_PLAN = 12;

/* ---------- Fases ---------- */

export const FASES = [
  {
    desde: 1,
    hasta: 3,
    nombre: "Adaptación",
    cambios: "En pierna, RIR 3 y técnica. Nordic 2×3. Saltos bajos con pausa al caer.",
  },
  {
    desde: 4,
    hasta: 7,
    nombre: "Fuerza",
    cambios:
      "Sentadilla a 4 series. Zancadas con mancuernas. RIR 2 en pierna y 1 en tren superior. Sube peso cuando completes todas las repeticiones.",
  },
  {
    desde: 8,
    hasta: 8,
    nombre: "Descarga",
    cambios: "Mismos ejercicios y mismo peso, pero la mitad de series.",
  },
  {
    desde: 9,
    hasta: 12,
    nombre: "Potencia",
    cambios:
      "Mantén los pesos de pierna con una serie menos y muévelos rápido al subir. Skater jumps sin pausa. Drill reactivo a 8×10 s.",
  },
];

export const SEMANA_DESCARGA = 8;

/*
  Semana del plan en la que cae una fecha: 1 la primera, 12 la última. Fuera
  del plan devuelve 0 o menos (antes de empezar) o más de 12 (ya terminado):
  quien la use decide qué enseñar, aquí no se recorta para no esconder eso.
*/
export function semanaDelPlan(inicioISO, fechaISO) {
  const a = desdeISO(inicioISO);
  const b = desdeISO(fechaISO);
  if (!a || !b) return null;
  // Math.round y no floor: un cambio de hora mete 23 o 25 horas en un día y la
  // división ya no da entera.
  const dias = Math.round((b - a) / 86400000);
  return Math.floor(dias / 7) + 1;
}

export const dentroDelPlan = (semana) => semana != null && semana >= 1 && semana <= SEMANAS_PLAN;

export function faseDe(semana) {
  return FASES.find((f) => semana >= f.desde && semana <= f.hasta) || null;
}

/*
  Objetivo de un ejercicio en una semana concreta.

  Tres capas, en este orden:
    1. lo base del ejercicio (series, reps y texto de las reps);
    2. su propio tramo en `fases`, si lo tiene (la sentadilla pasa a 4×6-8 en
       la semana 4, el nordic sube en la 3 y en la 5...);
    3. lo que impone la fase a todo: en la descarga, la mitad de series; en
       potencia, una serie menos en los ejercicios de fuerza de pierna.

  Sin semana (rutina empezada fuera del plan) se queda en lo base.
*/
export function objetivoDe(ej, semana = null) {
  let series = Number(ej.series) || 1;
  let reps = Number(ej.reps) || 0;
  let repsTexto = ej.repsTexto ?? String(reps);
  let nota = "";

  if (semana != null) {
    const tramo = [...(ej.fases || [])]
      .sort((a, b) => a.desde - b.desde)
      .filter((f) => semana >= f.desde)
      .at(-1);
    if (tramo) {
      series = tramo.series ?? series;
      reps = tramo.reps ?? reps;
      repsTexto = tramo.repsTexto ?? (tramo.reps != null ? String(tramo.reps) : repsTexto);
      nota = tramo.nota ?? "";
    }

    if (semana === SEMANA_DESCARGA) {
      series = Math.max(1, Math.ceil(series / 2));
      nota = "descarga: mismo peso, mitad de series";
    } else if (semana > SEMANA_DESCARGA && ej.pierna && series > 1) {
      series -= 1;
      nota = nota || "mismo peso, subiendo rápido";
    }
  }

  const texto = ej.dosis || `${series}×${repsTexto}`;
  return { series, reps, texto, nota };
}

// La línea que se escribe en la nota del ejercicio al empezar la rutina.
export function notaObjetivo(ej, semana = null) {
  const o = objetivoDe(ej, semana);
  return [
    `Objetivo: ${o.texto}`,
    ej.rir && ej.rir !== "—" ? `RIR ${ej.rir}` : "",
    ej.descanso ? `descanso ${ej.descanso}` : "",
    o.nota,
  ]
    .filter(Boolean)
    .join(" · ");
}

/* ---------- Rutinas de gimnasio ---------- */

export const RUTINAS_PLAN = [
  {
    clave: "lunes-pierna",
    nombre: "Plan · Lunes · Pierna",
    duracion: "35-40 min",
    nota: "Primero el calentamiento de gimnasio. Como hay tenis al día siguiente, no se lleva al fallo.",
    ejercicios: [
      {
        nombre: "Sentadilla goblet",
        grupo: "Piernas",
        series: 3,
        reps: 8,
        repsTexto: "8",
        fases: [{ desde: 4, series: 4, reps: 6, repsTexto: "6-8" }],
        descanso: "2 min",
        rir: "3 → 2",
        pierna: true,
        como: "Mancuerna pegada al pecho, pies a la anchura de los hombros con las puntas un poco abiertas. Baja hasta que los muslos queden paralelos al suelo o algo más, rodillas en la dirección de los pies y pecho alto. Tempo 3-1-1.",
      },
      {
        nombre: "Peso muerto rumano",
        series: 3,
        reps: 8,
        descanso: "2 min",
        rir: "3 → 2",
        pierna: true,
        como: "Con mancuernas. Rodillas un poco flexionadas y siempre igual; cadera atrás con la espalda recta y las mancuernas rozando las piernas. Baja en 3 s hasta notar tirón en los isquios y sube apretando el glúteo. Si la espalda se redondea, has bajado demasiado.",
      },
      {
        nombre: "Hip thrust",
        series: 3,
        reps: 10,
        descanso: "90 s",
        rir: "2",
        pierna: true,
        como: "Con barra o en máquina. Espalda alta en un banco y barra sobre la cadera con almohadilla. Sube hasta que el tronco quede recto, aprieta el glúteo 1 s arriba y no arquees la zona lumbar.",
      },
      {
        nombre: "Elevación de gemelos",
        series: 3,
        reps: 12,
        repsTexto: "12-15",
        descanso: "60 s",
        rir: "1",
        como: "De pie. 1 s de pausa abajo, con el gemelo estirado, y 1 s arriba: así también ganas movilidad de tobillo.",
      },
    ],
  },
  {
    clave: "lunes-empuje",
    nombre: "Plan · Lunes 20:30 · Pecho, hombro y tríceps",
    duracion: "55-60 min",
    nota: "Después, estiramientos de después de entrenar y añade el de pectoral.",
    ejercicios: [
      {
        nombre: "Press banca",
        series: 4,
        reps: 6,
        repsTexto: "6-10",
        descanso: "2 min",
        rir: "2 → 1",
        como: "Con barra o mancuernas. Junta las escápulas y llévalas hacia abajo, pies firmes. Baja a la parte baja del pecho con los codos a unos 45° del cuerpo.",
      },
      {
        nombre: "Press inclinado",
        series: 3,
        reps: 8,
        repsTexto: "8-12",
        descanso: "90 s",
        rir: "2 → 1",
        como: "Con mancuernas.",
      },
      {
        nombre: "Press militar",
        series: 3,
        reps: 8,
        repsTexto: "8-10",
        descanso: "90 s",
        rir: "2",
        como: "Con mancuernas, sentado. Espalda pegada al respaldo, sin arquear la zona lumbar; baja hasta la altura de las orejas. Si molesta el hombro del brazo de jugar, quítalo y deja solo las elevaciones laterales.",
      },
      {
        nombre: "Aperturas en polea",
        series: 3,
        reps: 10,
        repsTexto: "10-12",
        descanso: "75 s",
        rir: "1",
      },
      {
        nombre: "Elevaciones laterales",
        series: 3,
        reps: 12,
        repsTexto: "12-15",
        descanso: "60 s",
        rir: "1",
        como: "Codos un poco flexionados. Sube hasta la altura de los hombros, sin impulso.",
      },
      {
        nombre: "Extensión en polea",
        series: 3,
        reps: 10,
        repsTexto: "10-12",
        descanso: "60 s",
        rir: "1",
        como: "Con cuerda. Codos quietos pegados al cuerpo; solo se mueve el antebrazo.",
      },
      {
        nombre: "Extensión sobre cabeza",
        series: 2,
        reps: 10,
        repsTexto: "10-12",
        descanso: "60 s",
        rir: "1",
        como: "Codos quietos; solo se mueve el antebrazo.",
      },
    ],
  },
  {
    clave: "martes-tiron",
    nombre: "Plan · Martes 20:30 · Espalda, bíceps y core",
    duracion: "45-50 min",
    nota: "Llegas caliente del tenis: 15 separaciones de goma y una serie ligera de jalón. Entre las dos sesiones, un plátano o un yogur y agua. Con prisa: jalón, remo con mancuerna, curl y pallof.",
    ejercicios: [
      {
        nombre: "Jalón al pecho",
        series: 4,
        reps: 6,
        repsTexto: "6-10",
        descanso: "2 min",
        rir: "2 → 1",
        como: "O dominadas asistidas. Pecho alto y barra a la clavícula; piensa en meter los codos en los bolsillos, sin balancearte.",
      },
      {
        nombre: "Remo con mancuerna",
        series: 3,
        reps: 8,
        repsTexto: "8-12 por lado",
        descanso: "90 s",
        rir: "1",
        como: "A una mano. Tira con el codo hacia la cadera y junta la escápula al final, sin girar el tronco.",
      },
      {
        nombre: "Remo en polea",
        series: 3,
        reps: 10,
        repsTexto: "10-12",
        descanso: "90 s",
        rir: "1",
        como: "Sentado, agarre neutro. Codo hacia la cadera y junta la escápula al final.",
      },
      {
        nombre: "Face pull",
        series: 3,
        reps: 15,
        descanso: "60 s",
        rir: "1",
        como: "Cuerda a la altura de la cara. Tira hacia las orejas separando las manos, con los codos altos.",
      },
      {
        nombre: "Curl con mancuernas",
        series: 3,
        reps: 10,
        repsTexto: "10-12",
        descanso: "60 s",
        rir: "1",
        como: "Codos quietos junto al cuerpo y bajada lenta (2-3 s), sin balanceo.",
      },
      {
        nombre: "Curl martillo",
        series: 2,
        reps: 10,
        repsTexto: "10-12",
        descanso: "60 s",
        rir: "1",
        como: "Codos quietos y bajada lenta, sin balanceo.",
      },
      {
        nombre: "Pallof press",
        grupo: "Core",
        series: 3,
        reps: 10,
        repsTexto: "10 por lado",
        descanso: "45 s",
        como: "De lado a la polea con el agarre en el pecho. Empuja los brazos al frente sin dejar que el tronco gire, aguanta 2 s y vuelve. Como zurdo siempre giras hacia el mismo lado: haz los dos por igual.",
      },
      {
        nombre: "Plancha lateral",
        series: 3,
        reps: 30,
        repsTexto: "30 s por lado (sube a 45 s)",
        descanso: "45 s",
      },
    ],
  },
  {
    clave: "miercoles-velocidad",
    nombre: "Plan · Miércoles · Velocidad, saltos y pierna",
    duracion: "unos 50 min",
    nota: "Calentamiento de 10 min. Primero lo rápido, con las piernas frescas, y después la fuerza. Si no vas al gimnasio, haz los bloques A y B en casa o en una pista. Semana de partido importante: solo A y B.",
    ejercicios: [
      {
        bloque: "A · Velocidad y reacción",
        nombre: "Drill dentro-fuera",
        grupo: "Otro",
        series: 6,
        reps: 10,
        repsTexto: "10 s",
        descanso: "50 s",
        como: "Desde la posición de espera, entra con zancada a tocar una marca a 1 m y vuelve a la base. Máxima velocidad.",
      },
      {
        bloque: "A · Velocidad y reacción",
        nombre: "Drill combinado reactivo",
        grupo: "Otro",
        series: 6,
        reps: 10,
        repsTexto: "10 s",
        fases: [{ desde: 9, series: 8 }],
        descanso: "50 s",
        como: "Un compañero señala corto, largo, derecha o izquierda al azar. Si vas solo, una app de estímulos aleatorios (\"reaction trainer\").",
      },
      {
        bloque: "A · Velocidad y reacción",
        nombre: "Coger una pelota que cae",
        grupo: "Otro",
        series: 1,
        reps: 0,
        dosis: "3 min",
        como: "Alguien la suelta a la altura del hombro y la coges antes del segundo bote. Después, con una pelota de reacción.",
      },
      {
        bloque: "B · Saltos",
        nombre: "Pogo jumps",
        grupo: "Piernas",
        series: 3,
        reps: 15,
        descanso: "60 s",
        como: "Rebotes cortos sobre la parte delantera del pie, rodillas casi rectas y el mínimo tiempo en el suelo.",
      },
      {
        bloque: "B · Saltos",
        nombre: "Skater jumps",
        grupo: "Piernas",
        series: 3,
        reps: 6,
        repsTexto: "6 por lado",
        fases: [{ desde: 9, nota: "sin pausa al caer" }],
        descanso: "75 s",
        como: "Salta de lado a una pierna y aguanta 2 s al caer con la rodilla estable. Desde la semana 9, sin pausa.",
      },
      {
        bloque: "C · Fuerza específica",
        nombre: "Zancada con retorno explosivo",
        grupo: "Piernas",
        series: 3,
        reps: 6,
        repsTexto: "6 por pierna",
        fases: [{ desde: 4, nota: "con mancuernas ligeras" }],
        descanso: "90 s",
        pierna: true,
        como: "Paso largo al frente, frena y vuelve de un empujón con la pierna de delante. Sin peso al principio; desde la semana 4, con mancuernas ligeras.",
      },
      {
        bloque: "C · Fuerza específica",
        nombre: "Sentadilla búlgara",
        series: 3,
        reps: 8,
        repsTexto: "8 por pierna",
        descanso: "90 s",
        pierna: true,
        como: "Pie de atrás sobre un banco y torso un poco inclinado. Baja hasta que la rodilla de atrás casi toque el suelo.",
      },
      {
        bloque: "C · Fuerza específica",
        nombre: "Nordic curl asistido",
        grupo: "Piernas",
        series: 2,
        reps: 3,
        fases: [
          { desde: 3, series: 2, reps: 4 },
          { desde: 5, series: 3, reps: 5 },
        ],
        descanso: "2 min",
        como: "De rodillas con los tobillos sujetos (compañero o barra del multipower con almohadilla) y una goma al pecho. Déjate caer lo más lento posible con el cuerpo recto y vuelve empujando con las manos. Las dos primeras semanas da muchas agujetas.",
      },
      {
        bloque: "C · Fuerza específica",
        nombre: "Isométrico en zancada baja",
        grupo: "Piernas",
        series: 2,
        reps: 30,
        repsTexto: "30 s por pierna",
        descanso: "45 s",
        como: "Tu postura al entrar bajo la mesa: pierna delantera muy flexionada y tronco adelantado.",
      },
    ],
  },
];

/*
  Rutinas listas para guardar en `lh_gym_rutinas`. Las que ya estén (por
  `clave`) no se vuelven a crear: activar el plan dos veces no duplica nada, y
  si has retocado una rutina no se te pisa.
*/
export function rutinasParaGuardar(existentes = [], grupoDe = () => "Otro") {
  const ya = new Set(existentes.filter((r) => r.plan === PLAN_ID).map((r) => r.clave));
  return RUTINAS_PLAN.filter((r) => !ya.has(r.clave)).map((r) => ({
    id: nuevoId(),
    plan: PLAN_ID,
    clave: r.clave,
    nombre: r.nombre,
    nota: r.nota,
    ejercicios: r.ejercicios.map(({ como, ...ej }) => ({
      ...ej,
      id: nuevoId(),
      grupo: ej.grupo || grupoDe(ej.nombre),
    })),
  }));
}

/*
  La técnica de cada ejercicio, como ejercicio propio con su descripción. Así
  sale al elegirlo en Rutinas y en Sesión. Si ya tienes uno propio con ese
  nombre, se respeta el tuyo.
*/
export function ejerciciosParaGuardar(propios = [], grupoDe = () => "Otro") {
  const ya = new Set(propios.map((e) => String(e.nombre).toLowerCase()));
  const vistos = new Set();
  return RUTINAS_PLAN.flatMap((r) => r.ejercicios)
    .filter((ej) => ej.como)
    .filter((ej) => {
      const k = ej.nombre.toLowerCase();
      if (ya.has(k) || vistos.has(k)) return false;
      vistos.add(k);
      return true;
    })
    .map((ej) => ({
      id: nuevoId(),
      plan: PLAN_ID,
      nombre: ej.nombre,
      grupo: ej.grupo || grupoDe(ej.nombre),
      descripcion: ej.como,
    }));
}

/* ---------- Semana tipo y calendario ---------- */

/*
  Las sesiones fijas de la semana (0 = lunes). La hora de la pierna del lunes,
  la del miércoles y la del domingo es una propuesta: el plan las deja "a la
  hora que te venga bien", y las 10:00 caen fuera de las clases de ese día.

  El partido del sábado va sin hora porque cambia cada jornada.
*/
export const SESIONES = [
  { clave: "lunes-pierna", dia: 0, hora: "10:00", tipo: "Gym", titulo: "Pierna + movilidad (plan)", rutina: "lunes-pierna" },
  { clave: "lunes-empuje", dia: 0, hora: "20:30", tipo: "Gym", titulo: "Gym: pecho, hombro y tríceps", rutina: "lunes-empuje" },
  { clave: "martes-tenis", dia: 1, hora: "19:00", tipo: "Tenis", titulo: "Tenis", calentamiento: "tenis" },
  { clave: "martes-tiron", dia: 1, hora: "20:30", tipo: "Gym", titulo: "Gym: espalda, bíceps y core", rutina: "martes-tiron" },
  { clave: "miercoles-velocidad", dia: 2, hora: "10:00", tipo: "Gym", titulo: "Velocidad, saltos y pierna", rutina: "miercoles-velocidad" },
  { clave: "jueves-tenis", dia: 3, hora: "19:00", tipo: "Tenis", titulo: "Tenis + estiramientos", calentamiento: "tenis" },
  { clave: "sabado-partido", dia: 5, hora: "", tipo: "Tenis", titulo: "Partido (calentamiento 12-15 min)", calentamiento: "partido" },
  { clave: "domingo-cardio", dia: 6, hora: "10:00", tipo: "Gym", titulo: "Cardio suave + flexibilidad larga", guia: "flexibilidad" },
];

// Lo que pone la tabla "Semana tipo" del plan, para enseñarla tal cual.
export const SEMANA_TIPO = [
  { dia: "Lunes", manana: "Pierna (35-40 min) y movilidad", tarde: "20:30 gimnasio con amigos: pecho, hombro y tríceps" },
  { dia: "Martes", manana: "Movilidad diaria (10 min)", tarde: "19:00 tenis, después 20:30 gimnasio: espalda, bíceps y core" },
  { dia: "Miércoles", manana: "Velocidad, saltos y pierna (50 min)", tarde: "Caminar" },
  { dia: "Jueves", manana: "Movilidad diaria (10 min)", tarde: "19:00 tenis y estiramientos después" },
  { dia: "Viernes", manana: "Descanso o tenis en Lorca", tarde: "Movilidad suave" },
  { dia: "Sábado", manana: "Partido, con el calentamiento de partido", tarde: "Estiramientos después" },
  { dia: "Domingo", manana: "Cardio suave (40-60 min) y flexibilidad larga (25 min)", tarde: "—" },
];

export const sesionesDelDia = (dia) => SESIONES.filter((s) => s.dia === dia);

/*
  Entradas para la rutina semanal del Calendario. No se mete una sesión si ya
  hay algo del mismo tipo ese día a esa hora: el tenis de los martes y jueves
  es muy probable que ya lo tuvieras apuntado, y saldría dos veces.
*/
export function rutinaSemanalParaGuardar(rutinaActual = []) {
  const ocupado = new Set(rutinaActual.map((r) => `${Number(r.dia)}|${r.hora}|${r.tipo}`));
  return SESIONES.filter((s) => !ocupado.has(`${s.dia}|${s.hora}|${s.tipo}`)).map((s) => ({
    id: nuevoId(),
    plan: PLAN_ID,
    dia: s.dia,
    hora: s.hora,
    titulo: s.titulo,
    tipo: s.tipo,
  }));
}

/*
  Hitos del plan con fecha: tests cada 4 semanas (el domingo, que es el día
  tranquilo), cambios de fase y la descarga. Van a `lh_events`.
*/
export function hitosDelPlan(inicioISO) {
  const dia = (semana, d) => sumarDias(inicioISO, (semana - 1) * 7 + d);
  return [
    { fecha: dia(1, 6), titulo: "Plan físico: tests iniciales (pierna recta, agilidad, cintura y fotos)" },
    { fecha: dia(4, 0), titulo: "Plan físico: empieza la fase de Fuerza" },
    { fecha: dia(4, 6), titulo: "Plan físico: tests de la semana 4" },
    { fecha: dia(8, 0), titulo: "Plan físico: semana de descarga (mitad de series)" },
    { fecha: dia(8, 6), titulo: "Plan físico: tests de la semana 8" },
    { fecha: dia(9, 0), titulo: "Plan físico: empieza la fase de Potencia" },
    { fecha: dia(12, 6), titulo: "Plan físico: tests finales" },
  ].filter((h) => h.fecha);
}

export function eventosParaGuardar(inicioISO, eventos = []) {
  const clave = (e) => `${e.fecha}|${e.titulo}`;
  const ya = new Set(eventos.map(clave));
  return hitosDelPlan(inicioISO)
    .filter((h) => !ya.has(clave(h)))
    .map((h) => ({ id: nuevoId(), plan: PLAN_ID, ...h }));
}

export const delPlan = (x) => x?.plan === PLAN_ID;

/* ---------- Mediciones y registro ---------- */

// Semanas en las que el plan pide apuntar los pesos clave.
export const SEMANAS_REGISTRO = [1, 4, 8, 12];

export const EJERCICIOS_REGISTRO = [
  "Sentadilla goblet",
  "Peso muerto rumano",
  "Sentadilla búlgara",
  "Nordic curl asistido",
  "Press banca",
  "Jalón al pecho",
];

/*
  La ÚLTIMA serie de cada ejercicio clave en cada semana de registro (el plan
  pide "el peso de la última serie"), sacada del propio registro del gimnasio
  (`lh_gym`): así la tabla se rellena sola con lo que apuntas en Sesión. Si esa
  semana lo hiciste dos veces, cuenta el día más reciente. `setsDe` llega por
  parámetro para no atar este módulo a gym.js.
*/
export function registroPorSemana(filas = [], inicioISO, { setsDe }) {
  const tabla = {};
  const fechas = {};
  EJERCICIOS_REGISTRO.forEach((nombre) => {
    tabla[nombre] = {};
    fechas[nombre] = {};
    SEMANAS_REGISTRO.forEach((s) => (tabla[nombre][s] = null));
  });

  filas.forEach((f) => {
    if (!(f.ejercicio in tabla)) return;
    const s = semanaDelPlan(inicioISO, f.fecha);
    if (!SEMANAS_REGISTRO.includes(s)) return;
    if (fechas[f.ejercicio][s] && fechas[f.ejercicio][s] > f.fecha) return;
    const ultima = setsDe(f).filter((x) => Number(x.reps) > 0).at(-1);
    if (!ultima) return;
    fechas[f.ejercicio][s] = f.fecha;
    tabla[f.ejercicio][s] = { peso: Number(ultima.peso) || 0, reps: Number(ultima.reps) || 0 };
  });
  return tabla;
}

/*
  Cómo va la cintura, con las dos reglas del plan:
    - si baja 0,5-1 cm cada 2 semanas, vas bien;
    - si en 3 semanas no ha bajado, quita el puño de hidratos de la cena los
      días de descanso.

  Se compara la última medida con la más reciente que tenga al menos 14 (o 21)
  días menos. Si no hay ninguna tan antigua, no se dice nada: con una semana de
  datos, el agua y la sal pesan más que la grasa.
*/
export function evaluarCintura(mediciones = []) {
  const conCintura = mediciones
    .filter((m) => m?.fecha && Number(m.cintura) > 0)
    .sort((a, b) => a.fecha.localeCompare(b.fecha));
  const ultima = conCintura.at(-1);
  if (!ultima) return { ultima: null, cambio14: null, estado: "sin-datos" };

  const anteriorA = (dias) => {
    const limite = sumarDias(ultima.fecha, -dias);
    return [...conCintura].reverse().find((m) => m.fecha <= limite) || null;
  };
  const hace14 = anteriorA(14);
  const hace21 = anteriorA(21);
  const redondear = (n) => Math.round(n * 10) / 10;
  const cambio14 = hace14 ? redondear(Number(ultima.cintura) - Number(hace14.cintura)) : null;

  /*
    "estancada" (la que pide recortar hidratos) solo con 3 semanas de datos.
    Dos semanas sin bajar es "sin-bajar": un aviso, no todavía un cambio.
  */
  let estado = "pocos-datos";
  if (hace21 && Number(ultima.cintura) >= Number(hace21.cintura)) estado = "estancada";
  else if (cambio14 != null) estado = cambio14 <= -0.5 ? "bien" : cambio14 < 0 ? "despacio" : "sin-bajar";

  return { ultima: { fecha: ultima.fecha, cintura: Number(ultima.cintura) }, cambio14, estado };
}

/*
  Media del peso de una semana (de lunes a domingo) con lo que apuntas en Salud
  (`lh_health`). El plan pide la media semanal y no el dato de un día porque el
  peso diario baila un kilo arriba o abajo sin que cambie nada.
*/
export function mediaPesoSemana(registros = [], lunesISO) {
  const domingo = sumarDias(lunesISO, 6);
  if (!domingo) return null;
  const pesos = registros
    .filter((r) => r?.fecha >= lunesISO && r.fecha <= domingo && Number(r.peso) > 0)
    .map((r) => Number(r.peso));
  if (!pesos.length) return null;
  return Math.round((pesos.reduce((a, b) => a + b, 0) / pesos.length) * 10) / 10;
}

export const MENSAJE_CINTURA = {
  "sin-datos": "Apunta la cintura una vez por semana, a la altura del ombligo y en ayunas.",
  "pocos-datos": "Hacen falta 2 semanas de medidas para saber cómo va.",
  bien: "Baja al ritmo del plan (0,5-1 cm cada 2 semanas). Sigue así.",
  despacio: "Baja, pero despacio. Revisa el picoteo de la tarde y los refrescos.",
  "sin-bajar": "En 2 semanas no ha bajado. Si a la tercera sigue igual, toca ajustar.",
  estancada: "3 semanas sin bajar: quita el puño de hidratos de la cena los días de descanso.",
};

/* ---------- Reglas y guías ---------- */

export const REGLAS = [
  { titulo: "RIR", texto: "Repeticiones en reserva: las que podrías haber hecho de más al acabar la serie. RIR 2 = te quedaban 2." },
  { titulo: "Tempo 3-1-1", texto: "Bajar en 3 s, pausa de 1 s, subir en 1 s." },
  { titulo: "Progresión", texto: "Cuando completes el máximo de repeticiones en todas las series, sube el peso lo mínimo posible." },
  { titulo: "Pierna fuerte", texto: "Nunca el mismo día que el tenis y siempre al menos 48 h antes del partido del sábado." },
  { titulo: "Dolor", texto: "Si un ejercicio duele en una articulación (no el cansancio del músculo), cámbialo o quítalo. Si sigue, fisio." },
  { titulo: "Grasa abdominal", texto: "No se pierde solo de una zona: déficit moderado, proteína alta y fuerza. El objetivo es recomposición, sin dietas agresivas." },
];

export const AVISOS_SEMANA = [
  "Si no vas al gimnasio el miércoles, haz los bloques A y B en casa o en una pista: no necesitan máquinas.",
  "Si un lunes no puedes hacer la pierna por la mañana, hazla el domingo en lugar del cardio. No la juntes con la sesión de las 20:30.",
  "Viernes de tenis en Lorca: no cambies nada más.",
];

/*
  Guías: listas de ejercicios sin peso que no tiene sentido registrar serie a
  serie, pero sí tener a mano el día que tocan.
*/
export const GUIAS = {
  calentamientoGym: {
    titulo: "Calentamiento de gimnasio",
    duracion: "8 min · lunes y miércoles",
    pasos: [
      ["Bici o elíptica", "4 min", "Ritmo suave"],
      ["Balanceo de pierna adelante-atrás", "10 por pierna", "Agarrado a algo, con amplitud creciente"],
      ["Balanceo de pierna lateral", "10 por pierna", "De lado a lado por delante del cuerpo"],
      ["Puente de glúteo", "10", "Aprieta el glúteo arriba 2 s"],
      ["Separar una goma con los brazos", "15", "Brazos estirados, juntando las escápulas"],
      ["Series de aproximación", "2 series", "Del primer ejercicio, con el 40% y el 70% del peso de trabajo"],
    ],
  },
  tenis: {
    titulo: "Calentamiento antes del tenis",
    duracion: "8 min · martes y jueves",
    pasos: [
      ["Comba o trote en el sitio", "2 min", ""],
      ["Balanceos de pierna adelante-atrás y laterales", "10 por pierna", ""],
      ["Zancada con giro de tronco", "5 por lado", ""],
      ["Molinos de brazos adelante y atrás", "10 cada", ""],
      ["Muñecas", "10 círculos y 10 de flexión-extensión", ""],
      ["Desplazamientos laterales y de entrar y salir", "2×15 s cada", ""],
      ["Pogo jumps", "1×10", ""],
    ],
  },
  partido: {
    titulo: "Calentamiento del partido",
    duracion: "12-15 min · sábado",
    pasos: [
      ["1. Subir temperatura", "3 min", "Comba o trote, skipping suave"],
      ["2. Movilidad", "3 min", "Balanceos de pierna, world's greatest stretch (3 por lado), rotaciones de tronco, hombros y muñecas"],
      ["3. Activación", "2 min", "Puente de glúteo ×10, monster walk con goma ×10 pasos por lado"],
      ["4. Desplazamientos", "3 min", "Pasos laterales, pasos cruzados, entrar y salir, juego de sombras"],
      ["5. Chispa", "2 min", "3 skater jumps por lado y 3 salidas de reacción a una señal"],
      ["6. Peloteo", "—", ""],
    ],
    notas: [
      "Si juegas varios partidos seguidos, no te quedes sentado en frío: antes de cada uno repite las fases 4 y 5 (2-3 min).",
      "Antes de jugar, nada de estiramientos estáticos largos ni de ejercicios nuevos.",
    ],
  },
  calentamientoMiercoles: {
    titulo: "Calentamiento del miércoles",
    duracion: "10 min",
    pasos: [
      ["Bici o elíptica", "4 min", ""],
      ["Balanceos de pierna adelante-atrás y laterales", "10 por pierna de cada", ""],
      ["World's greatest stretch", "3 por lado", ""],
      ["Skipping", "2×15 s", ""],
      ["Desplazamientos laterales suaves", "2×15 s", ""],
      ["Pogo jumps suaves", "1×10", ""],
    ],
  },
  movilidad: {
    titulo: "Movilidad diaria",
    duracion: "10-12 min · por la mañana o antes de dormir",
    pasos: [
      ["Gato-camello", "10 lentas", "A cuatro patas, alterna arquear y redondear la espalda vértebra a vértebra"],
      ["90/90 de cadera", "8 transiciones y 30 s por lado", "Sentado con las dos piernas a 90°. Gira las rodillas de un lado al otro y aguanta inclinado sobre la de delante"],
      ["World's greatest stretch", "5 por lado", "Zancada larga con las manos en el suelo. Codo al tobillo de delante, gira abriendo ese brazo al techo y termina estirando la pierna de delante"],
      ["Tobillo, rodilla a la pared", "10 por pierna", "Pie a un palmo de la pared. Lleva la rodilla a tocarla sin despegar el talón"],
      ["Isquios tumbado con toalla", "2×45 s por pierna", "Boca arriba, toalla en la planta del pie y pierna recta; la otra estirada en el suelo"],
      ["Couch stretch", "45 s por lado", "Rodilla en el suelo pegada a la pared o al sofá y empeine apoyado arriba. Aprieta el glúteo y sube el tronco"],
      ["Sentadilla profunda", "1 min acumulado", "Agarrado a algo, talones en el suelo y codos empujando las rodillas hacia fuera"],
      ["Open book", "8 por lado", "Tumbado de lado con las rodillas flexionadas. Abre el brazo de arriba al otro lado siguiéndolo con la mirada"],
    ],
    notas: ["Si un día solo tienes 5 min, haz el world's greatest stretch, los isquios con toalla y el couch stretch."],
  },
  estiramientos: {
    titulo: "Estiramientos de después de entrenar",
    duracion: "10 min · gimnasio, tenis y partido",
    pasos: [
      ["Isquios de pie", "2×30 s por pierna", "Talón sobre un banco bajo y pierna recta. Inclínate desde la cadera con la espalda recta"],
      ["Psoas arrodillado", "30 s por lado", "Rodilla de atrás en el suelo. Aprieta el glúteo, cadera un poco adelante y sube el brazo del mismo lado"],
      ["Glúteo en figura 4", "30 s por lado", "Boca arriba, tobillo sobre la rodilla contraria. Tira del muslo hacia el pecho"],
      ["Aductores (mariposa)", "45 s", "Sentado, plantas juntas. Inclínate al frente con la espalda recta"],
      ["Gemelo con la rodilla recta", "30 s por pierna", "Manos en la pared, pierna atrás recta y talón en el suelo"],
      ["Sóleo con la rodilla flexionada", "30 s por pierna", "Igual, pero flexionando la rodilla de atrás"],
      ["Antebrazo, flexores y extensores", "20 s cada, los dos brazos", "Brazo estirado, tira de los dedos hacia ti con la palma arriba y luego abajo"],
      ["Hombro posterior", "30 s por brazo", "Cruza el brazo por delante del pecho y apriétalo con el otro"],
      ["+ lunes: pectoral en el marco de una puerta", "30 s por lado", "Antebrazo en el marco a 90° y gira el cuerpo hacia fuera"],
      ["+ martes: dorsal", "30 s por lado", "Agarrado a una columna, cadera hacia atrás y hacia un lado"],
    ],
    notas: ["Aguanta cada uno 30 s sin rebotes, a una tensión de 6 sobre 10. En cada exhalación, un poco más lejos."],
  },
  flexibilidad: {
    titulo: "Domingo: cardio suave y flexibilidad larga",
    duracion: "40-60 min de cardio + 25 min de flexibilidad",
    pasos: [
      ["Cardio", "40-60 min", "Caminar rápido (mejor con cuestas), bici, elíptica o nadar. Que puedas hablar en frases completas"],
      ["Gato-camello + open book", "2 min", "Como en la movilidad diaria"],
      ["Isquios con contracción-relajación (PNF)", "3 rondas por pierna", "Boca arriba con la toalla en el pie: empuja 5 s contra la toalla al 20-30%, suelta y al soltar el aire sube un poco más. Aguanta 20 s y repite desde ahí"],
      ["Paloma (pigeon)", "60 s por lado", "Si molesta la rodilla, haz la figura 4"],
      ["Rana (aductores)", "60 s", "A cuatro patas con las rodillas muy abiertas; cadera atrás despacio"],
      ["Cossack squat", "2×6 por lado", "Piernas muy abiertas; baja hacia una con la otra estirada y la punta hacia arriba"],
      ["Couch stretch", "60 s por lado", "Como en la movilidad diaria"],
      ["Gemelo + sóleo en la pared", "45 s cada, por pierna", ""],
      ["World's greatest stretch", "5 por lado, lento", ""],
      ["Dorsal en postura del niño hacia un lado", "45 s por lado", "De rodillas, sentado sobre los talones, brazos estirados hacia un lado"],
      ["Antebrazos + hombro posterior", "30 s cada", ""],
      ["Sentadilla profunda", "1-2 min", "Agarrado a algo, talones en el suelo"],
    ],
  },
};

// Qué guías tocan cada día de la semana (0 = lunes), además de la movilidad.
export function guiasDelDia(dia) {
  const porDia = {
    0: ["calentamientoGym", "estiramientos"],
    1: ["tenis", "estiramientos"],
    2: ["calentamientoMiercoles", "estiramientos"],
    3: ["tenis", "estiramientos"],
    4: [],
    5: ["partido", "estiramientos"],
    6: ["flexibilidad"],
  };
  return ["movilidad", ...(porDia[dia] || [])];
}

export const TESTS = [
  { titulo: "Subida de pierna recta", texto: "Boca arriba, sube una pierna recta con la otra en el suelo. Por debajo de 70-80° indica isquios acortados. Si hay dolor u hormigueo, fisio." },
  { titulo: "Agilidad", texto: "10 cambios de dirección entre dos conos a 3 m, cronometrados." },
  { titulo: "Cintura, peso y fotos", texto: "Cintura a la altura del ombligo (semanal, en ayunas), media de peso semanal y fotos de frente y perfil." },
];
