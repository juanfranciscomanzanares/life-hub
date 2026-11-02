import { describe, it, expect } from "vitest";
import {
  PLAN_ID,
  RUTINAS_PLAN,
  SESIONES,
  semanaDelPlan,
  dentroDelPlan,
  faseDe,
  objetivoDe,
  notaObjetivo,
  rutinasParaGuardar,
  ejerciciosParaGuardar,
  rutinaSemanalParaGuardar,
  hitosDelPlan,
  eventosParaGuardar,
  registroPorSemana,
  evaluarCintura,
  mediaPesoSemana,
} from "./planFisico";
import { EJERCICIOS, setsDe, grupoDe } from "./gym";

const ej = (nombre) => RUTINAS_PLAN.flatMap((r) => r.ejercicios).find((e) => e.nombre === nombre);

describe("semanaDelPlan", () => {
  it("cuenta semanas desde el lunes de inicio", () => {
    expect(semanaDelPlan("2026-11-02", "2026-11-02")).toBe(1);
    expect(semanaDelPlan("2026-11-02", "2026-11-08")).toBe(1);
    expect(semanaDelPlan("2026-11-02", "2026-11-09")).toBe(2);
    expect(semanaDelPlan("2026-11-02", "2027-01-24")).toBe(12);
    expect(semanaDelPlan("2026-11-02", "2027-01-25")).toBe(13);
    expect(semanaDelPlan("2026-11-02", "2026-11-01")).toBe(0);
  });

  it("no se descuadra con el cambio de hora", () => {
    // El 28 de marzo de 2027 se adelanta la hora en España.
    expect(semanaDelPlan("2027-03-22", "2027-03-29")).toBe(2);
  });

  it("sabe si una semana está dentro de las 12", () => {
    expect(dentroDelPlan(1)).toBe(true);
    expect(dentroDelPlan(12)).toBe(true);
    expect(dentroDelPlan(0)).toBe(false);
    expect(dentroDelPlan(13)).toBe(false);
    expect(dentroDelPlan(null)).toBe(false);
  });

  it("da la fase de cada semana", () => {
    expect(faseDe(1).nombre).toBe("Adaptación");
    expect(faseDe(4).nombre).toBe("Fuerza");
    expect(faseDe(8).nombre).toBe("Descarga");
    expect(faseDe(12).nombre).toBe("Potencia");
    expect(faseDe(13)).toBeNull();
  });
});

describe("objetivoDe", () => {
  it("la sentadilla goblet pasa de 3×8 a 4×6-8 en la semana 4", () => {
    expect(objetivoDe(ej("Sentadilla goblet"), 1)).toMatchObject({ series: 3, reps: 8, texto: "3×8" });
    expect(objetivoDe(ej("Sentadilla goblet"), 4)).toMatchObject({ series: 4, reps: 6, texto: "4×6-8" });
  });

  it("el nordic sube por tramos", () => {
    expect(objetivoDe(ej("Nordic curl asistido"), 2).texto).toBe("2×3");
    expect(objetivoDe(ej("Nordic curl asistido"), 3).texto).toBe("2×4");
    expect(objetivoDe(ej("Nordic curl asistido"), 6).texto).toBe("3×5");
  });

  it("en la descarga se hace la mitad de series, redondeando hacia arriba", () => {
    expect(objetivoDe(ej("Press banca"), 8).series).toBe(2);
    expect(objetivoDe(ej("Peso muerto rumano"), 8).series).toBe(2);
    expect(objetivoDe(ej("Coger una pelota que cae"), 8).series).toBe(1);
  });

  it("en potencia, una serie menos solo en la fuerza de pierna", () => {
    expect(objetivoDe(ej("Sentadilla goblet"), 9).series).toBe(3);
    expect(objetivoDe(ej("Sentadilla búlgara"), 10).series).toBe(2);
    expect(objetivoDe(ej("Press banca"), 10).series).toBe(4);
    expect(objetivoDe(ej("Elevación de gemelos"), 10).series).toBe(3);
  });

  it("el drill reactivo pasa a 8×10 s en la semana 9", () => {
    expect(objetivoDe(ej("Drill combinado reactivo"), 5).texto).toBe("6×10 s");
    expect(objetivoDe(ej("Drill combinado reactivo"), 9).texto).toBe("8×10 s");
  });

  it("sin semana se queda en lo base", () => {
    expect(objetivoDe(ej("Sentadilla goblet"), null)).toMatchObject({ series: 3, texto: "3×8" });
  });

  it("la nota del objetivo junta series, RIR y descanso", () => {
    expect(notaObjetivo(ej("Press banca"), 1)).toBe("Objetivo: 4×6-10 · RIR 2 → 1 · descanso 2 min");
    expect(notaObjetivo(ej("Skater jumps"), 9)).toContain("sin pausa");
  });
});

