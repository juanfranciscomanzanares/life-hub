// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import { useEffect } from "react";

/*
  Tests de la sincronización de verdad, montando `usePersisted`.

  Los de fusionar.test.js prueban la lógica pura; estos prueban el CABLEADO, que
  es donde estaba el peligro:

  1. Que dos componentes de la misma pestaña con la misma clave no se pisen. Es
     el escenario del botón + : tienes Finanzas abierta y añades un gasto desde
     el añadido rápido. Antes de arreglarlo, la instancia de Finanzas seguía con
     la lista vieja y, al editar cualquier cosa, veía que "faltaba" el gasto
     nuevo y le ponía una TUMBA. Con la fusión por elemento esa tumba viaja a
     todos los dispositivos: el gasto desaparecería para siempre.
  2. Que lo que llega del servidor se FUSIONA con lo local en vez de sustituirlo.
  3. Que si al servidor le falta algo nuestro, se le vuelve a subir la unión.
*/

const HORA_SERVIDOR = "2026-07-28T12:00:00.000Z";

const canales = [];
const porTopic = new Map();
const upserts = [];
let respuestaLectura = { data: null, error: null };

vi.mock("./supabase", () => ({
  cloudEnabled: true,
  supabase: {
    channel(topic) {
      if (porTopic.has(topic)) return porTopic.get(topic);
      const canal = {
        topic,
        manejador: null,
        eliminado: false,
        on(_e, _f, cb) {
          this.manejador = cb;
          return this;
        },
        subscribe() {
          return this;
        },
      };
      canales.push(canal);
      porTopic.set(topic, canal);
      return canal;
    },
    removeChannel(canal) {
      canal.eliminado = true;
      porTopic.delete(canal.topic);
    },
    auth: {
      getSession: async () => ({ data: { session: { user: { id: "u1" } } } }),
    },
    from() {
      return {
        select() {
          return this;
        },
        eq() {
          return this;
        },
        async maybeSingle() {
          return respuestaLectura;
        },
        upsert(fila) {
          upserts.push(fila);
          return this;
        },
        async single() {
          return { data: { updated_at: HORA_SERVIDOR }, error: null };
        },
      };
    },
  },
}));

const { usePersisted, RETARDO_GUARDADO } = await import("./store");
const { meterEnSobre } = await import("./fusionar");

/* Un componente mínimo que enseña la lista y deja escribir desde fuera. */
function Lista({ clave, etiqueta, alMontar }) {
  const [filas, setFilas] = usePersisted(clave, []);
  useEffect(() => {
    if (alMontar) alMontar(setFilas);
  }, [alMontar, setFilas]);
  return (
    <div data-testid={etiqueta}>{filas.map((f) => f.concepto).join(",") || "(vacío)"}</div>
  );
}

const leer = (etiqueta) => screen.getByTestId(etiqueta).textContent;

beforeEach(() => {
  localStorage.clear();
  canales.length = 0;
  porTopic.clear();
  upserts.length = 0;
  respuestaLectura = { data: null, error: null };
});

afterEach(() => {
  // Explícito porque esta config no usa `globals: true`, y sin él los
  // componentes de un test siguen montados en el siguiente.
  cleanup();
  vi.useRealTimers();
});

describe("dos componentes de la misma pestaña con la misma clave", () => {
  it("lo que escribe uno aparece en el otro", async () => {
    let escribirEnA;
    render(
      <>
        <Lista clave="lh_finance" etiqueta="a" alMontar={(s) => (escribirEnA = s)} />
        <Lista clave="lh_finance" etiqueta="b" />
      </>
    );

    await act(async () => {
      escribirEnA([{ id: "x1", concepto: "Café" }]);
    });

    expect(leer("a")).toBe("Café");
    // Sin el aviso dentro de la pestaña, esta seguiría en "(vacío)".
    expect(leer("b")).toBe("Café");
  });

  it("y el segundo NO entierra lo que añadió el primero", async () => {
    // El fallo que esto vigila: el añadido rápido mete un gasto, la sección
    // sigue con la lista vieja, editas algo allí y el gasto nuevo se va con una
    // tumba a todos tus dispositivos.
    let escribirEnRapido;
    let escribirEnSeccion;
    render(
      <>
        <Lista clave="lh_finance" etiqueta="seccion" alMontar={(s) => (escribirEnSeccion = s)} />
        <Lista clave="lh_finance" etiqueta="rapido" alMontar={(s) => (escribirEnRapido = s)} />
      </>
    );

    // El añadido rápido mete un gasto.
    await act(async () => {
      escribirEnRapido([{ id: "del-rapido", concepto: "Café" }]);
    });

    // Ahora la sección añade el suyo, partiendo de lo que tiene en pantalla.
    await act(async () => {
      escribirEnSeccion((previas) => [...previas, { id: "de-seccion", concepto: "Libro" }]);
    });

    expect(leer("seccion")).toBe("Café,Libro");

    // Y lo importante: ninguna tumba. Si la hubiera, el gasto del añadido
    // rápido desaparecería en el siguiente dispositivo que sincronizara.
    const meta = JSON.parse(localStorage.getItem("lh_sync:lh_finance"));
    expect(meta.borrado).toEqual({});
  });

  it("después de recibir de fuera, el siguiente cambio propio SÍ se sella", async () => {
    /*
      Regresión de un fallo que solo se vio probándolo en el navegador. La
      bandera de "esto viene de fuera" se limpiaba después de una salida
      temprana del efecto, así que se quedaba puesta: el siguiente cambio de
      verdad del usuario se guardaba en el navegador pero SIN marca de tiempo, y
      sin marca no se sube nunca a la nube. En pantalla se veía bien; el dato
      simplemente no llegaba a los otros dispositivos.
    */
    let escribirEnA;
    let escribirEnB;
    render(
      <>
        <Lista clave="lh_finance" etiqueta="a" alMontar={(s) => (escribirEnA = s)} />
        <Lista clave="lh_finance" etiqueta="b" alMontar={(s) => (escribirEnB = s)} />
      </>
    );

    // B escribe; A lo recibe por el aviso de la pestaña.
    await act(async () => {
      escribirEnB([{ id: "de-b", concepto: "Café" }]);
    });

    // Y ahora A hace un cambio SUYO.
    await act(async () => {
      escribirEnA((p) => [...p, { id: "de-a", concepto: "Libro" }]);
    });

    const meta = JSON.parse(localStorage.getItem("lh_sync:lh_finance"));
    expect(meta.tocado).toHaveProperty("de-a"); // sin esto, no subiría jamás
    expect(meta.tocado).toHaveProperty("de-b");
  });

  it("un borrado de verdad sí deja tumba", async () => {
    let escribir;
    render(<Lista clave="lh_finance" etiqueta="a" alMontar={(s) => (escribir = s)} />);

    await act(async () => {
      escribir([{ id: "x1", concepto: "Café" }, { id: "x2", concepto: "Libro" }]);
    });
    await act(async () => {
      escribir((p) => p.filter((f) => f.id !== "x2"));
    });

    expect(leer("a")).toBe("Café");
    const meta = JSON.parse(localStorage.getItem("lh_sync:lh_finance"));
    expect(Object.keys(meta.borrado)).toEqual(["x2"]);
  });
});

