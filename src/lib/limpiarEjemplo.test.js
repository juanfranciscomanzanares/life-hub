import { describe, it, expect } from "vitest";
import { contarEjemplos, limpiarEjemplos } from "./limpiarEjemplo";

// Simula la lectura de localStorage con un objeto en memoria.
const lector = (datos) => (clave) => datos[clave];

describe("detectar los datos de ejemplo", () => {
  it("encuentra las filas de muestra de cada sección", () => {
    const datos = {
      lh_goals: [
        { id: 1, titulo: "Invertir este año", objetivo: 2000, actual: 1050, unidad: "€" },
        { id: 2, titulo: "Media de gym semanal", objetivo: 4, actual: 3, unidad: "sesiones" },
      ],
      lh_savings: [{ id: 1, label: "Portátil nuevo", target: 1200, current: 740 }],
    };
    expect(contarEjemplos(lector(datos)).total).toBe(3);
  });

  it("no cuenta nada si no hay datos", () => {
    expect(contarEjemplos(lector({})).total).toBe(0);
    expect(contarEjemplos(lector({ lh_goals: [] })).total).toBe(0);
  });

  it("aguanta que una clave guarde algo que no es una lista", () => {
    expect(contarEjemplos(lector({ lh_goals: { roto: true } })).total).toBe(0);
  });
});

describe("borrar solo lo que es de muestra", () => {
  it("quita las de ejemplo y respeta las tuyas", () => {
    const datos = {
      lh_goals: [
        { id: 1, titulo: "Invertir este año", objetivo: 2000, actual: 1050 },
        { id: 99, titulo: "Correr 10 km", objetivo: 10, actual: 4 },
      ],
    };
    expect(limpiarEjemplos(lector(datos)).lh_goals).toEqual([
      { id: 99, titulo: "Correr 10 km", objetivo: 10, actual: 4 },
    ]);
  });

  it("una fila de muestra que has EDITADO se queda", () => {
    /*
      Esto es lo que evita que la limpieza borre trabajo de verdad: si has
      cogido la meta de ejemplo y le has cambiado el objetivo, ya es tuya.
      Mejor dejar basura que borrar algo que no toca.
    */
    const datos = {
      lh_goals: [{ id: 1, titulo: "Invertir este año", objetivo: 5000, actual: 1050 }],
    };
    expect(limpiarEjemplos(lector(datos))).toEqual({});
  });

  it("una fila con el mismo id pero otro contenido se queda", () => {
    const datos = {
      lh_savings: [{ id: 1, label: "Viaje a Japón", target: 1200, current: 740 }],
    };
    expect(limpiarEjemplos(lector(datos))).toEqual({});
  });

  it("solo devuelve las claves que cambian", () => {
    const datos = {
      lh_goals: [{ id: 50, titulo: "Mía", objetivo: 1, actual: 0 }],
      lh_savings: [{ id: 1, label: "Portátil nuevo", target: 1200, current: 740 }],
    };
    const cambios = limpiarEjemplos(lector(datos));
    expect(Object.keys(cambios)).toEqual(["lh_savings"]);
    expect(cambios.lh_savings).toEqual([]);
  });

  it("borra la rutina semanal de muestra entera", () => {
    const datos = {
      lh_routine: [
        { id: 1, dia: 0, hora: "09:00", titulo: "Clases", tipo: "Universidad" },
        { id: 5, dia: 2, hora: "15:00", titulo: "Agrosana", tipo: "Trabajo" },
        { id: 800, dia: 1, hora: "10:00", titulo: "Fund. Computadores (teoría)", tipo: "Universidad" },
      ],
    };
    const quedan = limpiarEjemplos(lector(datos)).lh_routine;
    expect(quedan).toHaveLength(1);
    expect(quedan[0].titulo).toBe("Fund. Computadores (teoría)");
  });

  it("los números se comparan por valor, no por tipo", () => {
    // Al pasar por JSON o por un input, un 7 puede volver como "7".
    const datos = {
      lh_health: [{ id: 4, fecha: "2026-07-18", peso: "74.8", sueno: "7", pasos: 6100 }],
    };
    expect(limpiarEjemplos(lector(datos)).lh_health).toEqual([]);
  });
});
