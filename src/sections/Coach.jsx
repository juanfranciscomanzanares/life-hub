import { Sparkles, AlertTriangle, Info, CheckCircle2, ArrowRight } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, monthKey, todayISO, fmtEuro } from "../lib/ui";

const diasEntre = (iso) => Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);

export default function Coach({ onNavigate }) {
  const [gym] = usePersisted("lh_gym", []);
  const [contribs] = usePersisted("lh_contribs", []);
  const [goal] = usePersisted("lh_invest_goal", 0);
  const [finance] = usePersisted("lh_finance", []);
  const [health] = usePersisted("lh_health", []);
  const [habits] = usePersisted("lh_habits", []);
  const [notes] = usePersisted("lh_notes", []);
  const [srs] = usePersisted("lh_srs", {});
  const [work] = usePersisted("lh_work_log", []);

  const s = [];
  const add = (nivel, texto, seccion) => s.push({ nivel, texto, seccion });

  // Gym
  if (gym.length) {
    const ultima = gym.map((g) => g.fecha).sort().slice(-1)[0];
    const d = diasEntre(ultima);
    if (d >= 4) add("warn", `Llevas ${d} días sin registrar gimnasio. ¿Toca entrenar?`, "gimnasio");
    else add("good", "Buen ritmo en el gym esta semana. ¡Sigue así!", "gimnasio");
  }

  // Inversión del mes
  const mes = todayISO().slice(0, 7);
  const invMes = contribs.filter((c) => monthKey(c.fecha) === mes).reduce((a, b) => a + Number(b.monto || 0), 0);
  if (goal > 0 && invMes < goal) add("info", `Te faltan ${fmtEuro(goal - invMes)} para tu objetivo de inversión de este mes.`, "inversiones");
  else if (goal > 0) add("good", "¡Objetivo de inversión del mes cumplido!", "inversiones");

  // Finanzas: comparación de gasto
  const gastoMes = (m) => finance.filter((f) => f.monto < 0 && monthKey(f.fecha) === m).reduce((a, b) => a + Math.abs(b.monto), 0);
  const prevMes = (() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().slice(0, 7); })();
  const gm = gastoMes(mes), gp = gastoMes(prevMes);
  if (gp > 0 && gm > gp * 1.2) add("warn", `Este mes gastas un ${Math.round(((gm - gp) / gp) * 100)}% más que el anterior (${fmtEuro(gm)} vs ${fmtEuro(gp)}).`, "finanzas");

  // Repaso
  const dueCount = notes.filter((n) => n.type === "flashcard" && (!srs[n.id] || srs[n.id].due <= todayISO())).length;
  if (dueCount > 0) add("info", `Tienes ${dueCount} tarjeta(s) para repasar hoy.`, "repaso");

  // Salud
  if (health.length) {
    const d = diasEntre(health.map((h) => h.fecha).sort().slice(-1)[0]);
    if (d >= 3) add("info", `Hace ${d} días que no registras datos de salud.`, "salud");
  } else {
    add("info", "Aún no has registrado nada en Salud. Empieza con tu peso de hoy.", "salud");
  }

  // Hábitos de hoy
  const hoyIdx = (new Date().getDay() + 6) % 7;
  const pendientes = habits.filter((h) => h.week && !h.week[hoyIdx]).length;
  if (pendientes > 0) add("info", `Te quedan ${pendientes} hábito(s) por marcar hoy.`, "habitos");

  // Trabajo de la semana
  const lunes = (() => { const d = new Date(); d.setDate(d.getDate() - hoyIdx); return d.toISOString().slice(0, 10); })();
  const hSemana = work.filter((w) => w.fecha >= lunes).reduce((a, b) => a + Number(b.horas || 0), 0);
  if (hSemana > 0) add("good", `Llevas ${hSemana}h de trabajo esta semana en Agrosana.`, "trabajo");

  const orden = { warn: 0, info: 1, good: 2 };
  s.sort((a, b) => orden[a.nivel] - orden[b.nivel]);

  const estilo = {
    warn: { icon: AlertTriangle, cls: "border-rose-800/60 bg-rose-500/10", ic: "text-rose-400" },
    info: { icon: Info, cls: "border-sky-800/60 bg-sky-500/10", ic: "text-sky-400" },
    good: { icon: CheckCircle2, cls: "border-emerald-800/60 bg-emerald-500/10", ic: "text-emerald-400" },
  };

  return (
    <div>
      <SectionTitle icon={Sparkles} title="Coach" subtitle="Sugerencias personalizadas según tus datos" />

      {s.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">Registra algo de actividad y aquí verás recomendaciones.</Card>
      ) : (
        <div className="space-y-3">
          {s.map((x, i) => {
            const e = estilo[x.nivel];
            const Icon = e.icon;
            return (
              <div key={i} className={`flex items-center gap-3 rounded-2xl border p-4 ${e.cls}`}>
                <Icon size={20} className={`shrink-0 ${e.ic}`} />
                <p className="flex-1 text-sm text-slate-100">{x.texto}</p>
                {x.seccion && onNavigate && (
                  <button onClick={() => onNavigate(x.seccion)} className="flex shrink-0 items-center gap-1 rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-200 transition hover:bg-slate-700">
                    Ir <ArrowRight size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
