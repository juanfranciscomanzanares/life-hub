import { useState, useMemo } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Plus, Trash2, Repeat } from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { Card, SectionTitle, MONTHS, todayISO } from "../lib/ui";
import { CURSO, eventosDelCalendario, queHayEl, esLectivo } from "../lib/uni";

import { nuevoId } from "../lib/id";
// Fondo del día según el calendario académico. Suave a propósito: es contexto,
// no un evento, y no debe competir con lo que haya escrito en la casilla.
const FONDO_ACADEMICO = {
  clases: "bg-slate-800/30",
  examenes: "bg-amber-500/10",
  festivo: "bg-rose-500/10",
  vacaciones: "bg-emerald-500/10",
};

const ETIQUETA_ACADEMICA = {
  examenes: "exámenes",
  festivo: "festivo",
  vacaciones: "vacaciones",
};

const WEEKDAYS = ["L", "M", "X", "J", "V", "S", "D"];
const WEEKDAYS_FULL = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const TYPE_STYLE = {
  Gym: "bg-emerald-500/20 text-emerald-300",
  Tenis: "bg-amber-500/20 text-amber-300",
  Universidad: "bg-sky-500/20 text-sky-300",
  // Color propio, distinto del de las clases: una clase es una franja fija de
  // la semana y una tarea es algo que vence ese día. Mezclarlas de color hacía
  // que el plazo pasara desapercibido entre el horario.
  Tarea: "bg-violet-500/20 text-violet-300",
  Trabajo: "bg-indigo-500/20 text-indigo-300",
  Finanzas: "bg-rose-500/20 text-rose-300",
  "Inversión": "bg-teal-500/20 text-teal-300",
  Evento: "bg-fuchsia-500/20 text-fuchsia-300",
  Otro: "bg-slate-600/40 text-slate-300",
};

const ROUTINE_TYPES = ["Gym", "Tenis", "Universidad", "Trabajo", "Otro"];

/*
  Vacío a propósito. Esta rutina ("Clases", "Gym (piernas)", "Agrosana"...) era
  de ejemplo y se guardaba como real: salía en el widget de Inicio como si
  fuera tu horario. El tuyo lo pone el botón de cargar el curso, o lo añades a
  mano aquí abajo.
*/
const INITIAL_ROUTINE = [];


// --- Horario y exámenes UM · GCID 26/27 (1er cuatrimestre) ---
// Mejor lectura de los PDF oficiales; revisa y ajusta si algo no cuadra.
// dia: 0=Lunes ... 4=Viernes
const UM_ROUTINE = [
  // Fundamentos de Computadores (1º)
  { dia: 1, hora: "10:00", titulo: "Fund. Computadores (teoría)", tipo: "Universidad" },
  { dia: 2, hora: "12:00", titulo: "Fund. Computadores (prácticas)", tipo: "Universidad" },
  // Deep Learning (3º)
  { dia: 0, hora: "16:30", titulo: "Deep Learning (teoría)", tipo: "Universidad" },
  { dia: 2, hora: "18:30", titulo: "Deep Learning (lab)", tipo: "Universidad" },
  // Infraestructura Comp. Altas Prestaciones (3º)
  { dia: 0, hora: "18:30", titulo: "Infra. Altas Prestaciones (teoría)", tipo: "Universidad" },
  { dia: 1, hora: "18:30", titulo: "Infra. Altas Prestaciones (lab)", tipo: "Universidad" },
  // Empresa y Emprendimiento (4º)
  { dia: 0, hora: "15:00", titulo: "Empresa y Emprendimiento (teoría)", tipo: "Universidad" },
  { dia: 0, hora: "17:00", titulo: "Empresa y Emprendimiento (prácticas)", tipo: "Universidad" },
  // Ciberseguridad (4º)
  { dia: 2, hora: "15:00", titulo: "Ciberseguridad (teoría)", tipo: "Universidad" },
  { dia: 2, hora: "17:00", titulo: "Ciberseguridad (prácticas)", tipo: "Universidad" },
  // Gestión de Proyectos en Ing. de Datos (4º)
  { dia: 1, hora: "17:00", titulo: "Gestión de Proyectos (teoría)", tipo: "Universidad" },
  { dia: 2, hora: "19:00", titulo: "Gestión de Proyectos (prácticas)", tipo: "Universidad" },
];
/*
  Fechas de examen por asignatura.

  OJO: tres de estas seis caen FUERA de las convocatorias oficiales del
  calendario académico (Convocatoria I: 14–16 de diciembre y 8–16 de enero):
  el 17 y el 21 de diciembre y el 7 de enero. Salieron de una lectura a ojo de
  los PDF de horarios, no de la resolución oficial. Se dejan porque son la
  única referencia que hay, pero hay que contrastarlas con la web de la
  Facultad antes de fiarse; por eso el aviso también sale en pantalla.
*/
const UM_EXAMS = [
  { fecha: "2026-12-17", titulo: "Examen: Empresa y Emprendimiento (mañana)" },
  { fecha: "2026-12-21", titulo: "Examen: Deep Learning (tarde)" },
  { fecha: "2027-01-07", titulo: "Examen: Ciberseguridad (mañana)" },
  { fecha: "2027-01-11", titulo: "Examen: Fundamentos de Computadores (tarde)" },
  { fecha: "2027-01-14", titulo: "Examen: Gestión de Proyectos (mañana)" },
  { fecha: "2027-01-15", titulo: "Examen: Infra. Altas Prestaciones (tarde)" },
];

