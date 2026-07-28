/*
  Conexión bancaria: normalizar, categorizar y fusionar movimientos.

  Los movimientos llegan del banco en crudo ("PAGO TARJETA 4567 MERCADONA SA"),
  así que hay que traducirlos a las categorías de la sección Finanzas. Las
  reglas son editables por el usuario y se guardan en `lh_banco_reglas`.
*/

export const CATEGORIAS = [
  "Ingreso",
  "Comida",
  "Deporte",
  "Universidad",
  "Transporte",
  "Vivienda",
  "Suscripciones",
  "Salud",
  "Ocio",
  "Otros",
];

/*
  Reglas por defecto. Cada una es "si el concepto contiene X, es categoría Y".
  Están pensadas para España; el usuario puede añadir y quitar las suyas.
*/
export const REGLAS_POR_DEFECTO = [
  { texto: "mercadona", categoria: "Comida" },
  { texto: "carrefour", categoria: "Comida" },
  { texto: "lidl", categoria: "Comida" },
  { texto: "dia sa", categoria: "Comida" },
  { texto: "alcampo", categoria: "Comida" },
  { texto: "consum", categoria: "Comida" },
  { texto: "glovo", categoria: "Comida" },
  { texto: "just eat", categoria: "Comida" },
  { texto: "restaurante", categoria: "Comida" },
  { texto: "bar ", categoria: "Comida" },

  { texto: "gimnasio", categoria: "Deporte" },
  { texto: "gym", categoria: "Deporte" },
  { texto: "basic fit", categoria: "Deporte" },
  { texto: "decathlon", categoria: "Deporte" },

  { texto: "universidad", categoria: "Universidad" },
  { texto: "matricula", categoria: "Universidad" },
  { texto: "libreria", categoria: "Universidad" },

  { texto: "renfe", categoria: "Transporte" },
  { texto: "repsol", categoria: "Transporte" },
  { texto: "cepsa", categoria: "Transporte" },
  { texto: "gasolinera", categoria: "Transporte" },
  { texto: "uber", categoria: "Transporte" },
  { texto: "cabify", categoria: "Transporte" },
  { texto: "parking", categoria: "Transporte" },

  { texto: "alquiler", categoria: "Vivienda" },
  { texto: "iberdrola", categoria: "Vivienda" },
  { texto: "endesa", categoria: "Vivienda" },
  { texto: "naturgy", categoria: "Vivienda" },
  { texto: "comunidad", categoria: "Vivienda" },

  { texto: "netflix", categoria: "Suscripciones" },
  { texto: "spotify", categoria: "Suscripciones" },
  { texto: "amazon prime", categoria: "Suscripciones" },
  { texto: "hbo", categoria: "Suscripciones" },
  { texto: "disney", categoria: "Suscripciones" },
  { texto: "movistar", categoria: "Suscripciones" },
  { texto: "vodafone", categoria: "Suscripciones" },
  { texto: "orange", categoria: "Suscripciones" },

  { texto: "farmacia", categoria: "Salud" },
  { texto: "clinica", categoria: "Salud" },
  { texto: "dentista", categoria: "Salud" },

  { texto: "cine", categoria: "Ocio" },
  { texto: "steam", categoria: "Ocio" },
];

/*
  Quita acentos y pasa a minúsculas. Los bancos escriben en mayúsculas y sin
  tildes de forma inconsistente ("FARMACIA" / "Farmácia"), así que comparar en
  crudo falla demasiado.
*/
export function normalizarTexto(texto = "") {
  return String(texto)
    .toLowerCase()
    .normalize("NFD")
    // ̀-ͯ son los signos diacríticos que NFD separa de la letra.
    // Escrito con el código y no con los caracteres, que son invisibles.
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/*
  Categoría de un movimiento.

  Los ingresos se detectan por el signo, no por el texto: un importe positivo
  es dinero que entra, sin importar cómo se llame el concepto.
*/
export function categorizar(movimiento, reglas = REGLAS_POR_DEFECTO) {
  if (Number(movimiento.monto) > 0) return "Ingreso";

  const texto = normalizarTexto(`${movimiento.concepto} ${movimiento.contraparte || ""}`);
  const regla = reglas.find((r) => r.texto && texto.includes(normalizarTexto(r.texto)));
  return regla ? regla.categoria : "Otros";
}

// Limpia el concepto para que se lea bien en la tabla de Finanzas.
export function limpiarConcepto(texto = "") {
  return String(texto)
    .replace(/\s+/g, " ")
    .replace(/^(pago|compra|recibo|transferencia|bizum)\s+(tarjeta\s+)?(\d{4}\s+)?/i, "")
    .trim()
    .slice(0, 80);
}

/*
  Convierte un movimiento del banco en una fila de `lh_finance`.
  Se guarda `refBanco` para poder reconocerlo si se reimporta.
*/
export function aMovimientoFinanzas(movimiento, reglas) {
  return {
    id: `gc-${movimiento.refBanco}`,
    refBanco: movimiento.refBanco,
    fecha: movimiento.fecha,
    concepto: limpiarConcepto(movimiento.concepto) || "Movimiento",
    categoria: categorizar(movimiento, reglas),
    monto: Number(movimiento.monto) || 0,
  };
}

/*
  Separa los movimientos que ya están importados de los nuevos.

  Se compara por `refBanco`, el identificador que da la entidad. Es lo que hace
  que reimportar sea seguro: puedes sincronizar todos los días sin duplicar
  nada. Para las filas que se crearon a mano (sin refBanco) hay un segundo
  criterio, por fecha + importe + concepto, para no colar un duplicado de algo
  que ya habías apuntado tú.
*/
export function separarNuevos(movimientos, existentes = [], reglas) {
  const refs = new Set(existentes.map((f) => f.refBanco).filter(Boolean));
  const huellas = new Set(existentes.map(huellaDe));

  const nuevos = [];
  const yaEstaban = [];

  movimientos.forEach((m) => {
    const fila = aMovimientoFinanzas(m, reglas);
    if (refs.has(fila.refBanco) || huellas.has(huellaDe(fila))) yaEstaban.push(fila);
    else nuevos.push(fila);
  });

  return { nuevos, yaEstaban };
}

function huellaDe(fila) {
  return [
    fila.fecha,
    Number(fila.monto).toFixed(2),
    normalizarTexto(fila.concepto).slice(0, 20),
  ].join("|");
}

// Resumen para enseñar antes de importar.
export function resumen(filas = []) {
  const ingresos = filas.filter((f) => f.monto > 0).reduce((t, f) => t + f.monto, 0);
  const gastos = filas.filter((f) => f.monto < 0).reduce((t, f) => t + f.monto, 0);
  const porCategoria = {};
  filas.forEach((f) => {
    porCategoria[f.categoria] = (porCategoria[f.categoria] || 0) + f.monto;
  });
  return { total: filas.length, ingresos, gastos, porCategoria };
}
