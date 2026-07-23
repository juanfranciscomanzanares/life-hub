import { useState, useMemo } from "react";
import { Dumbbell, Plus, Trash2, TrendingUp } from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { Card, SectionTitle } from "../lib/ui";

const EXERCISES = {
  Pecho: ["Press banca", "Press inclinado", "Press declinado", "Press mancuernas", "Aperturas", "Aperturas en polea", "Fondos en paralelas", "Pullover", "Press máquina"],
  Espalda: ["Dominadas", "Jalón al pecho", "Jalón tras nuca", "Remo con barra", "Remo con mancuerna", "Remo en polea", "Remo en máquina", "Pullover en polea", "Peso muerto", "Hiperextensiones"],
  Piernas: ["Sentadilla", "Sentadilla frontal", "Prensa de piernas", "Zancadas", "Peso muerto rumano", "Hip thrust", "Extensión de cuádriceps", "Curl femoral", "Elevación de gemelos", "Sentadilla búlgara", "Sentadilla hack"],
  Hombro: ["Press militar", "Press Arnold", "Elevaciones laterales", "Elevaciones frontales", "Pájaros (deltoide posterior)", "Face pull", "Encogimientos (trapecio)", "Press tras nuca"],
  Bíceps: ["Curl con barra", "Curl con mancuernas", "Curl martillo", "Curl predicador", "Curl concentrado", "Curl en polea", "Curl araña"],
  Tríceps: ["Press francés", "Extensión en polea", "Extensión sobre cabeza", "Patada de tríceps", "Fondos en banco", "Press cerrado"],
  Core: ["Plancha", "Crunch", "Elevación de piernas", "Rueda abdominal", "Russian twist", "Mountain climbers", "Plancha lateral", "Encogimientos en colgado"],
  Cardio: ["Cinta (correr)", "Bicicleta estática", "Elíptica", "Remo (máquina)", "Salto a la comba", "Escaladora", "HIIT"],
};

const INITIAL_GYM = [
  { id: 1, fecha: "2026-07-20", ejercicio: "Press banca", peso: 70, series: 4, reps: 8, nota: "Buena técnica, subir 2,5kg" },
  { id: 2, fecha: "2026-07-20", ejercicio: "Sentadilla", peso: 90, series: 5, reps: 5, nota: "" },
  { id: 3, fecha: "2026-07-13", ejercicio: "Press banca", peso: 67.5, series: 4, reps: 8, nota: "" },
  { id: 4, fecha: "2026-07-06", ejercicio: "Press banca", peso: 65, series: 4, reps: 8, nota: "" },
  { id: 5, fecha: "2026-07-18", ejercicio: "Peso muerto", peso: 110, series: 3, reps: 6, nota: "" },
];

const TEMPLATES = {
  "Push (empuje)": [
    { ejercicio: "Press banca", series: 4, reps: 8 },
    { ejercicio: "Press militar", series: 4, reps: 10 },
    { ejercicio: "Fondos en paralelas", series: 3, reps: 10 },
    { ejercicio: "Extensión en polea", series: 3, reps: 12 },
  ],
  "Pull (tirón)": [
    { ejercicio: "Dominadas", series: 4, reps: 8 },
    { ejercicio: "Remo con barra", series: 4, reps: 10 },
    { ejercicio: "Jalón al pecho", series: 3, reps: 12 },
    { ejercicio: "Curl con barra", series: 3, reps: 12 },
  ],
  "Legs (piernas)": [
    { ejercicio: "Sentadilla", series: 5, reps: 5 },
    { ejercicio: "Peso muerto rumano", series: 4, reps: 8 },
    { ejercicio: "Prensa de piernas", series: 3, reps: 12 },
    { ejercicio: "Elevación de gemelos", series: 4, reps: 15 },
  ],
};

const empty = { fecha: "", ejercicio: "", peso: "", series: "", reps: "", nota: "" };