describe("activar el plan", () => {
  it("usa nombres del catálogo cuando existe el ejercicio, para no partir el historial", () => {
    const catalogo = new Set(Object.values(EJERCICIOS).flat());
    const sinGrupo = RUTINAS_PLAN.flatMap((r) => r.ejercicios).filter((e) => !e.grupo);
    // Todo ejercicio que no declara grupo tiene que estar en el catálogo, si no
    // acabaría en "Otro".
    sinGrupo.forEach((e) => expect(catalogo.has(e.nombre), e.nombre).toBe(true));
  });

  it("crea las rutinas una sola vez", () => {
    const primera = rutinasParaGuardar([], grupoDe);
    expect(primera).toHaveLength(RUTINAS_PLAN.length);
    expect(primera.every((r) => r.plan === PLAN_ID && r.id)).toBe(true);
    expect(primera[0].ejercicios[0].como).toBeUndefined();
    expect(primera[0].ejercicios.every((e) => e.id && e.grupo)).toBe(true);
    expect(rutinasParaGuardar(primera, grupoDe)).toHaveLength(0);
  });

  it("no pisa los ejercicios propios que ya tengas", () => {
    const propios = [{ id: "x", nombre: "press banca", grupo: "Pecho", descripcion: "la mía" }];
    const nuevos = ejerciciosParaGuardar(propios, grupoDe);
    expect(nuevos.some((e) => e.nombre === "Press banca")).toBe(false);
    expect(nuevos.find((e) => e.nombre === "Face pull").grupo).toBe("Hombro");
    const nombres = nuevos.map((e) => e.nombre);
    expect(new Set(nombres).size).toBe(nombres.length);
  });

  it("no duplica en el calendario lo que ya estaba a esa hora", () => {
    const actual = [{ id: "t", dia: 1, hora: "19:00", tipo: "Tenis", titulo: "Entreno club" }];
    const nuevas = rutinaSemanalParaGuardar(actual);
    expect(nuevas).toHaveLength(SESIONES.length - 1);
    expect(nuevas.some((r) => r.dia === 1 && r.hora === "19:00")).toBe(false);
    expect(nuevas.every((r) => r.plan === PLAN_ID)).toBe(true);
    expect(rutinaSemanalParaGuardar([...actual, ...nuevas])).toHaveLength(0);
  });

  it("pone los hitos en su fecha y no los repite", () => {
    const hitos = hitosDelPlan("2026-11-02");
    expect(hitos[0].fecha).toBe("2026-11-08");
    expect(hitos.find((h) => h.titulo.includes("descarga")).fecha).toBe("2026-12-21");
    expect(hitos.at(-1).fecha).toBe("2027-01-24");
    const eventos = eventosParaGuardar("2026-11-02", []);
    expect(eventosParaGuardar("2026-11-02", eventos)).toHaveLength(0);
  });
});

describe("registro y cintura", () => {
  it("saca la última serie del día más reciente de cada semana de registro", () => {
    const filas = [
      { fecha: "2026-11-04", ejercicio: "Press banca", sets: [{ peso: 60, reps: 6 }, { peso: 55, reps: 8 }, { peso: 40, reps: 0 }] },
      { fecha: "2026-11-02", ejercicio: "Press banca", sets: [{ peso: 70, reps: 6 }] },
      { fecha: "2026-11-09", ejercicio: "Press banca", sets: [{ peso: 70, reps: 6 }] }, // semana 2: no cuenta
      { fecha: "2026-11-25", ejercicio: "Nordic curl asistido", sets: [{ peso: 0, reps: 4 }] },
    ];
    const t = registroPorSemana(filas, "2026-11-02", { setsDe });
    expect(t["Press banca"][1]).toEqual({ peso: 55, reps: 8 });
    expect(t["Press banca"][4]).toBeNull();
    expect(t["Nordic curl asistido"][4]).toEqual({ peso: 0, reps: 4 });
  });

  it("no da veredicto con menos de 2 semanas", () => {
    expect(evaluarCintura([]).estado).toBe("sin-datos");
    expect(evaluarCintura([{ fecha: "2026-11-02", cintura: 90 }, { fecha: "2026-11-09", cintura: 89 }]).estado).toBe(
      "pocos-datos"
    );
  });

  it("compara con hace 2 y 3 semanas", () => {
    const base = [{ fecha: "2026-11-02", cintura: 90 }];
    expect(evaluarCintura([...base, { fecha: "2026-11-16", cintura: 89.2 }])).toMatchObject({
      estado: "bien",
      cambio14: -0.8,
    });
    expect(evaluarCintura([...base, { fecha: "2026-11-16", cintura: 89.8 }]).estado).toBe("despacio");
    expect(evaluarCintura([...base, { fecha: "2026-11-16", cintura: 90 }]).estado).toBe("sin-bajar");
    expect(evaluarCintura([...base, { fecha: "2026-11-23", cintura: 90 }]).estado).toBe("estancada");
  });

  it("ignora las mediciones sin cintura (solo tests)", () => {
    const r = evaluarCintura([{ fecha: "2026-11-02", cintura: 90 }, { fecha: "2026-11-30", cintura: 0, agilidad: 9 }]);
    expect(r.ultima.fecha).toBe("2026-11-02");
  });

  it("media de peso de la semana", () => {
    const salud = [
      { fecha: "2026-11-01", peso: 90 },
      { fecha: "2026-11-02", peso: 82 },
      { fecha: "2026-11-05", peso: 81.5 },
      { fecha: "2026-11-08", peso: 0 },
    ];
    expect(mediaPesoSemana(salud, "2026-11-02")).toBe(81.8);
    expect(mediaPesoSemana(salud, "2026-11-09")).toBeNull();
  });
});
