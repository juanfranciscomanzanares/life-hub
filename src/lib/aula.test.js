import { describe, it, expect } from "vitest";
import {
  partirTituloSitio,
  capitalizar,
  nombreAsignatura,
  coincideAsignatura,
  asignaturaDeApp,
  estadoDe,
  esPendiente,
  normalizarTareas,
  agruparPorAsignatura,
  aTareaDeApp,
  yaAnadida,
  tareasQueFaltan,
} from "./aula";

// Las asignaturas de la app van abreviadas; las del Aula Virtual, completas.
const SUBJECTS = [
  "Fund. Computadores",
  "Infraest. Comp. Altas Prest.",
  "Deep Learning",
  "Gestión de Proyectos",
  "Ciberseguridad",
];

const AHORA = new Date("2026-07-29T10:00:00Z");

describe("títulos de los sitios de Sakai", () => {
  it("parte código, nombre y curso", () => {
    expect(partirTituloSitio("(6584) FUNDAMENTOS DE REDES DE DATOS  [25/26]")).toEqual({
      codigo: "6584",
      nombre: "FUNDAMENTOS DE REDES DE DATOS",
      curso: "25/26",
    });
  });

  it("aguanta un título sin código ni curso", () => {
    expect(partirTituloSitio("Delegación de Estudiantes")).toEqual({
      codigo: "",
      nombre: "Delegación de Estudiantes",
      curso: "",
    });
  });

  it("capitaliza dejando las palabras menudas en minúscula", () => {
    expect(capitalizar("FUNDAMENTOS DE REDES DE DATOS")).toBe("Fundamentos de Redes de Datos");
    expect(capitalizar("SEÑALES Y SISTEMAS")).toBe("Señales y Sistemas");
  });

  it("si no queda nombre, se queda con el código antes que con nada", () => {
    expect(nombreAsignatura("(6596)")).toBe("6596");
    // Un sitio que no vino en site.json llega como su identificador crudo.
    expect(nombreAsignatura("6596_G_2025_N_N")).toBe("6596_g_2025_n_n");
  });
});

describe("emparejar con las asignaturas de la app", () => {
  it("reconoce una abreviatura por trozos", () => {
    // infraest→INFRAESTRUCTURA, comp→COMPUTACIÓN, altas→ALTAS, prest→PRESTACIONES
    expect(
      coincideAsignatura(
        "Infraestructura para la Computación de Altas Prestaciones",
        "Infraest. Comp. Altas Prest."
      )
    ).toBe(true);
  });

  it("no empareja asignaturas distintas que empiezan igual", () => {
    expect(coincideAsignatura("Fundamentos de Redes de Datos", "Fund. Computadores")).toBe(false);
  });

  it("le dan igual acentos y mayúsculas", () => {
    expect(coincideAsignatura("GESTIÓN DE PROYECTOS", "Gestión de Proyectos")).toBe(true);
  });

  it("devuelve null cuando no es ninguna de las tuyas", () => {
    // Las del curso pasado no están en la lista de la app, y está bien.
    expect(asignaturaDeApp("Procesamiento de Imagen", SUBJECTS)).toBe(null);
    expect(asignaturaDeApp("Deep Learning", SUBJECTS)).toBe("Deep Learning");
  });
});

describe("estado de una tarea", () => {
  const base = { abre: "2026-07-01T00:00:00Z", entrega: "2026-08-15T00:00:00Z", cierra: "2026-08-15T00:00:00Z" };

  it("abierta si el plazo aún no ha vencido", () => {
    expect(estadoDe({ ...base }, AHORA)).toBe("abierta");
  });

  it("cerrada si ya pasó", () => {
    expect(estadoDe({ ...base, cierra: "2026-07-01T00:00:00Z" }, AHORA)).toBe("cerrada");
  });

  it("próxima si todavía no se ha abierto", () => {
    expect(estadoDe({ ...base, abre: "2026-09-01T00:00:00Z" }, AHORA)).toBe("proxima");
  });

  it("entregada manda sobre estar abierta", () => {
    // Ya la has hecho: no tiene que salirte como pendiente aunque quede plazo.
    expect(estadoDe({ ...base, entregada: true }, AHORA)).toBe("entregada");
    expect(esPendiente({ estado: "entregada" })).toBe(false);
  });

  it("sin ninguna fecha se da por abierta", () => {
    expect(estadoDe({}, AHORA)).toBe("abierta");
  });

  it("si no hay cierre, manda la fecha de entrega", () => {
    expect(estadoDe({ entrega: "2026-01-01T00:00:00Z" }, AHORA)).toBe("cerrada");
  });
});

