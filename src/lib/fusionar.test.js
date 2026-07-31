import { describe, it, expect } from "vitest";
import {
  formaDe,
  sellar,
  fusionar,
  podarTumbas,
  metaVacia,
  meterEnSobre,
  abrirSobre,
} from "./fusionar";

const T = {
  antiguo: "2026-07-01T10:00:00.000Z",
  medio: "2026-07-15T10:00:00.000Z",
  nuevo: "2026-07-30T10:00:00.000Z",
};

const ids = (r) => r.valor.map((x) => x.id);

describe("formaDe", () => {
  it("array de objetos con id es una lista", () => {
    expect(formaDe([{ id: 1 }, { id: "a-b" }])).toBe("lista");
  });

  it("el array vacío cuenta como lista", () => {
    // Es "lo he borrado todo aquí": tratarlo como suelto anularía las tumbas.
    expect(formaDe([])).toBe("lista");
  });

  it("array sin ids es suelto", () => {
    // Los partidos de tenis se regeneran enteros al pegar el acta.
    expect(formaDe([{ jugador: "A" }, { jugador: "B" }])).toBe("suelto");
    expect(formaDe([1, 2, 3])).toBe("suelto");
  });

  it("objeto llano es un mapa", () => {
    expect(formaDe({ nombre: "Quico", metaAgua: 2 })).toBe("mapa");
  });

  it("los escalares son sueltos", () => {
    expect(formaDe(800)).toBe("suelto");
    expect(formaDe("oficina")).toBe("suelto");
    expect(formaDe(null)).toBe("suelto");
    expect(formaDe(undefined)).toBe("suelto");
  });
});

describe("sellar", () => {
  it("marca lo nuevo con la hora de ahora", () => {
    const meta = sellar([], [{ id: "a" }], metaVacia(), T.nuevo);
    expect(meta.tocado).toEqual({ a: T.nuevo });
  });

  it("respeta la marca de lo que no ha cambiado", () => {
    const previa = { tocado: { a: T.antiguo }, borrado: {} };
    const meta = sellar([{ id: "a", v: 1 }], [{ id: "a", v: 1 }, { id: "b" }], previa, T.nuevo);
    expect(meta.tocado.a).toBe(T.antiguo); // intacto
    expect(meta.tocado.b).toBe(T.nuevo);
  });

  it("re-marca lo que sí ha cambiado", () => {
    const previa = { tocado: { a: T.antiguo }, borrado: {} };
    const meta = sellar([{ id: "a", v: 1 }], [{ id: "a", v: 2 }], previa, T.nuevo);
    expect(meta.tocado.a).toBe(T.nuevo);
  });

  it("lo que desaparece deja tumba", () => {
    const meta = sellar([{ id: "a" }, { id: "b" }], [{ id: "a" }], metaVacia(), T.nuevo);
    expect(meta.borrado).toEqual({ b: T.nuevo });
    expect(meta.tocado.b).toBeUndefined();
  });

  it("si vuelve algo enterrado, se levanta la tumba (deshacer)", () => {
    const previa = { tocado: {}, borrado: { b: T.antiguo } };
    const meta = sellar([], [{ id: "b" }], previa, T.nuevo);
    expect(meta.borrado.b).toBeUndefined();
    expect(meta.tocado.b).toBe(T.nuevo);
  });

  it("con valores sueltos no inventa marcas", () => {
    const meta = sellar(800, 900, metaVacia(), T.nuevo);
    expect(meta.tocado).toEqual({});
  });
});

