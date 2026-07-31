import { useState, useMemo, lazy, Suspense } from "react";
import { Trash2, Wallet, PiggyBank, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, Skeleton, todayISO, fmtEuro } from "../lib/ui";
import { Cifra } from "../lib/animar";
import { CATEGORIAS as CATEGORIAS_BANCO } from "../lib/banco";
import { redondear } from "../lib/numeros";
import { removeWithUndo } from "../lib/toast";
import { etiquetaMes } from "../lib/meses";

import { nuevoId } from "../lib/id";
/*
  Solo el valor de partida: el presupuesto real se edita en la sección y se
  guarda en `lh_budget_mensual`.
*/
const PRESUPUESTO_INICIAL = 800;
const INITIAL_FINANCE = [];

// La conexión bancaria vive dentro de Finanzas, pero solo la usa quien la
// tenga configurada: en diferido no entra en el trozo de quien no la abre.
const Banco = lazy(() => import("./finanzas/Banco.jsx"));

/*
  Finanzas va por MES natural: los ingresos, los gastos, el balance y el
  presupuesto son siempre los del mes que estés mirando, y el día 1 empiezan de
  cero solos. Antes los totales sumaban todo el histórico mientras el texto
  decía "este mes", así que a los pocos meses el presupuesto salía siempre
  desbordado.

  Lo que NO se reinicia: los objetivos de ahorro, las suscripciones y los topes
  por categoría, que son configuración y no movimientos del mes.
*/
function Finanzas() {
  const [rows, setRows] = usePersisted("lh_finance", INITIAL_FINANCE);
  const [form, setForm] = useState({ concepto: "", categoria: "Ocio", monto: "", fecha: todayISO() });
  const [tipo, setTipo] = useState("gasto");

  const [mes, setMes] = useState(() => todayISO().slice(0, 7));
  const [verTodo, setVerTodo] = useState(false);
  const esMesActual = mes === todayISO().slice(0, 7);

  const moverMes = (delta) => {
    const [y, m] = mes.split("-").map(Number);
    const d = new Date(y, m - 1 + delta, 1);
    setMes(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  };

  const rowsMes = useMemo(() => rows.filter((r) => (r.fecha || "").slice(0, 7) === mes), [rows, mes]);

  // redondear() en cada total: sumar importes con decimales arrastra restos de
  // coma flotante (600.9000000000001) que se veían tal cual en las tarjetas.
  const income = redondear(rowsMes.filter((r) => r.monto > 0).reduce((a, b) => a + b.monto, 0));
  const expenses = redondear(rowsMes.filter((r) => r.monto < 0).reduce((a, b) => a + Math.abs(b.monto), 0));
  const balance = redondear(income - expenses);

  const [presupuesto, setPresupuesto] = usePersisted("lh_budget_mensual", PRESUPUESTO_INICIAL);
  const budgetPct = presupuesto > 0 ? Math.min(100, (expenses / presupuesto) * 100) : 0;
  // Vacío: el objetivo "Portátil nuevo, 740 de 1200 €" era de ejemplo y se
  // guardaba como si fuera tuyo.
  const [savings, setSavings] = usePersisted("lh_savings", []);
  const [subs, setSubs] = usePersisted("lh_subs", []);
  const [sForm, setSForm] = useState({ label: "", target: "" });
  const [subForm, setSubForm] = useState({ nombre: "", monto: "", dia: "" });
  const totalSubs = redondear(subs.reduce((a, b) => a + Number(b.monto || 0), 0));
  const addSaving = () => { if (!sForm.label.trim() || !sForm.target) return; setSavings([...savings, { id: nuevoId(), label: sForm.label, target: Number(sForm.target), current: 0 }]); setSForm({ label: "", target: "" }); };
  const addSub = () => { if (!subForm.nombre.trim()) return; setSubs([...subs, { id: nuevoId(), nombre: subForm.nombre, monto: Number(subForm.monto) || 0, dia: Number(subForm.dia) || 1 }]); setSubForm({ nombre: "", monto: "", dia: "" }); };

  /*
    Ingresos fijos: la contraparte de las suscripciones. Es lo que entra todos
    los meses sí o sí (nómina, beca, alquiler que cobras...), y sirve para saber
    con cuánto cuentas de partida sin esperar a que llegue el movimiento.
  */
  const [fijos, setFijos] = usePersisted("lh_ingresos_fijos", []);
  const [fijoForm, setFijoForm] = useState({ nombre: "", monto: "", dia: "" });
  const totalFijos = redondear(fijos.reduce((a, b) => a + Number(b.monto || 0), 0));
  const addFijo = () => {
    if (!fijoForm.nombre.trim()) return;
    setFijos([...fijos, { id: nuevoId(), nombre: fijoForm.nombre, monto: Number(fijoForm.monto) || 0, dia: Number(fijoForm.dia) || 1 }]);
    setFijoForm({ nombre: "", monto: "", dia: "" });
  };
  // Lo que queda libre cada mes una vez pagado lo que no se puede evitar.
  const disponibleFijo = redondear(totalFijos - totalSubs);

  /*
    Las categorías son las mismas que usa la importación del banco: si aquí
    hubiera menos, un movimiento importado como "Vivienda" no se podría ni
    reasignar, porque su categoría no saldría en el desplegable.
  */
  const CATS = CATEGORIAS_BANCO;

  const [budgets, setBudgets] = usePersisted("lh_budgets", {});
  const gastoPorCat = useMemo(() => {
    const m = {};
    rowsMes.filter((r) => r.monto < 0).forEach((r) => { m[r.categoria] = (m[r.categoria] || 0) + Math.abs(r.monto); });
    return m;
  }, [rowsMes]);
  const CAT_COLORS = { Comida: "#f43f5e", Universidad: "#6366f1", Deporte: "#10b981", Ocio: "#f59e0b", Transporte: "#0ea5e9", Vivienda: "#a855f7", Suscripciones: "#14b8a6", Salud: "#ec4899", Banco: "#14b8a6" };
  const catColor = (c) => CAT_COLORS[c] || "#94a3b8";
  const gastoCats = Object.entries(gastoPorCat).sort((a, b) => b[1] - a[1]);
  const totalGastoMes = gastoCats.reduce((a, b) => a + b[1], 0);
  const [finOrden, setFinOrden] = useState({ campo: "fecha", dir: "desc" });
  const rowsFin = useMemo(() => {
    const arr = [...(verTodo ? rows : rowsMes)];
    const { campo, dir } = finOrden;
    arr.sort((a, b) => (campo === "monto" ? (Number(a.monto) || 0) - (Number(b.monto) || 0) : String(a[campo] || "").localeCompare(String(b[campo] || ""))));
    if (dir === "desc") arr.reverse();
    return arr;
  }, [rows, rowsMes, verTodo, finOrden]);
  const finSort = (c) => setFinOrden((o) => ({ campo: c, dir: o.campo === c && o.dir === "asc" ? "desc" : "asc" }));
  const updateFin = (id, campo, valor) => setRows(rows.map((r) => (r.id === id ? { ...r, [campo]: campo === "monto" ? Number(valor) || 0 : valor } : r)));

  const add = () => {
    if (!form.concepto || !form.monto) return;
    const signed = tipo === "gasto" ? -Math.abs(Number(form.monto)) : Math.abs(Number(form.monto));
    const fecha = form.fecha || todayISO();
    setRows([
      { id: nuevoId(), fecha, concepto: form.concepto, categoria: tipo === "gasto" ? form.categoria : "Ingreso", monto: signed },
      ...rows,
    ]);
    // Si apuntas algo de otro mes, la vista salta a ese mes: si no, el
    // movimiento se guardaría bien pero desaparecería de la pantalla.
    setMes(fecha.slice(0, 7));
    setForm({ concepto: "", categoria: "Ocio", monto: "", fecha });
  };

  /*
    Los movimientos del banco entran por delante y sin tocar los tuyos: la
    detección de repetidos ya se hizo en la previsualización.
  */
  const importarDelBanco = (nuevos) => setRows([...nuevos, ...rows]);

  const inputCls =
    "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";

  return (
    <div>
      <SectionTitle icon={Wallet} title="Finanzas" subtitle="Ingresos, gastos y ahorro, mes a mes" />

      <Card className="mb-6 flex flex-wrap items-center gap-3">
        <button
          onClick={() => moverMes(-1)}
          aria-label="Mes anterior"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-500"
        >
          ‹
        </button>
        <span className="min-w-24 text-center text-lg font-semibold text-slate-100">{etiquetaMes(mes)}</span>
        <button
          onClick={() => moverMes(1)}
          aria-label="Mes siguiente"
          className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-sm text-slate-300 transition hover:border-indigo-500"
        >
          ›
        </button>
        {esMesActual ? (
          <span className="text-xs text-slate-500">Los totales empiezan de cero el día 1 de cada mes.</span>
        ) : (
          <button onClick={() => setMes(todayISO().slice(0, 7))} className="text-xs text-indigo-400 underline">
            Volver al mes actual
          </button>
        )}
      </Card>

      {/*
        En el móvil van los tres en fila y en vertical (icono arriba): apilados
        a lo ancho ocupaban tres pantallazos para tres cifras, y había que hacer
        scroll para ver el balance.
      */}
      <div className="mb-6 grid grid-cols-3 gap-2 sm:gap-4">
        <Card padding="p-3 sm:p-5" className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 sm:h-12 sm:w-12">
            <ArrowUpRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tabular-nums text-slate-100 sm:text-2xl"><Cifra valor={income} decimales={income % 1 ? 2 : 0} sufijo="€" /></p>
            <p className="text-xs text-slate-400 sm:text-sm">Ingresos</p>
          </div>
        </Card>
        <Card padding="p-3 sm:p-5" className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-rose-500/15 text-rose-400 sm:h-12 sm:w-12">
            <ArrowDownRight className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <p className="font-display text-lg font-bold tabular-nums text-slate-100 sm:text-2xl"><Cifra valor={expenses} decimales={expenses % 1 ? 2 : 0} sufijo="€" /></p>
            <p className="text-xs text-slate-400 sm:text-sm">Gastos</p>
          </div>
        </Card>
        <Card padding="p-3 sm:p-5" className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-4">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-indigo-500/15 text-indigo-400 sm:h-12 sm:w-12">
            <Wallet className="h-5 w-5 sm:h-6 sm:w-6" />
          </div>
          <div className="min-w-0">
            <p className={`font-display text-lg font-bold tabular-nums sm:text-2xl ${balance >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
              <Cifra valor={balance} decimales={balance % 1 ? 2 : 0} sufijo="€" />
            </p>
            <p className="text-xs text-slate-400 sm:text-sm">Balance</p>
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Presupuesto mensual</h2>
            <div className="flex items-center gap-1.5 text-sm text-slate-400">
              <span>{fmtEuro(expenses)} /</span>
              <label className="sr-only" htmlFor="presupuesto-mensual">
                Presupuesto mensual en euros
              </label>
              <input
                id="presupuesto-mensual"
                name="presupuesto-mensual"
                type="number"
                min="0"
                inputMode="numeric"
                value={presupuesto}
                onChange={(e) => setPresupuesto(Math.max(0, Number(e.target.value) || 0))}
                className="w-20 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-right text-sm text-slate-100 focus:border-indigo-500 focus:outline-none"
              />
              <span>€</span>
            </div>
          </div>
          <div className="h-3 w-full overflow-hidden rounded-full bg-slate-800">
            <div
              className={`lh-barra h-full rounded-full ${budgetPct > 85 ? "bg-rose-500" : "bg-emerald-500"}`}
              style={{ width: `${budgetPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            {presupuesto > 0
              ? `Te quedan ${fmtEuro(Math.max(0, presupuesto - expenses))} de presupuesto en ${etiquetaMes(mes)}.`
              : "Pon un tope mensual para ver cuánto te queda."}
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <PiggyBank size={18} className="text-fuchsia-400" />
            <h2 className="text-lg font-semibold text-slate-100">Objetivos de ahorro</h2>
          </div>
          <div className="mb-3 flex flex-wrap gap-2">
            <input placeholder="Objetivo (p. ej. Fondo emergencia)" value={sForm.label} onChange={(e) => setSForm({ ...sForm, label: e.target.value })} className={`flex-1 ${inputCls}`} />
            <input type="number" placeholder="Meta €" value={sForm.target} onChange={(e) => setSForm({ ...sForm, target: e.target.value })} className={`w-24 ${inputCls}`} />
            <button onClick={addSaving} className="rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">+</button>
          </div>
          <div className="space-y-3">
            {savings.map((sv) => {
              const pct = sv.target > 0 ? Math.min(100, (sv.current / sv.target) * 100) : 0;
              return (
                <div key={sv.id}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-300">{sv.label}</span>
                    <div className="flex items-center gap-1.5 text-xs text-slate-400">
                      <input type="number" value={sv.current} onChange={(e) => setSavings(savings.map((x) => (x.id === sv.id ? { ...x, current: Number(e.target.value) || 0 } : x)))} className="w-16 rounded border border-slate-700 bg-slate-800 px-1 py-0.5 text-right text-slate-100 focus:outline-none" />
                      / {sv.target}€
                      <button onClick={() => removeWithUndo(savings, setSavings, sv.id, "Objetivo")} className="text-slate-500 hover:text-rose-400"><Trash2 size={13} /></button>
                    </div>
                  </div>
                  <div className="h-2.5 w-full overflow-hidden rounded-full bg-slate-800"><div className="lh-barra h-full rounded-full bg-gradient-to-r from-fuchsia-500 to-indigo-500" style={{ width: `${pct}%` }} /></div>
                </div>
              );
            })}
          </div>
        </Card>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-100">
            Gasto por categoría ({etiquetaMes(mes)})
          </h2>
          {totalGastoMes === 0 ? (
            <p className="text-sm text-slate-500">Sin gastos en {etiquetaMes(mes)}.</p>
          ) : (
            <div className="flex items-center gap-6">
              <svg viewBox="0 0 36 36" className="h-32 w-32 -rotate-90">
                {(() => { let off = 0; return gastoCats.map(([cat, v]) => { const len = (v / totalGastoMes) * 100; const el = <circle key={cat} cx="18" cy="18" r="15.9155" fill="none" stroke={catColor(cat)} strokeWidth="4" strokeDasharray={`${len} ${100 - len}`} strokeDashoffset={-off} />; off += len; return el; }); })()}
              </svg>
              <div className="flex-1 space-y-1 text-sm">
                {gastoCats.map(([cat, v]) => (
                  <div key={cat} className="flex items-center gap-2">
                    <span className="h-3 w-3 rounded-full" style={{ background: catColor(cat) }} />
                    <span className="text-slate-300">{cat}</span>
                    <span className="ml-auto font-medium text-slate-400">{fmtEuro(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </Card>

        <Card>
          <h2 className="mb-4 text-lg font-semibold text-slate-100">Presupuesto por categoría</h2>
          <div className="space-y-3">
            {CATS.filter((c) => c !== "Ingreso").map((cat) => {
              const gastado = gastoPorCat[cat] || 0;
              const pres = Number(budgets[cat]) || 0;
              const pct = pres > 0 ? Math.min(100, (gastado / pres) * 100) : 0;
              const over = pres > 0 && gastado > pres;
              return (
                <div key={cat}>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-slate-300">{cat}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={over ? "text-rose-400" : "text-slate-400"}>{fmtEuro(gastado)} /</span>
                      <input type="number" value={budgets[cat] || ""} onChange={(e) => setBudgets({ ...budgets, [cat]: Number(e.target.value) || 0 })} placeholder="0" className="w-16 rounded border border-slate-700 bg-slate-800 px-2 py-0.5 text-right text-xs text-slate-100 focus:border-indigo-500 focus:outline-none" />
                      <span className="text-slate-500">€</span>
                    </div>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-800">
                    <div className={`lh-barra h-full rounded-full ${over ? "bg-rose-500" : pct > 85 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">Define un tope por categoría; se marca en rojo si lo superas en {etiquetaMes(mes)}.</p>
        </Card>
      </div>

      <div className="mb-4 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Ingresos fijos</h2>
            <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-sm font-semibold text-emerald-300">
              +{fmtEuro(totalFijos)}/mes
            </span>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input aria-label="Nombre del ingreso fijo" placeholder="Nombre (nómina, beca...)" value={fijoForm.nombre} onChange={(e) => setFijoForm({ ...fijoForm, nombre: e.target.value })} className={`min-w-32 flex-1 ${inputCls}`} />
            <input aria-label="Importe al mes en euros" type="number" inputMode="decimal" placeholder="€/mes" value={fijoForm.monto} onChange={(e) => setFijoForm({ ...fijoForm, monto: e.target.value })} className={`lh-num w-24 ${inputCls}`} />
            <input aria-label="Día del mes en que se cobra" type="number" inputMode="numeric" placeholder="Día" value={fijoForm.dia} onChange={(e) => setFijoForm({ ...fijoForm, dia: e.target.value })} className={`lh-num w-20 ${inputCls}`} />
            <button onClick={addFijo} className="rounded-lg bg-emerald-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-400">Añadir</button>
          </div>
          <ul className="space-y-2">
            {fijos.length === 0 && <li className="py-1 text-center text-sm text-slate-500">Sin ingresos fijos. Apunta tu nómina o tu beca.</li>}
            {fijos.map((f) => (
              <li key={f.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-200">{f.nombre}</span>
                <span className="shrink-0 text-xs text-slate-500">día {f.dia}</span>
                <span className="shrink-0 font-semibold text-emerald-300">{fmtEuro(f.monto)}</span>
                <button onClick={() => removeWithUndo(fijos, setFijos, f.id, "Ingreso fijo")} aria-label={`Borrar ${f.nombre}`} className="shrink-0 text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>

        <Card>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Suscripciones y gastos fijos</h2>
            <span className="rounded-full bg-rose-500/15 px-3 py-1 text-sm font-semibold text-rose-300">
              −{fmtEuro(totalSubs)}/mes
            </span>
          </div>
          <div className="mb-3 flex flex-wrap items-end gap-2">
            <input aria-label="Nombre de la suscripción o gasto fijo" placeholder="Nombre (Netflix, gym...)" value={subForm.nombre} onChange={(e) => setSubForm({ ...subForm, nombre: e.target.value })} className={`min-w-32 flex-1 ${inputCls}`} />
            <input aria-label="Importe al mes en euros" type="number" inputMode="decimal" placeholder="€/mes" value={subForm.monto} onChange={(e) => setSubForm({ ...subForm, monto: e.target.value })} className={`lh-num w-24 ${inputCls}`} />
            <input aria-label="Día del mes en que se paga" type="number" inputMode="numeric" placeholder="Día" value={subForm.dia} onChange={(e) => setSubForm({ ...subForm, dia: e.target.value })} className={`lh-num w-20 ${inputCls}`} />
            <button onClick={addSub} className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400">Añadir</button>
          </div>
          <ul className="space-y-2">
            {subs.length === 0 && <li className="py-1 text-center text-sm text-slate-500">Sin suscripciones. Añade tus gastos fijos.</li>}
            {subs.map((sub) => (
              <li key={sub.id} className="flex items-center gap-3 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm">
                <span className="min-w-0 flex-1 truncate text-slate-200">{sub.nombre}</span>
                <span className="shrink-0 text-xs text-slate-500">día {sub.dia}</span>
                <span className="shrink-0 font-semibold text-rose-300">{fmtEuro(sub.monto)}</span>
                <button onClick={() => removeWithUndo(subs, setSubs, sub.id, "Suscripción")} aria-label={`Borrar ${sub.nombre}`} className="shrink-0 text-slate-500 hover:text-rose-400"><Trash2 size={14} /></button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {(totalFijos > 0 || totalSubs > 0) && (
        <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="font-semibold text-slate-100">Te queda libre cada mes</h2>
            <p className="text-xs text-slate-500">
              {fmtEuro(totalFijos)} de ingresos fijos menos {fmtEuro(totalSubs)} de gastos fijos.
            </p>
          </div>
          <p className={`font-display text-2xl font-bold tabular-nums ${disponibleFijo >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {fmtEuro(disponibleFijo)}
          </p>
        </Card>
      )}

      <Suspense
        fallback={
          <Card className="mb-6">
            <Skeleton lineas={3} />
          </Card>
        }
      >
        <Banco movimientosActuales={rows} onImportar={importarDelBanco} />
      </Suspense>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex overflow-hidden rounded-lg border border-slate-700">
            <button
              onClick={() => setTipo("gasto")}
              className={`px-4 py-2 text-sm font-medium transition ${tipo === "gasto" ? "bg-rose-500 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              Gasto
            </button>
            <button
              onClick={() => setTipo("ingreso")}
              className={`px-4 py-2 text-sm font-medium transition ${tipo === "ingreso" ? "bg-emerald-500 text-white" : "bg-slate-800 text-slate-400"}`}
            >
              Ingreso
            </button>
          </div>
          <label className="sr-only" htmlFor="fin-fecha">
            Fecha del movimiento
          </label>
          <input
            id="fin-fecha"
            name="fin-fecha"
            type="date"
            value={form.fecha}
            onChange={(e) => setForm({ ...form, fecha: e.target.value })}
            className={inputCls}
          />
          <input
            placeholder="Concepto"
            value={form.concepto}
            onChange={(e) => setForm({ ...form, concepto: e.target.value })}
            className={`flex-1 ${inputCls}`}
          />
          {tipo === "gasto" && (
            <select
              value={form.categoria}
              onChange={(e) => setForm({ ...form, categoria: e.target.value })}
              className={inputCls}
            >
              {CATS.filter((c) => c !== "Ingreso").map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          )}
          <input
            type="number"
            placeholder="€"
            value={form.monto}
            onChange={(e) => setForm({ ...form, monto: e.target.value })}
            className={`w-24 ${inputCls}`}
          />
          <button
            onClick={add}
            className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
          >
            Añadir
          </button>
        </div>
      </Card>

      <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
        <h2 className="text-lg font-semibold text-slate-100">
          Movimientos {verTodo ? "(todo el histórico)" : `de ${etiquetaMes(mes)}`}
        </h2>
        <span className="text-xs text-slate-500">{rowsFin.length}</span>
        <button
          onClick={() => setVerTodo(!verTodo)}
          className="ml-auto text-xs text-indigo-400 underline"
        >
          {verTodo ? `Ver solo ${etiquetaMes(mes)}` : "Ver todo el histórico"}
        </button>
      </div>

      {/*
        En el móvil, cada movimiento como ficha en vez de fila.

        La tabla tiene cinco columnas de campos editables y no cabe en 390px:
        el importe y el botón de borrar quedaban fuera de la pantalla, así que
        había que arrastrar en horizontal para ver lo único que de verdad
        importa de un movimiento.
      */}
      <div className="space-y-2 sm:hidden">
        {rowsFin.length === 0 && (
          <Card className="py-8 text-center text-sm text-slate-500">
            Sin movimientos en {etiquetaMes(mes)}. Apunta uno arriba o sincroniza el banco.
          </Card>
        )}
        {rowsFin.map((r) => (
          <Card key={r.id} padding="p-3">
            <div className="flex items-start gap-2">
              <input
                value={r.concepto}
                onChange={(e) => updateFin(r.id, "concepto", e.target.value)}
                aria-label="Concepto"
                className="min-w-0 flex-1 rounded bg-slate-800/40 px-2 py-1.5 font-medium text-slate-100 focus:bg-slate-800"
              />
              <div className={`flex shrink-0 items-center font-semibold ${r.monto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                <input
                  type="number"
                  inputMode="decimal"
                  value={r.monto}
                  onChange={(e) => updateFin(r.id, "monto", e.target.value)}
                  aria-label="Importe en euros"
                  className="lh-num w-20 rounded bg-slate-800/40 px-2 py-1.5 text-right tabular-nums focus:bg-slate-800"
                />
                €
              </div>
            </div>
            <div className="mt-1 flex items-center gap-2">
              <input
                type="date"
                value={r.fecha}
                onChange={(e) => updateFin(r.id, "fecha", e.target.value)}
                aria-label="Fecha"
                className="rounded bg-slate-800/40 px-2 py-1.5 text-xs text-slate-400 focus:bg-slate-800"
              />
              <select
                value={r.categoria}
                onChange={(e) => updateFin(r.id, "categoria", e.target.value)}
                aria-label="Categoría"
                className="rounded bg-slate-800 px-2 py-1.5 text-xs text-slate-300"
              >
                {CATS.map((c) => <option key={c}>{c}</option>)}
              </select>
              {/* p-2 y no p-1: con el icono de 16px deja una zona táctil de 32px. */}
              <button
                onClick={() => removeWithUndo(rows, setRows, r.id, "Movimiento")}
                aria-label={`Borrar ${r.concepto}`}
                className="ml-auto p-2 text-slate-500 transition hover:text-rose-400"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </Card>
        ))}
      </div>

      <Card className="hidden overflow-x-auto p-0 sm:block">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-800 text-slate-400">
              {[["fecha", "Fecha", ""], ["concepto", "Concepto", ""], ["categoria", "Categoría", ""], ["monto", "Importe", "text-right"]].map(([c, l, cl]) => (
                <th key={c} onClick={() => finSort(c)} className={`cursor-pointer select-none px-5 py-3 font-medium hover:text-slate-200 ${cl}`}>
                  {l}{finOrden.campo === c ? (finOrden.dir === "asc" ? " ▲" : " ▼") : ""}
                </th>
              ))}
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {rowsFin.length === 0 && (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-slate-500">
                  Sin movimientos en {etiquetaMes(mes)}. Apunta uno arriba o sincroniza el banco.
                </td>
              </tr>
            )}
            {rowsFin.map((r) => (
              <tr key={r.id} className="border-b border-slate-800/60 transition hover:bg-slate-800/40">
                <td className="px-3 py-2 text-slate-400"><input type="date" value={r.fecha} onChange={(e) => updateFin(r.id, "fecha", e.target.value)} className="w-32 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2 font-medium text-slate-100"><input value={r.concepto} onChange={(e) => updateFin(r.id, "concepto", e.target.value)} className="w-40 rounded bg-transparent px-1 py-1 hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" /></td>
                <td className="px-3 py-2">
                  <select value={r.categoria} onChange={(e) => updateFin(r.id, "categoria", e.target.value)} className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none">
                    {CATS.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </td>
                <td className={`px-3 py-2 text-right font-semibold ${r.monto >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  <input type="number" value={r.monto} onChange={(e) => updateFin(r.id, "monto", e.target.value)} aria-label="Importe en euros" className="lh-num w-20 rounded bg-transparent px-1 py-1 text-right hover:bg-slate-800 focus:bg-slate-800 focus:outline-none" />€
                </td>
                <td className="px-5 py-3 text-right">
                  <button
                    onClick={() => removeWithUndo(rows, setRows, r.id, "Movimiento")}
                    aria-label={`Borrar ${r.concepto}`}
                    className="text-slate-500 transition hover:text-rose-400"
                  >
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}

export default Finanzas;
