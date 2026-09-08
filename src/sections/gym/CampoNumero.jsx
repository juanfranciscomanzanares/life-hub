import { useState, useEffect } from "react";

/*
  Input numérico que no pelea con lo que escribes.

  Guarda un borrador de TEXTO mientras editas y solo escribe un número ya saneado
  en el modelo. Así puedes teclear "0.5", "2." o dejar el campo vacío sin que se
  reconvierta a número en cada pulsación, que era lo que provocaba los dos fallos:
  el "050" (el 0 inicial no se iba) y que no entraran los decimales (al escribir
  el punto se recortaba al instante).

  - decimales: admite un separador decimal (coma española incluida, se guarda como
    punto). Sin él, solo dígitos.
  - Un valor 0 se muestra vacío, para que el campo invite a escribir en vez de
    arrastrar un 0 delante.
*/
export function CampoNumero({ value, onChange, decimales = false, min = 0, ...props }) {
  const [draft, setDraft] = useState(() => aTexto(value));

  // Resincroniza si el valor cambia desde fuera (p. ej. al precargar pesos),
  // pero nunca mientras escribes: si el borrador ya representa ese número, se deja.
  useEffect(() => {
    if (parseNum(draft) !== value) setDraft(aTexto(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const manejar = (e) => {
    let raw = e.target.value;
    if (decimales) {
      raw = raw.replace(",", ".").replace(/[^\d.]/g, "");
      const i = raw.indexOf(".");
      if (i !== -1) raw = raw.slice(0, i + 1) + raw.slice(i + 1).replace(/\./g, "");
    } else {
      raw = raw.replace(/[^\d]/g, "");
    }
    setDraft(raw);
    const n = parseNum(raw);
    onChange(n == null ? min : Math.max(min, n));
  };

  // Al salir, deja el texto en su forma canónica (sin punto colgando ni vacío).
  const alSalir = () => {
    const n = parseNum(draft);
    setDraft(n == null ? "" : aTexto(Math.max(min, n)));
  };

  return (
    <input
      {...props}
      type="text"
      inputMode={decimales ? "decimal" : "numeric"}
      value={draft}
      onChange={manejar}
      onBlur={alSalir}
    />
  );
}

function aTexto(value) {
  return value == null || value === 0 ? "" : String(value);
}

function parseNum(s) {
  if (s == null || s === "" || s === ".") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}
