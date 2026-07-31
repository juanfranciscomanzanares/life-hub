import { describe, it, expect } from "vitest";
import {
  horasPorAsignatura,
  horasDeAsignatura,
  totalHoras,
  quitarHoras,
  reparto,
  filaDeEstudio,
} from "./estudio";

const registro = [
  { id: "1", fecha: "2026-09-10", subject: "Deep Learning", horas: 2 },
  { id: "2", fecha: "2026-09-11", subject: "Ciberseguridad", horas: 1 },
  { id: "3", fecha: "2026-09-12", subject: "Deep Learning", horas: 1.5 },
];

const DEL_CURSO = ["Deep Learning", "Ciberseguridad", "TFG"];

describe("horasPorAsignatura", () => {
  it("suma por asignatura", () => {
    expect(horasPorAsignatura(registro)).toEqual({
      "Deep Learning": 3.5,
      Ciberseguridad: 1,
    });
  });

  it("no inventa asignaturas sin horas", () => {
    expect(horasPorAsignatura(registro)["TFG"]).toBeUndefined();
  });

  it("aguanta filas rotas", () => {
    const sucio = [...registro, { id: "x" }, null, { id: "y", subject: "Deep Learning" }];
    expect(horasPorAsignatura(sucio)["Deep Learning"]).toBe(3.5);
  });

  it("ignora las horas negativas", () => {
    expect(horasPorAsignatura([{ subject: "TFG", horas: -5 }])).toEqual({ TFG: 0 });
  });

  it("con el registro vacío devuelve un objeto vacío", () => {
    expect(horasPorAsignatura([])).toEqual({});
    expect(horasPorAsignatura()).toEqual({});
  });
});

describe("totalHoras", () => {
  it("suma todo el registro si no se acota", () => {
    expect(totalHoras(registro)).toBe(4.5);
  });

  it("acotado a unas asignaturas, solo cuenta esas", () => {
    expect(totalHoras(registro, ["Deep Learning"])).toBe(3.5);
  });

  it("NO cuenta las asignaturas que no se ven: el fallo del '29h totales'", () => {
    /*
      El caso real: quedaban horas de asignaturas de cursos anteriores, que ya
      no están en SUBJECTS. La cabecera las sumaba y la lista no las pintaba,
      así que salía "29h totales" con todas las filas a 0.
    */
    const conHerencia = [
      ...registro,
      { id: "v1", fecha: "2025-03-01", subject: "Procesamiento de Imagen", horas: 20 },
      { id: "v2", fecha: "2025-03-02", subject: "Álgebra", horas: 9 },
    ];

    expect(totalHoras(conHerencia)).toBe(33.5); // el histórico completo
    // Pero lo que enseña Universidad solo cuenta lo de este curso:
    expect(totalHoras(conHerencia, DEL_CURSO)).toBe(4.5);

    // Y cuadra con la suma de las filas visibles, que es lo que fallaba.
    const visibles = reparto(conHerencia, DEL_CURSO).reduce((a, f) => a + f.horas, 0);
    expect(totalHoras(conHerencia, DEL_CURSO)).toBe(visibles);
  });

  it("con todo a cero, el total es cero", () => {
    expect(totalHoras([], DEL_CURSO)).toBe(0);
  });
});

describe("horasDeAsignatura", () => {
  it("suma solo la asignatura pedida", () => {
    expect(horasDeAsignatura(registro, "Deep Learning")).toBe(3.5);
    expect(horasDeAsignatura(registro, "TFG")).toBe(0);
  });
});

describe("quitarHoras", () => {
  it("borra desde la última apuntada", () => {
    const r = quitarHoras(registro, "Deep Learning", 1.5);
    expect(r.map((f) => f.id)).toEqual(["1", "2"]);
    expect(horasDeAsignatura(r, "Deep Learning")).toBe(2);
  });

  it("recorta la fila en vez de borrarla si sobra", () => {
    // Nunca se mete una fila de horas negativas: descuadraría Analítica.
    const r = quitarHoras(registro, "Deep Learning", 1);
    expect(r).toHaveLength(3);
    expect(horasDeAsignatura(r, "Deep Learning")).toBe(2.5);
    expect(r.every((f) => f.horas >= 0)).toBe(true);
  });

  it("atraviesa varias filas si hace falta", () => {
    const r = quitarHoras(registro, "Deep Learning", 3.5);
    expect(horasDeAsignatura(r, "Deep Learning")).toBe(0);
    expect(r.map((f) => f.id)).toEqual(["2"]);
  });

  it("si se piden más horas de las que hay, no baja de cero", () => {
    const r = quitarHoras(registro, "Deep Learning", 99);
    expect(horasDeAsignatura(r, "Deep Learning")).toBe(0);
    expect(totalHoras(r)).toBe(1); // Ciberseguridad intacta
  });

  it("no toca las demás asignaturas", () => {
    const r = quitarHoras(registro, "Deep Learning", 2);
    expect(horasDeAsignatura(r, "Ciberseguridad")).toBe(1);
  });

  it("quitar cero no cambia nada", () => {
    expect(quitarHoras(registro, "Deep Learning", 0)).toBe(registro);
  });

  it("de una asignatura sin horas no rompe", () => {
    expect(quitarHoras(registro, "TFG", 1)).toHaveLength(3);
  });
});

describe("reparto (lo que pinta el gráfico)", () => {
  it("ordena de más a menos horas", () => {
    expect(reparto(registro, DEL_CURSO).map((f) => f.asignatura)).toEqual([
      "Deep Learning",
      "Ciberseguridad",
      "TFG",
    ]);
  });

  it("incluye las que están a cero: el hueco también informa", () => {
    expect(reparto(registro, DEL_CURSO)).toContainEqual({ asignatura: "TFG", horas: 0 });
  });

  it("solo devuelve las asignaturas pedidas", () => {
    const conVieja = [...registro, { subject: "Álgebra", horas: 9 }];
    expect(reparto(conVieja, DEL_CURSO).map((f) => f.asignatura)).not.toContain("Álgebra");
  });

  it("con empate, ordena por nombre para que no baile entre repintados", () => {
    const empate = [
      { subject: "Ciberseguridad", horas: 2 },
      { subject: "Deep Learning", horas: 2 },
    ];
    expect(reparto(empate, DEL_CURSO).map((f) => f.asignatura)).toEqual([
      "Ciberseguridad",
      "Deep Learning",
      "TFG",
    ]);
  });
});

describe("filaDeEstudio", () => {
  it("arma la fila con el formato del registro", () => {
    expect(
      filaDeEstudio({ id: "a", fecha: "2026-09-14", asignatura: "TFG", horas: 1.5 })
    ).toEqual({ id: "a", fecha: "2026-09-14", subject: "TFG", horas: 1.5 });
  });

  it("guarda de qué tarea salieron las horas, si vienen de una", () => {
    const f = filaDeEstudio({
      id: "a",
      fecha: "2026-09-14",
      asignatura: "TFG",
      horas: 2,
      tarea: "t1",
    });
    expect(f.tarea).toBe("t1");
  });

  it("redondea a dos decimales (25 min de foco son 0,42 h)", () => {
    expect(filaDeEstudio({ id: "a", fecha: "x", asignatura: "TFG", horas: 25 / 60 }).horas).toBe(0.42);
  });
});
