import { describe, it, expect } from "vitest";
import { decidir, esDatoDeUsuario, clavesDeDatos, sincronizarDueno } from "./sesionLocal";

// Almacén de mentira con la misma interfaz que localStorage.
function almacenFalso(inicial = {}) {
  const datos = { ...inicial };
  return {
    get length() {
      return Object.keys(datos).length;
    },
    key: (i) => Object.keys(datos)[i] ?? null,
    getItem: (k) => (k in datos ? datos[k] : null),
    setItem: (k, v) => {
      datos[k] = String(v);
    },
    removeItem: (k) => {
      delete datos[k];
    },
    _datos: datos,
  };
}

describe("qué es dato de usuario y qué del dispositivo", () => {
  it("los registros y sus marcas son del usuario", () => {
    expect(esDatoDeUsuario("lh_gym")).toBe(true);
    expect(esDatoDeUsuario("lh_finance")).toBe(true);
    expect(esDatoDeUsuario("lh_meta:lh_gym")).toBe(true);
    expect(esDatoDeUsuario("lh_pend:lh_gym")).toBe(true);
  });

  it("el tema, el acento y el tour son del dispositivo y NO se borran", () => {
    // Perderlos en cada cambio de cuenta sería molesto y no dicen nada de nadie.
    expect(esDatoDeUsuario("lh_theme")).toBe(false);
    expect(esDatoDeUsuario("lh_accent")).toBe(false);
    expect(esDatoDeUsuario("lh_onboarded")).toBe(false);
  });

  it("lo que no es de la app ni se toca", () => {
    expect(esDatoDeUsuario("sb-auth-token")).toBe(false);
    expect(esDatoDeUsuario("otra-cosa")).toBe(false);
  });
});

describe("decidir qué hacer al arrancar", () => {
  it("sin datos guardados no hay nada que hacer", () => {
    expect(decidir({ duenoGuardado: null, usuarioActual: "carmen", hayDatos: false })).toBe("nada");
  });

  it("el mismo usuario de siempre: no se toca nada", () => {
    expect(decidir({ duenoGuardado: "juan", usuarioActual: "juan", hayDatos: true })).toBe("nada");
  });

  it("OTRO usuario: se limpia", () => {
    /*
      Este es el caso que motivó todo esto. Sin limpiar, Carmen veía los datos
      de Juan y, en cuanto tocaba algo, se subían a la cuenta de ella.
    */
    expect(decidir({ duenoGuardado: "juan", usuarioActual: "carmen", hayDatos: true })).toBe("limpiar");
  });

  it("datos sin dueño y alguien que entra: los adopta", () => {
    // Venías usando la app sin cuenta y ahora te registras: son tuyos.
    expect(decidir({ duenoGuardado: null, usuarioActual: "juan", hayDatos: true })).toBe("adoptar");
  });

  it("sin sesión no se borra nada", () => {
    // Modo local (sin nube configurada): los datos no son de ninguna cuenta y
    // borrarlos sería perderlos sin motivo.
    expect(decidir({ duenoGuardado: "juan", usuarioActual: null, hayDatos: true })).toBe("nada");
    expect(decidir({ duenoGuardado: null, usuarioActual: null, hayDatos: true })).toBe("nada");
  });
});

describe("sincronizarDueno", () => {
  it("borra los datos del anterior y se queda con los del dispositivo", () => {
    const a = almacenFalso({
      lh_usuario_datos: "juan",
      lh_gym: "[1]",
      "lh_meta:lh_gym": "2026-07-01",
      "lh_pend:lh_gym": "1",
      lh_finance: "[]",
      lh_theme: "dark",
      lh_accent: "violeta",
    });

    expect(sincronizarDueno("carmen", a)).toBe(true);

    expect(a.getItem("lh_gym")).toBe(null);
    expect(a.getItem("lh_meta:lh_gym")).toBe(null);
    expect(a.getItem("lh_pend:lh_gym")).toBe(null);
    expect(a.getItem("lh_finance")).toBe(null);
    // Preferencias del dispositivo: intactas.
    expect(a.getItem("lh_theme")).toBe("dark");
    expect(a.getItem("lh_accent")).toBe("violeta");
    // Y queda anotado el nuevo dueño.
    expect(a.getItem("lh_usuario_datos")).toBe("carmen");
  });

  it("con el mismo usuario no borra nada", () => {
    const a = almacenFalso({ lh_usuario_datos: "juan", lh_gym: "[1,2,3]" });
    expect(sincronizarDueno("juan", a)).toBe(false);
    expect(a.getItem("lh_gym")).toBe("[1,2,3]");
  });

  it("adopta los datos sin dueño sin borrarlos", () => {
    const a = almacenFalso({ lh_gym: "[1,2,3]" });
    expect(sincronizarDueno("juan", a)).toBe(false);
    expect(a.getItem("lh_gym")).toBe("[1,2,3]");
    expect(a.getItem("lh_usuario_datos")).toBe("juan");
  });

  it("sin sesión no toca nada", () => {
    const a = almacenFalso({ lh_usuario_datos: "juan", lh_gym: "[1]" });
    expect(sincronizarDueno(null, a)).toBe(false);
    expect(a.getItem("lh_gym")).toBe("[1]");
  });

  it("clavesDeDatos no cuenta las del dispositivo", () => {
    const a = almacenFalso({ lh_gym: "[]", lh_theme: "dark", ajeno: "x" });
    expect(clavesDeDatos(a)).toEqual(["lh_gym"]);
  });
});
