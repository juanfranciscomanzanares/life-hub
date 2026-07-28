import { useState, useMemo } from "react";
import { Plus, Trash2, Copy, Dumbbell } from "lucide-react";
import { removeWithUndo } from "../../lib/toast";
import { Card } from "../../lib/ui";
import {
  EJERCICIOS,
  GRUPOS,
  grupoDe,
  nuevoId,
  nuevaSerie,
  setsDe,
  volumen,
  mejorSerie,
} from "../../lib/gym";

/*
  Registro de un día: sus ejercicios y, dentro de cada uno, sus series.
  Cada serie tiene SU peso y SUS repeticiones, que es lo que faltaba antes.
*/
export default function Sesion({ fecha, setFecha, filas, setFilas }) {
  const [anadiendo, setAnadiendo] = useState(false);
  const [grupoAbierto, setGrupoAbierto] = useState(GRUPOS[0]);

  const delDia = useMemo(
    () => filas.filter((f) => f.fecha === fecha).map((f) => ({ ...f, sets: setsDe(f) })),
    [filas, fecha]
  );

  const volumenDia = useMemo(() => delDia.reduce((t, f) => t + volumen(f.sets), 0), [delDia]);
  const seriesDia = useMemo(() => delDia.reduce((t, f) => t + f.sets.length, 0), [delDia]);

  // Escribe una fila ya normalizada (con sets), respetando el resto.
  const guardarFila = (id, cambios) =>
    setFilas(filas.map((f) => (f.id === id ? { ...f, sets: setsDe(f), ...cambios } : f)));

  const anadirEjercicio = (nombre) => {
    // Si ya hiciste ese ejercicio otro día, arrancamos con los pesos de la
    // última vez: es lo que normalmente quieres repetir o superar.
    const anterior = filas
      .filter((f) => f.ejercicio === nombre && f.fecha < fecha)
      .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))[0];

    const sets = anterior
      ? setsDe(anterior).map((s) => nuevaSerie(s.peso, s.reps))
      : [nuevaSerie(0, 10)];

    setFilas([{ id: nuevoId(), fecha, ejercicio: nombre, nota: "", sets }, ...filas]);
    setAnadiendo(false);
  };

  const anadirSerie = (fila) => {
    const ultima = fila.sets[fila.sets.length - 1];
    guardarFila(fila.id, {
      sets: [...fila.sets, nuevaSerie(ultima?.peso ?? 0, ultima?.reps ?? 10)],
    });
  };

  const quitarSerie = (fila, serieId) =>
    guardarFila(fila.id, { sets: fila.sets.filter((s) => s.id !== serieId) });

  const cambiarSerie = (fila, serieId, campo, valor) =>
    guardarFila(fila.id, {
      sets: fila.sets.map((s) =>
        s.id === serieId ? { ...s, [campo]: Math.max(0, Number(valor) || 0) } : s
      ),
    });

  const celda =
    "w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-center text-sm text-slate-100 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <Card className="mb-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <label htmlFor="sesion-fecha" className="mb-1 block text-xs text-slate-400">
              Día
            </label>
            <input
              id="sesion-fecha"
              name="sesion-fecha"
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-xs text-slate-500">Series</p>
              <p className="text-lg font-bold text-slate-100">{seriesDia}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Volumen</p>
              <p className="text-lg font-bold text-emerald-400">
                {volumenDia.toLocaleString("es-ES")} kg
              </p>
            </div>
          </div>
        </div>
      </Card>

      {delDia.length === 0 && !anadiendo && (
        <Card className="mb-4 py-10 text-center text-sm text-slate-500">
          Nada registrado este día. Añade un ejercicio o empieza una rutina.
        </Card>
      )}

      <div className="mb-4 space-y-3">
        {delDia.map((fila) => {
          const mejor = mejorSerie(fila.sets);
          return (
            <Card key={fila.id} className="p-0">
              <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold text-slate-100">{fila.ejercicio}</p>
                  <p className="text-xs text-slate-500">
                    {grupoDe(fila.ejercicio)} · {fila.sets.length}{" "}
                    {fila.sets.length === 1 ? "serie" : "series"} ·{" "}
                    {volumen(fila.sets).toLocaleString("es-ES")} kg
                    {mejor && mejor.peso > 0 && ` · mejor ${mejor.peso}kg x${mejor.reps}`}
                  </p>
                </div>
                <button
                  onClick={() => removeWithUndo(filas, setFilas, fila.id, "Ejercicio")}
                  aria-label={`Borrar ${fila.ejercicio}`}
                  className="p-1 text-slate-500 transition hover:text-rose-400"
                >
                  <Trash2 size={16} />
                </button>
              </div>

              <div className="px-5 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="w-12 pb-2 text-left font-medium">Serie</th>
                      <th className="pb-2 font-medium">Peso (kg)</th>
                      <th className="pb-2 font-medium">Reps</th>
                      <th className="w-10 pb-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {fila.sets.map((s, i) => (
                      <tr key={s.id}>
                        <td className="py-1 text-slate-400">{i + 1}</td>
                        <td className="px-1 py-1">
                          <label className="sr-only" htmlFor={`peso-${s.id}`}>
                            Peso de la serie {i + 1} de {fila.ejercicio}
                          </label>
                          <input
                            id={`peso-${s.id}`}
                            name={`peso-${s.id}`}
                            type="number"
                            min="0"
                            step="0.5"
                            inputMode="decimal"
                            value={s.peso}
                            onChange={(e) => cambiarSerie(fila, s.id, "peso", e.target.value)}
                            className={celda}
                          />
                        </td>
                        <td className="px-1 py-1">
                          <label className="sr-only" htmlFor={`reps-${s.id}`}>
                            Repeticiones de la serie {i + 1} de {fila.ejercicio}
                          </label>
                          <input
                            id={`reps-${s.id}`}
                            name={`reps-${s.id}`}
                            type="number"
                            min="0"
                            inputMode="numeric"
                            value={s.reps}
                            onChange={(e) => cambiarSerie(fila, s.id, "reps", e.target.value)}
                            className={celda}
                          />
                        </td>
                        <td className="py-1 text-right">
                          <button
                            onClick={() => quitarSerie(fila, s.id)}
                            aria-label={`Quitar serie ${i + 1}`}
                            className="p-1 text-slate-600 transition hover:text-rose-400"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <button
                  onClick={() => anadirSerie(fila)}
                  className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2 text-xs font-medium text-slate-400 transition hover:border-indigo-500 hover:text-indigo-400"
                >
                  <Plus size={14} /> Añadir serie
                  {fila.sets.length > 0 && <Copy size={12} className="opacity-60" />}
                </button>

                <label className="sr-only" htmlFor={`nota-${fila.id}`}>
                  Nota de {fila.ejercicio}
                </label>
                <input
                  id={`nota-${fila.id}`}
                  name={`nota-${fila.id}`}
                  value={fila.nota || ""}
                  onChange={(e) => guardarFila(fila.id, { nota: e.target.value })}
                  placeholder="Nota (sensaciones, técnica, objetivo...)"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </Card>
          );
        })}
      </div>

      {anadiendo ? (
        <Card>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {GRUPOS.map((g) => (
              <button
                key={g}
                onClick={() => setGrupoAbierto(g)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  grupoAbierto === g
                    ? "bg-indigo-500 text-white"
                    : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {EJERCICIOS[grupoAbierto].map((nombre) => (
              <button
                key={nombre}
                onClick={() => anadirEjercicio(nombre)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-indigo-500"
              >
                + {nombre}
              </button>
            ))}
          </div>
          <button
            onClick={() => setAnadiendo(false)}
            className="mt-4 w-full text-xs text-slate-500 underline"
          >
            Cancelar
          </button>
        </Card>
      ) : (
        <button
          onClick={() => setAnadiendo(true)}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          <Dumbbell size={16} /> Añadir ejercicio
        </button>
      )}
    </div>
  );
}
