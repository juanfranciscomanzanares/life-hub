import { describe, it, expect } from "vitest";
import {
  SUBJECTS,
  PERIODOS_UMU,
  FESTIVOS_UMU,
  queHayEl,
  esLectivo,
  eventosDelCalendario,
  urgenciasDeHoy,
} from "./uni";

describe("calendario académico 2026/2027", () => {
  it("reconoce los cuatrimestres", () => {
    expect(queHayEl("2026-09-07")).toMatchObject({ tipo: "clases", titulo: "1er cuatrimestre" });
    expect(queHayEl("2026-12-11").tipo).toBe("clases");
    expect(queHayEl("2027-01-18")).toMatchObject({ titulo: "2º cuatrimestre" });
  });

  it("reconoce las convocatorias de exámenes", () => {
    expect(queHayEl("2026-12-15").tipo).toBe("examenes");
    expect(queHayEl("2027-01-08").tipo).toBe("examenes");
    expect(queHayEl("2027-05-20").tipo).toBe("examenes");
    expect(queHayEl("2027-06-30").tipo).toBe("examenes");
  });

  it("los festivos mandan sobre el cuatrimestre", () => {
    // El 8 de diciembre cae dentro del 1er cuatrimestre, pero no hay clase.
    expect(queHayEl("2026-12-08")).toMatchObject({ tipo: "festivo", titulo: "Inmaculada Concepción" });
    expect(esLectivo("2026-12-08")).toBe(false);
    expect(esLectivo("2026-12-09")).toBe(true);
  });

  it("las vacaciones también mandan", () => {
    expect(queHayEl("2026-12-25").tipo).toBe("vacaciones");
    expect(queHayEl("2027-01-06").tipo).toBe("vacaciones"); // último día incluido
    expect(queHayEl("2027-03-30")).toMatchObject({ titulo: "Semana Santa y Fiestas de Primavera" });
  });

  it("fuera de curso no hay nada", () => {
    expect(queHayEl("2026-08-15")).toBe(null); // agosto, vacaciones de verano
    expect(queHayEl("2027-01-17")).toBe(null); // entre convocatoria I y 2º cuatrimestre
    expect(queHayEl("")).toBe(null);
  });

  it("los periodos no se pisan entre sí", () => {
    const ordenados = [...PERIODOS_UMU].sort((a, b) => a.desde.localeCompare(b.desde));
    ordenados.forEach((p, i) => {
      expect(p.desde <= p.hasta).toBe(true);
      if (i > 0) expect(ordenados[i - 1].hasta < p.desde).toBe(true);
    });
  });

  it("vuelca el calendario como eventos ordenados por fecha", () => {
    const ev = eventosDelCalendario();
    // 6 periodos x2 + 2 vacaciones x2 + 10 festivos
    expect(ev).toHaveLength(PERIODOS_UMU.length * 2 + 4 + FESTIVOS_UMU.length);
    expect(ev[0].fecha).toBe("2026-09-07");
    expect([...ev].sort((a, b) => a.fecha.localeCompare(b.fecha))).toEqual(ev);
  });
});

describe("urgencias de hoy", () => {
  const HOY = "2026-11-10";

  const base = {
    tareasUni: [
      { id: 1, text: "Práctica 2", subject: "Deep Learning", entrega: "2026-11-10", done: false },
      { id: 2, text: "Memoria", subject: "Ciberseguridad", entrega: "2026-11-05", done: false },
      { id: 3, text: "Ya hecha", subject: "TFG", entrega: "2026-11-01", done: true },
      { id: 4, text: "Para más tarde", subject: "TFG", entrega: "2026-12-01", done: false },
      { id: 5, text: "Sin fecha", subject: "TFG", done: false },
    ],
    tareasAula: [],
    eventos: [
      { id: 10, fecha: "2026-11-10", titulo: "Examen: Ciberseguridad (mañana)" },
      { id: 11, fecha: "2026-11-10", titulo: "Cita peluquería" },
      { id: 12, fecha: "2026-11-11", titulo: "Mañana no cuenta" },
    ],
    hoy: HOY,
  };

  const urgencias = urgenciasDeHoy(base);

  it("coge lo que se entrega hoy", () => {
    expect(urgencias.map((u) => u.id)).toContain("tarea-1");
  });

  it("NO arrastra lo vencido", () => {
    /*
      Lo atrasado se quedaba en la lista para siempre: cualquier tarea vieja
      sin marcar como hecha tapaba lo que de verdad tocaba hoy. Su sitio es la
      lista de tareas de Universidad, no esta pantalla.
    */
    expect(urgencias.map((u) => u.id)).not.toContain("tarea-2");
    expect(urgencias.some((u) => u.tipo === "vencida")).toBe(false);
  });

  it("deja fuera lo hecho, lo futuro y lo que no tiene fecha", () => {
    const ids = urgencias.map((u) => u.id);
    expect(ids).not.toContain("tarea-3");
    expect(ids).not.toContain("tarea-4");
    expect(ids).not.toContain("tarea-5");
  });

  it("mete los eventos de hoy y reconoce los exámenes", () => {
    expect(urgencias.find((u) => u.id === "evento-10").tipo).toBe("examen");
    expect(urgencias.find((u) => u.id === "evento-11").tipo).toBe("evento");
    expect(urgencias.map((u) => u.id)).not.toContain("evento-12");
  });

  it("los exámenes van primero", () => {
    expect(urgencias[0].tipo).toBe("examen");
  });

  it("una tarea del Aula Virtual ya puesta no sale dos veces", () => {
    const tareasAula = [
      { id: "av1", titulo: "Práctica 2", asignatura: "Deep Learning", entrega: "2026-11-10" },
      { id: "av2", titulo: "Otra", asignatura: "Cálculo", entrega: "2026-11-10" },
    ];
    const conAula = urgenciasDeHoy({
      ...base,
      tareasUni: [{ id: 1, aulaId: "av1", text: "Práctica 2", subject: "Deep Learning", entrega: "2026-11-10", done: false }],
      tareasAula,
    });
    const ids = conAula.map((u) => u.id);
    expect(ids).toContain("tarea-1");
    expect(ids).not.toContain("aula-av1"); // ya está puesta
    expect(ids).toContain("aula-av2");
  });

  it("sin nada, no hay urgencias", () => {
    expect(urgenciasDeHoy({ hoy: HOY })).toEqual([]);
  });
});

describe("asignaturas", () => {
  it("son las del curso 2026/2027 y no una lista de ejemplo", () => {
    expect(SUBJECTS).toContain("Deep Learning");
    expect(SUBJECTS).toContain("Ciberseguridad");
    // Las inventadas que arrastraba el modo foco.
    expect(SUBJECTS).not.toContain("Álgebra");
    expect(SUBJECTS).not.toContain("Prog. I");
  });
});
