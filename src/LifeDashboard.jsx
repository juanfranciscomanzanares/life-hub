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
import { Card, SectionTitle, Skeleton, SkeletonSeccion, todayISO, fmtEuro } from "./lib/ui";
import { horasPorDiaDeLaSemana, horasPorSemana, redondear, fmtHoras } from "./lib/trabajo";
import { Cifra } from "./lib/animar";
import { confeti } from "./lib/confetti";
import { SUBJECTS, urgenciasDeHoy } from "./lib/uni";
import {
  normalizarHabito,
  semanaDe,
  estaHecho,
  alternarDia,
  racha,
  mejorRacha,
  hechosHoy,
} from "./lib/habitos";
import { CATEGORIAS as CATEGORIAS_BANCO } from "./lib/banco";
import { sincronizarAulaVirtual } from "./lib/aulaVirtual";
import {
  normalizarTareas,
  agruparPorAsignatura,
  esPendiente,
  aTareaDeApp,
  yaAnadida,
  tareasQueFaltan,
} from "./lib/aula";
import HoyWidget from "./sections/HoyWidget.jsx";
import { useRoutineNotifier } from "./lib/useRoutineNotifier";
import { useTheme, useAccent } from "./lib/useTheme";
import { useAutoBackup } from "./lib/useAutoBackup";
import CommandPalette from "./CommandPalette.jsx";
import QuickAdd from "./QuickAdd.jsx";
import Onboarding from "./Onboarding.jsx";
import ToastHost from "./ToastHost.jsx";
import BarraInferior from "./BarraInferior.jsx";
import { removeWithUndo, toast } from "./lib/toast";

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
const PlanFinanciero = lazy(() => import("./sections/PlanFinanciero.jsx"));
const Salud = lazy(() => import("./sections/Salud.jsx"));
const Gimnasio = lazy(() => import("./sections/Gimnasio.jsx"));
const Foco = lazy(() => import("./sections/Foco.jsx"));
const Analitica = lazy(() => import("./sections/Analitica.jsx"));
const Proximos = lazy(() => import("./sections/Proximos.jsx"));
const Ajustes = lazy(() => import("./sections/Ajustes.jsx"));
import { Flag, CalendarDays, Database, HeartPulse, Timer, Sun, Moon, CalendarClock, Settings, ChevronDown } from "lucide-react";
const TenisMesa = lazy(() => import("./sections/TenisMesa.jsx"));
const TenisEntrenos = lazy(() => import("./sections/TenisEntrenos.jsx"));
const Metas = lazy(() => import("./sections/Metas.jsx"));
const Calendario = lazy(() => import("./sections/Calendario.jsx"));
const Datos = lazy(() => import("./sections/Datos.jsx"));
// La conexión bancaria vive dentro de Finanzas, pero solo la usa quien la
// tenga configurada: en diferido no entra en el bundle de quien no la abre.
const Banco = lazy(() => import("./sections/finanzas/Banco.jsx"));


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
/* SUBJECTS y el calendario académico viven en src/lib/uni.js: los usan también
   Inicio, el modo foco y el calendario. */

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

const URGENCIA = {
  examen: { texto: "Examen", clase: "bg-amber-500/15 text-amber-300" },
  entrega: { texto: "Entrega", clase: "bg-indigo-500/15 text-indigo-300" },
  evento: { texto: "Hoy", clase: "bg-slate-700/60 text-slate-300" },
};

const ESTADO_AULA = {
  abierta: { texto: "Abierta", clase: "bg-emerald-500/15 text-emerald-300" },
  proxima: { texto: "Próxima", clase: "bg-sky-500/15 text-sky-300" },
  entregada: { texto: "Entregada", clase: "bg-indigo-500/15 text-indigo-300" },
  cerrada: { texto: "Cerrada", clase: "bg-slate-700/60 text-slate-400" },
};

const INITIAL_STUDY_HOURS = {};


/* --- Finanzas --- */
// Solo el valor de partida: el presupuesto real se edita en la sección y se
// guarda en `lh_budget_mensual`.
const PRESUPUESTO_INICIAL = 800;
const INITIAL_FINANCE = [];
const SAVINGS_GOAL = { label: "Portátil nuevo", target: 1200, current: 740 };

/* --- Hábitos --- */
const HABIT_DAYS = ["L", "M", "X", "J", "V", "S", "D"];
const INITIAL_HABITS = [];

/* --- Segundo Cerebro --- */
const INITIAL_NOTES = [];

/* --- Trabajo (Agrosana) --- */
/*
  Sin tipos de actividad: antes cada registro había que clasificarlo
  (Ingeniería de Datos, Reuniones...) y solo servía para pintar un reparto que
  no aportaba nada. Los registros antiguos conservan su campo `categoria`, pero
  ya no se lee ni se pide.
*/
const INITIAL_WORK = [];

const INITIAL_RUNBOOKS = [];

/*  COMPONENTES REUTILIZABLES                                          */
/* ------------------------------------------------------------------ */

/*
  Card y SectionTitle se importan de src/lib/ui.jsx. Antes estaban duplicados
  aquí, y las secciones de este archivo tenían un aspecto ligeramente distinto
  al del resto: cualquier retoque había que hacerlo en dos sitios y uno de los
  dos se quedaba atrás.
*/

/* ------------------------------------------------------------------ */
/*  SECCIÓN: INICIO                                                    */
/* ------------------------------------------------------------------ */

