// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { render, act, cleanup } from "@testing-library/react";
import { useRuta } from "./ruta";

/*
  Tests del CABLEADO de useRuta, no de sus funciones puras (esas están en
  ruta.test.js y corren en node, que es mucho más rápido).

  Lo que se prueba aquí solo se rompe montando el hook de verdad, y son los dos
  casos que trajeron los perfiles (ver src/lib/perfiles.js):

  1. La URL no puede mentir. Un hash que no lleva a ningún sitio pintaba Inicio
     pero dejaba escrito "#/tenis": guardar eso en favoritos abría otra cosa.
  2. La lista de secciones YA NO ES CONSTANTE. Antes se derivaba de NAV_GROUPS y
     era la misma para siempre; ahora depende de quién ha entrado y puede llegar
     tarde, cuando la sincronización trae el perfil guardado.
*/

function Sonda({ ids, porDefecto = "inicio" }) {
  const [seccion, navegar] = useRuta(ids, porDefecto);
  return (
    <button onClick={() => navegar("tenis")} data-testid="seccion">
      {seccion}
    </button>
  );
}

const TODAS = ["inicio", "gimnasio", "tenis"];
const SIN_TENIS = ["inicio", "gimnasio"];

const leer = (r) => r.getByTestId("seccion").textContent;

beforeEach(() => {
  window.history.replaceState(null, "", "/");
});
afterEach(cleanup);

describe("useRuta: la URL no miente", () => {
  it("un hash válido se respeta y se queda tal cual", () => {
    window.history.replaceState(null, "", "#/gimnasio");
    const r = render(<Sonda ids={TODAS} />);
    expect(leer(r)).toBe("gimnasio");
    expect(window.location.hash).toBe("#/gimnasio");
  });

  it("entrar sin hash deja escrito el de la sección por defecto", () => {
    const r = render(<Sonda ids={TODAS} />);
    expect(leer(r)).toBe("inicio");
    expect(window.location.hash).toBe("#/inicio");
  });

  it("un hash de una sección que este perfil no tiene se corrige en la URL", () => {
    window.history.replaceState(null, "", "#/tenis");
    const r = render(<Sonda ids={SIN_TENIS} />);
    expect(leer(r)).toBe("inicio");
    // Lo que fallaba: la sección caía bien pero la barra seguía diciendo #/tenis.
    expect(window.location.hash).toBe("#/inicio");
  });

  it("un hash inventado también se corrige", () => {
    window.history.replaceState(null, "", "#/no-existe");
    const r = render(<Sonda ids={TODAS} />);
    expect(leer(r)).toBe("inicio");
    expect(window.location.hash).toBe("#/inicio");
  });
});

describe("useRuta: la lista de secciones puede cambiar", () => {
  it("si la sección abierta deja de existir, sale de ella", () => {
    window.history.replaceState(null, "", "#/tenis");
    const r = render(<Sonda ids={TODAS} />);
    expect(leer(r)).toBe("tenis");

    // Llega el perfil que no tiene tenis, con la app ya pintada.
    act(() => {
      r.rerender(<Sonda ids={SIN_TENIS} />);
    });

    expect(leer(r)).toBe("inicio");
    expect(window.location.hash).toBe("#/inicio");
  });

  it("no toca la sección abierta si sigue siendo válida", () => {
    window.history.replaceState(null, "", "#/gimnasio");
    const r = render(<Sonda ids={TODAS} />);
    act(() => {
      r.rerender(<Sonda ids={SIN_TENIS} />);
    });
    expect(leer(r)).toBe("gimnasio");
    expect(window.location.hash).toBe("#/gimnasio");
  });

  it("navegar usa la lista NUEVA, no la que había al montar", () => {
    /*
      El fallo que evita: los listeners y `navegar` se creaban una sola vez y se
      quedaban con la primera lista. Con ella, "tenis" seguiría siendo un destino
      válido para siempre aunque el perfil ya no lo tuviera.
    */
    const r = render(<Sonda ids={TODAS} />);
    act(() => {
      r.rerender(<Sonda ids={SIN_TENIS} />);
    });

    act(() => {
      r.getByTestId("seccion").click();
    });

    expect(leer(r)).toBe("inicio");
  });
});
