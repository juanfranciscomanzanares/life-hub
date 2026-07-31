import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Clock, TrendingUp, Briefcase, BarChart3, BookOpen, Sprout, Building2, Laptop, Car } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, todayISO } from "../lib/ui";
import { removeWithUndo } from "../lib/toast";
import { claveMes, etiquetaMes, ultimosMeses } from "../lib/meses";
import { nuevoId } from "../lib/id";
import {
  horasPorDiaDeLaSemana,
  redondear,
  fmtHoras,
  fmtKm,
  repartoModalidad,
  diasEnOficina,
  kmTotales,
  filtrarMes,
} from "../lib/trabajo";

/*
  Sin tipos de actividad: antes cada registro había que clasificarlo
  (Ingeniería de Datos, Reuniones...) y solo servía para pintar un reparto que
  no aportaba nada. Los registros antiguos conservan su campo `categoria`, pero
  ya no se lee ni se pide.
*/
const INITIAL_WORK = [];
const INITIAL_RUNBOOKS = [];

function Trabajo() {
  const [log, setLog] = usePersisted("lh_work_log", INITIAL_WORK);
  const [runbooks, setRunbooks] = usePersisted("lh_runbooks", INITIAL_RUNBOOKS);
  /*
    Distancia habitual de un día de oficina, ida y vuelta. Se guarda aparte
    del registro porque casi nunca cambia: así apuntar un día presencial es
    solo pulsar "Oficina", sin volver a escribir los mismos kilómetros.
  */
  const [kmTrayecto, setKmTrayecto] = usePersisted("lh_trabajo_km_trayecto", 0);
  // La última modalidad usada se recuerda: se encadenan días del mismo tipo.
  const [modalidad, setModalidad] = usePersisted("lh_trabajo_modalidad", "oficina");
  const [form, setForm] = useState({ fecha: "", actividad: "", horas: "", km: "" });
  const [rbForm, setRbForm] = useState({ titulo: "", pasos: "", herramientas: "" });
  const [showRb, setShowRb] = useState(false);
  const [crono, setCrono] = useState(null);
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!crono) return;
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [crono]);

  // Campos de presencialidad de un registro nuevo (los km solo si es oficina).
  const datosModalidad = () => {
    const km = Number(form.km);
    return {
      modalidad,
      ...(modalidad === "oficina" && Number.isFinite(km) && km > 0 ? { km } : {}),
    };
  };

  const toggleCrono = () => {
    if (!crono) { setCrono(Date.now()); return; }
    const horas = Math.max(0.01, Math.round(((Date.now() - crono) / 3600000) * 100) / 100);
    setLog([{ id: nuevoId(), fecha: todayISO(), actividad: form.actividad || "Sesión cronometrada", horas, ...datosModalidad() }, ...log]);
    setCrono(null);
    setForm({ ...form, actividad: "", km: "" });
  };
  const cronoTxt = crono ? new Date(Date.now() - crono).toISOString().slice(11, 19) : "00:00:00";

  const analytics = useMemo(() => {
    const months = ultimosMeses(6);
    const byMonth = Object.fromEntries(months.map((m) => [m, 0]));
    log.forEach((e) => {
      const k = claveMes(e.fecha);
      if (k in byMonth) byMonth[k] += Number(e.horas) || 0;
    });
    const series = months.map((m) => ({ key: m, label: etiquetaMes(m), horas: byMonth[m] }));
    const currentKey = months[months.length - 1];
    const prevKey = months[months.length - 2];
    const current = byMonth[currentKey] || 0;
    const prev = byMonth[prevKey] || 0;
    const diffPct = prev > 0 ? Math.round(((current - prev) / prev) * 100) : null;

    const currentCount = log.filter((e) => claveMes(e.fecha) === currentKey).length;
    const maxBar = Math.max(...series.map((s) => s.horas), 1);
    return { series, current: redondear(current), prev: redondear(prev), diffPct, currentCount, currentKey, maxBar };
  }, [log]);

  // Reparto de la semana en curso: sustituye al viejo reparto por tipo de tarea.
  const semana = useMemo(() => horasPorDiaDeLaSemana(log, todayISO()), [log]);
  const totalSemana = redondear(semana.reduce((a, d) => a + d.horas, 0));
  const maxDia = Math.max(...semana.map((d) => d.horas), 1);

  // Presencialidad y kilómetros del mes en curso, y km acumulados del año.
  const presencia = useMemo(() => {
    const delMes = filtrarMes(log, analytics.currentKey);
    const oficinaMes = diasEnOficina(delMes, kmTrayecto);
    const anio = analytics.currentKey.slice(0, 4);
    const delAnio = log.filter((e) => (e?.fecha || "").slice(0, 4) === anio);
    return {
      reparto: repartoModalidad(delMes),
      diasOficina: oficinaMes.length,
      kmMes: kmTotales(delMes, kmTrayecto),
      kmAnio: kmTotales(delAnio, kmTrayecto),
      anio,
    };
  }, [log, kmTrayecto, analytics.currentKey]);

  const addEntry = () => {
    if (!form.actividad || !form.horas) return;
    setLog([
      {
        id: nuevoId(),
        fecha: form.fecha || todayISO(),
        actividad: form.actividad,
        horas: Number(form.horas) || 0,
        ...datosModalidad(),
      },
      ...log,
    ]);
    setForm({ fecha: "", actividad: "", horas: "", km: "" });
  };

  const addRunbook = () => {
    if (!rbForm.titulo.trim()) return;
    setRunbooks([{ id: nuevoId(), ...rbForm }, ...runbooks]);
    setRbForm({ titulo: "", pasos: "", herramientas: "" });
    setShowRb(false);
  };

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Sprout} title="Trabajo · Agrosana" subtitle="Prácticas de Ingeniería y Ciencia de Datos" />

      {/* KPIs del mes */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400">
            <Clock size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{fmtHoras(analytics.current)}</p>
            <p className="text-sm text-slate-400">Este mes ({etiquetaMes(analytics.currentKey)})</p>
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
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400">
            <Car size={24} />
          </div>
          <div>
            <p className="text-2xl font-bold tabular-nums text-slate-100">{fmtKm(presencia.kmMes)}</p>
            <p className="text-sm text-slate-400">
              {presencia.diasOficina} {presencia.diasOficina === 1 ? "día" : "días"} en oficina
            </p>
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

      {/* Presencialidad y kilómetros */}
      <Card className="mb-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Building2 size={18} className="text-sky-400" /> Oficina y teletrabajo ({etiquetaMes(analytics.currentKey)})
          </h2>
          <span className="rounded-full bg-sky-500/15 px-3 py-1 text-sm font-semibold tabular-nums text-sky-300">
            {fmtKm(presencia.kmAnio)} en {presencia.anio}
          </span>
        </div>

        {presencia.reparto.pctOficina === null ? (
          <p className="py-4 text-center text-sm text-slate-500">
            Sin jornadas clasificadas este mes. Al apuntar tiempo, marca si fue en la oficina o desde casa.
          </p>
        ) : (
          <>
            {/* Barra de reparto: la proporción se lee de un vistazo */}
            <div
              role="img"
              aria-label={`Presencialidad del mes: ${fmtHoras(presencia.reparto.oficina)} en oficina y ${fmtHoras(
                presencia.reparto.teletrabajo
              )} en teletrabajo.`}
              className="mb-3 flex h-3 w-full overflow-hidden rounded-full bg-slate-800"
            >
              <div className="lh-barra h-full bg-sky-500" style={{ width: `${presencia.reparto.pctOficina}%` }} />
              <div className="lh-barra h-full bg-violet-500" style={{ width: `${100 - presencia.reparto.pctOficina}%` }} />
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center gap-2">
                <Building2 size={16} className="shrink-0 text-sky-400" />
                <span className="text-slate-300">Oficina</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-100">
                  {fmtHoras(presencia.reparto.oficina)}
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                  {presencia.reparto.pctOficina}%
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Laptop size={16} className="shrink-0 text-violet-400" />
                <span className="text-slate-300">Teletrabajo</span>
                <span className="ml-auto font-semibold tabular-nums text-slate-100">
                  {fmtHoras(presencia.reparto.teletrabajo)}
                </span>
                <span className="w-10 text-right text-xs tabular-nums text-slate-500">
                  {100 - presencia.reparto.pctOficina}%
                </span>
              </div>
            </div>
            {presencia.reparto.sinIndicar > 0 && (
              <p className="mt-3 text-xs text-slate-500">
                {fmtHoras(presencia.reparto.sinIndicar)} de este mes son anteriores a este campo y no cuentan
                en el reparto ni en los kilómetros.
              </p>
            )}
          </>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 p-3">
          <label htmlFor="km-trayecto" className="flex items-center gap-2 text-sm text-slate-300">
            <Car size={16} className="text-sky-400" /> Distancia de un día en oficina
          </label>
          <input
            id="km-trayecto"
            type="number"
            min="0"
            step="0.5"
            inputMode="decimal"
            value={kmTrayecto || ""}
            onChange={(e) => setKmTrayecto(Math.max(0, Number(e.target.value) || 0))}
            placeholder="0"
            className={`w-24 ${inputCls}`}
          />
          <span className="text-sm text-slate-400">km (ida y vuelta)</span>
          <span className="text-xs text-slate-500">
            Se aplica a cada día presencial, no a cada actividad. Puedes cambiarlo en un día suelto al apuntarlo.
          </span>
        </div>
      </Card>

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

        {/* Modalidad: se recuerda entre registros, así que lo normal es no tocarla */}
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Modalidad de la jornada" className="flex overflow-hidden rounded-lg border border-slate-700">
            <button
              onClick={() => setModalidad("oficina")}
              aria-pressed={modalidad === "oficina"}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                modalidad === "oficina" ? "bg-sky-500 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Building2 size={16} /> Oficina
            </button>
            <button
              onClick={() => setModalidad("teletrabajo")}
              aria-pressed={modalidad === "teletrabajo"}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium transition ${
                modalidad === "teletrabajo" ? "bg-violet-500 text-white" : "bg-slate-800 text-slate-400 hover:text-slate-200"
              }`}
            >
              <Laptop size={16} /> Teletrabajo
            </button>
          </div>

          {modalidad === "oficina" && (
            <div className="flex items-center gap-2">
              <input
                type="number"
                min="0"
                step="0.5"
                inputMode="decimal"
                placeholder={kmTrayecto ? String(kmTrayecto) : "km"}
                value={form.km}
                onChange={(e) => setForm({ ...form, km: e.target.value })}
                aria-label="Kilómetros de este día, si no son los habituales"
                className={`w-24 ${inputCls}`}
              />
              <span className="text-xs text-slate-500">
                {kmTrayecto
                  ? `km solo si hoy no fueron los ${fmtKm(kmTrayecto)} de siempre`
                  : "km del trayecto (configura arriba los habituales)"}
              </span>
            </div>
          )}
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
              <th className="px-5 py-3 font-medium">Dónde</th>
              <th className="px-5 py-3 text-right font-medium">Horas</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {log.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                  Sin horas apuntadas todavía. Añade una actividad arriba o usa el cronómetro.
                </td>
              </tr>
            )}
            {log.map((e) => (
              <tr key={e.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-400">{e.fecha}</td>
                <td className="px-5 py-3 font-medium text-slate-100">{e.actividad}</td>
                {/* Editable: los registros antiguos no tienen modalidad y así se
                    pueden clasificar a posteriori sin borrarlos y volver a crearlos. */}
                <td className="px-5 py-3">
                  <select
                    value={e.modalidad || ""}
                    onChange={(ev) =>
                      setLog(log.map((x) => (x.id === e.id ? { ...x, modalidad: ev.target.value || undefined } : x)))
                    }
                    aria-label={`Modalidad de ${e.actividad}`}
                    className={`rounded-md bg-slate-800 px-2 py-1 text-xs focus:outline-none ${
                      e.modalidad === "oficina"
                        ? "text-sky-300"
                        : e.modalidad === "teletrabajo"
                        ? "text-violet-300"
                        : "text-slate-500"
                    }`}
                  >
                    <option value="">Sin indicar</option>
                    <option value="oficina">Oficina</option>
                    <option value="teletrabajo">Teletrabajo</option>
                  </select>
                  {e.modalidad === "oficina" && e.km > 0 && (
                    <span className="ml-2 text-xs tabular-nums text-slate-500">{fmtKm(e.km)}</span>
                  )}
                </td>
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

export default Trabajo;
