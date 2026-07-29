import { describe, it, expect } from "vitest";
import {
  rangoDe,
  mover,
  enRango,
  tramosDe,
  metricas,
  serie,
  metasConseguidas,
  variacion,
  lunesDe,
  aISO,
} from "./analitica";

// Miércoles 29 de julio de 2026.
const MIERCOLES = "2026-07-29";

describe("rangos de cada periodo", () => {
  it("la semana va de lunes a domingo", () => {
    expect(rangoDe("semana", MIERCOLES)).toMatchObject({
      desde: "2026-07-27",
      hasta: "2026-08-02",
    });
  });

  it("el domingo pertenece a la semana que acaba, no a la que empieza", () => {
    // getDay() da 0 el domingo; sin corregirlo, el domingo saltaba a la semana
    // siguiente y sus datos se contaban en el periodo equivocado.
    expect(aISO(lunesDe("2026-08-02"))).toBe("2026-07-27");
    expect(aISO(lunesDe("2026-08-03"))).toBe("2026-08-03"); // ese sí es lunes
  });

  it("el mes cubre hasta su último día, sea cual sea", () => {
    expect(rangoDe("mes", MIERCOLES)).toMatchObject({ desde: "2026-07-01", hasta: "2026-07-31" });
    expect(rangoDe("mes", "2026-02-10").hasta).toBe("2026-02-28");
    expect(rangoDe("mes", "2028-02-10").hasta).toBe("2028-02-29"); // bisiesto
  });

  it("el trimestre agrupa de tres en tres", () => {
    expect(rangoDe("trimestre", MIERCOLES)).toMatchObject({
      desde: "2026-07-01",
      hasta: "2026-09-30",
      etiqueta: "T3 2026",
    });
    expect(rangoDe("trimestre", "2026-01-15").desde).toBe("2026-01-01");
  });

  it("el año va de enero a diciembre", () => {
    expect(rangoDe("anio", MIERCOLES)).toMatchObject({ desde: "2026-01-01", hasta: "2026-12-31" });
  });
});

describe("moverse entre periodos", () => {
  it("retrocede y avanza un periodo entero", () => {
    expect(rangoDe("semana", mover("semana", MIERCOLES, -1)).desde).toBe("2026-07-20");
    expect(rangoDe("mes", mover("mes", MIERCOLES, -1)).desde).toBe("2026-06-01");
    expect(rangoDe("trimestre", mover("trimestre", MIERCOLES, -1)).desde).toBe("2026-04-01");
    expect(rangoDe("anio", mover("anio", MIERCOLES, 1)).desde).toBe("2027-01-01");
  });

  it("cambiar de mes no se sale por el día 31", () => {
    // Del 31 de marzo hacia atrás no existe el 31 de febrero; lo que importa es
    // que el mes resultante sea el correcto.
    expect(rangoDe("mes", mover("mes", "2026-03-31", -1)).desde).toBe("2026-02-01");
  });
});

describe("enRango", () => {
  const r = rangoDe("mes", MIERCOLES);

  it("incluye los extremos", () => {
    expect(enRango("2026-07-01", r)).toBe(true);
    expect(enRango("2026-07-31", r)).toBe(true);
  });

  it("deja fuera lo de al lado", () => {
    expect(enRango("2026-06-30", r)).toBe(false);
    expect(enRango("2026-08-01", r)).toBe(false);
  });

  it("aguanta fechas con hora o vacías", () => {
    expect(enRango("2026-07-15T18:00:00Z", r)).toBe(true);
    expect(enRango("", r)).toBe(false);
    expect(enRango(undefined, r)).toBe(false);
  });
});

