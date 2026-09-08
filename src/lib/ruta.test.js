import { describe, it, expect } from "vitest";
import { seccionDesdeHash, hashDeSeccion } from "./ruta";

const IDS = ["inicio", "gimnasio", "plan", "tenis-notas"];

describe("hashDeSeccion", () => {
  it("usa el prefijo con barra", () => {
    expect(hashDeSeccion("gimnasio")).toBe("#/gimnasio");
  });

  it("aguanta ids con guion", () => {
    expect(hashDeSeccion("tenis-notas")).toBe("#/tenis-notas");
  });

  it("no explota sin id", () => {
    expect(hashDeSeccion(undefined)).toBe("#/");
  });
});

describe("seccionDesdeHash", () => {
  it("lee una sección válida", () => {
    expect(seccionDesdeHash("#/gimnasio", IDS)).toBe("gimnasio");
  });

  it("acepta el hash sin barra", () => {
    expect(seccionDesdeHash("#gimnasio", IDS)).toBe("gimnasio");
  });

  it("acepta el id pelado, sin almohadilla", () => {
    expect(seccionDesdeHash("plan", IDS)).toBe("plan");
  });

  it("cae en la sección por defecto si el id no existe", () => {
    expect(seccionDesdeHash("#/inventada", IDS)).toBe("inicio");
  });

  it("cae en la sección por defecto con el hash vacío", () => {
    expect(seccionDesdeHash("", IDS)).toBe("inicio");
    expect(seccionDesdeHash("#", IDS)).toBe("inicio");
    expect(seccionDesdeHash("#/", IDS)).toBe("inicio");
  });

  it("respeta la sección por defecto que le pasen", () => {
    expect(seccionDesdeHash("#/nada", IDS, "plan")).toBe("plan");
  });

  it("no se traga null ni undefined", () => {
    expect(seccionDesdeHash(null, IDS)).toBe("inicio");
    expect(seccionDesdeHash(undefined, IDS)).toBe("inicio");
  });

  it("descodifica el hash percent-encoded", () => {
    expect(seccionDesdeHash("#/tenis%2Dnotas", IDS)).toBe("tenis-notas");
  });

  it("no lanza con un percent-encoding roto", () => {
    expect(() => seccionDesdeHash("#/%E0%A4%A", IDS)).not.toThrow();
    expect(seccionDesdeHash("#/%E0%A4%A", IDS)).toBe("inicio");
  });

  it("sin lista de ids válidos, todo cae por defecto", () => {
    expect(seccionDesdeHash("#/gimnasio", [])).toBe("inicio");
  });
});
