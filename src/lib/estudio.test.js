import { describe, it, expect } from "vitest";
import {
  horasEntre,
  nuevaSesion,
  normalizarSesion,
  sesionValida,
  sesionesDe,
  horasPorAsignatura,
  horasDeAsignatura,
  totalHoras,
  reparto,
  resumen,
  porDiaDeLaSemana,
  partirPorAsignatura,
} from "./estudio";

const sesiones = [
  { id: "1", fecha: "2026-09-14", subject: "Deep Learning", desde: "16:00", hasta: "18:00", horas: 2 },
  { id: "2", fecha: "2026-09-15", subject: "Ciberseguridad", desde: "10:00", hasta: "11:00", horas: 1 },
  { id: "3", fecha: "2026-09-16", subject: "Deep Learning", desde: "09:00", hasta: "10:30", horas: 1.5 },
];

const DEL_CURSO = ["Deep Learning", "Ciberseguridad", "TFG"];

describe("horasEntre", () => {
  it("calcula el tramo del reloj", () => {
    expect(horasEntre("16:00", "18:00")).toBe(2);
    expect(horasEntre("09:00", "10:30")).toBe(1.5);
    expect(horasEntre("08:15", "08:45")).toBe(0.5);
  });

  it("una sesión de 25 minutos son 0,42 h", () => {
    expect(horasEntre("10:00", "10:25")).toBe(0.42);
  });

  it("si el fin no es posterior al inicio, son cero horas", () => {
    expect(horasEntre("18:00", "16:00")).toBe(0);
    expect(horasEntre("10:00", "10:00")).toBe(0);
  });

  it("NO deja cruzar la medianoche", () => {
    /*
      "de 18:00 a 6:00" es casi siempre un error de tecleo, y admitirlo
      apuntaría doce horas de estudio sin que nadie se dé cuenta. Si de verdad
      estudias de madrugada, son dos sesiones.
    */
    expect(horasEntre("18:00", "06:00")).toBe(0);
  });

  it("no se traga horas imposibles", () => {
    expect(horasEntre("25:00", "26:00")).toBe(0);
    expect(horasEntre("10:70", "11:00")).toBe(0);
    expect(horasEntre("", "")).toBe(0);
    expect(horasEntre(null, undefined)).toBe(0);
  });
});

describe("nuevaSesion", () => {
  it("saca las horas del tramo, sin teclear números", () => {
    const s = nuevaSesion({ id: "a", fecha: "2026-09-14", asignatura: "TFG", desde: "16:00", hasta: "18:30" });
    expect(s).toMatchObject({ fecha: "2026-09-14", subject: "TFG", desde: "16:00", hasta: "18:30", horas: 2.5 });
  });

  it("guarda la nota y la tarea solo si vienen", () => {
    const conNota = nuevaSesion({ id: "a", fecha: "x", asignatura: "TFG", desde: "10:00", hasta: "11:00", nota: "Tema 3" });
    expect(conNota.nota).toBe("Tema 3");
    const sinNota = nuevaSesion({ id: "b", fecha: "x", asignatura: "TFG", desde: "10:00", hasta: "11:00" });
    expect(sinNota).not.toHaveProperty("nota");
    expect(sinNota).not.toHaveProperty("tarea");
  });
});

describe("normalizarSesion (compatibilidad)", () => {
  it("las filas antiguas, sin tramo, conservan sus horas", () => {
    // Las del modo foco miden un temporizador, no un tramo del reloj.
    expect(normalizarSesion({ fecha: "x", subject: "TFG", horas: 0.42 }).horas).toBe(0.42);
  });

  it("cuando hay tramo, manda el tramo", () => {
    // Si alguien edita las horas a mano y no cuadran con el reloj, gana el reloj.
    const s = normalizarSesion({ desde: "10:00", hasta: "12:00", horas: 99 });
    expect(s.horas).toBe(2);
  });

  it("las horas negativas se quedan en cero", () => {
    expect(normalizarSesion({ horas: -5 }).horas).toBe(0);
  });
});

