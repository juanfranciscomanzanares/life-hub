import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import {
  Home,
  Dumbbell,
  GraduationCap,
  Table2,
  Plus,
  Trash2,
  Clock,
  Flame,
  CheckCircle2,
  Circle,
  Target,
  Menu,
  X,
  TrendingUp,
  Wallet,
  PiggyBank,
  CalendarCheck,
  Brain,
  Link2,
  Search,
  ArrowUpRight,
  ArrowDownRight,
  Briefcase,
  BarChart3,
  BookOpen,
  LogOut,
  Sprout,
  LineChart,
  Coins,
  TrendingDown,
} from "lucide-react";
import { usePersisted } from "./lib/store";
import { sincronizarAulaVirtual } from "./lib/aulaVirtual";
import HoyWidget from "./sections/HoyWidget.jsx";
import { useRoutineNotifier } from "./lib/useRoutineNotifier";
import { useTheme } from "./lib/useTheme";
import { useAutoBackup } from "./lib/useAutoBackup";
import CommandPalette from "./CommandPalette.jsx";
import QuickAdd from "./QuickAdd.jsx";
import Onboarding from "./Onboarding.jsx";
import ToastHost from "./ToastHost.jsx";
import { removeWithUndo } from "./lib/toast";

/*
  Secciones con carga diferida.

  Antes las 17 secciones entraban en el bundle inicial aunque solo abrieras
  Inicio: había que descargarlo todo para ver la pantalla de bienvenida. Ahora
  cada una es su propio trozo y se descarga al abrirla por primera vez.

  Se quedan fuera de aquí (carga inmediata) las que siempre están en pantalla:
  HoyWidget, el botón + flotante, la paleta de comandos, los avisos y el
  onboarding. Cargarlas en diferido solo provocaría un parpadeo.
*/
const Inversiones = lazy(() => import("./sections/Inversiones.jsx"));
const Salud = lazy(() => import("./sections/Salud.jsx"));
const Resumen = lazy(() => import("./sections/Resumen.jsx"));
const Gimnasio = lazy(() => import("./sections/Gimnasio.jsx"));
const Foco = lazy(() => import("./sections/Foco.jsx"));
const Logros = lazy(() => import("./sections/Logros.jsx"));
const Analitica = lazy(() => import("./sections/Analitica.jsx"));
const Repaso = lazy(() => import("./sections/Repaso.jsx"));
const Adjuntos = lazy(() => import("./sections/Adjuntos.jsx"));
const Etiquetas = lazy(() => import("./sections/Etiquetas.jsx"));
const Coach = lazy(() => import("./sections/Coach.jsx"));
const Proximos = lazy(() => import("./sections/Proximos.jsx"));
const Ajustes = lazy(() => import("./sections/Ajustes.jsx"));
import { Flag, CalendarDays, Database, HeartPulse, Sparkles, Timer, Trophy, Sun, Moon, Image, Tag, CalendarClock, Settings, ChevronDown } from "lucide-react";
const TenisMesa = lazy(() => import("./sections/TenisMesa.jsx"));
const TenisEntrenos = lazy(() => import("./sections/TenisEntrenos.jsx"));
const Metas = lazy(() => import("./sections/Metas.jsx"));
const Calendario = lazy(() => import("./sections/Calendario.jsx"));
const Datos = lazy(() => import("./sections/Datos.jsx"));


/* ------------------------------------------------------------------ */
/*  DATOS SIMULADOS (mock data)                                        */
/* ------------------------------------------------------------------ */

/*
  Los registros de ejemplo van vacíos a propósito.

  Antes la app arrancaba con datos ficticios ("Entregar práctica de Álgebra",
  gastos inventados...). En un panel personal eso es ruido, y con la nube era
  además peligroso: un dispositivo nuevo carga primero estos valores y, si esa
  clave aún no existía en el servidor, acababa subiéndolos como si fueran datos
  reales tuyos.

  Los CATÁLOGOS (asignaturas, categorías de trabajo, días de la semana) sí se
  mantienen: son opciones para elegir, no registros.
*/
const INITIAL_TASKS = [];

const TIME_STATS = [
  { label: "Universidad", hours: 18, color: "bg-indigo-500", ring: "text-indigo-400" },
  { label: "Gimnasio", hours: 6, color: "bg-emerald-500", ring: "text-emerald-400" },
  { label: "Tenis de Mesa", hours: 4, color: "bg-amber-500", ring: "text-amber-400" },
  { label: "Ocio / Otros", hours: 12, color: "bg-rose-500", ring: "text-rose-400" },
];

/* Curso 2026/2027, según resguardo de matrícula (28/07/2026) y horarios
   oficiales GCID de la Facultad de Informática (UMU). */

const SUBJECTS = [
  "Fund. Computadores",
  "Infraest. Comp. Altas Prest.",
  "Deep Learning",
  "Gestión de Proyectos",
  "Ciberseguridad",
  "Empresa y Emprendimiento",
  "TFG",
  "Prácticas Externas",
];

/* Teoría (grupo completo, sin ambigüedad de subgrupo). Cada fila es una franja
   horaria; solo se rellena la columna del día en que cae esa clase. */
const SCHEDULE_C1 = [
  { hora: "10:00 - 11:00", dia: "jueves", subject: "Fund. Computadores", curso: "1º", aula: "A.04 Bis" },
  { hora: "15:00 - 17:00", dia: "lunes", subject: "Empresa y Emprendimiento", curso: "4º", aula: "A05" },
  { hora: "15:00 - 17:00", dia: "miercoles", subject: "Ciberseguridad", curso: "4º", aula: "A05" },
  { hora: "17:00 - 19:00", dia: "martes", subject: "Gestión de Proyectos", curso: "4º", aula: "A05" },
  { hora: "18:30 - 20:30", dia: "lunes", subject: "Infraest. Comp. Altas Prest.", curso: "3º", aula: "A.04 Bis" },
];

const SCHEDULE_C2 = [
  { hora: "16:30 - 18:30", dia: "lunes", subject: "Deep Learning", curso: "3º", aula: "A.04 Bis" },
];

/* Sin horario de aula: prácticas en empresa / tutorías con el tutor. */
const SIN_HORARIO_FIJO = {
  C1: [{ subject: "Prácticas Externas", curso: "4º", nota: "Horario acordado con la empresa" }],
  C2: [{ subject: "TFG", curso: "4º", nota: "Tutorías con tu tutor/a" }],
};

/* Prácticas de laboratorio: van por subgrupo (1 o 2), que aún no sabes cuál te
   toca — se confirma en el Aula Virtual o el Campus antes de empezar el curso.
   Sacado de las filas de horario entre teorías, cruzando los dos horarios
   propuestos por asignatura. */
const PRACTICAS_C1 = [
  { subject: "Fund. Computadores", sub1: "Martes 12:00 - 13:00 (Lab 1.7)", sub2: "Miércoles 12:20 - 14:20 (Lab 2.1)" },
  { subject: "Infraest. Comp. Altas Prest.", sub1: "Martes 18:30 - 20:30 (Lab 1.0)", sub2: "Jueves 16:30 - 18:30 (Lab 2.8)" },
  { subject: "Empresa y Emprendimiento", sub1: "Lunes 17:00 - 18:00", sub2: "Martes 19:00 - 20:00" },
  { subject: "Ciberseguridad", sub1: "Miércoles 17:00 - 18:00", sub2: "Lunes 17:00 - 18:00" },
  { subject: "Gestión de Proyectos", sub1: "Martes 19:00 - 20:00", sub2: "Miércoles 17:00 - 18:00" },
];

