import { describe, it, expect } from "vitest";
import {
  lunesDe,
  horasPorDiaDeLaSemana,
  horasPorSemana,
  totalHoras,
  redondear,
  fmtHoras,
  repartoModalidad,
  diasEnOficina,
  kmTotales,
  filtrarMes,
  fmtKm,
} from "./trabajo";

// Miércoles 29/07/2026; el lunes de esa semana es el 27.
const HOY = "2026-07-29";

describe("lunesDe", () => {
  it("devuelve el lunes de la semana", () => {
    expect(lunesDe("2026-07-29")).toBe("2026-07-27");
  });

  it("un lunes se devuelve a sí mismo", () => {
    expect(lunesDe("2026-07-27")).toBe("2026-07-27");
  });

  it("un domingo pertenece a la semana que empieza el lunes anterior", () => {
    expect(lunesDe("2026-08-02")).toBe("2026-07-27");
  });

  it("con fecha inválida devuelve null en vez de romper", () => {
    expect(lunesDe("")).toBe(null);
    expect(lunesDe(undefined)).toBe(null);
  });
});

describe("horasPorDiaDeLaSemana", () => {
  const log = [
    { fecha: "2026-07-27", horas: 4 },
    { fecha: "2026-07-27", horas: 2.5 },
    { fecha: "2026-07-29", horas: 3 },
    { fecha: "2026-07-20", horas: 8 }, // semana anterior: no cuenta
  ];

  it("suma las horas de cada día de lunes a domingo", () => {
    const dias = horasPorDiaDeLaSemana(log, HOY);
    expect(dias).toHaveLength(7);
    expect(dias.map((d) => d.etiqueta)).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
    expect(dias[0].horas).toBe(6.5);
    expect(dias[2].horas).toBe(3);
  });

  it("deja a cero los días sin registros y no cuela otras semanas", () => {
    const dias = horasPorDiaDeLaSemana(log, HOY);
    expect(dias[1].horas).toBe(0);
    expect(dias.reduce((a, d) => a + d.horas, 0)).toBe(9.5);
  });

  it("marca el día de hoy", () => {
    const dias = horasPorDiaDeLaSemana(log, HOY);
    expect(dias.filter((d) => d.esHoy).map((d) => d.etiqueta)).toEqual(["Mié"]);
  });

  it("aguanta un registro sin horas o sin fecha", () => {
    const dias = horasPorDiaDeLaSemana([{ fecha: "2026-07-27" }, {}, null], HOY);
    expect(dias[0].horas).toBe(0);
  });
});

describe("horasPorSemana", () => {
  const log = [
    { fecha: "2026-07-29", horas: 3 }, // semana actual
    { fecha: "2026-07-22", horas: 5 }, // semana anterior
  ];

  it("devuelve las semanas pedidas, de la más antigua a la actual", () => {
    const semanas = horasPorSemana(log, HOY, 3);
    expect(semanas).toHaveLength(3);
    expect(semanas.map((s) => s.desde)).toEqual(["2026-07-13", "2026-07-20", "2026-07-27"]);
    expect(semanas.map((s) => s.horas)).toEqual([0, 5, 3]);
  });

  it("cada semana va de lunes a domingo", () => {
    const [semana] = horasPorSemana(log, HOY, 1);
    expect(semana.desde).toBe("2026-07-27");
    expect(semana.hasta).toBe("2026-08-02");
  });
});

describe("totalHoras y redondear", () => {
  it("suma el total sin arrastrar decimales raros", () => {
    expect(totalHoras([{ horas: 0.1 }, { horas: 0.2 }])).toBe(0.3);
  });

  it("redondea a dos decimales", () => {
    expect(redondear(199.10000000000002)).toBe(199.1);
    expect(redondear(undefined)).toBe(0);
  });
});

describe("fmtHoras", () => {
  it("usa coma decimal, que el panel está en español", () => {
    expect(fmtHoras(7.5)).toBe("7,5h");
    expect(fmtHoras(4)).toBe("4h");
  });

  it("sin valor devuelve 0h en vez de NaN", () => {
    expect(fmtHoras(undefined)).toBe("0h");
  });
});

