/*
  Geometría del horario semanal: de "10:00 - 11:00" a coordenadas de rejilla.

  Está aquí y no dentro de la sección porque es lo único del horario que puede
  equivocarse en silencio. Una clase mal colocada media hora más abajo se sigue
  viendo bonita, y no hay forma de notarlo mirando la pantalla: o se prueban los
  números, o el horario miente sin avisar.
*/

// Minutos que ocupa cada fila de la rejilla. A menor paso, más fino se puede
// colocar una clase; 10 llega para horarios que empiezan a y 20 (12:20 - 14:20).
export const PASO = 10;

export const aMinutos = (hhmm) => {
  const [h, m] = String(hhmm).trim().split(":").map(Number);
  return h * 60 + (m || 0);
};

export const aTexto = (min) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

// "10:00 - 11:00" → { ini: 600, fin: 660, dura: 60 }
export function tramo(hora) {
  const [ini, fin] = String(hora).split(" - ").map(aMinutos);
  return { ini, fin, dura: fin - ini };
}

/*
  De qué hora a qué hora se pinta la rejilla, redondeando a horas enteras: las
  líneas de fondo y las etiquetas del eje caen así en horas redondas, que es lo
  que se busca de un vistazo ("las seis y media" se lee sola entre las 18 y las
  19; una línea en las 16:30 no ayuda a nadie).

  El rango sale de las clases y no es fijo: el 2º cuatrimestre solo tiene tarde,
  y una rejilla de 8:00 a 21:00 sería casi toda hueco.
*/
export function rangoHorario(clases = []) {
  if (!clases.length) return { inicio: 0, fin: 0, horas: [], filas: 0 };

  const tramos = clases.map((c) => tramo(c.hora));
  const inicio = Math.floor(Math.min(...tramos.map((t) => t.ini)) / 60) * 60;
  const fin = Math.ceil(Math.max(...tramos.map((t) => t.fin)) / 60) * 60;

  const horas = [];
  for (let m = inicio; m < fin; m += 60) horas.push(m);

  return { inicio, fin, horas, filas: (fin - inicio) / PASO };
}

/*
  Fila de inicio y de fin dentro de la rejilla, ya en la numeración de CSS
  (`grid-row` empieza en 1, no en 0).
*/
export function filasDe(minutos, inicio) {
  return Math.round((minutos - inicio) / PASO) + 1;
}

export function celdaDe(clase, inicio) {
  const { ini, fin } = tramo(clase.hora);
  return { desde: filasDe(ini, inicio), hasta: filasDe(fin, inicio) };
}

// Las clases de un día, de la primera a la última.
export const clasesDe = (clases, dia) =>
  clases.filter((c) => c.dia === dia).sort((a, b) => tramo(a.hora).ini - tramo(b.hora).ini);

/*
  El horario como agenda: los días que tienen clase, cada uno con las suyas en
  orden. Es lo que se ve en el móvil, donde la rejilla no cabe sin obligar a
  arrastrar de lado. Los días vacíos no salen: en una agenda ocupan una línea
  para no decir nada, mientras que en la rejilla su columna sí hace falta para
  que las demás se lean.
*/
export function porDias(clases, dias) {
  return dias
    .map((d) => ({ ...d, clases: clasesDe(clases, d.key) }))
    .filter((d) => d.clases.length > 0);
}
