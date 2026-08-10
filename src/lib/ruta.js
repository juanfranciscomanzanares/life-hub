import { useState, useEffect, useCallback, useRef } from "react";

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

  /*
    La lista de ids YA NO ES CONSTANTE: desde que hay perfiles, cada uno tiene
    las suyas (ver src/lib/perfiles.js) y puede llegar tarde, cuando la
    sincronización trae el perfil guardado.

    Se guarda en una ref y no en las dependencias del efecto a propósito: como
    dependencia, cada render con un array nuevo desengancharía y volvería a
    enganchar los listeners del historial sin necesidad. Con la ref los
    listeners se ponen una vez y siempre leen la lista buena.
  */
  const idsRef = useRef(idsValidos);
  idsRef.current = idsValidos;

  /*
    Deja en la barra de direcciones la sección que se está viendo de verdad.

    Sin esto, un hash que no lleva a ningún sitio (#/tenis en un perfil que no
    tiene tenis, o un enlace de una versión antigua) pintaba Inicio pero dejaba
    la URL mintiendo: al guardar en favoritos o al compartir el enlace, lo que
    volvía a abrirse no era lo que ponía la dirección.

    `replaceState` y no asignar el hash: sustituir no dispara `hashchange`, así
    que no se realimenta, y además no deja una entrada basura en el historial a
    la que volver con el botón "atrás".
  */
  const normalizarUrl = useCallback((destino) => {
    if (window.location.hash !== hashDeSeccion(destino)) {
      window.history.replaceState(null, "", hashDeSeccion(destino));
    }
  }, []);

  // Al arrancar: entrar en "/" deja "#/inicio" escrito (así el primer "atrás"
  // ya tiene una entrada propia), y un hash inválido se corrige en el sitio.
  useEffect(() => {
    normalizarUrl(seccion);
    // Solo al montar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Atrás/adelante del navegador, y también escribir el hash a mano.
  useEffect(() => {
    const alCambiar = () => {
      const destino = seccionDesdeHash(window.location.hash, idsRef.current, porDefecto);
      setSeccion(destino);
      normalizarUrl(destino);
    };
    window.addEventListener("hashchange", alCambiar);
    window.addEventListener("popstate", alCambiar);
    return () => {
      window.removeEventListener("hashchange", alCambiar);
      window.removeEventListener("popstate", alCambiar);
    };
  }, [porDefecto, normalizarUrl]);

  /*
    Si la sección donde estás deja de existir, fuera. Pasa cuando el perfil se
    resuelve después del primer pintado: alguien con la app abierta en #/tenis
    se quedaría mirando una sección que su perfil no tiene y sin ninguna entrada
    en el menú para salir de ella.
  */
  useEffect(() => {
    if (idsValidos.includes(seccion)) return;
    setSeccion(porDefecto);
    normalizarUrl(porDefecto);
  }, [idsValidos, seccion, porDefecto, normalizarUrl]);

  const navegar = useCallback(
    (id) => {
      const destino = idsRef.current.includes(id) ? id : porDefecto;
      // Navegar a donde ya estás no debe apilar entradas repetidas: si no,
      // hacen falta cinco "atrás" para salir de la sección en la que estabas.
      if (window.location.hash !== hashDeSeccion(destino)) {
        window.location.hash = hashDeSeccion(destino);
      }
      setSeccion(destino);
    },
    [porDefecto]
  );

  return [seccion, navegar];
}