const PRACTICAS_C2 = [
  { subject: "Deep Learning", sub1: "Lunes 18:30 - 19:30 (Lab 1.0)", sub2: "Miércoles 18:30 - 19:30 (Lab 2.6)" },
];

/* Convocatoria I (calendario de exámenes GCID 2026/27) */
const EXAM_DATES = [
  { subject: "Empresa y Emprendimiento", fecha: "17 dic 2026", dia: "Jueves", turno: "Mañana", cuatr: "C1" },
  { subject: "Deep Learning", fecha: "21 dic 2026", dia: "Lunes", turno: "Tarde", cuatr: "C2" },
  { subject: "Ciberseguridad", fecha: "07 ene 2027", dia: "Jueves", turno: "Mañana", cuatr: "C1" },
  { subject: "Fund. Computadores", fecha: "11 ene 2027", dia: "Lunes", turno: "Tarde", cuatr: "C1" },
  { subject: "Gestión de Proyectos", fecha: "14 ene 2027", dia: "Jueves", turno: "Mañana", cuatr: "C1" },
  { subject: "Infraest. Comp. Altas Prest.", fecha: "15 ene 2027", dia: "Viernes", turno: "Tarde", cuatr: "C1" },
];

const INITIAL_UNI_TASKS = [];

const INITIAL_STUDY_HOURS = {};


/* --- Finanzas --- */
const FIN_BUDGET = 800;
const INITIAL_FINANCE = [];
const SAVINGS_GOAL = { label: "Portátil nuevo", target: 1200, current: 740 };

/* --- Hábitos --- */
const HABIT_DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const INITIAL_HABITS = [];

/* --- Segundo Cerebro --- */
const INITIAL_NOTES = [];

/* --- Trabajo (Agrosana) --- */
const WORK_CATS = [
  "Ingeniería de Datos",
  "Ciencia de Datos",
  "Análisis / Reporting",
  "Reuniones",
  "Formación",
  "Documentación",
  "Otro",
];
const INITIAL_WORK = [];

const INITIAL_RUNBOOKS = [];

/*  COMPONENTES REUTILIZABLES                                          */
/* ------------------------------------------------------------------ */

function Card({ children, className = "" }) {
  return (
    <div className={`rounded-2xl border border-slate-800 bg-slate-900/60 p-5 shadow-lg transition duration-200 hover:-translate-y-0.5 hover:border-slate-700 hover:shadow-xl ${className}`}>
      {children}
    </div>
  );
}

