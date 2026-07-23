import { Sparkles, Briefcase, Dumbbell, Coins, HeartPulse, CalendarCheck, Bell } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, fmtEuro } from "../lib/ui";

// Lunes de la semana actual (ISO)
function weekStartISO() {
  const d = new Date();
  const day = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d.toISOString().slice(0, 10);
}

export default function Resumen() {
  const [gym] = usePersisted("lh_gym", []);
  const [work] = usePersisted("lh_work_log", []);
  const [contribs] = usePersisted("lh_contribs", []);
  const [finance] = usePersisted("lh_finance", []);
  const [health] = usePersisted("lh_health", []);
  const [habits] = usePersisted("lh_habits", []);

  const start = weekStartISO();
  const inWeek = (f) => f >= start; // desde el lunes hasta hoy

  const gymSes = gym.filter((g) => inWeek(g.fecha)).length;
  const workH = work.filter((w) => inWeek(w.fecha)).reduce((a, b) => a + Number(b.horas || 0), 0);
  const invested = contribs.filter((c) => inWeek(c.fecha)).reduce((a, b) => a + Number(b.monto || 0), 0);
  const finRows = finance.filter((f) => inWeek(f.fecha));
  const gastos = finRows.filter((f) => f.monto < 0).reduce((a, b) => a + Math.abs(b.monto), 0);
  const healthWeek = health.filter((h) => inWeek(h.fecha));
  const sueno = healthWeek.length ? Math.round((healthWeek.reduce((a, b) => a + Number(b.sueno || 0), 0) / healthWeek.length) * 10) / 10 : 0;
  const habitsDone = habits.reduce((a, h) => a + (h.week ? h.week.filter(Boolean).length : 0), 0);

  const stats = [
    { label: "Horas de trabajo", value: `${workH} h`, icon: Briefcase, color: "text-indigo-400 bg-indigo-500/15" },
    { label: "Sesiones de gym", value: `${gymSes}`, icon: Dumbbell, color: "text-emerald-400 bg-emerald-500/15" },
    { label: "Invertido", value: fmtEuro(invested), icon: Coins, color: "text-amber-400 bg-amber-500/15" },
    { label: "Gastado", value: fmtEuro(gastos), icon: Coins, color: "text-rose-400 bg-rose-500/15" },
    { label: "Sueño medio", value: `${sueno} h`, icon: HeartPulse, color: "text-sky-400 bg-sky-500/15" },
    { label: "Hábitos cumplidos", value: `${habitsDone}`, icon: CalendarCheck, color: "text-fuchsia-400 bg-fuchsia-500/15" },
  ];

  const texto =
    `Esta semana: ${workH}h de trabajo, ${gymSes} sesiones de gym, ${fmtEuro(invested)} invertidos, ` +
    `${fmtEuro(gastos)} en gastos, ${sueno}h de sueño de media y ${habitsDone} hábitos cumplidos.`;

  const notificar = () => {
    if (typeof Notification === "undefined") return;
    if (Notification.permission === "granted") new Notification("Resumen semanal · Life Hub", { body: texto });
    else Notification.requestPermission().then((p) => { if (p === "granted") new Notification("Resumen semanal · Life Hub", { body: texto }); });
  };

  return (
    <div>
      <SectionTitle icon={Sparkles} title="Resumen semanal" subtitle={`Desde el lunes ${start}`} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="flex items-center gap-3">
              <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${s.color}`}><Icon size={20} /></div>
              <div>
                <p className="text-xl font-bold text-slate-100">{s.value}</p>
                <p className="text-xs text-slate-400">{s.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      <Card>
        <h2 className="mb-2 text-lg font-semibold text-slate-100">Tu semana en una frase</h2>
        <p className="text-slate-300">{texto}</p>
        <button onClick={notificar} className="mt-4 flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
          <Bell size={15} /> Enviar como notificación
        </button>
        <p className="mt-3 text-xs text-slate-500">
          Para recibir este resumen automáticamente cada domingo (por notificación o email) hace falta una tarea
          programada en el servidor (Supabase Edge Function con cron). Ver docs/INTEGRACIONES.md.
        </p>
      </Card>
    </div>
  );
}
