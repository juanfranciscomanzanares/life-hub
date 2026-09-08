import { describe, it, expect } from "vitest";
import { PERFILES, perfilDe, navDelPerfil, idsDelPerfil, ajustesIniciales } from "./perfiles";

/* Un NAV_GROUPS de mentira con la misma forma que el de verdad: grupos con
   `items` y entradas sueltas sin ellos. */
const GRUPOS = [
  { id: "inicio", label: "Inicio" },
  { id: "universidad", label: "Universidad" },
  {
    label: "Deporte",
    items: [
      { id: "gimnasio", label: "Gimnasio" },
      { id: "tenis", label: "Resultados deportivos" },
      { id: "tenis-notas", label: "Entrenamientos" },
      { id: "salud", label: "Salud" },
    ],
  },
  {
    label: "Dinero",
    items: [{ id: "finanzas", label: "Finanzas" }],
  },
];

/* Tabla de prueba: la de verdad aún no lleva correos (falta el de Carmen), así
   que sin esto no se podría probar la resolución por correo. */
const TABLA = {
  quico: { ...PERFILES.quico, correos: ["quico@ejemplo.com"] },
  carmen: { ...PERFILES.carmen, correos: ["Carmen@Ejemplo.com"] },
};

describe("perfilDe", () => {
  it("sin correo ni elección, el perfil por defecto", () => {
    expect(perfilDe(null).id).toBe("quico");
    expect(perfilDe("").id).toBe("quico");
  });

  it("un correo desconocido no rompe: cae en el de por defecto", () => {
    expect(perfilDe("cualquiera@ejemplo.com").id).toBe("quico");
  });

  it("el correo manda sobre la elección guardada", () => {
    /*
      El caso que protege: dispositivo compartido. Carmen deja elegido su perfil
      en este navegador, cierra sesión y entra Quico. Si ganara la elección, la
      app se le quedaría rosa y sin tenis.
    */
    expect(perfilDe("quico@ejemplo.com", "carmen", TABLA).id).toBe("quico");
  });

  it("cada uno con su correo va a su perfil", () => {
    expect(perfilDe("quico@ejemplo.com", null, TABLA).id).toBe("quico");
    expect(perfilDe("carmen@ejemplo.com", null, TABLA).id).toBe("carmen");
  });

  it("la elección vale cuando el correo no coincide con nadie", () => {
    expect(perfilDe(null, "carmen").id).toBe("carmen");
    expect(perfilDe("desconocido@ejemplo.com", "carmen").id).toBe("carmen");
  });

  it("una elección inventada no tumba la app", () => {
    expect(perfilDe(null, "pepito").id).toBe("quico");
  });

  it("el correo no distingue mayúsculas ni espacios", () => {
    // En la tabla está como "Carmen@Ejemplo.com"; Supabase puede devolverlo de
    // otra forma y un perfil no puede depender de eso.
    expect(perfilDe("  carmen@ejemplo.COM ", null, TABLA).id).toBe("carmen");
  });
});

describe("navDelPerfil", () => {
  it("el perfil sin exclusiones ve la navegación entera", () => {
    expect(navDelPerfil(GRUPOS, [])).toEqual(GRUPOS);
  });

  it("quita las secciones excluidas de dentro de su grupo", () => {
    const nav = navDelPerfil(GRUPOS, PERFILES.carmen.sinSecciones);
    const deporte = nav.find((g) => g.label === "Deporte");
    expect(deporte.items.map((i) => i.id)).toEqual(["gimnasio", "salud"]);
  });

  it("no toca los grupos que no tenían nada excluido", () => {
    const nav = navDelPerfil(GRUPOS, ["tenis", "tenis-notas"]);
    expect(nav.find((g) => g.label === "Dinero").items).toHaveLength(1);
  });

  it("poda el grupo que se queda vacío", () => {
    const nav = navDelPerfil(GRUPOS, ["gimnasio", "tenis", "tenis-notas", "salud"]);
    expect(nav.find((g) => g.label === "Deporte")).toBeUndefined();
  });

  it("también quita entradas sueltas, no solo las de dentro de un grupo", () => {
    const nav = navDelPerfil(GRUPOS, ["universidad"]);
    expect(nav.map((g) => g.id ?? g.label)).not.toContain("universidad");
  });

  it("no modifica el array que recibe", () => {
    const copia = JSON.parse(JSON.stringify(GRUPOS));
    navDelPerfil(GRUPOS, ["tenis"]);
    expect(GRUPOS).toEqual(copia);
  });
});

describe("ajustesIniciales", () => {
  /*
    Lo que protege: `lh_settings` la escriben Inicio, Ajustes y Salud. Cada una
    declaraba un valor inicial con distintas claves, así que en una cuenta nueva
    la primera pantalla que se abriera decidía qué campos existían y cuáles se
    quedaban vacíos para siempre.
  */
  it("trae siempre las tres claves", () => {
    expect(Object.keys(ajustesIniciales(PERFILES.carmen)).sort()).toEqual([
      "metaAgua",
      "metaSueno",
      "nombre",
    ]);
  });

  it("el nombre sale del perfil", () => {
    expect(ajustesIniciales(PERFILES.carmen).nombre).toBe("Carmen");
    expect(ajustesIniciales(PERFILES.quico).nombre).toBe("Quico");
  });

  it("sin perfil no se queda sin nombre", () => {
    expect(ajustesIniciales(null).nombre).toBe("Quico");
    expect(ajustesIniciales(undefined).nombre).toBe("Quico");
  });

  it("las metas no dependen del perfil", () => {
    const a = ajustesIniciales(PERFILES.quico);
    const b = ajustesIniciales(PERFILES.carmen);
    expect(a.metaAgua).toBe(b.metaAgua);
    expect(a.metaSueno).toBe(b.metaSueno);
  });
});

describe("idsDelPerfil", () => {
  it("aplana grupos y sueltas en una sola lista de ids", () => {
    expect(idsDelPerfil(GRUPOS, [])).toEqual([
      "inicio",
      "universidad",
      "gimnasio",
      "tenis",
      "tenis-notas",
      "salud",
      "finanzas",
    ]);
  });

  it("Carmen no puede llegar al tenis ni escribiendo la URL a mano", () => {
    const ids = idsDelPerfil(GRUPOS, PERFILES.carmen.sinSecciones);
    expect(ids).not.toContain("tenis");
    expect(ids).not.toContain("tenis-notas");
    expect(ids).toContain("gimnasio");
  });
});
