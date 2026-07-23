import { useState } from "react";
import { LineChart, Coins, Wallet, TrendingUp, TrendingDown, BarChart3, PiggyBank, Plus, Trash2, RefreshCw } from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { Card, SectionTitle, fmtEuro } from "../lib/ui";

const INVEST_TYPES = ["Fondo indexado", "ETF", "Acciones", "Cripto", "Plan de pensiones", "Cuenta remunerada", "Otro"];
const INITIAL_INVEST = [
  { id: 1, nombre: "MSCI World (fondo indexado)", tipo: "Fondo indexado", aportado: 600, valorActual: 648 },
  { id: 2, nombre: "S&P 500 ETF", tipo: "ETF", aportado: 300, valorActual: 291 },
  { id: 3, nombre: "Bitcoin", tipo: "Cripto", aportado: 150, valorActual: 205, coingeckoId: "bitcoin", cantidad: 0.003 },
];
const INITIAL_CONTRIBS = [
  { id: 1, fecha: "2026-07-05", monto: 150, destino: "MSCI World (fondo indexado)" },
  { id: 2, fecha: "2026-07-05", monto: 50, destino: "Bitcoin" },
  { id: 3, fecha: "2026-06-05", monto: 150, destino: "MSCI World (fondo indexado)" },
];
const INITIAL_INVEST_GOAL = 200;