describe("lo que llega del servidor", () => {
  it("se FUSIONA con lo local en vez de sustituirlo", async () => {
    let escribir;
    render(<Lista clave="lh_finance" etiqueta="a" alMontar={(s) => (escribir = s)} />);

    // Este dispositivo apunta un gasto.
    await act(async () => {
      escribir([{ id: "mio", concepto: "Café" }]);
    });

    // Y llega por tiempo real un gasto de OTRO dispositivo.
    const canal = canales.find((c) => c.topic.startsWith("app_state:lh_finance"));
    await act(async () => {
      canal.manejador({
        new: {
          value: meterEnSobre([{ id: "suyo", concepto: "Libro" }], {
            tocado: { suyo: "2026-07-29T10:00:00.000Z" },
            borrado: {},
          }),
          updated_at: "2026-07-29T10:00:00.000Z",
        },
      });
    });

    // Antes de esto, el gasto local desaparecía. Ahora están los dos.
    expect(leer("a")).toContain("Café");
    expect(leer("a")).toContain("Libro");
  });

  it("si al servidor le falta algo nuestro, se le sube la unión", async () => {
    vi.useFakeTimers();
    let escribir;
    render(<Lista clave="lh_finance" etiqueta="a" alMontar={(s) => (escribir = s)} />);

    await act(async () => {
      escribir([{ id: "mio", concepto: "Café" }]);
    });
    await act(async () => {
      await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO + 10);
    });
    upserts.length = 0;

    // Otro dispositivo publica SOLO lo suyo (no había visto lo nuestro).
    const canal = canales.find((c) => c.topic.startsWith("app_state:lh_finance"));
    await act(async () => {
      canal.manejador({
        new: {
          value: meterEnSobre([{ id: "suyo", concepto: "Libro" }], {
            tocado: { suyo: "2026-07-29T10:00:00.000Z" },
            borrado: {},
          }),
          updated_at: "2026-07-29T10:00:00.000Z",
        },
      });
      await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO + 10);
    });

    // Esto es lo que cierra la carrera de "los dos escriben a la vez": el que
    // se entera segundo publica la unión y los dos acaban con lo mismo.
    expect(upserts.length).toBeGreaterThan(0);
    const subido = upserts[upserts.length - 1].value.datos.map((f) => f.id).sort();
    expect(subido).toEqual(["mio", "suyo"]);
  });

  it("un borrado remoto no resucita por tener el dato en local", async () => {
    let escribir;
    render(<Lista clave="lh_finance" etiqueta="a" alMontar={(s) => (escribir = s)} />);

    await act(async () => {
      escribir([{ id: "x1", concepto: "Café" }]);
    });

    // Otro dispositivo lo borró: llega el hueco CON su tumba.
    const canal = canales.find((c) => c.topic.startsWith("app_state:lh_finance"));
    await act(async () => {
      canal.manejador({
        new: {
          value: meterEnSobre([], { tocado: {}, borrado: { x1: "2099-01-01T00:00:00.000Z" } }),
          updated_at: "2099-01-01T00:00:00.000Z",
        },
      });
    });

    expect(leer("a")).toBe("(vacío)");
  });
});

describe("compatibilidad con lo ya guardado", () => {
  it("lee lo que hay en la nube sin sobre (formato anterior)", async () => {
    respuestaLectura = {
      data: {
        value: [{ id: "viejo", concepto: "De antes" }], // valor pelado, sin marcas
        updated_at: "2026-07-20T10:00:00.000Z",
      },
      error: null,
    };

    render(<Lista clave="lh_finance" etiqueta="a" />);
    await act(async () => {});

    expect(leer("a")).toBe("De antes");
  });

  it("en localStorage el valor sigue guardándose pelado", async () => {
    // La paleta de comandos y las copias de seguridad leen estas claves
    // directamente: si aquí apareciera el sobre, se romperían.
    let escribir;
    render(<Lista clave="lh_finance" etiqueta="a" alMontar={(s) => (escribir = s)} />);

    await act(async () => {
      escribir([{ id: "x1", concepto: "Café" }]);
    });

    expect(JSON.parse(localStorage.getItem("lh_finance"))).toEqual([
      { id: "x1", concepto: "Café" },
    ]);
  });
});
