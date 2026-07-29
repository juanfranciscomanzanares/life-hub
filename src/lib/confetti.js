/*
  Confeti para los momentos que se celebran: terminar una sesión de gimnasio,
  cerrar un pomodoro, cumplir una meta o completar la semana de un hábito.

  Sin dependencias y sin canvas: son unos cuantos <div> con una animación CSS
  que se borran solos al acabar. Un canvas a pantalla completa para esto
  obligaría a un bucle de render y a limpiar el elemento a mano.

  Se calla si el sistema pide menos movimiento: es puro adorno, y ahí molesta.
*/

const COLORES = ["#6366f1", "#10b981", "#f59e0b", "#f43f5e", "#38bdf8", "#d946ef"];

let estilosPuestos = false;

// El keyframe se inyecta una sola vez, la primera vez que se lanza confeti: no
// tiene sentido cargarlo en el CSS de todos los que nunca celebren nada.
function ponerEstilos() {
  if (estilosPuestos || typeof document === "undefined") return;
  const hoja = document.createElement("style");
  hoja.textContent = `@keyframes lh-caer {
    to { transform: translateY(102vh) rotate(var(--giro)); opacity: 0; }
  }`;
  document.head.appendChild(hoja);
  estilosPuestos = true;
}

export function confeti({ piezas = 70, duracion = 2600 } = {}) {
  if (typeof document === "undefined") return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;

  ponerEstilos();
  const capa = document.createElement("div");
  capa.setAttribute("aria-hidden", "true");

  for (let i = 0; i < piezas; i++) {
    const p = document.createElement("div");
    p.className = "lh-confeti";
    const ancho = 6 + Math.random() * 6;

    Object.assign(p.style, {
      left: `${Math.random() * 100}vw`,
      width: `${ancho}px`,
      height: `${ancho * (0.4 + Math.random())}px`,
      background: COLORES[i % COLORES.length],
      // Un retardo distinto por pieza: si caen todas a la vez parece una
      // cortina, no confeti.
      animation: `lh-caer ${duracion + Math.random() * 900}ms cubic-bezier(0.3, 0.7, 0.5, 1) ${
        Math.random() * 350
      }ms forwards`,
    });
    p.style.setProperty("--giro", `${Math.random() * 1080 - 540}deg`);
    capa.appendChild(p);
  }

  document.body.appendChild(capa);
  setTimeout(() => capa.remove(), duracion + 1400);
}
