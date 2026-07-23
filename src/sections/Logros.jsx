import { Trophy, Lock } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle } from "../lib/ui";

export default function Logros() {
  const [gym] = usePersisted("lh_gym", []);
  const [work] = usePersisted("lh_work_log", []);
  const [contribs] = usePersisted("lh_contribs", []);
  const [habits] = usePersisted("lh_habits", []);
  const [notes] = usePersisted("lh_notes", []);
  const [health] = usePersisted("lh_health", []);

  const invertido = contribs.reduce((a, b) => a + Number(b.monto || 0), 0);
  const horasTrabajo = work.reduce((a, b) => a + Number(b.horas || 0), 0);
  const rachaMax = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);

  // valor actual, meta, etiqueta
  const logros = [
    { nombre: "Primera marca", desc: "Registra tu primer ejercicio", val: gym.length, meta: 1, emoji: "🏋️" },
    { nombre: "Constante en el gym", desc: "50 marcas de gimnasio", val: gym.length, meta: 50, emoji: "💪" },
    { nombre: "Ahorrador", desc: "Invierte 500€ en total", val: invertido, meta: 500, emoji: "💰" },
    { nombre: "Inversor serio", desc: "Invierte 2000€ en total", val: invertido, meta: 2000, emoji: "📈" },
    { nombre: "Trabajador", desc: "100h de trabajo registradas", val: horasTrabajo, meta: 100, emoji: "🧑‍💻" },
    { nombre: "Disciplina", desc: "Racha de 7 días en hábitos", val: rachaMax, meta: 7, emoji: "🔥" },
    { nombre: "Imparable", desc: "Racha de 30 días en hábitos", val: rachaMax, meta: 30, emoji: "⚡" },
    { nombre: "Segundo cerebro", desc: "Guarda 15 notas/flashcards", val: notes.length, meta: 15, emoji: "🧠" },
    { nombre: "Cuídate", desc: "Registra 30 días de salud", val: health.length, meta: 30, emoji: "❤️" },
  ];

  const desbloqueados = logros.filter((l) => l.val >= l.meta).length;

  return (
    <div>
      <SectionTitle icon={Trophy} title="Logros" subtitle="Tu constancia, en insignias" />

      <Card className="mb-6 flex items-center gap-4">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-500/15 text-amber-400"><Trophy size={28} /></div>
        <div>
          <p className="text-2xl font-bold text-slate-100">{desbloqueados} / {logros.length}</p>
          <p className="text-sm text-slate-400">logros desbloqueados</p>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {logros.map((l) => {
          const done = l.val >= l.meta;
          const pct = Math.min(100, (l.val / l.meta) * 100);
          return (
            <Card key={l.nombre} className={done ? "" : "opacity-80"}>
              <div className="mb-2 flex items-center gap-3">
                <span className={`flex h-11 w-11 items-center justify-center rounded-xl text-2xl ${done ? "bg-amber-500/15" : "bg-slate-800 grayscale"}`}>
                  {done ? l.emoji : <Lock size={18} className="text-slate-500" />}
                </span>
                <div>
                  <p className="font-semibold text-slate-100">{l.nombre}</p>
                  <p className="text-xs text-slate-400">{l.desc}</p>
                </div>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                <div className={`h-full rounded-full ${done ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-right text-[10px] text-slate-500">{Math.min(l.val, l.meta)} / {l.meta}</p>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
