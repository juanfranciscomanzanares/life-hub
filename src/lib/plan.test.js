import { describe, it, expect } from "vitest";
import {
  transporteMensual,
  totalIngresos,
  totalGastos,
  capacidadAhorro,
  objetivoColchon,
  mesesDeCobertura,
  mesesHastaObjetivo,
  reparto,
  proyectar,
  SEMANAS_MES,
} from "./plan";

/*
  Los números de los tests son los del plan real de julio de 2026: 14,60 € por
  día de ir a la oficina (50 €/semana de gasolina en 5 días más 100 €/mes de
  peajes), 300 € de prácticas y los fijos del piso de Murcia.
*/
const VERANO = {
  ingresos: [{ concepto: "Prácticas", monto: 300 }],
  gastos: [
    { concepto: "Piso (media)", monto: 162.5 },
    { concepto: "Gimnasio", monto: 25 },
    { concepto: "Claude Pro", monto: 22 },
  ],
  transporte: { costeDia: 14.6, diasPresenciales: 5 },
};

describe("transporteMensual", () => {
  it("cuenta 52/12 semanas por mes, no 4", () => {
    expect(SEMANAS_MES).toBeCloseTo(4.3333, 3);
    // 14,60 x 5 x 4,3333 = 316,33
    expect(transporteMensual({ costeDia: 14.6, diasPresenciales: 5 })).toBe(316.33);
  });

  it("teletrabajar baja el coste de forma proporcional", () => {
    const cinco = transporteMensual({ costeDia: 14.6, diasPresenciales: 5 });
    const tres = transporteMensual({ costeDia: 14.6, diasPresenciales: 3 });
    expect(tres).toBe(189.8);
    expect(tres).toBeLessThan(cinco);
  });

  it("sin días presenciales no hay gasto (trabajo online)", () => {
    expect(transporteMensual({ costeDia: 14.6, diasPresenciales: 0 })).toBe(0);
    expect(transporteMensual({})).toBe(0);
    expect(transporteMensual()).toBe(0);
  });
});

describe("totales de un régimen", () => {
  it("suma ingresos", () => {
    expect(totalIngresos(VERANO)).toBe(300);
  });

  it("los gastos incluyen el transporte calculado", () => {
    // 162,5 + 25 + 22 = 209,5 fijos, más 316,33 de transporte
    expect(totalGastos(VERANO)).toBe(525.83);
  });

  it("el verano yendo 5 días sale en negativo: pagas por ir a trabajar", () => {
    expect(capacidadAhorro(VERANO)).toBe(-225.83);
  });

  it("con 3 días presenciales el mismo régimen casi se sostiene", () => {
    const conTeletrabajo = { ...VERANO, transporte: { costeDia: 14.6, diasPresenciales: 3 } };
    expect(capacidadAhorro(conTeletrabajo)).toBe(-99.3);
  });

  it("un régimen vacío no rompe", () => {
    expect(totalIngresos({})).toBe(0);
    expect(totalGastos(undefined)).toBe(0);
    expect(capacidadAhorro({})).toBe(0);
  });
});

describe("colchón de emergencia", () => {
  it("el objetivo son N meses de gastos", () => {
    expect(objetivoColchon(567, 3)).toBe(1701);
  });

  it("la cobertura se mide en meses, no en euros", () => {
    expect(mesesDeCobertura(1701, 567)).toBe(3);
    expect(mesesDeCobertura(220, 567)).toBe(0.39);
  });

  it("sin gastos declarados la cobertura es 0 y no infinito", () => {
    expect(mesesDeCobertura(500, 0)).toBe(0);
  });

  it("calcula los meses que faltan para llenarlo", () => {
    expect(mesesHastaObjetivo(220, 1700, 500)).toBe(3);
  });

  it("si ya está lleno devuelve 0", () => {
    expect(mesesHastaObjetivo(2000, 1700, 500)).toBe(0);
  });

  it("sin capacidad de ahorro devuelve null en vez de infinito", () => {
    expect(mesesHastaObjetivo(220, 1700, 0)).toBe(null);
    expect(mesesHastaObjetivo(220, 1700, -225)).toBe(null);
  });
});

describe("reparto entre plazos", () => {
  it("parte el excedente según el porcentaje de largo plazo", () => {
    expect(reparto(500, 60)).toEqual({ largo: 300, medio: 200 });
  });

  it("no reparte nada si no sobra nada", () => {
    expect(reparto(-100, 60)).toEqual({ largo: 0, medio: 0 });
  });

  it("los extremos van todos a una bolsa", () => {
    expect(reparto(500, 100)).toEqual({ largo: 500, medio: 0 });
    expect(reparto(500, 0)).toEqual({ largo: 0, medio: 500 });
  });

  it("las dos bolsas siempre suman el total", () => {
    const { largo, medio } = reparto(333.33, 60);
    expect(redondeo(largo + medio)).toBe(333.33);
  });
});

const redondeo = (n) => Math.round(n * 100) / 100;

describe("proyectar", () => {
  it("300 al mes durante 40 años al 7% se acercan a 800.000", () => {
    const { nominal } = proyectar({ aportacionMensual: 300, años: 40, rentabilidadAnual: 7 });
    expect(nominal).toBeGreaterThan(750000);
    expect(nominal).toBeLessThan(820000);
  });

  it("la cifra real descuenta la inflación y es mucho menor", () => {
    const { nominal, real } = proyectar({
      aportacionMensual: 300,
      años: 40,
      rentabilidadAnual: 7,
      inflacionAnual: 2.5,
    });
    expect(real).toBeLessThan(nominal / 2);
    expect(real).toBeGreaterThan(250000);
  });

  it("aportado e interés cuadran con el nominal", () => {
    const { aportado, interes, nominal } = proyectar({
      aportacionMensual: 300,
      años: 40,
      rentabilidadAnual: 7,
    });
    expect(aportado).toBe(144000);
    expect(redondeo(aportado + interes)).toBe(nominal);
  });

  it("sin rentabilidad es una simple suma de aportaciones", () => {
    const { nominal, aportado } = proyectar({
      aportacionMensual: 100,
      años: 10,
      rentabilidadAnual: 0,
      inflacionAnual: 0,
    });
    expect(nominal).toBe(12000);
    expect(aportado).toBe(12000);
  });

  it("sin aportación o sin plazo no inventa dinero", () => {
    expect(proyectar({ aportacionMensual: 0, años: 40 }).nominal).toBe(0);
    expect(proyectar({ aportacionMensual: 300, años: 0 }).nominal).toBe(0);
    expect(proyectar().nominal).toBe(0);
  });

  it("empezar antes pesa más que aportar más: 40 años a 300 baten 25 a 500", () => {
    const pronto = proyectar({ aportacionMensual: 300, años: 40, rentabilidadAnual: 7 });
    const tarde = proyectar({ aportacionMensual: 500, años: 25, rentabilidadAnual: 7 });
    expect(pronto.nominal).toBeGreaterThan(tarde.nominal);
  });
});
