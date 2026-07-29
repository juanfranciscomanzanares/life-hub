/*
  Modelo del gimnasio.

  Una fila de `lh_gym` es UN ejercicio hecho UN día:

    { id, fecha, ejercicio, nota, sets: [{ id, peso, reps }] }

  `sets` guarda cada serie por separado, con el peso y las repeticiones que
  hiciste en ESA serie. Antes solo había `series: 4, peso: 70, reps: 8`, que
  obligaba a que las cuatro series fueran idénticas.

  Compatibilidad: se conserva el nombre de campo `sets` en vez de reutilizar
  `series` justamente porque `series` era un número. Así las filas antiguas se
  reconocen sin ambigüedad y se convierten al vuelo, sin migración destructiva.

  Otras secciones (Analítica, Calendario, Coach, Logros, Metas, Resumen) leen
  `lh_gym` y solo usan `fecha`, `ejercicio` y el número de filas, así que este
  cambio no las afecta.
*/

export const EJERCICIOS = {
  Pecho: ["Press banca", "Press inclinado", "Press declinado", "Press mancuernas", "Aperturas", "Aperturas en polea", "Fondos en paralelas", "Pullover", "Press máquina"],
  Espalda: ["Dominadas", "Jalón al pecho", "Jalón tras nuca", "Remo con barra", "Remo con mancuerna", "Remo en polea", "Remo en máquina", "Pullover en polea", "Peso muerto", "Hiperextensiones"],
  Piernas: ["Sentadilla", "Sentadilla frontal", "Prensa de piernas", "Zancadas", "Peso muerto rumano", "Hip thrust", "Extensión de cuádriceps", "Curl femoral", "Elevación de gemelos", "Sentadilla búlgara", "Sentadilla hack"],
  Hombro: ["Press militar", "Press Arnold", "Elevaciones laterales", "Elevaciones frontales", "Pájaros (deltoide posterior)", "Face pull", "Encogimientos (trapecio)", "Press tras nuca"],
  Bíceps: ["Curl con barra", "Curl con mancuernas", "Curl martillo", "Curl predicador", "Curl concentrado", "Curl en polea", "Curl araña"],
  Tríceps: ["Press francés", "Extensión en polea", "Extensión sobre cabeza", "Patada de tríceps", "Fondos en banco", "Press cerrado"],
  Core: ["Plancha", "Crunch", "Elevación de piernas", "Rueda abdominal", "Russian twist", "Mountain climbers", "Plancha lateral", "Encogimientos en colgado"],
  Cardio: ["Cinta (correr)", "Bicicleta estática", "Elíptica", "Remo (máquina)", "Salto a la comba", "Escaladora", "HIIT"],
};

export const GRUPOS_BASE = Object.keys(EJERCICIOS);

// "Otro" existe para los ejercicios que te inventes y no encajen en un grupo.
export const GRUPOS = [...GRUPOS_BASE, "Otro"];

/*
  Ejercicios propios.

  Se guardan en la clave `lh_gym_ejercicios` con la forma:
    { id, nombre, grupo, descripcion }

  y se fusionan con el catálogo predeterminado en todos los sitios donde eliges
  un ejercicio, para que no haya dos listas separadas. Si uno propio se llama
  igual que uno de serie, no se duplica: manda el tuyo, porque su descripción
  es la que has escrito tú.
*/
export function catalogo(personalizados = []) {
  const mapa = {};
  GRUPOS.forEach((g) => {
    mapa[g] = [...(EJERCICIOS[g] || [])];
  });

  personalizados.forEach((e) => {
    if (!e?.nombre) return;
    const grupo = mapa[e.grupo] ? e.grupo : "Otro";
    if (!mapa[grupo].includes(e.nombre)) mapa[grupo].push(e.nombre);
  });

  // Los grupos vacíos no se enseñan: sin ejercicios propios, "Otro" sobra.
  Object.keys(mapa).forEach((g) => {
    if (mapa[g].length === 0) delete mapa[g];
  });
  return mapa;
}

