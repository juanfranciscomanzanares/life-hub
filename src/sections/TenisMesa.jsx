import { useState, useMemo } from "react";
import { Target, RefreshCw, Settings, Trophy, Users, Activity } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle } from "../lib/ui";
import { Anillo, Linea, BarrasH, BarrasApiladas, Medidor } from "../lib/graficos.jsx";
import {
  estadisticas,
  porJornada,
  porRival,
  rendimientoPorSet,
  remontadas,
  clutch,
  rachas,
  porLetra,
} from "../lib/tenis";
import { sincronizarLiga, sincronizarOpens, reemplazarTemporada } from "../lib/tenisSync";

/*
  Tenis de mesa: partidos de la liga nacional (RFETM) y puestos en los opens
  regionales (FTMRM), descargados de las webs de las federaciones y separados
  por temporada.

  Son dos fuentes distintas y no hay que mezclarlas: la liga que se juega es la
  NACIONAL, así que los rankings de ligas regionales murcianas se ignoran a
  propósito y solo se leen los de "ranking individual tras prueba".

  Los datos crudos se guardan tal cual y las métricas se calculan al vuelo, para
  poder cambiar los cálculos sin volver a descargar nada.
*/

const CONFIG_INICIAL = { licencia: "", nombre: "", temporada: "2025-2026" };

const ESTADOS = {
  ok: { texto: "encontrado", clase: "text-emerald-400" },
  "no-aparece": { texto: "no participaste", clase: "text-slate-500" },
  escaneado: { texto: "PDF escaneado, sin texto", clase: "text-amber-400" },
  error: { texto: "no se pudo leer", clase: "text-rose-400" },
};

/*
  Ronda alcanzada en cada open. Los rankings solo publican el puesto y los
  puntos del ranking acumulado, no hasta dónde llegaste en el cuadro, así que
  eso se anota a mano.

  Se guarda en su propia clave y no dentro del resultado del open: al volver a
  sincronizar, los resultados se sobrescriben con lo descargado y se perdería.
*/
const RONDAS = [
  "",
  "Fase de grupos",
  "Dieciseisavos",
  "Octavos",
  "Cuartos",
  "Semifinal (3º/4º)",
  "Final (2º)",
  "Campeón (1º)",
];

