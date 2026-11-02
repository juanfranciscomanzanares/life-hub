import { useState, useMemo } from "react";
import { Play, CalendarPlus, CalendarX, Flag, Gauge, Ruler, Trash2, Plus, ChevronRight } from "lucide-react";
import { usePersisted } from "../../lib/store";
import { removeWithUndo, toast } from "../../lib/toast";
import { Card, Metrica, todayISO } from "../../lib/ui";
import { lunesDe, sumarDias } from "../../lib/fechas";
import { nuevoId } from "../../lib/id";
import { grupoDe, setsDe } from "../../lib/gym";
import { CampoNumero } from "./CampoNumero";
import {
  SEMANAS_PLAN,
  SEMANA_TIPO,
  AVISOS_SEMANA,
  REGLAS,
  GUIAS,
  TESTS,
  SEMANAS_REGISTRO,
  EJERCICIOS_REGISTRO,
  MENSAJE_CINTURA,
  semanaDelPlan,
  dentroDelPlan,
  faseDe,
  objetivoDe,
  sesionesDelDia,
  guiasDelDia,
  rutinasParaGuardar,
  ejerciciosParaGuardar,
  rutinaSemanalParaGuardar,
  eventosParaGuardar,
  registroPorSemana,
  evaluarCintura,
  mediaPesoSemana,
  delPlan,
} from "../../lib/planFisico";

/*
  Pestaña del plan físico de tenis de mesa (12 semanas).

  Enseña en qué semana y fase estás, qué toca hoy, las guías sin peso
  (calentamientos, movilidad, estiramientos) y los tests. Los datos del plan
  están en src/lib/planFisico.js; aquí solo se decide qué pintar y se escribe
  en las claves de siempre al activarlo (ver el comentario de ese archivo).

  `lh_plan_fisico` solo guarda la fecha de inicio. Lo demás se deriva de ella.
*/
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const campo =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

const fechaCorta = (iso) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "";

const medicionVacia = () => ({ fecha: todayISO(), cintura: 0, piernaIzq: 0, piernaDcha: 0, agilidad: 0 });

export default function Plan({ filas, onEmpezar }) {
  const [plan, setPlan] = usePersisted("lh_plan_fisico", {});
  const [rutinas, setRutinas] = usePersisted("lh_gym_rutinas", []);
  const [propios, setPropios] = usePersisted("lh_gym_ejercicios", []);
  const [routine, setRoutine] = usePersisted("lh_routine", []);
  const [events, setEvents] = usePersisted("lh_events", []);
  const [mediciones, setMediciones] = usePersisted("lh_plan_mediciones", []);
  const [salud] = usePersisted("lh_health", []);

  const hoy = todayISO();
  const [inicioNuevo, setInicioNuevo] = useState(() => lunesDe(hoy));

  if (!plan?.inicio) {
    return (
      <Activar
        inicio={inicioNuevo}
        setInicio={setInicioNuevo}
        onActivar={() => {
          const inicio = lunesDe(inicioNuevo) || lunesDe(hoy);
          const catalogo = (n) => grupoDe(n);
          const nuevasRutinas = rutinasParaGuardar(rutinas, catalogo);
          const nuevosEjercicios = ejerciciosParaGuardar(propios, catalogo);
          const nuevaRutinaSemanal = rutinaSemanalParaGuardar(routine);
          const nuevosEventos = eventosParaGuardar(inicio, events);

          setPlan({ inicio });
          if (nuevasRutinas.length) setRutinas([...nuevasRutinas, ...rutinas]);
          if (nuevosEjercicios.length) setPropios([...nuevosEjercicios, ...propios]);
          if (nuevaRutinaSemanal.length) setRoutine([...routine, ...nuevaRutinaSemanal]);
          if (nuevosEventos.length) setEvents([...events, ...nuevosEventos]);
          toast(
            `Plan activado: ${nuevasRutinas.length} rutinas y ${nuevaRutinaSemanal.length} sesiones semanales en el calendario`
          );
        }}
      />
    );
  }

  return (
    <PlanActivo
      plan={plan}
      setPlan={setPlan}
      hoy={hoy}
      filas={filas}
      onEmpezar={onEmpezar}
      rutinas={rutinas}
      routine={routine}
      setRoutine={setRoutine}
      events={events}
      setEvents={setEvents}
      mediciones={mediciones}
      setMediciones={setMediciones}
      salud={salud}
    />
  );
}

