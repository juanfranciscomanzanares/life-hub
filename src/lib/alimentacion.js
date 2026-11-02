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

/*
  Recetas del plan, con los ingredientes que llevan para la lista de la compra.

  `id` fijo y no `nuevoId`: es catálogo, y el menú de la semana guarda ids de
  receta, que tienen que significar lo mismo en todos los dispositivos.

  `ing` es solo QUÉ lleva, sin cantidades: el plan no da la ración de todo (el
  pollo va "a palmas", la verdura "a puños") y una lista con gramos inventados
  daría una falsa precisión. Los ingredientes están en src/lib/compra.js.

  Las recetas con alternativa ("bocadillo de tortilla, o de pavo y queso")
  llevan `variantes`: cada una quita unos ingredientes y pone otros, y en el
  menú se elige como una opción más ("bocadillo:pavo"). Sin eso la lista
  contaba siempre la primera opción. `variante` es el nombre de la de serie, y
  `corto`, el nombre de la receta en el menú cuando el largo ya enumera las
  alternativas.
*/
export const RECETAS = {
  desayunos: [
    { id: "avena", nombre: "Avena de microondas", como: "1 puño de avena + 1 vaso de leche, 2 min al micro. Encima, un plátano y 1 cucharada de crema de cacahuete", tiempo: "3 min",
      ing: ["avena", "leche", "platano", "cacahuete"] },
    { id: "tostadas-huevos", nombre: "Tostadas con huevos", como: "2 rebanadas con tomate y aceite + 3 huevos revueltos", tiempo: "7 min",
      ing: ["pan-molde", "tomate", "huevos", "aceite"] },
    { id: "bol-skyr", nombre: "Bol de skyr", como: "1 tarrina grande de skyr o queso fresco batido 0% + 1 puñado de avena + fruta", tiempo: "2 min",
      ing: ["skyr", "avena", "fruta"] },
    { id: "batido", nombre: "Batido para llevar", como: "Leche + plátano + 3 cucharadas de avena + cacao, en batidora", tiempo: "2 min",
      ing: ["leche", "platano", "avena", "cacao"] },
    { id: "bocadillo", nombre: "Bocadillo", como: "Media barra con tortilla francesa de 2 huevos, o con pavo y queso, + café con leche", tiempo: "5 min",
      ing: ["barra", "huevos", "leche", "cafe"],
      variante: "de tortilla", variantes: [{ id: "pavo", nombre: "de pavo y queso", quita: ["huevos"], pone: ["pavo", "queso-lonchas"] }] },
  ],
  comidas: [
    { id: "arroz-pollo", nombre: "Arroz salteado con pollo", como: "Arroz del domingo + pollo en tacos + verdura congelada a la sartén con salsa de soja", tiempo: "15 min",
      ing: ["arroz", "pollo", "congelada", "soja"] },
    { id: "pasta-atun", nombre: "Pasta con atún", como: "Pasta + 2 latas de atún + tomate triturado + orégano + maíz", tiempo: "12 min",
      ing: ["pasta", "atun", "triturado", "maiz", "especias"] },
    { id: "muslos", nombre: "Muslos al horno", como: "Los del domingo, con su patata, + ensalada", tiempo: "3 min",
      ing: ["muslos", "patatas", "cebollas", "ensalada", "aceite", "especias"] },
    { id: "bolonesa", nombre: "Macarrones a la boloñesa", como: "Pasta + la boloñesa del domingo + queso rallado", tiempo: "10 min",
      ing: ["pasta", "picada", "cebollas", "triturado", "queso-rallado"] },
    { id: "lentejas", nombre: "Lentejas rápidas", como: "Bote de lentejas escurrido con sofrito de cebolla y pimiento, tomate y pimentón. Un huevo encima o arroz al lado", tiempo: "15 min",
      ing: ["lentejas", "cebollas", "pimientos", "triturado", "huevos", "especias"],
      variante: "con huevo", variantes: [{ id: "arroz", nombre: "con arroz", quita: ["huevos"], pone: ["arroz"] }] },
    { id: "garbanzos", nombre: "Garbanzos con espinacas", como: "Bote de garbanzos + espinacas congeladas + ajo + comino, con 2 huevos o una lata de atún", tiempo: "12 min",
      ing: ["garbanzos", "espinacas", "huevos", "especias"],
      variante: "con huevos", variantes: [{ id: "atun", nombre: "con atún", quita: ["huevos"], pone: ["atun"] }] },
  ],
  meriendas: [
    { id: "barra-atun", nombre: "Media barra con atún, pavo o tortilla + 1 fruta", como: "Antes del tenis o de la pierna", tiempo: "",
      ing: ["barra", "atun", "fruta"],
      corto: "Media barra", variante: "de atún + fruta", variantes: [
        { id: "pavo", nombre: "de pavo + fruta", quita: ["atun"], pone: ["pavo"] },
        { id: "tortilla", nombre: "de tortilla + fruta", quita: ["atun"], pone: ["huevos"] },
      ] },
    { id: "skyr-fruta", nombre: "Skyr o queso fresco batido + fruta", como: "Días normales", tiempo: "",
      ing: ["skyr", "fruta"] },
    { id: "platano-frutos", nombre: "Plátano + puñado de frutos secos", como: "Para llevar a la facultad", tiempo: "",
      ing: ["platano", "frutos-secos"] },
    { id: "tostadas-pavo", nombre: "2 tostadas con queso fresco y pavo", como: "Días normales", tiempo: "",
      ing: ["pan-molde", "queso-fresco", "pavo"] },
    { id: "leche-cacao", nombre: "Vaso de leche con cacao + 1 fruta", como: "Cuando vas con prisa", tiempo: "",
      ing: ["leche", "fruta", "cacao"] },
  ],
  cenas: [
    { id: "tortilla", nombre: "Tortilla francesa", como: "3 huevos + ensalada + pan", tiempo: "8 min",
      ing: ["huevos", "ensalada", "pan-molde"] },
    { id: "revuelto", nombre: "Revuelto", como: "3 huevos con champiñones o espinacas + pan", tiempo: "10 min",
      ing: ["huevos", "champinones", "pan-molde"],
      variante: "con champiñones", variantes: [{ id: "espinacas", nombre: "con espinacas", quita: ["champinones"], pone: ["espinacas"] }] },
    { id: "pescado", nombre: "Pescado con patata", como: "Merluza o abadejo congelado a la plancha + patata pinchada, 8-10 min al micro, + verdura", tiempo: "15 min",
      ing: ["merluza", "patatas", "congelada"] },
    { id: "lata-ensalada", nombre: "Lata y ensalada", como: "Caballa o sardinas en lata + ensalada + pan, sin cocinar", tiempo: "3 min",
      ing: ["caballa", "ensalada", "pan-molde"] },
    { id: "pizza-tortilla", nombre: "Pizza de tortilla", como: "Tortilla de trigo + tomate triturado + atún + queso rallado + orégano, en la sartén tapada 8 min", tiempo: "10 min",
      ing: ["tortillas", "triturado", "atun", "queso-rallado", "especias"] },
    { id: "wraps", nombre: "Wraps", como: "2 tortillas de trigo con pollo del domingo o atún, lechuga, tomate y queso fresco", tiempo: "5 min",
      ing: ["tortillas", "pollo", "ensalada", "tomate", "queso-fresco"],
      variante: "de pollo", variantes: [{ id: "atun", nombre: "de atún", quita: ["pollo"], pone: ["atun"] }] },
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