describe("tramos del gráfico", () => {
  it("la semana son 7 días", () => {
    const t = tramosDe("semana", rangoDe("semana", MIERCOLES));
    expect(t).toHaveLength(7);
    expect(t[0].etiqueta).toBe("L");
    expect(t.at(-1).etiqueta).toBe("D");
  });

  it("el mes son sus días", () => {
    expect(tramosDe("mes", rangoDe("mes", MIERCOLES))).toHaveLength(31);
    expect(tramosDe("mes", rangoDe("mes", "2026-02-01"))).toHaveLength(28);
  });

  it("el trimestre son 3 meses y el año 12", () => {
    expect(tramosDe("trimestre", rangoDe("trimestre", MIERCOLES)).map((t) => t.etiqueta)).toEqual([
      "Jul",
      "Ago",
      "Sep",
    ]);
    expect(tramosDe("anio", rangoDe("anio", MIERCOLES))).toHaveLength(12);
  });
});

describe("métricas", () => {
  const datos = {
    trabajo: [
      { fecha: "2026-07-28", horas: 6 },
      { fecha: "2026-07-29", horas: 2.5 },
      { fecha: "2026-06-15", horas: 8 }, // fuera del rango
    ],
    gym: [
      // Tres filas, dos días: una sesión son varias filas (una por ejercicio).
      { fecha: "2026-07-27", ejercicio: "Press banca" },
      { fecha: "2026-07-27", ejercicio: "Dominadas" },
      { fecha: "2026-07-29", ejercicio: "Sentadilla" },
    ],
    tenisSesiones: [
      { fecha: "2026-07-28", horas: 1.5, tipo: "Entreno" },
      { fecha: "2026-07-30", horas: 2, tipo: "Partido" },
    ],
    tenisPartidos: [{ fecha: "2026-07-29" }, { fecha: "2026-05-01" }],
    estudio: [{ fecha: "2026-07-29", horas: 3 }],
    aportaciones: [{ fecha: "2026-07-28", monto: 200 }],
    finanzas: [
      { fecha: "2026-07-28", monto: -45.5 },
      { fecha: "2026-07-29", monto: 1200 },
    ],
  };
  const m = metricas(datos, rangoDe("semana", MIERCOLES));

  it("suma horas de trabajo, tenis y estudio solo del rango", () => {
    expect(m.horasTrabajo).toBe(8.5);
    expect(m.horasTenis).toBe(3.5);
    expect(m.horasEstudio).toBe(3);
  });

  it("cuenta días de gimnasio, no filas", () => {
    expect(m.diasGym).toBe(2);
  });

  it("los partidos suman los oficiales y los apuntados como partido", () => {
    expect(m.partidosOficiales).toBe(1);
    expect(m.partidos).toBe(2);
    expect(m.entrenosTenis).toBe(1);
  });

  it("separa ingresos de gastos y suma lo invertido", () => {
    expect(m.invertido).toBe(200);
    expect(m.gastos).toBe(45.5);
    expect(m.ingresos).toBe(1200);
  });

  it("sin datos da ceros y no revienta", () => {
    const vacio = metricas({}, rangoDe("mes", MIERCOLES));
    expect(vacio.horasTrabajo).toBe(0);
    expect(vacio.diasGym).toBe(0);
    expect(vacio.partidos).toBe(0);
  });

  it("la serie reparte la métrica por tramos", () => {
    const tramos = tramosDe("semana", rangoDe("semana", MIERCOLES));
    const s = serie(datos, tramos, "horasTrabajo");
    expect(s).toHaveLength(7);
    expect(s.map((x) => x.valor)).toEqual([0, 6, 2.5, 0, 0, 0, 0]);
  });
});

describe("metas y variación", () => {
  it("cuenta las metas alcanzadas", () => {
    const metas = [
      { titulo: "Invertir", objetivo: 2000, actual: 2000 },
      { titulo: "Gym", objetivo: 4, actual: 5 },
      { titulo: "Nota", objetivo: 8, actual: 7.4 },
      { titulo: "Sin objetivo", objetivo: 0, actual: 3 },
    ];
    expect(metasConseguidas(metas)).toMatchObject({ cumplidas: 2, total: 4 });
  });

  it("la variación es null si no hay con qué comparar", () => {
    // Un "+100%" saliendo de cero no significa nada.
    expect(variacion(10, 0)).toBe(null);
    expect(variacion(10, 5)).toBe(100);
    expect(variacion(5, 10)).toBe(-50);
  });
});
