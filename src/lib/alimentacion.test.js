import { describe, it, expect } from "vitest";
import { hidratosDelDia, cumplimiento, diaVacio, leerDia, marcarDia, marcadosSemana, marcaSemana, COMPRA } from "./alimentacion";

describe("hidratosDelDia", () => {
  it("2 puños en la comida los días de tenis, pierna o partido", () => {
    [0, 1, 2, 3, 5].forEach((d) => expect(hidratosDelDia(d).comida).toBe(2));
    [4, 6].forEach((d) => expect(hidratosDelDia(d).comida).toBe(1));
  });

  it("cena fuerte solo lunes y martes", () => {
    expect(hidratosDelDia(0).cena).toBe(2);
    expect(hidratosDelDia(1).cena).toBe(2);
    expect(hidratosDelDia(2).cena).toBe(1);
    expect(hidratosDelDia(6).cena).toBe(1);
  });

  it("con la cintura estancada se quita el puño de la cena en descanso, y solo ahí", () => {
    expect(hidratosDelDia(6, { estancada: true }).cena).toBe(0);
    expect(hidratosDelDia(4, { estancada: true }).cena).toBe(0);
    expect(hidratosDelDia(2, { estancada: true }).cena).toBe(1);
    expect(hidratosDelDia(0, { estancada: true }).cena).toBe(2);
  });

  it("el viernes de tenis en Lorca cuenta como día de tenis", () => {
    expect(hidratosDelDia(4, { conTenis: true })).toMatchObject({ carga: true, comida: 2 });
    expect(hidratosDelDia(4, { conTenis: true, estancada: true }).cena).toBe(1);
  });
});

describe("cumplimiento", () => {
  it("cuenta proteína por comida, fruta mínima y agua", () => {
    expect(cumplimiento(diaVacio())).toEqual({ hechos: 0, total: 6 });
    expect(cumplimiento({ proteina: [true, true, false, true], fruta: 1, agua: true }).hechos).toBe(4);
    expect(cumplimiento({ proteina: [true, true, true, true], fruta: 3, agua: true }).hechos).toBe(6);
  });

  it("aguanta un día sin registro", () => {
    expect(cumplimiento(undefined).hechos).toBe(0);
  });
});

describe("lista de la compra", () => {
  it("los ids de los artículos no se repiten", () => {
    const ids = COMPRA.flatMap((g) => g.articulos.map(([id]) => id));
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("marcas planas", () => {
  it("cada marca es su propia clave, para que la fusión no pierda ninguna", () => {
    const movil = marcarDia("2026-11-02", { proteina: [0, true] });
    const pc = marcarDia("2026-11-02", { proteina: [3, true], fruta: 2 });
    // Lo que haría la fusión por clave de primer nivel: las dos sobreviven.
    const fusion = { ...movil, ...pc };
    expect(leerDia(fusion, "2026-11-02")).toEqual({
      proteina: [true, false, false, true],
      fruta: 2,
      agua: false,
      conTenis: false,
    });
    expect(leerDia(fusion, "2026-11-03")).toEqual(diaVacio());
  });

  it("desmarcar escribe false en vez de borrar", () => {
    expect(marcarDia("2026-11-02", { proteina: [1, false] })).toEqual({ "2026-11-02|proteina|1": false });
  });

  it("lee lo marcado de una semana y lista", () => {
    const m = {
      ...marcaSemana("2026-11-02", "compra", "huevos", true),
      ...marcaSemana("2026-11-02", "compra", "pan", false),
      ...marcaSemana("2026-11-02", "cocina", 0, true),
      ...marcaSemana("2026-10-26", "compra", "leche", true),
    };
    expect(marcadosSemana(m, "2026-11-02", "compra")).toEqual(["huevos"]);
    expect(marcadosSemana(m, "2026-11-02", "cocina")).toEqual(["0"]);
  });
});