export function grupoDe(nombre, personalizados = []) {
  const propio = personalizados.find((e) => e.nombre === nombre);
  if (propio) return mapaTieneGrupo(propio.grupo) ? propio.grupo : "Otro";
  return GRUPOS_BASE.find((g) => EJERCICIOS[g].includes(nombre)) || "Otro";
}

const mapaTieneGrupo = (g) => GRUPOS.includes(g);

export function descripcionDe(nombre, personalizados = []) {
  return personalizados.find((e) => e.nombre === nombre)?.descripcion || "";
}

export function esPersonalizado(nombre, personalizados = []) {
  return personalizados.some((e) => e.nombre === nombre);
}

const num = (v) => Number(v) || 0;

let contador = 0;
// Date.now() se repite si generas varios ids en el mismo milisegundo, cosa que
// pasa al crear varias series de golpe.
export function nuevoId() {
  contador += 1;
  return Date.now() * 1000 + (contador % 1000);
}

export function nuevaSerie(peso = 0, reps = 0) {
  return { id: nuevoId(), peso: num(peso), reps: num(reps) };
}

/*
  Devuelve las series de una fila, venga en el formato nuevo o en el antiguo.
  Una fila vieja con series: 4, peso: 70, reps: 8 son cuatro series iguales.
*/
export function setsDe(fila) {
  if (!fila) return [];
  if (Array.isArray(fila.sets)) return fila.sets;

  const cuantas = Math.max(0, Math.round(num(fila.series)));
  if (cuantas === 0) {
    // Sin número de series pero con peso: la damos por una sola serie.
    return num(fila.peso) || num(fila.reps) ? [nuevaSerie(fila.peso, fila.reps)] : [];
  }
  return Array.from({ length: cuantas }, () => nuevaSerie(fila.peso, fila.reps));
}

// Pasa una fila al formato nuevo. Idempotente.
export function normalizarFila(fila) {
  if (Array.isArray(fila.sets)) return fila;
  const { series, peso, reps, ...resto } = fila;
  return { ...resto, sets: setsDe(fila) };
}

// Volumen = suma de peso x repeticiones de cada serie. Es la medida habitual
// de carga total de una sesión.
export function volumen(sets = []) {
  return sets.reduce((total, s) => total + num(s.peso) * num(s.reps), 0);
}

// La serie más pesada; a igual peso, la de más repeticiones.
export function mejorSerie(sets = []) {
  return sets.reduce((mejor, s) => {
    if (!mejor) return s;
    if (num(s.peso) > num(mejor.peso)) return s;
    if (num(s.peso) === num(mejor.peso) && num(s.reps) > num(mejor.reps)) return s;
    return mejor;
  }, null);
}

// 1RM estimado por la fórmula de Epley: peso x (1 + reps/30).
export function unaRM(peso, reps) {
  return num(peso) * (1 + num(reps) / 30);
}

export function mejorUnaRM(sets = []) {
  return sets.reduce((max, s) => Math.max(max, unaRM(s.peso, s.reps)), 0);
}

/*
  Récords por ejercicio a partir de todas las filas: mejor peso levantado y
  mejor 1RM estimado. Ordenado por peso descendente.
*/
export function recordsPorEjercicio(filas = []) {
  const porEjercicio = new Map();

  filas.forEach((fila) => {
    const sets = setsDe(fila);
    if (sets.length === 0) return;
    const mejor = mejorSerie(sets);
    const rm = mejorUnaRM(sets);
    const actual = porEjercicio.get(fila.ejercicio) || { peso: 0, reps: 0, unaRM: 0, fecha: "" };

    if (num(mejor.peso) > actual.peso) {
      actual.peso = num(mejor.peso);
      actual.reps = num(mejor.reps);
      actual.fecha = fila.fecha;
    }
    actual.unaRM = Math.max(actual.unaRM, rm);
    porEjercicio.set(fila.ejercicio, actual);
  });

  return [...porEjercicio.entries()]
    .filter(([, v]) => v.peso > 0)
    .sort((a, b) => b[1].peso - a[1].peso);
}

