import { useState, useMemo } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Flag, Lightbulb } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, fmtEuro, todayISO } from "../lib/ui";
import { Cifra } from "../lib/animar";
import {
  PERIODOS,
  rangoDe,
  mover,
  tramosDe,
  metricas,
  serie,
  metasConseguidas,
  variacion,
} from "../lib/analitica";

/*
  Analítica por periodo: semana, mes, trimestre o año.

  Cada número se compara con el MISMO periodo anterior (esta semana contra la
  pasada, este trimestre contra el anterior), que es la comparación que dice
  algo. Antes solo había resumen anual y no se podía bajar de ahí.

  Dos avisos que van escritos en la propia pantalla porque son limitaciones de
  los datos, no de esta sección:
  - Las horas de estudio solo cuentan desde que se registran con fecha
    (`lh_study_log`); el contador viejo por asignatura no las tenía.
  - `lh_goals` no guarda cuándo se cumplió una meta, así que las conseguidas son
    una foto de ahora y no del periodo.
*/

// Las tarjetas: de dónde sale cada número y cómo se enseña.
const METRICAS = [
  { id: "horasTrabajo", nombre: "Trabajo", unidad: "h", color: "text-indigo-400" },
  { id: "horasEstudio", nombre: "Estudio", unidad: "h", color: "text-sky-400" },
  { id: "horasTenis", nombre: "Entreno de tenis", unidad: "h", color: "text-amber-400" },
  { id: "diasGym", nombre: "Días de gimnasio", unidad: "", color: "text-emerald-400" },
  { id: "partidos", nombre: "Partidos disputados", unidad: "", color: "text-rose-400" },
  { id: "entrenosTenis", nombre: "Sesiones de tenis", unidad: "", color: "text-amber-300" },
  { id: "invertido", nombre: "Invertido", unidad: "€", color: "text-fuchsia-400", dinero: true },
  { id: "gastos", nombre: "Gastos", unidad: "€", color: "text-rose-300", dinero: true },
];