describe("fusionar listas: el caso que perdía datos", () => {
  it("dos elementos distintos, cada uno en un dispositivo, se conservan LOS DOS", () => {
    // Apuntas un gasto en el móvil y otro en el PC. Antes uno de los dos
    // desaparecía; es exactamente lo que viene a arreglar todo esto.
    const movil = {
      valor: [{ id: "gasto-movil", concepto: "Café" }],
      meta: { tocado: { "gasto-movil": T.medio }, borrado: {} },
    };
    const pc = {
      valor: [{ id: "gasto-pc", concepto: "Libro" }],
      meta: { tocado: { "gasto-pc": T.nuevo }, borrado: {} },
    };

    const r = fusionar(movil, pc);
    expect(ids(r).sort()).toEqual(["gasto-movil", "gasto-pc"]);
  });

  it("da igual el orden en que se fusione", () => {
    const a = { valor: [{ id: "a" }], meta: { tocado: { a: T.medio }, borrado: {} } };
    const b = { valor: [{ id: "b" }], meta: { tocado: { b: T.nuevo }, borrado: {} } };
    expect(ids(fusionar(a, b)).sort()).toEqual(ids(fusionar(b, a)).sort());
  });

  it("tres dispositivos, tres elementos: no se pierde ninguno", () => {
    const uno = { valor: [{ id: "1" }], meta: { tocado: { 1: T.antiguo }, borrado: {} } };
    const dos = { valor: [{ id: "2" }], meta: { tocado: { 2: T.medio }, borrado: {} } };
    const tres = { valor: [{ id: "3" }], meta: { tocado: { 3: T.nuevo }, borrado: {} } };

    const parcial = fusionar(uno, dos);
    const total = fusionar({ ...parcial, sello: T.medio }, tres);
    expect(ids(total).sort()).toEqual(["1", "2", "3"]);
  });

  it("el mismo elemento editado en dos sitios: gana el más reciente", () => {
    const a = {
      valor: [{ id: "x", monto: 10 }],
      meta: { tocado: { x: T.antiguo }, borrado: {} },
    };
    const b = {
      valor: [{ id: "x", monto: 99 }],
      meta: { tocado: { x: T.nuevo }, borrado: {} },
    };
    expect(fusionar(a, b).valor).toEqual([{ id: "x", monto: 99 }]);
    expect(fusionar(b, a).valor).toEqual([{ id: "x", monto: 99 }]);
  });

  it("mantiene el orden local y añade lo de fuera al final", () => {
    const a = {
      valor: [{ id: "a1" }, { id: "a2" }],
      meta: { tocado: { a1: T.medio, a2: T.medio }, borrado: {} },
    };
    const b = { valor: [{ id: "b1" }], meta: { tocado: { b1: T.nuevo }, borrado: {} } };
    expect(ids(fusionar(a, b))).toEqual(["a1", "a2", "b1"]);
  });

  it("los ids numéricos de antes y los nuevos de texto conviven", () => {
    const a = { valor: [{ id: 1785492247123 }], meta: { tocado: { 1785492247123: T.medio }, borrado: {} } };
    const b = { valor: [{ id: "m8x3k2-a4f9c1de" }], meta: { tocado: { "m8x3k2-a4f9c1de": T.nuevo }, borrado: {} } };
    expect(fusionar(a, b).valor).toHaveLength(2);
  });
});

