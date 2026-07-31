import { useState, useMemo } from "react";
import { GraduationCap, Table2, Plus, Trash2, Clock, CheckCircle2, Circle, CalendarCheck, Link2, BarChart3, Award } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, todayISO } from "../lib/ui";
import { BarrasH } from "../lib/graficos";
import { SUBJECTS } from "../lib/uni";
import {
  horasPorAsignatura,
  totalHoras,
  quitarHoras,
  reparto,
  filaDeEstudio,
} from "../lib/estudio";
import { sincronizarAulaVirtual } from "../lib/aulaVirtual";
import {
  normalizarTareas,
  agruparPorAsignatura,
  esPendiente,
  aTareaDeApp,
  yaAnadida,
  tareasQueFaltan,
} from "../lib/aula";
import { removeWithUndo, toast } from "../lib/toast";
import { nuevoId } from "../lib/id";
import {
  SCHEDULE_C1,
  SCHEDULE_C2,
  SIN_HORARIO_FIJO,
  PRACTICAS_C1,
  PRACTICAS_C2,
  EXAM_DATES,
  ESTADO_AULA,
  INITIAL_UNI_TASKS,
} from "../lib/datosUni";

/* Atajos de la caja de "¿cuántas horas le has echado?" al terminar una tarea. */
const HORAS_RAPIDAS = [0.5, 1, 2, 3];

