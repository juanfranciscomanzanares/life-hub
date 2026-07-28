import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

/*
  Estos tests fijan las tres propiedades de las que depende que la app aguante
  años de datos, porque cada clave guarda TODO su contenido en un único JSON:

  1. Un solo canal de tiempo real por clave (regresión del crash
     "cannot add postgres_changes callbacks ... after subscribe()").
  2. Las escrituras se agrupan: escribir 20 caracteres no son 20 subidas del
     blob completo.
  3. Las lecturas se comparten: 10 componentes con la misma clave no lanzan 10
     consultas idénticas al arrancar.
*/

const canales = [];
const porTopic = new Map();
const consultas = [];
const upserts = [];
let respuestaLectura = { data: null, error: null };

vi.mock("./supabase", () => ({
  cloudEnabled: true,
  supabase: {
    channel(topic) {
      // Igual que el Supabase real: si ya existe un canal con ese topic, lo
      // devuelve en vez de crear otro. Es justo lo que provocaba el error,
      // porque el segundo .on() caía sobre un canal ya suscrito.
      if (porTopic.has(topic)) return porTopic.get(topic);
      const canal = {
        topic,
        vecesOn: 0,
        suscrito: false,
        eliminado: false,
        manejador: null,
        on(_evento, _filtro, cb) {
          if (this.suscrito) throw new Error("cannot add postgres_changes callbacks after subscribe()");
          this.vecesOn++;
          this.manejador = cb;
          return this;
        },
        subscribe() {
          this.suscrito = true;
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
      // getSession, NO getUser: getUser haría un viaje de red extra por guardado.
      getSession: async () => ({ data: { session: { user: { id: "u1" } } } }),
    },
    from() {
      return {
        select() { return this; },
        eq(_col, key) { consultas.push(key); return this; },
        async maybeSingle() { return respuestaLectura; },
        async upsert(fila) { upserts.push(fila); return { error: null }; },
      };
    },
  },
}));

const {
  suscribirClave,
  guardarEnNubeConRetraso,
  vaciarGuardadosPendientes,
  loadCloudCompartido,
  RETARDO_GUARDADO,
} = await import("./store");

beforeEach(() => {
  canales.length = 0;
  consultas.length = 0;
  upserts.length = 0;
  respuestaLectura = { data: null, error: null };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("suscribirClave (tiempo real compartido)", () => {
  it("abre un solo canal aunque se suscriban varios componentes a la misma clave", () => {
    const cierres = [1, 2, 3].map(() => suscribirClave("lh_work_log", () => {}));

    expect(canales).toHaveLength(1);
    expect(canales[0].vecesOn).toBe(1);

    cierres.forEach((c) => c());
  });

  it("reparte el mensaje a todos los oyentes de la clave", () => {
    const recibidos = [];
    const a = suscribirClave("lh_gym", (p) => recibidos.push("a:" + p.new.value));
    const b = suscribirClave("lh_gym", (p) => recibidos.push("b:" + p.new.value));

    canales[0].manejador({ new: { value: 1 } });
    expect(recibidos).toEqual(["a:1", "b:1"]);

    a();
    b();
  });

  it("no cierra el canal mientras quede algún oyente", () => {
    const a = suscribirClave("lh_tasks", () => {});
    const b = suscribirClave("lh_tasks", () => {});

    a();
    expect(canales[0].eliminado).toBe(false);

    b();
    expect(canales[0].eliminado).toBe(true);
  });

  it("tras cerrarse, una nueva suscripción usa un topic nuevo", () => {
    // Evita chocar con un canal anterior que todavía se esté cerrando.
    suscribirClave("lh_finance", () => {})();
    suscribirClave("lh_finance", () => {})();

    expect(canales).toHaveLength(2);
    expect(canales[0].topic).not.toBe(canales[1].topic);
  });
});

describe("guardarEnNubeConRetraso (escrituras agrupadas)", () => {
  it("agrupa muchos cambios seguidos en una sola subida", async () => {
    vi.useFakeTimers();

    // Simula escribir "hola" letra a letra.
    ["h", "ho", "hol", "hola"].forEach((texto, i) =>
      guardarEnNubeConRetraso("lh_notes", texto, "2026-01-01T00:00:0" + i + "Z")
    );

    expect(upserts).toHaveLength(0); // nada sale antes de tiempo

    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO + 10);

    expect(upserts).toHaveLength(1);
    expect(upserts[0].value).toBe("hola"); // gana el último valor
    expect(upserts[0].user_id).toBe("u1");
  });

  it("funde en una sola subida los cambios de varios componentes con la misma clave", async () => {
    vi.useFakeTimers();

    guardarEnNubeConRetraso("lh_gym", ["a"], "2026-01-01T00:00:00Z");
    guardarEnNubeConRetraso("lh_gym", ["a", "b"], "2026-01-01T00:00:01Z");

    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO + 10);

    expect(upserts).toHaveLength(1);
    expect(upserts[0].value).toEqual(["a", "b"]);
  });

  it("no mezcla claves distintas", async () => {
    vi.useFakeTimers();

    guardarEnNubeConRetraso("lh_gym", 1, "2026-01-01T00:00:00Z");
    guardarEnNubeConRetraso("lh_health", 2, "2026-01-01T00:00:00Z");

    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO + 10);

    expect(upserts.map((u) => u.key).sort()).toEqual(["lh_gym", "lh_health"]);
  });

  it("vaciarGuardadosPendientes sube inmediatamente lo que esté esperando", async () => {
    vi.useFakeTimers();

    guardarEnNubeConRetraso("lh_tasks", ["pendiente"], "2026-01-01T00:00:00Z");
    expect(upserts).toHaveLength(0);

    vaciarGuardadosPendientes(); // lo que hace al ocultarse la pestaña
    await vi.advanceTimersByTimeAsync(0);

    expect(upserts).toHaveLength(1);
    expect(upserts[0].value).toEqual(["pendiente"]);

    // Y el temporizador cancelado no vuelve a subirlo.
    await vi.advanceTimersByTimeAsync(RETARDO_GUARDADO + 10);
    expect(upserts).toHaveLength(1);
  });
});

describe("loadCloudCompartido (lecturas compartidas)", () => {
  it("lanza una sola consulta aunque varios componentes pidan la misma clave", async () => {
    const promesas = [1, 2, 3].map(() => loadCloudCompartido("lh_work_log"));

    expect(new Set(promesas).size).toBe(1); // todos comparten la misma promesa
    await Promise.all(promesas);
    expect(consultas).toEqual(["lh_work_log"]);
  });

  it("permite volver a consultar una vez terminada la anterior", async () => {
    await loadCloudCompartido("lh_gym");
    await loadCloudCompartido("lh_gym");

    expect(consultas).toEqual(["lh_gym", "lh_gym"]);
  });

  it("consulta por separado claves distintas", async () => {
    await Promise.all([loadCloudCompartido("lh_notes"), loadCloudCompartido("lh_srs")]);

    expect(consultas.sort()).toEqual(["lh_notes", "lh_srs"]);
  });
});
