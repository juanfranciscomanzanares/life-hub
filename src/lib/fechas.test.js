import { describe, it, expect } from "vitest";
import {
  iso,
  desdeISO,
  sumarDias,
  lunesDe,
  porDiaDeLaSemana,
  porSemanas,
  porMeses,
} from "./fechas";

describe("desdeISO / iso", () => {
  it("interpreta la fecha en LOCAL, no en UTC", () => {
    /*
      El fallo clásico: `new Date("2026-07-29")` es medianoche UTC, que en
      España cae el 28 por la noche, y la semana salía corrida un día.
    */
    const d = desdeISO("2026-07-29");
    expect(d.getDate()).toBe(29);
    expect(d.getMonth()).toBe(6);
    expect(iso(d)).toBe("2026-07-29");
  });

  it("devuelve null con basura", () => {
    expect(desdeISO("no-es-fecha")).toBe(null);
    expect(desdeISO("")).toBe(null);
  });
});

describe("sumarDias", () => {
  it("suma y resta", () => {
    expect(sumarDias("2026-07-29", 3)).toBe("2026-08-01");
    expect(sumarDias("2026-08-01", -3)).toBe("2026-07-29");
  });

  it("cruza el cambio de año", () => {
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("aguanta el 29 de febrero de un bisiesto", () => {
    expect(sumarDias("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("lunesDe", () => {
  it("un miércoles devuelve su lunes", () => {
    // 2026-07-29 es miércoles
    expect(lunesDe("2026-07-29")).toBe("2026-07-27");
  });

  it("un lunes se devuelve a sí mismo", () => {
    expect(lunesDe("2026-07-27")).toBe("2026-07-27");
  });

  it("el DOMINGO pertenece a la semana que acaba, no a la que empieza", () => {
    // Aquí la semana va de lunes a domingo.
    expect(lunesDe("2026-08-02")).toBe("2026-07-27");
  });
});

describe("porDiaDeLaSemana", () => {
  const filas = [
    { fecha: "2026-07-27", horas: 2 }, // lunes
    { fecha: "2026-07-27", horas: 1 }, // lunes otra vez
    { fecha: "2026-07-30", horas: 3 }, // jueves
    { fecha: "2026-08-05", horas: 9 }, // otra semana: no cuenta
  ];

  it("devuelve los siete días, de lunes a domingo", () => {
    const r = porDiaDeLaSemana(filas, "2026-07-29");
    expect(r).toHaveLength(7);
    expect(r.map((d) => d.etiqueta)).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
  });

  it("suma varias filas del mismo día", () => {
    const r = porDiaDeLaSemana(filas, "2026-07-29");
    expect(r[0].horas).toBe(3);
    expect(r[3].horas).toBe(3);
  });

  it("deja fuera lo de otras semanas", () => {
    const r = porDiaDeLaSemana(filas, "2026-07-29");
    expect(r.reduce((a, d) => a + d.horas, 0)).toBe(6);
  });

  it("marca el día de hoy", () => {
    const r = porDiaDeLaSemana(filas, "2026-07-29");
    expect(r.filter((d) => d.esHoy).map((d) => d.etiqueta)).toEqual(["Mié"]);
  });

  it("sin fecha válida devuelve lista vacía", () => {
    expect(porDiaDeLaSemana(filas, "x")).toEqual([]);
  });
});

describe("porSemanas", () => {
  const filas = [
    { fecha: "2026-07-29", horas: 5 }, // semana del 27
    { fecha: "2026-07-20", horas: 2 }, // semana anterior
  ];

  it("devuelve n semanas, de la más antigua a la más reciente", () => {
    const r = porSemanas(filas, "2026-07-29", 3);
    expect(r).toHaveLength(3);
    expect(r[r.length - 1].desde).toBe("2026-07-27");
    expect(r[0].desde).toBe("2026-07-13");
  });

  it("cada semana suma lo suyo", () => {
    const r = porSemanas(filas, "2026-07-29", 3);
    expect(r[r.length - 1].horas).toBe(5);
    expect(r[r.length - 2].horas).toBe(2);
    expect(r[0].horas).toBe(0);
  });

  it("el rango de cada semana es de lunes a domingo", () => {
    const [primera] = porSemanas([], "2026-07-29", 1);
    expect(primera.desde).toBe("2026-07-27");
    expect(primera.hasta).toBe("2026-08-02");
  });
});

describe("porMeses", () => {
  const filas = [
    { fecha: "2026-07-29", horas: 5 },
    { fecha: "2026-07-01", horas: 1 },
    { fecha: "2026-06-15", horas: 3 },
  ];

  it("devuelve n meses, del más antiguo al más reciente", () => {
    const r = porMeses(filas, "2026-07-29", 3);
    expect(r.map((m) => m.clave)).toEqual(["2026-05", "2026-06", "2026-07"]);
  });

  it("suma por mes natural", () => {
    const r = porMeses(filas, "2026-07-29", 3);
    expect(r[2].horas).toBe(6);
    expect(r[1].horas).toBe(3);
    expect(r[0].horas).toBe(0);
  });

  it("cruza el cambio de año hacia atrás", () => {
    const r = porMeses([], "2027-01-15", 3);
    expect(r.map((m) => m.clave)).toEqual(["2026-11", "2026-12", "2027-01"]);
  });
});
