import { useState, useMemo } from "react";
import { GraduationCap, CalendarRange, Plus, Trash2, Clock, CalendarCheck, Link2, BarChart3, Award } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, todayISO } from "../lib/ui";
import { BarrasH, BarrasVerticales } from "../lib/graficos";
import { SUBJECTS } from "../lib/uni";
import {
  horasPorAsignatura,
  totalHoras,
  reparto,
  resumen,
  partirPorAsignatura,
  nuevaSesion,
  normalizarSesion,
  sesionValida,
  horasEntre,
  porDiaDeLaSemana,
  porMeses,
  lunesDe,
  sumarDias,
} from "../lib/estudio";
import { sincronizarAulaVirtual } from "../lib/aulaVirtual";
import { normalizarTareas, agruparPorAsignatura, esPendiente } from "../lib/aula";
import {
  PASO,
  aTexto,
  tramo,
  rangoHorario,
  filasDe,
  celdaDe,
  clasesDe,
  porDias,
} from "../lib/horario";
import { removeWithUndo, toast } from "../lib/toast";
import { nuevoId } from "../lib/id";
import {
  SCHEDULE_C1,
  SCHEDULE_C2,
  SIN_HORARIO_FIJO,
  EXAM_DATES,
  ESTADO_AULA,
} from "../lib/datosUni";

const fmtHoras = (h) =>
  `${Number(h || 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })} h`;

/*
  Alto de una hora en la rejilla del horario. Con 60px una clase de una hora
  admite las dos líneas que lleva (asignatura y tipo) sin recortar, y un
  cuatrimestre entero (de 10:00 a 21:00) cabe sin obligar a arrastrar.
*/
const ALTO_HORA = 60;
const ALTO_FILA = (ALTO_HORA * PASO) / 60;