function Activar({ inicio, setInicio, onActivar }) {
  return (
    <Card>
      <h2 className="mb-2 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <Flag size={18} className="text-seccion-400" aria-hidden="true" /> Plan físico de tenis de mesa · 12 semanas
      </h2>
      <p className="mb-3 text-sm text-slate-400">
        Perder grasa abdominal sin perder músculo y ganar fuerza de piernas, movilidad, flexibilidad, velocidad y
        coordinación. Al activarlo:
      </p>
      <ul className="mb-4 list-disc space-y-1 pl-5 text-sm text-slate-300">
        <li>Se crean 4 rutinas en Rutinas (pierna, empuje, tirón y velocidad), con la técnica de cada ejercicio.</li>
        <li>
          Las sesiones de la semana tipo entran en la rutina semanal del Calendario (y en "Hoy" de Inicio). Si ya
          tienes algo del mismo tipo a esa hora, no se duplica.
        </li>
        <li>Los tests de cada 4 semanas, los cambios de fase y la descarga entran como eventos.</li>
        <li>Al empezar una rutina del plan, las series se ajustan a la semana en la que estés.</li>
      </ul>
      <div className="flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          <span className="mb-1 block">Primer lunes del plan</span>
          <input
            type="date"
            value={inicio}
            onChange={(e) => setInicio(e.target.value)}
            className={campo}
          />
        </label>
        <button
          onClick={onActivar}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          <CalendarPlus size={16} aria-hidden="true" /> Activar el plan
        </button>
      </div>
      <p className="mt-2 text-2xs text-slate-500">Si eliges otro día, el plan empieza el lunes de esa semana.</p>
    </Card>
  );
}

