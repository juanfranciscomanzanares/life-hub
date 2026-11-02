/*
  Alimentación sin contar calorías: la parte de comida del plan físico
  (PLAN-FISICO-TENIS-DE-MESA.md), pasada a datos y a dos o tres reglas.

  Nada se pesa: las raciones van con la mano (palma, puño, pulgar). Lo único que
  cambia de un día a otro son los puños de hidratos, y eso depende de qué toca
  ese día en la semana tipo del plan; por eso vive aquí y se prueba en `node`.
*/

/* ---------- Hidratos según el día ---------- */

// Días de tenis, pierna o partido (0 = lunes): lunes pierna, martes y jueves
// tenis, miércoles pierna y velocidad, sábado partido.
const DIAS_DE_CARGA = [0, 1, 2, 3, 5];
// Lunes y martes se cena tarde después del gimnasio: cena con 2 puños.
const CENAS_FUERTES = [0, 1];

/*
  Puños de hidratos en la comida y en la cena de un día.

  `estancada` es la regla 5 del plan: si en 3 semanas la cintura no baja, se
  quita el puño de hidratos de la cena los días de descanso. `conTenis` es para
  el viernes que juegas en Lorca, que pasa a contar como día de tenis.
*/
export function hidratosDelDia(dia, { estancada = false, conTenis = false } = {}) {
  const carga = DIAS_DE_CARGA.includes(dia) || conTenis;
  const comida = carga ? 2 : 1;
  let cena = CENAS_FUERTES.includes(dia) ? 2 : 1;
  if (estancada && !carga) cena = 0;
  return { carga, comida, cena };
}

export const QUE_TOCA = [
  "Pierna y gimnasio a las 20:30",
  "Tenis y gimnasio a las 20:30",
  "Velocidad, saltos y pierna",
  "Tenis",
  "Descanso (o tenis en Lorca)",
  "Partido",
  "Cardio suave y flexibilidad",
];

/* ---------- Registro del día ---------- */

export const COMIDAS_DEL_DIA = ["Desayuno", "Comida", "Merienda", "Cena"];

export const diaVacio = () => ({ proteina: [false, false, false, false], fruta: 0, agua: false, conTenis: false });

/*
  Marcas guardadas PLANAS: una clave de primer nivel por cosa marcada
  ("2026-11-02|proteina|0", "2026-11-02|fruta", "2026-11-02|compra|huevos").

  Con un objeto por día ({ "2026-11-02": { proteina, fruta... } }), la fusión
  —que en un objeto llano va por clave de primer nivel, ver src/lib/fusionar.js—
  se quedaba con el día ENTERO de un dispositivo: marcar el desayuno en el móvil
  y la cena en el PC hacía desaparecer una de las dos. Así cada marca se fusiona
  sola. Desmarcar escribe `false` y no borra la clave, para que gane el cambio
  más reciente y no resucite la marca del otro dispositivo.
*/
const k = (...partes) => partes.join("|");

export function leerDia(marcas = {}, fecha) {
  const d = diaVacio();
  return {
    proteina: d.proteina.map((_, i) => Boolean(marcas[k(fecha, "proteina", i)])),
    fruta: Number(marcas[k(fecha, "fruta")]) || 0,
    agua: Boolean(marcas[k(fecha, "agua")]),
    conTenis: Boolean(marcas[k(fecha, "conTenis")]),
  };
}

// Cambios para fusionar con `{ ...marcas, ...cambios }`. Acepta `proteina`
// como [índice, valor] para tocar una sola comida.
export function marcarDia(fecha, { proteina, ...resto }) {
  const cambios = {};
  if (proteina) cambios[k(fecha, "proteina", proteina[0])] = Boolean(proteina[1]);
  Object.entries(resto).forEach(([campo, valor]) => (cambios[k(fecha, campo)] = valor));
  return cambios;
}

// Lo marcado de una semana (lista de la compra o pasos de la cocina).
export function marcadosSemana(marcas = {}, lunes, lista) {
  const prefijo = k(lunes, lista, "");
  return Object.keys(marcas)
    .filter((clave) => clave.startsWith(prefijo) && marcas[clave])
    .map((clave) => clave.slice(prefijo.length));
}

export const marcaSemana = (lunes, lista, id, valor) => ({ [k(lunes, lista, id)]: Boolean(valor) });