export default function Calendario() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth());
  const [events, setEvents] = usePersisted("lh_events", []);
  const [routine, setRoutine] = usePersisted("lh_routine", INITIAL_ROUTINE);
  const [form, setForm] = useState({ fecha: "", titulo: "" });
  const [rForm, setRForm] = useState({ dia: 0, hora: "18:00", titulo: "", tipo: "Gym" });

  const [gym] = usePersisted("lh_gym", []);
  const [work] = usePersisted("lh_work_log", []);
  const [finance] = usePersisted("lh_finance", []);
  const [contribs] = usePersisted("lh_contribs", []);
  const [uniTasks] = usePersisted("lh_uni_tasks", []);

  // Eventos con fecha concreta
  const byDate = useMemo(() => {
    const map = {};
    const push = (fecha, tipo, label) => {
      if (!fecha) return;
      // Las tareas del Aula Virtual guardan la entrega con hora ("...T23:59"),
      // así que se recorta al día o no casaría con ninguna casilla.
      (map[String(fecha).slice(0, 10)] = map[String(fecha).slice(0, 10)] || []).push({ tipo, label });
    };
    gym.forEach((g) => push(g.fecha, "Gym", g.ejercicio));
    work.forEach((w) => push(w.fecha, "Trabajo", `${w.actividad} (${w.horas}h)`));
    finance.forEach((f) => push(f.fecha, "Finanzas", `${f.concepto} ${f.monto > 0 ? "+" : ""}${f.monto}€`));
    contribs.forEach((c) => push(c.fecha, "Inversión", `${c.destino} +${c.monto}€`));
    events.forEach((e) => push(e.fecha, "Evento", e.titulo));

    /*
      Las tareas de Universidad que tienen fecha. Es el motivo de poder ponerles
      fecha y hora: que se vean aquí y no haya que acordarse de mirar la lista.

      Las ya hechas no se pintan: el calendario es para lo que queda por hacer, y
      un mes lleno de tareas tachadas tapa lo que sí importa.
    */
    uniTasks.forEach((t) => {
      if (t.done || !t.entrega) return;
      push(t.entrega, "Tarea", t.hora ? `${t.hora} ${t.text}` : t.text);
    });

    return map;
  }, [gym, work, finance, contribs, events, uniTasks]);

  // Rutina indexada por día de la semana (0 = lunes)
  const routineByDay = useMemo(() => {
    const map = {};
    routine.forEach((r) => (map[r.dia] = map[r.dia] || []).push(r));
    Object.values(map).forEach((list) => list.sort((a, b) => a.hora.localeCompare(b.hora)));
    return map;
  }, [routine]);

  /*
    La rutina de UNA fecha concreta.

    La rutina semanal es "todos los martes a las 10:00": no tiene fecha, así
    que el calendario la repetía en todas las semanas del año. Agosto, Navidad,
    Semana Santa y los festivos aparecían con horario de clase, y las
    convocatorias de exámenes también.

    Solo se filtran las entradas de Universidad: el gimnasio, el tenis y el
    trabajo sí siguen todas las semanas, que es lo que uno espera de ellos.

    Ojo: el calendario académico que conoce la app es el de 2026/2027, así que
    fuera de ese curso no se pinta ninguna clase.
  */
  const rutinaDe = (fechaISO, diaSemana) => {
    const items = routineByDay[diaSemana] || [];
    if (esLectivo(fechaISO)) return items;
    return items.filter((r) => r.tipo !== "Universidad");
  };

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstWeekday = (new Date(year, month, 1).getDay() + 6) % 7;
  const cells = [];
  for (let i = 0; i < firstWeekday; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const iso = (d) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  const weekdayOf = (d) => (new Date(year, month, d).getDay() + 6) % 7;
  const isToday = (d) => year === now.getFullYear() && month === now.getMonth() && d === now.getDate();

  const prev = () => { if (month === 0) { setMonth(11); setYear(year - 1); } else setMonth(month - 1); };
  const next = () => { if (month === 11) { setMonth(0); setYear(year + 1); } else setMonth(month + 1); };

  const addEvent = () => {
    if (!form.fecha || !form.titulo.trim()) return;
    setEvents([...events, { id: nuevoId(), fecha: form.fecha, titulo: form.titulo }]);
    setForm({ fecha: "", titulo: "" });
  };
  const addRoutine = () => {
    if (!rForm.titulo.trim()) return;
    setRoutine([...routine, { id: nuevoId(), dia: Number(rForm.dia), hora: rForm.hora, titulo: rForm.titulo, tipo: rForm.tipo }]);
    setRForm({ dia: 0, hora: "18:00", titulo: "", tipo: "Gym" });
  };

  /*
    Vuelca el curso entero: clases semanales, exámenes y el calendario
    académico oficial (cuatrimestres, convocatorias, festivos y vacaciones).

    Se puede pulsar las veces que haga falta: lo que ya está no se duplica,
    porque se compara por fecha + título.
  */
  const cargarUM = () => {
    const rKey = (x) => `${x.dia}-${x.hora}-${x.titulo}`;
    const exist = new Set(routine.map(rKey));
    const nuevas = UM_ROUTINE.filter((x) => !exist.has(rKey(x))).map((x) => ({ id: nuevoId(), ...x }));
    if (nuevas.length) setRoutine([...routine, ...nuevas]);

    const eKey = (x) => `${x.fecha}-${x.titulo}`;
    const evExist = new Set(events.map(eKey));
    const porMeter = [...UM_EXAMS, ...eventosDelCalendario()].filter((x) => !evExist.has(eKey(x)));
    // Sin deduplicar entre sí, un título repetido en dos sitios entraría dos veces.
    const vistos = new Set();
    const nuevosEv = porMeter
      .filter((x) => !vistos.has(eKey(x)) && vistos.add(eKey(x)))
      .map((x) => ({ id: nuevoId(), ...x }));
    if (nuevosEv.length) setEvents([...events, ...nuevosEv]);

    alert(
      `Cargado: ${nuevas.length} clases y ${nuevosEv.length} fechas del curso ${CURSO} ` +
        `(exámenes, cuatrimestres, convocatorias, festivos y vacaciones).\n\n` +
        `Aviso: tres de las fechas de examen (17 y 21 de diciembre, 7 de enero) caen fuera de las ` +
        `convocatorias oficiales. Contrástalas con la web de la Facultad.`
    );
  };

  const lunesSem = new Date(now);
  lunesSem.setDate(now.getDate() - ((now.getDay() + 6) % 7));
  const semana = [...Array(7)].map((_, i) => {
    const d = new Date(lunesSem);
    d.setDate(lunesSem.getDate() + i);
    const isoD = todayISO(d);
    const rout = rutinaDe(isoD, i).map((r) => ({ hora: r.hora, tipo: r.tipo, label: r.titulo }));
    const ev = (byDate[isoD] || []).map((e) => ({ hora: "", tipo: e.tipo, label: e.label }));
    return { fecha: isoD, dia: d.getDate(), nombre: WEEKDAYS_FULL[i], esHoy: isoD === todayISO(now), items: [...rout, ...ev].sort((a, b) => (a.hora || "99").localeCompare(b.hora || "99")) };
  });

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={CalendarDays} title="Calendario" subtitle="Tu rutina semanal y todo tu mes en un vistazo" />

      {/* Editor de rutina semanal */}
      <Card className="mb-6">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Repeat size={18} className="text-indigo-400" /> Rutina semanal fija
        </h2>
        <div className="mb-4 flex flex-wrap items-end gap-2">
          <select value={rForm.dia} onChange={(e) => setRForm({ ...rForm, dia: e.target.value })} className={inputCls}>
            {WEEKDAYS_FULL.map((d, i) => <option key={i} value={i}>{d}</option>)}
          </select>
          <input type="time" value={rForm.hora} onChange={(e) => setRForm({ ...rForm, hora: e.target.value })} className={inputCls} />
          <input placeholder="Actividad (Gym piernas, clases...)" value={rForm.titulo} onChange={(e) => setRForm({ ...rForm, titulo: e.target.value })} className={`flex-1 ${inputCls}`} />
          <select value={rForm.tipo} onChange={(e) => setRForm({ ...rForm, tipo: e.target.value })} className={inputCls}>
            {ROUTINE_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <button onClick={addRoutine} className="flex items-center gap-1 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"><Plus size={15} /> Añadir</button>
        </div>

        <div className="mb-4">
          <button onClick={cargarUM} className="rounded-lg border border-sky-700/60 bg-sky-500/10 px-4 py-2 text-sm font-semibold text-sky-200 transition hover:bg-sky-500/20">
            Cargar curso UM {CURSO} (horario, exámenes y calendario académico)
          </button>
          <p className="mt-2 text-xs text-slate-500">
            Mete las clases semanales, las fechas de examen y el calendario oficial de la Facultad de
            Informática: cuatrimestres, convocatorias, festivos y vacaciones. Se puede pulsar varias
            veces sin duplicar nada.
          </p>
        </div>

        {/* Esta rejilla es la rutina en bruto: aquí sí se ven todas las
            entradas, incluidas las clases, porque es donde se editan. */}
        <p className="mb-2 text-xs text-slate-500">
          Las actividades de <b>Universidad</b> solo se pintan en el calendario los días lectivos del
          curso {CURSO}: en agosto, Navidad, Semana Santa, festivos y periodos de exámenes no
          aparecen. El resto (gimnasio, tenis, trabajo) se repite todas las semanas.
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {WEEKDAYS_FULL.map((dname, i) => (
            <div key={i} className="rounded-xl border border-slate-800 bg-slate-800/30 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-400">{dname}</p>
              <div className="space-y-1.5">
                {(routineByDay[i] || []).length === 0 && <p className="text-xs text-slate-600">—</p>}
                {(routineByDay[i] || []).map((r) => (
                  <div key={r.id} className={`flex items-center justify-between gap-1 rounded px-2 py-1 text-xs ${TYPE_STYLE[r.tipo] || TYPE_STYLE.Otro}`}>
                    <span className="truncate"><span className="font-semibold">{r.hora}</span> {r.titulo}</span>
                    <button onClick={() => removeWithUndo(routine, setRoutine, r.id, "Actividad")} className="shrink-0 opacity-70 hover:opacity-100"><Trash2 size={12} /></button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>


      {/* Evento puntual */}
      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-2">
          <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} />
          <input placeholder="Evento puntual (examen, cita, viaje...)" value={form.titulo} onChange={(e) => setForm({ ...form, titulo: e.target.value })} className={`flex-1 ${inputCls}`} />
          <button onClick={addEvent} className="flex items-center gap-1 rounded-lg bg-fuchsia-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-fuchsia-400"><Plus size={15} /> Añadir</button>
        </div>
      </Card>

      {/* Vista de la semana actual */}
      <Card className="mb-6">
        <h2 className="mb-4 text-lg font-semibold text-slate-100">Esta semana</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {semana.map((d) => (
            <div key={d.fecha} className={`rounded-xl border p-2 ${d.esHoy ? "border-indigo-500 bg-indigo-500/10" : "border-slate-800 bg-slate-800/30"}`}>
              <p className="mb-2 text-xs font-semibold text-slate-400">{d.nombre} {d.dia}</p>
              <div className="space-y-1">
                {d.items.length === 0 && <p className="text-[10px] text-slate-600">—</p>}
                {d.items.map((it, j) => (
                  <div key={j} className={`truncate rounded px-1.5 py-0.5 text-[10px] ${TYPE_STYLE[it.tipo] || TYPE_STYLE.Otro}`} title={`${it.hora} ${it.label}`}>
                    {it.hora && <span className="font-semibold">{it.hora} </span>}{it.label}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Calendario mensual */}
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <button onClick={prev} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"><ChevronLeft size={18} /></button>
          <h2 className="text-lg font-semibold text-slate-100">{MONTHS[month]} {year}</h2>
          <button onClick={next} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"><ChevronRight size={18} /></button>
        </div>

        <div className="grid grid-cols-7 gap-1.5">
          {WEEKDAYS.map((d) => <div key={d} className="pb-1 text-center text-xs font-semibold text-slate-500">{d}</div>)}
          {cells.map((d, i) => {
            if (d === null) return <div key={`e${i}`} />;
            const oneoff = byDate[iso(d)] || [];
            const rout = rutinaDe(iso(d), weekdayOf(d)).map((r) => ({ tipo: r.tipo, label: `${r.hora} ${r.titulo}` }));
            const list = [...rout, ...oneoff];
            /*
              El calendario académico se pinta como fondo del día, no como un
              evento más: si no, "1er cuatrimestre" ocuparía una línea en cada
              una de las 65 casillas y taparía lo que de verdad pasa ese día.
            */
            const academico = queHayEl(iso(d));
            return (
              <div
                key={d}
                title={academico ? academico.titulo : undefined}
                className={`min-h-[92px] rounded-lg border p-1.5 ${
                  isToday(d)
                    ? "border-indigo-500 bg-indigo-500/10"
                    : `border-slate-800 ${FONDO_ACADEMICO[academico?.tipo] || "bg-slate-800/30"}`
                }`}
              >
                <div className="mb-1 flex items-center justify-between gap-1">
                  {academico && academico.tipo !== "clases" && (
                    <span className="truncate text-[9px] uppercase tracking-wide text-slate-500">
                      {ETIQUETA_ACADEMICA[academico.tipo]}
                    </span>
                  )}
                  <span className="ml-auto text-xs font-medium text-slate-400">{d}</span>
                </div>
                <div className="space-y-1">
                  {list.slice(0, 4).map((ev, j) => (
                    <div key={j} title={`${ev.tipo}: ${ev.label}`} className={`truncate rounded px-1 py-0.5 text-[10px] ${TYPE_STYLE[ev.tipo] || TYPE_STYLE.Otro}`}>{ev.label}</div>
                  ))}
                  {list.length > 4 && <div className="text-[10px] text-slate-500">+{list.length - 4} más</div>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex flex-wrap gap-3 text-xs">
          {Object.keys(TYPE_STYLE).map((t) => (
            <span key={t} className="flex items-center gap-1.5 text-slate-400">
              <span className={`h-2.5 w-2.5 rounded-full ${TYPE_STYLE[t].split(" ")[0]}`} /> {t}
            </span>
          ))}
        </div>
      </Card>

      {events.length > 0 && (
        <Card className="mt-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-300">Eventos puntuales</h3>
          <ul className="space-y-2">
            {events.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((e) => (
              <li key={e.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className="text-slate-200"><span className="text-slate-500">{e.fecha}</span> · {e.titulo}</span>
                <button onClick={() => removeWithUndo(events, setEvents, e.id, "Evento")} className="text-slate-500 hover:text-rose-400"><Trash2 size={15} /></button>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
