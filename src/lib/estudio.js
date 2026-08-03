/*
  Sesiones de estudio.

  QUÉ ES UNA SESIÓN Y QUÉ NO
  Una sesión es un rato que TÚ te planificas: "el jueves de 16:00 a 18:00 voy a
  sacar el tema 3 de Deep Learning". La pones tú, tiene día y horas de principio
  y fin, y sale en el calendario y en Inicio como cualquier otra cosa que tengas
  ese día.

  No hay que confundirla con las TAREAS, que son otra cosa: las entregas del
  Aula Virtual, que vienen impuestas y con su fecha límite. Una tarea es un
  plazo que te ponen; una sesión es un rato que te reservas. En una sesión
  puedes trabajar en una tarea, y por eso se puede enlazar con ella, pero son
  cosas distintas y se apuntan distinto.

  DE DÓNDE SALEN LAS HORAS
  De la propia sesión: de 16:00 a 18:00 son 2 h y no hay que teclear ningún
  número. Antes esto era un contador de "+1 h" por asignatura, que obligaba a
  llevar la cuenta a mano y no decía ni cuándo ni cuánto rato seguido.

  El registro sigue siendo `lh_study_log` y las filas de antes valen tal cual:
  las que no traen `desde`/`hasta` usan su campo `horas` (es el caso de las
  sesiones del modo foco, que miden un temporizador y no un tramo del reloj).

    { id, fecha: "2026-09-14", subject, desde: "16:00", hasta: "18:00",
      horas: 2, nota: "Tema 3", tarea: "id-de-tarea" }
*/

import { redondear } from "./numeros";
import {
  porDiaDeLaSemana as porDiaBase,
  porSemanas as porSemanasBase,
  porMeses as porMesesBase,
  lunesDe,
  sumarDias,
} from "./fechas";

export { lunesDe, sumarDias };

/* Minutos desde medianoche, o null si la hora no vale. */
function minutos(hhmm) {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || "").trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/*
  Cuánto dura un tramo del reloj, en horas decimales.

  Devuelve 0 si la hora de fin no es posterior a la de inicio. No se admite que
  una sesión cruce la medianoche: se prestaría a que un error de tecleo
  ("de 18:00 a 6:00") apuntara doce horas de estudio sin que nadie lo note. Si
  de verdad estudias de madrugada, son dos sesiones.
*/
export function horasEntre(desde, hasta) {
  const a = minutos(desde);
  const b = minutos(hasta);
  if (a === null || b === null || b <= a) return 0;
  return redondear((b - a) / 60);
}

const horasDe = (fila) => {
  if (fila?.desde && fila?.hasta) return horasEntre(fila.desde, fila.hasta);
  return Math.max(0, Number(fila?.horas) || 0);
};

/*
  Deja la fila con `horas` al día.

  Se guarda aunque se pueda calcular, porque es el campo que leen los agregados
  compartidos de fechas.js y las secciones antiguas; recalcularlo en cada suma
  costaría más y obligaría a que todo el mundo conociera el formato de la hora.
*/
export function normalizarSesion(fila = {}) {
  return { ...fila, horas: horasDe(fila) };
}

export function nuevaSesion({ id, fecha, asignatura, desde, hasta, nota = "", tarea = null }) {
  return {
    id,
    fecha,
    subject: asignatura,
    desde: desde || null,
    hasta: hasta || null,
    horas: desde && hasta ? horasEntre(desde, hasta) : 0,
    ...(nota ? { nota } : {}),
    ...(tarea ? { tarea } : {}),
  };
}

/*
  Una sesión sirve si tiene asignatura, día y dura algo. Sin esto, dar a
  "añadir" con el formulario a medias metería una sesión de 0 h que ensucia el
  gráfico y no se puede distinguir de un día sin estudiar.
*/
export const sesionValida = (s) =>
  Boolean(s?.subject && s?.fecha && horasDe(s) > 0);

/* Las de un día, ordenadas por hora de inicio; las que no la tienen, al final. */
export const sesionesDe = (registro = [], fecha) =>
  registro
    .filter((s) => s?.fecha === fecha)
    .map(normalizarSesion)
    .sort((a, b) => String(a.desde || "99:99").localeCompare(String(b.desde || "99:99")));

/* --- Agregados --- */