describe("repartoModalidad", () => {
  it("separa las horas de oficina y de teletrabajo", () => {
    const r = repartoModalidad([
      { horas: 4, modalidad: "oficina" },
      { horas: 3, modalidad: "teletrabajo" },
      { horas: 2, modalidad: "oficina" },
    ]);
    expect(r.oficina).toBe(6);
    expect(r.teletrabajo).toBe(3);
    expect(r.pctOficina).toBe(67);
  });

  it("los registros sin modalidad quedan aparte y no alteran el porcentaje", () => {
    const r = repartoModalidad([
      { horas: 5, modalidad: "oficina" },
      { horas: 5, modalidad: "teletrabajo" },
      { horas: 90 }, // registro antiguo, sin clasificar
    ]);
    expect(r.sinIndicar).toBe(90);
    expect(r.total).toBe(100);
    expect(r.pctOficina).toBe(50);
  });

  it("sin horas clasificadas el porcentaje es null, no 0", () => {
    expect(repartoModalidad([{ horas: 3 }]).pctOficina).toBe(null);
    expect(repartoModalidad([]).pctOficina).toBe(null);
  });

  it("una modalidad desconocida no se cuela como oficina", () => {
    const r = repartoModalidad([{ horas: 2, modalidad: "hibrido" }]);
    expect(r.oficina).toBe(0);
    expect(r.sinIndicar).toBe(2);
  });
});

describe("diasEnOficina", () => {
  it("cuenta cada día una sola vez aunque tenga varias actividades", () => {
    const dias = diasEnOficina(
      [
        { fecha: "2026-07-27", horas: 4, modalidad: "oficina" },
        { fecha: "2026-07-27", horas: 3, modalidad: "oficina" },
        { fecha: "2026-07-28", horas: 8, modalidad: "oficina" },
      ],
      30
    );
    expect(dias).toHaveLength(2);
    expect(dias[0]).toMatchObject({ fecha: "2026-07-27", horas: 7, km: 30 });
    expect(kmTotales(
      [
        { fecha: "2026-07-27", horas: 4, modalidad: "oficina" },
        { fecha: "2026-07-27", horas: 3, modalidad: "oficina" },
      ],
      30
    )).toBe(30);
  });

  it("ignora el teletrabajo y los registros sin modalidad", () => {
    const dias = diasEnOficina(
      [
        { fecha: "2026-07-27", horas: 8, modalidad: "teletrabajo" },
        { fecha: "2026-07-28", horas: 8 },
      ],
      30
    );
    expect(dias).toEqual([]);
    expect(kmTotales([{ fecha: "2026-07-28", horas: 8 }], 30)).toBe(0);
  });

  it("los km declarados en un día ganan a la distancia habitual", () => {
    const dias = diasEnOficina(
      [
        { fecha: "2026-07-27", horas: 4, modalidad: "oficina", km: 12 },
        { fecha: "2026-07-27", horas: 4, modalidad: "oficina" },
        { fecha: "2026-07-28", horas: 8, modalidad: "oficina" },
      ],
      30
    );
    expect(dias.map((d) => d.km)).toEqual([12, 30]);
    expect(kmTotales(
      [
        { fecha: "2026-07-27", horas: 4, modalidad: "oficina", km: 12 },
        { fecha: "2026-07-28", horas: 8, modalidad: "oficina" },
      ],
      30
    )).toBe(42);
  });

  it("sin distancia configurada los días cuentan pero suman 0 km", () => {
    const dias = diasEnOficina([{ fecha: "2026-07-27", horas: 8, modalidad: "oficina" }], 0);
    expect(dias).toHaveLength(1);
    expect(dias[0].km).toBe(0);
  });

  it("devuelve los días ordenados por fecha", () => {
    const dias = diasEnOficina(
      [
        { fecha: "2026-07-29", horas: 1, modalidad: "oficina" },
        { fecha: "2026-07-27", horas: 1, modalidad: "oficina" },
      ],
      10
    );
    expect(dias.map((d) => d.fecha)).toEqual(["2026-07-27", "2026-07-29"]);
  });
});

describe("filtrarMes", () => {
  it("se queda solo con los registros del mes pedido", () => {
    const log = [{ fecha: "2026-07-29" }, { fecha: "2026-06-30" }, { fecha: "2026-07-01" }];
    expect(filtrarMes(log, "2026-07")).toHaveLength(2);
  });
});

describe("fmtKm", () => {
  it("usa coma decimal y una sola decimal", () => {
    expect(fmtKm(12.5)).toBe("12,5 km");
    expect(fmtKm(30)).toBe("30 km");
  });

  it("sin valor devuelve 0 km", () => {
    expect(fmtKm(undefined)).toBe("0 km");
  });
});
