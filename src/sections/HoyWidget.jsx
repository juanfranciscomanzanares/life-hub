import { CalendarClock } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card } from "../lib/ui";

const TYPE_DOT = {
  Gym: "bg-emerald-400",
  Tenis: "bg-amber-400",
  Universidad: "bg-sky-400",
  Trabajo: "bg-indigo-400",
  Otro: "bg-slate-400",
};
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

export default function HoyWidget() {
  const [routine] = usePersisted("lh_routine", []);
  const hoy = (new Date().getDay() + 6) % 7; // 0 = lunes
  const items = routine.filter((r) => Number(r.dia) === hoy).sort((a, b) => a.hora.localeCompare(b.hora));

  return (
    <Card className="mb-6">
      <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <CalendarClock size={18} className="text-indigo-400" /> Hoy · {DIAS[hoy]}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">No hay nada fijo en tu rutina para hoy. ¡Día libre!</p>
      ) : (
        <ul className="space-y-2">
          {items.map((r) => (
            <li key={r.id} className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${TYPE_DOT[r.tipo] || TYPE_DOT.Otro}`} />
              <span className="w-14 shrink-0 font-semibold text-slate-200">{r.hora}</span>
              <span className="flex-1 text-sm text-slate-300">{r.titulo}</span>
              <span className="text-xs text-slate-500">{r.tipo}</span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
