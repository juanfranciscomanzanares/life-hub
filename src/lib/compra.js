/*
  Lista de la compra a partir del menú de la semana.

  Eliges qué vas a desayunar, comer, merendar y cenar cada día (entre las
  recetas del plan, src/lib/alimentacion.js) y aquí se junta todo lo que llevan
  esos platos, agrupado como en el súper y con en cuántos platos sale cada
  cosa. Sin cantidades a propósito: el plan no da la ración de todo y no se
  inventan gramos.

  El menú se guarda en `lh_comida_semana`, junto a las marcas de la compra y de
  la cocina del domingo, con una clave plana por hueco
  ("<lunes>|menu|<día>|<comida>": id de receta). Plana por lo mismo que las
  marcas: cambiar el martes en el móvil y el jueves en el PC no pisa nada.
*/

import { RECETAS } from "./alimentacion";

export const HUECOS = [
  { id: "desayuno", nombre: "Desayuno", de: ["desayunos"] },
  // La comida y la cena comparten recetas: el plan propone macarrones a la
  // boloñesa o arroz con pollo para la cena del lunes y el martes, y los dos
  // están en la lista de comidas.
  { id: "comida", nombre: "Comida", de: ["comidas", "cenas"] },
  { id: "merienda", nombre: "Merienda", de: ["meriendas"] },
  { id: "cena", nombre: "Cena", de: ["cenas", "comidas"] },
];

const NOMBRE_TIPO = { desayunos: "Desayunos", comidas: "Comidas", cenas: "Cenas", meriendas: "Meriendas" };

/*
  Cada receta con sus variantes ya desplegadas como platos sueltos: la de serie
  con el id de la receta y cada variante con "<receta>:<variante>", quitando y
  poniendo los ingredientes que cambian.
*/
const platosDe = (r) => {
  if (!r.variantes?.length) return [r];
  const base = r.corto || r.nombre;
  const deSerie = { ...r, nombre: `${base} ${r.variante}` };
  return [
    deSerie,
    ...r.variantes.map((v) => ({
      ...r,
      id: `${r.id}:${v.id}`,
      nombre: `${base} ${v.nombre}`,
      ing: [...r.ing.filter((ing) => !v.quita.includes(ing)), ...v.pone],
    })),
  ];
};

export const opcionesDe = (hueco) =>
  (HUECOS.find((h) => h.id === hueco)?.de || []).map((tipo) => ({
    grupo: NOMBRE_TIPO[tipo],
    recetas: RECETAS[tipo].flatMap(platosDe),
  }));

const RECETA_POR_ID = Object.fromEntries(Object.values(RECETAS).flat().flatMap(platosDe).map((r) => [r.id, r]));
export const recetaDe = (id) => RECETA_POR_ID[id] || null;

/*
  Ingredientes, con el nombre con el que se buscan en la tienda y su zona del
  súper. Los de `despensa` (aceite, especias, salsa de soja...) se gastan poco y
  van aparte: lo que importa es acordarse de mirar si queda.
*/
export const GRUPOS_COMPRA = ["Proteína", "Lácteos", "Hidratos", "Verdura y fruta", "Básicos que duran"];

export const INGREDIENTES = {
  huevos: { nombre: "Huevos", grupo: "Proteína" },
  pollo: { nombre: "Pollo (pechuga o contramuslo)", grupo: "Proteína" },
  muslos: { nombre: "Muslos de pollo", grupo: "Proteína" },
  picada: { nombre: "Carne picada", grupo: "Proteína" },
  atun: { nombre: "Atún en lata", grupo: "Proteína" },
  caballa: { nombre: "Caballa o sardinas en lata", grupo: "Proteína" },
  merluza: { nombre: "Merluza o abadejo congelado", grupo: "Proteína" },
  pavo: { nombre: "Pavo en lonchas", grupo: "Proteína" },
  lentejas: { nombre: "Lentejas cocidas", grupo: "Proteína" },
  garbanzos: { nombre: "Garbanzos cocidos", grupo: "Proteína" },

  leche: { nombre: "Leche", grupo: "Lácteos" },
  skyr: { nombre: "Skyr o queso fresco batido", grupo: "Lácteos" },
  "queso-fresco": { nombre: "Queso fresco", grupo: "Lácteos" },
  "queso-rallado": { nombre: "Queso rallado", grupo: "Lácteos" },
  "queso-lonchas": { nombre: "Queso en lonchas", grupo: "Lácteos" },

  arroz: { nombre: "Arroz", grupo: "Hidratos" },
  pasta: { nombre: "Pasta", grupo: "Hidratos" },
  avena: { nombre: "Avena", grupo: "Hidratos" },
  patatas: { nombre: "Patatas", grupo: "Hidratos" },
  "pan-molde": { nombre: "Pan de molde", grupo: "Hidratos" },
  barra: { nombre: "Pan de barra", grupo: "Hidratos" },
  tortillas: { nombre: "Tortillas de trigo", grupo: "Hidratos" },

  congelada: { nombre: "Verdura congelada para saltear", grupo: "Verdura y fruta" },
  espinacas: { nombre: "Espinacas congeladas", grupo: "Verdura y fruta" },
  ensalada: { nombre: "Ensalada de bolsa", grupo: "Verdura y fruta" },
  champinones: { nombre: "Champiñones", grupo: "Verdura y fruta" },
  tomate: { nombre: "Tomates", grupo: "Verdura y fruta" },
  cebollas: { nombre: "Cebollas", grupo: "Verdura y fruta" },
  pimientos: { nombre: "Pimientos", grupo: "Verdura y fruta" },
  platano: { nombre: "Plátanos", grupo: "Verdura y fruta" },
  fruta: { nombre: "Fruta de temporada (2-3 piezas al día)", grupo: "Verdura y fruta" },

  triturado: { nombre: "Tomate triturado", grupo: "Básicos que duran" },
  maiz: { nombre: "Maíz dulce", grupo: "Básicos que duran" },
  "frutos-secos": { nombre: "Frutos secos", grupo: "Básicos que duran" },

  aceite: { nombre: "Aceite de oliva", despensa: true },
  especias: { nombre: "Pimentón, ajo en polvo, orégano y comino", despensa: true },
  soja: { nombre: "Salsa de soja", despensa: true },
  cacao: { nombre: "Cacao en polvo", despensa: true },
  cacahuete: { nombre: "Crema de cacahuete", despensa: true },
  cafe: { nombre: "Café", despensa: true },
};

