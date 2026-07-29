/* ------------------------------------------------------------------ */
/*  UI compartida y utilidades                                         */
/* ------------------------------------------------------------------ */

export function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg ${className}`}>
      {children}
    </div>
  );
}

export function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
        {Icon ? <Icon size={22} /> : null}
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
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