/*
  Cuántas de las cosas del día se han cumplido, sobre 6: proteína en las 4
  comidas, las 2 piezas de fruta mínimas y beber agua. Es un empujón, no una
  nota: por eso no hay más categorías.
*/
export function cumplimiento(dia) {
  const d = { ...diaVacio(), ...(dia || {}) };
  const proteina = (d.proteina || []).filter(Boolean).length;
  const fruta = Math.min(2, Number(d.fruta) || 0) === 2 ? 1 : 0;
  const agua = d.agua ? 1 : 0;
  return { hechos: proteina + fruta + agua, total: 6 };
}

/* ---------- Guía ---------- */

export const OBJETIVO =
  "Las raciones equivalen a unas 2.200-2.400 kcal y 150-165 g de proteína al día para unos 82 kg. Si la cintura baja 0,5-1 cm cada 2 semanas, vas bien.";

export const PLATO = [
  { parte: "Proteína", racion: "1,5-2 palmas", ejemplos: "Pollo (muslos o pechuga en bandeja grande), 3 huevos, 2 latas de atún o caballa, carne picada, merluza congelada. Legumbre de bote: medio bote más huevo o atún." },
  { parte: "Hidratos", racion: "2 puños en días de tenis, pierna o partido · 1 en descanso", ejemplos: "Arroz, pasta o patata (medido ya cocido), pan (2 rebanadas = 1 puño), tortillas de trigo, avena." },
  { parte: "Verdura", racion: "2 puños (medio plato)", ejemplos: "Verdura congelada para saltear, brócoli o judías congeladas, ensalada de bolsa, tomate, pimiento, cebolla." },
  { parte: "Grasa", racion: "1 pulgar", ejemplos: "1 cucharada de aceite de oliva o un puñado pequeño de frutos secos." },
];

export const REGLAS = [
  "Proteína en las 4 comidas del día.",
  "2-3 piezas de fruta al día. La de temporada es la más barata.",
  "Para beber, agua. Refrescos, zumos y alcohol, solo de vez en cuando.",
  "Lo que no hay en el piso no te lo comes: no compres bollería, galletas ni patatas fritas.",
  "Si en 3 semanas la cintura no baja, quita el puño de hidratos de la cena los días de descanso.",
];

export const COCINA_DOMINGO = [
  "Hornea 8-10 muslos de pollo con patatas y cebolla en trozos: sal, ajo en polvo, pimentón y un chorrito de aceite, 45-50 min a 200 °C.",
  "Cuece arroz o pasta para 3 días (unos 250 g en seco).",
  "Cuece 6 huevos duros.",
  "Haz una olla de boloñesa: 500 g de carne picada, 1 cebolla y 1 bote de tomate triturado. Salen 3-4 raciones.",
];

export const NOTA_COCINA =
  "Guárdalo en tuppers en la nevera y cómetelo en 3 días. El arroz, enfríalo rápido antes de guardarlo. Lo que no vayas a comer en ese plazo, congélalo en raciones.";

// [nombre, qué lleva / cómo, tiempo]
export const RECETAS = {
  desayunos: [
    ["Avena de microondas", "1 puño de avena + 1 vaso de leche, 2 min al micro. Encima, un plátano y 1 cucharada de crema de cacahuete", "3 min"],
    ["Tostadas con huevos", "2 rebanadas con tomate y aceite + 3 huevos revueltos", "7 min"],
    ["Bol de skyr", "1 tarrina grande de skyr o queso fresco batido 0% + 1 puñado de avena + fruta", "2 min"],
    ["Batido para llevar", "Leche + plátano + 3 cucharadas de avena + cacao, en batidora", "2 min"],
    ["Bocadillo", "Media barra con tortilla francesa de 2 huevos, o con pavo y queso, + café con leche", "5 min"],
  ],
  comidas: [
    ["Arroz salteado con pollo", "Arroz del domingo + pollo en tacos + verdura congelada a la sartén con salsa de soja", "15 min"],
    ["Pasta con atún", "Pasta + 2 latas de atún + tomate triturado + orégano + maíz", "12 min"],
    ["Muslos al horno", "Los del domingo, con su patata, + ensalada", "3 min"],
    ["Macarrones a la boloñesa", "Pasta + la boloñesa del domingo + queso rallado", "10 min"],
    ["Lentejas rápidas", "Bote de lentejas escurrido con sofrito de cebolla y pimiento, tomate y pimentón. Un huevo encima o arroz al lado", "15 min"],
    ["Garbanzos con espinacas", "Bote de garbanzos + espinacas congeladas + ajo + comino, con 2 huevos o una lata de atún", "12 min"],
  ],
  meriendas: [
    ["Media barra con atún, pavo o tortilla + 1 fruta", "Antes del tenis o de la pierna", ""],
    ["Skyr o queso fresco batido + fruta", "Días normales", ""],
    ["Plátano + puñado de frutos secos", "Para llevar a la facultad", ""],
    ["2 tostadas con queso fresco y pavo", "Días normales", ""],
    ["Vaso de leche con cacao + 1 fruta", "Cuando vas con prisa", ""],
  ],
  cenas: [
    ["Tortilla francesa", "3 huevos + ensalada + pan", "8 min"],
    ["Revuelto", "3 huevos con champiñones o espinacas + pan", "10 min"],
    ["Pescado con patata", "Merluza o abadejo congelado a la plancha + patata pinchada, 8-10 min al micro, + verdura", "15 min"],
    ["Lata y ensalada", "Caballa o sardinas en lata + ensalada + pan, sin cocinar", "3 min"],
    ["Pizza de tortilla", "Tortilla de trigo + tomate triturado + atún + queso rallado + orégano, en la sartén tapada 8 min", "10 min"],
    ["Wraps", "2 tortillas de trigo con pollo del domingo o atún, lechuga, tomate y queso fresco", "5 min"],
  ],
};

