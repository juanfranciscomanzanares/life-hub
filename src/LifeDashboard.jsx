import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import {
  Home,
  Dumbbell,
  GraduationCap,
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
  CalendarCheck,
  Brain,
  Search,
  BarChart3,
  LogOut,
  Sprout,
  LineChart,
  Flag,
  CalendarDays,
  Database,
  HeartPulse,
  Timer,
  Sun,
  Moon,
  CalendarClock,
  Settings,
  ChevronDown,
} from "lucide-react";
import { usePersisted } from "./lib/store";
import { useRuta } from "./lib/ruta";
import { Card, SectionTitle, SkeletonSeccion, Logo, todayISO } from "./lib/ui";
import { horasPorSemana, fmtHoras } from "./lib/trabajo";
import { Cifra } from "./lib/animar";
import { urgenciasDeHoy } from "./lib/uni";
import { normalizarHabito, mejorRacha } from "./lib/habitos";
import { normalizarTareas } from "./lib/aula";
import HoyWidget from "./sections/HoyWidget.jsx";
import { useRoutineNotifier } from "./lib/useRoutineNotifier";
import { useTheme, useAccent } from "./lib/useTheme";
import { useAutoBackup } from "./lib/useAutoBackup";
import CommandPalette from "./CommandPalette.jsx";
import QuickAdd from "./QuickAdd.jsx";
import Onboarding from "./Onboarding.jsx";
import ToastHost from "./ToastHost.jsx";
import BarraInferior from "./BarraInferior.jsx";
import { removeWithUndo } from "./lib/toast";

/*
  Secciones con carga diferida.

  Antes TODAS entraban en el bundle inicial aunque solo abrieras Inicio: había
  que descargarlo todo para ver la pantalla de bienvenida. Ahora cada una es su
  propio trozo y se descarga al abrirla por primera vez.

  Universidad, Finanzas, Trabajo, Hábitos y Segundo Cerebro se habían quedado a
  medias: seguían escritas dentro de este archivo, así que su código entraba en
  el trozo inicial de todas formas. Ya viven en src/sections/ como las demás.

  Se quedan fuera de aquí (carga inmediata) Inicio, que es lo primero que se ve
  siempre, y lo que está permanentemente en pantalla: HoyWidget, el botón +
  flotante, la paleta de comandos, los avisos y el onboarding. Cargar eso en
  diferido solo provocaría un parpadeo.
*/
const Universidad = lazy(() => import("./sections/Universidad.jsx"));
const Finanzas = lazy(() => import("./sections/Finanzas.jsx"));
const Trabajo = lazy(() => import("./sections/Trabajo.jsx"));
const Habitos = lazy(() => import("./sections/Habitos.jsx"));
const SegundoCerebro = lazy(() => import("./sections/SegundoCerebro.jsx"));
const Inversiones = lazy(() => import("./sections/Inversiones.jsx"));
const PlanFinanciero = lazy(() => import("./sections/PlanFinanciero.jsx"));
const Salud = lazy(() => import("./sections/Salud.jsx"));
const Gimnasio = lazy(() => import("./sections/Gimnasio.jsx"));
const Foco = lazy(() => import("./sections/Foco.jsx"));
const Analitica = lazy(() => import("./sections/Analitica.jsx"));
const Proximos = lazy(() => import("./sections/Proximos.jsx"));
const Ajustes = lazy(() => import("./sections/Ajustes.jsx"));
const TenisMesa = lazy(() => import("./sections/TenisMesa.jsx"));
const TenisEntrenos = lazy(() => import("./sections/TenisEntrenos.jsx"));
const Metas = lazy(() => import("./sections/Metas.jsx"));
const Calendario = lazy(() => import("./sections/Calendario.jsx"));
const Datos = lazy(() => import("./sections/Datos.jsx"));

/*
  Etiquetas de lo que urge hoy, en Inicio. Los catálogos de la carrera (horarios,
  prácticas, exámenes) se fueron con la sección a src/lib/datosUni.js.
*/
const URGENCIA = {
  examen: { texto: "Examen", clase: "bg-amber-500/15 text-amber-300" },
  entrega: { texto: "Entrega", clase: "bg-indigo-500/15 text-indigo-300" },
  evento: { texto: "Hoy", clase: "bg-slate-700/60 text-slate-300" },
};

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

const IDS_SECCION = NAV.map((s) => s.id);

