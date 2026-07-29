import { useState, useEffect, useRef } from "react";
import { Timer, Play, Pause, RotateCcw } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, todayISO } from "../lib/ui";
import { SUBJECTS } from "../lib/uni";

/*
  Pomodoro que apunta las horas de estudio solas.

  Solo registra estudio: las horas de trabajo se apuntan a mano en su sección,
  y tener aquí un segundo sitio donde meterlas solo servía para acabar con las
  mismas horas contadas dos veces.
*/
export default function Foco() {
  const [dur, setDur] = useState(25); // minutos
  const [left, setLeft] = useState(25 * 60); // segundos
  const [run, setRun] = useState(false);
  const [hechas, setHechas] = useState(0);
  const [asignatura, setAsignatura] = useState(SUBJECTS[0]);
  const timer = useRef(null);

  const [study, setStudy] = usePersisted("lh_study_hours", {});
  const [studyLog, setStudyLog] = usePersisted("lh_study_log", []);

  useEffect(() => {
    if (run) {
      timer.current = setInterval(() => setLeft((s) => s - 1), 1000);
      return () => clearInterval(timer.current);
    }
  }, [run]);

  useEffect(() => {
    if (left <= 0 && run) {
      setRun(false);
      registrar(dur);
      setHechas((n) => n + 1);
      setLeft(dur * 60);
      if (typeof Notification !== "undefined" && Notification.permission === "granted") {
        try { new Notification("Sesión de foco completada", { body: `${dur} min de ${asignatura}` }); } catch {}
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left]);

  /*
    Se escribe en los dos sitios: el contador de siempre por asignatura
    (`lh_study_hours`) y el registro fechado (`lh_study_log`), que es el único
    que Analítica puede repartir por semanas o meses.
  */
  const registrar = (min) => {
    const horas = Math.round((min / 60) * 100) / 100;
    setStudy({ ...study, [asignatura]: (Number(study[asignatura]) || 0) + horas });
    setStudyLog([...studyLog, { id: Date.now(), fecha: todayISO(), subject: asignatura, horas }]);
  };

  const setPreset = (m) => { setDur(m); setLeft(m * 60); setRun(false); };
  const reset = () => { setRun(false); setLeft(dur * 60); };
  const mm = String(Math.floor(Math.max(0, left) / 60)).padStart(2, "0");
  const ss = String(Math.max(0, left) % 60).padStart(2, "0");
  const pct = 100 - (left / (dur * 60)) * 100;

  const inputCls = "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Timer} title="Modo foco" subtitle="Pomodoro que registra tus horas automáticamente" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="flex flex-col items-center justify-center py-10">
          <div className="relative mb-6 flex h-52 w-52 items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="46" fill="none" stroke="#1e293b" strokeWidth="6" />
              <circle cx="50" cy="50" r="46" fill="none" stroke="#6366f1" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={`${(pct / 100) * 289} 289`} />
            </svg>
            <span className="text-5xl font-bold tabular-nums text-slate-100">{mm}:{ss}</span>
          </div>
          <div className="mb-4 flex gap-2">
            {[15, 25, 50].map((m) => (
              <button key={m} onClick={() => setPreset(m)} className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${dur === m ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>{m} min</button>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setRun((r) => !r)} className="flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400">
              {run ? <Pause size={16} /> : <Play size={16} />} {run ? "Pausar" : "Empezar"}
            </button>
            <button onClick={reset} className="flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">
              <RotateCcw size={16} /> Reiniciar
            </button>
          </div>
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-100">¿Qué estás estudiando?</h2>
          <div className="mb-4">
            <label htmlFor="foco-asignatura" className="mb-1 block text-xs text-slate-400">
              Asignatura
            </label>
            <select
              id="foco-asignatura"
              name="foco-asignatura"
              value={asignatura}
              onChange={(e) => setAsignatura(e.target.value)}
              className={`w-full ${inputCls}`}
            >
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <p className="text-sm text-slate-400">Sesiones completadas hoy</p>
            <p className="text-3xl font-bold text-slate-100">{hechas}</p>
            <p className="mt-1 text-xs text-slate-500">
              Al terminar cada sesión se suman {Math.round((dur / 60) * 100) / 100}h a {asignatura}, y
              se apuntan con la fecha de hoy para que salgan en Analítica.
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
