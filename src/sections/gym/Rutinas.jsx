import { useState } from "react";
import { Plus, Trash2, Play, ListChecks, ChevronDown, ChevronRight } from "lucide-react";
import { usePersisted } from "../../lib/store";
import { removeWithUndo } from "../../lib/toast";
import { Card } from "../../lib/ui";
import { EJERCICIOS, GRUPOS, grupoDe, nuevoId } from "../../lib/gym";

/*
  Rutinas propias: le pones nombre y eliges los ejercicios, con series y
  repeticiones objetivo. Al empezarla, esos objetivos se vuelcan como series
  vacías en el registro del día para que solo tengas que rellenar los pesos.
*/
export default function Rutinas({ onEmpezar }) {
  const [rutinas, setRutinas] = usePersisted("lh_gym_rutinas", []);
  const [editando, setEditando] = useState(null); // id de la rutina abierta
  const [nombreNueva, setNombreNueva] = useState("");
  const [grupoAbierto, setGrupoAbierto] = useState(GRUPOS[0]);

  const crear = () => {
    const nombre = nombreNueva.trim();
    if (!nombre) return;
    const rutina = { id: nuevoId(), nombre, ejercicios: [] };
    setRutinas([rutina, ...rutinas]);
    setNombreNueva("");
    setEditando(rutina.id);
  };

  const actualizar = (id, cambios) =>
    setRutinas(rutinas.map((r) => (r.id === id ? { ...r, ...cambios } : r)));

  const anadirEjercicio = (rutina, nombre) => {
    if (rutina.ejercicios.some((e) => e.nombre === nombre)) return; // ya está
    actualizar(rutina.id, {
      ejercicios: [
        ...rutina.ejercicios,
        { id: nuevoId(), nombre, grupo: grupoDe(nombre), series: 4, reps: 10 },
      ],
    });
  };

  const quitarEjercicio = (rutina, ejercicioId) =>
    actualizar(rutina.id, { ejercicios: rutina.ejercicios.filter((e) => e.id !== ejercicioId) });

  const cambiarObjetivo = (rutina, ejercicioId, campo, valor) =>
    actualizar(rutina.id, {
      ejercicios: rutina.ejercicios.map((e) =>
        e.id === ejercicioId ? { ...e, [campo]: Math.max(0, Number(valor) || 0) } : e
      ),
    });

  const campo =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <Card className="mb-4">
        <label htmlFor="rutina-nueva" className="mb-2 block text-sm font-semibold text-slate-300">
          Crear una rutina
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="rutina-nueva"
            name="rutina-nueva"
            value={nombreNueva}
            onChange={(e) => setNombreNueva(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && crear()}
            placeholder="Nombre (Push, Pierna, Torso...)"
            className={`flex-1 ${campo}`}
          />
          <button
            onClick={crear}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            <Plus size={16} /> Crear
          </button>
        </div>
      </Card>

      {rutinas.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">
          Aún no tienes rutinas. Crea una arriba y añádele ejercicios.
        </Card>
      ) : (
        <div className="space-y-3">
          {rutinas.map((rutina) => {
            const abierta = editando === rutina.id;
            return (
              <Card key={rutina.id} className="p-0">
                <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                  <button
                    onClick={() => setEditando(abierta ? null : rutina.id)}
                    aria-expanded={abierta}
                    className="flex flex-1 items-center gap-2 text-left"
                  >
                    {abierta ? <ChevronDown size={18} className="text-slate-400" /> : <ChevronRight size={18} className="text-slate-400" />}
                    <span className="font-semibold text-slate-100">{rutina.nombre}</span>
                    <span className="text-xs text-slate-500">
                      {rutina.ejercicios.length} {rutina.ejercicios.length === 1 ? "ejercicio" : "ejercicios"}
                    </span>
                  </button>

                  <button
                    onClick={() => onEmpezar(rutina)}
                    disabled={rutina.ejercicios.length === 0}
                    className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-40"
                  >
                    <Play size={15} /> Empezar
                  </button>
                  <button
                    onClick={() => removeWithUndo(rutinas, setRutinas, rutina.id, "Rutina")}
                    aria-label={`Borrar rutina ${rutina.nombre}`}
                    className="p-1 text-slate-500 transition hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>

                {abierta && (
                  <div className="border-t border-slate-800 px-5 py-4">
                    {rutina.ejercicios.length > 0 && (
                      <div className="mb-5 space-y-2">
                        {rutina.ejercicios.map((ej) => (
                          <div key={ej.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-800/60 px-3 py-2">
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-slate-100">{ej.nombre}</p>
                              <p className="text-xs text-slate-500">{ej.grupo}</p>
                            </div>
                            <label className="text-xs text-slate-400">
                              <span className="sr-only">Series objetivo de {ej.nombre}</span>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={ej.series}
                                onChange={(e) => cambiarObjetivo(rutina, ej.id, "series", e.target.value)}
                                className="w-14 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm text-slate-100"
                              />{" "}
                              series
                            </label>
                            <label className="text-xs text-slate-400">
                              <span className="sr-only">Repeticiones objetivo de {ej.nombre}</span>
                              <input
                                type="number"
                                min="0"
                                inputMode="numeric"
                                value={ej.reps}
                                onChange={(e) => cambiarObjetivo(rutina, ej.id, "reps", e.target.value)}
                                className="w-14 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-center text-sm text-slate-100"
                              />{" "}
                              reps
                            </label>
                            <button
                              onClick={() => quitarEjercicio(rutina, ej.id)}
                              aria-label={`Quitar ${ej.nombre} de la rutina`}
                              className="p-1 text-slate-500 transition hover:text-rose-400"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}

                    <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-slate-300">
                      <ListChecks size={16} /> Añadir ejercicios
                    </p>
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
                      {EJERCICIOS[grupoAbierto].map((nombre) => {
                        const puesto = rutina.ejercicios.some((e) => e.nombre === nombre);
                        return (
                          <button
                            key={nombre}
                            onClick={() => anadirEjercicio(rutina, nombre)}
                            disabled={puesto}
                            className={`rounded-lg border px-3 py-1.5 text-xs transition ${
                              puesto
                                ? "border-emerald-800 bg-emerald-500/10 text-emerald-300"
                                : "border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
                            }`}
                          >
                            {puesto ? "✓ " : "+ "}
                            {nombre}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