export default function Inversiones() {
  const [holdings, setHoldings] = usePersisted("lh_investments", INITIAL_INVEST);
  const [contribs, setContribs] = usePersisted("lh_contribs", INITIAL_CONTRIBS);
  const [goal, setGoal] = usePersisted("lh_invest_goal", INITIAL_INVEST_GOAL);
  const [form, setForm] = useState({ nombre: "", tipo: INVEST_TYPES[0], aportado: "", coingeckoId: "", cantidad: "", ticker: "" });
  const [aporte, setAporte] = useState({});
  const [divInput, setDivInput] = useState({});
  const cobrarDividendo = (h) => {
    const m = Number(divInput[h.id]) || 0;
    if (m <= 0) return;
    setHoldings(holdings.map((x) => (x.id === h.id ? { ...x, dividendos: (Number(x.dividendos) || 0) + m } : x)));
    setDivInput({ ...divInput, [h.id]: "" });
  };
  const [precios, setPrecios] = useState({ cargando: false, msg: "" });
  const [verMaxC, setVerMaxC] = useState(12);

  const totalAportado = holdings.reduce((a, b) => a + Number(b.aportado || 0), 0);
  const totalActual = holdings.reduce((a, b) => a + Number(b.valorActual || 0), 0);
  const pl = totalActual - totalAportado;
  const plPct = totalAportado > 0 ? (pl / totalAportado) * 100 : 0;

  const thisMonth = new Date().toISOString().slice(0, 7);
  const investedThisMonth = contribs.filter((c) => c.fecha.slice(0, 7) === thisMonth).reduce((a, b) => a + Number(b.monto || 0), 0);
  const goalPct = goal > 0 ? Math.min(100, (investedThisMonth / goal) * 100) : 0;
  const totalDiv = holdings.reduce((a, b) => a + Number(b.dividendos || 0), 0);
  const rentTotal = totalAportado > 0 ? ((totalActual - totalAportado + totalDiv) / totalAportado) * 100 : 0;

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  const typeColor = (t) =>
    ({
      "Fondo indexado": "bg-indigo-500/15 text-indigo-300",
      ETF: "bg-emerald-500/15 text-emerald-300",
      Acciones: "bg-amber-500/15 text-amber-300",
      Cripto: "bg-fuchsia-500/15 text-fuchsia-300",
      "Plan de pensiones": "bg-sky-500/15 text-sky-300",
      "Cuenta remunerada": "bg-teal-500/15 text-teal-300",
    }[t] || "bg-slate-700 text-slate-300");

  // Actualiza el valor de los activos cripto con precios reales de CoinGecko
  const actualizarPrecios = async () => {
    const cryptos = holdings.filter((h) => h.coingeckoId && h.cantidad);
    if (cryptos.length === 0) {
      setPrecios({ cargando: false, msg: "No hay activos cripto con id de CoinGecko y cantidad." });
      return;
    }
    setPrecios({ cargando: true, msg: "" });
    try {
      const ids = [...new Set(cryptos.map((h) => h.coingeckoId))].join(",");
      const res = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=eur`);
      if (!res.ok) throw new Error("respuesta " + res.status);
      const data = await res.json();
      setHoldings(
        holdings.map((h) => {
          const precio = h.coingeckoId && data[h.coingeckoId] ? data[h.coingeckoId].eur : null;
          return precio && h.cantidad ? { ...h, valorActual: Math.round(precio * h.cantidad * 100) / 100 } : h;
        })
      );
      setPrecios({ cargando: false, msg: `Precios actualizados (${new Date().toLocaleTimeString("es-ES")}).` });
    } catch (e) {
      setPrecios({ cargando: false, msg: "No se pudieron obtener los precios: " + e.message });
    }
  };

  // Actualiza acciones/ETF llamando a la Edge Function (precios reales con clave secreta)
  const actualizarAcciones = async () => {
    const base = import.meta.env.VITE_FUNCTIONS_URL;
    const conTicker = holdings.filter((h) => h.ticker && h.cantidad);
    if (!base) { setPrecios({ cargando: false, msg: "Configura VITE_FUNCTIONS_URL y despliega la función stock-price (ver docs/INTEGRACIONES.md)." }); return; }
    if (conTicker.length === 0) { setPrecios({ cargando: false, msg: "No hay acciones/ETF con ticker y cantidad." }); return; }
    setPrecios({ cargando: true, msg: "" });
    try {
      const tickers = [...new Set(conTicker.map((h) => h.ticker))].join(",");
      const res = await fetch(`${base}/stock-price?tickers=${tickers}`);
      if (!res.ok) throw new Error("respuesta " + res.status);
      const data = await res.json();
      setHoldings(holdings.map((h) => {
        const precio = h.ticker && data[h.ticker];
        return precio && h.cantidad ? { ...h, valorActual: Math.round(precio * h.cantidad * 100) / 100 } : h;
      }));
      setPrecios({ cargando: false, msg: `Acciones actualizadas (${new Date().toLocaleTimeString("es-ES")}).` });
    } catch (e) {
      setPrecios({ cargando: false, msg: "No se pudieron obtener las acciones: " + e.message });
    }
  };

  const addHolding = () => {
    if (!form.nombre.trim()) return;
    const amount = Number(form.aportado) || 0;
    const h = { id: Date.now(), nombre: form.nombre, tipo: form.tipo, aportado: amount, valorActual: amount };
    if (form.tipo === "Cripto") {
      if (form.coingeckoId) h.coingeckoId = form.coingeckoId.trim().toLowerCase();
      if (form.cantidad) h.cantidad = Number(form.cantidad);
    }
    if ((form.tipo === "Acciones" || form.tipo === "ETF") && form.ticker) {
      h.ticker = form.ticker.trim().toUpperCase();
      if (form.cantidad) h.cantidad = Number(form.cantidad);
    }
    setHoldings([...holdings, h]);
    if (amount > 0)
      setContribs([{ id: Date.now() + 1, fecha: new Date().toISOString().slice(0, 10), monto: amount, destino: form.nombre }, ...contribs]);
    setForm({ nombre: "", tipo: INVEST_TYPES[0], aportado: "", coingeckoId: "", cantidad: "", ticker: "" });
  };

  const aportar = (h) => {
    const amount = Number(aporte[h.id]) || 0;
    if (amount <= 0) return;
    setHoldings(holdings.map((x) => (x.id === h.id ? { ...x, aportado: x.aportado + amount, valorActual: x.valorActual + amount } : x)));
    setContribs([{ id: Date.now(), fecha: new Date().toISOString().slice(0, 10), monto: amount, destino: h.nombre }, ...contribs]);
    setAporte({ ...aporte, [h.id]: "" });
  };

  const setValor = (id, v) => setHoldings(holdings.map((x) => (x.id === id ? { ...x, valorActual: Number(v) || 0 } : x)));

  return (
    <div>
      <SectionTitle icon={LineChart} title="Inversiones" subtitle="Aporta desde tu sueldo y sigue tu cartera" />

      {/* Resumen */}
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400"><Coins size={24} /></div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{fmtEuro(totalAportado)}</p>
            <p className="text-sm text-slate-400">Aportado</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400"><Wallet size={24} /></div>
          <div>
            <p className="text-2xl font-bold text-slate-100">{fmtEuro(totalActual)}</p>
            <p className="text-sm text-slate-400">Valor actual</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${pl >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}>
            {pl >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
          </div>
          <div>
            <p className={`text-2xl font-bold ${pl >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{pl >= 0 ? "+" : ""}{fmtEuro(pl)}</p>
            <p className="text-sm text-slate-400">Ganancia / pérdida</p>
          </div>
        </Card>
        <Card className="flex items-center gap-4">
          <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${plPct >= 0 ? "bg-emerald-500/15 text-emerald-400" : "bg-rose-500/15 text-rose-400"}`}><BarChart3 size={24} /></div>
          <div>
            <p className={`text-2xl font-bold ${plPct >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{plPct >= 0 ? "+" : ""}{plPct.toFixed(1)}%</p>
            <p className="text-sm text-slate-400">Rentabilidad</p>
            {totalDiv > 0 && <p className="text-[10px] text-emerald-400">Con dividendos: {rentTotal >= 0 ? "+" : ""}{rentTotal.toFixed(1)}%</p>}
          </div>
        </Card>
      </div>

      {/* Objetivo mensual */}
      <Card className="mb-6">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100"><PiggyBank size={18} className="text-fuchsia-400" /> Aportación de este mes</h2>
          <div className="flex items-center gap-2 text-sm text-slate-400">
            <span>Objetivo mensual:</span>
            <input type="number" value={goal} onChange={(e) => setGoal(Number(e.target.value) || 0)} className={`w-20 ${inputCls}`} />
            <span>€</span>
          </div>
        </div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
          <div className="h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500" style={{ width: `${goalPct}%` }} />
        </div>
        <p className="mt-2 text-xs text-slate-500">Llevas {fmtEuro(investedThisMonth)} invertidos este mes de un objetivo de {fmtEuro(goal)}.</p>
      </Card>

      {/* Alta */}
      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Añadir inversión</h2>
        <div className="flex flex-wrap items-end gap-3">
          <input placeholder="Nombre (p. ej. Fondo Amundi World)" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value })} className={`flex-1 ${inputCls}`} />
          <select value={form.tipo} onChange={(e) => setForm({ ...form, tipo: e.target.value })} className={inputCls}>
            {INVEST_TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
          <input type="number" placeholder="Importe inicial €" value={form.aportado} onChange={(e) => setForm({ ...form, aportado: e.target.value })} className={`w-32 ${inputCls}`} />
          <button onClick={addHolding} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">Añadir</button>
        </div>
        {form.tipo === "Cripto" && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-800/40 p-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-400">ID de CoinGecko (p. ej. bitcoin, ethereum, solana)</label>
              <input placeholder="bitcoin" value={form.coingeckoId} onChange={(e) => setForm({ ...form, coingeckoId: e.target.value })} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Cantidad (unidades)</label>
              <input type="number" step="any" placeholder="0.003" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} className={`w-32 ${inputCls}`} />
            </div>
          </div>
        )}
        {(form.tipo === "Acciones" || form.tipo === "ETF") && (
          <div className="mt-3 flex flex-wrap items-end gap-3 rounded-lg border border-slate-800 bg-slate-800/40 p-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs text-slate-400">Ticker (p. ej. AAPL, MSFT, VWCE)</label>
              <input placeholder="AAPL" value={form.ticker} onChange={(e) => setForm({ ...form, ticker: e.target.value })} className={`w-full ${inputCls}`} />
            </div>
            <div>
              <label className="mb-1 block text-xs text-slate-400">Cantidad (participaciones)</label>
              <input type="number" step="any" placeholder="2" value={form.cantidad} onChange={(e) => setForm({ ...form, cantidad: e.target.value })} className={`w-32 ${inputCls}`} />
            </div>
          </div>
        )}
      </Card>

      {/* Cartera */}
      <div className="mb-3 flex flex-wrap justify-end gap-2">
        <button onClick={actualizarPrecios} disabled={precios.cargando} className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400 disabled:opacity-60">
          <RefreshCw size={15} className={precios.cargando ? "animate-spin" : ""} /> Actualizar cripto
        </button>
        <button onClick={actualizarAcciones} disabled={precios.cargando} className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500 disabled:opacity-60">
          <RefreshCw size={15} className={precios.cargando ? "animate-spin" : ""} /> Actualizar acciones
        </button>
      </div>
      {precios.msg && <p className="mb-3 text-right text-xs text-slate-400">{precios.msg}</p>}

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        {holdings.map((h) => {
          const gain = h.valorActual - h.aportado;
          const gainPct = h.aportado > 0 ? (gain / h.aportado) * 100 : 0;
          const weight = totalActual > 0 ? (h.valorActual / totalActual) * 100 : 0;
          return (
            <Card key={h.id}>
              <div className="mb-2 flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-slate-100">{h.nombre}</h3>
                  <span className={`mt-1 inline-block rounded-md px-2 py-0.5 text-xs font-medium ${typeColor(h.tipo)}`}>{h.tipo}</span>
                  {h.coingeckoId && <span className="ml-2 text-xs text-slate-500">{h.cantidad} ud · {h.coingeckoId}</span>}
                </div>
                <button onClick={() => removeWithUndo(holdings, setHoldings, h.id, "Inversión")} className="text-slate-500 transition hover:text-rose-400"><Trash2 size={16} /></button>
              </div>
              <div className="mb-3 grid grid-cols-3 gap-2 text-sm">
                <div>
                  <p className="text-xs text-slate-500">Aportado</p>
                  <p className="font-semibold text-slate-200">{fmtEuro(h.aportado)}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">Valor actual</p>
                  <input type="number" value={h.valorActual} onChange={(e) => setValor(h.id, e.target.value)} className="w-24 rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-sm font-semibold text-slate-100 focus:border-indigo-500 focus:outline-none" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Resultado</p>
                  <p className={`font-semibold ${gain >= 0 ? "text-emerald-400" : "text-rose-400"}`}>{gain >= 0 ? "+" : ""}{fmtEuro(gain)} ({gainPct >= 0 ? "+" : ""}{gainPct.toFixed(1)}%)</p>
                </div>
              </div>
              {(h.cantidad || h.dividendos) ? (
                <p className="mb-3 text-xs text-slate-500">
                  {h.cantidad ? `Precio medio: ${fmtEuro(h.aportado / h.cantidad)}` : ""}
                  {h.dividendos ? `${h.cantidad ? " · " : ""}Dividendos: ${fmtEuro(h.dividendos)}` : ""}
                </p>
              ) : null}
              <div className="mb-3">
                <div className="mb-1 flex justify-between text-xs text-slate-500"><span>Peso en la cartera</span><span>{weight.toFixed(0)}%</span></div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${weight}%` }} /></div>
              </div>
              <div className="flex gap-2">
                <input type="number" placeholder="Aportar €" value={aporte[h.id] || ""} onChange={(e) => setAporte({ ...aporte, [h.id]: e.target.value })} className={`flex-1 ${inputCls}`} />
                <button onClick={() => aportar(h)} className="flex items-center gap-1 rounded-lg bg-emerald-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400"><Plus size={15} /> Aportar</button>
              </div>
              <div className="mt-2 flex gap-2">
                <input type="number" placeholder="Dividendo €" value={divInput[h.id] || ""} onChange={(e) => setDivInput({ ...divInput, [h.id]: e.target.value })} className={`flex-1 ${inputCls}`} />
                <button onClick={() => cobrarDividendo(h)} className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500">Cobrar div.</button>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Registro de aportaciones */}
      <Card className="overflow-x-auto p-0">
        <div className="flex items-center gap-2 px-5 pt-4 text-slate-100"><Coins size={18} className="text-amber-400" /><h2 className="text-lg font-semibold">Registro de aportaciones</h2></div>
        <table className="mt-3 w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              <th className="px-5 py-3 font-medium">Fecha</th>
              <th className="px-5 py-3 font-medium">Destino</th>
              <th className="px-5 py-3 text-right font-medium">Importe</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {contribs.length === 0 && (
              <tr><td colSpan={4} className="px-5 py-4 text-center text-slate-500">Aún no has registrado aportaciones.</td></tr>
            )}
            {contribs.slice(0, verMaxC).map((c) => (
              <tr key={c.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-5 py-3 text-slate-400">{c.fecha}</td>
                <td className="px-5 py-3 text-slate-200">{c.destino}</td>
                <td className="px-5 py-3 text-right font-semibold text-emerald-400">+{fmtEuro(c.monto)}</td>
                <td className="px-5 py-3 text-right"><button onClick={() => removeWithUndo(contribs, setContribs, c.id, "Aportación")} className="text-slate-500 transition hover:text-rose-400"><Trash2 size={15} /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
        {contribs.length > verMaxC && (
          <div className="border-t border-slate-800 p-3 text-center">
            <button onClick={() => setVerMaxC((n) => n + 12)} className="rounded-lg bg-slate-800 px-4 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700">
              Ver más ({contribs.length - verMaxC} restantes)
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
