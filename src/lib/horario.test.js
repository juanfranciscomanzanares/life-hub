import { describe, it, expect } from "vitest";
import {
  PASO,
  aMinutos,
  aTexto,
  tramo,
  rangoHorario,
  filasDe,
  celdaDe,
  clasesDe,
  porDias,
} from "./horario";
import { SCHEDULE_C1, SCHEDULE_C2 } from "./datosUni";

const DIAS = [
  { key: "lunes", label: "Lunes" },
  { key: "martes", label: "Martes" },
  { key: "miercoles", label: "Miércoles" },
  { key: "jueves", label: "Jueves" },
];

describe("horas y tramos", () => {
  it("pasa de texto a minutos y vuelve", () => {
    expect(aMinutos("10:00")).toBe(600);
    expect(aMinutos("12:20")).toBe(740);
    expect(aTexto(600)).toBe("10:00");
    expect(aTexto(1230)).toBe("20:30");
  });

  it("parte una franja en principio, final y duración", () => {
    expect(tramo("15:00 - 17:00")).toEqual({ ini: 900, fin: 1020, dura: 120 });
    expect(tramo("12:20 - 14:20").dura).toBe(120);
  });
});

describe("rangoHorario", () => {
  it("redondea a horas enteras hacia fuera, para no cortar ninguna clase", () => {
    const r = rangoHorario([{ hora: "12:20 - 14:20" }, { hora: "18:30 - 20:30" }]);
    expect(aTexto(r.inicio)).toBe("12:00");
    expect(aTexto(r.fin)).toBe("21:00");
    expect(r.horas.map(aTexto)).toEqual([
      "12:00", "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00",
    ]);
    expect(r.filas).toBe((21 * 60 - 12 * 60) / PASO);
  });

  it("se ciñe a lo que hay: el 2º cuatrimestre es solo de tarde", () => {
    const r = rangoHorario(SCHEDULE_C2);
    expect(aTexto(r.inicio)).toBe("16:00");
    expect(aTexto(r.fin)).toBe("20:00");
  });

  it("aguanta un cuatrimestre sin clases sin dividir entre cero", () => {
    expect(rangoHorario([])).toEqual({ inicio: 0, fin: 0, horas: [], filas: 0 });
  });
});

describe("colocación en la rejilla", () => {
  const { inicio } = rangoHorario(SCHEDULE_C1); // 10:00

  it("la primera clase del día arranca en la fila 1", () => {
    expect(filasDe(inicio, inicio)).toBe(1);
  });

  it("una clase ocupa tantas filas como dura", () => {
    const { desde, hasta } = celdaDe({ hora: "15:00 - 17:00" }, inicio);
    expect(hasta - desde).toBe(120 / PASO);
  });

  it("las clases que empiezan a y 20 caen en su sitio, no en la hora en punto", () => {
    const { desde } = celdaDe({ hora: "12:20 - 14:20" }, inicio);
    // 2h20 desde las 10:00 = 140 min = 14 filas de 10 minutos, más el 1 de CSS.
    expect(desde).toBe(15);
  });

  it("ninguna clase del curso se sale de la rejilla", () => {
    [SCHEDULE_C1, SCHEDULE_C2].forEach((cuatrimestre) => {
      const r = rangoHorario(cuatrimestre);
      cuatrimestre.forEach((c) => {
        const { desde, hasta } = celdaDe(c, r.inicio);
        expect(desde).toBeGreaterThanOrEqual(1);
        expect(hasta).toBeLessThanOrEqual(r.filas + 1);
      });
    });
  });
});

describe("agrupar por días", () => {
  it("ordena las clases del día por hora de inicio", () => {
    const lunes = clasesDe(SCHEDULE_C1, "lunes").map((c) => c.hora);
    expect(lunes).toEqual(["15:00 - 17:00", "17:00 - 18:00", "18:30 - 20:30"]);
  });

  it("la agenda deja fuera los días sin clase", () => {
    const agenda = porDias(SCHEDULE_C2, DIAS);
    expect(agenda.map((d) => d.key)).toEqual(["lunes", "miercoles"]);
    expect(agenda.every((d) => d.clases.length > 0)).toBe(true);
  });

  it("no pierde ni duplica ninguna clase", () => {
    const total = porDias(SCHEDULE_C1, DIAS).reduce((n, d) => n + d.clases.length, 0);
    expect(total).toBe(SCHEDULE_C1.length);
  });
});