describe("fusionar listas: borrados", () => {
  it("lo borrado en un dispositivo NO resucita desde el otro", () => {
    const movilQueBorro = { valor: [], meta: { tocado: {}, borrado: { x: T.nuevo } } };
    const pcDesactualizado = {
      valor: [{ id: "x", concepto: "Ya no existe" }],
      meta: { tocado: { x: T.antiguo }, borrado: {} },
    };
    expect(fusionar(movilQueBorro, pcDesactualizado).valor).toEqual([]);
    expect(fusionar(pcDesactualizado, movilQueBorro).valor).toEqual([]);
  });

  it("pero si se vuelve a editar DESPUÉS de borrarlo, se queda", () => {
    // Borras en el móvil y luego, en el PC, lo tocas: prevalece lo último.
    const borro = { valor: [], meta: { tocado: {}, borrado: { x: T.medio } } };
    const edito = {
      valor: [{ id: "x", concepto: "Recuperado" }],
      meta: { tocado: { x: T.nuevo }, borrado: {} },
    };
    expect(fusionar(borro, edito).valor).toEqual([{ id: "x", concepto: "Recuperado" }]);
  });

  it("borrar en un sitio no se lleva por delante lo añadido en el otro", () => {
    const a = { valor: [{ id: "queda" }], meta: { tocado: { queda: T.nuevo }, borrado: { fuera: T.nuevo } } };
    const b = {
      valor: [{ id: "fuera" }, { id: "nuevo" }],
      meta: { tocado: { fuera: T.antiguo, nuevo: T.nuevo }, borrado: {} },
    };
    expect(ids(fusionar(a, b)).sort()).toEqual(["nuevo", "queda"]);
  });

  it("borrarlo todo en un dispositivo se respeta", () => {
    const vacio = { valor: [], meta: { tocado: {}, borrado: { a: T.nuevo, b: T.nuevo } } };
    const lleno = {
      valor: [{ id: "a" }, { id: "b" }],
      meta: { tocado: { a: T.antiguo, b: T.antiguo }, borrado: {} },
    };
    expect(fusionar(vacio, lleno).valor).toEqual([]);
  });
});

describe("fusionar mapas", () => {
  it("dos ajustes distintos, cada uno en un dispositivo, se conservan", () => {
    const a = { valor: { nombre: "Quico" }, meta: { tocado: { nombre: T.nuevo }, borrado: {} } };
    const b = { valor: { metaAgua: 3 }, meta: { tocado: { metaAgua: T.medio }, borrado: {} } };
    expect(fusionar(a, b).valor).toEqual({ nombre: "Quico", metaAgua: 3 });
  });

  it("la misma clave en los dos: gana la más reciente", () => {
    const a = { valor: { metaAgua: 2 }, meta: { tocado: { metaAgua: T.antiguo }, borrado: {} } };
    const b = { valor: { metaAgua: 3 }, meta: { tocado: { metaAgua: T.nuevo }, borrado: {} } };
    expect(fusionar(a, b).valor).toEqual({ metaAgua: 3 });
  });

  it("horas de estudio de asignaturas distintas se suman al conjunto", () => {
    const a = { valor: { Álgebra: 4 }, meta: { tocado: { Álgebra: T.medio }, borrado: {} } };
    const b = { valor: { Redes: 2 }, meta: { tocado: { Redes: T.nuevo }, borrado: {} } };
    expect(fusionar(a, b).valor).toEqual({ Álgebra: 4, Redes: 2 });
  });
});

describe("fusionar sueltos", () => {
  it("gana el sello más reciente", () => {
    const a = { valor: 800, meta: metaVacia(), sello: T.antiguo };
    const b = { valor: 950, meta: metaVacia(), sello: T.nuevo };
    expect(fusionar(a, b).valor).toBe(950);
    expect(fusionar(b, a).valor).toBe(950);
  });

  it("un array sin ids se sustituye entero, no se mezcla", () => {
    // Los partidos salen de pegar el acta: media lista de cada sitio no
    // significaría nada.
    const a = { valor: [{ jugador: "A" }], meta: metaVacia(), sello: T.antiguo };
    const b = { valor: [{ jugador: "B" }], meta: metaVacia(), sello: T.nuevo };
    expect(fusionar(a, b).valor).toEqual([{ jugador: "B" }]);
  });

  it("si las formas no coinciden, no inventa una mezcla", () => {
    const a = { valor: [{ id: "x" }], meta: metaVacia(), sello: T.antiguo };
    const b = { valor: "otra cosa", meta: metaVacia(), sello: T.nuevo };
    expect(fusionar(a, b).valor).toBe("otra cosa");
  });
});

