import { useState } from "react";
import { Brain, RotateCcw } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, todayISO } from "../lib/ui";

const addDays = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function Repaso() {
  const [notes] = usePersisted("lh_notes", []);
  const [srs, setSrs] = usePersisted("lh_srs", {});
  const [revelado, setRevelado] = useState(false);

  const flashcards = notes.filter((n) => n.type === "flashcard");
  const hoy = todayISO();
  const due = flashcards.filter((c) => !srs[c.id] || srs[c.id].due <= hoy);
  const card = due[0];

  const calificar = (grado) => {
    if (!card) return;
    const prev = srs[card.id] || { interval: 0, ease: 2.3 };
    let { interval, ease } = prev;
    if (grado === "otra") { interval = 1; ease = Math.max(1.3, ease - 0.2); }
    else if (grado === "bien") { interval = interval < 1 ? 2 : Math.round(interval * ease); }
    else { ease += 0.1; interval = interval < 1 ? 4 : Math.round(interval * ease * 1.3); }
    setSrs({ ...srs, [card.id]: { interval, ease, due: addDays(interval) } });
    setRevelado(false);
  };

  return (
    <div>
      <SectionTitle icon={Brain} title="Repaso" subtitle="Memoriza con repetición espaciada (tipo Anki)" />

      <Card className="mb-4 flex items-center justify-between">
        <div>
          <p className="text-2xl font-bold text-slate-100">{due.length}</p>
          <p className="text-sm text-slate-400">tarjetas para repasar hoy</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-slate-400">{flashcards.length} flashcards en total</p>
          <p className="text-xs text-slate-500">Créalas en Segundo Cerebro</p>
        </div>
      </Card>

      {!card ? (
        <Card className="py-12 text-center">
          <p className="text-lg font-semibold text-slate-200">¡Todo repasado por hoy! 🎉</p>
          <p className="mt-1 text-sm text-slate-500">Vuelve mañana o añade nuevas flashcards.</p>
        </Card>
      ) : (
        <Card className="py-8">
          <p className="mb-2 text-center text-xs uppercase tracking-wide text-slate-500">Pregunta</p>
          <p className="mb-6 text-center text-xl font-semibold text-slate-100">{card.title}</p>

          {revelado ? (
            <>
              <div className="mx-auto mb-6 max-w-md rounded-xl border border-slate-800 bg-slate-800/40 p-4 text-center text-slate-200">{card.body}</div>
              <div className="flex justify-center gap-2">
                <button onClick={() => calificar("otra")} className="rounded-lg bg-rose-500/90 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500">Otra vez</button>
                <button onClick={() => calificar("bien")} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">Bien</button>
                <button onClick={() => calificar("facil")} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400">Fácil</button>
              </div>
            </>
          ) : (
            <div className="flex justify-center">
              <button onClick={() => setRevelado(true)} className="flex items-center gap-2 rounded-xl bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400">
                <RotateCcw size={16} /> Mostrar respuesta
              </button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