export default function TenisMesa() {
  const [config, setConfig] = usePersisted("lh_tenis_config", CONFIG_INICIAL);
  const [partidos, setPartidos] = usePersisted("lh_tenis_partidos", []);
  const [opens, setOpens] = usePersisted("lh_tenis_opens", []);
  const [oficiales, setOficiales] = usePersisted("lh_tenis_oficiales", {});

  // Revisiones y rondas se guardan por temporada para que no se pierdan al
  // cambiar de año ni al volver a entrar en la sección.
  const [revisiones, setRevisiones] = usePersisted("lh_tenis_revisiones", {});
  const [rondas, setRondas] = usePersisted("lh_tenis_rondas", {});
  const [fichas, setFichas] = usePersisted("lh_tenis_ficha", {});

  const [ajustes, setAjustes] = useState(!config.licencia);
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);

  /*
    UNA sola temporada, la de config. Antes había dos controles (el selector de
    arriba y otro en Ajustes) y sincronizar usaba siempre el de Ajustes y
    forzaba la vista a él, así que cambiar el de arriba parecía no hacer nada.
  */
  const activa = config.temporada;
  const temporadas = useMemo(() => {
    const t = new Set([...partidos, ...opens].map((x) => x.temporada).filter(Boolean));
    t.add(activa);
    return [...t].sort().reverse();
  }, [partidos, opens, activa]);

  const detalle = revisiones[activa];
  const ficha = fichas[activa];

  /*
    Una fila por PRUEBA de la temporada, se haya podido leer el ranking o no.

    El puesto y los puntos que publica la federación son del ranking ACUMULADO
    tras esa prueba, no el resultado del torneo. Lo del torneo en sí (hasta qué
    ronda llegaste) no lo publica nadie, así que se anota a mano, y por eso el
    selector tiene que estar en todas las pruebas y no solo en las que
    aparecemos en el ranking.
  */
  const pruebas = useMemo(() => {
    const porNombre = new Map();
    (detalle ?? []).forEach((d) => porNombre.set(d.prueba, { prueba: d.prueba, estado: d.estado }));
    opens
      .filter((o) => o.temporada === activa)
      .forEach((o) =>
        porNombre.set(o.prueba, {
          ...(porNombre.get(o.prueba) ?? { prueba: o.prueba, estado: "ok" }),
          puesto: o.puesto,
          acumulado: o.total,
          categoria: o.categoria,
          id: o.id,
        })
      );
    return [...porNombre.values()];
  }, [detalle, opens, activa]);

  const dePartidos = useMemo(
    () => partidos.filter((p) => p.temporada === activa),
    [partidos, activa]
  );

  const stats = useMemo(() => estadisticas(dePartidos), [dePartidos]);
  const jornadas = useMemo(() => porJornada(dePartidos), [dePartidos]);
  const rivales = useMemo(() => porRival(dePartidos), [dePartidos]);
  const sets = useMemo(() => rendimientoPorSet(dePartidos), [dePartidos]);
  const remo = useMemo(() => remontadas(dePartidos), [dePartidos]);
  const clu = useMemo(() => clutch(dePartidos), [dePartidos]);
  const rac = useMemo(() => rachas(dePartidos), [dePartidos]);
  const letras = useMemo(() => porLetra(dePartidos), [dePartidos]);
  const oficial = oficiales[activa];

  const sincronizar = async () => {
    if (!config.licencia) return setAjustes(true);
    setError(null);

    try {
      setEstado("Leyendo tu ficha en la RFETM...");
      const liga = await sincronizarLiga({ config });
      setPartidos((p) => reemplazarTemporada(p, liga.partidos, activa));
      setOficiales((o) => ({ ...o, [activa]: liga.oficiales }));
      setFichas((f) => ({ ...f, [activa]: liga.ficha }));

      let resumenOpens = "";
      if (config.nombre?.trim()) {
        setEstado("Leyendo los rankings de los opens...");
        const res = await sincronizarOpens({
          nombre: config.nombre,
          temporada: activa,
          alProgresar: (hechas, total) => setEstado(`Rankings ${hechas}/${total}...`),
        });
        setOpens((o) => reemplazarTemporada(o, res.resultados, activa));
        setRevisiones((r) => ({ ...r, [activa]: res.detalle }));
        resumenOpens = ` ${res.resultados.length} resultados en opens.`;
        if (res.detalle.length === 0) resumenOpens = ` No hay rankings publicados de ${activa}.`;
      } else {
        resumenOpens = " Opens omitidos: falta tu nombre en Ajustes.";
      }

      setEstado(`${liga.partidos.length} partidos de liga.${resumenOpens}`);
    } catch (e) {
      setError(e.message || String(e));
      setEstado(null);
    }
  };

  const campo =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";
  const cargando = estado && /\.\.\.$/.test(estado);
  const sinNombre = !config.nombre?.trim();

  return (
    <div>
      <SectionTitle
        icon={Target}
        title="Resultados deportivos"
        subtitle="Liga nacional y opens regionales"
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="tenis-temporada" className="text-sm text-slate-400">
          Temporada
        </label>
        {/* Escribible además de elegible: para traer un año que aún no tengas
            descargado, basta con teclearlo y sincronizar. */}
        <input
          id="tenis-temporada"
          name="tenis-temporada"
          list="tenis-temporadas"
          value={activa}
          onChange={(e) => setConfig({ ...config, temporada: e.target.value.trim() })}
          placeholder="2025-2026"
          className="w-32 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        />
        <datalist id="tenis-temporadas">
          {temporadas.map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>

        <div className="flex-1" />

        <button
          onClick={() => setAjustes((a) => !a)}
          className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-300 transition hover:border-indigo-500"
        >
          <Settings size={16} /> Ajustes
        </button>
        <button
          onClick={sincronizar}
          disabled={cargando}
          className="flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-50"
        >
          <RefreshCw size={16} className={cargando ? "animate-spin" : ""} /> Sincronizar
        </button>
      </div>

      {error && (
        <Card className="mb-4 border-rose-900 bg-rose-500/10 text-sm text-rose-300">{error}</Card>
      )}
      {estado && !error && (
        <Card className="mb-4 border-slate-700 text-sm text-slate-300">{estado}</Card>
      )}

      {/* Qué ha pasado con cada ranking: sin esto, "no sale nada" no distingue
          entre no haber participado, un PDF escaneado o un fallo de descarga. */}
      {ficha && (ficha.club || ficha.competicion) && (
        <Card className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          {ficha.club && (
            <span className="text-slate-300">
              <span className="text-slate-500">Club</span> <b>{ficha.club}</b>
            </span>
          )}
          {ficha.competicion && (
            <span className="text-slate-300">
              <span className="text-slate-500">Competición</span> <b>{ficha.competicion}</b>
            </span>
          )}
          <span className="text-xs text-slate-500">leídos de tu ficha, cambian solos</span>
        </Card>
      )}


      {ajustes && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Tus datos federativos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="t-lic" className="mb-1 block text-xs text-slate-400">
                Nº de licencia · para la liga
              </label>
              <input
                id="t-lic"
                name="t-lic"
                value={config.licencia}
                onChange={(e) => setConfig({ ...config, licencia: e.target.value.trim() })}
                placeholder="23789"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="t-nom" className="mb-1 block text-xs text-slate-400">
                Nombre · para los opens
              </label>
              <input
                id="t-nom"
                name="t-nom"
                value={config.nombre}
                onChange={(e) => setConfig({ ...config, nombre: e.target.value })}
                placeholder="Manzanares"
                className={`${campo} ${sinNombre ? "border-amber-700" : ""}`}
              />
            </div>
          </div>
          {sinNombre && (
            <p className="mt-2 text-xs text-amber-400">
              Sin nombre no se buscan los opens: esos rankings no llevan número de licencia, solo
              el nombre.
            </p>
          )}
          <p className="mt-3 text-xs text-slate-500">
            La temporada se elige arriba. Escribe una que no tengas y pulsa Sincronizar para
            traerla; cada año se guarda aparte y puedes comparar.
          </p>
        </Card>
      )}

      {dePartidos.length === 0 && pruebas.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">
          {config.licencia
            ? "Nada todavía para esta temporada. Pulsa Sincronizar."
            : "Pon tu número de licencia en Ajustes y pulsa Sincronizar."}
        </Card>
      ) : (
        <div className="space-y-4">
          {/*
            Los opens van ARRIBA a propósito. Estaban al final, detrás de los
            anillos, cuatro gráficos, el cara a cara y una tabla de 38 partidos,
            así que había que bajar muchísimo para verlos y parecía que no se
            cargaban. Son pocas filas y es donde se anota la ronda.

            Basta con que se hayan revisado pruebas: la ronda se anota aunque el
            ranking no se haya podido leer o no aparezcas en él.
          */}
          {pruebas.length > 0 && (
            <Card>
              <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                <Trophy size={18} className="text-amber-400" /> Opens regionales
              </h2>
              <p className="mb-3 text-xs text-slate-500">
                El puesto y los puntos son del <b>ranking acumulado</b> tras cada prueba, no el
                resultado de ese torneo: es lo único que publica la federación. Hasta dónde
                llegaste en cada cuadro lo anotas tú.
              </p>
              <div className="space-y-2">
                {pruebas.map((p) => {
                  // La ronda se guarda por temporada y prueba, no por el id del
                  // ranking: así también se puede anotar en las pruebas cuyo
                  // ranking no se ha podido leer.
                  const clave = `${activa}|${p.prueba}`;
                  const e = ESTADOS[p.estado] ?? ESTADOS.error;
                  return (
                    <div
                      key={p.prueba}
                      className="flex flex-wrap items-center gap-3 rounded-lg bg-slate-800/60 px-3 py-2"
                    >
                      <span
                        className={`flex h-9 w-12 shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                          p.puesto
                            ? "bg-amber-500/15 text-amber-400"
                            : "bg-slate-700/40 text-slate-600"
                        }`}
                        title={p.puesto ? "Puesto en el ranking acumulado" : e.texto}
                      >
                        {p.puesto ? `${p.puesto}º` : "—"}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm text-slate-100">{p.prueba}</p>
                        <p className={`text-xs ${p.puesto ? "text-slate-500" : e.clase}`}>
                          {p.puesto ? `${p.acumulado} pts acumulados` : e.texto}
                        </p>
                      </div>

                      <label className="sr-only" htmlFor={`ronda-${clave}`}>
                        Ronda alcanzada en {p.prueba}
                      </label>
                      <select
                        id={`ronda-${clave}`}
                        name={`ronda-${clave}`}
                        value={rondas[clave] ?? ""}
                        onChange={(ev) => setRondas({ ...rondas, [clave]: ev.target.value })}
                        className={`rounded-lg border bg-slate-800 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none ${
                          rondas[clave]
                            ? "border-indigo-700 text-indigo-300"
                            : "border-slate-700 text-slate-500"
                        }`}
                      >
                        {RONDAS.map((r) => (
                          <option key={r} value={r}>
                            {r || "¿hasta dónde llegaste?"}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {dePartidos.length > 0 && (
            <>
              <Card>
                <div className="flex flex-wrap items-center justify-around gap-6">
                  <Anillo
                    valor={stats.ganados}
                    total={stats.jugados}
                    etiqueta="Partidos ganados"
                    color="#10b981"
                  />
                  <Anillo
                    valor={stats.juegosAFavor}
                    total={stats.juegosAFavor + stats.juegosEnContra}
                    etiqueta="Juegos"
                    color="#818cf8"
                  />
                  <Anillo
                    valor={stats.puntosAFavor}
                    total={stats.puntosAFavor + stats.puntosEnContra}
                    etiqueta="Puntos"
                    color="#38bdf8"
                  />
                  <div className="space-y-3 text-sm">
                    <p className="text-slate-400">
                      Balance{" "}
                      <b className="text-slate-100">
                        {stats.ganados}–{stats.perdidos}
                      </b>
                    </p>
                    <p className="text-slate-400">
                      Juegos{" "}
                      <b className="text-slate-100">
                        {stats.juegosAFavor}–{stats.juegosEnContra}
                      </b>
                    </p>
                    <p className="text-slate-400">
                      Racha actual{" "}
                      <b className={rac.actual >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {rac.actual > 0 ? `+${rac.actual}` : rac.actual}
                      </b>
                    </p>
                    <p className="text-xs text-slate-500">
                      Mejor {rac.mejorRacha} · peor {rac.peorRacha}
                    </p>
                  </div>
                </div>
              </Card>

              {oficial?.jugados != null && (
                <Card
                  className={
                    oficial.jugados === stats.jugados && oficial.ganados === stats.ganados
                      ? "border-emerald-800 bg-emerald-500/5 text-xs text-emerald-300"
                      : "border-amber-800 bg-amber-500/10 text-xs text-amber-300"
                  }
                >
                  {oficial.jugados === stats.jugados && oficial.ganados === stats.ganados
                    ? `Cuadra con la ficha oficial de la RFETM: ${oficial.jugados} partidos, ${oficial.ganados} ganados, ${oficial.porcentaje}%.`
                    : `Ojo: la RFETM dice ${oficial.jugados} partidos y ${oficial.ganados} ganados, y aquí salen ${stats.jugados} y ${stats.ganados}. Vuelve a sincronizar.`}
                </Card>
              )}

              <Card>
                <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <Activity size={18} className="text-indigo-400" /> Evolución de la temporada
                </h2>
                <p className="mb-3 text-xs text-slate-500">
                  Porcentaje de victorias acumulado jornada a jornada: enseña la forma sin el
                  diente de sierra de ganar o perder un partido suelto.
                </p>
                <Linea
                  datos={jornadas}
                  valor={(d) => d.acumulado}
                  etiqueta={(d) => `J${d.jornada}`}
                  sufijo="%"
                  color="#818cf8"
                />
              </Card>

              <Card>
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <Trophy size={18} className="text-emerald-400" /> Resultados por jornada
                </h2>
                <BarrasApiladas datos={jornadas} />
                <div className="mt-2 flex justify-center gap-4 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" /> Ganados
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-rose-500/70" /> Perdidos
                  </span>
                </div>
              </Card>

              <div className="grid gap-4 lg:grid-cols-2">
                <Card>
                  <h2 className="mb-1 text-lg font-semibold text-slate-100">Rendimiento por set</h2>
                  <p className="mb-4 text-xs text-slate-500">
                    De los partidos que llegaron a cada set, cuántos ganaste.
                  </p>
                  <BarrasH
                    datos={sets.filter((s) => s.jugados > 0)}
                    valor={(d) => d.porcentaje}
                    etiqueta={(d) => `Set ${d.set}`}
                    detalle={(d) => `${d.ganados}/${d.jugados}`}
                    color="bg-sky-500"
                  />
                </Card>

                <Card>
                  <h2 className="mb-4 text-lg font-semibold text-slate-100">Momentos clave</h2>
                  <div className="space-y-4">
                    <Medidor
                      titulo="Remonto tras perder el 1er set"
                      valor={remo.tasaRemontada}
                      sub={`${remo.remontados} de ${remo.empezandoPerdiendo} partidos`}
                      color="bg-emerald-500"
                    />
                    <Medidor
                      titulo="Se me escapa tras ganar el 1er set"
                      valor={remo.tasaDerrumbe}
                      sub={`${remo.remontadosEnContra} de ${remo.empezandoGanando} partidos`}
                      color="bg-rose-500"
                    />
                    <Medidor
                      titulo="Sets ajustados (10-10 o más)"
                      valor={clu.tasaAjustados}
                      sub={`${clu.ajustadosGanados} de ${clu.ajustadosJugados} sets`}
                      color="bg-amber-500"
                    />
                    <Medidor
                      titulo="Quintos sets"
                      valor={clu.tasaQuintos}
                      sub={`${clu.quintosGanados} de ${clu.quintosJugados} partidos`}
                      color="bg-indigo-500"
                    />
                  </div>
                </Card>
              </div>

              {letras.length > 0 && (
                <Card>
                  <h2 className="mb-1 text-lg font-semibold text-slate-100">
                    Rendimiento por posición
                  </h2>
                  <p className="mb-4 text-xs text-slate-500">
                    Tu letra en la alineación determina contra qué número del rival juegas.
                  </p>
                  <BarrasH
                    datos={letras}
                    valor={(d) => d.porcentaje}
                    etiqueta={(d) => d.letra}
                    detalle={(d) => `${d.ganados}/${d.jugados}`}
                    color="bg-fuchsia-500"
                  />
                </Card>
              )}

              <Card>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <Users size={18} className="text-slate-400" /> Cara a cara
                </h2>
                <div className="space-y-2">
                  {rivales.map((r) => (
                    <div key={r.rival} className="flex items-center gap-3">
                      <span className="min-w-0 flex-1 truncate text-sm text-slate-200">
                        {r.rival}
                      </span>
                      <div className="flex h-5 w-28 shrink-0 overflow-hidden rounded bg-slate-800">
                        {r.ganados > 0 && (
                          <div
                            className="bg-emerald-500"
                            style={{ width: `${(r.ganados / r.jugados) * 100}%` }}
                          />
                        )}
                        {r.perdidos > 0 && (
                          <div
                            className="bg-rose-500/70"
                            style={{ width: `${(r.perdidos / r.jugados) * 100}%` }}
                          />
                        )}
                      </div>
                      <span className="w-12 shrink-0 text-right text-xs text-slate-400">
                        {r.ganados}–{r.perdidos}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="overflow-x-auto p-0">
                <h2 className="px-5 pt-4 text-lg font-semibold text-slate-100">Partidos</h2>
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="px-5 py-3 font-medium">J</th>
                      <th className="px-5 py-3 font-medium">Rival</th>
                      <th className="px-5 py-3 text-center font-medium">Res.</th>
                      <th className="px-5 py-3 font-medium">Sets</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...dePartidos]
                      .sort((a, b) => (b.jornada ?? 0) - (a.jornada ?? 0))
                      .map((p) => (
                        <tr key={p.id} className="border-b border-slate-800/60">
                          <td className="px-5 py-2.5 text-slate-400">{p.jornada}</td>
                          <td className="px-5 py-2.5">
                            <p className="text-slate-100">{p.rival}</p>
                            {p.fecha && <p className="text-xs text-slate-500">{p.fecha}</p>}
                          </td>
                          <td
                            className={`px-5 py-2.5 text-center font-semibold ${
                              p.ganado ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {p.juegosGanados}–{p.juegosPerdidos}
                          </td>
                          <td className="px-5 py-2.5 text-xs text-slate-400">
                            {p.sets.map((s) => s.join("-")).join("  ")}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </Card>
            </>
          )}

        </div>
      )}
    </div>
  );
}
