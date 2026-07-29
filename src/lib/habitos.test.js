import { describe, it, expect } from "vitest";
import {
  sumarDias,
  semanaDe,
  normalizarHabito,
  estaHecho,
  alternarDia,
  racha,
  mejorRacha,
  hechosHoy,
} from "./habitos";

// Miércoles 29 de julio de 2026.
const HOY = "2026-07-29";

describe("fechas", () => {
  it("suma y resta días cruzando meses", () => {
    expect(sumarDias("2026-07-31", 1)).toBe("2026-08-01");
    expect(sumarDias("2026-08-01", -1)).toBe("2026-07-31");
    expect(sumarDias("2027-01-01", -1)).toBe("2026-12-31");
  });

  it("la semana va de lunes a domingo", () => {
    expect(semanaDe(HOY)).toEqual([
      "2026-07-27", "2026-07-28", "2026-07-29",
      "2026-07-30", "2026-07-31", "2026-08-01", "2026-08-02",
    ]);
  });

  it("el domingo pertenece a la semana que acaba", () => {
    expect(semanaDe("2026-08-02")[0]).toBe("2026-07-27");
    expect(semanaDe("2026-08-03")[0]).toBe("2026-08-03");
  });
});

describe("migración desde el formato antiguo", () => {
  it("trae las marcas de week a la semana en curso", () => {
    const viejo = { id: 1, name: "Leer", streak: 4, week: [true, false, true, false, false, false, false] };
    const nuevo = normalizarHabito(viejo, HOY);
    expect(nuevo.hecho).toEqual(["2026-07-27", "2026-07-29"]);
    // El streak viejo no se conserva: era siempre 0 y no significaba nada.
    expect(nuevo).not.toHaveProperty("streak");
    expect(nuevo).not.toHaveProperty("week");
  });

  it("es idempotente", () => {
    const ya = { id: 1, name: "Leer", hecho: ["2026-07-29"] };
    expect(normalizarHabito(ya, HOY)).toBe(ya);
  });

  it("un hábito sin nada queda vacío", () => {
    expect(normalizarHabito({ id: 2, name: "Nuevo" }, HOY).hecho).toEqual([]);
  });
});

describe("marcar días", () => {
  const h = { id: 1, name: "Leer", hecho: ["2026-07-28"] };

  it("marca y desmarca", () => {
    const marcado = alternarDia(h, HOY);
    expect(estaHecho(marcado, HOY)).toBe(true);
    expect(estaHecho(alternarDia(marcado, HOY), HOY)).toBe(false);
  });

  it("no duplica ni pierde los demás días", () => {
    const marcado = alternarDia(alternarDia(h, HOY), HOY);
    expect(marcado.hecho).toEqual(["2026-07-28"]);
  });
});

describe("racha", () => {
  it("cuenta días seguidos hacia atrás", () => {
    const h = { hecho: ["2026-07-27", "2026-07-28", "2026-07-29"] };
    expect(racha(h, HOY)).toBe(3);
  });

  it("se corta en el primer hueco", () => {
    const h = { hecho: ["2026-07-25", "2026-07-28", "2026-07-29"] };
    expect(racha(h, HOY)).toBe(2);
  });

  it("no se rompe porque hoy aún no esté marcado", () => {
    // A media mañana todavía estás a tiempo: la racha sigue viva desde ayer.
    const h = { hecho: ["2026-07-27", "2026-07-28"] };
    expect(racha(h, HOY)).toBe(2);
  });

  it("si falta ayer y hoy, la racha es cero", () => {
    const h = { hecho: ["2026-07-20", "2026-07-21"] };
    expect(racha(h, HOY)).toBe(0);
  });

  it("un hábito sin días no tiene racha", () => {
    expect(racha({ hecho: [] }, HOY)).toBe(0);
    expect(racha({}, HOY)).toBe(0);
  });

  it("mejorRacha coge la más larga y hechosHoy cuenta los de hoy", () => {
    const habitos = [
      { id: 1, hecho: ["2026-07-28", "2026-07-29"] },
      { id: 2, hecho: ["2026-07-26", "2026-07-27", "2026-07-28", "2026-07-29"] },
      { id: 3, hecho: [] },
    ];
    expect(mejorRacha(habitos, HOY)).toBe(4);
    expect(hechosHoy(habitos, HOY)).toBe(2);
  });
});