const fmtHoras = (h) =>
  `${Number(h || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;

function Universidad() {
  const [cuatrimestre, setCuatrimestre] = useState("C1");
  const [tasks, setTasks] = usePersisted("lh_uni_tasks", INITIAL_UNI_TASKS);
  const [filter, setFilter] = useState("Todas");
  /*
    Las horas salen SOLO de `lh_study_log`. El contador antiguo
    (`lh_study_hours`) ya no se lee ni se escribe: tenía las horas sin fecha y
    era el que provocaba el "29h totales" con todas las asignaturas a 0, porque
    sumaba también asignaturas de cursos anteriores que la lista no pintaba.
    Ver src/lib/estudio.js.
  */
  const [studyLog, setStudyLog] = usePersisted("lh_study_log", []);
  // Qué asignaturas te han convalidado. Prácticas Externas es el caso: no se
  // cursa, así que no tiene horas que apuntar ni sentido salir en el gráfico.
  const [convalidadas, setConvalidadas] = usePersisted("lh_uni_convalidadas", {});
  const [newTask, setNewTask] = useState("");
  const [newSubject, setNewSubject] = useState(SUBJECTS[0]);
  const [newFecha, setNewFecha] = useState("");
  const [newHora, setNewHora] = useState("");
  // Tarea que acabas de dar por terminada y está esperando a que digas horas.
  const [preguntandoHoras, setPreguntandoHoras] = useState(null);
  const [horasSueltas, setHorasSueltas] = useState("");

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

  /*
    Las asignaturas que de verdad se cursan. Una convalidada no se estudia, así
    que ni cuenta horas ni sale en el gráfico: dejarla ahí a 0 para siempre solo
    ensucia la comparación con las demás.
  */
  const enCurso = useMemo(() => SUBJECTS.filter((s) => !convalidadas[s]), [convalidadas]);

  const porAsignatura = useMemo(() => horasPorAsignatura(studyLog), [studyLog]);
  /*
    El total se acota a las asignaturas que se ven. Es EL arreglo del "29h
    totales": antes se sumaba el objeto entero, incluidas asignaturas de cursos
    anteriores que la lista no pintaba, y la cabecera no cuadraba con ninguna de
    las filas de debajo.
  */
  const totalStudy = useMemo(() => totalHoras(studyLog, enCurso), [studyLog, enCurso]);
  const repartoHoras = useMemo(() => reparto(studyLog, enCurso), [studyLog, enCurso]);

  const apuntarHoras = (asignatura, horas, tarea = null) => {
    const h = Number(horas) || 0;
    if (h <= 0) return;
    setStudyLog([
      ...studyLog,
      filaDeEstudio({ id: nuevoId(), fecha: todayISO(), asignatura, horas: h, tarea }),
    ]);
  };

  /*
    Sumar o quitar una hora suelta desde la lista.

    Quitar borra desde la última apuntada en vez de meter una fila de -1 h: una
    fila negativa descuadraría cualquier suma por periodo en Analítica (ver
    `quitarHoras` en src/lib/estudio.js).
  */
  const cambiarEstudio = (asignatura, delta) => {
    if (delta > 0) return apuntarHoras(asignatura, delta);
    setStudyLog(quitarHoras(studyLog, asignatura, -delta));
  };

  const alternarConvalidada = (asignatura) =>
    setConvalidadas({ ...convalidadas, [asignatura]: !convalidadas[asignatura] });

  const addTask = () => {
    if (!newTask.trim()) return;
    setTasks([
      ...tasks,
      {
        id: nuevoId(),
        text: newTask,
        subject: newSubject,
        done: false,
        // `entrega` es el mismo campo que ya traían las tareas del Aula
        // Virtual, así que el calendario y las urgencias de Inicio las
        // reconocen sin tocar nada más.
        entrega: newFecha || null,
        hora: newHora || null,
      },
    ]);
    setNewTask("");
    setNewFecha("");
    setNewHora("");
  };

  /*
    Marcar o desmarcar una tarea.

    Al darla por terminada se abre debajo la caja de "¿cuántas horas?". No es un
    diálogo ni un paso obligatorio: la tarea ya queda hecha, y si no dices nada
    simplemente no se apuntan horas. Antes esto era un contador de +1 h suelto
    en otra tarjeta, sin relación con lo que estabas haciendo.
  */
  const alternarTarea = (tarea) => {
    const hecha = !tarea.done;
    setTasks(tasks.map((x) => (x.id === tarea.id ? { ...x, done: hecha } : x)));
    setHorasSueltas("");
    setPreguntandoHoras(hecha ? tarea.id : null);
  };

  const registrarDeTarea = (tarea, horas) => {
    apuntarHoras(tarea.subject, horas, tarea.id);
    setPreguntandoHoras(null);
    setHorasSueltas("");
    toast(`${fmtHoras(horas)} de ${tarea.subject}`);
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

          <div className="mb-4 space-y-2">
            <div className="flex gap-2">
              <input
                placeholder="Nueva tarea..."
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                aria-label="Nueva tarea"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
              />
              <select
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
                aria-label="Asignatura"
                className="min-w-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {SUBJECTS.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </div>
            {/*
              Cuándo hay que hacerla. Con fecha, la tarea sale en el calendario
              y en "lo de hoy" de Inicio; sin fecha se comporta como siempre, así
              que apuntar algo rápido sigue siendo escribir y pulsar Enter.
            */}
            <div className="flex flex-wrap gap-2">
              <input
                type="date"
                value={newFecha}
                onChange={(e) => setNewFecha(e.target.value)}
                aria-label="Fecha en la que hay que hacerla (opcional)"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="time"
                value={newHora}
                onChange={(e) => setNewHora(e.target.value)}
                aria-label="Hora (opcional)"
                disabled={!newFecha}
                title={newFecha ? "" : "Elige antes una fecha"}
                className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-40"
              />
              <button
                onClick={addTask}
                aria-label="Añadir tarea"
                className="rounded-lg bg-indigo-500 px-3 py-2 text-white transition hover:bg-indigo-400"
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <ul className="space-y-2">
            {filtered.length === 0 && (
              <li className="py-4 text-center text-sm text-slate-500">Sin tareas para este filtro.</li>
            )}
            {filtered.map((t) => {
              const horasDeEsta = studyLog
                .filter((e) => e.tarea === t.id)
                .reduce((a, e) => a + (Number(e.horas) || 0), 0);
              return (
                <li key={t.id} className="rounded-xl border border-slate-800 bg-slate-800/40 px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => alternarTarea(t)}
                      aria-label={t.done ? `Marcar ${t.text} como pendiente` : `Marcar ${t.text} como hecha`}
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
                        <span className="ml-2 whitespace-nowrap text-xs text-slate-500">
                          {new Date(t.entrega + "T00:00:00").toLocaleDateString("es-ES", {
                            day: "numeric",
                            month: "short",
                          })}
                          {t.hora && ` · ${t.hora}`}
                        </span>
                      )}
                      {horasDeEsta > 0 && (
                        <span className="ml-2 whitespace-nowrap text-xs text-amber-400">
                          {fmtHoras(horasDeEsta)}
                        </span>
                      )}
                    </span>
                    <span className={`shrink-0 rounded-md px-2 py-0.5 text-xs font-medium ${subjectColor(t.subject)}`}>
                      {t.subject}
                    </span>
                    <button
                      onClick={() => removeWithUndo(tasks, setTasks, t.id, "Tarea")}
                      aria-label={`Borrar ${t.text}`}
                      className="text-slate-500 transition hover:text-rose-400"
                    >
                      <Trash2 size={15} aria-hidden="true" />
                    </button>
                  </div>

                  {/*
                    Se abre sola al dar la tarea por terminada. La tarea YA está
                    hecha: esto es un extra, no un paso obligatorio, y por eso se
                    puede cerrar sin apuntar nada.
                  */}
                  {preguntandoHoras === t.id && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-700/60 pt-2.5">
                      <span className="text-xs text-slate-400">¿Cuántas horas le has echado?</span>
                      {HORAS_RAPIDAS.map((h) => (
                        <button
                          key={h}
                          onClick={() => registrarDeTarea(t, h)}
                          className="rounded-lg bg-slate-700 px-2.5 py-1 text-xs font-semibold text-slate-100 transition hover:bg-indigo-500"
                        >
                          {fmtHoras(h)}
                        </button>
                      ))}
                      <input
                        type="number"
                        min="0"
                        step="0.5"
                        inputMode="decimal"
                        placeholder="otras"
                        value={horasSueltas}
                        onChange={(e) => setHorasSueltas(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && registrarDeTarea(t, horasSueltas)}
                        aria-label="Otras horas"
                        className="w-20 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                      />
                      <button
                        onClick={() => setPreguntandoHoras(null)}
                        className="ml-auto text-xs text-slate-500 transition hover:text-slate-300"
                      >
                        No apuntar
                      </button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </Card>

        {/* Horas de estudio */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Clock size={18} className="text-amber-400" /> Horas de estudio
            </h2>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">
              {fmtHoras(totalStudy)} en total
            </span>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Se apuntan solas al dar una tarea por terminada. El total es la suma de lo de abajo, ni
            una hora más.
          </p>

          {/* Gráfico: de un vistazo, a qué le estás echando el rato y a qué no. */}
          {totalStudy > 0 && (
            <div className="mb-5">
              <h3 className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                <BarChart3 size={13} aria-hidden="true" /> Reparto por asignatura
              </h3>
              {/*
                El nombre entero, no la primera palabra: "Fund." e "Infraest."
                no dicen gran cosa, y truncar con puntos suspensivos al menos
                deja el principio legible y el completo en el title.
              */}
              <BarrasH
                datos={repartoHoras}
                valor={(d) => d.horas}
                etiqueta={(d) => d.asignatura}
                detalle={(d) => (totalStudy ? `${Math.round((d.horas / totalStudy) * 100)}%` : "")}
                color="bg-amber-500"
                formato={fmtHoras}
                anchoEtiqueta="w-28"
              />
            </div>
          )}

          <div className="space-y-2">
            {SUBJECTS.map((s) => {
              const convalidada = !!convalidadas[s];
              return (
                <div
                  key={s}
                  className={`flex items-center justify-between gap-2 rounded-xl border border-slate-800 px-4 py-2.5 ${
                    convalidada ? "bg-slate-800/20" : "bg-slate-800/40"
                  }`}
                >
                  <span className={`min-w-0 truncate rounded-md px-2 py-0.5 text-xs font-medium ${subjectColor(s)}`}>
                    {s}
                  </span>

                  {convalidada ? (
                    /*
                      Una asignatura convalidada no se cursa: no tiene horas que
                      apuntar y queda fuera del total y del gráfico. Solo importa
                      el estado, que es lo único que hay que llevar de ella.
                    */
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                        <Award size={12} aria-hidden="true" /> Convalidada
                      </span>
                      <button
                        onClick={() => alternarConvalidada(s)}
                        className="text-xs text-slate-500 transition hover:text-slate-300"
                      >
                        Deshacer
                      </button>
                    </div>
                  ) : (
                    <div className="flex shrink-0 items-center gap-2">
                      <button
                        onClick={() => cambiarEstudio(s, -1)}
                        aria-label={`Quitar una hora de ${s}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-slate-700 text-slate-200 transition hover:bg-slate-600"
                      >
                        −
                      </button>
                      <span className="w-14 text-center text-sm font-semibold tabular-nums text-slate-100">
                        {fmtHoras(porAsignatura[s] || 0)}
                      </span>
                      <button
                        onClick={() => cambiarEstudio(s, 1)}
                        aria-label={`Añadir una hora de ${s}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-500 text-white transition hover:bg-indigo-400"
                      >
                        +
                      </button>
                      <button
                        onClick={() => alternarConvalidada(s)}
                        title={`Marcar ${s} como convalidada`}
                        aria-label={`Marcar ${s} como convalidada`}
                        className="text-slate-600 transition hover:text-emerald-400"
                      >
                        <Award size={15} aria-hidden="true" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default Universidad;
