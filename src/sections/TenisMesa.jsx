import { useState, useMemo } from "react";
import { Target, RefreshCw, Settings, Trophy, TrendingUp, Users } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle } from "../lib/ui";
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
import { sincronizarLiga, sincronizarOpens, fusionar } from "../lib/tenisSync";

/*
  Tenis de mesa: partidos de liga (RFETM) y puestos en los opens (FTMRM),
  descargados de las webs de las federaciones y separados por temporada.

  Los datos crudos se guardan tal cual y las estadísticas se calculan al
  vuelo, para poder cambiar los cálculos sin volver a bajar nada.
*/

const CONFIG_INICIAL = {
  licencia: "",
  nombre: "",
  temporada: "2025-2026",
  tempoNum: "11",
};

function Barras({ datos, valor, etiqueta, color, sufijo = "" }) {
  const max = Math.max(...datos.map(valor), 1);
  return (
    <div className="flex h-40 items-end justify-between gap-1.5 overflow-x-auto">
      {datos.map((d, i) => {
        const v = valor(d);
        return (
          <div key={i} className="flex min-w-[2rem] flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-medium text-slate-400">{v}{sufijo}</span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-lg bg-gradient-to-t ${color}`}
                style={{ height: `${6 + (v / max) * 94}%` }}
                title={`${etiqueta(d)}: ${v}${sufijo}`}
              />
            </div>
            <span className="text-[10px] text-slate-500">{etiqueta(d)}</span>
          </div>
        );
      })}
    </div>
  );
}

// Ganados y perdidos apilados por jornada.
function Apiladas({ datos }) {
  const max = Math.max(...datos.map((d) => d.jugados), 1);
  return (
    <div className="flex h-40 items-end justify-between gap-1.5 overflow-x-auto">
      {datos.map((d) => (
        <div key={d.jornada} className="flex min-w-[2rem] flex-1 flex-col items-center gap-1.5">
          <span className="text-[10px] font-medium text-emerald-400">{d.ganados}</span>
          <div className="flex w-full flex-1 flex-col justify-end">
            <div
              className="w-full rounded-t-lg bg-emerald-500"
              style={{ height: `${(d.ganados / max) * 100}%` }}
              title={`J${d.jornada}: ${d.ganados} ganados`}
            />
            <div
              className="w-full bg-rose-500/70"
              style={{ height: `${((d.jugados - d.ganados) / max) * 100}%` }}
              title={`J${d.jornada}: ${d.jugados - d.ganados} perdidos`}
            />
          </div>
          <span className="text-[10px] text-slate-500">J{d.jornada}</span>
        </div>
      ))}
    </div>
  );
}

export default function TenisMesa() {
  const [config, setConfig] = usePersisted("lh_tenis_config", CONFIG_INICIAL);
  const [partidos, setPartidos] = usePersisted("lh_tenis_partidos", []);
  const [opens, setOpens] = usePersisted("lh_tenis_opens", []);
  const [oficiales, setOficiales] = usePersisted("lh_tenis_oficiales", {});

  const [ajustes, setAjustes] = useState(!config.licencia);
  const [estado, setEstado] = useState(null);
  const [error, setError] = useState(null);
  const [temporadaVista, setTemporadaVista] = useState(config.temporada);

  const temporadas = useMemo(() => {
    const t = new Set([...partidos, ...opens].map((x) => x.temporada).filter(Boolean));
    t.add(config.temporada);
    return [...t].sort().reverse();
  }, [partidos, opens, config.temporada]);

  const activa = temporadas.includes(temporadaVista) ? temporadaVista : temporadas[0];
  const dePartidos = useMemo(
    () => partidos.filter((p) => p.temporada === activa),
    [partidos, activa]
  );
  const deOpens = useMemo(() => opens.filter((o) => o.temporada === activa), [opens, activa]);

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
      setPartidos((p) => fusionar(p, liga.partidos));
      setOficiales((o) => ({ ...o, [config.temporada]: liga.oficiales }));

      let avisoOpens = "";
      if (config.nombre) {
        setEstado("Leyendo los rankings de los opens...");
        const res = await sincronizarOpens({
          nombre: config.nombre,
          temporada: config.temporada,
          alProgresar: (hechas, total) => setEstado(`Rankings... ${hechas} de ${total}`),
        });
        setOpens((o) => fusionar(o, res.resultados));
        if (res.resultados.length === 0)
          avisoOpens = " No apareces en los rankings de esa temporada.";
      }

      setTemporadaVista(config.temporada);
      setEstado(`Listo: ${liga.partidos.length} partidos de liga.` + avisoOpens);
    } catch (e) {
      setError(e.message || String(e));
      setEstado(null);
    }
  };

  const campo =
    "w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  const cargando = estado && !/^Listo|^Ya estaba/.test(estado);

  return (
    <div>
      <SectionTitle icon={Target} title="Tenis de Mesa" subtitle="Liga nacional y opens regionales" />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label htmlFor="tenis-temporada" className="text-sm text-slate-400">
          Temporada
        </label>
        <select
          id="tenis-temporada"
          name="tenis-temporada"
          value={activa}
          onChange={(e) => setTemporadaVista(e.target.value)}
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
        >
          {temporadas.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>

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

      {ajustes && (
        <Card className="mb-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Tus datos federativos</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="t-lic" className="mb-1 block text-xs text-slate-400">
                Nº de licencia (aparece en las actas)
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
                Nombre para los rankings de opens
              </label>
              <input
                id="t-nom"
                name="t-nom"
                value={config.nombre}
                onChange={(e) => setConfig({ ...config, nombre: e.target.value })}
                placeholder="Manzanares"
                className={campo}
              />
            </div>
            <div>
              <label htmlFor="t-temp" className="mb-1 block text-xs text-slate-400">
                Temporada a sincronizar
              </label>
              <input
                id="t-temp"
                name="t-temp"
                value={config.temporada}
                onChange={(e) => setConfig({ ...config, temporada: e.target.value.trim() })}
                placeholder="2025-2026"
                className={campo}
              />
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            No hace falta división ni grupo: la RFETM tiene una ficha por jugador que devuelve toda
            tu temporada de una vez, con los totales oficiales incluidos.
          </p>
        </Card>
      )}

      {dePartidos.length === 0 && deOpens.length === 0 ? (
        <Card className="py-10 text-center text-sm text-slate-500">
          {config.licencia
            ? "Nada todavía para esta temporada. Pulsa Sincronizar."
            : "Pon tu número de licencia en Ajustes y pulsa Sincronizar."}
        </Card>
      ) : (
        <div className="space-y-4">
          {dePartidos.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  { l: "Partidos", v: stats.jugados, c: "text-slate-100" },
                  { l: "Ganados", v: stats.ganados, c: "text-emerald-400" },
                  { l: "% victorias", v: `${stats.porcentaje}%`, c: "text-indigo-400" },
                  { l: "Juegos", v: `${stats.juegosAFavor}-${stats.juegosEnContra}`, c: "text-slate-100" },
                ].map((k) => (
                  <Card key={k.l} className="text-center">
                    <p className="text-xs text-slate-500">{k.l}</p>
                    <p className={`text-2xl font-bold ${k.c}`}>{k.v}</p>
                  </Card>
                ))}
              </div>

              {/*
                Contraste con los totales que publica la federación. Si algún día
                el parseo se desalinea, se verá aquí en vez de pasar inadvertido.
              */}
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
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <Trophy size={18} className="text-emerald-400" /> Resultados por jornada
                </h2>
                <Apiladas datos={jornadas} />
                <p className="mt-2 text-center text-xs text-slate-500">
                  Verde ganados, rojo perdidos
                </p>
              </Card>

              <Card>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <TrendingUp size={18} className="text-indigo-400" /> Rendimiento acumulado
                </h2>
                <Barras
                  datos={jornadas}
                  valor={(d) => d.acumulado}
                  etiqueta={(d) => `J${d.jornada}`}
                  color="from-indigo-600 to-indigo-400"
                  sufijo="%"
                />
                <p className="mt-2 text-center text-xs text-slate-500">
                  Porcentaje de victorias acumulado: enseña la forma a lo largo de la temporada, sin
                  el diente de sierra de ganar o perder un partido suelto.
                </p>
              </Card>

              <Card>
                <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold text-slate-100">
                  <TrendingUp size={18} className="text-emerald-400" /> Juegos por jornada
                </h2>
                <Barras
                  datos={jornadas}
                  valor={(d) => d.juegosAFavor}
                  etiqueta={(d) => `J${d.jornada}`}
                  color="from-emerald-600 to-emerald-400"
                />
              </Card>

              <Card>
                <h2 className="mb-1 text-lg font-semibold text-slate-100">Rendimiento por set</h2>
                <p className="mb-4 text-xs text-slate-500">
                  De los partidos que llegaron a cada set, cuántos ganaste. Dice si empiezas fuerte,
                  si te vienes abajo o si aguantas los finales.
                </p>
                <Barras
                  datos={sets.filter((s) => s.jugados > 0)}
                  valor={(d) => d.porcentaje}
                  etiqueta={(d) => `Set ${d.set}`}
                  color="from-sky-600 to-sky-400"
                  sufijo="%"
                />
              </Card>

              <div className="grid gap-3 sm:grid-cols-2">
                <Card>
                  <h2 className="mb-3 text-lg font-semibold text-slate-100">Remontadas</h2>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-300">
                      Perdiendo el 1er set:{" "}
                      <b className="text-emerald-400">
                        {remo.remontados} de {remo.empezandoPerdiendo}
                      </b>{" "}
                      remontados <span className="text-slate-500">({remo.tasaRemontada}%)</span>
                    </p>
                    <p className="text-slate-300">
                      Ganando el 1er set:{" "}
                      <b className="text-rose-400">
                        {remo.remontadosEnContra} de {remo.empezandoGanando}
                      </b>{" "}
                      se escaparon <span className="text-slate-500">({remo.tasaDerrumbe}%)</span>
                    </p>
                  </div>
                </Card>

                <Card>
                  <h2 className="mb-3 text-lg font-semibold text-slate-100">Momentos clave</h2>
                  <div className="space-y-2 text-sm">
                    <p className="text-slate-300">
                      Sets ajustados (10-10 o más):{" "}
                      <b className="text-slate-100">
                        {clu.ajustadosGanados}/{clu.ajustadosJugados}
                      </b>{" "}
                      <span className="text-slate-500">({clu.tasaAjustados}%)</span>
                    </p>
                    <p className="text-slate-300">
                      Quintos sets:{" "}
                      <b className="text-slate-100">
                        {clu.quintosGanados}/{clu.quintosJugados}
                      </b>{" "}
                      <span className="text-slate-500">({clu.tasaQuintos}%)</span>
                    </p>
                    <p className="text-slate-300">
                      Rachas: mejor <b className="text-emerald-400">{rac.mejorRacha}</b>, peor{" "}
                      <b className="text-rose-400">{rac.peorRacha}</b>, actual{" "}
                      <b className={rac.actual >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {rac.actual > 0 ? `+${rac.actual}` : rac.actual}
                      </b>
                    </p>
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
                  <Barras
                    datos={letras}
                    valor={(d) => d.porcentaje}
                    etiqueta={(d) => d.letra}
                    color="from-fuchsia-500 to-fuchsia-400"
                    sufijo="%"
                  />
                </Card>
              )}

              <Card className="overflow-x-auto p-0">
                <h2 className="flex items-center gap-2 px-5 pt-4 text-lg font-semibold text-slate-100">
                  <Users size={18} className="text-slate-400" /> Cara a cara
                </h2>
                <table className="mt-3 w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400">
                      <th className="px-5 py-3 font-medium">Rival</th>
                      <th className="px-5 py-3 text-right font-medium">G</th>
                      <th className="px-5 py-3 text-right font-medium">P</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rivales.map((r) => (
                      <tr key={r.rival} className="border-b border-slate-800/60">
                        <td className="px-5 py-2.5 text-slate-100">{r.rival}</td>
                        <td className="px-5 py-2.5 text-right text-emerald-400">{r.ganados}</td>
                        <td className="px-5 py-2.5 text-right text-rose-400">{r.perdidos}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
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
                            <p className="text-xs text-slate-500">{p.equipoRival}</p>
                          </td>
                          <td
                            className={`px-5 py-2.5 text-center font-semibold ${
                              p.ganado ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            {p.juegosGanados}-{p.juegosPerdidos}
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

          {deOpens.length > 0 && (
            <Card className="overflow-x-auto p-0">
              <h2 className="flex items-center gap-2 px-5 pt-4 text-lg font-semibold text-slate-100">
                <Trophy size={18} className="text-amber-400" /> Opens regionales
              </h2>
              <table className="mt-3 w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="px-5 py-3 font-medium">Prueba</th>
                    <th className="px-5 py-3 font-medium">Categoría</th>
                    <th className="px-5 py-3 text-right font-medium">Puesto</th>
                    <th className="px-5 py-3 text-right font-medium">Puntos</th>
                  </tr>
                </thead>
                <tbody>
                  {deOpens.map((o) => (
                    <tr key={o.id} className="border-b border-slate-800/60">
                      <td className="px-5 py-2.5 text-slate-100">{o.prueba}</td>
                      <td className="px-5 py-2.5 text-slate-400">{o.categoria}</td>
                      <td className="px-5 py-2.5 text-right text-indigo-400">{o.puesto}º</td>
                      <td className="px-5 py-2.5 text-right text-emerald-400">{o.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
