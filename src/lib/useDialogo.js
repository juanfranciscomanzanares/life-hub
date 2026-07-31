import { useEffect, useRef } from "react";
import { SELECTOR_ENFOCABLE, siguienteFoco } from "./foco";

/*
  Lo que hace falta para que una ventana flotante sea un diálogo de verdad y no
  solo un div encima de la página.

  Los tres modales de la app (la paleta de comandos, el añadido rápido y el
  onboarding) tapaban el contenido con un fondo oscurecido pero no lo sacaban
  de la navegación con teclado: tabulando se salía del modal hacia botones que
  estaban debajo del velo, invisibles, y el foco parecía haberse esfumado. Con
  un lector de pantalla era peor todavía, porque nada anunciaba que se hubiera
  abierto una ventana.

  Este hook se encarga de:
  - atrapar el tabulador dentro del diálogo,
  - llevar el foco dentro al abrirse,
  - devolverlo a donde estaba al cerrarse (el botón que lo abrió),
  - cerrar con Escape.

  Devuelve la ref que hay que poner en el contenedor del diálogo. Los atributos
  (role, aria-modal, aria-label) se ponen en el JSX, que es donde se leen.
*/
export function useDialogo(abierto, alCerrar) {
  const ref = useRef(null);
  // Quién tenía el foco antes de abrir, para devolvérselo al cerrar.
  const anterior = useRef(null);

  useEffect(() => {
    if (!abierto) return;

    anterior.current = document.activeElement;
    const nodo = ref.current;

    const enfocables = () =>
      nodo ? Array.from(nodo.querySelectorAll(SELECTOR_ENFOCABLE)) : [];

    /*
      El foco entra en el diálogo, pero sin robárselo a un campo que ya se haya
      autoenfocado (la paleta de comandos enfoca su buscador por su cuenta).
    */
    const dentro = nodo && nodo.contains(document.activeElement);
    if (!dentro) {
      const primero = enfocables()[0];
      if (primero) primero.focus();
      // Si no hay nada enfocable, el propio contenedor: así el lector de
      // pantalla empieza a leer por el diálogo y no por la página de detrás.
      else if (nodo) nodo.focus();
    }

    const alPulsar = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        alCerrar?.();
        return;
      }
      if (e.key !== "Tab") return;

      const lista = enfocables();
      if (lista.length === 0) {
        // Nada que enfocar: el tabulador no debe llevarse el foco fuera.
        e.preventDefault();
        return;
      }
      const destino = siguienteFoco(lista, document.activeElement, e.shiftKey);
      if (destino) {
        e.preventDefault();
        destino.focus();
      }
    };

    document.addEventListener("keydown", alPulsar, true);
    return () => {
      document.removeEventListener("keydown", alPulsar, true);
      /*
        Devolver el foco solo si el elemento sigue en la página. Tras guardar,
        el botón que abrió el modal puede haber desaparecido, y enfocar un nodo
        suelto manda el foco al <body> sin avisar.
      */
      const previo = anterior.current;
      if (previo && document.contains(previo)) previo.focus();
    };
  }, [abierto, alCerrar]);

  return ref;
}
