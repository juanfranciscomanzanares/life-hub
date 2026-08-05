import { describe, it, expect } from "vitest";
import { SCHEDULE_C1, SCHEDULE_C2, clasesSemanales } from "./datosUni";
import { SUBJECTS } from "./uni";

/*
  El horario es dato escrito a mano a partir de los PDF de la Facultad, así que
  lo que se prueba no es la lógica (casi no hay) sino que el dato no se
  contradiga: una práctica sin subgrupo o dos clases pisándose la misma hora son
  errores que solo se ven al mirar la tabla, y para entonces ya te has perdido
  una clase.
*/

const TODAS = [...SCHEDULE_C1, ...SCHEDULE_C2];

// "10:00 - 11:00" → [600, 660] en minutos, que es lo que deja comparar tramos.
const tramo = (hora) => {
  const [ini, fin] = hora.split(" - ").map((h) => {
    const [hh, mm] = h.split(":").map(Number);
    return hh * 60 + mm;
  });
  return [ini, fin];
};

describe("horario del curso", () => {
  it("solo lleva asignaturas de la matrícula", () => {
    TODAS.forEach((c) => expect(SUBJECTS).toContain(c.subject));
  });

  it("cada clase tiene día y franja horaria con principio y final", () => {
    TODAS.forEach((c) => {
      expect(["lunes", "martes", "miercoles", "jueves", "viernes"]).toContain(c.dia);
      const [ini, fin] = tramo(c.hora);
      expect(Number.isFinite(ini) && Number.isFinite(fin)).toBe(true);
      expect(fin).toBeGreaterThan(ini);
    });
  });

  it("toda práctica dice de qué subgrupo es", () => {
    TODAS.filter((c) => c.practicas).forEach((c) => {
      expect(c.subgrupo).toMatch(/^\d+\.\d+$/);
    });
  });

  it("no hay dos clases a la vez el mismo día", () => {
    [SCHEDULE_C1, SCHEDULE_C2].forEach((cuatrimestre) => {
      cuatrimestre.forEach((a, i) => {
        cuatrimestre.slice(i + 1).forEach((b) => {
          if (a.dia !== b.dia) return;
          const [iniA, finA] = tramo(a.hora);
          const [iniB, finB] = tramo(b.hora);
          const solapan = iniA < finB && iniB < finA;
          expect(solapan, `${a.subject} ${a.hora} pisa a ${b.subject} ${b.hora} el ${a.dia}`).toBe(false);
        });
      });
    });
  });

  it("una asignatura con prácticas las tiene además de la teoría, no en su lugar", () => {
    const conPracticas = new Set(TODAS.filter((c) => c.practicas).map((c) => c.subject));
    const conTeoria = new Set(TODAS.filter((c) => !c.practicas).map((c) => c.subject));
    conPracticas.forEach((s) => expect(conTeoria).toContain(s));
  });
});

describe("clasesSemanales", () => {
  it("da una entrada de rutina por clase, con el lunes como día 0", () => {
    const semana = clasesSemanales();
    expect(semana).toHaveLength(TODAS.length);
    semana.forEach((r) => {
      expect(r.tipo).toBe("Universidad");
      expect(r.dia).toBeGreaterThanOrEqual(0);
      expect(r.hora).toMatch(/^\d{2}:\d{2}$/);
    });

    const fc = semana.find((r) => r.titulo === "Fund. Computadores (teoría)");
    expect(fc).toEqual({ dia: 3, hora: "10:00", titulo: "Fund. Computadores (teoría)", tipo: "Universidad" });
  });

  it("distingue teoría de prácticas en el título, con el subgrupo", () => {
    const titulos = clasesSemanales().map((r) => r.titulo);
    expect(titulos).toContain("Ciberseguridad (prácticas 1.1)");
    expect(titulos).toContain("Deep Learning (prácticas 1.2)");
    // Sin esto, teoría y prácticas de la misma asignatura serían la misma
    // entrada para el calendario, que deduplica por día + hora + título.
    expect(new Set(titulos).size).toBe(titulos.length);
  });
});