/* ---------- Menú guardado ---------- */

const clave = (lunes, dia, hueco) => `${lunes}|menu|${dia}|${hueco}`;

// Los 7 días de una semana, cada uno con el id de receta de cada hueco ("" si
// está libre).
export function leerMenu(marcas = {}, lunes) {
  return Array.from({ length: 7 }, (_, dia) =>
    Object.fromEntries(HUECOS.map((h) => [h.id, recetaDe(marcas[clave(lunes, dia, h.id)]) ? marcas[clave(lunes, dia, h.id)] : ""]))
  );
}

export const marcaMenu = (lunes, dia, hueco, recetaId) => ({ [clave(lunes, dia, hueco)]: recetaId || "" });

/*
  Un menú de ejemplo que cumple lo que pide el plan: la cena del lunes y del
  martes con 2 puños (macarrones a la boloñesa, como en el "ejemplo de un
  martes"), media barra de atún antes del tenis los martes y jueves, y lo de la
  cocina del domingo repartido entre semana. Solo rellena los huecos libres.
*/
export const MENU_EJEMPLO = [
  { desayuno: "avena", comida: "muslos", merienda: "skyr-fruta", cena: "bolonesa" },
  { desayuno: "avena", comida: "arroz-pollo", merienda: "barra-atun", cena: "bolonesa" },
  { desayuno: "tostadas-huevos", comida: "pasta-atun", merienda: "platano-frutos", cena: "pescado" },
  { desayuno: "bol-skyr", comida: "muslos", merienda: "barra-atun", cena: "tortilla" },
  { desayuno: "batido", comida: "lentejas", merienda: "tostadas-pavo", cena: "lata-ensalada" },
  { desayuno: "tostadas-huevos", comida: "arroz-pollo", merienda: "leche-cacao", cena: "pizza-tortilla" },
  { desayuno: "bocadillo", comida: "garbanzos", merienda: "skyr-fruta", cena: "wraps" },
];

export function rellenarConEjemplo(menu, lunes) {
  const cambios = {};
  menu.forEach((dia, d) =>
    HUECOS.forEach(({ id }) => {
      if (!dia[id]) Object.assign(cambios, marcaMenu(lunes, d, id, MENU_EJEMPLO[d][id]));
    })
  );
  return cambios;
}

// Vaciar escribe "" en cada hueco en vez de borrar la clave: así gana el
// cambio más reciente al sincronizar y no reaparece el menú del otro aparato.
export function vaciarMenu(lunes) {
  const cambios = {};
  for (let d = 0; d < 7; d++) HUECOS.forEach(({ id }) => Object.assign(cambios, marcaMenu(lunes, d, id, "")));
  return cambios;
}

export const platosEnMenu = (menu) => menu.reduce((n, dia) => n + HUECOS.filter((h) => dia[h.id]).length, 0);

/* ---------- La lista ---------- */

/*
  Junta los ingredientes de todos los platos del menú, agrupados como en el
  súper, con en cuántos platos sale cada uno (para que se vea si el pollo es
  para un día o para cinco).

  La fruta entra siempre que haya algún día con menú, aunque ningún plato la
  lleve: el plan pide 2-3 piezas al día, aparte de las comidas.
*/
export function listaDeLaCompra(menu = []) {
  const platos = {};
  const despensa = new Set();
  let hayMenu = false;

  menu.forEach((dia) =>
    HUECOS.forEach(({ id: hueco }) => {
      const receta = recetaDe(dia?.[hueco]);
      if (!receta) return;
      hayMenu = true;
      new Set(receta.ing).forEach((ing) => {
        if (INGREDIENTES[ing]?.despensa) despensa.add(ing);
        else platos[ing] = (platos[ing] || 0) + 1;
      });
    })
  );
  if (hayMenu && !platos.fruta) platos.fruta = 0;

  const grupos = GRUPOS_COMPRA.map((grupo) => ({
    grupo,
    articulos: Object.keys(platos)
      .filter((id) => INGREDIENTES[id]?.grupo === grupo)
      .sort((a, b) => platos[b] - platos[a])
      .map((id) => ({ id, nombre: INGREDIENTES[id].nombre, platos: platos[id] })),
  })).filter((g) => g.articulos.length);

  return {
    grupos,
    despensa: [...despensa].map((id) => ({ id, nombre: INGREDIENTES[id].nombre })),
    total: grupos.reduce((n, g) => n + g.articulos.length, 0),
  };
}