export default function Analitica() {
  const [periodo, setPeriodo] = useState("mes");
  const [ancla, setAncla] = useState(todayISO());
  const [grafica, setGrafica] = useState("horasTrabajo");
  const [barra, setBarra] = useState(null); // barra señalada con el cursor

  const [trabajo] = usePersisted("lh_work_log", []);
  const [gym] = usePersisted("lh_gym", []);
  const [tenisSesiones] = usePersisted("lh_tt_sesiones", []);
  const [tenisPartidos] = usePersisted("lh_tenis_partidos", []);
  const [estudio] = usePersisted("lh_study_log", []);
  const [aportaciones] = usePersisted("lh_contribs", []);
  const [finanzas] = usePersisted("lh_finance", []);
  const [metas] = usePersisted("lh_goals", []);
  const [salud] = usePersisted("lh_health", []);

  const datos = useMemo(
    () => ({ trabajo, gym, tenisSesiones, tenisPartidos, estudio, aportaciones, finanzas }),
    [trabajo, gym, tenisSesiones, tenisPartidos, estudio, aportaciones, finanzas]
  );

  const rango = useMemo(() => rangoDe(periodo, ancla), [periodo, ancla]);
  const rangoPrevio = useMemo(() => rangoDe(periodo, mover(periodo, ancla, -1)), [periodo, ancla]);

  const ahora = useMemo(() => metricas(datos, rango), [datos, rango]);
  const antes = useMemo(() => metricas(datos, rangoPrevio), [datos, rangoPrevio]);

  const tramos = useMemo(() => tramosDe(periodo, rango), [periodo, rango]);
  const barras = useMemo(() => serie(datos, tramos, grafica), [datos, tramos, grafica]);
  const maximo = Math.max(...barras.map((b) => b.valor), 1);

  const metaInfo = useMemo(() => metasConseguidas(metas), [metas]);
  const metricaGrafica = METRICAS.find((m) => m.id === grafica) ?? METRICAS[0];

  // Sueño medio los días de gimnasio frente al resto.
  const patron = useMemo(() => {
    const diasGym = new Set(gym.map((g) => g.fecha));
    const media = (filas) =>
      filas.length ? Math.round((filas.reduce((t, h) => t + Number(h.sueno), 0) / filas.length) * 10) / 10 : 0;
    const conSueno = salud.filter((h) => h.sueno);
    return {
      conGym: media(conSueno.filter((h) => diasGym.has(h.fecha))),
      sinGym: media(conSueno.filter((h) => !diasGym.has(h.fecha))),
    };
  }, [gym, salud]);

  const nombrePeriodo = PERIODOS.find((p) => p.id === periodo)?.nombre.toLowerCase() ?? "periodo";

  return (
    <div>
      <SectionTitle
        icon={BarChart3}
        title="Analítica"
        subtitle="Tus números por semana, mes, trimestre o año"
      />

      <Card className="mb-6">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {PERIODOS.map((p) => (
            <button
              key={p.id}
              onClick={() => setPeriodo(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                periodo === p.id
                  ? "bg-indigo-500 text-white"
                  : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => setAncla(mover(periodo, ancla, -1))}
            aria-label={`${nombrePeriodo} anterior`}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-lg font-bold text-slate-100">{rango.etiqueta}</span>
          <button
            onClick={() => setAncla(mover(periodo, ancla, 1))}
            aria-label={`${nombrePeriodo} siguiente`}
            className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 transition hover:bg-slate-700"
          >
            <ChevronRight size={18} />
          </button>
          {ancla !== todayISO() && (
            <button onClick={() => setAncla(todayISO())} className="text-xs text-indigo-400 underline">
              Volver a hoy
            </button>
          )}
          <span className="ml-auto text-xs text-slate-500">
            Comparado con {rangoPrevio.etiqueta}
          </span>
        </div>
      </Card>

      <div className="mb-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {METRICAS.map((m) => {
          const valor = ahora[m.id];
          const previo = antes[m.id];
          const dif = variacion(valor, previo);
          const activa = grafica === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setGrafica(m.id)}
              aria-pressed={activa}
              // lh-card para que compartan el cristal y el relieve del resto de
              // tarjetas; la activa se distingue por el borde de acento.
              className={`lh-card p-4 text-left ${activa ? "!border-indigo-500" : ""}`}
            >
              <p className="text-xs text-slate-400">{m.nombre}</p>
              <p className={`font-display text-2xl font-bold ${m.color}`}>
                <Cifra
                  valor={valor}
                  decimales={valor % 1 ? 1 : 0}
                  sufijo={m.dinero ? "€" : m.unidad}
                />
              </p>
              <p
                className={`text-xs ${
                  dif === null ? "text-slate-500" : dif >= 0 ? "text-emerald-400" : "text-rose-400"
                }`}
              >
                {dif === null
                  ? `sin datos anteriores`
                  : `${dif >= 0 ? "▲" : "▼"} ${Math.abs(dif)}% vs ${nombrePeriodo} anterior`}
              </p>
            </button>
          );
        })}
      </div>

      <Card className="mb-6">
        <h2 className="mb-1 text-lg font-semibold text-slate-100">
          {metricaGrafica.nombre} · {rango.etiqueta}
        </h2>
        <p className="mb-4 text-xs text-slate-500">
          Toca cualquier tarjeta de arriba para ver su evolución aquí.
        </p>
        <div className="relative flex h-40 items-end gap-1" onPointerLeave={() => setBarra(null)}>
          {barras.map((b, i) => (
            <div
              key={i}
              className="group flex min-w-0 flex-1 cursor-default flex-col items-center gap-1"
              onPointerEnter={() => setBarra(i)}
              onFocus={() => setBarra(i)}
              tabIndex={0}
              aria-label={`${b.etiqueta}: ${b.valor}${metricaGrafica.unidad}`}
            >
              <div className="flex w-full flex-1 items-end">
                <div
                  className={`lh-barra-v w-full rounded-t bg-gradient-to-t from-seccion-500 to-seccion-400 transition-opacity ${
                    barra !== null && barra !== i ? "opacity-40" : ""
                  }`}
                  style={{
                    // min-height para que un valor pequeño pero real siga
                    // viéndose: una barra de 0,4px es indistinguible de cero.
                    height: `${b.valor > 0 ? Math.max(2, (b.valor / maximo) * 100) : 0}%`,
                    // Escalonado: las barras crecen de izquierda a derecha, no
                    // todas de golpe. Se corta a 400 ms para que un año (12
                    // barras) no tarde más que una semana en terminar.
                    animationDelay: `${Math.min(400, i * 22)}ms`,
                  }}
                />
              </div>
              {/* Con 28-31 barras no caben todas las etiquetas: se pone una de cada tres. */}
              <span className="truncate text-[9px] text-slate-500">
                {barras.length > 12 && i % 3 !== 0 ? "" : b.etiqueta}
              </span>
            </div>
          ))}

          {barra !== null && (
            <div
              className="pointer-events-none absolute -top-2 z-10 -translate-x-1/2 -translate-y-full rounded-lg border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-center shadow-lg"
              style={{ left: `${((barra + 0.5) / barras.length) * 100}%` }}
            >
              <p className="font-display text-sm font-bold tabular-nums text-slate-100">
                {barras[barra].valor.toLocaleString("es-ES")}
                {metricaGrafica.dinero ? "€" : metricaGrafica.unidad}
              </p>
              <p className="text-[11px] text-slate-400">{barras[barra].etiqueta}</p>
            </div>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Flag size={18} className="text-indigo-400" /> Metas conseguidas
          </h2>
          <p className="font-display text-3xl font-bold text-slate-100">
            <Cifra valor={metaInfo.cumplidas} />
            <span className="text-lg font-medium text-slate-500"> / {metaInfo.total}</span>
          </p>
          {metaInfo.lista.length > 0 ? (
            <ul className="mt-3 space-y-1">
              {metaInfo.lista.map((m) => (
                <li key={m.id ?? m.titulo} className="flex items-center gap-2 text-sm text-slate-300">
                  <span className="text-emerald-400">✓</span> {m.titulo}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-slate-500">
              {metaInfo.total === 0 ? "Aún no tienes metas puestas." : "Ninguna alcanzada todavía."}
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            Es la situación de ahora mismo, no del {nombrePeriodo}: las metas no guardan la fecha en
            que se cumplen.
          </p>
        </Card>

        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Lightbulb size={18} className="text-amber-400" /> Patrones
          </h2>
          {patron.conGym && patron.sinGym ? (
            <p className="text-sm text-slate-300">
              Duermes de media <b className="text-emerald-400">{patron.conGym}h</b> los días que
              entrenas frente a <b>{patron.sinGym}h</b> los que no.
              {patron.conGym > patron.sinGym
                ? " Entrenar parece ayudarte a descansar mejor."
                : " Los días de entreno descansas algo menos, ojo con la recuperación."}
            </p>
          ) : (
            <p className="text-sm text-slate-500">
              Registra sueño (en Salud) y sesiones de gimnasio para ver si entrenar te hace descansar
              mejor.
            </p>
          )}
          {ahora.horasEstudio === 0 && (
            <p className="mt-3 text-xs text-slate-500">
              Las horas de estudio se cuentan desde que las apuntas en Universidad; el contador
              antiguo por asignatura no guardaba la fecha, así que no entra aquí.
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
