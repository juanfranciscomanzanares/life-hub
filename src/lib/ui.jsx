/* ------------------------------------------------------------------ */
/*  UI compartida y utilidades                                         */
/* ------------------------------------------------------------------ */

/*
  Tarjeta de la app: translúcida, con desenfoque y un brillo que sigue al
  cursor. El aspecto vive en `.lh-card` (src/index.css); aquí solo se calcula
  la posición del ratón para el foco radial.

  El puntero solo se escucha en dispositivos con ratón: en táctil no hay hover,
  el brillo nunca se vería y el listener sería trabajo tirado en cada scroll.
*/
export function Card({ children, className = "", ...resto }) {
  const seguirCursor = (e) => {
    const caja = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty("--mx", `${e.clientX - caja.left}px`);
    e.currentTarget.style.setProperty("--my", `${e.clientY - caja.top}px`);
  };

  const conRaton = typeof window !== "undefined" && window.matchMedia?.("(hover: hover)").matches;

  return (
    <div className={`lh-card p-5 ${className}`} onPointerMove={conRaton ? seguirCursor : undefined} {...resto}>
      {children}
    </div>
  );
}

/*
  El icono va con el color de la SECCIÓN (`seccion-*`), no con el acento global:
  es lo que hace que cada área se reconozca de un vistazo. Los tonos salen de
  `data-seccion`, que pone el shell (ver src/index.css).
*/
export function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-seccion-500/15 text-seccion-400 ring-1 ring-inset ring-seccion-500/25">
        {Icon ? <Icon size={22} /> : null}
      </div>
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

/*
  Bloque de carga con barrido. `lineas` pinta varias barras de alto de texto;
  sin él, un solo bloque de la altura que se le pase por className.
*/
export function Skeleton({ lineas = 0, className = "" }) {
  if (lineas > 0) {
    return (
      <div className={`space-y-2 ${className}`} role="status" aria-label="Cargando">
        {Array.from({ length: lineas }, (_, i) => (
          // La última línea más corta: imita el final de un párrafo real.
          <div key={i} className={`lh-skeleton h-4 ${i === lineas - 1 ? "w-2/3" : "w-full"}`} />
        ))}
      </div>
    );
  }
  return <div className={`lh-skeleton ${className}`} role="status" aria-label="Cargando" />;
}

// Skeleton con forma de sección: título, fila de tarjetas y bloque grande.
export function SkeletonSeccion() {
  return (
    <div className="section-fade">
      <div className="mb-6 flex items-center gap-3">
        <div className="lh-skeleton h-11 w-11 rounded-xl" />
        <div className="space-y-2">
          <div className="lh-skeleton h-5 w-40" />
          <div className="lh-skeleton h-3 w-56" />
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="lh-skeleton h-24" />
        ))}
      </div>
      <div className="lh-skeleton h-64" />
    </div>
  );
}

/* --- Formato --- */
export const fmtEuro = (n) => `${Number(n || 0).toLocaleString("es-ES")}€`;

export const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

export const monthKey = (fecha) => (fecha || "").slice(0, 7);

export function monthLabel(key) {
  const [y, m] = key.split("-");
  return `${MONTHS[Number(m) - 1]} ${y.slice(2)}`;
}

export function lastNMonths(n) {
  const now = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
}

/*
  La fecha de hoy en HORA LOCAL.

  Antes esto era `new Date().toISOString().slice(0, 10)`, que da la fecha en
  UTC. En España (UTC+1 en invierno, +2 en verano) eso significa que entre
  medianoche y las 01:00 o las 02:00 devolvía el día ANTERIOR: una serie de
  gimnasio apuntada a las 00:30 se guardaba con la fecha de ayer, y "lo de hoy"
  comparaba contra el día equivocado.
*/
export function todayISO(fecha = new Date()) {
  const p2 = (n) => String(n).padStart(2, "0");
  return `${fecha.getFullYear()}-${p2(fecha.getMonth() + 1)}-${p2(fecha.getDate())}`;
}

/* --- Exportar a CSV (compatible con Excel en español) --- */
export function toCSV(rows) {
  if (!rows || rows.length === 0) return "";
  const headers = Object.keys(rows[0]);
  const esc = (v) => {
    const s = String(v ?? "");
    return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [headers.join(";")];
  rows.forEach((r) => lines.push(headers.map((h) => esc(r[h])).join(";")));
  return lines.join("\n");
}

export function downloadFile(filename, content, mime = "text/csv;charset=utf-8") {
  // BOM para que Excel muestre bien los acentos y el euro
  const bom = mime.startsWith("text/csv") ? "﻿" : "";
  const blob = new Blob([bom + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCSV(filename, rows) {
  downloadFile(filename, toCSV(rows));
}
