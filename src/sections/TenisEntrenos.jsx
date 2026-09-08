import { useState, useMemo } from "react";
import { Target, Clock, Plus, Trash2, Lightbulb, Check, Smile } from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { Card, SectionTitle, todayISO } from "../lib/ui";
import { Linea } from "../lib/graficos.jsx";

import { nuevoId } from "../lib/id";
/*
  Entrenamientos de tenis de mesa.

  Los resultados de competición viven en "Resultados deportivos", que los baja
  solos de las federaciones. Aquí va lo que no publica nadie y solo sabes tú:
  cuánto entrenas, qué días juegas, en qué fallas y cómo te sientes.

  Antes las horas semanales eran una constante fija en el código, así que no se
  podían registrar; y había una tabla de partidos que ahora sobra.
*/

const TIPOS = ["Entreno", "Partido"];

/*
  Lunes de la semana de una fecha, en ISO. Sirve de clave de cada semana.

  Se formatea a mano en lugar de con toISOString(): esa función pasa a UTC, y
  como la fecha se construye a medianoche LOCAL, en España en verano (UTC+2)
  restaba dos horas y devolvía el día anterior. Todas las semanas salían
  corridas un día.

  El (getDay() + 6) % 7 es porque getDay() da 0 para el DOMINGO: restar getDay()
  sin más mandaría los domingos a la semana siguiente.
*/
export function lunesDe(fechaISO) {
  const d = new Date(`${fechaISO}T00:00:00`);
  if (Number.isNaN(d.getTime())) return "";
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const mes = String(d.getMonth() + 1).padStart(2, "0");
  const dia = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mes}-${dia}`;
}

// "2026-07-27" -> "27 jul"
function corta(fechaISO) {
  const [a, m, d] = String(fechaISO).split("-");
  const meses = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return a ? `${Number(d)} ${meses[Number(m) - 1] ?? ""}` : "";
}

export default function TenisEntrenos() {
  const [sesiones, setSesiones] = usePersisted("lh_tt_sesiones", []);
  const [mejoras, setMejoras] = usePersisted("lh_tt_mejoras", []);
  // Valoración semanal: { "2026-07-27": { nota: 7, comentario: "..." } }
  const [semanas, setSemanas] = usePersisted("lh_tt_semanas", {});

  const [form, setForm] = useState({ fecha: todayISO(), horas: "", tipo: "Entreno", nota: "" });
  const [mejoraNueva, setMejoraNueva] = useState("");
  const [semanaVista, setSemanaVista] = useState(lunesDe(todayISO()));

  const porSemana = useMemo(() => {
    const mapa = new Map();
    sesiones.forEach((s) => {
      const clave = lunesDe(s.fecha);
      if (!clave) return;
      const w = mapa.get(clave) ?? { semana: clave, horas: 0, entrenos: 0, partidos: 0 };
      w.horas += Number(s.horas) || 0;
      if (s.tipo === "Partido") w.partidos += 1;
      else w.entrenos += 1;
      mapa.set(clave, w);
    });
    // Se añaden las semanas que solo tienen valoración, sin sesiones.
    Object.keys(semanas).forEach((k) => {
      if (!mapa.has(k)) mapa.set(k, { semana: k, horas: 0, entrenos: 0, partidos: 0 });
    });
    return [...mapa.values()]
      .map((w) => ({ ...w, ...(semanas[w.semana] ?? {}) }))
      .sort((a, b) => a.semana.localeCompare(b.semana));
  }, [sesiones, semanas]);

  const deLaSemana = useMemo(
    () =>
      sesiones
        .filter((s) => lunesDe(s.fecha) === semanaVista)
        .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha))),
    [sesiones, semanaVista]
  );

  const resumen = useMemo(
    () => porSemana.find((w) => w.semana === semanaVista) ?? { horas: 0, entrenos: 0, partidos: 0 },
    [porSemana, semanaVista]
  );

  const valoracion = semanas[semanaVista] ?? { nota: "", comentario: "" };
  const conNota = porSemana.filter((w) => w.nota !== "" && w.nota != null);

  const anadirSesion = () => {
    const horas = Number(form.horas);
    if (!form.fecha || !horas) return;
    setSesiones([{ id: nuevoId(), ...form, horas }, ...sesiones]);
    setForm({ fecha: form.fecha, horas: "", tipo: form.tipo, nota: "" });
    setSemanaVista(lunesDe(form.fecha));
  };

  const guardarValoracion = (cambios) =>
    setSemanas({ ...semanas, [semanaVista]: { ...valoracion, ...cambios } });

  const anadirMejora = () => {
    const texto = mejoraNueva.trim();
    if (!texto) return;
    setMejoras([{ id: nuevoId(), texto, creado: todayISO(), resuelto: false }, ...mejoras]);
    setMejoraNueva("");
  };

  const campo =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle
        icon={Target}
        title="Entrenamientos"
        subtitle="Horas, sensaciones y qué mejorar"
      />

      <Card className="mb-4">
        <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-slate-300">
          <Plus size={16} /> Registrar sesión
        </h2>
        <div className="grid gap-3 sm:grid-cols-4">
          <div>
            <label htmlFor="s-fecha" className="mb-1 block text-xs text-slate-400">
              Día
            </label>
            <input
              id="s-fecha"
              name="s-fecha"
              type="date"
              value={form.fecha}
              onChange={(e) => setForm({ ...form, fecha: e.target.value })}
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="s-horas" className="mb-1 block text-xs text-slate-400">
              Horas
            </label>
            <input
              id="s-horas"
              name="s-horas"
              type="number"
              min="0"
              step="0.5"
              inputMode="decimal"
              value={form.horas}
              onChange={(e) => setForm({ ...form, horas: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && anadirSesion()}
              placeholder="1.5"
              className={campo}
            />
          </div>
          <div>
            <label htmlFor="s-tipo" className="mb-1 block text-xs text-slate-400">
              Tipo
            </label>
            <select
              id="s-tipo"
              name="s-tipo"
              value={form.tipo}
              onChange={(e) => setForm({ ...form, tipo: e.target.value })}
              className={campo}
            >
              {TIPOS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </div>
          <div className="flex items-end">
            <button
              onClick={anadirSesion}
              disabled={!form.horas}
              className="w-full rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
            >
              Añadir
            </button>
          </div>
        </div>
        <label htmlFor="s-nota" className="sr-only">
          Nota de la sesión
        </label>
        <input
          id="s-nota"
          name="s-nota"
          value={form.nota}
          onChange={(e) => setForm({ ...form, nota: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && anadirSesion()}
          placeholder="Qué trabajaste, con quién, sensaciones..."
          className={`mt-3 ${campo}`}
        />
      </Card>

      <Card className="mb-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="semana" className="text-sm text-slate-400">
              Semana del
            </label>
            <input
              id="semana"
              name="semana"
              type="date"
              value={semanaVista}
              onChange={(e) => setSemanaVista(lunesDe(e.target.value))}
              className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div className="flex gap-5 text-right">
            <div>
              <p className="text-xs text-slate-500">Horas</p>
              <p className="text-lg font-bold text-amber-400">{resumen.horas}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Entrenos</p>
              <p className="text-lg font-bold text-slate-100">{resumen.entrenos}</p>
            </div>
            <div>
              <p className="text-xs text-slate-500">Partidos</p>
              <p className="text-lg font-bold text-indigo-400">{resumen.partidos}</p>
            </div>
          </div>
        </div>

        {deLaSemana.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Nada registrado esta semana.</p>
        ) : (
          <div className="space-y-2">
            {deLaSemana.map((s) => (
              <div
                key={s.id}
                className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2"
              >
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-xs font-semibold ${
                    s.tipo === "Partido"
                      ? "bg-indigo-500/15 text-indigo-300"
                      : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {s.tipo}
                </span>
                <span className="w-16 shrink-0 text-xs text-slate-400">{corta(s.fecha)}</span>
                <span className="w-12 shrink-0 text-sm font-semibold text-slate-100">
                  {s.horas}h
                </span>
                <span className="min-w-0 flex-1 truncate text-sm text-slate-400">{s.nota}</span>
                <button
                  onClick={() => removeWithUndo(sesiones, setSesiones, s.id, "Sesión")}
                  aria-label={`Borrar sesión del ${s.fecha}`}
                  className="shrink-0 p-1 text-slate-500 transition hover:text-rose-400"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Smile size={18} className="text-emerald-400" /> ¿Cómo ha ido la semana?
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Del 0 al 10, cómo te has sentido entrenando y jugando. Se guarda por semana para poder
          ver la evolución.
        </p>

        <div className="mb-3 flex items-center gap-4">
          <input
            type="range"
            min="0"
            max="10"
            step="1"
            aria-label="Sensaciones de la semana, del 0 al 10"
            value={valoracion.nota === "" ? 5 : valoracion.nota}
            onChange={(e) => guardarValoracion({ nota: Number(e.target.value) })}
            className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-slate-800 accent-emerald-500"
          />
          <span
            className={`w-12 text-center text-2xl font-bold ${
              valoracion.nota === "" ? "text-slate-600" : "text-emerald-400"
            }`}
          >
            {valoracion.nota === "" ? "–" : valoracion.nota}
          </span>
        </div>

        <label htmlFor="comentario" className="sr-only">
          Comentario de la semana
        </label>
        <textarea
          id="comentario"
          name="comentario"
          rows={3}
          value={valoracion.comentario ?? ""}
          onChange={(e) => guardarValoracion({ comentario: e.target.value })}
          placeholder="Qué ha ido bien, qué no, cómo te has encontrado físicamente..."
          className={campo}
        />
      </Card>

      {porSemana.length > 1 && (
        <div className="mb-4 grid gap-4 lg:grid-cols-2">
          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Clock size={18} className="text-amber-400" /> Horas por semana
            </h2>
            <p className="mb-3 text-xs text-slate-500">Entrenos y partidos juntos.</p>
            <Linea
              datos={porSemana}
              valor={(w) => w.horas}
              etiqueta={(w) => corta(w.semana)}
              sufijo="h"
              color="#f59e0b"
              max={0}
            />
          </Card>

          <Card>
            <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
              <Smile size={18} className="text-emerald-400" /> Sensaciones
            </h2>
            <p className="mb-3 text-xs text-slate-500">Tu nota semanal, del 0 al 10.</p>
            {conNota.length < 2 ? (
              <p className="py-10 text-center text-sm text-slate-500">
                Valora al menos dos semanas para ver la evolución.
              </p>
            ) : (
              <Linea
                datos={conNota}
                valor={(w) => w.nota}
                etiqueta={(w) => corta(w.semana)}
                color="#10b981"
                max={10}
              />
            )}
          </Card>
        </div>
      )}

      {conNota.length > 0 && (
        <Card className="mb-4">
          <h2 className="mb-3 text-lg font-semibold text-slate-100">Comentarios por semana</h2>
          <div className="space-y-2">
            {[...conNota]
              .reverse()
              .filter((w) => w.comentario)
              .map((w) => (
                <div key={w.semana} className="flex gap-3 rounded-lg bg-slate-800/60 px-3 py-2">
                  <span
                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                      w.nota >= 7
                        ? "bg-emerald-500/15 text-emerald-400"
                        : w.nota >= 4
                          ? "bg-amber-500/15 text-amber-400"
                          : "bg-rose-500/15 text-rose-400"
                    }`}
                  >
                    {w.nota}
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs text-slate-500">Semana del {corta(w.semana)}</p>
                    <p className="whitespace-pre-wrap text-sm text-slate-300">{w.comentario}</p>
                  </div>
                </div>
              ))}
          </div>
        </Card>
      )}

      <Card>
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Lightbulb size={18} className="text-sky-400" /> Mejoras
        </h2>
        <p className="mb-3 text-xs text-slate-500">
          En qué fallas y quieres trabajar. Marca las que vayas resolviendo.
        </p>

        <div className="mb-4 flex gap-2">
          <label htmlFor="mejora" className="sr-only">
            Nueva mejora
          </label>
          <input
            id="mejora"
            name="mejora"
            value={mejoraNueva}
            onChange={(e) => setMejoraNueva(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && anadirMejora()}
            placeholder="Bloqueo de revés contra topspin rápido"
            className={`flex-1 ${campo}`}
          />
          <button
            onClick={anadirMejora}
            className="rounded-lg bg-sky-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-sky-400"
          >
            Añadir
          </button>
        </div>

        {mejoras.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">
            Nada apuntado. Ve anotando lo que veas que falla.
          </p>
        ) : (
          <div className="space-y-2">
            {[...mejoras]
              .sort((a, b) => Number(a.resuelto) - Number(b.resuelto))
              .map((m) => (
                <div
                  key={m.id}
                  className="flex items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2"
                >
                  <button
                    onClick={() =>
                      setMejoras(
                        mejoras.map((x) => (x.id === m.id ? { ...x, resuelto: !x.resuelto } : x))
                      )
                    }
                    aria-label={m.resuelto ? `Reabrir ${m.texto}` : `Marcar ${m.texto} resuelta`}
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md border transition ${
                      m.resuelto
                        ? "border-emerald-600 bg-emerald-500/20 text-emerald-400"
                        : "border-slate-600 text-transparent hover:border-sky-500"
                    }`}
                  >
                    <Check size={14} />
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm ${
                        m.resuelto ? "text-slate-500 line-through" : "text-slate-100"
                      }`}
                    >
                      {m.texto}
                    </p>
                    <p className="text-xs text-slate-600">desde {corta(m.creado)}</p>
                  </div>
                  <button
                    onClick={() => removeWithUndo(mejoras, setMejoras, m.id, "Mejora")}
                    aria-label={`Borrar ${m.texto}`}
                    className="shrink-0 p-1 text-slate-500 transition hover:text-rose-400"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              ))}
          </div>
        )}
      </Card>
    </div>
  );
}
