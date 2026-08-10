import { useState, useEffect, useCallback } from "react";

/*
  El saludo de entrada del perfil.

  Aparece al abrir la app, se queda un momento y se va solo. Es el único sitio
  de Life Hub que existe solo para hacer gracia, así que las reglas son las de
  cualquier cosa decorativa: que no estorbe y que se pueda quitar de en medio
  antes de tiempo.

  POR QUÉ UNA VEZ POR SESIÓN Y NO EN CADA NAVEGACIÓN

  Si se pintara al cambiar de sección se vería decenas de veces al día, y a esa
  frecuencia lo que era un detalle bonito pasa a ser un peaje. Se guarda en
  `sessionStorage` y no en `localStorage` a propósito: así vuelve a salir cada
  vez que se abre la app de verdad (o se recarga), que es cuando tiene gracia,
  pero no mientras se está usando.

  POR QUÉ NO USA `useDialogo`

  El convenio del proyecto es que toda ventana flotante lleve `useDialogo` (foco
  atrapado, cierre con Escape, foco devuelto). Aquí no encaja y meterlo sería
  peor: esto no es un diálogo —no pregunta nada ni tiene controles— y se cierra
  solo a los 2,2 s. Atrapar el foco dentro de algo que va a desaparecer sin que
  nadie lo toque deja el foco en un elemento que ya no existe. La vía de escape
  está cubierta igual: se cierra con cualquier tecla, clic o toque.

  POR QUÉ `aria-hidden` Y NO `role="status"`

  Esto último se probó primero y era mentira. Una región `aria-live` solo
  anuncia lo que cambia DESPUÉS de que la región exista; aquí el elemento se
  monta con el texto ya dentro, así que los lectores de pantalla no leen nada.
  Para que funcionara habría que montarlo vacío y meter el texto en un segundo
  paso, y no merece la pena: es un guiño decorativo que no aporta información,
  no bloquea nada durante más de dos segundos y la pantalla de detrás ya está
  cargada. Ocultarlo del árbol de accesibilidad es más honesto que fingir un
  anuncio que no ocurre.
*/

const CLAVE = "lh_saludo_visto";
// Lo que se queda en pantalla antes de irse solo. Suficiente para leer tres
// palabras sin que dé tiempo a impacientarse.
const DURACION = 2200;
// Tiene que coincidir con la transición de salida de `.lh-saludo` en index.css:
// si se desmonta antes, el velo desaparece de golpe en vez de fundirse.
const SALIDA = 200;

export default function Saludo({ texto }) {
  /*
    Se decide en el primer render y no en un efecto: así no llega a pintarse
    nada cuando no toca. Marcar la sesión aquí mismo evita que dos montajes
    seguidos (React en modo estricto) lo enseñen dos veces.
  */
  const [montado, setMontado] = useState(() => {
    if (!texto) return false;
    try {
      if (sessionStorage.getItem(CLAVE)) return false;
      sessionStorage.setItem(CLAVE, "1");
      return true;
    } catch {
      // Safari en privado puede lanzar al escribir. Sin poder recordarlo, mejor
      // no enseñarlo que enseñarlo en bucle.
      return false;
    }
  });
  const [visible, setVisible] = useState(false);

  const cerrar = useCallback(() => setVisible(false), []);

  // Encender la clase en el fotograma siguiente al montaje. Puesto en el mismo,
  // el navegador no vería dos valores distintos y no habría transición: el
  // saludo aparecería de golpe.
  useEffect(() => {
    if (!montado) return;
    const id = requestAnimationFrame(() => setVisible(true));
    const solo = setTimeout(cerrar, DURACION);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(solo);
    };
  }, [montado, cerrar]);

  // Desmontar cuando ya se ha fundido del todo.
  useEffect(() => {
    if (!montado || visible) return;
    const id = setTimeout(() => setMontado(false), SALIDA);
    return () => clearTimeout(id);
  }, [montado, visible]);

  // Cualquier tecla lo quita de en medio. Es lo que espera quien abre la app
  // con prisa, y también la salida para quien navega con teclado.
  useEffect(() => {
    if (!montado) return;
    window.addEventListener("keydown", cerrar);
    return () => window.removeEventListener("keydown", cerrar);
  }, [montado, cerrar]);

  if (!montado) return null;

  return (
    <div
      className="lh-saludo lh-velo"
      data-visible={visible}
      aria-hidden="true"
      onPointerDown={cerrar}
    >
      <div>
        <p className="lh-saludo-texto font-display font-bold">{texto}</p>
        {/* Vale para los tres casos: ratón, dedo y teclado. "Toca" a secas era
            falso en el ordenador. */}
        <p className="lh-saludo-pista">Pulsa en cualquier sitio para entrar</p>
      </div>
    </div>
  );
}
