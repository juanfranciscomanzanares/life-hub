/*
  Números que cuentan hasta su valor.

  Dos reglas que evitan que esto acabe siendo molesto:

  - Se respeta `prefers-reduced-motion`: quien pide menos movimiento ve el
    número final desde el primer fotograma, sin animación.
  - Solo se anima al APARECER o cuando el valor sube de golpe. Al escribir en
    un campo (peso, repeticiones, presupuesto) el valor cambia en cada tecla, y
    animar cada pulsación dejaría las cifras siempre en movimiento. Por eso hay
    un umbral: los cambios pequeños se aplican directos.
*/
import { useState, useEffect, useRef } from "react";

const reduceMovimiento = () =>
  typeof window !== "undefined" &&
  window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Arranca rápido y frena al final; es la curva que hace que un contador
// parezca que "aterriza" en su valor en vez de pararse en seco.
const suavizar = (t) => 1 - Math.pow(1 - t, 3);

export function useContador(valor, { duracion = 900, umbral = 1 } = {}) {
  const destino = Number(valor) || 0;
  const [actual, setActual] = useState(destino);
  const anterior = useRef(destino);
  const cuadro = useRef(null);

  useEffect(() => {
    const desde = anterior.current;
    anterior.current = destino;

    if (reduceMovimiento() || Math.abs(destino - desde) < umbral) {
      setActual(destino);
      return undefined;
    }

    const inicio = performance.now();
    const paso = (ahora) => {
      const t = Math.min(1, (ahora - inicio) / duracion);
      setActual(desde + (destino - desde) * suavizar(t));
      if (t < 1) cuadro.current = requestAnimationFrame(paso);
    };
    cuadro.current = requestAnimationFrame(paso);

    return () => cancelAnimationFrame(cuadro.current);
  }, [destino, duracion, umbral]);

  return actual;
}

/*
  Cifra animada, ya formateada en español.

  `decimales` fija cuántos se enseñan; mientras cuenta se redondea igual, así
  que no bailan los dígitos de la derecha.
*/
export function Cifra({ valor, decimales = 0, sufijo = "", prefijo = "", className = "" }) {
  const n = useContador(valor);
  const texto = n.toLocaleString("es-ES", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });

  return (
    // tabular-nums: todas las cifras ocupan lo mismo, así el número no cambia
    // de ancho mientras cuenta ni descoloca lo que tenga al lado.
    <span className={`tabular-nums ${className}`}>
      {prefijo}
      {texto}
      {sufijo}
    </span>
  );
}
