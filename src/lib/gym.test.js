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
  catalogo,
  descripcionDe,
  esPersonalizado,
  sesionDe,
  sesionTerminada,
  abrirSesion,
  cerrarSesion,
  reabrirSesion,
  duracionMinutos,
  formatearDuracion,
  resumenDelDia,
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

describe("ejercicios propios", () => {
  const mios = [
    { id: 1, nombre: "Press en multipower", grupo: "Pecho", descripcion: "Banco a 30 grados" },
    { id: 2, nombre: "Movilidad de cadera", grupo: "Otro", descripcion: "" },
  ];

  it("sin ejercicios propios, el catálogo es el de serie", () => {
    const c = catalogo();
    expect(c.Pecho).toContain("Press banca");
    // "Otro" solo aparece si tienes ejercicios propios que no encajan.
    expect(c).not.toHaveProperty("Otro");
  });

  it("mete los tuyos en su grupo, junto a los de serie", () => {
    const c = catalogo(mios);
    expect(c.Pecho).toContain("Press banca"); // sigue estando el de serie
    expect(c.Pecho).toContain("Press en multipower"); // y el tuyo
    expect(c.Otro).toEqual(["Movilidad de cadera"]);
  });

  it("un grupo inventado cae en Otro", () => {
    const c = catalogo([{ id: 3, nombre: "Cosa rara", grupo: "Grupo que no existe" }]);
    expect(c.Otro).toContain("Cosa rara");
  });

  it("no duplica si repites el nombre de uno de serie", () => {
    const c = catalogo([{ id: 4, nombre: "Sentadilla", grupo: "Piernas" }]);
    expect(c.Piernas.filter((n) => n === "Sentadilla")).toHaveLength(1);
  });

  it("ignora los que no tienen nombre", () => {
    const c = catalogo([{ id: 5, grupo: "Pecho" }, null].filter(Boolean));
    expect(c.Pecho).toEqual(catalogo().Pecho);
  });

  it("grupoDe y descripcionDe reconocen los tuyos", () => {
    expect(grupoDe("Press en multipower", mios)).toBe("Pecho");
    expect(descripcionDe("Press en multipower", mios)).toBe("Banco a 30 grados");
    expect(esPersonalizado("Press en multipower", mios)).toBe(true);
    expect(esPersonalizado("Press banca", mios)).toBe(false);
  });

  it("los de serie no tienen descripción", () => {
    expect(descripcionDe("Press banca", mios)).toBe("");
  });

  it("borrar un ejercicio propio no afecta al histórico ya registrado", () => {
    // El histórico guarda el NOMBRE, no una referencia, justamente para esto.
    const filas = [{ fecha: "2026-07-01", ejercicio: "Press en multipower", sets: [{ peso: 60, reps: 8 }] }];
    expect(evolucion(filas, "Press en multipower")).toHaveLength(1);
    expect(recordsPorEjercicio(filas)[0][0]).toBe("Press en multipower");
    // Y su grupo pasa a "Otro" al no encontrarlo, sin romper nada.
    expect(grupoDe("Press en multipower", [])).toBe("Otro");
  });
});

describe("sesiones", () => {
  const HOY = "2026-07-29";
  const alas = (hora) => new Date(`${HOY}T${hora}:00`);

  it("abrir marca el inicio y es idempotente", () => {
    const uno = abrirSesion([], HOY, alas("18:00"));
    expect(sesionDe(uno, HOY).inicio).toBe(alas("18:00").toISOString());

    // Se llama al añadir CADA ejercicio: la segunda vez no debe reiniciar el
    // cronómetro ni duplicar la sesión.
    const dos = abrirSesion(uno, HOY, alas("18:40"));
    expect(dos).toBe(uno);
    expect(dos).toHaveLength(1);
  });

  it("cerrar deja la sesión terminada con su duración", () => {
    const s = cerrarSesion(abrirSesion([], HOY, alas("18:00")), HOY, alas("19:15"));
    expect(sesionTerminada(s, HOY)).toBe(true);
    expect(duracionMinutos(sesionDe(s, HOY))).toBe(75);
  });

  it("reanudar la reabre sin perder el inicio", () => {
    const cerrada = cerrarSesion(abrirSesion([], HOY, alas("18:00")), HOY, alas("19:00"));
    const abierta = reabrirSesion(cerrada, HOY);
    expect(sesionTerminada(abierta, HOY)).toBe(false);
    expect(sesionDe(abierta, HOY).inicio).toBe(alas("18:00").toISOString());
  });

  it("cada día tiene la suya y no se pisan", () => {
    const s = cerrarSesion(abrirSesion(abrirSesion([], "2026-07-28"), HOY), HOY);
    expect(sesionTerminada(s, HOY)).toBe(true);
    expect(sesionTerminada(s, "2026-07-28")).toBe(false);
    expect(sesionDe(s, "2026-01-01")).toBe(null);
  });

  it("un día de antes de que existieran las sesiones se puede cerrar igual", () => {
    // No tiene inicio, así que no hay duración, pero sí queda terminado.
    const s = cerrarSesion([], "2026-01-15", alas("19:00"));
    expect(sesionTerminada(s, "2026-01-15")).toBe(true);
    expect(duracionMinutos(sesionDe(s, "2026-01-15"))).toBe(null);
  });

  it("una sesión abierta cuenta hasta ahora", () => {
    const s = abrirSesion([], HOY, alas("18:00"));
    expect(duracionMinutos(sesionDe(s, HOY), alas("18:45"))).toBe(45);
  });

  it("una sesión olvidada abierta no inventa una duración absurda", () => {
    // Se queda abierta y se mira al día siguiente: 19 h de entreno no es un
    // dato, es un despiste. Mejor no enseñar nada.
    const s = abrirSesion([], HOY, alas("18:00"));
    expect(duracionMinutos(sesionDe(s, HOY), new Date("2026-07-30T13:00:00"))).toBe(null);
  });

  it("formatea la duración en horas y minutos", () => {
    expect(formatearDuracion(45)).toBe("45 min");
    expect(formatearDuracion(60)).toBe("1 h");
    expect(formatearDuracion(95)).toBe("1 h 35 min");
    expect(formatearDuracion(null)).toBe("");
  });

  it("resumenDelDia cuenta solo las filas de ese día", () => {
    const filas = [
      { fecha: HOY, ejercicio: "Press banca", sets: [{ peso: 60, reps: 10 }, { peso: 60, reps: 8 }] },
      { fecha: HOY, ejercicio: "Dominadas", sets: [{ peso: 0, reps: 10 }] },
      { fecha: "2026-07-28", ejercicio: "Sentadilla", sets: [{ peso: 100, reps: 5 }] },
    ];
    expect(resumenDelDia(filas, HOY)).toEqual({ ejercicios: 2, series: 3, volumen: 1080 });
  });
});
