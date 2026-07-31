import { describe, it, expect } from "vitest";
import { claveMes, etiquetaMes, ultimosMeses } from "./meses";

describe("claveMes", () => {
  it("recorta la fecha al mes", () => {
    expect(claveMes("2026-07-15")).toBe("2026-07");
  });

  it("deja pasar una clave que ya es de mes", () => {
    expect(claveMes("2026-07")).toBe("2026-07");
  });

  it("no explota sin fecha", () => {
    expect(claveMes(undefined)).toBe("");
    expect(claveMes(null)).toBe("");
  });
});

describe("etiquetaMes", () => {
  it("traduce la clave a nombre corto y año de dos cifras", () => {
    expect(etiquetaMes("2026-07")).toBe("Jul 26");
    expect(etiquetaMes("2027-01")).toBe("Ene 27");
    expect(etiquetaMes("2026-12")).toBe("Dic 26");
  });

  it("devuelve la clave tal cual si el mes no existe", () => {
    // Un registro con la fecha corrupta debe verse raro, no tumbar la sección.
    expect(etiquetaMes("2026-13")).toBe("2026-13");
    expect(etiquetaMes("2026-00")).toBe("2026-00");
  });

  it("no explota con basura", () => {
    expect(etiquetaMes("")).toBe("");
    expect(etiquetaMes(undefined)).toBe("");
  });
});

describe("ultimosMeses", () => {
  it("devuelve n meses, del más antiguo al más reciente", () => {
    expect(ultimosMeses(3, new Date(2026, 6, 15))).toEqual(["2026-05", "2026-06", "2026-07"]);
  });

  it("el último es el mes de hoy", () => {
    const r = ultimosMeses(6, new Date(2026, 6, 1));
    expect(r).toHaveLength(6);
    expect(r[r.length - 1]).toBe("2026-07");
  });

  it("cruza el cambio de año hacia atrás", () => {
    expect(ultimosMeses(3, new Date(2027, 0, 10))).toEqual(["2026-11", "2026-12", "2027-01"]);
  });

  it("rellena el mes con cero a la izquierda", () => {
    expect(ultimosMeses(1, new Date(2026, 0, 5))).toEqual(["2026-01"]);
  });

  it("con 0 o menos devuelve una lista vacía", () => {
    expect(ultimosMeses(0)).toEqual([]);
    expect(ultimosMeses(-3)).toEqual([]);
  });
});
