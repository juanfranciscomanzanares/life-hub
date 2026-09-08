import { describe, it, expect } from "vitest";
import {
  LUGAR_POR_DEFECTO,
  CACHE_MS,
  interpretarCodigo,
  urlPrevision,
  parsearPrevision,
  diaDe,
  horaDe,
  cacheValida,
} from "./tiempo";

/* Una respuesta de Open-Meteo recortada, con la forma real: columnas paralelas. */
const RESPUESTA = {
  current: { temperature_2m: 31.4, weather_code: 0 },
  daily: {
    time: ["2026-08-04", "2026-08-05", "2026-08-08"],
    weather_code: [0, 3, 61],
    temperature_2m_max: [36.1, 33.8, 27.2],
    temperature_2m_min: [21.5, 20.9, 18.4],
    precipitation_probability_max: [0, 10, 80],
  },
  hourly: {
    time: ["2026-08-08T09:00", "2026-08-08T10:00", "2026-08-08T11:00"],
    temperature_2m: [20.1, 22.3, 24.0],
    weather_code: [3, 61, 61],
    precipitation_probability: [15, 75, 60],
  },
};

describe("interpretarCodigo", () => {
  it("traduce los códigos WMO a lenguaje de persona", () => {
    expect(interpretarCodigo(0).texto).toBe("Despejado");
    expect(interpretarCodigo(2).texto).toBe("Poco nuboso");
    expect(interpretarCodigo(3).texto).toBe("Nublado");
    expect(interpretarCodigo(61).texto).toBe("Lluvia");
    expect(interpretarCodigo(95).texto).toBe("Tormenta");
  });

  it("marca como mojado todo lo que cae del cielo", () => {
    // Es el campo que decide si se puede jugar al tenis o salir a correr.
    expect(interpretarCodigo(0).mojado).toBe(false);
    expect(interpretarCodigo(3).mojado).toBe(false);
    expect(interpretarCodigo(45).mojado).toBe(false); // niebla: molesta, pero no moja
    expect(interpretarCodigo(51).mojado).toBe(true);
    expect(interpretarCodigo(80).mojado).toBe(true);
    expect(interpretarCodigo(99).mojado).toBe(true);
  });

  it("no filtra el tope del tramo en el resultado", () => {
    // `hasta` es cosa de la tabla interna; asomaba en cada día de la previsión.
    expect(Object.keys(interpretarCodigo(3)).sort()).toEqual(["icono", "mojado", "texto"]);
  });

  it("no revienta con un código que no existe", () => {
    expect(interpretarCodigo(undefined).texto).toBe("Sin datos");
    expect(interpretarCodigo(null).texto).toBe("Sin datos");
    expect(interpretarCodigo(1234).texto).toBe("Sin datos");
    expect(interpretarCodigo(-1).texto).toBe("Sin datos");
  });
});

describe("urlPrevision", () => {
  it("pide la zona horaria del sitio, no UTC", () => {
    /*
      Sin `timezone=auto` las horas vienen en UTC y "el sábado a las 10" serían
      las 8 de la mañana. Es la misma trampa que ya costó cara en `desdeISO`.
    */
    expect(urlPrevision()).toContain("timezone=auto");
  });

  it("lleva las coordenadas del lugar", () => {
    const url = urlPrevision({ nombre: "Cartagena", lat: 37.6, lon: -0.98 });
    expect(url).toContain("latitude=37.6");
    expect(url).toContain("longitude=-0.98");
  });

  it("por defecto, Murcia", () => {
    expect(urlPrevision()).toContain(`latitude=${LUGAR_POR_DEFECTO.lat}`);
  });
});

describe("parsearPrevision", () => {
  it("empareja las columnas paralelas por posición", () => {
    const p = parsearPrevision(RESPUESTA);
    expect(p.dias).toHaveLength(3);
    expect(p.dias[0]).toMatchObject({ fecha: "2026-08-04", tmax: 36.1, tmin: 21.5, texto: "Despejado" });
    expect(p.dias[2]).toMatchObject({ fecha: "2026-08-08", lluvia: 80, texto: "Lluvia", mojado: true });
  });

  it("parte la marca de tiempo horaria en fecha y hora", () => {
    const p = parsearPrevision(RESPUESTA);
    expect(p.horas[1]).toMatchObject({ fecha: "2026-08-08", hora: "10:00", temp: 22.3 });
  });

  it("lee el tiempo de ahora mismo", () => {
    expect(parsearPrevision(RESPUESTA).ahora).toMatchObject({ temp: 31.4, texto: "Despejado" });
  });

  it("aguanta que falte una columna sin tirar la pantalla", () => {
    const p = parsearPrevision({ daily: { time: ["2026-08-04"], weather_code: [0] } });
    expect(p.dias[0]).toMatchObject({ fecha: "2026-08-04", tmax: null, tmin: null });
    expect(p.ahora).toBe(null);
    expect(p.horas).toEqual([]);
  });

  it("devuelve null si no hay nada que leer", () => {
    expect(parsearPrevision(null)).toBe(null);
    expect(parsearPrevision("vaya")).toBe(null);
  });
});

describe("diaDe / horaDe", () => {
  const p = parsearPrevision(RESPUESTA);

  it("encuentra el día pedido", () => {
    expect(diaDe(p, "2026-08-05").tmax).toBe(33.8);
    expect(diaDe(p, "2026-12-25")).toBe(null);
    expect(diaDe(null, "2026-08-05")).toBe(null);
  });

  it("contesta a si llueve el sábado a las 10", () => {
    expect(horaDe(p, "2026-08-08", "10:00")).toMatchObject({ lluvia: 75, mojado: true });
  });

  it("redondea la hora a la baja: las 10:30 caen en el tramo de las 10", () => {
    // Open-Meteo solo da horas en punto; pedir "10:30" no puede quedarse vacío.
    expect(horaDe(p, "2026-08-08", "10:30")?.hora).toBe("10:00");
  });

  it("devuelve null sin hora o fuera de la previsión", () => {
    expect(horaDe(p, "2026-08-08", "")).toBe(null);
    expect(horaDe(p, "2026-08-08", "23:00")).toBe(null);
  });
});

describe("cacheValida", () => {
  const lugar = { lat: 37.9922, lon: -1.1307 };
  const datos = parsearPrevision(RESPUESTA);
  const entrada = { pedidoEn: 1_000_000, lugar, datos };
  const opciones = { lugar, ahora: 1_000_000 + 60_000, hoy: "2026-08-04" };

  it("sirve si es reciente, del mismo sitio y empieza hoy", () => {
    expect(cacheValida(entrada, opciones)).toBe(true);
  });

  it("caduca pasada una hora", () => {
    expect(cacheValida(entrada, { ...opciones, ahora: 1_000_000 + CACHE_MS + 1 })).toBe(false);
  });

  it("no vale la previsión de otra ciudad", () => {
    expect(cacheValida(entrada, { ...opciones, lugar: { lat: 40.4, lon: -3.7 } })).toBe(false);
  });

  it("no vale si el primer día ya no es hoy", () => {
    /*
      El caso de las 00:10: una previsión guardada a las 23:50 tiene menos de una
      hora, pero su primer día es AYER, y Inicio enseñaría el tiempo de ayer.
    */
    expect(cacheValida(entrada, { ...opciones, hoy: "2026-08-05" })).toBe(false);
  });

  it("no vale vacía ni a medias", () => {
    expect(cacheValida(null, opciones)).toBe(false);
    expect(cacheValida({ pedidoEn: 1_000_000, lugar, datos: { dias: [] } }, opciones)).toBe(false);
  });
});
