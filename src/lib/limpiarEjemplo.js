/*
  Borrado de los datos de ejemplo que sembraban varias secciones.

  Durante un tiempo, abrir Inversiones, Metas, Salud, Calendario o Finanzas
  guardaba unos registros de muestra como si fueran tuyos: se escribían en
  localStorage y de ahí subían a Supabase igual que un dato real. Los valores
  por defecto ya están vacíos, pero lo que se guardó entonces sigue ahí.

  Esto lo quita. La regla es la que importa: se borra SOLO lo que coincide
  exactamente con la muestra conocida (identificador, texto y números). Si has
  tocado una de esas filas —cambiado el importe, renombrado la meta— deja de
  coincidir y se queda. Es preferible dejar basura que borrar algo tuyo.
*/

// Cada patrón: la clave, y qué filas de esa clave son de muestra.
const MUESTRAS = [
  {
    clave: "lh_investments",
    filas: [
      { id: 1, nombre: "MSCI World (fondo indexado)", aportado: 600, valorActual: 648 },
      { id: 2, nombre: "S&P 500 ETF", aportado: 300, valorActual: 291 },
      { id: 3, nombre: "Bitcoin", aportado: 150, valorActual: 205 },
    ],
  },
  {
    clave: "lh_contribs",
    filas: [
      { id: 1, fecha: "2026-07-05", monto: 150, destino: "MSCI World (fondo indexado)" },
      { id: 2, fecha: "2026-07-05", monto: 50, destino: "Bitcoin" },
      { id: 3, fecha: "2026-06-05", monto: 150, destino: "MSCI World (fondo indexado)" },
    ],
  },
  {
    clave: "lh_goals",
    filas: [
      { id: 1, titulo: "Invertir este año", objetivo: 2000, actual: 1050 },
      { id: 2, titulo: "Media de gym semanal", objetivo: 4, actual: 3 },
      { id: 3, titulo: "Nota media del cuatrimestre", objetivo: 8, actual: 7.4 },
    ],
  },
  {
    clave: "lh_health",
    filas: [
      { id: 1, fecha: "2026-07-21", peso: 74.2, sueno: 7.5, pasos: 9200 },
      { id: 2, fecha: "2026-07-20", peso: 74.4, sueno: 6.8, pasos: 7400 },
      { id: 3, fecha: "2026-07-19", peso: 74.5, sueno: 8.1, pasos: 11200 },
      { id: 4, fecha: "2026-07-18", peso: 74.8, sueno: 7, pasos: 6100 },
    ],
  },
  {
    clave: "lh_routine",
    filas: [
      { id: 1, dia: 0, hora: "09:00", titulo: "Clases" },
      { id: 2, dia: 0, hora: "18:00", titulo: "Gym (piernas)" },
      { id: 3, dia: 1, hora: "09:00", titulo: "Clases" },
      { id: 4, dia: 1, hora: "20:00", titulo: "Entreno tenis de mesa" },
      { id: 5, dia: 2, hora: "15:00", titulo: "Agrosana" },
      { id: 6, dia: 3, hora: "19:00", titulo: "Gym (torso)" },
      { id: 7, dia: 4, hora: "20:00", titulo: "Entreno tenis de mesa" },
    ],
  },
  {
    clave: "lh_savings",
    filas: [{ id: 1, label: "Portátil nuevo", target: 1200, current: 740 }],
  },
];

// ¿Coincide la fila con la muestra en TODOS los campos que la definen?
const esMuestra = (fila, muestra) =>
  Object.entries(muestra).every(([campo, valor]) => {
    const suyo = fila?.[campo];
    return typeof valor === "number" ? Number(suyo) === valor : suyo === valor;
  });

/*
  Cuenta qué se borraría, sin tocar nada. Sirve para avisar antes y para no
  ofrecer el botón cuando no hay nada que limpiar.
*/
export function contarEjemplos(leer) {
  const encontrados = [];

  MUESTRAS.forEach(({ clave, filas }) => {
    const guardado = leer(clave);
    if (!Array.isArray(guardado)) return;
    const cuantas = guardado.filter((f) => filas.some((m) => esMuestra(f, m))).length;
    if (cuantas > 0) encontrados.push({ clave, cuantas });
  });

  return { total: encontrados.reduce((t, e) => t + e.cuantas, 0), detalle: encontrados };
}

/*
  Quita las filas de muestra. Devuelve un objeto { clave: filasQueQuedan } solo
  con las claves que cambian, para que quien llame decida cómo guardarlas (y
  así se sincronicen a la nube por el camino normal).
*/
export function limpiarEjemplos(leer) {
  const cambios = {};

  MUESTRAS.forEach(({ clave, filas }) => {
    const guardado = leer(clave);
    if (!Array.isArray(guardado)) return;
    const quedan = guardado.filter((f) => !filas.some((m) => esMuestra(f, m)));
    if (quedan.length !== guardado.length) cambios[clave] = quedan;
  });

  return cambios;
}