function SectionTitle({ icon: Icon, title, subtitle }) {
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
        <Icon size={22} />
      </div>
      <div>
        <h1 className="text-2xl font-bold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400">{subtitle}</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SECCIÓN: INICIO                                                    */
/* ------------------------------------------------------------------ */

function Inicio({ tasks, toggleTask }) {
  const [work] = usePersisted("lh_work_log", []);
  const [habits] = usePersisted("lh_habits", []);
  const [ajustes] = usePersisted("lh_settings", { nombre: "Quico" });
  const urgent = tasks.filter((t) => t.urgent && !t.done);
  const doneCount = tasks.filter((t) => t.done).length;

  const ahora = new Date();
  const saludo = ahora.getHours() < 12 ? "Buenos días" : ahora.getHours() < 20 ? "Buenas tardes" : "Buenas noches";
  const hoyIdx = (ahora.getDay() + 6) % 7;
  const lunes = new Date(ahora);
  lunes.setDate(ahora.getDate() - hoyIdx);
  const lunesISO = lunes.toISOString().slice(0, 10);
  const horasSemana = work.filter((w) => w.fecha >= lunesISO).reduce((a, b) => a + Number(b.horas || 0), 0);
  const racha = habits.reduce((m, h) => Math.max(m, h.streak || 0), 0);
  const mesActual = ahora.toISOString().slice(0, 7);
  const BAR_COLORS = ["bg-indigo-500", "bg-emerald-500", "bg-amber-500", "bg-rose-500", "bg-sky-500", "bg-fuchsia-500"];
  const porTipo = {};
  work.filter((w) => (w.fecha || "").slice(0, 7) === mesActual).forEach((w) => { porTipo[w.categoria] = (porTipo[w.categoria] || 0) + Number(w.horas || 0); });
  const stats = Object.entries(porTipo).map(([label, hours], i) => ({ label, hours, color: BAR_COLORS[i % BAR_COLORS.length] }));
  const totalTipo = stats.reduce((a, b) => a + b.hours, 0) || 1;

  return (
    <div>
      <SectionTitle icon={Home} title="Inicio" subtitle={`${saludo}, ${ajustes.nombre || "Quico"}`} />

      <HoyWidget />

      {/* Tarjetas de métricas */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <Flame size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{urgent.length}</p>
            <p className="text-sm text-slate-400">Tareas urgentes</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">
              {doneCount}/{tasks.length}
            </p>
            <p className="text-sm text-slate-400">Completadas hoy</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{horasSemana}h</p>
            <p className="text-sm text-slate-400">Trabajo (semana)</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{racha}</p>
            <p className="text-sm text-slate-400">Racha hábitos</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tareas urgentes */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Flame size={18} className="text-rose-400" /> Tareas urgentes del día
          </h2>
          <ul className="space-y-2">
            {tasks.map((t) => (
              <li
                key={t.id}
                onClick={() => toggleTask(t.id)}
                className="flex cursor-pointer items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3 transition hover:border-slate-700"
              >
                {t.done ? (
                  <CheckCircle2 size={20} className="shrink-0 text-emerald-400" />
                ) : (
                  <Circle size={20} className="shrink-0 text-slate-500" />
                )}
                <span className={`flex-1 text-sm ${t.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                  {t.text}
                </span>
                {t.urgent && !t.done && (
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-400">
                    Urgente
                  </span>
                )}
                <span className="text-xs text-slate-500">{t.hour}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* Distribución de horas */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Clock size={18} className="text-indigo-400" /> Horas de trabajo por tipo (mes)
          </h2>
          <div className="space-y-4">
            {stats.length === 0 && <p className="text-sm text-slate-500">Aún no hay horas de trabajo registradas este mes.</p>}
            {stats.map((s) => (
              <div key={s.label}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-slate-300">{s.label}</span>
                  <span className="font-medium text-slate-400">{s.hours}h</span>
                </div>
                <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800">
                  <div
                    className={`h-full rounded-full ${s.color}`}
                    style={{ width: `${(s.hours / totalTipo) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SECCIÓN: UNIVERSIDAD                                               */
/* ------------------------------------------------------------------ */

function Universidad() {
  const [cuatrimestre, setCuatrimestre] = useState("C1");
  const [tasks, setTasks] = usePersisted("lh_uni_tasks", INITIAL_UNI_TASKS);
  const [filter, setFilter] = useState("Todas");
  const [studyHours, setStudyHours] = usePersisted("lh_study_hours", INITIAL_STUDY_HOURS);
  const [newTask, setNewTask] = useState("");
  const [newSubject, setNewSubject] = useState(SUBJECTS[0]);

  const [aulaTareas, setAulaTareas] = usePersisted("lh_aula_tareas", []);
  const [aulaUltimaSync, setAulaUltimaSync] = usePersisted("lh_aula_ultima_sync", null);
  const [usuarioUMU, setUsuarioUMU] = useState("");
  const [contrasenaUMU, setContrasenaUMU] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [errorAula, setErrorAula] = useState("");

  const sincronizarAula = async () => {
    setSincronizando(true);
    setErrorAula("");
    try {
      const tareas = await sincronizarAulaVirtual({ usuario: usuarioUMU, contrasena: contrasenaUMU });
      setAulaTareas(tareas);
      setAulaUltimaSync(new Date().toISOString());
    } catch (e) {
      setErrorAula(e.message || "No se pudo sincronizar.");
    } finally {
      setContrasenaUMU(""); // nunca se guarda: se descarta se haya podido usar o no
      setSincronizando(false);
    }
  };

  const filtered = useMemo(
    () => (filter === "Todas" ? tasks : tasks.filter((t) => t.subject === filter)),
    [tasks, filter]
  );

  const totalStudy = Object.values(studyHours).reduce((a, b) => a + b, 0);

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([...tasks, { id: Date.now(), text: newTask, subject: newSubject, done: false }]);
    setNewTask("");
  };

  const subjectColor = (s) =>
    ({
      "Fund. Computadores": "bg-indigo-500/15 text-indigo-300",
      "Infraest. Comp. Altas Prest.": "bg-emerald-500/15 text-emerald-300",
      "Deep Learning": "bg-amber-500/15 text-amber-300",
      "Gestión de Proyectos": "bg-rose-500/15 text-rose-300",
      "Ciberseguridad": "bg-sky-500/15 text-sky-300",
      "Empresa y Emprendimiento": "bg-fuchsia-500/15 text-fuchsia-300",
      "TFG": "bg-violet-500/15 text-violet-300",
      "Prácticas Externas": "bg-teal-500/15 text-teal-300",
    }[s] || "bg-slate-700 text-slate-300");

  const DIAS = [
    { key: "lunes", label: "Lunes" },
    { key: "martes", label: "Martes" },
    { key: "miercoles", label: "Miércoles" },
    { key: "jueves", label: "Jueves" },
  ];

  const HorarioCuatrimestre = ({ titulo, clases, sinHorario }) => {
    const filas = [...clases].sort((a, b) => a.hora.localeCompare(b.hora));
    return (
      <Card className="overflow-x-auto p-0">
        <div className="flex items-center gap-2 px-5 pt-4 text-slate-100">
          <Table2 size={18} className="text-indigo-400" />
          <h2 className="text-lg font-semibold">{titulo}</h2>
        </div>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-5 py-3 font-medium">Hora</th>
              {DIAS.map((d) => (
                <th key={d.key} className="px-5 py-3 font-medium">{d.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filas.map((c, i) => (
              <tr key={i} className="border-b border-slate-800/60">
                <td className="px-5 py-3 font-medium text-slate-400">{c.hora}</td>
                {DIAS.map((d) => (
                  <td key={d.key} className="px-5 py-3">
                    {c.dia === d.key ? (
                      <span className={`inline-block rounded-lg px-2.5 py-1 text-xs font-medium ${subjectColor(c.subject)}`}>
                        {c.subject} <span className="opacity-70">· {c.curso}</span>
                      </span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {sinHorario?.length > 0 && (
          <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
            {sinHorario.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className={`rounded-md px-2 py-0.5 font-medium ${subjectColor(s.subject)}`}>{s.subject}</span>
                <span>· {s.nota} (sin franja fija en el horario de aula)</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

  const PracticasCuatrimestre = ({ titulo, filas }) => (
    <Card>
      <h2 className="mb-3 flex items-center gap-2 text-base font-semibold text-slate-100">
        <Table2 size={16} className="text-emerald-400" /> {titulo}
      </h2>
      <p className="mb-3 text-xs text-slate-500">
        Van por subgrupo (1 o 2); confirma cuál te toca en el Aula Virtual o el Campus antes de que
        empiece el curso.
      </p>
      <ul className="space-y-2">
        {filas.map((p, i) => (
          <li key={i} className="rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5 text-sm">
            <span className={`mr-2 rounded-md px-2 py-0.5 text-xs font-medium ${subjectColor(p.subject)}`}>
              {p.subject}
            </span>
            <div className="mt-1.5 text-xs text-slate-400">
              Subgrupo 1: {p.sub1} · Subgrupo 2: {p.sub2}
            </div>
          </li>
        ))}
      </ul>
    </Card>
  );

  return (
    <div>
      <SectionTitle
        icon={GraduationCap}
        title="Universidad"
        subtitle="Grado en Ciencia e Ingeniería de Datos · Curso 2026/2027"
      />

      {/* Selector de cuatrimestre */}
      <div className="mb-4 inline-flex rounded-full bg-slate-800 p-1">
        {["1er Cuatrimestre", "2º Cuatrimestre"].map((c, i) => (
          <button
            key={c}
            onClick={() => setCuatrimestre(i === 0 ? "C1" : "C2")}
            className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
              cuatrimestre === (i === 0 ? "C1" : "C2")
                ? "bg-indigo-500 text-white"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            {c}
          </button>
        ))}
      </div>

      {/* Horario (teoría) */}
      <div className="mb-6">
        {cuatrimestre === "C1" ? (
          <HorarioCuatrimestre
            titulo="Horario · 1er Cuatrimestre"
            clases={SCHEDULE_C1}
            sinHorario={SIN_HORARIO_FIJO.C1}
          />
        ) : (
          <HorarioCuatrimestre
            titulo="Horario · 2º Cuatrimestre"
            clases={SCHEDULE_C2}
            sinHorario={SIN_HORARIO_FIJO.C2}
          />
        )}
      </div>

      {/* Prácticas de laboratorio por subgrupo */}
      <div className="mb-6">
        {cuatrimestre === "C1" ? (
          <PracticasCuatrimestre titulo="Prácticas · 1er Cuatrimestre" filas={PRACTICAS_C1} />
        ) : (
          <PracticasCuatrimestre titulo="Prácticas · 2º Cuatrimestre" filas={PRACTICAS_C2} />
        )}
      </div>

      {/* Exámenes */}
      <Card className="mb-6">
        <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <CalendarCheck size={18} className="text-rose-400" /> Próximos exámenes (Convocatoria I)
        </h2>
        <ul className="space-y-2">
          {EXAM_DATES.map((e, i) => (
            <li
              key={i}
              className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5"
            >
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${subjectColor(e.subject)}`}>
                {e.subject}
              </span>
              <span className="text-sm text-slate-300">
                {e.dia}, {e.fecha}
              </span>
              <span className="text-xs text-slate-500">{e.turno}</span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-slate-500">
          TFG y Prácticas Externas no tienen examen en esta convocatoria.
        </p>
      </Card>

      {/* Aula Virtual */}
      <Card className="mb-6">
        <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Link2 size={18} className="text-sky-400" /> Aula Virtual UMU
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Inicia sesión con tu usuario y contraseña de la UMU para traer tus tareas. Solo se usan para
          entrar en el Aula Virtual en el momento de sincronizar: no se guardan en ningún sitio (ni aquí,
          ni en el servidor). Como las asignaturas de 2026/2027 aún no están publicadas, prueba primero con
          el curso 2025/2026.
        </p>

        <div className="mb-4 flex flex-wrap gap-2">
          <input
            placeholder="Usuario UMU (p. ej. tu-niu o correo @um.es)"
            value={usuarioUMU}
            onChange={(e) => setUsuarioUMU(e.target.value)}
            autoComplete="username"
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Contraseña"
            value={contrasenaUMU}
            onChange={(e) => setContrasenaUMU(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === "Enter" && !sincronizando && sincronizarAula()}
            className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
          />
          <button
            onClick={sincronizarAula}
            disabled={sincronizando || !usuarioUMU || !contrasenaUMU}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {sincronizando ? "Sincronizando…" : "Sincronizar"}
          </button>
        </div>

        {errorAula && (
          <p className="mb-4 rounded-lg border border-rose-900 bg-rose-950/40 px-3 py-2 text-sm text-rose-300">
            {errorAula}
          </p>
        )}

        {aulaUltimaSync && (
          <p className="mb-3 text-xs text-slate-500">
            Última sincronización: {new Date(aulaUltimaSync).toLocaleString("es-ES")} ·{" "}
            {aulaTareas.length} tarea{aulaTareas.length === 1 ? "" : "s"}
          </p>
        )}

        {aulaTareas.length > 0 && (
          <ul className="space-y-2">
            {aulaTareas.map((t) => (
              <li
                key={t.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5"
              >
                <div>
                  <p className="text-sm text-slate-200">{t.titulo}</p>
                  <p className="text-xs text-slate-500">{t.asignatura}</p>
                </div>
                <span className="text-xs text-slate-400">
                  {t.entrega ? `Entrega: ${t.entrega}` : "Sin fecha de entrega"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* To-Do filtrable */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <CheckCircle2 size={18} className="text-emerald-400" /> Tareas por asignatura
          </h2>

          <div className="mb-4 flex flex-wrap gap-2">
            {["Todas", ...SUBJECTS].map((s) => (
              <button
                key={s}
                onClick={() => setFilter(s)}
                className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                  filter === s
                    ? "bg-indigo-500 text-white"
                    : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="mb-4 flex gap-2">
            <input
              placeholder="Nueva tarea..."
              value={newTask}
              onChange={(e) => setNewTask(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              className="flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <select
              value={newSubject}
              onChange={(e) => setNewSubject(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            >
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
            <button
              onClick={addTask}
              className="rounded-lg bg-indigo-500 px-3 py-2 text-white transition hover:bg-indigo-400"
            >
              <Plus size={16} />
            </button>
          </div>

          <ul className="space-y-2">
            {filtered.length === 0 && (
              <li className="py-4 text-center text-sm text-slate-500">Sin tareas para este filtro.</li>
            )}
            {filtered.map((t) => (
              <li
                key={t.id}
                className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2.5"
              >
                <button
                  onClick={() =>
                    setTasks(tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
                  }
                >
                  {t.done ? (
                    <CheckCircle2 size={18} className="text-emerald-400" />
                  ) : (
                    <Circle size={18} className="text-slate-500" />
                  )}
                </button>
                <span className={`flex-1 text-sm ${t.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                  {t.text}
                </span>
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${subjectColor(t.subject)}`}>
                  {t.subject}
                </span>
                <button
                  onClick={() => removeWithUndo(tasks, setTasks, t.id, "Tarea")}
                  className="text-slate-500 transition hover:text-rose-400"
                >
                  <Trash2 size={15} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Contador horas de estudio */}
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Clock size={18} className="text-amber-400" /> Horas de estudio
            </h2>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">
              {totalStudy}h totales
            </span>
          </div>
          <div className="space-y-3">
            {SUBJECTS.map((s) => (
              <div
                key={s}
                className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5"
              >
                <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${subjectColor(s)}`}>{s}</span>
                <div className="flex items-center gap-3">
                  <button
                    onClick={() =>
                      setStudyHours({ ...studyHours, [s]: Math.max(0, studyHours[s] - 1) })
                    }
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-slate-200 transition hover:bg-slate-600"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-slate-100">
                    {studyHours[s]}h
                  </span>
                  <button
                    onClick={() => setStudyHours({ ...studyHours, [s]: studyHours[s] + 1 })}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400"
                  >
                    +
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SECCIÓN: TENIS DE MESA                                             */
/* ------------------------------------------------------------------ */

/* ------------------------------------------------------------------ */
/*  SECCIÓN: FINANZAS                                                  */
/* ------------------------------------------------------------------ */

function Finanzas() {
  const [rows, setRows] = usePersisted("lh_finance", INITIAL_FINANCE);
  const [form, setForm] = useState({ concepto: "", categoria: "Ocio", monto: "" });
  const [tipo, setTipo] = useState("gasto");

  const income = rows.filter((r) => r.monto > 0).reduce((a, b) => a + b.monto, 0);
  const expenses = rows.filter((r) => r.monto < 0).reduce((a, b) => a + Math.abs(b.monto), 0);
  const balance = income - expenses;
  const budgetPct = Math.min(100, (expenses / FIN_BUDGET) * 100);
  const [savings, setSavings] = usePersisted("lh_savings", [{ id: 1, label: "Portátil nuevo", target: 1200, current: 740 }]);
  const [subs, setSubs] = usePersisted("lh_subs", []);
  const [sForm, setSForm] = useState({ label: "", target: "" });
  const [subForm, setSubForm] = useState({ nombre: "", monto: "", dia: "" });
  const totalSubs = subs.reduce((a, b) => a + Number(b.monto || 0), 0);
  const addSaving = () => { if (!sForm.label.trim() || !sForm.target) return; setSavings([...savings, { id: Date.now(), label: sForm.label, target: Number(sForm.target), current: 0 }]); setSForm({ label: "", target: "" }); };
  const addSub = () => { if (!subForm.nombre.trim()) return; setSubs([...subs, { id: Date.now(), nombre: subForm.nombre, monto: Number(subForm.monto) || 0, dia: Number(subForm.dia) || 1 }]); setSubForm({ nombre: "", monto: "", dia: "" }); };

  const CATS = ["Comida", "Universidad", "Deporte", "Ocio", "Transporte", "Ingreso"];

  const [budgets, setBudgets] = usePersisted("lh_budgets", {});
  const mesF = new Date().toISOString().slice(0, 7);
  const gastoPorCat = useMemo(() => {
    const m = {};
    rows.filter((r) => r.monto < 0 && (r.fecha || "").slice(0, 7) === mesF).forEach((r) => { m[r.categoria] = (m[r.categoria] || 0) + Math.abs(r.monto); });
    return m;
  }, [rows, mesF]);
  const CAT_COLORS = { Comida: "#f43f5e", Universidad: "#6366f1", Deporte: "#10b981", Ocio: "#f59e0b", Transporte: "#0ea5e9", Banco: "#14b8a6" };
  const catColor = (c) => CAT_COLORS[c] || "#94a3b8";
  const gastoCats = Object.entries(gastoPorCat).sort((a, b) => b[1] - a[1]);
  const totalGastoMes = gastoCats.reduce((a, b) => a + b[1], 0);
  const [finOrden, setFinOrden] = useState({ campo: "fecha", dir: "desc" });
  const rowsFin = useMemo(() => {
    const arr = [...rows];
    const { campo, dir } = finOrden;
    arr.sort((a, b) => (campo === "monto" ? (Number(a.monto) || 0) - (Number(b.monto) || 0) : String(a[campo] || "").localeCompare(String(b[campo] || ""))));
    if (dir === "desc") arr.reverse();
    return arr;
  }, [rows, finOrden]);
  const finSort = (c) => setFinOrden((o) => ({ campo: c, dir: o.campo === c && o.dir === "asc" ? "desc" : "asc" }));
  const updateFin = (id, campo, valor) => setRows(rows.map((r) => (r.id === id ? { ...r, [campo]: campo === "monto" ? Number(valor) || 0 : valor } : r)));

  const add = () => {
    if (!form.concepto || !form.monto) return;
    const signed = tipo === "gasto" ? -Math.abs(Number(form.monto)) : Math.abs(Number(form.monto));
    setRows([
      { id: Date.now(), fecha: new Date().toISOString().slice(0, 10), concepto: form.concepto, categoria: tipo === "gasto" ? form.categoria : "Ingreso", monto: signed },
      ...rows,
    ]);
    setForm({ concepto: "", categoria: "Ocio", monto: "" });
  };

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Wallet} title="Finanzas" subtitle="Controla ingresos, gastos y ahorro" />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <ArrowUpRight size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{income}€</p>
            <p className="text-sm text-slate-400">Ingresos</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400">
            <ArrowDownRight size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{expenses}€</p>
            <p className="text-sm text-slate-400">Gastos</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Wallet size={24} />
          </div>
          <div>
            <p className={`text-2xl font-bold ${balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              {balance}€
            </p>
            <p className="text-sm text-slate-400">Balance</p>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Presupuesto mensual</h2>
            <span className="text-sm text-slate-400">
              {expenses}€ / {FIN_BUDGET}€
            </span>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`h-full rounded-full ${budgetPct > 85 ? "bg-rose-500" : "bg-emerald-500"}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Te quedan {Math.max(0, FIN_BUDGET - expenses)}€ de presupuesto este mes.
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <PiggyBank size={18} className="text-fuchsia-400" />
            <h2 className="text-lg font-semibold text-slate-100">Objetivos de ahorro</h2>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <input placeholder="Objetivo (p. ej. Fondo emergencia)" value={sForm.label} onChange={(e) => setSForm({ ...sForm, label: e.target.value })} className={`flex-1 ${inputCls}`} />
            <input type="number" placeholder="Meta €" value={sForm.target} onChange={(e) => setSForm({ ...sForm, target: e.target.value })} className={`w-24 ${inputCls}`} />
            <button onClick={addSaving} className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">+</button>
          </div>
          <div className="space-y-3">
            {savings.map((sv) => {
              const pct = sv.target > 0 ? Math.min(100, (sv.current / sv.target) * 100) : 0;
              return (
                <div key={sv.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-300">{sv.label}</span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input type="number" value={sv.current} onChange={(e) => setSavings(savings.map((x) => (x.id === sv.id ? { ...x, current: Number(e.target.value) || 0 } : x)))} className="w-16 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-right text-slate-100 focus:outline-none" />
                      / {sv.target}€
                      <button onClick={() => removeWithUndo(savings, setSavings, sv.id, "Objetivo")} className="text-slate-500 hover:text-rose-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Gasto por categoría (mes)</h2>
          {totalGastoMes === 0 ? (
            <p className="text-sm text-slate-500">Sin gastos este mes.</p>
          ) : (
            <div className="flex items-center gap-6">
              <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                {(() => { let off = 0; return gastoCats.map(([cat, v]) => { const len = (v / totalGastoMes) * 100; const el = <circle key={cat} cx="18" cy="18" r="15.9155" fill="none" stroke={catColor(cat)} strokeWidth="4" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-off} />; off += len; return el; }); })()}
              </svg>
              <div className="flex-1 space-y-1 text-sm">
                {gastoCats.map(([cat, v]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: catColor(cat) }} />
                    <span className="text-slate-300">{cat}</span>
                    <span className="ml-auto font-medium text-slate-400">{v}€</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Presupuesto por categoría</h2>
          <div className="space-y-3">
            {CATS.filter((c) => c !== "Ingreso").map((cat) => {
              const gastado = gastoPorCat[cat] || 0;
              const pres = Number(budgets[cat]) || 0;
              const pct = pres > 0 ? Math.min(100, (gastado / pres) * 100) : 0;
              const over = pres > 0 && gastado > pres;
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-300">{cat}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={over ? "text-rose-400" : "text-slate-400"}>{gastado}€ /</span>
                      <input type="number" value={budgets[cat] || ""} onChange={(e) => setBudgets({ ...budgets, [cat]: Number(e.target.value) || 0 })} placeholder="0" className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-right text-xs text-slate-100 focus:border-indigo-500 focus:outline-none" />
                      <span className="text-slate-500">€</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`h-full rounded-full ${over ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Define un tope por categoría; se marca en rojo si lo superas este mes.</p>
        </Card>
      </div>

      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-slate-100">Suscripciones y gastos fijos</h2>
          <span className="rounded-full bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-300">{totalSubs}€/mes</span>
        </div>
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <input placeholder="Nombre (Netflix, gym...)" value={subForm.nombre} onChange={(e) => setSubForm({ ...subForm, nombre: e.target.value })} className={`flex-1 ${inputCls}`} />
          <input type="number" placeholder="€/mes" value={subForm.monto} onChange={(e) => setSubForm({ ...subForm, monto: e.target.value })} className={`w-24 ${inputCls}`} />
          <input type="number" placeholder="Día" value={subForm.dia} onChange={(e) => setSubForm({ ...subForm, dia: e.target.value })} className={`w-20 ${inputCls}`} />
          <button onClick={addSub} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">Añadir</button>
        </div>
        <ul className="space-y-2">
          {subs.length === 0 && <li className="py-1 text-center text-sm text-slate-500">Sin suscripciones. Añade tus gastos fijos.</li>}
          {subs.map((sub) => (
            <li key={sub.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
              <span className="flex-1 text-slate-200">{sub.nombre}</span>
              <span className="text-xs text-slate-500">día {sub.dia}</span>
              <span className="font-semibold text-rose-300">{sub.monto}€</span>
              <button onClick={() => removeWithUndo(subs, setSubs, sub.id, "Suscripción")} className="text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>
            </li>
          ))}
        </ul>
      </Card>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex overflow-hidden rounded-lg border border-slate-700">
            <button
              onClick={() => setTipo("gasto")}
              className={`px-4 py-2 text-sm font-medium transition ${tipo === "gasto" ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              Gasto
            </button>
            <button
              onClick={() => setTipo("ingreso")}
              className={`px-4 py-2 text-sm font-medium transition ${tipo === "ingreso" ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              Ingreso
            </button>
          </div>
          <input
            placeholder="Concepto"
            value={form.concepto}
            onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            className={`flex-1 ${inputCls}`}
          />
          {tipo === "gasto" && (
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className={inputCls}
            >
              {CATS.filter((c) => c !== "Ingreso").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <input
            type="number"
            placeholder="€"
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: e.target.value })}
            className={`w-24 ${inputCls}`}
          />
          <button
            onClick={add}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Añadir
          </button>
        </div>
      </Card>

      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              {[["fecha", "Fecha", ""], ["concepto", "Concepto", ""], ["categoria", "Categoría", ""], ["monto", "Importe", "text-right"]].map(([c, l, cl]) => (
                <th key={c} onClick={() => finSort(c)} className={`cursor-pointer select-none px-5 py-3 font-medium hover:text-slate-200 ${cl}`}>
                  {l}{finOrden.campo === c ? (finOrden.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rowsFin.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-3 py-2 text-slate-400"><input type="date" value={r.fecha} onChange={(e) => updateFin(r.id, "fecha", e.target.value)} className="w-32 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2 font-medium text-slate-100"><input value={r.concepto} onChange={(e) => updateFin(r.id, "concepto", e.target.value)} className="w-40 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2">
                  <select value={r.categoria} onChange={(e) => updateFin(r.id, "categoria", e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none">
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${r.monto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  <input type="number" value={r.monto} onChange={(e) => updateFin(r.id, "monto", e.target.value)} className="w-20 rounded bg-transparent px-1 py-1 text-right hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" />€
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => removeWithUndo(rows, setRows, r.id, "Movimiento")}
                    className="text-slate-500 transition hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SECCIÓN: HÁBITOS & RACHAS                                          */
/* ------------------------------------------------------------------ */

function Habitos() {
  const [habits, setHabits] = usePersisted("lh_habits", INITIAL_HABITS);
  const [newHabit, setNewHabit] = useState("");

  const toggleDay = (hid, day) =>
    setHabits(
      habits.map((h) =>
        h.id === hid ? { ...h, week: h.week.map((v, i) => (i === day ? !v : v)) } : h
      )
    );

  const addHabit = () => {
    if (!newHabit.trim()) return;
    setHabits([...habits, { id: Date.now(), name: newHabit, streak: 0, week: [false, false, false, false, false, false, false] }]);
    setNewHabit("");
  };

  const bestStreak = Math.max(...habits.map((h) => h.streak), 0);
  const todayIdx = 3; // jueves (demo)
  const doneToday = habits.filter((h) => h.week[todayIdx]).length;

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
                <Flame size={13} /> {h.streak}
              </span>
              <span className="font-medium text-slate-100">{h.name}</span>
            </div>
            <div className="flex gap-1.5">
              {HABIT_DAYS.map((d, i) => (
                <button
                  key={i}
                  onClick={() => toggleDay(h.id, i)}
                  title={d}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg text-xs font-medium transition ${
                    h.week[i]
                      ? "bg-emerald-500 text-white"
                      : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                  }`}
                >
                  {d}
                </button>
              ))}
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

/* ------------------------------------------------------------------ */
/*  SECCIÓN: SEGUNDO CEREBRO                                           */
/* ------------------------------------------------------------------ */

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
    setItems([{ id: Date.now(), ...form }, ...items]);
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

/* ------------------------------------------------------------------ */
/*  SECCIÓN: TRABAJO (AGROSANA)                                        */
/* ------------------------------------------------------------------ */

const MONTH_NAMES = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

function monthKey(fecha) {
  return fecha.slice(0, 7); // "2026-07"
}
function monthLabel(key) {
  const [y, m] = key.split("-");
  return `${MONTH_NAMES[Number(m) - 1]} ${y.slice(2)}`;
}
function lastNMonths(n) {
  const now = new Date();
  const arr = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    arr.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return arr;
}

function Trabajo() {
  const [log, setLog] = usePersisted("lh_work_log", INITIAL_WORK);
  const [runbooks, setRunbooks] = usePersisted("lh_runbooks", INITIAL_RUNBOOKS);
  const [form, setForm] = useState({ fecha: "", actividad: "", categoria: WORK_CATS[0], horas: "" });
  const [rbForm, setRbForm] = useState({ titulo: "", pasos: "", herramientas: "" });
  const [showRb, setShowRb] = useState(false);
  const [crono, setCrono] = useState(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!crono) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [crono]);
  const toggleCrono = () => {
    if (!crono) { setCrono(Date.now()); return; }
    const horas = Math.max(0.01, Math.round(((Date.now() - crono) / 3600000) * 100) / 100);
    setLog([{ id: Date.now(), fecha: new Date().toISOString().slice(0, 10), actividad: form.actividad || "Sesión cronometrada", categoria: form.categoria, horas }, ...log]);
    setCrono(null);
    setForm({ ...form, actividad: "" });
  };
  const cronoTxt = crono ? new Date(Date.now() - crono).toISOString().slice(11, 19) : "00:00:00";

  const analytics = useMemo(() => {
    const months = lastNMonths(6);
    const byMonth = Object.fromEntries(months.map((m) => [m, 0]));
    log.forEach((e) => {
      const k = monthKey(e.fecha);
      if (k in byMonth) byMonth[k] += Number(e.horas) || 0;
    });
    const series = months.map((m) => ({ key: m, label: monthLabel(m), horas: byMonth[m] }));
    const currentKey = months[months.length - 1];
    const prevKey = months[months.length - 2];
    const current = byMonth[currentKey] || 0;
    const prev = byMonth[prevKey] || 0;
    const diffPct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : null;

    const catHours = {};
    let currentCount = 0;
    log.forEach((e) => {
      if (monthKey(e.fecha) === currentKey) {
        catHours[e.categoria] = (catHours[e.categoria] || 0) + (Number(e.horas) || 0);
        currentCount += 1;
      }
    });
    const maxBar = Math.max(...series.map((s) => s.horas), 1);
    return { series, current, prev, diffPct, catHours, currentCount, currentKey, maxBar };
  }, [log]);

  const addEntry = () => {
    if (!form.actividad || !form.horas) return;
    setLog([
      {
        id: Date.now(),
        fecha: form.fecha || new Date().toISOString().slice(0, 10),
        actividad: form.actividad,
        categoria: form.categoria,
        horas: Number(form.horas) || 0,
      },
      ...log,
    ]);
    setForm({ fecha: "", actividad: "", categoria: WORK_CATS[0], horas: "" });
  };

  const addRunbook = () => {
    if (!rbForm.titulo.trim()) return;
    setRunbooks([{ id: Date.now(), ...rbForm }, ...runbooks]);
    setRbForm({ titulo: "", pasos: "", herramientas: "" });
    setShowRb(false);
  };

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  const catColor = (c) =>
    ({
      "Ingeniería de Datos": "bg-indigo-500/15 text-indigo-300",
      "Ciencia de Datos": "bg-emerald-500/15 text-emerald-300",
      "Análisis / Reporting": "bg-amber-500/15 text-amber-300",
      "Reuniones": "bg-rose-500/15 text-rose-300",
      "Formación": "bg-sky-500/15 text-sky-300",
      "Documentación": "bg-fuchsia-500/15 text-fuchsia-300",
    }[c] || "bg-slate-700 text-slate-300");

  const catTotalCurrent = Object.values(analytics.catHours).reduce((a, b) => a + b, 0) || 1;

  return (
    <div>
      <SectionTitle icon={Sprout} title="Trabajo · Agrosana" subtitle="Prácticas de Ingeniería y Ciencia de Datos" />

      {/* KPIs del mes */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{analytics.current}h</p>
            <p className="text-sm text-slate-400">Este mes ({monthLabel(analytics.currentKey)})</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${
              analytics.diffPct === null || analytics.diffPct >= 0
                ? "bg-emerald-500/15 text-emerald-400"
                : "bg-rose-500/15 text-rose-400"
            }`}
          >
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">
              {analytics.diffPct === null ? "—" : `${analytics.diffPct > 0 ? "+" : ""}${analytics.diffPct}%`}
            </p>
            <p className="text-sm text-slate-400">vs mes anterior ({analytics.prev}h)</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <BarChart3 size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{analytics.currentCount}</p>
            <p className="text-sm text-slate-400">Actividades este mes</p>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Gráfico mensual */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <BarChart3 size={18} className="text-indigo-400" /> Horas por mes (últimos 6)
          </h2>
          <div className="flex h-44 items-end justify-between gap-2">
            {analytics.series.map((s) => (
              <div key={s.key} className="flex flex-1 flex-col items-center gap-2">
                <span className="text-xs font-medium text-slate-400">{s.horas || ""}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-400 transition-all"
                    style={{ height: `${(s.horas / analytics.maxBar) * 100}%` }}
                    title={`${s.horas}h`}
                  />
                </div>
                <span className="text-xs text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Reparto por categoría del mes */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <TrendingUp size={18} className="text-emerald-400" /> Reparto del mes por tipo
          </h2>
          {Object.keys(analytics.catHours).length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin actividades este mes todavía.</p>
          ) : (
            <div className="space-y-3">
              {Object.entries(analytics.catHours)
                .sort((a, b) => b[1] - a[1])
                .map(([cat, h]) => (
                  <div key={cat}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${catColor(cat)}`}>{cat}</span>
                      <span className="text-slate-400">{h}h</span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${(h / catTotalCurrent) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
            </div>
          )}
        </Card>
      </div>

      {/* Alta de actividad */}
      <Card className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Briefcase size={18} className="text-indigo-400" /> Registrar tiempo
        </h2>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} />
          <input
            placeholder="Actividad"
            value={form.actividad}
            onChange={(e) => setForm({ ...form, actividad: e.target.value })}
            className={`col-span-2 ${inputCls}`}
          />
          <select value={form.categoria} onChange={(e) => setForm({ ...form, categoria: e.target.value })} className={inputCls}>
            {WORK_CATS.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
          <input
            type="number"
            step="0.5"
            placeholder="Horas"
            value={form.horas}
            onChange={(e) => setForm({ ...form, horas: e.target.value })}
            className={inputCls}
          />
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 p-3">
          <button onClick={toggleCrono} className={`rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${crono ? "bg-rose-500 hover:bg-rose-400" : "bg-indigo-500 hover:bg-indigo-400"}`}>
            {crono ? "Parar y registrar" : "▶ Empezar cronómetro"}
          </button>
          {crono && <span className="font-mono text-xl tabular-nums text-slate-100">{cronoTxt}</span>}
          <span className="text-xs text-slate-500">Cronometra la actividad en curso (usa el campo Actividad y la categoría).</span>
        </div>
        <div className="mt-3 flex justify-end">
          <button onClick={addEntry} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400">
            Añadir actividad
          </button>
        </div>
      </Card>

      {/* Tabla de registro */}
      <Card className="mb-6 overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Actividad</th>
              <th className="px-5 py-3 font-medium">Categoría</th>
              <th className="px-5 py-3 text-right font-medium">Horas</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {log.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-400">{e.fecha}</td>
                <td className="px-5 py-3 font-medium text-slate-100">{e.actividad}</td>
                <td className="px-5 py-3">
                  <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${catColor(e.categoria)}`}>{e.categoria}</span>
                </td>
                <td className="px-5 py-3 text-right text-slate-300">{e.horas}h</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => removeWithUndo(log, setLog, e.id, "Actividad")} className="text-slate-500 transition hover:text-rose-400">
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      {/* Base de conocimiento: cómo lo hice */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <BookOpen size={18} className="text-fuchsia-400" /> Cómo lo hice (procedimientos)
          </h2>
          <button
            onClick={() => setShowRb((s) => !s)}
            className="flex items-center gap-1 rounded-lg bg-indigo-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-400"
          >
            <Plus size={14} /> Nuevo
          </button>
        </div>

        {showRb && (
          <div className="mb-4 space-y-2 rounded-xl border border-slate-800 bg-slate-800/40 p-4">
            <input placeholder="Título (p. ej. Desplegar modelo en producción)" value={rbForm.titulo} onChange={(e) => setRbForm({ ...rbForm, titulo: e.target.value })} className={`w-full ${inputCls}`} />
            <textarea placeholder="Pasos / notas..." rows={3} value={rbForm.pasos} onChange={(e) => setRbForm({ ...rbForm, pasos: e.target.value })} className={`w-full resize-none ${inputCls}`} />
            <div className="flex gap-2">
              <input placeholder="Herramientas (Python, dbt...)" value={rbForm.herramientas} onChange={(e) => setRbForm({ ...rbForm, herramientas: e.target.value })} className={`flex-1 ${inputCls}`} />
              <button onClick={addRunbook} className="shrink-0 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400">
                Guardar
              </button>
            </div>
          </div>
        )}

        <div className="space-y-3">
          {runbooks.map((r) => (
            <div key={r.id} className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
              <div className="mb-1 flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-100">{r.titulo}</h3>
                <button onClick={() => removeWithUndo(runbooks, setRunbooks, r.id, "Procedimiento")} className="shrink-0 text-slate-500 transition hover:text-rose-400">
                  <Trash2 size={15} />
                </button>
              </div>
              <p className="whitespace-pre-line text-sm text-slate-400">{r.pasos}</p>
              {r.herramientas && (
                <span className="mt-2 inline-block rounded-md bg-slate-800 px-2 py-0.5 text-xs text-slate-400">🛠 {r.herramientas}</span>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  APP PRINCIPAL + SIDEBAR                                            */
/* ------------------------------------------------------------------ */

/*
  La navegación va agrupada en menús desplegables: 24 secciones no caben en
  una barra superior, así que las entradas más usadas son enlaces directos y
  el resto cuelga de un grupo temático. NAV (plano) se deriva de aquí y es lo
  que consume la paleta de comandos.
*/
const NAV_GROUPS = [
  { id: "inicio", label: "Inicio", icon: Home },
  { id: "universidad", label: "Universidad", icon: GraduationCap },
  { id: "trabajo", label: "Trabajo", icon: Sprout },
  {
    label: "Deporte",
    icon: Dumbbell,
    items: [
      { id: "gimnasio", label: "Gimnasio", icon: Dumbbell },
      { id: "tenis", label: "Resultados deportivos", icon: Target },
      { id: "tenis-notas", label: "Entrenamientos", icon: Target },
      { id: "salud", label: "Salud", icon: HeartPulse },
    ],
  },
  {
    label: "Dinero",
    icon: Wallet,
    items: [
      { id: "finanzas", label: "Finanzas", icon: Wallet },
      { id: "inversiones", label: "Inversiones", icon: LineChart },
    ],
  },
  {
    label: "Planificar",
    icon: CalendarDays,
    items: [
      { id: "habitos", label: "Hábitos", icon: CalendarCheck },
      { id: "metas", label: "Metas", icon: Flag },
      { id: "calendario", label: "Calendario", icon: CalendarDays },
      { id: "proximos", label: "Próximos", icon: CalendarClock },
      { id: "foco", label: "Modo foco", icon: Timer },
      { id: "resumen", label: "Resumen semanal", icon: Sparkles },
      { id: "coach", label: "Coach", icon: Sparkles },
    ],
  },
  {
    label: "Conocimiento",
    icon: Brain,
    items: [
      { id: "cerebro", label: "Segundo Cerebro", icon: Brain },
      { id: "repaso", label: "Repaso", icon: Brain },
      { id: "adjuntos", label: "Adjuntos", icon: Image },
      { id: "etiquetas", label: "Etiquetas", icon: Tag },
      { id: "logros", label: "Logros", icon: Trophy },
      { id: "analitica", label: "Analítica", icon: BarChart3 },
    ],
  },
  {
    label: "Sistema",
    icon: Settings,
    items: [
      { id: "datos", label: "Datos", icon: Database },
      { id: "ajustes", label: "Ajustes", icon: Settings },
    ],
  },
];

const NAV = NAV_GROUPS.flatMap((g) => (g.items ? g.items : [g]));

export default function LifeDashboard({ userEmail = null, onSignOut = null }) {
  const [active, setActive] = useState("inicio");
  const [tasks, setTasks] = usePersisted("lh_tasks", INITIAL_TASKS);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const headerRef = useRef(null);

  useRoutineNotifier();
  useAutoBackup();
  const { theme, toggle: toggleTheme } = useTheme();
  const [paletteOpen, setPaletteOpen] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPaletteOpen(true); }
      if (e.key === "Escape") { setOpenGroup(null); setMobileOpen(false); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Cierra el desplegable abierto al pinchar fuera de la cabecera
  useEffect(() => {
    if (!openGroup) return;
    const onDown = (e) => {
      if (headerRef.current && !headerRef.current.contains(e.target)) setOpenGroup(null);
    };
    window.addEventListener("pointerdown", onDown);
    return () => window.removeEventListener("pointerdown", onDown);
  }, [openGroup]);

  const toggleTask = (id) =>
    setTasks(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));

  const navigate = (id) => {
    setActive(id);
    setOpenGroup(null);
    setMobileOpen(false);
  };

  return (
    <div className="min-h-screen bg-slate-950 font-sans text-slate-200">
      {/* Cabecera superior */}
      <header
        ref={headerRef}
        style={{
          paddingTop: "env(safe-area-inset-top)",
          paddingLeft: "env(safe-area-inset-left)",
          paddingRight: "env(safe-area-inset-right)",
        }}
        className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-2 px-4 sm:px-6">
          <button onClick={() => navigate("inicio")} className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 font-bold text-white shadow-lg shadow-indigo-500/25">
              Q
            </div>
            <div className="hidden text-left sm:block">
              <p className="font-bold leading-tight text-slate-100">Life Hub</p>
              <p className="text-[10px] leading-tight text-slate-500">Panel personal</p>
            </div>
          </button>

          {/* Navegación de escritorio */}
          <nav className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {NAV_GROUPS.map((g) => {
              const Icon = g.icon;
              if (!g.items) {
                const isActive = active === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => navigate(g.id)}
                    className={`nav-link flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? "is-active text-indigo-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <Icon size={16} />
                    {g.label}
                  </button>
                );
              }
              const groupActive = g.items.some((i) => i.id === active);
              const isOpen = openGroup === g.label;
              return (
                <div key={g.label} className="relative">
                  <button
                    onClick={() => setOpenGroup(isOpen ? null : g.label)}
                    className={`nav-link flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      groupActive ? "is-active text-indigo-300" : isOpen ? "bg-slate-800/60 text-slate-200" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <Icon size={16} />
                    {g.label}
                    <ChevronDown size={14} className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div className="dropdown-pop absolute left-0 top-full z-40 mt-2 w-60 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
                      {g.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = active === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => navigate(item.id)}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-indigo-500/15 font-medium text-indigo-300"
                                : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                            }`}
                          >
                            <ItemIcon size={16} className={isActive ? "" : "text-slate-500"} />
                            {item.label}
                            {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </nav>

          {/* Acciones a la derecha */}
          <div className="ml-auto flex items-center gap-1.5">
            <button
              onClick={() => setPaletteOpen(true)}
              title="Buscar (Ctrl+K)"
              className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-2 text-xs font-medium text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              <Search size={15} />
              <span className="hidden xl:inline">Buscar</span>
              <kbd className="hidden rounded border border-slate-700 bg-slate-800 px-1.5 py-0.5 text-[10px] text-slate-500 xl:inline">⌘K</kbd>
            </button>
            <button
              onClick={toggleTheme}
              title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
              className="rounded-lg border border-slate-800 bg-slate-900/60 p-2 text-slate-400 transition hover:border-slate-700 hover:text-slate-200"
            >
              {theme === "dark" ? <Sun size={16} /> : <Moon size={16} />}
            </button>
            {userEmail && (
              <div className="hidden items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/60 px-3 py-1.5 md:flex">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" title="Sincronizado" />
                <span className="max-w-[140px] truncate text-xs text-slate-400">{userEmail}</span>
                {onSignOut && (
                  <button onClick={onSignOut} title="Cerrar sesión" className="shrink-0 text-slate-500 transition hover:text-rose-400">
                    <LogOut size={14} />
                  </button>
                )}
              </div>
            )}
            <button onClick={() => setMobileOpen((o) => !o)} className="-mr-1 p-2 text-slate-300 lg:hidden">
              {mobileOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Panel de navegación móvil */}
        {mobileOpen && (
          <div className="mobile-panel max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-800 bg-slate-950/95 px-4 pb-6 backdrop-blur lg:hidden">
            {NAV_GROUPS.map((g) => {
              const items = g.items || [g];
              return (
                <div key={g.label} className="pt-4">
                  {g.items && (
                    <p className="mb-1.5 px-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">{g.label}</p>
                  )}
                  <div className="grid grid-cols-2 gap-1.5">
                    {items.map((item) => {
                      const ItemIcon = item.icon;
                      const isActive = active === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => navigate(item.id)}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive ? "bg-indigo-500/15 text-indigo-300" : "text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <ItemIcon size={17} className={isActive ? "" : "text-slate-500"} />
                          {item.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
            {userEmail && (
              <div className="mt-5 flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/60 px-3 py-2 md:hidden">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                <span className="min-w-0 flex-1 truncate text-xs text-slate-400">{userEmail}</span>
                {onSignOut && (
                  <button onClick={onSignOut} title="Cerrar sesión" className="shrink-0 text-slate-500 transition hover:text-rose-400">
                    <LogOut size={15} />
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {/* Fondo oscurecido bajo el panel móvil */}
      {mobileOpen && (
        <div className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Contenido principal */}
      <main className="overflow-x-hidden">
        <div key={active} className="mx-auto max-w-6xl p-5 sm:p-8 section-fade">
          <Suspense
            fallback={<div className="py-16 text-center text-sm text-slate-500">Cargando sección...</div>}
          >
          {active === "inicio" && <Inicio tasks={tasks} toggleTask={toggleTask} />}
          {active === "trabajo" && <Trabajo />}
          {active === "gimnasio" && <Gimnasio />}
          {active === "universidad" && <Universidad />}
          {active === "tenis" && <TenisMesa />}
          {active === "tenis-notas" && <TenisEntrenos />}
          {active === "salud" && <Salud />}
          {active === "finanzas" && <Finanzas />}
          {active === "inversiones" && <Inversiones />}
          {active === "habitos" && <Habitos />}
          {active === "metas" && <Metas />}
          {active === "resumen" && <Resumen />}
          {active === "coach" && <Coach onNavigate={setActive} />}
          {active === "calendario" && <Calendario />}
          {active === "proximos" && <Proximos />}
          {active === "cerebro" && <SegundoCerebro />}
          {active === "foco" && <Foco />}
          {active === "logros" && <Logros />}
          {active === "analitica" && <Analitica />}
          {active === "repaso" && <Repaso />}
          {active === "adjuntos" && <Adjuntos />}
          {active === "etiquetas" && <Etiquetas />}
          {active === "datos" && <Datos />}
          {active === "ajustes" && <Ajustes />}
          </Suspense>
        </div>
      </main>

      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} sections={NAV} onNavigate={(id) => setActive(id)} />
      <QuickAdd />
      <Onboarding />
      <ToastHost />
    </div>
  );
}
