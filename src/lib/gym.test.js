import { describe, it, expect } from "vitest";
import {
  setsDe,
  normalizarFila,
  volumen,
  mejorSerie,
  unaRM,
  mejorUnaRM,
  recordsPorEjercicio,
  evolucion,
  volumenDelDia,
  fechasEntrenadas,
  nuevoId,
  grupoDe,
} from "./gym";

// Fila del formato ANTIGUO: series era un número y las cuatro eran idénticas.
const filaVieja = { id: 1, fecha: "2026-07-01", ejercicio: "Press banca", peso: 70, series: 4, reps: 8 };

// Fila del formato NUEVO: cada serie con su propio peso y repeticiones.
const filaNueva = {
  id: 2,
  fecha: "2026-07-08",
  ejercicio: "Press banca",
  sets: [
    { id: 1, peso: 72.5, reps: 8 },
    { id: 2, peso: 72.5, reps: 7 },
    { id: 3, peso: 75, reps: 5 },
  ],
};

describe("compatibilidad con el formato antiguo", () => {
  it("convierte series numéricas en esa cantidad de series iguales", () => {
    const sets = setsDe(filaVieja);
    expect(sets).toHaveLength(4);
    expect(sets.every((s) => s.peso === 70 && s.reps === 8)).toBe(true);
  });

  it("deja intactas las filas que ya tienen sets", () => {
    expect(setsDe(filaNueva)).toBe(filaNueva.sets);
  });

  it("una fila con peso pero sin número de series cuenta como una serie", () => {
    expect(setsDe({ peso: 50, reps: 10 })).toHaveLength(1);
  });

  it("una fila vacía no inventa series", () => {
    expect(setsDe({ ejercicio: "Plancha" })).toEqual([]);
    expect(setsDe(null)).toEqual([]);
  });

  it("normalizarFila es idempotente y quita los campos antiguos", () => {
    const una = normalizarFila(filaVieja);
    expect(una.sets).toHaveLength(4);
    expect(una).not.toHaveProperty("series");
    expect(una).not.toHaveProperty("peso");
    expect(normalizarFila(una)).toBe(una);
  });
});

describe("cálculos de una sesión", () => {
  it("el volumen suma peso x reps de cada serie", () => {
    // 72.5*8 + 72.5*7 + 75*5 = 580 + 507.5 + 375
    expect(volumen(filaNueva.sets)).toBeCloseTo(1462.5);
  });

  it("el volumen de una lista vacía es cero", () => {
    expect(volumen([])).toBe(0);
    expect(volumen()).toBe(0);
  });

  it("la mejor serie es la más pesada", () => {
    expect(mejorSerie(filaNueva.sets)).toMatchObject({ peso: 75, reps: 5 });
  });

  it("a igual peso gana la de más repeticiones", () => {
    const sets = [
      { peso: 80, reps: 5 },
      { peso: 80, reps: 9 },
      { peso: 80, reps: 6 },
    ];
    expect(mejorSerie(sets).reps).toBe(9);
  });

  it("mejorSerie de una lista vacía es null", () => {
    expect(mejorSerie([])).toBe(null);
  });

  it("calcula el 1RM con la fórmula de Epley", () => {
    expect(unaRM(100, 0)).toBe(100); // una repetición máxima ya es el 1RM
    expect(unaRM(100, 10)).toBeCloseTo(133.33, 1);
  });

  it("el mejor 1RM sale de la serie que más fuerza demuestra, no de la más pesada", () => {
    /*
      Las series son 72,5x8 / 72,5x7 / 75x5. La más PESADA es la de 75 kg, pero
      su 1RM estimado es 75 * (1 + 5/30) = 87,5. La de 72,5x8 da
      72,5 * (1 + 8/30) = 91,8, o sea más fuerza. Por eso mejorUnaRM recorre
      todas las series en vez de mirar solo la de más peso.
    */
    expect(mejorUnaRM(filaNueva.sets)).toBeCloseTo(91.83, 1);
    expect(mejorSerie(filaNueva.sets).peso).toBe(75); // la más pesada es otra
  });
});

describe("récords por ejercicio", () => {
  const filas = [
    filaVieja,
    filaNueva,
    { id: 3, fecha: "2026-07-02", ejercicio: "Sentadilla", sets: [{ peso: 100, reps: 5 }] },
    { id: 4, fecha: "2026-07-09", ejercicio: "Plancha", sets: [] }, // sin peso: se ignora
  ];

  it("guarda el mejor peso de cada ejercicio y cuándo se hizo", () => {
    const records = Object.fromEntries(recordsPorEjercicio(filas));
    expect(records["Press banca"]).toMatchObject({ peso: 75, reps: 5, fecha: "2026-07-08" });
    expect(records["Sentadilla"].peso).toBe(100);
  });

  it("descarta los ejercicios sin peso", () => {
    const nombres = recordsPorEjercicio(filas).map(([n]) => n);
    expect(nombres).not.toContain("Plancha");
  });

  it("ordena de más peso a menos", () => {
    expect(recordsPorEjercicio(filas).map(([n]) => n)).toEqual(["Sentadilla", "Press banca"]);
  });
});

describe("evolución y volumen", () => {
  const filas = [filaNueva, filaVieja]; // a propósito en desorden

  it("ordena por fecha y toma el mejor peso de cada día", () => {
    const puntos = evolucion(filas, "Press banca");
    expect(puntos.map((p) => p.fecha)).toEqual(["2026-07-01", "2026-07-08"]);
    expect(puntos[0].peso).toBe(70);
    expect(puntos[1].peso).toBe(75);
  });

  it("incluye volumen y número de series de cada día", () => {
    const [primero] = evolucion(filas, "Press banca");
    expect(primero.series).toBe(4);
    expect(primero.volumen).toBe(70 * 8 * 4);
  });

  it("no devuelve nada para un ejercicio sin registros", () => {
    expect(evolucion(filas, "Dominadas")).toEqual([]);
  });

  it("suma el volumen de todos los ejercicios de un mismo día", () => {
    const mismoDia = [
      { fecha: "2026-07-01", ejercicio: "A", sets: [{ peso: 10, reps: 10 }] },
      { fecha: "2026-07-01", ejercicio: "B", sets: [{ peso: 20, reps: 5 }] },
      { fecha: "2026-07-02", ejercicio: "C", sets: [{ peso: 99, reps: 9 }] },
    ];
    expect(volumenDelDia(mismoDia, "2026-07-01")).toBe(200);
  });

  it("lista las fechas entrenadas sin repetir y de más nueva a más vieja", () => {
    expect(fechasEntrenadas(filas)).toEqual(["2026-07-08", "2026-07-01"]);
  });
});

describe("utilidades", () => {
  it("genera ids distintos aunque se pidan en el mismo milisegundo", () => {
    const ids = Array.from({ length: 50 }, nuevoId);
    expect(new Set(ids).size).toBe(50);
  });

  it("encuentra el grupo muscular de un ejercicio", () => {
    expect(grupoDe("Sentadilla")).toBe("Piernas");
    expect(grupoDe("Press banca")).toBe("Pecho");
    expect(grupoDe("Ejercicio inventado")).toBe("Otro");
  });
});
