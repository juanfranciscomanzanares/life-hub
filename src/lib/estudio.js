/*
  Horas de estudio.

  EL FALLO QUE ARREGLA
  Había DOS almacenes para lo mismo: `lh_study_hours`, un contador por
  asignatura sin fecha, y `lh_study_log`, un registro con fecha. Las secciones
  escribían en los dos y leían de uno u otro según les venía.

  El resultado se veía en pantalla: la cabecera decía "29h totales" mientras
  todas las asignaturas de la lista salían a 0. La cabecera sumaba TODAS las
  claves del contador —incluidas las de asignaturas de cursos anteriores, que
  ya no están en SUBJECTS y por tanto no se pintan— y la lista solo enseñaba
  las de este curso. Una cifra que no cuadraba con ninguna de las de debajo.

  Ahora la única fuente es `lh_study_log`, que además es el que sí tiene fecha
  (y por tanto el único que Analítica puede repartir por semanas o meses). El
  total y las asignaturas salen del MISMO sitio, así que no pueden discrepar.

  El contador antiguo se deja donde está, sin tocarlo: no se lee ni se escribe,
  pero tampoco se borra por si algún dispositivo aún no ha sincronizado.

  Una fila del registro:
    { id, fecha: "2026-09-14", subject: "Deep Learning", horas: 1.5 }
*/

// Dos decimales: una sesión de foco de 25 min son 0,42 h y hay que conservarlo.
const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

const horasDe = (fila) => Math.max(0, Number(fila?.horas) || 0);

/*
  Total por asignatura, a partir del registro.

  Devuelve solo las asignaturas que tienen horas: quien pinte la lista decide
  qué asignaturas enseñar (normalmente SUBJECTS), y así una asignatura de un
  curso anterior no se cuela en la interfaz por tener horas antiguas.
*/
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
  redondear(
    registro.reduce((a, f) => (f?.subject === asignatura ? a + horasDe(f) : a), 0)
  );

/*
  Total.

  Recibe la LISTA de asignaturas a contar. Es el punto entero del arreglo: si
  suma más asignaturas de las que se ven, vuelve a salir el 29 fantasma. Sin
  lista, cuenta todo el registro (Analítica, que sí quiere el histórico).
*/
export function totalHoras(registro = [], asignaturas = null) {
  const filtrado = asignaturas
    ? registro.filter((f) => asignaturas.includes(f?.subject))
    : registro;
  return redondear(filtrado.reduce((a, f) => a + horasDe(f), 0));
}

/*
  Una hora suelta, para el botón de "+1 h".

  La fila lleva `tarea` cuando las horas vienen de dar una tarea por terminada:
  así se puede saber de dónde salió cada rato sin cambiar el formato.
*/
export const filaDeEstudio = ({ id, fecha, asignatura, horas, tarea = null }) => ({
  id,
  fecha,
  subject: asignatura,
  horas: redondear(horas),
  ...(tarea ? { tarea } : {}),
});

/*
  Quita horas de una asignatura.

  Borra desde la última apuntada hacia atrás en vez de meter una fila negativa:
  una fila de -1 h descuadraría cualquier suma por periodo en Analítica, y
  además "he estudiado menos de cero horas el martes" no significa nada.

  Devuelve el registro nuevo. Si se piden más horas de las que hay, se quita lo
  que haya y ya: no se deja el total en negativo.
*/
export function quitarHoras(registro = [], asignatura, horas = 1) {
  let porQuitar = Math.max(0, Number(horas) || 0);
  if (porQuitar === 0) return registro;

  const salida = [];
  // De la más reciente a la más antigua; luego se devuelve el orden original.
  const indices = registro.map((_, i) => i).reverse();
  const quitados = new Set();
  const recortes = new Map();

  for (const i of indices) {
    if (porQuitar <= 0) break;
    const fila = registro[i];
    if (fila?.subject !== asignatura) continue;

    const suyas = horasDe(fila);
    if (suyas <= porQuitar) {
      quitados.add(i);
      porQuitar = redondear(porQuitar - suyas);
    } else {
      // La fila cubre de sobra lo que se quita: se recorta en vez de borrarla.
      recortes.set(i, redondear(suyas - porQuitar));
      porQuitar = 0;
    }
  }

  registro.forEach((fila, i) => {
    if (quitados.has(i)) return;
    salida.push(recortes.has(i) ? { ...fila, horas: recortes.get(i) } : fila);
  });

  return salida;
}

/*
  Lo que necesita el gráfico: una fila por asignatura, ordenada de más a menos
  horas. Se incluyen las que están a cero para que se vea el hueco —"no he
  tocado Ciberseguridad" es justo la información útil—, pero van al final.
*/
export function reparto(registro = [], asignaturas = []) {
  const porAsignatura = horasPorAsignatura(registro);
  return asignaturas
    .map((asignatura) => ({ asignatura, horas: porAsignatura[asignatura] || 0 }))
    .sort((a, b) => b.horas - a.horas || a.asignatura.localeCompare(b.asignatura));
}