/*
  Los agregados por fecha van sobre el registro NORMALIZADO.

  Los de fechas.js suman el campo `horas` tal cual, que es lo correcto para el
  trabajo. Aquí no basta: una sesión lleva además su tramo del reloj, y quedamos
  en que cuando hay tramo manda el tramo. Sin normalizar antes, una fila cuyo
  `horas` no cuadre con sus horas de principio y fin sumaría una cosa en el
  gráfico y otra en el total de la asignatura.
*/
const normalizados = (registro = []) => registro.map(normalizarSesion);

export const porDiaDeLaSemana = (registro = [], fecha) =>
  porDiaBase(normalizados(registro), fecha);

export const porSemanas = (registro = [], fecha, semanas = 8) =>
  porSemanasBase(normalizados(registro), fecha, semanas);

export const porMeses = (registro = [], fecha, meses = 6) =>
  porMesesBase(normalizados(registro), fecha, meses);

export function horasPorAsignatura(registro = []) {
  const acumulado = {};
  for (const fila of registro) {
    const asignatura = fila?.subject;
    if (!asignatura) continue;
    acumulado[asignatura] = redondear((acumulado[asignatura] || 0) + horasDe(fila));
  }
  return acumulado;
}

export const horasDeAsignatura = (registro = [], asignatura) =>
  redondear(registro.reduce((a, f) => (f?.subject === asignatura ? a + horasDe(f) : a), 0));

/*
  Total.

  Recibe la LISTA de asignaturas a contar, y ese es justo el arreglo del "29h
  totales": si suma más asignaturas de las que se ven en pantalla —las de
  cursos anteriores, por ejemplo— la cabecera deja de cuadrar con las filas de
  debajo. Sin lista, cuenta todo el registro (Analítica, que sí quiere el
  histórico).
*/
export function totalHoras(registro = [], asignaturas = null) {
  const filtrado = asignaturas
    ? registro.filter((f) => asignaturas.includes(f?.subject))
    : registro;
  return redondear(filtrado.reduce((a, f) => a + horasDe(f), 0));
}

/*
  Lo que necesita el gráfico por asignatura: una fila por asignatura, de más a
  menos horas. Se incluyen las que están a cero para que se vea el hueco —"no he
  tocado Ciberseguridad" es la información útil—, pero van al final.
*/
export function reparto(registro = [], asignaturas = []) {
  const porAsignatura = horasPorAsignatura(registro);
  return asignaturas
    .map((asignatura) => ({ asignatura, horas: porAsignatura[asignatura] || 0 }))
    .sort((a, b) => b.horas - a.horas || a.asignatura.localeCompare(b.asignatura));
}

/*
  Parte cada tramo por asignatura, para las barras apiladas.

  Recibe los tramos ya calculados (los siete días, o los últimos meses) y les
  añade `partes`: qué asignaturas componen ese total y cuánto pone cada una. El
  reparto respeta el ORDEN de `asignaturas`, que es el mismo que da el color, y
  no el tamaño de cada trozo: si los trozos se ordenaran por tamaño, el color de
  una asignatura cambiaría de sitio de un día para otro y el gráfico sería
  ilegible.

  `dentroDe(fila, tramo)` dice si una sesión cae en ese tramo; lo pone quien
  llama porque un tramo puede ser un día o un mes.
*/
export function partirPorAsignatura(tramos = [], registro = [], asignaturas = [], dentroDe) {
  return tramos.map((tramo) => {
    const delTramo = registro.filter((f) => dentroDe(f, tramo));
    const partes = asignaturas
      .map((asignatura) => ({
        clave: asignatura,
        valor: horasDeAsignatura(delTramo, asignatura),
      }))
      .filter((p) => p.valor > 0);
    return { ...tramo, partes };
  });
}

/*
  Resumen de un conjunto de barras (los siete días, o las últimas semanas).

  `media` reparte entre TODOS los tramos, también los que están a cero: la
  media de estudio de la semana incluye los días que no tocaste nada, que es
  precisamente lo que interesa saber.
*/
export function resumen(tramos = []) {
  const total = redondear(tramos.reduce((a, t) => a + (Number(t?.horas) || 0), 0));
  const mejor = tramos.reduce(
    (mejor, t) => ((Number(t?.horas) || 0) > (Number(mejor?.horas) || 0) ? t : mejor),
    null
  );
  return {
    total,
    media: tramos.length ? redondear(total / tramos.length) : 0,
    mejor: mejor && mejor.horas > 0 ? mejor : null,
  };
}
