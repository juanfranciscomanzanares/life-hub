import { CalendarClock, Umbrella } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, todayISO } from "../lib/ui";
import { queHayEl } from "../lib/uni";
import { LUGAR_POR_DEFECTO, useTiempo, diaDe } from "../lib/tiempo";
import { useFestivos, festivoDe, aniosNecesarios } from "../lib/festivos";
import { IconoTiempo, fmtTemp } from "../lib/tiempoUi";

const TYPE_DOT = {
  Gym: "bg-emerald-400",
  Tenis: "bg-amber-400",
  Universidad: "bg-sky-400",
  Trabajo: "bg-indigo-400",
  Otro: "bg-slate-400",
};
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

// Por debajo de esto la probabilidad no cambia lo que uno hace, y anunciar
// "10% de lluvia" en cada día soleado es ruido.
const LLUVIA_RELEVANTE = 30;

export default function HoyWidget() {
  const [routine] = usePersisted("lh_routine", []);
  const [lugar] = usePersisted("lh_tiempo_lugar", LUGAR_POR_DEFECTO);
  const hoyISO = todayISO();
  const hoy = (new Date().getDay() + 6) % 7; // 0 = lunes

  const { prevision } = useTiempo(lugar);
  const tiempoHoy = diaDe(prevision, hoyISO);
  const ahora = prevision?.ahora;

  /*
    Los festivos oficiales complementan al calendario académico, no lo
    sustituyen: manda el académico, que es más específico (sabe de la Romería y
    del patrón de la Facultad). Esto cubre el hueco de fuera del curso, donde
    `queHayEl` no sabe nada y el 15 de agosto pasaba como un día cualquiera.
  */
  const { festivos } = useFestivos(aniosNecesarios(new Date().getFullYear()));
  const academico = queHayEl(hoyISO);
  const festivo = academico ? null : festivoDe(festivos, hoyISO);
  const hayClase = academico?.tipo === "clases";

  const items = routine
    .filter((r) => Number(r.dia) === hoy)
    .filter((r) => hayClase || r.tipo !== "Universidad")
    .sort((a, b) => a.hora.localeCompare(b.hora));

  const ocultas = routine.filter((r) => Number(r.dia) === hoy && r.tipo === "Universidad").length -
    items.filter((r) => r.tipo === "Universidad").length;

  const chip = "rounded-full bg-slate-800 px-2.5 py-0.5 text-xs font-medium text-slate-400";

  return (
    <Card className="mb-6">
      <h2 className="mb-3 flex flex-wrap items-center gap-2 text-lg font-semibold text-slate-100">
        <CalendarClock size={18} className="text-indigo-400" aria-hidden="true" /> Hoy · {DIAS[hoy]}
        {academico && <span className={chip}>{academico.titulo}</span>}
        {festivo && <span className={chip}>{festivo.titulo}</span>}

        {/* El tiempo no se anuncia si no ha llegado: sin conexión, el widget
            sigue siendo el de siempre en vez de enseñar un hueco roto. */}
        {tiempoHoy && (
          <span className={`ml-auto flex items-center gap-2 ${chip}`}>
            <IconoTiempo icono={ahora?.icono ?? tiempoHoy.icono} size={15} />
            <span className="tabular-nums text-slate-300">
              {ahora ? fmtTemp(ahora.temp) : fmtTemp(tiempoHoy.tmax)}
            </span>
            <span className="tabular-nums text-slate-500">
              {fmtTemp(tiempoHoy.tmax)}/{fmtTemp(tiempoHoy.tmin)}
            </span>
            {tiempoHoy.lluvia >= LLUVIA_RELEVANTE && (
              <span className="flex items-center gap-1 tabular-nums text-sky-300">
                <Umbrella size={13} aria-hidden="true" />
                {tiempoHoy.lluvia}%
              </span>
            )}
          </span>
        )}
      </h2>
      {items.length === 0 ? (
        <p className="text-sm text-slate-500">
          {ocultas > 0
            ? "Hoy no hay clase, así que no te pongo el horario de la facultad."
            : "No hay nada fijo en tu rutina para hoy. ¡Día libre!"}
        </p>
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
