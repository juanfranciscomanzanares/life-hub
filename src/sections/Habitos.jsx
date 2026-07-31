import { useState, useMemo } from "react";
import { Plus, Trash2, Flame, CheckCircle2, CalendarCheck } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, todayISO } from "../lib/ui";
import { confeti } from "../lib/confetti";
import { nuevoId } from "../lib/id";
import {
  normalizarHabito,
  semanaDe,
  estaHecho,
  alternarDia,
  racha,
  mejorRacha,
  hechosHoy,
} from "../lib/habitos";

const HABIT_DAYS = ["L", "M", "X", "J", "V", "S", "D"];
// Vacío a propósito: ver src/lib/datosUni.js.
const INITIAL_HABITS = [];

function Habitos() {
  const [habitsCrudo, setHabits] = usePersisted("lh_habits", INITIAL_HABITS);
  const [newHabit, setNewHabit] = useState("");

  const hoy = todayISO();
  // Se normaliza al leer, no al guardar: así los hábitos del formato antiguo
  // funcionan desde el primer render, sin migración destructiva.
  const habits = useMemo(() => habitsCrudo.map((h) => normalizarHabito(h, hoy)), [habitsCrudo, hoy]);
  const semana = useMemo(() => semanaDe(hoy), [hoy]);

  /*
    Marca o desmarca un día. Si al marcarlo se completan los siete días de la
    semana, se celebra: solo al cerrarla, no cada vez que se toca un día de una
    semana ya completa.
  */
  const toggleDay = (hid, fecha) => {
    const habito = habits.find((h) => h.id === hid);
    if (!habito) return;

    const actualizado = alternarDia(habito, fecha);
    const completa = (h) => semana.every((d) => estaHecho(h, d));
    if (!completa(habito) && completa(actualizado)) confeti();

    setHabits(habits.map((h) => (h.id === hid ? actualizado : h)));
  };

  const addHabit = () => {
    if (!newHabit.trim()) return;
    setHabits([...habits, { id: nuevoId(), name: newHabit, hecho: [] }]);
    setNewHabit("");
  };

  const bestStreak = mejorRacha(habits, hoy);
  const doneToday = hechosHoy(habits, hoy);

  return (
    <div>
      <SectionTitle icon={CalendarCheck} title="Hábitos & Rachas" subtitle="Construye consistencia día a día" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{bestStreak} días</p>
            <p className="text-sm text-slate-400">Mejor racha</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">
              {doneToday}/{habits.length}
            </p>
            <p className="text-sm text-slate-400">Hechos hoy</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <CalendarCheck size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{habits.length}</p>
            <p className="text-sm text-slate-400">Hábitos activos</p>
          </div>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="flex gap-2">
          <input
            placeholder="Nuevo hábito..."
            value={newHabit}
            onChange={(e) => setNewHabit(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addHabit()}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={addHabit}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            <Plus size={16} /> Añadir
          </button>
        </div>
      </Card>

      <Card className="space-y-4">
        {habits.map((h) => (
          <div key={h.id} className="flex flex-col gap-3 border-b border-slate-800/60 pb-4 last:border-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1 rounded-lg bg-amber-500/15 px-2 py-1 text-xs font-semibold text-amber-400">
                <Flame size={13} /> {racha(h, hoy)}
              </span>
              <span className="font-medium text-slate-100">{h.name}</span>
            </div>
            <div className="flex gap-1.5">
              {HABIT_DAYS.map((d, i) => {
                const fecha = semana[i];
                const hecho = estaHecho(h, fecha);
                const esHoy = fecha === hoy;
                const futuro = fecha > hoy;
                return (
                  <button
                    key={fecha}
                    onClick={() => toggleDay(h.id, fecha)}
                    disabled={futuro}
                    title={`${d} ${fecha}`}
                    aria-label={`${h.name}, ${d} ${fecha}`}
                    aria-pressed={hecho}
                    className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition ${
                      hecho
                        ? "bg-emerald-500 text-white"
                        : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                    } ${esHoy ? "ring-2 ring-indigo-400" : ""} ${futuro ? "opacity-40" : ""}`}
                  >
                    {d}
                  </button>
                );
              })}
              <button
                onClick={() => setHabits(habits.filter((x) => x.id !== h.id))}
                className="ml-1 flex h-9 w-9 items-center justify-center text-slate-500 transition hover:text-rose-400"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
      </Card>
    </div>
  );
}

export default Habitos;