describe("podarTumbas", () => {
  const ahora = new Date("2026-07-31T00:00:00.000Z").getTime();

  it("quita las tumbas más viejas que el plazo", () => {
    const meta = { tocado: {}, borrado: { vieja: "2026-01-01T00:00:00.000Z" } };
    expect(podarTumbas(meta, ahora).borrado).toEqual({});
  });

  it("conserva las recientes", () => {
    const meta = { tocado: {}, borrado: { nueva: "2026-07-30T00:00:00.000Z" } };
    expect(podarTumbas(meta, ahora).borrado).toHaveProperty("nueva");
  });

  it("no toca las marcas de lo vivo", () => {
    const meta = { tocado: { a: T.antiguo }, borrado: {} };
    expect(podarTumbas(meta, ahora).tocado).toEqual({ a: T.antiguo });
  });
});

describe("sobre para la nube", () => {
  it("mete y saca sin cambiar nada", () => {
    const valor = [{ id: "a", v: 1 }];
    const meta = { tocado: { a: T.nuevo }, borrado: {} };
    expect(abrirSobre(meterEnSobre(valor, meta))).toEqual({ valor, meta });
  });

  it("acepta lo guardado ANTES de este cambio (valor pelado)", () => {
    // Nadie tiene que migrar nada: lo viejo entra con las marcas vacías y se
    // va sellando conforme se toca.
    const antiguo = [{ id: "a", v: 1 }];
    expect(abrirSobre(antiguo)).toEqual({ valor: antiguo, meta: metaVacia() });
  });

  it("acepta escalares antiguos", () => {
    expect(abrirSobre(800)).toEqual({ valor: 800, meta: metaVacia() });
    expect(abrirSobre(null)).toEqual({ valor: null, meta: metaVacia() });
  });
});

describe("ciclo completo: dos dispositivos de verdad", () => {
  it("móvil y PC apuntan a la vez y al sincronizar están las dos cosas", () => {
    const inicial = [{ id: "viejo", concepto: "De antes" }];
    const metaInicial = { tocado: { viejo: T.antiguo }, borrado: {} };

    // El móvil añade uno
    const movilValor = [{ id: "movil", concepto: "Café" }, ...inicial];
    const movilMeta = sellar(inicial, movilValor, metaInicial, T.medio);

    // El PC, sin haber visto lo del móvil, añade otro
    const pcValor = [{ id: "pc", concepto: "Libro" }, ...inicial];
    const pcMeta = sellar(inicial, pcValor, metaInicial, T.nuevo);

    const r = fusionar(
      { valor: movilValor, meta: movilMeta, sello: T.medio },
      { valor: pcValor, meta: pcMeta, sello: T.nuevo }
    );

    expect(ids(r).sort()).toEqual(["movil", "pc", "viejo"]);
  });

  it("y si además uno borra algo, el borrado también se respeta", () => {
    const inicial = [{ id: "a" }, { id: "b" }];
    const metaInicial = { tocado: { a: T.antiguo, b: T.antiguo }, borrado: {} };

    // El móvil borra "b"
    const movilValor = [{ id: "a" }];
    const movilMeta = sellar(inicial, movilValor, metaInicial, T.medio);

    // El PC añade "c" sin enterarse
    const pcValor = [...inicial, { id: "c" }];
    const pcMeta = sellar(inicial, pcValor, metaInicial, T.nuevo);

    const r = fusionar(
      { valor: movilValor, meta: movilMeta, sello: T.medio },
      { valor: pcValor, meta: pcMeta, sello: T.nuevo }
    );

    expect(ids(r).sort()).toEqual(["a", "c"]); // "b" sigue borrado
  });

  it("fusionar dos veces seguidas da lo mismo (es estable)", () => {
    const a = { valor: [{ id: "a" }], meta: { tocado: { a: T.medio }, borrado: {} }, sello: T.medio };
    const b = { valor: [{ id: "b" }], meta: { tocado: { b: T.nuevo }, borrado: {} }, sello: T.nuevo };

    const una = fusionar(a, b);
    const dos = fusionar({ ...una, sello: T.nuevo }, b);
    expect(ids(dos).sort()).toEqual(ids(una).sort());
  });
});
