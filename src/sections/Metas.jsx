import { useState } from "react";
import { Flag, Plus, Trash2, TrendingUp, Dumbbell, Briefcase, Coins, GraduationCap, LineChart } from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { Card, SectionTitle, fmtEuro, monthKey, monthLabel } from "../lib/ui";

const INITIAL_GOALS = [
  { id: 1, titulo: "Invertir este año", objetivo: 2000, actual: 1050, unidad: "€" },
  { id: 2, titulo: "Media de gym semanal", objetivo: 4, actual: 3, unidad: "sesiones" },
  { id: 3, titulo: "Nota media del cuatrimestre", objetivo: 8, actual: 7.4, unidad: "/10" },
];

export default function Metas() {
  const [goals, setGoals] = usePersisted("lh_goals", INITIAL_GOALS);
  const [history, setHistory] = usePersisted("lh_portfolio_history", []);
  const [form, setForm] = useState({ titulo: "", objetivo: "", unidad: "€" });

  // Lectura (solo consulta) de datos de otras secciones para KPIs automáticos
  const [gym] = usePersisted("lh_gym", []);
  const [work] = usePersisted("lh_work_log", []);
  const [contribs] = usePersisted("lh_contribs", []);
  const [study] = usePersisted("lh_study_hours", {});
  const [investments] = usePersisted("lh_investments", []);

  const thisMonth = new Date().toISOString().slice(0, 7);
  const gymThisMonth = gym.filter((g) => monthKey(g.fecha) === thisMonth).length;
  const workHoursMonth = work.filter((w) => monthKey(w.fecha) === thisMonth).reduce((a, b) => a + Number(b.horas || 0), 0);
  const investedMonth = contribs.filter((c) => monthKey(c.fecha) === thisMonth).reduce((a, b) => a + Number(b.monto || 0), 0);
  const studyTotal = Object.values(study).reduce((a, b) => a + Number(b || 0), 0);

  const totalActual = investments.reduce((a, b) => a + Number(b.valorActual || 0), 0);
  const totalAportado = investments.reduce((a, b) => a + Number(b.aportado || 0), 0);

  const saveSnapshot = () => {
    const rest = history.filter((h) => h.month !== thisMonth);
    setHistory([...rest, { month: thisMonth, valor: totalActual, aportado: totalAportado }].sort((a, b) => a.month.localeCompare(b.month)));
  };

  const shownHistory = history.slice(-8);
  const maxBar = Math.max(...shownHistory.map((h) => h.valor), totalActual, 1);

  const addGoal = () => {
    if (!form.titulo.trim() || !form.objetivo) return;
    setGoals([...goals, { id: Date.now(), titulo: form.titulo, objetivo: Number(form.objetivo), actual: 0, unidad: form.unidad }]);
    setForm({ titulo: "", objetivo: "", unidad: "€" });
  };

  const bump = (id, delta) =>
    setGoals(goals.map((g) => (g.id === id ? { ...g, actual: Math.max(0, Math.round((g.actual + delta) * 10) / 10) } : g)));

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  const kpis = [
    { label: "Gym este mes", value: `${gymThisMonth}`, sub: "sesiones", icon: Dumbbell, color: "text-emerald-400 bg-emerald-500/15" },
    { label: "Trabajo este mes", value: `${workHoursMonth}h`, sub: "Agrosana", icon: Briefcase, color: "text-indigo-400 bg-indigo-500/15" },
    { label: "Invertido este mes", value: fmtEuro(investedMonth), sub: "aportado", icon: Coins, color: "text-amber-400 bg-amber-500/15" },
    { label: "Horas de estudio", value: `${studyTotal}h`, sub: "acumuladas", icon: GraduationCap, color: "text-fuchsia-400 bg-fuchsia-500/15" },
  ];

  return (
    <div>
      <SectionTitle icon={Flag} title="Metas y progreso" subtitle="Tus objetivos y el pulso de cada área" />

      {/* KPIs automáticos */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label} className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${k.color}`}>
                <Icon size={20} />
              </div>
              <div>
                <p className="text-xl font-bold text-slate-100">{k.value}</p>
                <p className="text-xs text-slate-400">{k.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Objetivos manuales */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Flag size={18} className="text-indigo-400" /> Mis objetivos
        </h2>

        <div className="mb-4 flex flex-wrap items-end gap-2">
          <input placeholder="Nuevo objetivo" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={`flex-1 ${inputCls}`} />
          <input type="number" placeholder="Meta" value={form.objetivo} onChange={(e) => setForm({ ...form, objetivo: e.target.value })} className={`w-24 ${inputCls}`} />
          <input placeholder="Unidad" value={form.unidad} onChange={(e) => setForm({ ...form, unidad: e.target.value })} className={`w-24 ${inputCls}`} />
          <button onClick={addGoal} className="flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
            <Plus size={15} /> Añadir
          </button>
        </div>

        <div className="space-y-4">
          {goals.map((g) => {
            const pct = g.objetivo > 0 ? Math.min(100, (g.actual / g.objetivo) * 100) : 0;
            const done = pct >= 100;
            return (
              <div key={g.id}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="font-medium text-slate-200">{g.titulo}</span>
                  <div className="flex items-center gap-2">
                    <button onClick={() => bump(g.id, -1)} className="flex h-6 w-6 items-center justify-center rounded bg-slate-700 text-slate-200 hover:bg-slate-600">−</button>
                    <span className="w-24 text-right text-slate-400">
                      {g.actual} / {g.objetivo} {g.unidad}
                    </span>
                    <button onClick={() => bump(g.id, 1)} className="flex h-6 w-6 items-center justify-center rounded bg-indigo-500 text-white hover:bg-indigo-400">+</button>
                    <button onClick={() => removeWithUndo(goals, setGoals, g.id, "Objetivo")} className="text-slate-500 hover:text-rose-400">
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div className={`h-full rounded-full ${done ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Evolución de la cartera */}
      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <LineChart size={18} className="text-emerald-400" /> Evolución de la cartera
          </h2>
          <button onClick={saveSnapshot} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400">
            <TrendingUp size={14} /> Guardar valor de {monthLabel(thisMonth)}
          </button>
        </div>

        {shownHistory.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            Aún no hay histórico. Pulsa "Guardar valor" cada mes para ir construyendo la gráfica de evolución.
          </p>
        ) : (
          <div className="flex h-48 items-end justify-between gap-2">
            {shownHistory.map((h) => (
              <div key={h.month} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-[10px] font-medium text-slate-400">{fmtEuro(h.valor)}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400"
                    style={{ height: `${(h.valor / maxBar) * 100}%` }}
                    title={`${monthLabel(h.month)}: ${fmtEuro(h.valor)}`}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{monthLabel(h.month)}</span>
              </div>
            ))}
          </div>
        )}
        <p className="mt-3 text-xs text-slate-500">Valor actual de la cartera: {fmtEuro(totalActual)}</p>
      </Card>
    </div>
  );
}
