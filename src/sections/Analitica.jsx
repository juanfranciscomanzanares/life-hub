import { useState, useMemo } from "react";
import { BarChart3, ChevronLeft, ChevronRight, Lightbulb } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, MONTHS, fmtEuro } from "../lib/ui";

export default function Analitica() {
  const [year, setYear] = useState(new Date().getFullYear());
  const [work] = usePersisted("lh_work_log", []);
  const [gym] = usePersisted("lh_gym", []);
  const [contribs] = usePersisted("lh_contribs", []);
  const [health] = usePersisted("lh_health", []);

  const yearOf = (f) => Number((f || "").slice(0, 4));
  const monthOf = (f) => Number((f || "").slice(5, 7)) - 1;

  const { workByMonth, gymByMonth, maxW, maxG } = useMemo(() => {
    const w = Array(12).fill(0);
    const g = Array(12).fill(0);
    work.forEach((e) => { if (yearOf(e.fecha) === year) w[monthOf(e.fecha)] += Number(e.horas || 0); });
    gym.forEach((e) => { if (yearOf(e.fecha) === year) g[monthOf(e.fecha)] += 1; });
    return { workByMonth: w, gymByMonth: g, maxW: Math.max(...w, 1), maxG: Math.max(...g, 1) };
  }, [work, gym, year]);

  const sumYear = (arr, k, y) => arr.filter((e) => yearOf(e.fecha) === y).reduce((a, b) => a + Number(b[k] || 0), 0);
  const workThis = sumYear(work, "horas", year);
  const workPrev = sumYear(work, "horas", year - 1);
  const invThis = sumYear(contribs, "monto", year);
  const invPrev = sumYear(contribs, "monto", year - 1);

  const pctDiff = (a, b) => (b > 0 ? Math.round(((a - b) / b) * 100) : null);

  // Correlación sueño vs entrenar
  const gymDates = new Set(gym.map((x) => x.fecha));
  const avg = (arr) => (arr.length ? Math.round((arr.reduce((a, b) => a + b, 0) / arr.length) * 10) / 10 : 0);
  const suenoGym = avg(health.filter((h) => gymDates.has(h.fecha) && h.sueno).map((h) => Number(h.sueno)));
  const suenoNoGym = avg(health.filter((h) => !gymDates.has(h.fecha) && h.sueno).map((h) => Number(h.sueno)));

  const exportarGrafica = () => {
    const w = 680, h = 340, pad = 44;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#0f172a"; ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#e2e8f0"; ctx.font = "bold 16px Arial";
    ctx.fillText(`Horas de trabajo por mes · ${year}`, pad, 28);
    const bw = (w - pad * 2) / 12;
    workByMonth.forEach((v, i) => {
      const bh = (v / maxW) * (h - pad * 2 - 20);
      ctx.fillStyle = "#6366f1";
      ctx.fillRect(pad + i * bw + 4, h - pad - bh, bw - 8, bh);
      ctx.fillStyle = "#94a3b8"; ctx.font = "11px Arial";
      ctx.fillText(MONTHS[i][0], pad + i * bw + bw / 2 - 4, h - pad + 16);
      if (v) ctx.fillText(String(v), pad + i * bw + bw / 2 - 6, h - pad - bh - 4);
    });
    c.toBlob((b) => {
      const a = document.createElement("a");
      a.href = URL.createObjectURL(b);
      a.download = `trabajo-${year}.png`;
      a.click();
    });
  };

  const Bars = ({ data, max, unidad, color }) => (
    <div className="flex h-36 items-end justify-between gap-1">
      {data.map((v, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1">
          <div className="flex w-full flex-1 items-end">
            <div className={`w-full rounded-t ${color}`} style={{ height: `${(v / max) * 100}%` }} title={`${MONTHS[i]}: ${v}${unidad}`} />
          </div>
          <span className="text-[9px] text-slate-500">{MONTHS[i][0]}</span>
        </div>
      ))}
    </div>
  );

  const Kpi = ({ label, val, prev, unidad, money }) => {
    const d = pctDiff(val, prev);
    return (
      <Card>
        <p className="text-sm text-slate-400">{label}</p>
        <p className="text-2xl font-bold text-slate-100">{money ? fmtEuro(val) : `${val}${unidad || ""}`}</p>
        <p className={`text-xs ${d === null ? "text-slate-500" : d >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {d === null ? `sin datos de ${year - 1}` : `${d >= 0 ? "▲" : "▼"} ${Math.abs(d)}% vs ${year - 1}`}
        </p>
      </Card>
    );
  };

  return (
    <div>
      <SectionTitle icon={BarChart3} title="Analítica anual" subtitle="Compara años y descubre patrones" />

      <div className="mb-6 flex items-center justify-center gap-4">
        <button onClick={() => setYear(year - 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"><ChevronLeft size={18} /></button>
        <span className="text-lg font-bold text-slate-100">{year}</span>
        <button onClick={() => setYear(year + 1)} className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-300 hover:bg-slate-700"><ChevronRight size={18} /></button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4">
        <Kpi label={`Horas de trabajo ${year}`} val={workThis} prev={workPrev} unidad="h" />
        <Kpi label={`Invertido ${year}`} val={invThis} prev={invPrev} money />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-100">Horas de trabajo por mes</h2>
            <button onClick={exportarGrafica} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1 text-xs font-medium text-slate-300 transition hover:border-indigo-500">Descargar imagen</button>
          </div>
          <Bars data={workByMonth} max={maxW} unidad="h" color="bg-gradient-to-t from-indigo-600 to-indigo-400" />
        </Card>
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Sesiones de gym por mes</h2>
          <Bars data={gymByMonth} max={maxG} unidad="" color="bg-gradient-to-t from-emerald-600 to-emerald-400" />
        </Card>
      </div>

      <Card>
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100"><Lightbulb size={18} className="text-amber-400" /> Patrones</h2>
        {suenoGym && suenoNoGym ? (
          <p className="text-sm text-slate-300">
            Duermes de media <b className="text-emerald-400">{suenoGym}h</b> los días que entrenas frente a <b>{suenoNoGym}h</b> los que no.
            {suenoGym > suenoNoGym ? " Entrenar parece ayudarte a descansar mejor." : " Los días de entreno descansas algo menos, ojo con la recuperación."}
          </p>
        ) : (
          <p className="text-sm text-slate-500">Registra sueño (en Salud) y marcas de gym para ver correlaciones entre entrenar y descansar.</p>
        )}
      </Card>
    </div>
  );
}