describe("sesionValida", () => {
  it("exige asignatura, día y que dure algo", () => {
    expect(sesionValida({ subject: "TFG", fecha: "2026-09-14", desde: "10:00", hasta: "11:00" })).toBe(true);
    expect(sesionValida({ subject: "TFG", fecha: "2026-09-14", desde: "10:00", hasta: "10:00" })).toBe(false);
    expect(sesionValida({ fecha: "2026-09-14", desde: "10:00", hasta: "11:00" })).toBe(false);
    expect(sesionValida({ subject: "TFG", desde: "10:00", hasta: "11:00" })).toBe(false);
    expect(sesionValida(null)).toBe(false);
  });
});

describe("sesionesDe", () => {
  it("devuelve las de ese día ordenadas por hora de inicio", () => {
    const registro = [
      { id: "tarde", fecha: "2026-09-14", subject: "TFG", desde: "18:00", hasta: "19:00" },
      { id: "pronto", fecha: "2026-09-14", subject: "TFG", desde: "09:00", hasta: "10:00" },
      { id: "otroDia", fecha: "2026-09-15", subject: "TFG", desde: "08:00", hasta: "09:00" },
    ];
    expect(sesionesDe(registro, "2026-09-14").map((s) => s.id)).toEqual(["pronto", "tarde"]);
  });

  it("las que no tienen hora van al final", () => {
    const registro = [
      { id: "sinHora", fecha: "2026-09-14", subject: "TFG", horas: 1 },
      { id: "conHora", fecha: "2026-09-14", subject: "TFG", desde: "18:00", hasta: "19:00" },
    ];
    expect(sesionesDe(registro, "2026-09-14").map((s) => s.id)).toEqual(["conHora", "sinHora"]);
  });

  it("un día sin nada devuelve lista vacía", () => {
    expect(sesionesDe(sesiones, "2026-01-01")).toEqual([]);
  });
});

describe("agregados por asignatura", () => {
  it("suma por asignatura", () => {
    expect(horasPorAsignatura(sesiones)).toEqual({ "Deep Learning": 3.5, Ciberseguridad: 1 });
  });

  it("horasDeAsignatura mira solo la pedida", () => {
    expect(horasDeAsignatura(sesiones, "Deep Learning")).toBe(3.5);
    expect(horasDeAsignatura(sesiones, "TFG")).toBe(0);
  });

  it("NO cuenta las asignaturas que no se ven: el fallo del '29h totales'", () => {
    const conHerencia = [
      ...sesiones,
      { id: "v1", fecha: "2025-03-01", subject: "Procesamiento de Imagen", horas: 20 },
      { id: "v2", fecha: "2025-03-02", subject: "Álgebra", horas: 9 },
    ];
    expect(totalHoras(conHerencia)).toBe(33.5); // histórico completo
    expect(totalHoras(conHerencia, DEL_CURSO)).toBe(4.5); // lo que enseña Universidad

    // Y cuadra con la suma de las filas visibles, que es lo que fallaba.
    const visibles = reparto(conHerencia, DEL_CURSO).reduce((a, f) => a + f.horas, 0);
    expect(totalHoras(conHerencia, DEL_CURSO)).toBe(visibles);
  });

  it("reparto ordena de más a menos e incluye los ceros al final", () => {
    expect(reparto(sesiones, DEL_CURSO)).toEqual([
      { asignatura: "Deep Learning", horas: 3.5 },
      { asignatura: "Ciberseguridad", horas: 1 },
      { asignatura: "TFG", horas: 0 },
    ]);
  });

  it("reparto solo devuelve las asignaturas pedidas", () => {
    const conVieja = [...sesiones, { subject: "Álgebra", horas: 9 }];
    expect(reparto(conVieja, DEL_CURSO).map((f) => f.asignatura)).not.toContain("Álgebra");
  });
});

describe("gráfico semanal", () => {
  it("reparte las sesiones por día de la semana", () => {
    // 2026-09-14 es lunes.
    const semana = porDiaDeLaSemana(sesiones, "2026-09-16");
    expect(semana.map((d) => d.horas)).toEqual([2, 1, 1.5, 0, 0, 0, 0]);
    expect(semana.map((d) => d.etiqueta)).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
  });

  it("las filas antiguas sin tramo también entran", () => {
    const conAntigua = [...sesiones, { fecha: "2026-09-17", subject: "TFG", horas: 3 }];
    expect(porDiaDeLaSemana(conAntigua, "2026-09-16")[3].horas).toBe(3);
  });
});

