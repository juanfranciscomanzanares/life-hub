/*
  El icono del tiempo, en un solo sitio.

  `src/lib/tiempo.js` devuelve un NOMBRE de icono ("sol", "lluvia"...) para
  seguir siendo lógica pura probable en `node`. Aquí es donde ese nombre se
  convierte en algo que se ve. Vive en lib y no dentro de una sección porque lo
  usan Inicio y Calendario, y las dos copias acabarían separándose: ya pasó con
  `Card` (ver CLAUDE.md).

  Los colores son la única excepción permitida a la regla de "nada de colores
  Tailwind sueltos": aquí el color ES el dato, igual que el verde y el rojo de
  las gráficas de tenis. Un sol gris no dice nada.
*/

import { Cloud, CloudDrizzle, CloudFog, CloudRain, CloudSun, Snowflake, Sun, Zap } from "lucide-react";

const ICONOS = {
  sol: { Icono: Sun, color: "text-amber-400" },
  "sol-nubes": { Icono: CloudSun, color: "text-amber-300" },
  nubes: { Icono: Cloud, color: "text-slate-400" },
  niebla: { Icono: CloudFog, color: "text-slate-400" },
  llovizna: { Icono: CloudDrizzle, color: "text-sky-300" },
  lluvia: { Icono: CloudRain, color: "text-sky-400" },
  nieve: { Icono: Snowflake, color: "text-sky-200" },
  tormenta: { Icono: Zap, color: "text-violet-400" },
};

/*
  El icono es decorativo y va con `aria-hidden`: el texto de al lado ("Lluvia",
  "24°") ya cuenta lo mismo, y un lector de pantalla que lea las dos cosas
  repite. Cuando el icono va SOLO, quien lo llame debe pasar `titulo` para que
  tenga nombre accesible.
*/
export function IconoTiempo({ icono, size = 18, titulo = null, className = "" }) {
  const { Icono, color } = ICONOS[icono] || ICONOS.nubes;
  return (
    <Icono
      size={size}
      className={`shrink-0 ${color} ${className}`}
      aria-hidden={titulo ? undefined : "true"}
      role={titulo ? "img" : undefined}
      aria-label={titulo || undefined}
    />
  );
}

// Temperaturas siempre con `tabular-nums`: si no, una columna de 9° y 31° baila.
export const fmtTemp = (n) =>
  Number.isFinite(Number(n)) ? `${Math.round(Number(n))}°` : "—";