function Universidad() {
  const [cuatrimestre, setCuatrimestre] = useState("C1");
  /*
    Las sesiones de estudio: `lh_study_log`. El contador antiguo
    (`lh_study_hours`) ya no se lee ni se escribe: tenía las horas sin fecha y
    era el que provocaba el "29h totales" con todas las asignaturas a 0, porque
    sumaba también asignaturas de cursos anteriores que la lista no pintaba.
    Ver src/lib/estudio.js.
  */
  const [studyLog, setStudyLog] = usePersisted("lh_study_log", []);
  // Qué asignaturas te han convalidado. Prácticas Externas es el caso: no se
  // cursa, así que no tiene horas que apuntar ni sentido salir en el gráfico.
  const [convalidadas, setConvalidadas] = usePersisted("lh_uni_convalidadas", {});

  // Formulario de sesión de estudio: el rato que te reservas tú.
  const [sesion, setSesion] = useState({
    asignatura: SUBJECTS[0],
    fecha: todayISO(),
    desde: "",
    hasta: "",
    nota: "",
  });
  // Qué se compara en el gráfico: los días de una semana o los últimos meses.
  const [periodo, setPeriodo] = useState("semana");
  // Cuántas semanas hacia atrás desde la actual (0 = esta).
  const [semanasAtras, setSemanasAtras] = useState(0);

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

  /* --- Sesiones de estudio --- */

  // Lunes de la semana que se está mirando. Con 0 es la de hoy.
  const lunesVisible = useMemo(
    () => sumarDias(lunesDe(todayISO()), -semanasAtras * 7),
    [semanasAtras]
  );

  /*
    Las barras del gráfico. En "semana" son los siete días de la semana que
    estés mirando; en "mes", los últimos seis meses. Es lo que permite comparar
    una semana con otra y el mes con los anteriores sin cambiar de pantalla.
  */
  const barras = useMemo(() => {
    if (periodo === "mes") {
      const meses = porMeses(studyLog, todayISO(), 6);
      return partirPorAsignatura(meses, studyLog, enCurso, (f, t) =>
        String(f?.fecha || "").slice(0, 7) === t.clave
      );
    }
    const dias = porDiaDeLaSemana(studyLog, sumarDias(lunesVisible, 3));
    return partirPorAsignatura(dias, studyLog, enCurso, (f, t) => f?.fecha === t.fecha);
  }, [studyLog, periodo, lunesVisible, enCurso]);

  const resumenPeriodo = useMemo(() => resumen(barras), [barras]);

  /*
    Qué asignaturas salen en la leyenda: solo las que aportan algo en el periodo
    que se está mirando. Listarlas todas llenaría la leyenda de nombres cuyo
    color no aparece en ninguna barra.
  */
  const seriesVisibles = useMemo(() => {
    const vistas = new Set();
    barras.forEach((b) => (b.partes || []).forEach((p) => vistas.add(p.clave)));
    return enCurso.filter((s) => vistas.has(s));
  }, [barras, enCurso]);

  const sesionesRecientes = useMemo(
    () =>
      [...studyLog]
        .map(normalizarSesion)
        .sort((a, b) =>
          `${b.fecha}${b.desde || ""}`.localeCompare(`${a.fecha}${a.desde || ""}`)
        )
        .slice(0, 8),
    [studyLog]
  );

  // Se calcula mientras escribes para que veas cuánto dura antes de guardarla.
  const duracionSesion = horasEntre(sesion.desde, sesion.hasta);

  const añadirSesion = () => {
    const nueva = nuevaSesion({ id: nuevoId(), ...sesion });
    if (!sesionValida(nueva)) return;
    setStudyLog([...studyLog, nueva]);
    // Se conservan asignatura y fecha: lo normal es apuntar varios ratos
    // seguidos del mismo día.
    setSesion({ ...sesion, desde: "", hasta: "", nota: "" });
    toast(`Sesión de ${fmtHoras(nueva.horas)} apuntada`);
  };

  const alternarConvalidada = (asignatura) =>
    setConvalidadas({ ...convalidadas, [asignatura]: !convalidadas[asignatura] });


  /*
    El color de cada asignatura.

    El hueco es FIJO y sale del orden de SUBJECTS, no del puesto que ocupe en
    ningún ranking. Si el color siguiera al ranking, quitar una asignatura o
    tener una semana distinta repintaría las demás y el mismo color querría
    decir dos cosas de un día para otro.

    Los tonos son los ocho `--c-serie-*` de index.css, que están validados para
    distinguirse entre sí también con daltonismo. La paleta anterior (indigo,
    esmeralda, ámbar... de Tailwind) no pasaba: violeta y fucsia daban ΔE 1,3 en
    protanopia, o sea la misma mancha para quien no separa rojo y verde, y eso
    en una barra apilada es justo donde más importa.
  */
  const huecoDeColor = (s) => {
    const i = SUBJECTS.indexOf(s);
    return i >= 0 ? (i % 8) + 1 : null;
  };

  const colorDeAsignatura = (s) => {
    const hueco = huecoDeColor(s);
    return hueco ? `rgb(var(--c-serie-${hueco}))` : "rgb(var(--c-slate-600))";
  };

  /*
    La etiqueta de asignatura, con el mismo tono que su trozo del gráfico: si no
    coincidieran, el color dejaría de identificar a la asignatura y habría que
    ir a la leyenda para todo.
  */
  const subjectStyle = (s) => ({
    backgroundColor: `color-mix(in srgb, ${colorDeAsignatura(s)} 18%, transparent)`,
    color: colorDeAsignatura(s),
  });

  const DIAS = [
    { key: "lunes", label: "Lunes" },
    { key: "martes", label: "Martes" },
    { key: "miercoles", label: "Miércoles" },
    { key: "jueves", label: "Jueves" },
  ];

  // Qué es cada clase, en una línea. Escrito también en la teoría: si solo se
  // marcaran las prácticas, la teoría se reconocería por no poner nada.
  const queEs = (c) =>
    `${c.practicas ? `Prácticas · Subgrupo ${c.subgrupo}` : "Teoría"}${c.aula ? ` · ${c.aula}` : ""}`;

  /*
    Una clase en la rejilla. Ocupa de su fila de inicio a la de fin, así que su
    ALTURA es su duración: se ve que Empresa dura el doble que sus prácticas sin
    leer una sola hora, que es lo que la tabla de antes no contaba.

    En los bloques cortos no se repite el tramo horario: el eje de la izquierda
    ya lo sitúa y en una hora de alto no cabe sin apretujar el nombre.
  */
  const Clase = ({ c, inicio }) => {
    const { desde, hasta } = celdaDe(c, inicio);
    return (
      <div
        role="listitem"
        style={{
          gridRow: `${desde} / ${hasta}`,
          color: colorDeAsignatura(c.subject),
          /*
            Fondo opaco, no la mezcla con transparente de `subjectStyle`: las
            líneas de hora se ven a través y parten en dos cualquier clase de
            más de una hora. Se mezcla contra slate-900, que es la superficie de
            la tarjeta y se invierte sola con el tema claro.
          */
          backgroundColor: `color-mix(in srgb, ${colorDeAsignatura(c.subject)} 18%, rgb(var(--c-slate-900)))`,
        }}
        /*
          El margen no es decorativo: la teoría de Empresa acaba a las 17:00 y
          sus prácticas empiezan a esa hora, y con el mismo color y sin aire en
          medio se leerían como un solo bloque de 15:00 a 18:00.
        */
        className="m-px overflow-hidden rounded-lg px-2 py-1"
      >
        <p className="text-[11px] font-semibold leading-tight">{c.subject}</p>
        {/* Las opacidades no bajan más: sobre el fondo pastel del tema claro,
            un 60% ya se lee con esfuerzo. */}
        <p className="text-[10px] leading-tight opacity-90">{queEs(c)}</p>
        {tramo(c.hora).dura >= 90 && (
          <p className="mt-0.5 text-[10px] leading-tight opacity-75">{c.hora}</p>
        )}
      </div>
    );
  };

  /*
    El horario como rejilla semanal, no como tabla.

    La tabla ponía una fila por franja horaria y salían ocho filas con un hueco
    cada una, sin relación entre lo que medía una fila y lo que duraba la clase:
    "15:00 - 17:00" y "17:00 - 18:00" ocupaban lo mismo. Aquí el eje del tiempo
    es continuo, cada clase mide lo que dura y los huecos entre clases son
    huecos de verdad.

    En el móvil no se pinta la rejilla sino una agenda por días: cuatro columnas
    legibles no caben en 360px, y la alternativa (arrastrar de lado para ver el
    jueves) es peor que una lista.
  */
  const HorarioCuatrimestre = ({ titulo, clases, sinHorario }) => {
    const { inicio, horas, filas } = rangoHorario(clases);
    const agenda = porDias(clases, DIAS);

    // Las mismas columnas para la cabecera y el cuerpo; si se separan, los días
    // dejan de caer encima de su columna.
    const columnas = { gridTemplateColumns: `2.75rem repeat(${DIAS.length}, minmax(0, 1fr))` };
    const rejilla = { gridTemplateRows: `repeat(${filas}, ${ALTO_FILA}px)` };
    // Una línea por hora, de fondo: marca el compás sin meter un div por hora.
    const lineasDeHora = {
      backgroundImage: "linear-gradient(to bottom, rgb(var(--c-slate-800) / 0.8) 1px, transparent 1px)",
      backgroundSize: `100% ${ALTO_HORA}px`,
    };

    return (
      <Card className="p-0">
        <div className="flex items-center gap-2 px-5 pt-4 text-slate-100">
          <CalendarRange size={18} className="text-indigo-400" aria-hidden="true" />
          <h2 className="text-lg font-semibold">{titulo}</h2>
        </div>

        {clases.length === 0 && (
          <p className="px-5 pb-4 pt-3 text-sm text-slate-500">
            Este cuatrimestre no tiene clases en el horario.
          </p>
        )}

        {/* Rejilla semanal (a partir de sm) */}
        <div className="hidden overflow-x-auto px-4 pb-4 pt-3 sm:block">
          <div className="min-w-[34rem]">
            <div className="grid border-b border-slate-800 pb-1.5" style={columnas}>
              <div />
              {DIAS.map((d) => (
                <div key={d.key} className="px-1 text-xs font-medium text-slate-400">
                  {d.label}
                </div>
              ))}
            </div>

            <div className="grid pt-1" style={columnas}>
              <div className="grid" style={rejilla}>
                {horas.map((h) => (
                  <div
                    key={h}
                    style={{ gridRow: `${filasDe(h, inicio)} / span ${60 / PASO}` }}
                    className="-translate-y-1.5 pr-2 text-right text-[10px] tabular-nums text-slate-400"
                  >
                    {aTexto(h)}
                  </div>
                ))}
              </div>

              {DIAS.map((d) => (
                <div
                  key={d.key}
                  role="list"
                  aria-label={d.label}
                  className="grid border-l border-slate-800/60"
                  style={{ ...rejilla, ...lineasDeHora }}
                >
                  {clasesDe(clases, d.key).map((c, i) => (
                    <Clase key={i} c={c} inicio={inicio} />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Agenda por días (móvil) */}
        <div className="px-5 pb-4 pt-3 sm:hidden">
          {agenda.map((d) => (
            <div key={d.key} className="mb-3 last:mb-0">
              <p className="mb-1.5 text-xs font-semibold text-slate-400">{d.label}</p>
              <ul className="space-y-1.5">
                {d.clases.map((c, i) => (
                  <li key={i} className="flex items-start gap-2.5">
                    <span className="w-[5.5rem] shrink-0 pt-0.5 text-[11px] tabular-nums text-slate-400">
                      {c.hora}
                    </span>
                    <span
                      className="min-w-0 flex-1 rounded-lg px-2 py-1"
                      style={subjectStyle(c.subject)}
                    >
                      <span className="block text-[11px] font-semibold leading-tight">{c.subject}</span>
                      <span className="block text-[10px] leading-tight opacity-80">{queEs(c)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {sinHorario?.length > 0 && (
          <div className="border-t border-slate-800 px-5 py-3 text-xs text-slate-500">
            {sinHorario.map((s, i) => (
              <div key={i} className="flex items-center gap-2 py-0.5">
                <span className={`rounded-md px-2 py-0.5 font-medium`} style={subjectStyle(s.subject)}>{s.subject}</span>
                <span>· {s.nota} (sin franja fija en el horario de aula)</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    );
  };

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

      {/* Horario: teoría y prácticas de tu subgrupo */}
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
              <span className={`rounded-md px-2 py-0.5 text-xs font-medium`} style={subjectStyle(e.subject)}>
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
                </div>

                {abierta && (
                  <ul className="space-y-1.5 border-t border-slate-800 px-4 py-3">
                    {grupo.tareas.map((t) => (
                      <li key={t.id} className="flex flex-wrap items-center gap-2 text-sm">
                        <span className={`shrink-0 rounded px-1.5 py-0.5 text-[11px] font-medium ${ESTADO_AULA[t.estado].clase}`}>
                          {ESTADO_AULA[t.estado].texto}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-slate-200">{t.titulo}</span>
                        <span className="shrink-0 text-xs text-slate-500">
                          {t.entrega ? new Date(t.entrega).toLocaleDateString("es-ES") : "sin plazo"}
                        </span>
                        {/*
                          Ya no hay botón de "+ poner". Estas tareas SON las
                          tuyas: salen solas en el calendario y en Inicio, y su
                          estado lo manda la UMU. Copiarlas a una lista aparte
                          era trabajo doble y se desajustaba en cuanto cambiaba
                          una fecha allí.
                        */}
                        <a
                          href={t.url}
                          target="_blank"
                          rel="noreferrer"
                          className="shrink-0 rounded-lg border border-slate-700 px-2 py-0.5 text-xs text-slate-300 transition hover:border-indigo-500 hover:text-indigo-300"
                        >
                          Abrir
                        </a>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/*
        A lo ancho, no en dos columnas. La rejilla de dos venía de cuando aquí
        convivían la lista de tareas y las horas; al quitarse la lista, las
        sesiones se quedaban en media pantalla y el gráfico semanal apretaba
        siete barras en la mitad del espacio que tiene disponible.
      */}
      <div className="space-y-6">
        {/* Sesiones de estudio: los ratos que te reservas tú */}
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Clock size={18} className="text-amber-400" /> Sesiones de estudio
            </h2>
            <span className="rounded-full bg-amber-500/15 px-3 py-1 text-sm font-semibold text-amber-300">
              {fmtHoras(totalStudy)} en total
            </span>
          </div>
          <p className="mb-4 text-xs text-slate-500">
            Un rato que te reservas: día, de qué hora a qué hora y de qué asignatura. Sale en el
            calendario y en Inicio, y las horas se suman solas.
          </p>

          {/* Apuntar una sesión */}
          <div className="mb-5 space-y-2 rounded-xl border border-slate-800 bg-slate-800/30 p-3">
            <div className="flex flex-wrap gap-2">
              <select
                value={sesion.asignatura}
                onChange={(e) => setSesion({ ...sesion, asignatura: e.target.value })}
                aria-label="Asignatura de la sesión"
                className="min-w-0 flex-1 rounded-lg border border-slate-700 bg-slate-800 px-2 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {/*
                  Solo las que se cursan: una convalidada no se estudia, así que
                  ofrecerla aquí solo invita a apuntar horas que no existen.
                */}
                {enCurso.map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
              <input
                type="date"
                value={sesion.fecha}
                onChange={(e) => setSesion({ ...sesion, fecha: e.target.value })}
                aria-label="Día de la sesión"
                className="min-w-0 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="time"
                value={sesion.desde}
                onChange={(e) => setSesion({ ...sesion, desde: e.target.value })}
                aria-label="Hora de inicio"
                className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <span className="text-xs text-slate-500">a</span>
              <input
                type="time"
                value={sesion.hasta}
                onChange={(e) => setSesion({ ...sesion, hasta: e.target.value })}
                aria-label="Hora de fin"
                className="w-28 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              {/*
                La duración se ve ANTES de guardar. Así un "de 18:00 a 6:00" se
                nota al momento: sale 0 h en vez de apuntar doce en silencio.
              */}
              <span
                className={`text-xs font-semibold tabular-nums ${
                  duracionSesion > 0 ? "text-amber-400" : "text-slate-600"
                }`}
              >
                {duracionSesion > 0 ? fmtHoras(duracionSesion) : "—"}
              </span>
              <button
                onClick={añadirSesion}
                disabled={duracionSesion <= 0}
                className="ml-auto rounded-lg bg-indigo-500 px-3 py-2 text-white transition hover:bg-indigo-400 disabled:opacity-40"
                aria-label="Añadir sesión de estudio"
                title={duracionSesion > 0 ? "" : "Pon una hora de inicio y otra de fin"}
              >
                <Plus size={16} aria-hidden="true" />
              </button>
            </div>
            <input
              placeholder="Qué vas a hacer (opcional)"
              value={sesion.nota}
              onChange={(e) => setSesion({ ...sesion, nota: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && añadirSesion()}
              aria-label="Qué vas a hacer (opcional)"
              className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          {/* Cuánto has estudiado, por día o por mes */}
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h3 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <BarChart3 size={13} aria-hidden="true" /> Cuánto has estudiado
            </h3>
            <div className="flex items-center gap-1">
              {[
                { id: "semana", texto: "Semana" },
                { id: "mes", texto: "Meses" },
              ].map((p) => (
                <button
                  key={p.id}
                  onClick={() => setPeriodo(p.id)}
                  aria-pressed={periodo === p.id}
                  className={`rounded-lg px-2.5 py-1 text-xs font-medium transition ${
                    periodo === p.id ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
                  }`}
                >
                  {p.texto}
                </button>
              ))}
            </div>
          </div>

          {/* Solo la vista semanal se puede recorrer: los meses ya salen los
              últimos seis de una vez. */}
          {periodo === "semana" && (
            <div className="mb-2 flex items-center justify-between gap-2 text-xs text-slate-400">
              <button
                onClick={() => setSemanasAtras(semanasAtras + 1)}
                aria-label="Semana anterior"
                className="rounded-lg bg-slate-800 px-2 py-1 transition hover:bg-slate-700"
              >
                ‹
              </button>
              <span className="tabular-nums">
                {semanasAtras === 0
                  ? "Esta semana"
                  : `Semana del ${new Date(lunesVisible + "T00:00:00").toLocaleDateString("es-ES", {
                      day: "numeric",
                      month: "short",
                    })}`}
              </span>
              <button
                onClick={() => setSemanasAtras(Math.max(0, semanasAtras - 1))}
                disabled={semanasAtras === 0}
                aria-label="Semana siguiente"
                className="rounded-lg bg-slate-800 px-2 py-1 transition hover:bg-slate-700 disabled:opacity-30"
              >
                ›
              </button>
            </div>
          )}

          <BarrasVerticales datos={barras} colorDe={colorDeAsignatura} formato={fmtHoras} />

          {/*
            Leyenda. Con más de una serie es obligatoria: sin ella la identidad
            de cada trozo dependería solo del color, y quien no distinga dos
            tonos se queda sin poder leer el gráfico.
          */}
          {seriesVisibles.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1.5">
              {seriesVisibles.map((s) => (
                <span key={s} className="flex items-center gap-1.5 text-[11px] text-slate-400">
                  <span
                    aria-hidden="true"
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ background: colorDeAsignatura(s) }}
                  />
                  {s}
                </span>
              ))}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-4 border-t border-slate-800 pt-3 text-xs text-slate-400">
            <span>
              Total <strong className="text-slate-100">{fmtHoras(resumenPeriodo.total)}</strong>
            </span>
            <span>
              Media {periodo === "semana" ? "por día" : "por mes"}{" "}
              <strong className="text-slate-100">{fmtHoras(resumenPeriodo.media)}</strong>
            </span>
            {resumenPeriodo.mejor && (
              <span>
                Mejor{" "}
                <strong className="text-slate-100">
                  {resumenPeriodo.mejor.etiqueta} ({fmtHoras(resumenPeriodo.mejor.horas)})
                </strong>
              </span>
            )}
          </div>

          {/* Últimas sesiones */}
          {sesionesRecientes.length > 0 && (
            <div className="mt-5">
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">
                Últimas sesiones
              </h3>
              <ul className="space-y-1.5">
                {sesionesRecientes.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-xs"
                  >
                    <span className="w-14 shrink-0 tabular-nums text-slate-400">
                      {new Date(s.fecha + "T00:00:00").toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                      })}
                    </span>
                    <span className="w-24 shrink-0 tabular-nums text-slate-500">
                      {s.desde && s.hasta ? `${s.desde}–${s.hasta}` : fmtHoras(s.horas)}
                    </span>
                    <span className={`shrink-0 rounded px-1.5 py-0.5 font-medium`} style={subjectStyle(s.subject)}>
                      {s.subject}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-slate-400">{s.nota || ""}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-amber-400">
                      {fmtHoras(s.horas)}
                    </span>
                    <button
                      onClick={() => removeWithUndo(studyLog, setStudyLog, s.id, "Sesión")}
                      aria-label={`Borrar la sesión de ${s.subject}`}
                      className="shrink-0 text-slate-600 transition hover:text-rose-400"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>

        {/* Por asignatura y convalidaciones */}
        <Card>
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <BarChart3 size={18} className="text-amber-400" /> Por asignatura
          </h2>

          {totalStudy > 0 && (
            <div className="mb-5">
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

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {SUBJECTS.map((s) => {
              const convalidada = !!convalidadas[s];
              return (
                <div
                  key={s}
                  className={`flex items-center justify-between gap-2 rounded-xl border border-slate-800 px-3 py-2 ${
                    convalidada ? "bg-slate-800/20" : "bg-slate-800/40"
                  }`}
                >
                  <span className={`min-w-0 truncate rounded-md px-2 py-0.5 text-xs font-medium`} style={subjectStyle(s)}>
                    {s}
                  </span>

                  {convalidada ? (
                    /*
                      Una convalidada no se cursa: no lleva horas, no sale en los
                      gráficos y no se ofrece al apuntar sesiones. Lo único que
                      hay que saber de ella es si ya te la han dado.
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
                      <span className="text-sm font-semibold tabular-nums text-slate-100">
                        {fmtHoras(porAsignatura[s] || 0)}
                      </span>
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