function PlanActivo({
  plan,
  setPlan,
  hoy,
  filas,
  onEmpezar,
  rutinas,
  routine,
  setRoutine,
  events,
  setEvents,
  mediciones,
  setMediciones,
  salud,
}) {
  const semana = semanaDelPlan(plan.inicio, hoy);
  const enPlan = dentroDelPlan(semana);
  const fase = enPlan ? faseDe(semana) : null;
  const diaHoy = (new Date().getDay() + 6) % 7;
  const fin = sumarDias(plan.inicio, SEMANAS_PLAN * 7 - 1);

  const rutinasPlan = useMemo(() => rutinas.filter(delPlan), [rutinas]);
  const rutinaDe = (clave) => rutinasPlan.find((r) => r.clave === clave);
  const enCalendario = routine.some(delPlan);
  const cintura = useMemo(() => evaluarCintura(mediciones), [mediciones]);

  const quitarDelCalendario = () => {
    const antesR = routine;
    const antesE = events;
    setRoutine(routine.filter((r) => !delPlan(r)));
    setEvents(events.filter((e) => !delPlan(e)));
    toast("Plan quitado del calendario", () => {
      setRoutine(antesR);
      setEvents(antesE);
    });
  };

  const ponerEnCalendario = () => {
    const r = rutinaSemanalParaGuardar(routine);
    const e = eventosParaGuardar(plan.inicio, events);
    if (r.length) setRoutine([...routine, ...r]);
    if (e.length) setEvents([...events, ...e]);
    toast(`${r.length} sesiones y ${e.length} fechas añadidas al calendario`);
  };

  // Mover el inicio mueve también los hitos con fecha; la rutina semanal no
  // tiene fecha y no cambia.
  const cambiarInicio = (nuevo) => {
    const inicio = lunesDe(nuevo);
    if (!inicio || inicio === plan.inicio) return;
    setPlan({ ...plan, inicio });
    if (events.some(delPlan)) {
      const sinHitos = events.filter((e) => !delPlan(e));
      setEvents([...sinHitos, ...eventosParaGuardar(inicio, sinHitos)]);
    }
  };

  const desactivar = () => {
    const antes = { plan, routine, events };
    setRoutine(routine.filter((r) => !delPlan(r)));
    setEvents(events.filter((e) => !delPlan(e)));
    setPlan({});
    toast("Plan desactivado (las rutinas y tus registros se quedan)", () => {
      setPlan(antes.plan);
      setRoutine(antes.routine);
      setEvents(antes.events);
    });
  };

  const estadoSemana = enPlan
    ? `${semana} / ${SEMANAS_PLAN}`
    : semana < 1
      ? "Aún no"
      : "Terminado";
  const detalleSemana = enPlan
    ? `Del ${fechaCorta(plan.inicio)} al ${fechaCorta(fin)}`
    : semana < 1
      ? `Empieza el ${fechaCorta(plan.inicio)}`
      : `Acabó el ${fechaCorta(fin)}`;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Metrica icono={Flag} etiqueta="Semana del plan" valor={estadoSemana} detalle={detalleSemana} />
        <Metrica
          icono={Gauge}
          etiqueta="Fase"
          valor={fase ? fase.nombre : "—"}
          detalle={fase ? fase.cambios : "Fuera de las 12 semanas"}
        />
        <Metrica
          icono={Ruler}
          etiqueta="Cintura"
          valor={cintura.ultima ? `${String(cintura.ultima.cintura).replace(".", ",")} cm` : "—"}
          detalle={MENSAJE_CINTURA[cintura.estado]}
        />
      </div>

      <HoyToca dia={diaHoy} rutinaDe={rutinaDe} onEmpezar={onEmpezar} />

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Rutinas del plan, esta semana</h2>
        {rutinasPlan.length === 0 ? (
          <p className="text-sm text-slate-500">
            Has borrado las rutinas del plan. Desactívalo y vuelve a activarlo para recuperarlas.
          </p>
        ) : (
          <div className="space-y-2">
            {rutinasPlan.map((r) => (
              <RutinaSemana key={r.id} rutina={r} semana={enPlan ? semana : null} onEmpezar={onEmpezar} />
            ))}
          </div>
        )}
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Semana tipo</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-2xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Día</th>
                <th scope="col" className="py-1.5 pr-3 font-semibold">Mañana / mediodía</th>
                <th scope="col" className="py-1.5 font-semibold">Tarde</th>
              </tr>
            </thead>
            <tbody>
              {SEMANA_TIPO.map((d, i) => (
                <tr key={d.dia} className={`border-t border-slate-800 ${i === diaHoy ? "text-slate-100" : "text-slate-400"}`}>
                  <th scope="row" className="py-2 pr-3 font-semibold">{d.dia}</th>
                  <td className="py-2 pr-3">{d.manana}</td>
                  <td className="py-2">{d.tarde}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <ul className="mt-3 space-y-1 text-xs text-slate-500">
          {AVISOS_SEMANA.map((a) => (
            <li key={a}>· {a}</li>
          ))}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Reglas</h2>
        <dl className="grid gap-3 sm:grid-cols-2">
          {REGLAS.map((r) => (
            <div key={r.titulo}>
              <dt className="text-sm font-semibold text-slate-200">{r.titulo}</dt>
              <dd className="text-sm text-slate-400">{r.texto}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Calentamientos, movilidad y estiramientos</h2>
        <div className="space-y-2">
          {Object.keys(GUIAS).map((k) => (
            <Guia key={k} guia={GUIAS[k]} />
          ))}
        </div>
      </Card>

      <Tests
        plan={plan}
        filas={filas}
        mediciones={mediciones}
        setMediciones={setMediciones}
        salud={salud}
      />

      <Card>
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Ajustes del plan</h2>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-slate-400">
            <span className="mb-1 block">Primer lunes</span>
            <input
              type="date"
              value={plan.inicio}
              onChange={(e) => cambiarInicio(e.target.value)}
              className={campo}
            />
          </label>
          {enCalendario ? (
            <button
              onClick={quitarDelCalendario}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:border-indigo-500"
            >
              <CalendarX size={15} aria-hidden="true" /> Quitar del calendario
            </button>
          ) : (
            <button
              onClick={ponerEnCalendario}
              className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:border-indigo-500"
            >
              <CalendarPlus size={15} aria-hidden="true" /> Poner en el calendario
            </button>
          )}
          <button
            onClick={desactivar}
            className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-400 transition hover:border-rose-500 hover:text-rose-400"
          >
            Desactivar el plan
          </button>
        </div>
        <p className="mt-2 text-2xs text-slate-500">
          Las sesiones del calendario se repiten cada semana como el resto de la rutina semanal. Al terminar las 12
          semanas, quítalas aquí o bórralas una a una en el Calendario.
        </p>
      </Card>
    </div>
  );
}

function HoyToca({ dia, rutinaDe, onEmpezar }) {
  const sesiones = sesionesDelDia(dia);
  const guias = guiasDelDia(dia);
  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Hoy toca · {DIAS[dia]}</h2>
      {sesiones.length === 0 ? (
        <p className="mb-3 text-sm text-slate-400">Descanso, o tenis en Lorca. Movilidad suave.</p>
      ) : (
        <ul className="mb-3 space-y-2">
          {sesiones.map((s) => {
            const rutina = s.rutina ? rutinaDe(s.rutina) : null;
            return (
              <li key={s.clave} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2">
                <span className="w-12 text-sm font-semibold tabular-nums text-slate-400">{s.hora || "—"}</span>
                <span className="min-w-0 flex-1 text-sm text-slate-100">{s.titulo}</span>
                {rutina && (
                  <button
                    onClick={() => onEmpezar(rutina)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
                  >
                    <Play size={13} aria-hidden="true" /> Empezar
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      <div className="space-y-2">
        {guias.map((k) => (
          <Guia key={k} guia={GUIAS[k]} />
        ))}
      </div>
    </Card>
  );
}

/*
  <details> nativo y no un acordeón hecho a mano: ya trae teclado, foco y el
  estado abierto/cerrado para los lectores de pantalla.
*/
function Plegable({ titulo, detalle, children }) {
  return (
    <details className="group rounded-lg border border-slate-800 bg-slate-800/30">
      <summary className="flex cursor-pointer list-none items-center gap-2 px-3 py-2.5 text-sm [&::-webkit-details-marker]:hidden">
        <ChevronRight size={16} className="shrink-0 text-slate-500 transition group-open:rotate-90" aria-hidden="true" />
        <span className="font-semibold text-slate-200">{titulo}</span>
        {detalle && <span className="text-xs text-slate-500">{detalle}</span>}
      </summary>
      <div className="border-t border-slate-800 px-3 py-3">{children}</div>
    </details>
  );
}

function Guia({ guia }) {
  return (
    <Plegable titulo={guia.titulo} detalle={guia.duracion}>
      <ol className="space-y-2">
        {guia.pasos.map(([nombre, dosis, como]) => (
          <li key={nombre} className="text-sm">
            <span className="font-medium text-slate-200">{nombre}</span>
            <span className="text-slate-400"> · {dosis}</span>
            {como && <p className="text-xs text-slate-500">{como}</p>}
          </li>
        ))}
      </ol>
      {guia.notas?.map((n) => (
        <p key={n} className="mt-2 text-xs text-slate-400">{n}</p>
      ))}
    </Plegable>
  );
}

function RutinaSemana({ rutina, semana, onEmpezar }) {
  let bloque = null;
  return (
    <Plegable titulo={rutina.nombre.replace(/^Plan · /, "")} detalle={`${rutina.ejercicios.length} ejercicios`}>
      {rutina.nota && <p className="mb-3 text-xs text-slate-400">{rutina.nota}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-2xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-1 pr-3 font-semibold">Ejercicio</th>
              <th scope="col" className="py-1 pr-3 font-semibold">Series × reps</th>
              <th scope="col" className="py-1 pr-3 font-semibold">Descanso</th>
              <th scope="col" className="py-1 font-semibold">RIR</th>
            </tr>
          </thead>
          <tbody>
            {rutina.ejercicios.flatMap((ej) => {
              const o = objetivoDe(ej, semana);
              const filasTabla = [];
              if (ej.bloque && ej.bloque !== bloque) {
                bloque = ej.bloque;
                filasTabla.push(
                  <tr key={`b-${ej.bloque}`}>
                    <th scope="colgroup" colSpan={4} className="pt-3 pb-1 text-2xs font-semibold uppercase tracking-wide text-seccion-400">
                      Bloque {ej.bloque}
                    </th>
                  </tr>
                );
              }
              filasTabla.push(
                <tr key={ej.id} className="border-t border-slate-800 align-top">
                  <td className="py-1.5 pr-3 text-slate-200">{ej.nombre}</td>
                  <td className="py-1.5 pr-3 tabular-nums text-slate-300">
                    {o.texto}
                    {o.nota && <span className="block text-2xs text-amber-300">{o.nota}</span>}
                  </td>
                  <td className="py-1.5 pr-3 text-slate-400">{ej.descanso || "—"}</td>
                  <td className="py-1.5 text-slate-400">{ej.rir || "—"}</td>
                </tr>
              );
              return filasTabla;
            })}
          </tbody>
        </table>
      </div>
      <button
        onClick={() => onEmpezar(rutina)}
        className="mt-3 flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-400"
      >
        <Play size={13} aria-hidden="true" /> Empezar hoy
      </button>
    </Plegable>
  );
}

function Tests({ plan, filas, mediciones, setMediciones, salud }) {
  const [form, setForm] = useState(medicionVacia);
  const registro = useMemo(
    () => registroPorSemana(filas, plan.inicio, { setsDe }),
    [filas, plan.inicio]
  );
  const ordenadas = useMemo(
    () => [...mediciones].sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
    [mediciones]
  );

  const guardar = () => {
    const { fecha, cintura, piernaIzq, piernaDcha, agilidad } = form;
    if (!fecha || !(cintura || piernaIzq || piernaDcha || agilidad)) return;
    setMediciones([{ id: nuevoId(), fecha, cintura, piernaIzq, piernaDcha, agilidad }, ...mediciones]);
    setForm(medicionVacia());
  };

  const num = (v, unidad = "") => (Number(v) > 0 ? `${String(v).replace(".", ",")}${unidad}` : "—");
  const lunesSemana = (s) => sumarDias(plan.inicio, (s - 1) * 7);
  const campoCorto = `${campo} w-20 text-center`;

  return (
    <Card>
      <h2 className="mb-3 text-lg font-semibold text-slate-100">Tests y registro</h2>
      <dl className="mb-4 grid gap-3 sm:grid-cols-3">
        {TESTS.map((t) => (
          <div key={t.titulo}>
            <dt className="text-sm font-semibold text-slate-200">{t.titulo}</dt>
            <dd className="text-xs text-slate-400">{t.texto}</dd>
          </div>
        ))}
      </dl>

      <div className="mb-4 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-400">
          <span className="mb-1 block">Fecha</span>
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={campo} />
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-1 block">Cintura (cm)</span>
          <CampoNumero decimales value={form.cintura} onChange={(v) => setForm({ ...form, cintura: v })} className={campoCorto} />
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-1 block">Pierna recta izq. (°)</span>
          <CampoNumero value={form.piernaIzq} onChange={(v) => setForm({ ...form, piernaIzq: v })} className={campoCorto} />
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-1 block">Pierna recta dcha. (°)</span>
          <CampoNumero value={form.piernaDcha} onChange={(v) => setForm({ ...form, piernaDcha: v })} className={campoCorto} />
        </label>
        <label className="text-xs text-slate-400">
          <span className="mb-1 block">Agilidad (s)</span>
          <CampoNumero decimales value={form.agilidad} onChange={(v) => setForm({ ...form, agilidad: v })} className={campoCorto} />
        </label>
        <button
          onClick={guardar}
          className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          <Plus size={15} aria-hidden="true" /> Apuntar
        </button>
      </div>

      {ordenadas.length === 0 ? (
        <p className="mb-4 text-sm text-slate-500">Aún no hay mediciones. La cintura, una vez por semana; los tests, cada 4.</p>
      ) : (
        <div className="mb-4 overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="text-2xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-1 pr-3 font-semibold">Fecha</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Cintura</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Pierna recta (izq. / dcha.)</th>
                <th scope="col" className="py-1 pr-3 font-semibold">Agilidad</th>
                <th scope="col"><span className="sr-only">Borrar</span></th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((m) => (
                <tr key={m.id} className="border-t border-slate-800 tabular-nums text-slate-300">
                  <td className="py-1.5 pr-3">{fechaCorta(m.fecha)}</td>
                  <td className="py-1.5 pr-3">{num(m.cintura, " cm")}</td>
                  <td className="py-1.5 pr-3">{num(m.piernaIzq, "°")} / {num(m.piernaDcha, "°")}</td>
                  <td className="py-1.5 pr-3">{num(m.agilidad, " s")}</td>
                  <td className="py-1.5 text-right">
                    <button
                      onClick={() => removeWithUndo(mediciones, setMediciones, m.id, "Medición")}
                      aria-label={`Borrar la medición del ${fechaCorta(m.fecha)}`}
                      className="p-1 text-slate-500 transition hover:text-rose-400"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <h3 className="mb-2 text-sm font-semibold text-slate-300">Pesos clave por semana</h3>
      <p className="mb-2 text-xs text-slate-500">
        Se rellena sola con la última serie que apuntes en Sesión esas semanas. El peso es la media semanal de Salud.
      </p>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-2xs uppercase tracking-wide text-slate-500">
              <th scope="col" className="py-1 pr-3 font-semibold">Ejercicio</th>
              {SEMANAS_REGISTRO.map((s) => (
                <th key={s} scope="col" className="py-1 pr-3 font-semibold">Sem {s}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {EJERCICIOS_REGISTRO.map((nombre) => (
              <tr key={nombre} className="border-t border-slate-800 tabular-nums">
                <th scope="row" className="py-1.5 pr-3 font-normal text-slate-300">{nombre}</th>
                {SEMANAS_REGISTRO.map((s) => {
                  const r = registro[nombre][s];
                  return (
                    <td key={s} className="py-1.5 pr-3 text-slate-400">
                      {r ? (r.peso > 0 ? `${String(r.peso).replace(".", ",")} × ${r.reps}` : `${r.reps} reps`) : "—"}
                    </td>
                  );
                })}
              </tr>
            ))}
            <tr className="border-t border-slate-800 tabular-nums">
              <th scope="row" className="py-1.5 pr-3 font-normal text-slate-300">Peso, media semanal</th>
              {SEMANAS_REGISTRO.map((s) => {
                const media = mediaPesoSemana(salud, lunesSemana(s));
                return (
                  <td key={s} className="py-1.5 pr-3 text-slate-400">
                    {media ? `${String(media).replace(".", ",")} kg` : "—"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}