describe("partirPorAsignatura (barras apiladas)", () => {
  const mismoDia = (f, t) => f.fecha === t.fecha;

  it("parte cada día en las asignaturas que lo componen", () => {
    const tramos = porDiaDeLaSemana(sesiones, "2026-09-16");
    const partido = partirPorAsignatura(tramos, sesiones, DEL_CURSO, mismoDia);

    expect(partido[0].partes).toEqual([{ clave: "Deep Learning", valor: 2 }]);
    expect(partido[1].partes).toEqual([{ clave: "Ciberseguridad", valor: 1 }]);
  });

  it("las partes suman el total del tramo", () => {
    const variasEnUnDia = [
      { fecha: "2026-09-14", subject: "Deep Learning", desde: "10:00", hasta: "12:00" },
      { fecha: "2026-09-14", subject: "Ciberseguridad", desde: "16:00", hasta: "17:30" },
    ];
    const tramos = porDiaDeLaSemana(variasEnUnDia, "2026-09-14");
    const [lunes] = partirPorAsignatura(tramos, variasEnUnDia, DEL_CURSO, mismoDia);

    expect(lunes.total ?? lunes.horas).toBe(3.5);
    expect(lunes.partes.reduce((a, p) => a + p.valor, 0)).toBe(3.5);
  });

  it("respeta el ORDEN de las asignaturas, no el tamaño de cada trozo", () => {
    /*
      Si los trozos se ordenaran por tamaño, el color de una asignatura
      cambiaría de sitio de un día para otro y el gráfico sería ilegible.
    */
    const dia = [
      { fecha: "2026-09-14", subject: "Ciberseguridad", desde: "08:00", hasta: "13:00" }, // 5 h
      { fecha: "2026-09-14", subject: "Deep Learning", desde: "16:00", hasta: "17:00" }, // 1 h
    ];
    const tramos = porDiaDeLaSemana(dia, "2026-09-14");
    const [lunes] = partirPorAsignatura(tramos, dia, DEL_CURSO, mismoDia);

    // DEL_CURSO empieza por Deep Learning aunque solo tenga 1 h.
    expect(lunes.partes.map((p) => p.clave)).toEqual(["Deep Learning", "Ciberseguridad"]);
  });

  it("no mete asignaturas que no tocaste ese día", () => {
    const tramos = porDiaDeLaSemana(sesiones, "2026-09-16");
    const partido = partirPorAsignatura(tramos, sesiones, DEL_CURSO, mismoDia);
    expect(partido[3].partes).toEqual([]); // jueves, sin nada
    expect(partido[0].partes.map((p) => p.clave)).not.toContain("TFG");
  });

  it("una asignatura fuera de la lista no aparece", () => {
    const conVieja = [
      ...sesiones,
      { fecha: "2026-09-14", subject: "Álgebra", desde: "08:00", hasta: "09:00" },
    ];
    const tramos = porDiaDeLaSemana(conVieja, "2026-09-16");
    const partido = partirPorAsignatura(tramos, conVieja, DEL_CURSO, mismoDia);
    expect(partido[0].partes.map((p) => p.clave)).not.toContain("Álgebra");
  });
});

describe("resumen", () => {
  const semana = [
    { etiqueta: "Lun", horas: 2 },
    { etiqueta: "Mar", horas: 1 },
    { etiqueta: "Mié", horas: 4 },
    { etiqueta: "Jue", horas: 0 },
    { etiqueta: "Vie", horas: 0 },
    { etiqueta: "Sáb", horas: 0 },
    { etiqueta: "Dom", horas: 0 },
  ];

  it("suma el total", () => {
    expect(resumen(semana).total).toBe(7);
  });

  it("la media reparte entre TODOS los tramos, también los de cero", () => {
    // Es lo que interesa: la media de la semana incluye los días en blanco.
    expect(resumen(semana).media).toBe(1);
  });

  it("señala el mejor tramo", () => {
    expect(resumen(semana).mejor.etiqueta).toBe("Mié");
  });

  it("sin nada estudiado, no hay mejor día", () => {
    const vacia = semana.map((d) => ({ ...d, horas: 0 }));
    expect(resumen(vacia).mejor).toBe(null);
    expect(resumen(vacia).total).toBe(0);
  });

  it("sin tramos no divide por cero", () => {
    expect(resumen([])).toEqual({ total: 0, media: 0, mejor: null });
  });
});
