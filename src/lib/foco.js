/*
  Lógica del foco dentro de un diálogo. Aquí no hay React ni efectos: solo
  "dada una lista de elementos enfocables y el que tiene el foco, ¿cuál toca
  ahora?". Así se puede probar de verdad (ver foco.test.js) en vez de a ojo.
*/

/*
  Qué cuenta como enfocable.

  `[tabindex]:not([tabindex="-1"])` incluye lo que se hizo enfocable a mano.
  Los `disabled` y los `[hidden]` quedan fuera porque el navegador tampoco los
  visita con el tabulador, y saltar a un botón desactivado parecería que el
  foco se ha perdido.
*/
export const SELECTOR_ENFOCABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

/*
  El siguiente elemento al tabular, dando la vuelta por los extremos.

  Es lo que hace que el foco no se escape del diálogo: desde el último, Tab
  vuelve al primero, y desde el primero, Shift+Tab salta al último. Sin esto el
  foco se iba al contenido de detrás, que además está tapado por el fondo
  oscurecido: parecía que la app había dejado de responder al teclado.

  Devuelve null si no hay nada que enfocar, para que quien llame no fuerce el
  foco a ningún sitio.
*/
export function siguienteFoco(enfocables, actual, haciaAtras = false) {
  const lista = (enfocables || []).filter(Boolean);
  if (lista.length === 0) return null;

  const i = lista.indexOf(actual);
  // Si el foco estaba fuera del diálogo, se entra por el extremo que toque.
  if (i === -1) return haciaAtras ? lista[lista.length - 1] : lista[0];

  const siguiente = haciaAtras ? i - 1 : i + 1;
  // El módulo con el ajuste por la izquierda: en JS, -1 % 5 es -1, no 4.
  return lista[((siguiente % lista.length) + lista.length) % lista.length];
}
