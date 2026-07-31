import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { Search, CornerDownLeft } from "lucide-react";
import { useDialogo } from "./lib/useDialogo";

function read(key, fb) {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
}

// Construye un índice de elementos buscables de todas las secciones
function buildIndex() {
  const out = [];
  const add = (texto, seccion, tipo) => texto && out.push({ texto: String(texto), seccion, tipo });
  read("lh_tasks", []).forEach((t) => add(t.text, "inicio", "Tarea"));
  read("lh_gym", []).forEach((g) => add(g.ejercicio, "gimnasio", "Gym"));
  read("lh_work_log", []).forEach((w) => add(w.actividad, "trabajo", "Trabajo"));
  read("lh_runbooks", []).forEach((r) => add(r.titulo, "trabajo", "Procedimiento"));
  read("lh_uni_tasks", []).forEach((t) => add(t.text, "universidad", "Uni"));
  read("lh_finance", []).forEach((f) => add(f.concepto, "finanzas", "Finanzas"));
  read("lh_investments", []).forEach((i) => add(i.nombre, "inversiones", "Inversión"));
  read("lh_notes", []).forEach((n) => add(n.title, "cerebro", "Nota"));
  read("lh_events", []).forEach((e) => add(e.titulo, "calendario", "Evento"));
  return out;
}

export default function CommandPalette({ open, setOpen, sections, onNavigate }) {
  const [q, setQ] = useState("");
  const inputRef = useRef(null);
  const index = useMemo(() => (open ? buildIndex() : []), [open]);

  useEffect(() => {
    if (open) {
      setQ("");
      setTimeout(() => inputRef.current?.focus(), 30);
    }
  }, [open]);

  // Escape y el foco atrapado los lleva useDialogo, que además devuelve el
  // foco al botón de buscar cuando se cierra la paleta.
  const cerrar = useCallback(() => setOpen(false), [setOpen]);
  const refDialogo = useDialogo(open, cerrar);

  const ql = q.trim().toLowerCase();
  const secciones = sections.filter((s) => s.label.toLowerCase().includes(ql)).slice(0, 6);
  const datos = ql.length >= 2 ? index.filter((i) => i.texto.toLowerCase().includes(ql)).slice(0, 8) : [];

  const go = (id) => {
    onNavigate(id);
    setOpen(false);
  };
  const first = secciones[0] || datos[0];
  const onSubmit = (e) => {
    e.preventDefault();
    if (first) go(first.id || first.seccion);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 p-4 pt-24" onClick={cerrar}>
      <div
        ref={refDialogo}
        role="dialog"
        aria-modal="true"
        aria-label="Buscar en Life Hub"
        className="w-full max-w-lg overflow-hidden rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit} className="flex items-center gap-2 border-b border-slate-800 px-4">
          <Search size={18} className="text-slate-500" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar secciones, tareas, notas, ejercicios..."
            className="w-full bg-transparent py-3.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
          />
          <kbd className="hidden rounded bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-400 sm:block">Esc</kbd>
        </form>

        <div className="max-h-80 overflow-y-auto p-2">
          {secciones.length > 0 && <p className="px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">Secciones</p>}
          {secciones.map((s) => {
            const Icon = s.icon;
            return (
              <button key={s.id} onClick={() => go(s.id)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800">
                {Icon && <Icon size={16} className="text-indigo-400" />}
                {s.label}
              </button>
            );
          })}

          {datos.length > 0 && <p className="mt-2 px-2 py-1 text-[10px] font-semibold uppercase text-slate-500">Resultados</p>}
          {datos.map((d, i) => (
            <button key={i} onClick={() => go(d.seccion)} className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left text-sm text-slate-200 hover:bg-slate-800">
              <span className="truncate">{d.texto}</span>
              <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-[10px] text-slate-400">{d.tipo}</span>
            </button>
          ))}

          {secciones.length === 0 && datos.length === 0 && (
            <p className="px-3 py-6 text-center text-sm text-slate-500">Sin resultados.</p>
          )}
        </div>

        <div className="flex items-center gap-2 border-t border-slate-800 px-4 py-2 text-[10px] text-slate-500">
          <CornerDownLeft size={12} /> Enter para abrir el primero
        </div>
      </div>
    </div>
  );
}
