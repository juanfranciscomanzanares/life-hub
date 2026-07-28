import { describe, it, expect } from "vitest";
import {
  normalizarTexto,
  categorizar,
  limpiarConcepto,
  aMovimientoFinanzas,
  separarNuevos,
  resumen,
  REGLAS_POR_DEFECTO,
} from "./banco";

const mov = (extra = {}) => ({
  refBanco: "tx-1",
  fecha: "2026-07-20",
  concepto: "PAGO TARJETA 4567 MERCADONA SA",
  contraparte: "",
  monto: -48.3,
  ...extra,
});

describe("normalizarTexto", () => {
  it("quita acentos y pasa a minúsculas", () => {
    expect(normalizarTexto("FARMÁCIA")).toBe("farmacia");
    expect(normalizarTexto("Café")).toBe("cafe");
  });

  it("la ñ también pierde la virgulilla, y da igual", () => {
    /*
      NFD descompone la ñ igual que una vocal acentuada, así que acaba como "n".
      No se corrige a propósito: esta función solo sirve para COMPARAR, y se
      aplica tanto al texto del banco como al de la regla, así que ambos lados
      quedan igual y la coincidencia sigue siendo correcta. Nunca se enseña al
      usuario.
    */
    expect(normalizarTexto("Ñoño")).toBe("nono");
    expect(normalizarTexto("PEÑA").includes(normalizarTexto("peña"))).toBe(true);
  });

  it("colapsa los espacios", () => {
    expect(normalizarTexto("  PAGO   TARJETA  ")).toBe("pago tarjeta");
  });

  it("no revienta con entradas vacías", () => {
    expect(normalizarTexto()).toBe("");
    expect(normalizarTexto(null)).toBe("null"); // String(null), pero no lanza
  });
});

describe("categorizar", () => {
  it("clasifica por el comercio del concepto", () => {
    expect(categorizar(mov())).toBe("Comida");
    expect(categorizar(mov({ concepto: "RECIBO NETFLIX" }))).toBe("Suscripciones");
    expect(categorizar(mov({ concepto: "COMPRA DECATHLON" }))).toBe("Deporte");
  });

  it("un importe positivo es ingreso, diga lo que diga el concepto", () => {
    // Importante: si no, una devolución de Mercadona entraría como gasto de comida.
    expect(categorizar(mov({ monto: 450, concepto: "TRANSFERENCIA MERCADONA" }))).toBe("Ingreso");
  });

  it("lo que no encaja en ninguna regla va a Otros", () => {
    expect(categorizar(mov({ concepto: "COMERCIO DESCONOCIDO XYZ" }))).toBe("Otros");
  });

  it("encuentra el comercio aunque el banco escriba con acentos", () => {
    expect(categorizar(mov({ concepto: "FARMÁCIA CENTRAL" }))).toBe("Salud");
  });

  it("también mira la contraparte, no solo el concepto", () => {
    expect(categorizar(mov({ concepto: "COMPRA", contraparte: "IBERDROLA" }))).toBe("Vivienda");
  });

  it("acepta reglas propias del usuario", () => {
    const mias = [{ texto: "el rincon", categoria: "Ocio" }];
    expect(categorizar(mov({ concepto: "BAR EL RINCON" }), mias)).toBe("Ocio");
  });

  it("no hay reglas duplicadas que se pisen entre sí", () => {
    const vistos = new Set();
    const duplicados = REGLAS_POR_DEFECTO.filter((r) => {
      if (vistos.has(r.texto)) return true;
      vistos.add(r.texto);
      return false;
    });
    expect(duplicados).toEqual([]);
  });
});

describe("limpiarConcepto", () => {
  it("quita el prefijo del banco y el número de tarjeta", () => {
    expect(limpiarConcepto("PAGO TARJETA 4567 MERCADONA SA")).toBe("MERCADONA SA");
    expect(limpiarConcepto("COMPRA DECATHLON")).toBe("DECATHLON");
    expect(limpiarConcepto("Bizum A JUAN")).toBe("A JUAN");
  });

  it("deja intacto lo que no lleva prefijo", () => {
    expect(limpiarConcepto("NOMINA JULIO")).toBe("NOMINA JULIO");
  });
});

describe("separarNuevos (no duplicar al reimportar)", () => {
  it("reconoce por referencia del banco lo ya importado", () => {
    const existentes = [aMovimientoFinanzas(mov(), REGLAS_POR_DEFECTO)];
    const { nuevos, yaEstaban } = separarNuevos([mov()], existentes, REGLAS_POR_DEFECTO);

    expect(nuevos).toHaveLength(0);
    expect(yaEstaban).toHaveLength(1);
  });

  it("importar dos veces seguidas no duplica nada", () => {
    const movimientos = [mov(), mov({ refBanco: "tx-2", concepto: "NETFLIX", monto: -12.99 })];
    const primera = separarNuevos(movimientos, [], REGLAS_POR_DEFECTO);
    expect(primera.nuevos).toHaveLength(2);

    const segunda = separarNuevos(movimientos, primera.nuevos, REGLAS_POR_DEFECTO);
    expect(segunda.nuevos).toHaveLength(0);
  });

  it("detecta también lo que ya habías apuntado a mano, sin referencia del banco", () => {
    // Misma fecha, mismo importe y mismo concepto: es el mismo gasto.
    const aMano = [{ id: 9, fecha: "2026-07-20", concepto: "MERCADONA SA", categoria: "Comida", monto: -48.3 }];
    const { nuevos } = separarNuevos([mov()], aMano, REGLAS_POR_DEFECTO);
    expect(nuevos).toHaveLength(0);
  });

  it("no confunde dos compras distintas del mismo día", () => {
    const dos = [
      mov({ refBanco: "a", concepto: "MERCADONA", monto: -20 }),
      mov({ refBanco: "b", concepto: "DECATHLON", monto: -35 }),
    ];
    expect(separarNuevos(dos, [], REGLAS_POR_DEFECTO).nuevos).toHaveLength(2);
  });
});

describe("resumen", () => {
  it("separa ingresos de gastos y agrupa por categoría", () => {
    const filas = [
      { fecha: "2026-07-01", concepto: "Nómina", categoria: "Ingreso", monto: 1200 },
      { fecha: "2026-07-02", concepto: "Mercadona", categoria: "Comida", monto: -48 },
      { fecha: "2026-07-03", concepto: "Lidl", categoria: "Comida", monto: -22 },
    ];
    const r = resumen(filas);

    expect(r.total).toBe(3);
    expect(r.ingresos).toBe(1200);
    expect(r.gastos).toBe(-70);
    expect(r.porCategoria.Comida).toBe(-70);
  });

  it("una lista vacía no rompe nada", () => {
    expect(resumen([])).toMatchObject({ total: 0, ingresos: 0, gastos: 0 });
  });
});