describe("normalizar lo que devuelve el Aula Virtual", () => {
  const sitios = [
    { id: "6584_G_2025_N_N", titulo: "(6584) FUNDAMENTOS DE REDES DE DATOS  [25/26]" },
    { id: "6592_G_2024_N_N", titulo: "(6592) PROCESAMIENTO DE IMAGEN  [24/25]" },
  ];
  const tareas = [
    { id: "a1", titulo: "Práctica 3", contexto: "6584_G_2025_N_N", entrega: "2026-08-10T00:00:00Z" },
    { id: "a2", titulo: "Examen mayo", contexto: "6592_G_2024_N_N", cierra: "2026-05-15T00:00:00Z" },
    { id: "a3", titulo: "Práctica 1", contexto: "6584_G_2025_N_N", entrega: "2026-08-01T00:00:00Z" },
    { id: "a4", titulo: "Borrador", contexto: "6584_G_2025_N_N", borrador: true },
    // Un sitio que no vino en site.json: pasa cuando falta el _limit.
    { id: "a5", titulo: "Huérfana", contexto: "6600_G_2025_N_N", entrega: "2026-08-20T00:00:00Z" },
  ];

  const lista = normalizarTareas({ tareas, sitios }, AHORA);

  it("descarta los borradores", () => {
    expect(lista.map((t) => t.id)).not.toContain("a4");
    expect(lista).toHaveLength(4);
  });

  it("resuelve el nombre y el curso de la asignatura", () => {
    const t = lista.find((x) => x.id === "a1");
    expect(t.asignatura).toBe("Fundamentos de Redes de Datos");
    expect(t.curso).toBe("25/26");
    expect(t.codigo).toBe("6584");
  });

  it("una tarea de un sitio desconocido no se pierde", () => {
    const t = lista.find((x) => x.id === "a5");
    expect(t).toBeTruthy();
    expect(t.asignatura).toBeTruthy();
  });

  it("pone las pendientes primero y por plazo más cercano", () => {
    expect(lista.map((t) => t.id)).toEqual(["a3", "a1", "a5", "a2"]);
  });

  it("cada tarea lleva el enlace a su asignatura", () => {
    expect(lista[0].url).toBe("https://aulavirtual.um.es/portal/site/6584_G_2025_N_N");
  });

  it("aguanta que no llegue nada", () => {
    expect(normalizarTareas()).toEqual([]);
    expect(normalizarTareas({ tareas: [], sitios: [] })).toEqual([]);
  });

  it("agrupa por asignatura con las que tienen pendientes arriba", () => {
    const grupos = agruparPorAsignatura(lista);
    expect(grupos[0].asignatura).toBe("Fundamentos de Redes de Datos");
    expect(grupos[0].pendientes).toBe(2);
    expect(grupos.at(-1).pendientes).toBe(0); // Procesamiento de Imagen, cerrada
  });
});

describe("pasar una tarea del Aula Virtual a las tuyas", () => {
  const tarea = {
    id: "a1",
    titulo: "Práctica 3",
    asignatura: "Deep Learning",
    entrega: "2026-08-10T00:00:00Z",
  };

  it("traduce la asignatura a la de la app", () => {
    expect(aTareaDeApp(tarea, SUBJECTS)).toMatchObject({
      aulaId: "a1",
      text: "Práctica 3",
      subject: "Deep Learning",
      done: false,
    });
  });

  it("si no es una de las tuyas, conserva el nombre del Aula Virtual", () => {
    const otra = { ...tarea, asignatura: "Procesamiento de Imagen" };
    expect(aTareaDeApp(otra, SUBJECTS).subject).toBe("Procesamiento de Imagen");
  });

  it("no se añade dos veces al volver a sincronizar", () => {
    const mias = [aTareaDeApp(tarea, SUBJECTS)];
    expect(yaAnadida(mias, "a1")).toBe(true);
    expect(tareasQueFaltan([tarea], mias)).toEqual([]);
  });

  it("una tarea tuya de siempre no estorba", () => {
    // Las que escribes a mano no tienen aulaId y no deben contar como puestas.
    const mias = [{ id: 1, text: "Repasar apuntes", subject: "Deep Learning", done: false }];
    expect(yaAnadida(mias, "a1")).toBe(false);
    expect(tareasQueFaltan([tarea], mias)).toHaveLength(1);
  });
});
