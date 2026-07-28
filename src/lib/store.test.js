import { describe, it, expect, vi, beforeEach } from "vitest";

/*
  Regresión del error:
    "cannot add postgres_changes callbacks for realtime:app_state:X after subscribe()"

  Muchas claves (lh_work_log, lh_gym, lh_tasks...) se usan desde varios
  componentes a la vez. Cuando cada uno abría su propio canal con el mismo
  topic, supabase devolvía el canal YA suscrito y .on() reventaba. Solo pasaba
  si el primer canal alcanzaba "joined" antes de que montara el segundo, así que
  fallaba en unos dispositivos y en otros no. Estos tests fijan el contrato:
  un único canal por clave, y .on() siempre antes de subscribe().
*/

const canales = [];
const porTopic = new Map();

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
  },
}));

const { suscribirClave } = await import("./store");

beforeEach(() => {
  canales.length = 0;
});

describe("suscribirClave (tiempo real compartido)", () => {
  it("abre un solo canal aunque se suscriban varios componentes a la misma clave", () => {
    const a = suscribirClave("lh_work_log", () => {});
    const b = suscribirClave("lh_work_log", () => {});
    const c = suscribirClave("lh_work_log", () => {});

    expect(canales).toHaveLength(1);
    expect(canales[0].vecesOn).toBe(1);

    a();
    b();
    c();
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

  it("usa canales distintos para claves distintas", () => {
    const a = suscribirClave("lh_notes", () => {});
    const b = suscribirClave("lh_health", () => {});

    expect(canales).toHaveLength(2);
    expect(canales[0].topic).not.toBe(canales[1].topic);

    a();
    b();
  });

  it("tras cerrarse, una nueva suscripción usa un topic nuevo", () => {
    // Evita chocar con un canal anterior que todavía se esté cerrando.
    suscribirClave("lh_finance", () => {})();
    suscribirClave("lh_finance", () => {})();

    expect(canales).toHaveLength(2);
    expect(canales[0].topic).not.toBe(canales[1].topic);
  });
});
