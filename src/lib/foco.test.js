import { describe, it, expect } from "vitest";
import { siguienteFoco, SELECTOR_ENFOCABLE } from "./foco";

const [a, b, c] = ["a", "b", "c"];

describe("siguienteFoco", () => {
  it("avanza al siguiente", () => {
    expect(siguienteFoco([a, b, c], a)).toBe(b);
    expect(siguienteFoco([a, b, c], b)).toBe(c);
  });

  it("desde el último vuelve al primero", () => {
    expect(siguienteFoco([a, b, c], c)).toBe(a);
  });

  it("hacia atrás retrocede", () => {
    expect(siguienteFoco([a, b, c], c, true)).toBe(b);
  });

  it("hacia atrás desde el primero salta al último", () => {
    // El módulo negativo: en JS -1 % 3 es -1, así que sin el ajuste esto
    // devolvía undefined y el foco se perdía.
    expect(siguienteFoco([a, b, c], a, true)).toBe(c);
  });

  it("si el foco venía de fuera, entra por el principio", () => {
    expect(siguienteFoco([a, b, c], "fuera")).toBe(a);
  });

  it("si el foco venía de fuera y va hacia atrás, entra por el final", () => {
    expect(siguienteFoco([a, b, c], "fuera", true)).toBe(c);
  });

  it("con un solo elemento se queda en él", () => {
    expect(siguienteFoco([a], a)).toBe(a);
    expect(siguienteFoco([a], a, true)).toBe(a);
  });

  it("sin elementos devuelve null en vez de forzar el foco", () => {
    expect(siguienteFoco([], a)).toBe(null);
    expect(siguienteFoco(null, a)).toBe(null);
  });

  it("descarta los huecos de la lista", () => {
    expect(siguienteFoco([a, null, b], a)).toBe(b);
  });
});

describe("SELECTOR_ENFOCABLE", () => {
  it("deja fuera lo desactivado y el tabindex -1", () => {
    expect(SELECTOR_ENFOCABLE).toContain("button:not([disabled])");
    expect(SELECTOR_ENFOCABLE).toContain('[tabindex]:not([tabindex="-1"])');
  });
});
