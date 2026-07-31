import { useState, useCallback } from "react";
import { Plus, X } from "lucide-react";
import { usePersisted } from "./lib/store";
import { todayISO } from "./lib/ui";
import { nuevoId, nuevaSerie } from "./lib/gym";
import { useDialogo } from "./lib/useDialogo";

const TIPOS = ["Gasto", "Gym", "Tarea", "Peso"];

export default function QuickAdd() {
  const [open, setOpen] = useState(false);
  const [tipo, setTipo] = useState("Gasto");
  const [v, setV] = useState({});

  const [finance, setFinance] = usePersisted("lh_finance", []);
  const [gym, setGym] = usePersisted("lh_gym", []);
  const [tasks, setTasks] = usePersisted("lh_tasks", []);
  const [health, setHealth] = usePersisted("lh_health", []);

  // Escape, foco atrapado y foco de vuelta al botón + al cerrar.
  const cerrar = useCallback(() => setOpen(false), []);
  const refDialogo = useDialogo(open, cerrar);

  const inputCls =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  const guardar = () => {
    if (tipo === "Gasto" && v.concepto) {
      setFinance([{ id: nuevoId(), fecha: todayISO(), concepto: v.concepto, categoria: "Ocio", monto: -Math.abs(Number(v.monto) || 0), etiqueta: v.etiqueta || "" }, ...finance]);
    } else if (tipo === "Gym" && v.ejercicio) {
      // Formato nuevo: una entrada por serie, todas iguales al añadir rápido.
      // Luego se afinan una a una desde la sección de Gimnasio.
      const cuantas = Math.max(1, Number(v.series) || 1);
      setGym([
        {
          id: nuevoId(),
          fecha: todayISO(),
          ejercicio: v.ejercicio,
          nota: "",
          sets: Array.from({ length: cuantas }, () => nuevaSerie(v.peso, v.reps)),
        },
        ...gym,
      ]);
    } else if (tipo === "Tarea" && v.text) {
      setTasks([...tasks, { id: nuevoId(), text: v.text, done: false, urgent: true, hour: "", etiqueta: v.etiqueta || "" }]);
    } else if (tipo === "Peso" && v.peso) {
      setHealth([{ id: nuevoId(), fecha: todayISO(), peso: Number(v.peso), sueno: 0, pasos: 0, fc: 0, agua: 0 }, ...health]);
    } else {
      return;
    }
    setV({});
    setOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Añadido rápido"
        aria-haspopup="dialog"
        aria-expanded={open}
        // En movil sube para no quedar debajo de la barra inferior de navegacion.
        className="fixed bottom-20 right-4 z-40 lg:bottom-6 lg:right-6 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-500 text-white shadow-xl transition hover:bg-indigo-400"
      >
        <Plus size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center" onClick={cerrar}>
          {/* Con el teclado abierto el alto útil se queda en nada: sin límite y
              sin scroll propio, el botón de guardar quedaba fuera de la pantalla. */}
          <div
            ref={refDialogo}
            role="dialog"
            aria-modal="true"
            aria-labelledby="qa-titulo"
            className="lh-modal w-full max-w-sm overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="qa-titulo" className="text-lg font-bold text-slate-100">Añadido rápido</h2>
              <button onClick={cerrar} aria-label="Cerrar" className="text-slate-400 hover:text-slate-200"><X size={20} /></button>
            </div>

            <div className="mb-4 flex gap-2">
              {TIPOS.map((t) => (
                <button key={t} onClick={() => { setTipo(t); setV({}); }} aria-pressed={tipo === t} className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-medium transition ${tipo === t ? "bg-indigo-500 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"}`}>
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-2">
              {tipo === "Gasto" && (
                <>
                  <input placeholder="Concepto" className={inputCls} value={v.concepto || ""} onChange={(e) => setV({ ...v, concepto: e.target.value })} />
                  <input type="number" placeholder="Importe €" className={inputCls} value={v.monto || ""} onChange={(e) => setV({ ...v, monto: e.target.value })} />
                  <input placeholder="Etiqueta (opcional)" className={inputCls} value={v.etiqueta || ""} onChange={(e) => setV({ ...v, etiqueta: e.target.value })} />
                </>
              )}
              {tipo === "Gym" && (
                <>
                  <input placeholder="Ejercicio" className={inputCls} value={v.ejercicio || ""} onChange={(e) => setV({ ...v, ejercicio: e.target.value })} />
                  <div className="flex gap-2">
                    <input type="number" placeholder="Peso" className={inputCls} value={v.peso || ""} onChange={(e) => setV({ ...v, peso: e.target.value })} />
                    <input type="number" placeholder="Series" className={inputCls} value={v.series || ""} onChange={(e) => setV({ ...v, series: e.target.value })} />
                    <input type="number" placeholder="Reps" className={inputCls} value={v.reps || ""} onChange={(e) => setV({ ...v, reps: e.target.value })} />
                  </div>
                </>
              )}
              {tipo === "Tarea" && (
                <>
                  <input placeholder="Nueva tarea" className={inputCls} value={v.text || ""} onChange={(e) => setV({ ...v, text: e.target.value })} />
                  <input placeholder="Etiqueta (opcional)" className={inputCls} value={v.etiqueta || ""} onChange={(e) => setV({ ...v, etiqueta: e.target.value })} />
                </>
              )}
              {tipo === "Peso" && (
                <input type="number" step="0.1" placeholder="Peso (kg)" className={inputCls} value={v.peso || ""} onChange={(e) => setV({ ...v, peso: e.target.value })} />
              )}
            </div>

            <button onClick={guardar} className="mt-4 w-full rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-400">
              Guardar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
