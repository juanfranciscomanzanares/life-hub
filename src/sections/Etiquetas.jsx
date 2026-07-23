import { useState, useMemo } from "react";
import { Tag } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle } from "../lib/ui";

export default function Etiquetas() {
  const [notes] = usePersisted("lh_notes", []);
  const [runbooks] = usePersisted("lh_runbooks", []);
  const [work] = usePersisted("lh_work_log", []);
  const [tasks] = usePersisted("lh_tasks", []);
  const [finance] = usePersisted("lh_finance", []);
  const [sel, setSel] = useState("");

  // Reúne elementos etiquetados de varias secciones
  const items = useMemo(() => {
    const out = [];
    notes.forEach((n) => n.tag && out.push({ etiqueta: n.tag, texto: n.title, seccion: "Segundo Cerebro" }));
    runbooks.forEach((r) => (r.herramientas || "").split(/[·,]/).map((t) => t.trim()).filter(Boolean).forEach((t) => out.push({ etiqueta: t, texto: r.titulo, seccion: "Trabajo" })));
    work.forEach((w) => w.categoria && out.push({ etiqueta: w.categoria, texto: w.actividad, seccion: "Trabajo" }));
    tasks.forEach((t) => t.etiqueta && out.push({ etiqueta: t.etiqueta, texto: t.text, seccion: "Tareas" }));
    finance.forEach((f) => f.etiqueta && out.push({ etiqueta: f.etiqueta, texto: f.concepto, seccion: "Finanzas" }));
    return out;
  }, [notes, runbooks, work, tasks, finance]);

  const conteo = useMemo(() => {
    const m = {};
    items.forEach((i) => (m[i.etiqueta] = (m[i.etiqueta] || 0) + 1));
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, [items]);

  const filtrados = sel ? items.filter((i) => i.etiqueta === sel) : [];

  return (
    <div>
      <SectionTitle icon={Tag} title="Etiquetas" subtitle="Todo lo etiquetado, en un sitio" />

      <Card className="mb-6">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Nube de etiquetas</h2>
        {conteo.length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay elementos etiquetados. Añade etiquetas en el Segundo Cerebro o categorías en Trabajo.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {conteo.map(([t, n]) => (
              <button
                key={t}
                onClick={() => setSel(sel === t ? "" : t)}
                className={`rounded-full px-3 py-1.5 text-sm font-medium transition ${sel === t ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-300 hover:bg-slate-700"}`}
              >
                #{t} <span className="opacity-60">{n}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      {sel && (
        <Card>
          <h2 className="mb-3 text-lg font-semibold text-slate-100">#{sel}</h2>
          <ul className="space-y-2">
            {filtrados.map((i, k) => (
              <li key={k} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className="text-slate-200">{i.texto}</span>
                <span className="shrink-0 rounded bg-slate-800 px-2 py-0.5 text-xs text-slate-400">{i.seccion}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
