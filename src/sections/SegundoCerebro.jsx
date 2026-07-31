import { useState } from "react";
import { Plus, Trash2, Brain, Link2, Search } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle } from "../lib/ui";
import { removeWithUndo } from "../lib/toast";

import { nuevoId } from "../lib/id";
// Vacío a propósito: ver src/lib/datosUni.js.
const INITIAL_NOTES = [];

function SegundoCerebro() {
  const [items, setItems] = usePersisted("lh_notes", INITIAL_NOTES);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("todos");
  const [revealed, setRevealed] = useState({});
  const [form, setForm] = useState({ type: "nota", title: "", body: "", tag: "General" });
  const [showForm, setShowForm] = useState(false);

  const filtered = items.filter((it) => {
    const matchType = typeFilter === "todos" || it.type === typeFilter;
    const q = query.toLowerCase();
    const matchQuery =
      it.title.toLowerCase().includes(q) || it.body.toLowerCase().includes(q) || it.tag.toLowerCase().includes(q);
    return matchType && matchQuery;
  });

  const typeMeta = {
    nota: { label: "Nota", color: "bg-indigo-500/15 text-indigo-300", icon: Brain },
    enlace: { label: "Enlace", color: "bg-sky-500/15 text-sky-300", icon: Link2 },
    flashcard: { label: "Flashcard", color: "bg-fuchsia-500/15 text-fuchsia-300", icon: Search },
  };

  const add = () => {
    if (!form.title.trim()) return;
    setItems([{ id: nuevoId(), ...form }, ...items]);
    setForm({ type: "nota", title: "", body: "", tag: "General" });
    setShowForm(false);
  };

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Brain} title="Segundo Cerebro" subtitle="Notas, enlaces y flashcards en un solo sitio" />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            placeholder="Buscar en tu conocimiento..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-700 bg-slate-800 py-2 pl-9 pr-3 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-2">
          {["todos", "nota", "enlace", "flashcard"].map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`rounded-full px-3 py-1.5 text-xs font-medium capitalize transition ${
                typeFilter === t ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {t === "todos" ? "Todos" : typeMeta[t].label}
            </button>
          ))}
          <button
            onClick={() => setShowForm((s) => !s)}
            className="flex items-center gap-1 rounded-full bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
          >
            <Plus size={14} /> Nuevo
          </button>
        </div>
      </div>

      {showForm && (
        <Card className="mb-4 space-y-3">
          <div className="flex gap-2">
            {Object.keys(typeMeta).map((t) => (
              <button
                key={t}
                onClick={() => setForm({ ...form, type: t })}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  form.type === t ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400"
                }`}
              >
                {typeMeta[t].label}
              </button>
            ))}
          </div>
          <input
            placeholder={form.type === "flashcard" ? "Pregunta" : "Título"}
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            className={inputCls}
          />
          <textarea
            placeholder={form.type === "flashcard" ? "Respuesta" : form.type === "enlace" ? "URL" : "Contenido"}
            value={form.body}
            onChange={(e) => setForm({ ...form, body: e.target.value })}
            rows={2}
            className={`resize-none ${inputCls}`}
          />
          <div className="flex gap-2">
            <input
              placeholder="Etiqueta"
              value={form.tag}
              onChange={(e) => setForm({ ...form, tag: e.target.value })}
              className={inputCls}
            />
            <button
              onClick={add}
              className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
            >
              Guardar
            </button>
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {filtered.length === 0 && (
          <p className="col-span-full py-8 text-center text-sm text-slate-500">Nada encontrado.</p>
        )}
        {filtered.map((it) => {
          const meta = typeMeta[it.type];
          const Icon = meta.icon;
          const isCard = it.type === "flashcard";
          const isLink = it.type === "enlace";
          return (
            <Card key={it.id} className="flex flex-col">
              <div className="mb-2 flex items-center justify-between">
                <span className={`flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${meta.color}`}>
                  <Icon size={12} /> {meta.label}
                </span>
                <div className="flex items-center gap-2">
                  {it.type === "nota" && (
                    <button onClick={() => setItems(items.map((x) => (x.id === it.id ? { ...x, type: "flashcard" } : x)))} title="Convertir en flashcard" className="text-slate-600 transition hover:text-fuchsia-400">
                      <Brain size={14} />
                    </button>
                  )}
                  <button
                    onClick={() => removeWithUndo(items, setItems, it.id, "Elemento")}
                    className="text-slate-600 transition hover:text-rose-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
              <h3 className="mb-1 font-semibold text-slate-100">{it.title}</h3>
              {isLink ? (
                <a href={it.body} target="_blank" rel="noreferrer" className="break-all text-sm text-sky-400 hover:underline">
                  {it.body}
                </a>
              ) : isCard ? (
                <button
                  onClick={() => setRevealed({ ...revealed, [it.id]: !revealed[it.id] })}
                  className="mt-1 rounded-lg border border-dashed border-slate-700 px-3 py-2 text-left text-sm text-slate-300 transition hover:border-slate-600"
                >
                  {revealed[it.id] ? it.body : "Pulsa para ver la respuesta"}
                </button>
              ) : (
                <p className="text-sm text-slate-400">{it.body}</p>
              )}
              <span className="mt-3 self-start rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">
                #{it.tag}
              </span>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

export default SegundoCerebro;
