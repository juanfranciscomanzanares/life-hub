import { describe, it, expect } from "vitest";
import { RECETAS } from "./alimentacion";
import {
  HUECOS,
  INGREDIENTES,
  GRUPOS_COMPRA,
  MENU_EJEMPLO,
  opcionesDe,
  leerMenu,
  marcaMenu,
  rellenarConEjemplo,
  vaciarMenu,
  platosEnMenu,
  listaDeLaCompra,
} from "./compra";

const LUNES = "2026-11-02";
const vacio = () => Array.from({ length: 7 }, () => ({ desayuno: "", comida: "", merienda: "", cena: "" }));
const articulo = (lista, id) => lista.grupos.flatMap((g) => g.articulos).find((a) => a.id === id);

describe("catálogo", () => {
  it("todas las recetas usan ingredientes que existen, y los ids no se repiten", () => {
    const recetas = Object.values(RECETAS).flat();
    expect(new Set(recetas.map((r) => r.id)).size).toBe(recetas.length);
    recetas.forEach((r) => r.ing.forEach((ing) => expect(INGREDIENTES[ing], `${r.id}: ${ing}`).toBeTruthy()));
    recetas
      .flatMap((r) => r.variantes || [])
      .forEach((v) => [...v.quita, ...v.pone].forEach((ing) => expect(INGREDIENTES[ing], ing).toBeTruthy()));
  });

  it("cada ingrediente comprable tiene su zona del súper", () => {
    Object.entries(INGREDIENTES)
      .filter(([, i]) => !i.despensa)
      .forEach(([id, i]) => expect(GRUPOS_COMPRA, id).toContain(i.grupo));
  });

  it("el menú de ejemplo usa recetas válidas para cada hueco", () => {
    MENU_EJEMPLO.forEach((dia) =>
      HUECOS.forEach((h) => {
        const validas = opcionesDe(h.id).flatMap((g) => g.recetas.map((r) => r.id));
        expect(validas, `${h.id}: ${dia[h.id]}`).toContain(dia[h.id]);
      })
    );
  });
});

describe("variantes", () => {
  it("cada variante quita lo suyo y pone lo de la alternativa", () => {
    const deSerie = listaDeLaCompra([{ desayuno: "bocadillo", comida: "", merienda: "", cena: "" }]);
    const pavo = listaDeLaCompra([{ desayuno: "bocadillo:pavo", comida: "", merienda: "", cena: "" }]);
    expect(articulo(deSerie, "huevos")).toBeTruthy();
    expect(articulo(pavo, "huevos")).toBeUndefined();
    expect(articulo(pavo, "pavo")).toBeTruthy();
    expect(articulo(pavo, "queso-lonchas")).toBeTruthy();
  });

  it("salen como opciones del menú con su nombre", () => {
    const nombres = opcionesDe("merienda").flatMap((g) => g.recetas.map((r) => `${r.id}=${r.nombre}`));
    expect(nombres).toContain("barra-atun:tortilla=Media barra de tortilla + fruta");
  });
});

describe("menú guardado", () => {
  it("lee y escribe con claves planas por hueco", () => {
    const marcas = { ...marcaMenu(LUNES, 1, "cena", "bolonesa"), ...marcaMenu("2026-11-09", 1, "cena", "wraps") };
    const menu = leerMenu(marcas, LUNES);
    expect(menu[1].cena).toBe("bolonesa");
    expect(menu[0].cena).toBe("");
    expect(platosEnMenu(menu)).toBe(1);
  });

  it("ignora ids de receta que ya no existen", () => {
    expect(leerMenu({ [`${LUNES}|menu|0|comida`]: "receta-borrada" }, LUNES)[0].comida).toBe("");
  });

  it("el ejemplo solo rellena los huecos libres", () => {
    const menu = vacio();
    menu[0].comida = "lentejas";
    const cambios = rellenarConEjemplo(menu, LUNES);
    expect(cambios[`${LUNES}|menu|0|comida`]).toBeUndefined();
    expect(cambios[`${LUNES}|menu|0|cena`]).toBe("bolonesa");
    expect(Object.keys(cambios)).toHaveLength(27);
  });

  it("vaciar escribe huecos vacíos en vez de borrar", () => {
    const cambios = vaciarMenu(LUNES);
    expect(Object.keys(cambios)).toHaveLength(28);
    expect(Object.values(cambios).every((v) => v === "")).toBe(true);
  });
});

describe("listaDeLaCompra", () => {
  it("menú vacío, lista vacía", () => {
    expect(listaDeLaCompra(vacio())).toMatchObject({ total: 0, despensa: [], grupos: [] });
  });

  it("no lleva cantidades, solo en cuántos platos sale cada cosa", () => {
    const menu = vacio();
    menu[2].desayuno = "tostadas-huevos";
    menu[2].cena = "tortilla";
    menu[3].comida = "lentejas";
    const huevos = articulo(listaDeLaCompra(menu), "huevos");
    expect(huevos).toEqual({ id: "huevos", nombre: "Huevos", platos: 3 });
  });

  it("la fruta entra siempre que haya menú, aunque ningún plato la lleve", () => {
    const menu = vacio();
    menu[0].comida = "pasta-atun";
    expect(articulo(listaDeLaCompra(menu), "fruta")).toMatchObject({ platos: 0 });
    menu[1].merienda = "skyr-fruta";
    expect(articulo(listaDeLaCompra(menu), "fruta")).toMatchObject({ platos: 1 });
  });

  it("lo de despensa sale aparte", () => {
    const menu = vacio();
    menu[0].comida = "arroz-pollo";
    const lista = listaDeLaCompra(menu);
    expect(lista.despensa.map((d) => d.id)).toEqual(["soja"]);
    expect(articulo(lista, "soja")).toBeUndefined();
  });

  it("el menú de ejemplo entero sale agrupado como en el súper", () => {
    const lista = listaDeLaCompra(MENU_EJEMPLO);
    expect(lista.grupos.map((g) => g.grupo)).toEqual(GRUPOS_COMPRA);
    // Dentro de cada grupo, primero lo que más se repite.
    lista.grupos.forEach((g) =>
      g.articulos.forEach((a, i) => i && expect(g.articulos[i - 1].platos).toBeGreaterThanOrEqual(a.platos))
    );
  });
});
