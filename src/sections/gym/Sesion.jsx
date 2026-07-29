import { useState, useMemo, useEffect } from "react";
import { Plus, Trash2, Copy, Dumbbell, CheckCircle2, RotateCcw, Timer } from "lucide-react";
import { usePersisted } from "../../lib/store";
import { removeWithUndo, toast } from "../../lib/toast";
import { Card, todayISO } from "../../lib/ui";
import { confeti } from "../../lib/confetti";
import {
  catalogo,
  grupoDe,
  descripcionDe,
  nuevoId,
  nuevaSerie,
  setsDe,
  volumen,
  mejorSerie,
  sesionDe,
  abrirSesion,
  cerrarSesion,
  reabrirSesion,
  duracionMinutos,
  formatearDuracion,
} from "../../lib/gym";

/*
  Registro de un día: sus ejercicios y, dentro de cada uno, sus series.
  Cada serie tiene SU peso y SUS repeticiones, que es lo que faltaba antes.

  La sesión se abre sola al añadir el primer ejercicio y se cierra a mano con
  "Terminar sesión". Una vez terminada, los campos quedan bloqueados: es lo que
  evita tocar sin querer un entreno ya cerrado mientras miras el histórico.
  "Reanudar" los desbloquea.
*/
export default function Sesion({ fecha, setFecha, filas, setFilas, sesiones, setSesiones }) {
  const [propios] = usePersisted("lh_gym_ejercicios", []);
  const [anadiendo, setAnadiendo] = useState(false);

  // Catálogo de serie + los tuyos, en una sola lista.
  const porGrupo = useMemo(() => catalogo(propios), [propios]);
  const grupos = useMemo(() => Object.keys(porGrupo), [porGrupo]);
  const [grupoAbierto, setGrupoAbierto] = useState(grupos[0]);
  const grupoActivo = porGrupo[grupoAbierto] ? grupoAbierto : grupos[0];

  const delDia = useMemo(
    () => filas.filter((f) => f.fecha === fecha).map((f) => ({ ...f, sets: setsDe(f) })),
    [filas, fecha]
  );

  const volumenDia = useMemo(() => delDia.reduce((t, f) => t + volumen(f.sets), 0), [delDia]);
  const seriesDia = useMemo(() => delDia.reduce((t, f) => t + f.sets.length, 0), [delDia]);

  const sesion = sesionDe(sesiones, fecha);
  const terminada = Boolean(sesion?.fin);

  /*
    Reloj de la sesión en marcha. Solo corre si de verdad hay una sesión
    abierta hoy: en un día pasado el cronómetro no significa nada y un
    setInterval permanente redibujaría la pantalla para siempre.
  */
  const enMarcha = Boolean(sesion?.inicio) && !terminada && fecha === todayISO();
  const [ahora, setAhora] = useState(() => Date.now());
  useEffect(() => {
    if (!enMarcha) return undefined;
    const id = setInterval(() => setAhora(Date.now()), 30000);
    return () => clearInterval(id);
  }, [enMarcha]);

  const minutos = duracionMinutos(sesion, new Date(ahora));

  // Escribe una fila ya normalizada (con sets), respetando el resto.
  const guardarFila = (id, cambios) =>
    setFilas(filas.map((f) => (f.id === id ? { ...f, sets: setsDe(f), ...cambios } : f)));

  const terminar = () => {
    setSesiones(cerrarSesion(sesiones, fecha));
    confeti();
    toast("Sesión terminada");
  };

  const reanudar = () => setSesiones(reabrirSesion(sesiones, fecha));

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
    setSesiones(abrirSesion(sesiones, fecha));
    setAnadiendo(false);
  };

  const anadirSerie = (fila) => {
    const ultima = fila.sets[fila.sets.length - 1];
    guardarFila(fila.id, {
      sets: [...fila.sets, nuevaSerie(ultima?.peso ?? 0, ultima?.reps ?? 10)],
    });
  };

  /*
    Quitar la única serie que queda borra el ejercicio entero: un ejercicio con
    cero series no dice nada y dejaría la tarjeta ahí vacía sin forma evidente
    de cerrarla.
  */
  const quitarSerie = (fila, serieId) => {
    if (fila.sets.length <= 1) {
      removeWithUndo(filas, setFilas, fila.id, "Ejercicio");
      return;
    }
    guardarFila(fila.id, { sets: fila.sets.filter((s) => s.id !== serieId) });
  };

  const cambiarSerie = (fila, serieId, campo, valor) =>
    guardarFila(fila.id, {
      sets: fila.sets.map((s) =>
        s.id === serieId ? { ...s, [campo]: Math.max(0, Number(valor) || 0) } : s
      ),
    });

  const celda =
    "w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-center text-sm text-slate-100 focus:border-indigo-500 focus:outline-none disabled:opacity-60";

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
            {minutos != null && (
              <div>
                <p className="text-xs text-slate-500">Duración</p>
                <p className="text-lg font-bold text-slate-100">{formatearDuracion(minutos)}</p>
              </div>
            )}
          </div>
        </div>

        {delDia.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-slate-800 pt-4">
            {terminada ? (
              <>
                <span className="flex items-center gap-2 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-sm font-semibold text-emerald-300">
                  <CheckCircle2 size={16} /> Sesión terminada
                  {minutos != null && ` · ${formatearDuracion(minutos)}`}
                </span>
                <span className="text-xs text-slate-500">
                  Los datos están bloqueados para no tocarlos sin querer.
                </span>
                <button
                  onClick={reanudar}
                  className="ml-auto flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500 hover:text-indigo-300"
                >
                  <RotateCcw size={15} /> Reanudar
                </button>
              </>
            ) : (
              <>
                <span className="flex items-center gap-2 text-sm text-slate-400">
                  <Timer size={16} className="text-indigo-400" />
                  {enMarcha ? "Sesión en marcha" : "Sesión sin terminar"}
                </span>
                <button
                  onClick={terminar}
                  className="ml-auto flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"
                >
                  <CheckCircle2 size={16} /> Terminar sesión
                </button>
              </>
            )}
          </div>
        )}
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
                    {grupoDe(fila.ejercicio, propios)} · {fila.sets.length}{" "}
                    {fila.sets.length === 1 ? "serie" : "series"} ·{" "}
                    {volumen(fila.sets).toLocaleString("es-ES")} kg
                    {mejor && mejor.peso > 0 && ` · mejor ${mejor.peso}kg x${mejor.reps}`}
                  </p>
                  {descripcionDe(fila.ejercicio, propios) && (
                    <p className="mt-1 whitespace-pre-wrap text-xs text-slate-400">
                      {descripcionDe(fila.ejercicio, propios)}
                    </p>
                  )}
                </div>
                {!terminada && (
                  <button
                    onClick={() => removeWithUndo(filas, setFilas, fila.id, "Ejercicio")}
                    aria-label={`Borrar ${fila.ejercicio}`}
                    className="p-1 text-slate-500 transition hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>

              <div className="px-5 py-3">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-slate-500">
                      <th className="w-12 pb-2 text-left font-medium">Serie</th>
                      <th className="pb-2 font-medium">Peso (kg)</th>
                      <th className="pb-2 font-medium">Reps</th>
                      {!terminada && <th className="w-16 pb-2 text-right font-medium">Quitar</th>}
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
                            disabled={terminada}
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
                            disabled={terminada}
                            onChange={(e) => cambiarSerie(fila, s.id, "reps", e.target.value)}
                            className={celda}
                          />
                        </td>
                        {!terminada && (
                          <td className="py-1 pl-1 text-right">
                            <button
                              onClick={() => quitarSerie(fila, s.id)}
                              aria-label={
                                fila.sets.length === 1
                                  ? `Quitar la única serie y borrar ${fila.ejercicio}`
                                  : `Quitar serie ${i + 1} de ${fila.ejercicio}`
                              }
                              title={
                                fila.sets.length === 1
                                  ? "Quitar la serie borra el ejercicio"
                                  : "Quitar esta serie"
                              }
                              className="rounded-lg border border-slate-700 bg-slate-800 p-1.5 text-slate-300 transition hover:border-rose-500 hover:bg-rose-500/10 hover:text-rose-400"
                            >
                              <Trash2 size={15} />
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>

                {!terminada && (
                  <button
                    onClick={() => anadirSerie(fila)}
                    className="mt-2 flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-slate-700 py-2 text-xs font-medium text-slate-400 transition hover:border-indigo-500 hover:text-indigo-400"
                  >
                    <Plus size={14} /> Añadir serie
                    {fila.sets.length > 0 && <Copy size={12} className="opacity-60" />}
                  </button>
                )}

                <label className="sr-only" htmlFor={`nota-${fila.id}`}>
                  Nota de {fila.ejercicio}
                </label>
                <input
                  id={`nota-${fila.id}`}
                  name={`nota-${fila.id}`}
                  value={fila.nota || ""}
                  disabled={terminada}
                  onChange={(e) => guardarFila(fila.id, { nota: e.target.value })}
                  placeholder="Nota (sensaciones, técnica, objetivo...)"
                  className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none disabled:opacity-60"
                />
              </div>
            </Card>
          );
        })}
      </div>

      {terminada ? null : anadiendo ? (
        <Card>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {grupos.map((g) => (
              <button
                key={g}
                onClick={() => setGrupoAbierto(g)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  grupoActivo === g
                    ? "bg-indigo-500 text-white"
                    : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
                }`}
              >
                {g}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(porGrupo[grupoActivo] ?? []).map((nombre) => {
              const desc = descripcionDe(nombre, propios);
              return (
                <button
                  key={nombre}
                  onClick={() => anadirEjercicio(nombre)}
                  title={desc || undefined}
                  className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-indigo-500"
                >
                  + {nombre}
                </button>
              );
            })}
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