export default function LifeDashboard({ userEmail = null, onSignOut = null }) {
  // La sección vive en la URL (#/gimnasio), no en un useState suelto: así el
  // botón "atrás" del móvil vuelve a la sección anterior en vez de cerrar la
  // app, y recargar te deja donde estabas. Ver src/lib/ruta.js.
  const [active, irASeccion] = useRuta(IDS_SECCION, "inicio");
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

  /*
    La sección puede cambiar sin pasar por `navigate`: el botón "atrás" del
    móvil, o pegar una URL con otro hash. En esos casos también hay que cerrar
    lo que estuviera abierto, o el panel se queda tapando la sección nueva.
  */
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
    /*
      Y arriba del todo. Antes, saltando desde el final de una sección larga a
      otra, aparecías a media pantalla de la nueva; con `key={active}` el
      contenido se rehace pero el desplazamiento de la página no se mueve solo.
    */
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [active]);

  /*
    Con el menú abierto, la página de detrás se queda quieta. Sin esto el dedo
    arrastraba unas veces el panel y otras el contenido del fondo, y al cerrar
    aparecías en un punto distinto del que estabas.
  */
  useEffect(() => {
    if (!mobileOpen) return;
    document.body.style.overflow = "hidden";
    return () => document.body.style.removeProperty("overflow");
  }, [mobileOpen]);

  const navigate = (id) => {
    irASeccion(id);
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
          {/* El texto de al lado se oculta por debajo de sm y el logo es
              aria-hidden, así que en el móvil este botón se quedaba sin nombre:
              un lector de pantalla solo anunciaba "botón". */}
          <button onClick={() => navigate("inicio")} aria-label="Life Hub, ir a Inicio" className="flex shrink-0 items-center gap-3">
            <Logo size={36} className="shadow-lg shadow-indigo-500/25" />
            <div className="hidden text-left sm:block">
              <p className="font-bold leading-tight text-slate-100">Life Hub</p>
              <p className="text-[10px] leading-tight text-slate-500">Panel personal</p>
            </div>
          </button>

          {/* Navegación de escritorio */}
          <nav aria-label="Secciones" className="ml-4 hidden flex-1 items-center gap-1 lg:flex">
            {NAV_GROUPS.map((g) => {
              const Icon = g.icon;
              if (!g.items) {
                const isActive = active === g.id;
                return (
                  <button
                    key={g.id}
                    onClick={() => navigate(g.id)}
                    aria-current={isActive ? "page" : undefined}
                    className={`nav-link flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      isActive ? "is-active text-indigo-300" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
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
                    aria-haspopup="true"
                    aria-expanded={isOpen}
                    aria-controls={`nav-grupo-${g.label}`}
                    className={`nav-link flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition ${
                      groupActive ? "is-active text-indigo-300" : isOpen ? "bg-slate-800/60 text-slate-200" : "text-slate-400 hover:bg-slate-800/60 hover:text-slate-200"
                    }`}
                  >
                    <Icon size={16} aria-hidden="true" />
                    {g.label}
                    <ChevronDown size={14} aria-hidden="true" className={`transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
                  </button>
                  {isOpen && (
                    <div id={`nav-grupo-${g.label}`} className="dropdown-pop absolute left-0 top-full z-40 mt-2 w-60 rounded-xl border border-slate-800 bg-slate-900/95 p-1.5 shadow-2xl shadow-black/40 backdrop-blur">
                      {g.items.map((item) => {
                        const ItemIcon = item.icon;
                        const isActive = active === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => navigate(item.id)}
                            aria-current={isActive ? "page" : undefined}
                            className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
                              isActive
                                ? "bg-indigo-500/15 font-medium text-indigo-300"
                                : "text-slate-300 hover:bg-slate-800 hover:text-slate-100"
                            }`}
                          >
                            <ItemIcon size={16} aria-hidden="true" className={isActive ? "" : "text-slate-500"} />
                            {item.label}
                            {isActive && <span aria-hidden="true" className="ml-auto h-1.5 w-1.5 rounded-full bg-indigo-400" />}
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
            <button
              onClick={() => setMobileOpen((o) => !o)}
              aria-label={mobileOpen ? "Cerrar menú" : "Abrir menú"}
              aria-expanded={mobileOpen}
              aria-controls="menu-movil"
              className="-mr-1 p-2 text-slate-300 lg:hidden"
            >
              {mobileOpen ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
            </button>
          </div>
        </div>

        {/*
          Panel de navegación móvil.

          La etiqueta es distinta de la del escritorio a propósito: los dos
          <nav> conviven en el DOM (se ocultan por CSS) y dos landmarks con el
          mismo nombre no se distinguen en un lector de pantalla.
        */}
        {mobileOpen && (
          <nav id="menu-movil" aria-label="Todas las secciones" className="mobile-panel lh-panel-movil overflow-y-auto border-t border-slate-800 bg-slate-950/95 px-4 backdrop-blur lg:hidden">
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
                          aria-current={isActive ? "page" : undefined}
                          className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                            isActive ? "bg-indigo-500/15 text-indigo-300" : "text-slate-300 hover:bg-slate-800"
                          }`}
                        >
                          <ItemIcon size={17} aria-hidden="true" className={isActive ? "" : "text-slate-500"} />
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
          </nav>
        )}
      </header>

      {/* Fondo oscurecido bajo el panel móvil. aria-hidden porque no aporta
          nada al leerlo: cerrar con teclado ya lo cubre Escape. */}
      {mobileOpen && (
        <div aria-hidden="true" className="fixed inset-0 z-20 bg-black/50 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/*
        Sin `overflow-x-hidden` aquí a propósito: por especificación, ocultar un
        eje convierte el otro en `auto`, así que <main> pasaba a ser un segundo
        contenedor de desplazamiento dentro de la página. En el móvil eso hace
        que el dedo mueva unas veces la página y otras el contenedor, y que el
        final de algunas secciones cueste alcanzar. El desbordamiento
        horizontal se recorta ahora en el <body> (ver src/index.css).
      */}
      <main>
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

      {/* Por `navigate` y no por `irASeccion` a secas: saltar desde la paleta
          también tiene que cerrar el desplegable o el panel del móvil. */}
      <CommandPalette open={paletteOpen} setOpen={setPaletteOpen} sections={NAV} onNavigate={navigate} />
      <QuickAdd />
      <Onboarding />
      <ToastHost />
    </div>
  );
}