export const NOTAS_RECETAS = {
  meriendas: "Martes y jueves, merienda hacia las 17:00, unas 2 h antes del tenis. Entre el tenis y el gimnasio del martes, un plátano.",
  cenas: "Lunes y martes, después del gimnasio, la cena lleva 2 puños de hidratos (macarrones a la boloñesa, arroz con pollo o tortilla con 2 rebanadas de pan). El resto de días, 1 puño. Hacia las 22:00 y sin saltártela: si hay que recortar, recorta en el picoteo de la tarde.",
};

export const EJEMPLO_MARTES = [
  ["8:00", "Avena de microondas con plátano"],
  ["14:00", "Arroz salteado con pollo"],
  ["17:00", "Media barra de atún + mandarina"],
  ["19:00", "Tenis → 20:15 plátano → 20:30 gimnasio"],
  ["22:00", "Macarrones a la boloñesa + ensalada"],
];

/*
  Lista de la compra semanal. Cada artículo lleva un id fijo (no `nuevoId`):
  es un catálogo, no un registro, y lo que se guarda por semana es la lista de
  ids marcados. Con ids aleatorios, cada dispositivo tendría los suyos y lo
  marcado en el móvil no casaría con nada en el PC.
*/
export const COMPRA = [
  {
    grupo: "Proteína",
    articulos: [
      ["huevos", "2 docenas de huevos"],
      ["pollo", "1-1,5 kg de pollo"],
      ["picada", "500 g de carne picada"],
      ["atun", "6 latas de atún"],
      ["caballa", "2 latas de caballa o sardinas"],
      ["merluza", "1 paquete de merluza congelada"],
      ["legumbres", "2 botes de legumbres"],
      ["skyr", "1 kg de skyr o queso fresco batido"],
      ["leche", "4 l de leche"],
    ],
  },
  {
    grupo: "Hidratos",
    articulos: [
      ["arroz", "1 kg de arroz o pasta"],
      ["patatas", "2 kg de patatas"],
      ["pan", "Pan"],
      ["avena", "500 g de avena"],
      ["tortillas", "Tortillas de trigo"],
    ],
  },
  {
    grupo: "Verdura y fruta",
    articulos: [
      ["congelada", "3-4 bolsas de verdura congelada"],
      ["ensalada", "Ensalada"],
      ["tomates", "Tomates"],
      ["cebollas", "Cebollas"],
      ["fruta", "Fruta de temporada (2-3 piezas al día)"],
    ],
  },
  {
    grupo: "Básicos que duran",
    articulos: [
      ["aceite", "Aceite de oliva"],
      ["triturado", "Tomate triturado"],
      ["especias", "Pimentón, ajo en polvo, orégano y comino"],
      ["soja", "Salsa de soja"],
      ["cacahuete", "Crema de cacahuete"],
      ["frutos-secos", "Frutos secos"],
    ],
  },
];

export const NOTA_COMPRA =
  "Huevos, legumbres, muslos de pollo y atún en lata suelen ser la proteína más barata, y en marca blanca todavía más. La proteína en polvo no es obligatoria si cada comida lleva su ración.";

export const TOTAL_ARTICULOS = COMPRA.reduce((n, g) => n + g.articulos.length, 0);
