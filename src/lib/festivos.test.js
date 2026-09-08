import { describe, it, expect } from "vitest";
import {
  REGION_POR_DEFECTO,
  CACHE_MS,
  urlFestivos,
  normalizarFestivos,
  festivoDe,
  esFestivo,
  aniosNecesarios,
  entradaValida,
} from "./festivos";

/* Entradas con la forma real de Nager.Date, copiadas de la respuesta de 2026. */
const RESPUESTA = [
  {
    date: "2026-01-01",
    localName: "Año Nuevo",
    name: "New Year's Day",
    global: true,
    counties: null,
    types: ["Public"],
  },
  {
    date: "2026-02-28",
    localName: "Día de Andalucía",
    name: "Day of Andalucía",
    global: false,
    counties: ["ES-AN"],
    types: ["Public"],
  },
  {
    date: "2026-04-02",
    localName: "Jueves Santo",
    name: "Maundy Thursday",
    global: false,
    counties: ["ES-AN", "ES-AR", "ES-CL", "ES-MC"],
    types: ["Public"],
  },
  {
    date: "2026-06-09",
    localName: "Día de la Región de Murcia",
    name: "Day of the Region of Murcia",
    global: false,
    counties: ["ES-MC"],
    types: ["Public"],
  },
];

describe("urlFestivos", () => {
  it("apunta al año y al país", () => {
    expect(urlFestivos(2026)).toBe("https://date.nager.at/api/v3/PublicHolidays/2026/ES");
    expect(urlFestivos(2027, "PT")).toContain("/2027/PT");
  });
});

describe("normalizarFestivos", () => {
  it("se queda con los nacionales y con los de tu comunidad", () => {
    const f = normalizarFestivos(RESPUESTA, "ES-MC");
    expect(f.map((x) => x.fecha)).toEqual(["2026-01-01", "2026-04-02", "2026-06-09"]);
  });

  it("descarta los de otras comunidades", () => {
    /*
      El 28 de febrero es el Día de Andalucía: festivo allí, día normal aquí.
      Sin filtrar por región el calendario diría que en Murcia no se trabaja.
    */
    const f = normalizarFestivos(RESPUESTA, "ES-MC");
    expect(esFestivo(f, "2026-02-28")).toBe(false);
    expect(esFestivo(normalizarFestivos(RESPUESTA, "ES-AN"), "2026-02-28")).toBe(true);
  });

  it("usa el nombre en español, no el inglés", () => {
    expect(festivoDe(normalizarFestivos(RESPUESTA), "2026-01-01").titulo).toBe("Año Nuevo");
  });

  it("distingue el ámbito nacional del autonómico", () => {
    const f = normalizarFestivos(RESPUESTA, "ES-MC");
    expect(festivoDe(f, "2026-01-01").ambito).toBe("nacional");
    expect(festivoDe(f, "2026-06-09").ambito).toBe("regional");
  });

  it("por defecto, Región de Murcia", () => {
    expect(REGION_POR_DEFECTO).toBe("ES-MC");
    expect(esFestivo(normalizarFestivos(RESPUESTA), "2026-06-09")).toBe(true);
  });

  it("deja fuera lo que no es festivo de verdad", () => {
    const conmemoracion = [
      { date: "2026-03-19", localName: "San José", global: true, types: ["Observance"] },
    ];
    expect(normalizarFestivos(conmemoracion)).toEqual([]);
  });

  it("si Nager no manda `types`, no se descarta nada", () => {
    // Filtrar a ciegas por un campo ausente nos dejaría sin ningún festivo.
    const sinTipos = [{ date: "2026-01-01", localName: "Año Nuevo", global: true }];
    expect(normalizarFestivos(sinTipos)).toHaveLength(1);
  });

  it("aguanta basura", () => {
    expect(normalizarFestivos(null)).toEqual([]);
    expect(normalizarFestivos([{ localName: "Sin fecha" }])).toEqual([]);
  });

  it("los devuelve ordenados por fecha", () => {
    const desordenados = [RESPUESTA[3], RESPUESTA[0]];
    expect(normalizarFestivos(desordenados).map((f) => f.fecha)).toEqual([
      "2026-01-01",
      "2026-06-09",
    ]);
  });
});

describe("festivoDe", () => {
  const f = normalizarFestivos(RESPUESTA, "ES-MC");

  it("encuentra el día", () => {
    expect(festivoDe(f, "2026-06-09").titulo).toBe("Día de la Región de Murcia");
  });

  it("acepta una fecha con hora pegada detrás", () => {
    expect(festivoDe(f, "2026-06-09T00:00")?.titulo).toBe("Día de la Región de Murcia");
  });

  it("devuelve null si no hay nada", () => {
    expect(festivoDe(f, "2026-07-01")).toBe(null);
    expect(festivoDe(null, "2026-06-09")).toBe(null);
  });
});

describe("aniosNecesarios", () => {
  it("pide también el año de antes y el de después", () => {
    /*
      La rejilla de enero empieza en el lunes anterior, que puede caer en
      diciembre del año pasado; la de diciembre termina en enero del siguiente.
      Con un solo año, esos días saldrían sin festivo.
    */
    expect(aniosNecesarios(2026)).toEqual([2025, 2026, 2027]);
  });

  it("aguanta basura", () => {
    expect(aniosNecesarios("no")).toEqual([]);
  });
});

describe("entradaValida", () => {
  const entrada = { pedidoEn: 1_000_000, region: "ES-MC", dias: [] };

  it("vale si es reciente y de la misma región", () => {
    expect(entradaValida(entrada, { region: "ES-MC", ahora: 1_000_000 + 1000 })).toBe(true);
  });

  it("caduca al mes", () => {
    expect(entradaValida(entrada, { region: "ES-MC", ahora: 1_000_000 + CACHE_MS + 1 })).toBe(false);
  });

  it("no vale la de otra región", () => {
    // Si te mudas y cambias la comunidad, lo guardado ya no te sirve.
    expect(entradaValida(entrada, { region: "ES-AN", ahora: 1_000_000 })).toBe(false);
  });

  it("no vale vacía", () => {
    expect(entradaValida(undefined, { region: "ES-MC" })).toBe(false);
    expect(entradaValida({ pedidoEn: 1_000_000, region: "ES-MC" }, { region: "ES-MC" })).toBe(false);
  });
});