export default function Gimnasio() {
  const [rows, setRows] = usePersisted("lh_gym", INITIAL_GYM);
  const [form, setForm] = useState(empty);
  const [showForm, setShowForm] = useState(false);
  const [progEjercicio, setProgEjercicio] = useState("");
  const [verMax, setVerMax] = useState(15);
  const [orden, setOrden] = useState({ campo: "fecha", dir: "desc" });
  const rowsSorted = useMemo(() => {
    const arr = [...rows];
    const { campo, dir } = orden;
    arr.sort((a, b) => {
      let x = a[campo], y = b[campo];
      if (campo === "peso" || campo === "series" || campo === "reps") { x = Number(x) || 0; y = Number(y) || 0; return x - y; }
      return String(x || "").localeCompare(String(y || ""));
    });
    if (dir === "desc") arr.reverse();
    return arr;
  }, [rows, orden]);
  const sortBy = (campo) => setOrden((o) => ({ campo, dir: o.campo === campo && o.dir === "asc" ? "desc" : "asc" }));
  const updateRow = (id, campo, valor) => setRows(rows.map((r) => (r.id === id ? { ...r, [campo]: ["peso", "series", "reps"].includes(campo) ? Number(valor) || 0 : valor } : r)));

  const ejerciciosUsados = useMemo(() => [...new Set(rows.map((r) => r.ejercicio))], [rows]);
  const seleccionado = progEjercicio || ejerciciosUsados[0] || "";

  const serie = useMemo(
    () =>
      rows
        .filter((r) => r.ejercicio === seleccionado)
        .slice()
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    [rows, seleccionado]
  );
  const maxPeso = Math.max(...serie.map((s) => s.peso), 1);

  // Récords personales: mejor peso y 1RM estimado (Epley) por ejercicio
  const records = useMemo(() => {
    const m = {};
    rows.forEach((r) => {
      const oneRM = (Number(r.peso) || 0) * (1 + (Number(r.reps) || 0) / 30);
      if (!m[r.ejercicio] || (Number(r.peso) || 0) > m[r.ejercicio].peso) m[r.ejercicio] = { peso: Number(r.peso) || 0, oneRM };
      else if (oneRM > m[r.ejercicio].oneRM) m[r.ejercicio].oneRM = oneRM;
    });
    return Object.entries(m).filter(([, v]) => v.peso > 0).sort((a, b) => b[1].peso - a[1].peso);
  }, [rows]);

  const volumenUltimo = useMemo(() => {
    if (!rows.length) return 0;
    const ultima = rows.map((r) => r.fecha).sort().slice(-1)[0];
    return rows.filter((r) => r.fecha === ultima).reduce((a, b) => a + (Number(b.peso) || 0) * (Number(b.series) || 0) * (Number(b.reps) || 0), 0);
  }, [rows]);

  const addRow = () => {
    if (!form.ejercicio) return;
    setRows([
      {
        id: Date.now(),
        fecha: form.fecha || new Date().toISOString().slice(0, 10),
        ejercicio: form.ejercicio,
        peso: Number(form.peso) || 0,
        series: Number(form.series) || 0,
        reps: Number(form.reps) || 0,
        nota: form.nota || "",
      },
      ...rows,
    ]);
    setForm(empty);
    setShowForm(false);
  };

  const aplicarPlantilla = (nombre) => {
    const hoy = new Date().toISOString().slice(0, 10);
    const nuevas = TEMPLATES[nombre].map((ej, i) => ({ id: Date.now() + i, fecha: hoy, peso: 0, nota: "", ...ej }));
    setRows([...nuevas, ...rows]);
  };

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Dumbbell} title="Gimnasio" subtitle="Registra y sigue tu progreso físico" />

      <div className="mb-4 flex justify-end">
        <button onClick={() => setShowForm((s) => !s)} className="flex items-center gap-2 rounded-xl bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">
          <Plus size={16} /> Añadir nueva marca
        </button>
      </div>

      {showForm && (
        <Card className="mb-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <input type="date" value={form.fecha} onChange={(e) => setForm({ ...form, fecha: e.target.value })} className={inputCls} />
            <input list="lista-ejercicios" placeholder="Ejercicio (escribe o elige)" value={form.ejercicio} onChange={(e) => setForm({ ...form, ejercicio: e.target.value })} className={inputCls} />
            <datalist id="lista-ejercicios">
              {Object.entries(EXERCISES).map(([grupo, lista]) => lista.map((ej) => <option key={ej} value={ej}>{`${ej} · ${grupo}`}</option>))}
            </datalist>
            <input type="number" placeholder="Peso (kg)" value={form.peso} onChange={(e) => setForm({ ...form, peso: e.target.value })} className={inputCls} />
            <input type="number" placeholder="Series" value={form.series} onChange={(e) => setForm({ ...form, series: e.target.value })} className={inputCls} />
            <input type="number" placeholder="Reps" value={form.reps} onChange={(e) => setForm({ ...form, reps: e.target.value })} className={inputCls} />
          </div>
          <input placeholder="Nota (sensaciones, técnica, próximo objetivo...)" value={form.nota} onChange={(e) => setForm({ ...form, nota: e.target.value })} className={`mt-3 ${inputCls}`} />
          <div className="mt-3 flex justify-end">
            <button onClick={addRow} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400">Guardar marca</button>
          </div>
        </Card>
      )}

      {/* Plantillas de entrenamiento */}
      <Card className="mb-4">
        <h2 className="mb-3 text-sm font-semibold text-slate-300">Plantillas rápidas (añaden varios ejercicios de golpe)</h2>
        <div className="flex flex-wrap gap-2">
          {Object.keys(TEMPLATES).map((t) => (
            <button key={t} onClick={() => aplicarPlantilla(t)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-200 transition hover:border-indigo-500 hover:bg-slate-700">
              + {t}
            </button>
          ))}
        </div>
      </Card>

      {/* Progreso por ejercicio */}
      {ejerciciosUsados.length > 0 && (
        <Card className="mb-4">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <TrendingUp size={18} className="text-emerald-400" /> Progreso de peso
            </h2>
            <select value={seleccionado} onChange={(e) => setProgEjercicio(e.target.value)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none">
              {ejerciciosUsados.map((ej) => <option key={ej}>{ej}</option>)}
            </select>
          </div>
          {serie.length < 2 ? (
            <p className="py-6 text-center text-sm text-slate-500">Registra este ejercicio al menos dos veces para ver la evolución.</p>
          ) : (
            <div className="flex h-40 items-end justify-between gap-2">
              {serie.map((s) => (
                <div key={s.id} className="flex flex-1 flex-col items-center gap-2">
                  <span className="text-[10px] font-medium text-slate-400">{s.peso}kg</span>
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full rounded-t-lg bg-gradient-to-t from-emerald-600 to-emerald-400" style={{ height: `${20 + (s.peso / maxPeso) * 80}%` }} title={`${s.fecha}: ${s.peso}kg`} />
                  </div>
                  <span className="text-[10px] text-slate-500">{s.fecha.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </Card>

      )}

      {/* Récords personales */}
      {records.length > 0 && (
        <Card className="mb-4 overflow-x-auto p-0">
          <div className="flex items-center justify-between px-5 pt-4">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">🏆 Récords personales</h2>
            <span className="text-xs text-slate-400">Volumen última sesión: <b className="text-slate-200">{volumenUltimo.toLocaleString("es-ES")} kg</b></span>
          </div>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-5 py-3 font-medium">Ejercicio</th>
                <th className="px-5 py-3 text-right font-medium">PR (kg)</th>
                <th className="px-5 py-3 text-right font-medium">1RM estimado</th>
              </tr>
            </thead>
            <tbody>
              {records.map(([ej, v]) => (
                <tr key={ej} className="border-b border-slate-800/60">
                  <td className="px-5 py-2.5 font-medium text-slate-100">{ej}</td>
                  <td className="px-5 py-2.5 text-right text-emerald-400">{v.peso} kg</td>
                  <td className="px-5 py-2.5 text-right text-slate-300">{Math.round(v.oneRM)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}

      {/* Tabla de marcas */}
      <Card className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              {[["fecha", "Fecha"], ["ejercicio", "Ejercicio"], ["peso", "Peso (kg)"], ["series", "Series"], ["reps", "Reps"]].map(([c, l]) => (
                <th key={c} onClick={() => sortBy(c)} className="cursor-pointer select-none px-5 py-3 font-medium hover:text-slate-200">
                  {l}{orden.campo === c ? (orden.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="px-5 py-3 font-medium">Nota</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rowsSorted.slice(0, verMax).map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-3 py-2 text-slate-400"><input type="date" value={r.fecha} onChange={(e) => updateRow(r.id, "fecha", e.target.value)} className="w-32 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2 font-medium text-slate-100"><input value={r.ejercicio} onChange={(e) => updateRow(r.id, "ejercicio", e.target.value)} className="w-36 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2 text-slate-300"><input type="number" value={r.peso} onChange={(e) => updateRow(r.id, "peso", e.target.value)} className="w-16 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2 text-slate-300"><input type="number" value={r.series} onChange={(e) => updateRow(r.id, "series", e.target.value)} className="w-14 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2 text-slate-300"><input type="number" value={r.reps} onChange={(e) => updateRow(r.id, "reps", e.target.value)} className="w-14 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2 text-slate-400"><input value={r.nota || ""} placeholder="—" onChange={(e) => updateRow(r.id, "nota", e.target.value)} className="w-40 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-5 py-3 text-right">
                  <button onClick={() => removeWithUndo(rows, setRows, r.id, "Marca")} className="text-slate-500 transition hover:text-rose-400"><Trash2 size={16} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > verMax && (
          <div className="border-t border-slate-800 p-3 text-center">
            <button onClick={() => setVerMax((n) => n + 15)} className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
              Ver más ({rows.length - verMax} restantes)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