/*
  Evolución de un ejercicio en el tiempo: por cada día, el mejor peso y el
  volumen total. Es lo que alimenta las gráficas de progreso.
*/
export function evolucion(filas = [], ejercicio) {
  return filas
    .filter((f) => f.ejercicio === ejercicio)
    .map((f) => {
      const sets = setsDe(f);
      const mejor = mejorSerie(sets);
      return {
        id: f.id,
        fecha: f.fecha,
        peso: mejor ? num(mejor.peso) : 0,
        reps: mejor ? num(mejor.reps) : 0,
        volumen: volumen(sets),
        series: sets.length,
      };
    })
    .sort((a, b) => String(a.fecha).localeCompare(String(b.fecha)));
}

// Volumen total de un día concreto (todas las filas de esa fecha).
export function volumenDelDia(filas = [], fecha) {
  return filas
    .filter((f) => f.fecha === fecha)
    .reduce((total, f) => total + volumen(setsDe(f)), 0);
}

// Fechas con entrenamiento, de más reciente a más antigua.
export function fechasEntrenadas(filas = []) {
  return [...new Set(filas.map((f) => f.fecha).filter(Boolean))].sort().reverse();
}

/*
  Sesiones: cuándo empieza y cuándo termina el entreno de un día.

  Una fila de `lh_gym_sesiones` es { fecha, inicio, fin }, con inicio y fin en
  ISO completo (fecha y hora). Vive en su propia clave y no dentro de `lh_gym`
  porque esas filas las leen otras seis secciones (Analítica, Calendario,
  Coach, Logros, Metas, Resumen): meterles un estado obligaría a tocarlas todas
  para algo que no usan. Un día sin sesión es simplemente una fecha que no está
  en la lista, así que todo el histórico anterior sigue siendo válido.
*/
export function sesionDe(sesiones = [], fecha) {
  return sesiones.find((s) => s.fecha === fecha) || null;
}

export const sesionTerminada = (sesiones = [], fecha) => Boolean(sesionDe(sesiones, fecha)?.fin);

// Idempotente: se llama cada vez que se añade un ejercicio, y solo la primera
// vez del día deja marca.
export function abrirSesion(sesiones = [], fecha, ahora = new Date()) {
  if (sesionDe(sesiones, fecha)) return sesiones;
  return [{ fecha, inicio: ahora.toISOString(), fin: null }, ...sesiones];
}

export function cerrarSesion(sesiones = [], fecha, ahora = new Date()) {
  const fin = ahora.toISOString();
  // Un día registrado antes de que existieran las sesiones no tiene inicio;
  // se cierra igual, solo que sin duración que enseñar.
  if (!sesionDe(sesiones, fecha)) return [{ fecha, inicio: null, fin }, ...sesiones];
  return sesiones.map((s) => (s.fecha === fecha ? { ...s, fin } : s));
}

export function reabrirSesion(sesiones = [], fecha) {
  return sesiones.map((s) => (s.fecha === fecha ? { ...s, fin: null } : s));
}

/*
  Duración en minutos: de inicio a fin, o de inicio a ahora si sigue abierta.

  Devuelve null cuando no hay nada fiable que enseñar. El tope de 12 h es para
  la sesión que te dejas abierta y cierras al día siguiente: mejor no poner
  duración que poner "19 h de entreno".
*/
export function duracionMinutos(sesion, ahora = new Date()) {
  if (!sesion?.inicio) return null;
  const desde = new Date(sesion.inicio).getTime();
  const hasta = sesion.fin ? new Date(sesion.fin).getTime() : ahora.getTime();
  if (!Number.isFinite(desde) || !Number.isFinite(hasta)) return null;

  const minutos = Math.round((hasta - desde) / 60000);
  return minutos < 0 || minutos > 12 * 60 ? null : minutos;
}

export function formatearDuracion(minutos) {
  if (minutos == null) return "";
  if (minutos < 60) return `${minutos} min`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return resto === 0 ? `${horas} h` : `${horas} h ${resto} min`;
}

// Resumen de un día para la tarjeta de sesión terminada.
export function resumenDelDia(filas = [], fecha) {
  const delDia = filas.filter((f) => f.fecha === fecha);
  const sets = delDia.flatMap((f) => setsDe(f));
  return {
    ejercicios: delDia.length,
    series: sets.length,
    volumen: volumen(sets),
  };
}