function Inicio() {
  const [work] = usePersisted("lh_work_log", []);
  const [habits] = usePersisted("lh_habits", []);
  const [ajustes] = usePersisted("lh_settings", { nombre: "Quico" });

  /*
    Lo urgente sale de datos de verdad y no de una marca "urgente" puesta a
    mano, que nadie ponía nunca: tareas de la UMU que vencen hoy o que ya
    vencieron, y lo que tengas hoy en el calendario (exámenes, citas...).
  */
  const [uniTasks] = usePersisted("lh_uni_tasks", []);
  const [aulaCrudo] = usePersisted("lh_aula_tareas", []);
  const [eventos] = usePersisted("lh_events", []);

  const urgencias = useMemo(() => {
    const tareasAula = normalizarTareas(
      Array.isArray(aulaCrudo) ? { tareas: aulaCrudo, sitios: [] } : aulaCrudo
    );
    return urgenciasDeHoy({ tareasUni: uniTasks, tareasAula, eventos, hoy: todayISO() });
  }, [uniTasks, aulaCrudo, eventos]);

  const pendientesUni = uniTasks.filter((t) => !t.done).length;

  // Las que entran por el botón + flotante y por la paleta de comandos.
  const [rapidas, setRapidas] = usePersisted("lh_tasks", []);

  const ahora = new Date();
  const saludo = ahora.getHours() < 12 ? "Buenos días" : ahora.getHours() < 20 ? "Buenas tardes" : "Buenas noches";
  const hoyIdx = (ahora.getDay() + 6) % 7;
  const lunes = new Date(ahora);
  lunes.setDate(ahora.getDate() - hoyIdx);
  const lunesISO = todayISO(lunes);
  const horasSemana = work.filter((w) => w.fecha >= lunesISO).reduce((a, b) => a + Number(b.horas || 0), 0);
  // Se calcula desde las fechas cumplidas: el campo `streak` que se leía antes
  // no lo actualizaba nadie y siempre valía 0.
  const rachaMaxima = mejorRacha(habits.map((h) => normalizarHabito(h)));
  // Últimas 8 semanas de trabajo. Antes esta tarjeta repartía las horas por
  // tipo de tarea; ese campo ya no existe, así que ahora enseña la evolución.
  const semanasTrabajo = useMemo(() => horasPorSemana(work, todayISO(), 8), [work]);
  const maxSemana = Math.max(...semanasTrabajo.map((s) => s.horas), 1);
  const totalSemanas = semanasTrabajo.reduce((a, s) => a + s.horas, 0);

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
            <p className="font-display text-2xl font-bold text-slate-100">
              <Cifra valor={urgencias.length} />
            </p>
            <p className="text-sm text-slate-400">Para hoy</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400">
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-slate-100">
              <Cifra valor={pendientesUni} />
            </p>
            <p className="text-sm text-slate-400">Tareas por hacer</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Clock size={24} />
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-slate-100">
              <Cifra valor={horasSemana} decimales={horasSemana % 1 ? 1 : 0} sufijo="h" />
            </p>
            <p className="text-sm text-slate-400">Trabajo (semana)</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/15 text-amber-400">
            <TrendingUp size={24} />
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-slate-100">
              <Cifra valor={rachaMaxima} />
            </p>
            <p className="text-sm text-slate-400">Racha hábitos</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Tareas urgentes */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Flame size={18} className="text-rose-400" /> Lo de hoy
          </h2>
          {urgencias.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Hoy no tienes nada señalado. Aquí sale lo que se entrega hoy y lo que tengas en el
              calendario para hoy.
            </p>
          ) : (
            <ul className="space-y-2">
              {urgencias.map((u) => (
                <li
                  key={u.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-3"
                >
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${URGENCIA[u.tipo].clase}`}
                  >
                    {URGENCIA[u.tipo].texto}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm text-slate-200">{u.titulo}</span>
                  <span className="shrink-0 text-xs text-slate-500">{u.detalle}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        {/* Notas rápidas del botón + */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <CheckCircle2 size={18} className="text-emerald-400" /> Tareas rápidas
          </h2>
          {rapidas.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Nada apuntado. Usa el botón + de abajo a la derecha para añadir algo al vuelo.
            </p>
          ) : (
            <ul className="space-y-2">
              {rapidas.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-2.5"
                >
                  <button
                    onClick={() => setRapidas(rapidas.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))}
                    aria-label={t.done ? `Marcar ${t.text} como pendiente` : `Marcar ${t.text} como hecha`}
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
                  <button
                    onClick={() => removeWithUndo(rapidas, setRapidas, t.id, "Tarea")}
                    className="text-slate-500 transition hover:text-rose-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6">
        {/* Evolución de las horas de trabajo */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Clock size={18} className="text-indigo-400" /> Horas de trabajo (últimas 8 semanas)
          </h2>
          {/*
            Las columnas se estiran a toda la altura (sin items-end): con
            items-end se quedaban a la altura de su texto, el hueco flex-1 de la
            barra medía 0 y no llegaba a pintarse ninguna barra.
          */}
          {totalSemanas === 0 ? (
            <p className="text-sm text-slate-500">Aún no hay horas de trabajo registradas.</p>
          ) : (
            <div
              role="img"
              aria-label={`Horas de trabajo por semana: ${semanasTrabajo
                .map((s) => `semana del ${s.etiqueta}, ${fmtHoras(s.horas)}`)
                .join("; ")}.`}
              className="flex h-36 justify-between gap-1.5 sm:gap-2"
            >
              {semanasTrabajo.map((s) => (
                <div key={s.desde} className="flex flex-1 flex-col items-center justify-end gap-1.5">
                  <span className="text-[10px] font-medium text-slate-400 sm:text-xs">
                    {s.horas ? fmtHoras(s.horas) : ""}
                  </span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="lh-barra-v w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-400"
                      style={{ height: `${(s.horas / maxSemana) * 100}%` }}
                      title={`Semana del ${s.etiqueta}: ${fmtHoras(s.horas)}`}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 sm:text-xs">{s.etiqueta}</span>
                </div>
              ))}
            </div>
          )}
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
  const [studyLog, setStudyLog] = usePersisted("lh_study_log", []);
  const [newTask, setNewTask] = useState("");
  const [newSubject, setNewSubject] = useState(SUBJECTS[0]);

  const [aulaCrudo, setAulaCrudo] = usePersisted("lh_aula_tareas", []);
  const [aulaUltimaSync, setAulaUltimaSync] = usePersisted("lh_aula_ultima_sync", null);
  // El usuario sí se recuerda (no es un secreto); la contraseña nunca.
  const [usuarioUMU, setUsuarioUMU] = usePersisted("lh_aula_usuario", "");
  const [contrasenaUMU, setContrasenaUMU] = useState("");
  const [sincronizando, setSincronizando] = useState(false);
  const [errorAula, setErrorAula] = useState("");
  const [asignaturaAbierta, setAsignaturaAbierta] = useState(null);

  const sincronizarAula = async () => {
    setSincronizando(true);
    setErrorAula("");
    try {
      const crudo = await sincronizarAulaVirtual({ usuario: usuarioUMU, contrasena: contrasenaUMU });
      setAulaCrudo(crudo);
      setAulaUltimaSync(new Date().toISOString());
    } catch (e) {
      setErrorAula(e.message || "No se pudo sincronizar.");
    } finally {
      setContrasenaUMU(""); // nunca se guarda: se descarta se haya podido usar o no
      setSincronizando(false);
    }
  };

  /*
    El estado de cada tarea se recalcula al pintar y no al sincronizar: una
    tarea "abierta" pasa a "cerrada" sola cuando vence el plazo, sin tener que
    volver a entrar en el Aula Virtual.

    Se guarda el crudo antiguo (un array de tareas ya interpretadas) además del
    nuevo ({tareas, sitios}) porque una sincronización anterior a este cambio
    dejaría la sección en blanco.
  */
  const aulaTareas = useMemo(
    () => normalizarTareas(Array.isArray(aulaCrudo) ? { tareas: aulaCrudo, sitios: [] } : aulaCrudo),
    [aulaCrudo]
  );
  // La función ya solo devuelve pendientes; se vuelve a filtrar por si una
  // tarea venció entre la última sincronización y ahora.
  const aulaGrupos = useMemo(() => agruparPorAsignatura(aulaTareas.filter(esPendiente)), [aulaTareas]);

  const anadirDelAula = (tarea) => {
    if (yaAnadida(tasks, tarea.id)) return;
    setTasks([...tasks, aTareaDeApp(tarea, SUBJECTS)]);
  };

  const anadirGrupo = (tareas) => {
    const faltan = tareasQueFaltan(tareas, tasks);
    if (faltan.length === 0) return;
    setTasks([...tasks, ...faltan.map((t) => aTareaDeApp(t, SUBJECTS))]);
    toast(`${faltan.length} ${faltan.length === 1 ? "tarea añadida" : "tareas añadidas"}`);
  };

  const filtered = useMemo(
    () => (filter === "Todas" ? tasks : tasks.filter((t) => t.subject === filter)),
    [tasks, filter]
  );

  /*
    Las tuyas de este curso, más las que hayan entrado del Aula Virtual con una
    asignatura que no está en SUBJECTS (las de cursos anteriores). Sin esto, una
    tarea traída de "Procesamiento de Imagen [24/25]" no tendría ningún filtro
    donde salir salvo "Todas".
  */
  const asignaturasConTareas = useMemo(
    () => [...new Set([...SUBJECTS, ...tasks.map((t) => t.subject).filter(Boolean)])],
    [tasks]
  );

  const totalStudy = Object.values(studyHours).reduce((a, b) => a + (Number(b) || 0), 0);

  /*
    Sumar o restar una hora de estudio.

    Se guardan dos cosas: el contador de siempre (`lh_study_hours`, un total por
    asignatura) y un registro fechado (`lh_study_log`), que es el que puede
    repartirse por semanas o meses en Analítica. El contador no vale para eso
    porque nunca guardó la fecha.

    Restar borra la última hora apuntada de esa asignatura en vez de meter una
    de -1 h: así el registro no acumula horas negativas que descuadrarían
    cualquier suma por periodo.
  */
  const cambiarEstudio = (asignatura, delta) => {
    const actual = Number(studyHours[asignatura]) || 0;
    if (delta < 0 && actual === 0) return;
    setStudyHours({ ...studyHours, [asignatura]: Math.max(0, actual + delta) });

    if (delta > 0) {
      setStudyLog([...studyLog, { id: Date.now(), fecha: todayISO(), subject: asignatura, horas: 1 }]);
      return;
    }

    const ultima = [...studyLog].reverse().find((e) => e.subject === asignatura);
    if (ultima) setStudyLog(studyLog.filter((e) => e.id !== ultima.id));
  };

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
          Trae tus tareas <b>pendientes</b> de todas las asignaturas, agrupadas por asignatura. Las
          cerradas y las que ya has entregado no se descargan: son casi todo el histórico y solo hacían
          la sincronización más lenta. La contraseña solo se usa para entrar en el Aula Virtual en ese
          momento: no se guarda en ningún sitio (ni aquí, ni en el servidor) y el campo se vacía al
          terminar.
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
            {aulaTareas.length} tarea{aulaTareas.length === 1 ? "" : "s"} pendiente
            {aulaTareas.length === 1 ? "" : "s"}
          </p>
        )}

        {/* Sincronizar tarda unos segundos (el Aula Virtual va lenta): mejor
            enseñar la forma de lo que viene que dejar la tarjeta en blanco. */}
        {sincronizando && (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <div key={i} className="lh-skeleton h-12" />
            ))}
          </div>
        )}

        {!sincronizando && aulaUltimaSync && aulaGrupos.length === 0 && (
          <p className="rounded-xl border border-slate-800 bg-slate-800/40 px-4 py-6 text-center text-sm text-slate-500">
            Ninguna tarea pendiente ahora mismo.
          </p>
        )}

        <div className="space-y-2">
          {!sincronizando && aulaGrupos.map((grupo) => {
            const abierta = asignaturaAbierta === grupo.asignatura;
            const faltan = tareasQueFaltan(grupo.tareas, tasks).length;
            return (
              <div key={grupo.asignatura} className="rounded-xl border border-slate-800 bg-slate-800/40">
                <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
                  <button
                    onClick={() => setAsignaturaAbierta(abierta ? null : grupo.asignatura)}
                    aria-expanded={abierta}
                    className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  >
                    <span className="text-slate-500">{abierta ? "▾" : "▸"}</span>
                    <span className="truncate text-sm font-medium text-slate-200">
                      {grupo.asignatura}
                    </span>
                    {grupo.curso && (
                      <span className="shrink-0 rounded bg-slate-700/60 px-1.5 py-0.5 text-[11px] text-slate-400">
                        {grupo.curso}
                      </span>
                    )}
                    <span className="shrink-0 text-xs text-slate-500">
                      {grupo.tareas.length}
                      {grupo.pendientes > 0 && ` · ${grupo.pendientes} pendiente${grupo.pendientes === 1 ? "" : "s"}`}
                    </span>
                  </button>
                  {faltan > 0 && (
                    <button
                      onClick={() => anadirGrupo(grupo.tareas)}
                      className="shrink-0 rounded-lg border border-indigo-800 bg-indigo-500/10 px-2.5 py-1 text-xs font-medium text-indigo-300 transition hover:bg-indigo-500/20"
                    >
                      + Añadir {faltan}
                    </button>
                  )}
                </div>

                {abierta && (
                  <ul className="space-y-1.5 border-t border-slate-800 px-4 py-3">
                    {grupo.tareas.map((t) => {
                      const puesta = yaAnadida(tasks, t.id);
                      return (
                        <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                          <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${ESTADO_AULA[t.estado].clase}`}>
                            {ESTADO_AULA[t.estado].texto}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-slate-200">{t.titulo}</span>
                          <span className="shrink-0 text-xs text-slate-500">
                            {t.entrega ? new Date(t.entrega).toLocaleDateString("es-ES") : "sin plazo"}
                          </span>
                          <button
                            onClick={() => anadirDelAula(t)}
                            disabled={puesta}
                            className="shrink-0 rounded-lg border border-slate-700 px-2 py-0.5 text-xs text-slate-300 transition hover:border-indigo-500 hover:text-indigo-300 disabled:border-transparent disabled:text-emerald-400"
                          >
                            {puesta ? "✓ puesta" : "+ poner"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* To-Do filtrable */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <CheckCircle2 size={18} className="text-emerald-400" /> Tareas por asignatura
          </h2>

          <div className="mb-4 flex flex-wrap gap-2">
            {["Todas", ...asignaturasConTareas].map((s) => (
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
                <span className={`min-w-0 flex-1 text-sm ${t.done ? "text-slate-500 line-through" : "text-slate-200"}`}>
                  {t.text}
                  {t.entrega && (
                    <span className="ml-2 text-xs text-slate-500">
                      entrega {new Date(t.entrega).toLocaleDateString("es-ES")}
                    </span>
                  )}
                </span>
                <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${subjectColor(t.subject)}`}>
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
                    onClick={() => cambiarEstudio(s, -1)}
                    aria-label={`Quitar una hora de ${s}`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-slate-200 transition hover:bg-slate-600"
                  >
                    −
                  </button>
                  <span className="w-10 text-center text-sm font-semibold text-slate-100">
                    {studyHours[s] || 0}h
                  </span>
                  <button
                    onClick={() => cambiarEstudio(s, 1)}
                    aria-label={`Añadir una hora de ${s}`}
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

/*
  Finanzas va por MES natural: los ingresos, los gastos, el balance y el
  presupuesto son siempre los del mes que estés mirando, y el día 1 empiezan de
  cero solos. Antes los totales sumaban todo el histórico mientras el texto
  decía "este mes", así que a los pocos meses el presupuesto salía siempre
  desbordado.

  Lo que NO se reinicia: los objetivos de ahorro, las suscripciones y los topes
  por categoría, que son configuración y no movimientos del mes.
*/
function Finanzas() {
  const [rows, setRows] = usePersisted("lh_finance", INITIAL_FINANCE);
  const [form, setForm] = useState({ concepto: "", categoria: "Ocio", monto: "", fecha: todayISO() });
  const [tipo, setTipo] = useState("gasto");

  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const [verTodo, setVerTodo] = useState(false);
  const esMesActual = mes === todayISO().slice(0, 7);

  const moverMes = (delta) => {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const rowsMes = useMemo(() => rows.filter((r) => (r.fecha || "").slice(0, 7) === mes), [rows, mes]);

  // redondear() en cada total: sumar importes con decimales arrastra restos de
  // coma flotante (600.9000000000001) que se veían tal cual en las tarjetas.
  const income = redondear(rowsMes.filter((r) => r.monto > 0).reduce((a, b) => a + b.monto, 0));
  const expenses = redondear(rowsMes.filter((r) => r.monto < 0).reduce((a, b) => a + Math.abs(b.monto), 0));
  const balance = redondear(income - expenses);

  const [presupuesto, setPresupuesto] = usePersisted("lh_budget_mensual", PRESUPUESTO_INICIAL);
  const budgetPct = presupuesto > 0 ? Math.min(100, (expenses / presupuesto) * 100) : 0;
  // Vacío: el objetivo "Portátil nuevo, 740 de 1200 €" era de ejemplo y se
  // guardaba como si fuera tuyo.
  const [savings, setSavings] = usePersisted("lh_savings", []);
  const [subs, setSubs] = usePersisted("lh_subs", []);
  const [sForm, setSForm] = useState({ label: "", target: "" });
  const [subForm, setSubForm] = useState({ nombre: "", monto: "", dia: "" });
  const totalSubs = redondear(subs.reduce((a, b) => a + Number(b.monto || 0), 0));
  const addSaving = () => { if (!sForm.label.trim() || !sForm.target) return; setSavings([...savings, { id: Date.now(), label: sForm.label, target: Number(sForm.target), current: 0 }]); setSForm({ label: "", target: "" }); };
  const addSub = () => { if (!subForm.nombre.trim()) return; setSubs([...subs, { id: Date.now(), nombre: subForm.nombre, monto: Number(subForm.monto) || 0, dia: Number(subForm.dia) || 1 }]); setSubForm({ nombre: "", monto: "", dia: "" }); };

  /*
    Ingresos fijos: la contraparte de las suscripciones. Es lo que entra todos
    los meses sí o sí (nómina, beca, alquiler que cobras...), y sirve para saber
    con cuánto cuentas de partida sin esperar a que llegue el movimiento.
  */
  const [fijos, setFijos] = usePersisted("lh_ingresos_fijos", []);
  const [fijoForm, setFijoForm] = useState({ nombre: "", monto: "", dia: "" });
  const totalFijos = redondear(fijos.reduce((a, b) => a + Number(b.monto || 0), 0));
  const addFijo = () => {
    if (!fijoForm.nombre.trim()) return;
    setFijos([...fijos, { id: Date.now(), nombre: fijoForm.nombre, monto: Number(fijoForm.monto) || 0, dia: Number(fijoForm.dia) || 1 }]);
    setFijoForm({ nombre: "", monto: "", dia: "" });
  };
  // Lo que queda libre cada mes una vez pagado lo que no se puede evitar.
  const disponibleFijo = redondear(totalFijos - totalSubs);

  /*
    Las categorías son las mismas que usa la importación del banco: si aquí
    hubiera menos, un movimiento importado como "Vivienda" no se podría ni
    reasignar, porque su categoría no saldría en el desplegable.
  */
  const CATS = CATEGORIAS_BANCO;

  const [budgets, setBudgets] = usePersisted("lh_budgets", {});
  const gastoPorCat = useMemo(() => {
    const m = {};
    rowsMes.filter((r) => r.monto < 0).forEach((r) => { m[r.categoria] = (m[r.categoria] || 0) + Math.abs(r.monto); });
    return m;
  }, [rowsMes]);
  const CAT_COLORS = { Comida: "#f43f5e", Universidad: "#6366f1", Deporte: "#10b981", Ocio: "#f59e0b", Transporte: "#0ea5e9", Vivienda: "#a855f7", Suscripciones: "#14b8a6", Salud: "#ec4899", Banco: "#14b8a6" };
  const catColor = (c) => CAT_COLORS[c] || "#94a3b8";
  const gastoCats = Object.entries(gastoPorCat).sort((a, b) => b[1] - a[1]);
  const totalGastoMes = gastoCats.reduce((a, b) => a + b[1], 0);
  const [finOrden, setFinOrden] = useState({ campo: "fecha", dir: "desc" });
  const rowsFin = useMemo(() => {
    const arr = [...(verTodo ? rows : rowsMes)];
    const { campo, dir } = finOrden;
    arr.sort((a, b) => (campo === "monto" ? (Number(a.monto) || 0) - (Number(b.monto) || 0) : String(a[campo] || "").localeCompare(String(b[campo] || ""))));
    if (dir === "desc") arr.reverse();
    return arr;
  }, [rows, rowsMes, verTodo, finOrden]);
  const finSort = (c) => setFinOrden((o) => ({ campo: c, dir: o.campo === c && o.dir === "asc" ? "desc" : "asc" }));
  const updateFin = (id, campo, valor) => setRows(rows.map((r) => (r.id === id ? { ...r, [campo]: campo === "monto" ? Number(valor) || 0 : valor } : r)));

  const add = () => {
    if (!form.concepto || !form.monto) return;
    const signed = tipo === "gasto" ? -Math.abs(Number(form.monto)) : Math.abs(Number(form.monto));
    const fecha = form.fecha || todayISO();
    setRows([
      { id: Date.now(), fecha, concepto: form.concepto, categoria: tipo === "gasto" ? form.categoria : "Ingreso", monto: signed },
      ...rows,
    ]);
    // Si apuntas algo de otro mes, la vista salta a ese mes: si no, el
    // movimiento se guardaría bien pero desaparecería de la pantalla.
    setMes(fecha.slice(0, 7));
    setForm({ concepto: "", categoria: "Ocio", monto: "", fecha });
  };

  /*
    Los movimientos del banco entran por delante y sin tocar los tuyos: la
    detección de repetidos ya se hizo en la previsualización.
  */
  const importarDelBanco = (nuevos) => setRows([...nuevos, ...rows]);

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Wallet} title="Finanzas" subtitle="Ingresos, gastos y ahorro, mes a mes" />

      <Card className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => moverMes(-1)}
          aria-label="Mes anterior"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-500"
        >
          ‹
        </button>
        <span className="min-w-24 text-center text-lg font-semibold text-slate-100">{monthLabel(mes)}</span>
        <button
          onClick={() => moverMes(1)}
          aria-label="Mes siguiente"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-500"
        >
          ›
        </button>
        {esMesActual ? (
          <span className="text-xs text-slate-500">Los totales empiezan de cero el día 1 de cada mes.</span>
        ) : (
          <button onClick={() => setMes(todayISO().slice(0, 7))} className="text-xs text-indigo-400 underline">
            Volver al mes actual
          </button>
        )}
      </Card>

      {/*
        En el móvil van los tres en fila y en vertical (icono arriba): apilados
        a lo ancho ocupaban tres pantallazos para tres cifras, y había que hacer
        scroll para ver el balance.
      */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <Card padding="p-3 sm:p-5" className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 sm:h-12 sm:w-12">
            <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tabular-nums text-slate-100 sm:text-2xl"><Cifra valor={income} decimales={income % 1 ? 2 : 0} sufijo="€" /></p>
            <p className="text-xs text-slate-400 sm:text-sm">Ingresos</p>
          </div>
        </Card>
        <Card padding="p-3 sm:p-5" className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 sm:h-12 sm:w-12">
            <ArrowDownRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tabular-nums text-slate-100 sm:text-2xl"><Cifra valor={expenses} decimales={expenses % 1 ? 2 : 0} sufijo="€" /></p>
            <p className="text-xs text-slate-400 sm:text-sm">Gastos</p>
          </div>
        </Card>
        <Card padding="p-3 sm:p-5" className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 sm:h-12 sm:w-12">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <p className={`font-display text-lg font-bold tabular-nums sm:text-2xl ${balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              <Cifra valor={balance} decimales={balance % 1 ? 2 : 0} sufijo="€" />
            </p>
            <p className="text-xs text-slate-400 sm:text-sm">Balance</p>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Presupuesto mensual</h2>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <span>{fmtEuro(expenses)} /</span>
              <label className="sr-only" htmlFor="presupuesto-mensual">
                Presupuesto mensual en euros
              </label>
              <input
                id="presupuesto-mensual"
                name="presupuesto-mensual"
                type="number"
                min="0"
                inputMode="numeric"
                value={presupuesto}
                onChange={(e) => setPresupuesto(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <span>€</span>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`lh-barra h-full rounded-full ${budgetPct > 85 ? "bg-rose-500" : "bg-emerald-500"}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {presupuesto > 0
              ? `Te quedan ${fmtEuro(Math.max(0, presupuesto - expenses))} de presupuesto en ${monthLabel(mes)}.`
              : "Pon un tope mensual para ver cuánto te queda."}
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
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800"><div className="lh-barra h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-100">
            Gasto por categoría ({monthLabel(mes)})
          </h2>
          {totalGastoMes === 0 ? (
            <p className="text-sm text-slate-500">Sin gastos en {monthLabel(mes)}.</p>
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
                    <span className="ml-auto font-medium text-slate-400">{fmtEuro(v)}</span>
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
                      <span className={over ? "text-rose-400" : "text-slate-400"}>{fmtEuro(gastado)} /</span>
                      <input type="number" value={budgets[cat] || ""} onChange={(e) => setBudgets({ ...budgets, [cat]: Number(e.target.value) || 0 })} placeholder="0" className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-right text-xs text-slate-100 focus:border-indigo-500 focus:outline-none" />
                      <span className="text-slate-500">€</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`lh-barra h-full rounded-full ${over ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Define un tope por categoría; se marca en rojo si lo superas en {monthLabel(mes)}.</p>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Ingresos fijos</h2>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
              +{fmtEuro(totalFijos)}/mes
            </span>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input aria-label="Nombre del ingreso fijo" placeholder="Nombre (nómina, beca...)" value={fijoForm.nombre} onChange={(e) => setFijoForm({ ...fijoForm, nombre: e.target.value })} className={`min-w-32 flex-1 ${inputCls}`} />
            <input aria-label="Importe al mes en euros" type="number" inputMode="decimal" placeholder="€/mes" value={fijoForm.monto} onChange={(e) => setFijoForm({ ...fijoForm, monto: e.target.value })} className={`lh-num w-24 ${inputCls}`} />
            <input aria-label="Día del mes en que se cobra" type="number" inputMode="numeric" placeholder="Día" value={fijoForm.dia} onChange={(e) => setFijoForm({ ...fijoForm, dia: e.target.value })} className={`lh-num w-20 ${inputCls}`} />
            <button onClick={addFijo} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400">Añadir</button>
          </div>
          <ul className="space-y-2">
            {fijos.length === 0 && <li className="py-1 text-center text-sm text-slate-500">Sin ingresos fijos. Apunta tu nómina o tu beca.</li>}
            {fijos.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-200">{f.nombre}</span>
                <span className="shrink-0 text-xs text-slate-500">día {f.dia}</span>
                <span className="shrink-0 font-semibold text-emerald-300">{fmtEuro(f.monto)}</span>
                <button onClick={() => removeWithUndo(fijos, setFijos, f.id, "Ingreso fijo")} aria-label={`Borrar ${f.nombre}`} className="shrink-0 text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Suscripciones y gastos fijos</h2>
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-300">
              −{fmtEuro(totalSubs)}/mes
            </span>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input aria-label="Nombre de la suscripción o gasto fijo" placeholder="Nombre (Netflix, gym...)" value={subForm.nombre} onChange={(e) => setSubForm({ ...subForm, nombre: e.target.value })} className={`min-w-32 flex-1 ${inputCls}`} />
            <input aria-label="Importe al mes en euros" type="number" inputMode="decimal" placeholder="€/mes" value={subForm.monto} onChange={(e) => setSubForm({ ...subForm, monto: e.target.value })} className={`lh-num w-24 ${inputCls}`} />
            <input aria-label="Día del mes en que se paga" type="number" inputMode="numeric" placeholder="Día" value={subForm.dia} onChange={(e) => setSubForm({ ...subForm, dia: e.target.value })} className={`lh-num w-20 ${inputCls}`} />
            <button onClick={addSub} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">Añadir</button>
          </div>
          <ul className="space-y-2">
            {subs.length === 0 && <li className="py-1 text-center text-sm text-slate-500">Sin suscripciones. Añade tus gastos fijos.</li>}
            {subs.map((sub) => (
              <li key={sub.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-200">{sub.nombre}</span>
                <span className="shrink-0 text-xs text-slate-500">día {sub.dia}</span>
                <span className="shrink-0 font-semibold text-rose-300">{fmtEuro(sub.monto)}</span>
                <button onClick={() => removeWithUndo(subs, setSubs, sub.id, "Suscripción")} aria-label={`Borrar ${sub.nombre}`} className="shrink-0 text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {(totalFijos > 0 || totalSubs > 0) && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-100">Te queda libre cada mes</h2>
            <p className="text-xs text-slate-500">
              {fmtEuro(totalFijos)} de ingresos fijos menos {fmtEuro(totalSubs)} de gastos fijos.
            </p>
          </div>
          <p className={`font-display text-2xl font-bold tabular-nums ${disponibleFijo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmtEuro(disponibleFijo)}
          </p>
        </Card>
      )}

      <Suspense
        fallback={
          <Card className="mb-6">
            <Skeleton lineas={3} />
          </Card>
        }
      >
        <Banco movimientosActuales={rows} onImportar={importarDelBanco} />
      </Suspense>

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
          <label className="sr-only" htmlFor="fin-fecha">
            Fecha del movimiento
          </label>
          <input
            id="fin-fecha"
            name="fin-fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className={inputCls}
          />
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

      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <h2 className="text-lg font-semibold text-slate-100">
          Movimientos {verTodo ? "(todo el histórico)" : `de ${monthLabel(mes)}`}
        </h2>
        <span className="text-xs text-slate-500">{rowsFin.length}</span>
        <button
          onClick={() => setVerTodo(!verTodo)}
          className="ml-auto text-xs text-indigo-400 underline"
        >
          {verTodo ? `Ver solo ${monthLabel(mes)}` : "Ver todo el histórico"}
        </button>
      </div>

      {/*
        En el móvil, cada movimiento como ficha en vez de fila.

        La tabla tiene cinco columnas de campos editables y no cabe en 390px:
        el importe y el botón de borrar quedaban fuera de la pantalla, así que
        había que arrastrar en horizontal para ver lo único que de verdad
        importa de un movimiento.
      */}
      <div className="space-y-2 sm:hidden">
        {rowsFin.length === 0 && (
          <Card className="py-8 text-center text-sm text-slate-500">
            Sin movimientos en {monthLabel(mes)}. Apunta uno arriba o sincroniza el banco.
          </Card>
        )}
        {rowsFin.map((r) => (
          <Card key={r.id} padding="p-3">
            <div className="flex items-start gap-2">
              <input
                value={r.concepto}
                onChange={(e) => updateFin(r.id, "concepto", e.target.value)}
                aria-label="Concepto"
                className="min-w-0 flex-1 rounded bg-slate-800/40 px-2 py-1.5 font-medium text-slate-100 focus:bg-slate-800"
              />
              <div className={`flex shrink-0 items-center font-semibold ${r.monto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={r.monto}
                  onChange={(e) => updateFin(r.id, "monto", e.target.value)}
                  aria-label="Importe en euros"
                  className="lh-num w-20 rounded bg-slate-800/40 px-2 py-1.5 text-right tabular-nums focus:bg-slate-800"
                />
                €
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="date"
                value={r.fecha}
                onChange={(e) => updateFin(r.id, "fecha", e.target.value)}
                aria-label="Fecha"
                className="rounded bg-slate-800/40 px-2 py-1.5 text-xs text-slate-400 focus:bg-slate-800"
              />
              <select
                value={r.categoria}
                onChange={(e) => updateFin(r.id, "categoria", e.target.value)}
                aria-label="Categoría"
                className="rounded bg-slate-800 px-2 py-1.5 text-xs text-slate-300"
              >
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
              {/* p-2 y no p-1: con el icono de 16px deja una zona táctil de 32px. */}
              <button
                onClick={() => removeWithUndo(rows, setRows, r.id, "Movimiento")}
                aria-label={`Borrar ${r.concepto}`}
                className="ml-auto p-2 text-slate-500 transition hover:text-rose-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-x-auto p-0 sm:block">
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
            {rowsFin.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                  Sin movimientos en {monthLabel(mes)}. Apunta uno arriba o sincroniza el banco.
                </td>
              </tr>
            )}
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
                  <input type="number" value={r.monto} onChange={(e) => updateFin(r.id, "monto", e.target.value)} aria-label="Importe en euros" className="lh-num w-20 rounded bg-transparent px-1 py-1 text-right hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" />€
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => removeWithUndo(rows, setRows, r.id, "Movimiento")}
                    aria-label={`Borrar ${r.concepto}`}
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
    setHabits([...habits, { id: Date.now(), name: newHabit, hecho: [] }]);
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
  const [form, setForm] = useState({ fecha: "", actividad: "", horas: "" });
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
    setLog([{ id: Date.now(), fecha: todayISO(), actividad: form.actividad || "Sesión cronometrada", horas }, ...log]);
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

    const currentCount = log.filter((e) => monthKey(e.fecha) === currentKey).length;
    const maxBar = Math.max(...series.map((s) => s.horas), 1);
    return { series, current: redondear(current), prev: redondear(prev), diffPct, currentCount, currentKey, maxBar };
  }, [log]);

  // Reparto de la semana en curso: sustituye al viejo reparto por tipo de tarea.
  const semana = useMemo(() => horasPorDiaDeLaSemana(log, todayISO()), [log]);
  const totalSemana = redondear(semana.reduce((a, d) => a + d.horas, 0));
  const maxDia = Math.max(...semana.map((d) => d.horas), 1);

  const addEntry = () => {
    if (!form.actividad || !form.horas) return;
    setLog([
      {
        id: Date.now(),
        fecha: form.fecha || todayISO(),
        actividad: form.actividad,
        horas: Number(form.horas) || 0,
      },
      ...log,
    ]);
    setForm({ fecha: "", actividad: "", horas: "" });
  };

  const addRunbook = () => {
    if (!rbForm.titulo.trim()) return;
    setRunbooks([{ id: Date.now(), ...rbForm }, ...runbooks]);
    setRbForm({ titulo: "", pasos: "", herramientas: "" });
    setShowRb(false);
  };

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

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
            <p className="text-2xl font-bold tabular-nums text-slate-100">{fmtHoras(analytics.current)}</p>
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
            <p className="text-sm text-slate-400">vs mes anterior ({fmtHoras(analytics.prev)})</p>
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
          {/* Mismo motivo que en Inicio: con items-end las columnas no se
              estiraban y las barras salían con altura cero. */}
          <div
            role="img"
            aria-label={`Horas de trabajo por mes: ${analytics.series
              .map((s) => `${s.label}, ${fmtHoras(s.horas)}`)
              .join("; ")}.`}
            className="flex h-44 justify-between gap-2"
          >
            {analytics.series.map((s) => (
              <div key={s.key} className="flex flex-1 flex-col items-center justify-end gap-2">
                <span className="text-xs font-medium tabular-nums text-slate-400">{s.horas ? fmtHoras(s.horas) : ""}</span>
                <div className="flex w-full flex-1 items-end">
                  <div
                    className="lh-barra-v w-full rounded-t-lg bg-gradient-to-t from-indigo-600 to-indigo-400"
                    style={{ height: `${(s.horas / analytics.maxBar) * 100}%` }}
                    title={`${s.label}: ${fmtHoras(s.horas)}`}
                  />
                </div>
                <span className="text-xs text-slate-500">{s.label}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Reparto de la semana en curso, día a día */}
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <TrendingUp size={18} className="text-emerald-400" /> Esta semana, día a día
            </h2>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold tabular-nums text-emerald-300">
              {fmtHoras(totalSemana)}
            </span>
          </div>
          {totalSemana === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Sin horas apuntadas esta semana todavía.</p>
          ) : (
            <div className="space-y-2.5">
              {semana.map((d) => (
                <div key={d.fecha}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span className={d.esHoy ? "font-semibold text-slate-100" : "text-slate-300"}>
                      {d.etiqueta}
                      {d.esHoy && <span className="ml-1.5 text-xs font-normal text-emerald-400">hoy</span>}
                    </span>
                    <span className="tabular-nums text-slate-400">{d.horas ? fmtHoras(d.horas) : "—"}</span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="lh-barra h-full rounded-full bg-emerald-500"
                      style={{ width: `${(d.horas / maxDia) * 100}%` }}
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
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} />
          <input
            placeholder="Actividad"
            value={form.actividad}
            onChange={(e) => setForm({ ...form, actividad: e.target.value })}
            className={`col-span-2 ${inputCls}`}
          />
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
          <span className="text-xs text-slate-500">Cronometra la actividad en curso (usa el campo Actividad).</span>
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
              <th className="px-5 py-3 text-right font-medium">Horas</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr>
                <td colSpan={4} className="px-5 py-8 text-center text-sm text-slate-500">
                  Sin horas apuntadas todavía. Añade una actividad arriba o usa el cronómetro.
                </td>
              </tr>
            )}
            {log.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-400">{e.fecha}</td>
                <td className="px-5 py-3 font-medium text-slate-100">{e.actividad}</td>
                <td className="px-5 py-3 text-right tabular-nums text-slate-300">{fmtHoras(e.horas)}</td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => removeWithUndo(log, setLog, e.id, "Actividad")} aria-label={`Borrar ${e.actividad}`} className="text-slate-500 transition hover:text-rose-400">
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
      { id: "plan", label: "Plan financiero", icon: Target },
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
    ],
  },
  {
    label: "Conocimiento",
    icon: Brain,
    items: [
      { id: "cerebro", label: "Segundo Cerebro", icon: Brain },
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
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openGroup, setOpenGroup] = useState(null);
  const headerRef = useRef(null);

  useRoutineNotifier();
  useAutoBackup();
  const { theme, toggle: toggleTheme } = useTheme();
  // Aquí solo para que el acento guardado se aplique al arrancar la app; se
  // elige en Ajustes.
  useAccent();
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

  const navigate = (id) => {
    setActive(id);
    setOpenGroup(null);
    setMobileOpen(false);
  };

  return (
    // Sin fondo propio: el color lo pone <body> y encima van las auroras
    // (body::before). Con un bg-slate-950 aquí, ese degradado quedaba tapado y
    // las tarjetas translúcidas no tenían nada que dejar ver.
    <div className="min-h-screen font-sans text-slate-200">
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
        {/* data-seccion tiñe el área: de él salen las variables --c-seccion-*
            que usan el título y el resplandor superior (ver src/index.css). */}
        <div
          key={active}
          data-seccion={active}
          className="lh-seccion section-fade mx-auto max-w-6xl p-5 pb-24 sm:p-8 sm:pb-8"
        >
          <Suspense
            // Un esqueleto con la forma de una sección en vez de un texto: la
            // página no da un salto cuando llega el contenido de verdad.
            fallback={<SkeletonSeccion />}
          >
          {active === "inicio" && <Inicio />}
          {active === "trabajo" && <Trabajo />}
          {active === "gimnasio" && <Gimnasio />}
          {active === "universidad" && <Universidad />}
          {active === "tenis" && <TenisMesa />}
          {active === "tenis-notas" && <TenisEntrenos />}
          {active === "salud" && <Salud />}
          {active === "finanzas" && <Finanzas />}
          {active === "inversiones" && <Inversiones />}
          {active === "plan" && <PlanFinanciero />}
          {active === "habitos" && <Habitos />}
          {active === "metas" && <Metas />}
          {active === "calendario" && <Calendario />}
          {active === "proximos" && <Proximos />}
          {active === "cerebro" && <SegundoCerebro />}
          {active === "foco" && <Foco />}
          
          {active === "analitica" && <Analitica />}
          
          
          
          {active === "datos" && <Datos />}
          {active === "ajustes" && <Ajustes />}
          </Suspense>
        </div>
      </main>

      <BarraInferior
        active={active}
        onNavigate={navigate}
        onAbrirMenu={() => setMobileOpen(!mobileOpen)}
        menuAbierto={mobileOpen}
      />

      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} sections={NAV} onNavigate={(id) => setActive(id)} />
      <QuickAdd />
      <Onboarding />
      <ToastHost />
    </div>
  );
}
