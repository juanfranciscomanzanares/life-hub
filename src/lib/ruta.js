import { useState, useEffect, useCallback } from "react";

/*
  La sección abierta, en la URL.

  Antes era estado suelto de React. Tres cosas se rompían por eso:

  - En el móvil, con la app instalada, el botón "atrás" del sistema no tenía
    ningún sitio al que volver y CERRABA la app. Es el gesto más usado de
    Android y aquí destruía la sesión de navegación entera.
  - Recargar te devolvía siempre a Inicio, estuvieras donde estuvieras.
  - No se podía guardar en favoritos ni abrir una sección concreta.

  Se usa el hash (#/gimnasio) y no rutas normales a propósito: el hash no llega
  al servidor, así que no hace falta configurar reescrituras en Vercel ni tocar
  el service worker. Un despliegue estático sigue funcionando tal cual.
*/

// Prefijo con barra: "#/gimnasio" y no "#gimnasio". Así el hash no choca con
// los anclajes de toda la vida (#seccion) por si alguna vez se usan.
const PREFIJO = "#/";

export const hashDeSeccion = (id) => PREFIJO + String(id ?? "");

/*
  Lee el id de sección de un hash. Si no es válido devuelve `porDefecto`: una
  URL manipulada o un enlace de una versión antigua abre Inicio en vez de
  dejar la pantalla en blanco.
*/
export function seccionDesdeHash(hash, idsValidos = [], porDefecto = "inicio") {
  const bruto = String(hash || "").replace(/^#\/?/, "");
  // Puede venir percent-encoded si el id llevara caracteres raros; hoy no
  // ocurre, pero decodificar mal no debe tirar la app.
  let id = bruto;
  try {
    id = decodeURIComponent(bruto);
  } catch {
    /* hash inválido: nos quedamos con el texto tal cual */
  }
  return idsValidos.includes(id) ? id : porDefecto;
}

/*
  Hook de navegación.

  `replace` para el primer ajuste (normalizar una URL sin hash) y `push` para
  los cambios de sección: solo los segundos deben crear una entrada en el
  historial, o el botón "atrás" se quedaría atascado rebotando en Inicio.
*/
export function useRuta(idsValidos, porDefecto = "inicio") {
  const [seccion, setSeccion] = useState(() =>
    seccionDesdeHash(typeof window === "undefined" ? "" : window.location.hash, idsValidos, porDefecto)
  );

  // Normaliza la URL al arrancar: entrar en "/" deja "#/inicio" escrito, así
  // el primer "atrás" ya tiene una entrada propia a la que volver.
  useEffect(() => {
    if (!window.location.hash) {
      window.history.replaceState(null, "", hashDeSeccion(seccion));
    }
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atrás/adelante del navegador, y también escribir el hash a mano.
  useEffect(() => {
    const alCambiar = () =>
      setSeccion(seccionDesdeHash(window.location.hash, idsValidos, porDefecto));
    window.addEventListener("hashchange", alCambiar);
    window.addEventListener("popstate", alCambiar);
    return () => {
      window.removeEventListener("hashchange", alCambiar);
      window.removeEventListener("popstate", alCambiar);
    };
    // idsValidos es constante en la práctica (se deriva de NAV_GROUPS).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [porDefecto]);

  const navegar = useCallback(
    (id) => {
      const destino = idsValidos.includes(id) ? id : porDefecto;
      // Navegar a donde ya estás no debe apilar entradas repetidas: si no,
      // hacen falta cinco "atrás" para salir de la sección en la que estabas.
      if (window.location.hash !== hashDeSeccion(destino)) {
        window.location.hash = hashDeSeccion(destino);
      }
      setSeccion(destino);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [porDefecto]
  );

  return [seccion, navegar];
}
