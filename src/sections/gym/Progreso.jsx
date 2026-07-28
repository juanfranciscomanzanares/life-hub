import { useState, useMemo } from "react";
import { TrendingUp, Trophy, History } from "lucide-react";
import { Card } from "../../lib/ui";
import { setsDe, volumen, recordsPorEjercicio, evolucion, fechasEntrenadas } from "../../lib/gym";

// Gráfica de barras sencilla, sin librerías externas.
function Barras({ puntos, valorDe, sufijo, color }) {
  const max = Math.max(...puntos.map(valorDe), 1);
  return (
    <div className="flex h-40 items-end justify-between gap-1.5 overflow-x-auto">
      {puntos.map((p) => {
        const v = valorDe(p);
        return (
          <div key={p.id ?? p.fecha} className="flex min-w-[2.2rem] flex-1 flex-col items-center gap-1.5">
            <span className="text-[10px] font-medium text-slate-400">
              {v.toLocaleString("es-ES")}
            </span>
            <div className="flex w-full flex-1 items-end">
              <div
                className={`w-full rounded-t-lg bg-gradient-to-t ${color}`}
                style={{ height: `${8 + (v / max) * 92}%` }}
                title={`${p.fecha}: ${v.toLocaleString("es-ES")}${sufijo}`}
              />
            </div>
            <span className="text-[10px] text-slate-500">{String(p.fecha).slice(5)}</span>
          </div>
        );
      })}
    </div>
  );
}

export default function Progreso({ filas, onVerDia }) {
  const [ejercicio, setEjercicio] = useState("");
  const [metrica, setMetrica] = useState("peso"); // "peso" | "volumen"
  const [verMax, setVerMax] = useState(12);

  const ejerciciosUsados = useMemo(
    () => [...new Set(filas.map((f) => f.ejercicio))].sort((a, b) => a.localeCompare(b)),
    [filas]
  );
  const elegido = ejercicio || ejerciciosUsados[0] || "";
  const puntos = useMemo(() => evolucion(filas, elegido), [filas, elegido]);
  const records = useMemo(() => recordsPorEjercicio(filas), [filas]);

  // Historial por día: volumen total y ejercicios hechos.
  const dias = useMemo(() => {
    return fechasEntrenadas(filas).map((fecha) => {
      const delDia = filas.filter((f) => f.fecha === fecha);
      return {
        fecha,
        ejercicios: delDia.length,
        series: delDia.reduce((t, f) => t + setsDe(f).length, 0),
        volumen: delDia.reduce((t, f) => t + volumen(setsDe(f)), 0),
        nombres: delDia.map((f) => f.ejercicio).join(", "),
      };
    });
  }, [filas]);

  if (filas.length === 0)
    return (
      <Card className="py-10 text-center text-sm text-slate-500">
        Todavía no hay entrenamientos registrados.
      </Card>
    );

  return (
    <div className="space-y-4">
      {ejerciciosUsados.length > 0 && (
        <Card>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
              <TrendingUp size={18} className="text-emerald-400" /> Progreso
            </h2>
            <div className="flex flex-wrap gap-2">
              <label className="sr-only" htmlFor="progreso-metrica">
                Qué medir
              </label>
              <select
                id="progreso-metrica"
                name="progreso-metrica"
                value={metrica}
                onChange={(e) => setMetrica(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                <option value="peso">Peso máximo</option>
                <option value="volumen">Volumen</option>
              </select>
              <label className="sr-only" htmlFor="progreso-ejercicio">
                Ejercicio
              </label>
              <select
                id="progreso-ejercicio"
                name="progreso-ejercicio"
                value={elegido}
                onChange={(e) => setEjercicio(e.target.value)}
                className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              >
                {ejerciciosUsados.map((ej) => (
                  <option key={ej}>{ej}</option>
                ))}
              </select>
            </div>
          </div>

          {puntos.length < 2 ? (
            <p className="py-6 text-center text-sm text-slate-500">
              Registra este ejercicio al menos dos días para ver la evolución.
            </p>
          ) : metrica === "peso" ? (
            <Barras
              puntos={puntos}
              valorDe={(p) => p.peso}
              sufijo=" kg"
              color="from-emerald-600 to-emerald-400"
            />
          ) : (
            <Barras
              puntos={puntos}
              valorDe={(p) => p.volumen}
              sufijo=" kg de volumen"
              color="from-indigo-600 to-indigo-400"
            />
          )}
        </Card>
      )}

      {records.length > 0 && (
        <Card className="overflow-x-auto p-0">
          <h2 className="flex items-center gap-2 px-5 pt-4 text-lg font-semibold text-slate-100">
            <Trophy size={18} className="text-amber-400" /> Récords personales
          </h2>
          <table className="mt-3 w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400">
                <th className="px-5 py-3 font-medium">Ejercicio</th>
                <th className="px-5 py-3 text-right font-medium">Mejor serie</th>
                <th className="px-5 py-3 text-right font-medium">1RM estimado</th>
              </tr>
            </thead>
            <tbody>
              {records.map(([ej, v]) => (
                <tr key={ej} className="border-b border-slate-800/60">
                  <td className="px-5 py-2.5 font-medium text-slate-100">
                    {ej}
                    {v.fecha && <span className="ml-2 text-xs text-slate-500">{v.fecha}</span>}
                  </td>
                  <td className="px-5 py-2.5 text-right text-emerald-400">
                    {v.peso} kg × {v.reps}
                  </td>
                  <td className="px-5 py-2.5 text-right text-slate-300">{Math.round(v.unaRM)} kg</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-5 py-3 text-xs text-slate-500">
            El 1RM estimado usa la fórmula de Epley y sale de la serie que más fuerza demuestra,
            que no siempre es la más pesada.
          </p>
        </Card>
      )}

      <Card className="overflow-x-auto p-0">
        <h2 className="flex items-center gap-2 px-5 pt-4 text-lg font-semibold text-slate-100">
          <History size={18} className="text-slate-400" /> Historial
        </h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-5 py-3 font-medium">Día</th>
              <th className="px-5 py-3 text-right font-medium">Ejercicios</th>
              <th className="px-5 py-3 text-right font-medium">Series</th>
              <th className="px-5 py-3 text-right font-medium">Volumen</th>
            </tr>
          </thead>
          <tbody>
            {dias.slice(0, verMax).map((d) => (
              <tr
                key={d.fecha}
                onClick={() => onVerDia(d.fecha)}
                className="cursor-pointer border-b border-slate-800/60 transition hover:bg-slate-800/40"
              >
                <td className="px-5 py-2.5">
                  <p className="font-medium text-slate-100">{d.fecha}</p>
                  <p className="truncate text-xs text-slate-500">{d.nombres}</p>
                </td>
                <td className="px-5 py-2.5 text-right text-slate-300">{d.ejercicios}</td>
                <td className="px-5 py-2.5 text-right text-slate-300">{d.series}</td>
                <td className="px-5 py-2.5 text-right text-emerald-400">
                  {d.volumen.toLocaleString("es-ES")} kg
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {dias.length > verMax && (
          <div className="border-t border-slate-800 p-3 text-center">
            <button
              onClick={() => setVerMax((n) => n + 12)}
              className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700"
            >
              Ver más ({dias.length - verMax} días restantes)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
