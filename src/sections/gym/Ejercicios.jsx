import { useState, useMemo } from "react";
import { Plus, Trash2, Pencil, Check, X, BookOpen } from "lucide-react";
import { usePersisted } from "../../lib/store";
import { removeWithUndo } from "../../lib/toast";
import { Card } from "../../lib/ui";
import { GRUPOS, EJERCICIOS, nuevoId } from "../../lib/gym";

/*
  Ejercicios propios: los que no están en el catálogo de serie, con su nombre,
  su grupo muscular y una descripción (técnica, máquina concreta, recordatorios).

  Aparecen mezclados con los predeterminados al elegir ejercicio en Rutinas y
  en Sesión, para que no tengas que acordarte de en qué lista está cada cosa.
*/
const vacio = { nombre: "", grupo: GRUPOS[0], descripcion: "" };

export default function Ejercicios() {
  const [propios, setPropios] = usePersisted("lh_gym_ejercicios", []);
  const [form, setForm] = useState(vacio);
  const [editando, setEditando] = useState(null);
  const [borrador, setBorrador] = useState(vacio);

  // Nombres del catálogo de serie, para avisar si repites uno.
  const yaDeSerie = useMemo(() => new Set(Object.values(EJERCICIOS).flat()), []);

  const nombreRepetido = (nombre, exceptoId = null) =>
    propios.some((e) => e.id !== exceptoId && e.nombre.toLowerCase() === nombre.toLowerCase());

  const crear = () => {
    const nombre = form.nombre.trim();
    if (!nombre || nombreRepetido(nombre)) return;
    setPropios([{ id: nuevoId(), ...form, nombre }, ...propios]);
    setForm(vacio);
  };

  const guardarEdicion = (id) => {
    const nombre = borrador.nombre.trim();
    if (!nombre || nombreRepetido(nombre, id)) return;
    setPropios(propios.map((e) => (e.id === id ? { ...e, ...borrador, nombre } : e)));
    setEditando(null);
  };

  const campo =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  const avisoNombre =
    form.nombre.trim() && nombreRepetido(form.nombre.trim())
      ? "Ya tienes un ejercicio con ese nombre."
      : form.nombre.trim() && yaDeSerie.has(form.nombre.trim())
        ? "Ese nombre ya existe en el catálogo. El tuyo lo sustituirá."
        : "";

  return (
    <div>
      <Card className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <BookOpen size={16} /> Crear un ejercicio propio
        </h2>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="sm:col-span-2">
            <label htmlFor="ej-nombre" className="mb-1 block text-xs text-slate-400">
              Nombre
            </label>
            <input
              id="ej-nombre"
              name="ej-nombre"
              value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && crear()}
              placeholder="Press inclinado en multipower"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="ej-grupo" className="mb-1 block text-xs text-slate-400">
              Grupo muscular
            </label>
            <select
              id="ej-grupo"
              name="ej-grupo"
              value={form.grupo}
              onChange={(e) => setForm({ ...form, grupo: e.target.value })}
              className={campo}
            >
              {GRUPOS.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </div>
        </div>

        <label htmlFor="ej-desc" className="mb-1 mt-3 block text-xs text-slate-400">
          Descripción (opcional)
        </label>
        <textarea
          id="ej-desc"
          name="ej-desc"
          rows={2}
          value={form.descripcion}
          onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
          placeholder="Técnica, ajuste de la máquina, a qué prestar atención..."
          className={campo}
        />

        {avisoNombre && <p className="mt-2 text-xs text-amber-400">{avisoNombre}</p>}

        <div className="mt-3 flex justify-end">
          <button
            onClick={crear}
            disabled={!form.nombre.trim() || nombreRepetido(form.nombre.trim())}
            className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
          >
            <Plus size={16} /> Crear ejercicio
          </button>
        </div>
      </Card>

      {propios.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">
          Aún no has creado ninguno. Los que crees aparecerán al elegir ejercicio en Rutinas y en
          Sesión, junto a los predeterminados.
        </Card>
      ) : (
        <div className="space-y-2">
          {propios.map((ej) =>
            editando === ej.id ? (
              <Card key={ej.id}>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-2">
                    <label htmlFor={`edit-nombre-${ej.id}`} className="sr-only">
                      Nombre del ejercicio
                    </label>
                    <input
                      id={`edit-nombre-${ej.id}`}
                      name={`edit-nombre-${ej.id}`}
                      value={borrador.nombre}
                      onChange={(e) => setBorrador({ ...borrador, nombre: e.target.value })}
                      className={campo}
                    />
                  </div>
                  <div>
                    <label htmlFor={`edit-grupo-${ej.id}`} className="sr-only">
                      Grupo muscular
                    </label>
                    <select
                      id={`edit-grupo-${ej.id}`}
                      name={`edit-grupo-${ej.id}`}
                      value={borrador.grupo}
                      onChange={(e) => setBorrador({ ...borrador, grupo: e.target.value })}
                      className={campo}
                    >
                      {GRUPOS.map((g) => (
                        <option key={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <label htmlFor={`edit-desc-${ej.id}`} className="sr-only">
                  Descripción
                </label>
                <textarea
                  id={`edit-desc-${ej.id}`}
                  name={`edit-desc-${ej.id}`}
                  rows={2}
                  value={borrador.descripcion}
                  onChange={(e) => setBorrador({ ...borrador, descripcion: e.target.value })}
                  placeholder="Descripción"
                  className={`mt-3 ${campo}`}
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    onClick={() => setEditando(null)}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300"
                  >
                    <X size={15} /> Cancelar
                  </button>
                  <button
                    onClick={() => guardarEdicion(ej.id)}
                    className="flex items-center gap-1.5 rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-semibold text-white"
                  >
                    <Check size={15} /> Guardar
                  </button>
                </div>
              </Card>
            ) : (
              <Card key={ej.id} className="flex flex-wrap items-start gap-3">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-100">{ej.nombre}</p>
                  <p className="text-xs text-slate-500">{ej.grupo}</p>
                  {ej.descripcion && (
                    <p className="mt-1 whitespace-pre-wrap text-sm text-slate-400">
                      {ej.descripcion}
                    </p>
                  )}
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => {
                      setEditando(ej.id);
                      setBorrador({
                        nombre: ej.nombre,
                        grupo: ej.grupo,
                        descripcion: ej.descripcion || "",
                      });
                    }}
                    aria-label={`Editar ${ej.nombre}`}
                    className="p-1.5 text-slate-500 transition hover:text-indigo-400"
                  >
                    <Pencil size={16} />
                  </button>
                  <button
                    onClick={() => removeWithUndo(propios, setPropios, ej.id, "Ejercicio")}
                    aria-label={`Borrar ${ej.nombre}`}
                    className="p-1.5 text-slate-500 transition hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </Card>
            )
          )}
          <p className="px-1 pt-1 text-xs text-slate-500">
            Borrar un ejercicio de esta lista no borra lo que ya hayas registrado con él: el
            histórico y las gráficas se mantienen.
          </p>
        </div>
      )}
    </div>
  );
}
