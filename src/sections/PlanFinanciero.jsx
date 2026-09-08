import { useState, useMemo } from "react";
import {
  Target,
  Trash2,
  Plus,
  ShieldCheck,
  PiggyBank,
  TrendingUp,
  Car,
  AlertTriangle,
} from "lucide-react";
import { usePersisted } from "../lib/store";
import { removeWithUndo } from "../lib/toast";
import { Card, SectionTitle, fmtEuro } from "../lib/ui";
import { nuevoId } from "../lib/id";
import {
  transporteMensual,
  totalIngresos,
  totalGastos,
  capacidadAhorro,
  objetivoColchon,
  mesesDeCobertura,
  mesesHastaObjetivo,
  reparto,
  proyectar,
} from "../lib/plan";

/*
  Vacío a propósito (ver CLAUDE.md): los importes son datos reales en cuanto se
  escriben, y el store los sube a la nube. Los regímenes se crean desde el botón
  de plantilla, que solo pone los nombres y deja los números a cero.
*/
const REGIMENES_INICIALES = [];

const CONFIG_INICIAL = {
  activo: null,
  saldo: 0,
  mesesColchon: 3,
  pctLargo: 60,
  años: 40,
  rentabilidad: 7,
  inflacion: 2.5,
};

/*
  Plantilla de arranque: los tres momentos que de verdad cambian las cuentas de
  un estudiante que además trabaja. Solo los nombres; los importes los pone cada
  uno, porque son suyos.
*/
const PLANTILLA = [
  { nombre: "Verano (prácticas)", conTransporte: true },
  { nombre: "Curso sin contrato", conTransporte: false },
  { nombre: "Curso con contrato", conTransporte: false },
];

/*
  "0.42 meses" no se entiende y además lleva punto decimal en un panel en
  español. Por debajo de un mes la cifra exacta no aporta nada: lo que dice es
  que no tienes colchón.
*/
function fmtMeses(n) {
  const v = Number(n) || 0;
  if (v > 0 && v < 1) return "menos de un mes";
  const txt = v.toLocaleString("es-ES", { maximumFractionDigits: 1 });
  return `${txt} ${v === 1 ? "mes" : "meses"}`;
}

const inputCls =
  "rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none";
const inputMini =
  "lh-num w-24 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-right text-sm tabular-nums text-slate-100 focus:border-indigo-500 focus:outline-none";

export default function PlanFinanciero() {
  const [regimenes, setRegimenes] = usePersisted("lh_plan_regimenes", REGIMENES_INICIALES);
  const [config, setConfig] = usePersisted("lh_plan_config", CONFIG_INICIAL);

  const activo = regimenes.find((r) => r.id === config.activo) || regimenes[0] || null;

  const setCfg = (campo, valor) => setConfig({ ...config, [campo]: valor });

  const actualizar = (id, cambios) =>
    setRegimenes(regimenes.map((r) => (r.id === id ? { ...r, ...cambios } : r)));

  const crearPlantilla = () => {
    const nuevos = PLANTILLA.map((p) => ({
      id: nuevoId(),
      nombre: p.nombre,
      ingresos: [],
      gastos: [],
      transporte: p.conTransporte ? { costeDia: 0, diasPresenciales: 5 } : { costeDia: 0, diasPresenciales: 0 },
    }));
    setRegimenes([...regimenes, ...nuevos]);
    setConfig({ ...config, activo: nuevos[0].id });
  };

  const añadirRegimen = () => {
    const nuevo = {
      id: nuevoId(),
      nombre: "Situación nueva",
      ingresos: [],
      gastos: [],
      transporte: { costeDia: 0, diasPresenciales: 0 },
    };
    setRegimenes([...regimenes, nuevo]);
    setConfig({ ...config, activo: nuevo.id });
  };

  /* --- Cálculos del régimen activo --- */
  const cuentas = useMemo(() => {
    if (!activo) return null;
    const ingresos = totalIngresos(activo);
    const gastos = totalGastos(activo);
    const capacidad = capacidadAhorro(activo);
    const objetivo = objetivoColchon(gastos, config.mesesColchon);
    return {
      ingresos,
      gastos,
      capacidad,
      transporte: transporteMensual(activo.transporte),
      objetivo,
      cobertura: mesesDeCobertura(config.saldo, gastos),
      faltan: mesesHastaObjetivo(config.saldo, objetivo, capacidad),
      colchonLleno: config.saldo >= objetivo && objetivo > 0,
    };
  }, [activo, config.mesesColchon, config.saldo]);

  const bolsas = reparto(cuentas?.capacidad || 0, config.pctLargo);

  const proyeccion = useMemo(
    () =>
      proyectar({
        aportacionMensual: bolsas.largo,
        años: config.años,
        rentabilidadAnual: config.rentabilidad,
        inflacionAnual: config.inflacion,
      }),
    [bolsas.largo, config.años, config.rentabilidad, config.inflacion]
  );

  return (
    <div>
      <SectionTitle
        icon={Target}
        title="Plan financiero"
        subtitle="Qué te queda cada mes, cuánto colchón necesitas y qué puedes invertir"
      />

      {regimenes.length === 0 ? (
        <Card className="text-center">
          <p className="mb-1 font-semibold text-slate-100">Aún no has descrito tu situación</p>
          <p className="mx-auto mb-4 max-w-lg text-sm text-slate-400">
            Un régimen es un momento con cuentas distintas: el verano de prácticas, el curso sin
            contrato, el curso ya con sueldo. Describes cada uno una vez y el plan se recalcula solo
            cuando cambias de uno a otro.
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={crearPlantilla}
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              Crear los tres de siempre
            </button>
            <button
              onClick={añadirRegimen}
              className="rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:border-indigo-500"
            >
              Empezar en blanco
            </button>
          </div>
        </Card>
      ) : (
        <>
          <SelectorRegimen
            regimenes={regimenes}
            activo={activo}
            onElegir={(id) => setCfg("activo", id)}
            onAñadir={añadirRegimen}
          />

          {activo && cuentas && (
            <>
              <Resumen cuentas={cuentas} />

              <div className="mb-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
                <Listado
                  titulo="Lo que entra"
                  vacio="Sin ingresos apuntados. Añade la nómina, la beca o lo que te den en casa."
                  filas={activo.ingresos}
                  color="emerald"
                  onCambiar={(ingresos) => actualizar(activo.id, { ingresos })}
                />
                <Listado
                  titulo="Gastos fijos"
                  vacio="Sin gastos fijos. Empieza por el piso y las cuotas."
                  filas={activo.gastos}
                  color="rose"
                  onCambiar={(gastos) => actualizar(activo.id, { gastos })}
                />
              </div>

              <Transporte
                transporte={activo.transporte}
                onCambiar={(transporte) => actualizar(activo.id, { transporte })}
              />

              <Colchon
                cuentas={cuentas}
                config={config}
                onCambiar={setCfg}
                nombreRegimen={activo.nombre}
              />

              <Reparto
                capacidad={cuentas.capacidad}
                bolsas={bolsas}
                pctLargo={config.pctLargo}
                colchonLleno={cuentas.colchonLleno}
                onCambiar={setCfg}
              />

              <Proyeccion proyeccion={proyeccion} config={config} bolsas={bolsas} onCambiar={setCfg} />

              <BorrarRegimen
                regimenes={regimenes}
                activo={activo}
                setRegimenes={setRegimenes}
                onNombre={(nombre) => actualizar(activo.id, { nombre })}
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function SelectorRegimen({ regimenes, activo, onElegir, onAñadir }) {
  return (
    <Card className="mb-6">
      <p className="mb-3 text-sm text-slate-400">¿En cuál de tus situaciones estás ahora?</p>
      <div className="flex flex-wrap gap-2">
        {regimenes.map((r) => {
          const esActivo = activo?.id === r.id;
          return (
            <button
              key={r.id}
              onClick={() => onElegir(r.id)}
              aria-pressed={esActivo}
              className={`rounded-xl border px-4 py-2 text-sm font-medium transition ${
                esActivo
                  ? "border-indigo-500 bg-indigo-500/10 text-slate-100"
                  : "border-slate-700 bg-slate-800 text-slate-300 hover:border-slate-600"
              }`}
            >
              {r.nombre}
            </button>
          );
        })}
        <button
          onClick={onAñadir}
          aria-label="Añadir situación"
          className="rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 text-slate-400 transition hover:border-indigo-500 hover:text-slate-200"
        >
          <Plus size={16} />
        </button>
      </div>
    </Card>
  );
}

function Resumen({ cuentas }) {
  const { ingresos, gastos, capacidad } = cuentas;
  const negativo = capacidad < 0;
  return (
    <>
      <div className="mb-4 grid grid-cols-3 gap-2 sm:gap-4">
        <Card padding="p-3 sm:p-5">
          <p className="font-display text-lg font-bold tabular-nums text-emerald-400 sm:text-2xl">
            {fmtEuro(ingresos)}
          </p>
          <p className="text-xs text-slate-400 sm:text-sm">Entra</p>
        </Card>
        <Card padding="p-3 sm:p-5">
          <p className="font-display text-lg font-bold tabular-nums text-rose-400 sm:text-2xl">
            {fmtEuro(gastos)}
          </p>
          <p className="text-xs text-slate-400 sm:text-sm">Sale</p>
        </Card>
        <Card padding="p-3 sm:p-5">
          <p
            className={`font-display text-lg font-bold tabular-nums sm:text-2xl ${
              negativo ? "text-rose-400" : "text-emerald-400"
            }`}
          >
            {fmtEuro(capacidad)}
          </p>
          <p className="text-xs text-slate-400 sm:text-sm">Te queda</p>
        </Card>
      </div>

      {negativo && (
        <Card className="mb-6 flex items-start gap-3 border-amber-800">
          <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-400" />
          <div>
            <p className="font-semibold text-amber-300">Esta situación no se sostiene</p>
            <p className="text-sm text-slate-400">
              Cada mes pierdes {fmtEuro(Math.abs(capacidad))}, así que estás tirando de ahorros. Antes
              de pensar en invertir hay que cerrar este hueco: mira el transporte, que suele ser la
              palanca más grande, o alguna cuota que puedas pausar.
            </p>
          </div>
        </Card>
      )}
    </>
  );
}

function Listado({ titulo, vacio, filas = [], color, onCambiar }) {
  const [form, setForm] = useState({ concepto: "", monto: "" });
  const total = filas.reduce((a, f) => a + (Number(f.monto) || 0), 0);
  const tono = color === "emerald" ? "text-emerald-300" : "text-rose-300";
  const fondo = color === "emerald" ? "bg-emerald-500/15" : "bg-rose-500/15";

  const añadir = () => {
    if (!form.concepto.trim()) return;
    onCambiar([...filas, { id: nuevoId(), concepto: form.concepto, monto: Number(form.monto) || 0 }]);
    setForm({ concepto: "", monto: "" });
  };

  const editar = (id, campo, valor) =>
    onCambiar(
      filas.map((f) => (f.id === id ? { ...f, [campo]: campo === "monto" ? Number(valor) || 0 : valor } : f))
    );

  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold text-slate-100">{titulo}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold tabular-nums ${fondo} ${tono}`}>
          {fmtEuro(total)}/mes
        </span>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-2">
        <input
          aria-label={`Concepto de ${titulo.toLowerCase()}`}
          placeholder="Concepto"
          value={form.concepto}
          onChange={(e) => setForm({ ...form, concepto: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && añadir()}
          className={`min-w-32 flex-1 ${inputCls}`}
        />
        <input
          aria-label="Importe al mes en euros"
          type="number"
          inputMode="decimal"
          placeholder="€/mes"
          value={form.monto}
          onChange={(e) => setForm({ ...form, monto: e.target.value })}
          onKeyDown={(e) => e.key === "Enter" && añadir()}
          className={`lh-num w-24 ${inputCls}`}
        />
        <button
          onClick={añadir}
          className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
        >
          Añadir
        </button>
      </div>
      <ul className="space-y-2">
        {filas.length === 0 && <li className="py-1 text-center text-sm text-slate-500">{vacio}</li>}
        {filas.map((f) => (
          <li
            key={f.id}
            className="flex items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm"
          >
            <input
              aria-label="Concepto"
              value={f.concepto}
              onChange={(e) => editar(f.id, "concepto", e.target.value)}
              className="min-w-0 flex-1 rounded bg-transparent px-1 py-1 text-slate-200 focus:bg-slate-800"
            />
            <input
              aria-label="Importe al mes en euros"
              type="number"
              inputMode="decimal"
              value={f.monto}
              onChange={(e) => editar(f.id, "monto", e.target.value)}
              className={`shrink-0 ${inputMini} ${tono}`}
            />
            <button
              onClick={() => removeWithUndo(filas, onCambiar, f.id, "Línea")}
              aria-label={`Borrar ${f.concepto}`}
              className="shrink-0 p-2 text-slate-500 transition hover:text-rose-400"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

/*
  El transporte va aparte de los demás gastos porque no es una cuota: depende de
  los días que vayas. Verlo como "cuánto me cuesta cada día que voy" es lo que
  deja decidir si compensa teletrabajar un día suelto.
*/
// Sin prop `mensual`: se le pasaba desde fuera pero no se usaba, porque el
// coste actual se recalcula aquí mismo unas líneas más abajo.
function Transporte({ transporte = {}, onCambiar }) {
  const { costeDia = 0, diasPresenciales = 0 } = transporte;
  const cambiar = (campo, valor) => onCambiar({ ...transporte, [campo]: Number(valor) || 0 });

  const alternativas = [5, 4, 3, 2, 1, 0].map((d) => ({
    dias: d,
    mensual: transporteMensual({ costeDia, diasPresenciales: d }),
  }));
  const actual = transporteMensual({ costeDia, diasPresenciales });

  return (
    <Card className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <Car size={18} className="text-amber-400" /> Transporte al trabajo
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Se calcula por días, no como cuota fija: es el gasto que de verdad puedes mover.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-coste-dia">
            Coste de cada día que vas
          </label>
          <input
            id="plan-coste-dia"
            type="number"
            inputMode="decimal"
            step="0.5"
            value={costeDia}
            onChange={(e) => cambiar("costeDia", e.target.value)}
            className={inputMini}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-dias">
            Días presenciales por semana
          </label>
          <input
            id="plan-dias"
            type="number"
            inputMode="numeric"
            min="0"
            max="7"
            value={diasPresenciales}
            onChange={(e) => cambiar("diasPresenciales", Math.min(7, Math.max(0, Number(e.target.value) || 0)))}
            className={inputMini}
          />
        </div>
        <div className="ml-auto text-right">
          <p className="font-display text-2xl font-bold tabular-nums text-amber-300">{fmtEuro(actual)}</p>
          <p className="text-xs text-slate-400">al mes</p>
        </div>
      </div>

      {costeDia > 0 && (
        <>
          <p className="mb-2 text-xs text-slate-400">Lo que te costaría según los días que vayas:</p>
          <ul className="space-y-1.5">
            {alternativas.map((a) => {
              const ahorro = actual - a.mensual;
              const esActual = a.dias === diasPresenciales;
              return (
                <li key={a.dias} className="flex items-center gap-3 text-sm">
                  <span className={`w-16 shrink-0 ${esActual ? "font-semibold text-slate-100" : "text-slate-400"}`}>
                    {a.dias === 0 ? "Online" : `${a.dias} día${a.dias > 1 ? "s" : ""}`}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-800">
                    <div
                      className="lh-barra h-full rounded-full bg-amber-500"
                      style={{ width: `${alternativas[0].mensual ? (a.mensual / alternativas[0].mensual) * 100 : 0}%` }}
                    />
                  </div>
                  <span className="w-20 shrink-0 text-right tabular-nums text-slate-300">
                    {fmtEuro(a.mensual)}
                  </span>
                  <span className="hidden w-32 shrink-0 whitespace-nowrap text-right text-xs tabular-nums text-emerald-400 sm:block">
                    {ahorro > 0 ? `ahorras ${fmtEuro(ahorro)}` : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </Card>
  );
}

function Colchon({ cuentas, config, onCambiar, nombreRegimen }) {
  const { objetivo, cobertura, faltan, colchonLleno, gastos } = cuentas;
  const pct = objetivo > 0 ? Math.min(100, (config.saldo / objetivo) * 100) : 0;

  return (
    <Card className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <ShieldCheck size={18} className="text-emerald-400" /> Colchón de emergencia
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        Lo primero, antes de invertir un euro. Es lo que hace que un imprevisto no te obligue a vender
        ni a pedir dinero. Va en cuenta remunerada o fondo monetario, nunca en bolsa.
      </p>

      <div className="mb-4 flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-saldo">
            Lo que tienes ahora
          </label>
          <input
            id="plan-saldo"
            type="number"
            inputMode="decimal"
            value={config.saldo}
            onChange={(e) => onCambiar("saldo", Number(e.target.value) || 0)}
            className={inputMini}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-meses">
            Meses de gastos a cubrir
          </label>
          <input
            id="plan-meses"
            type="number"
            inputMode="numeric"
            min="1"
            max="12"
            value={config.mesesColchon}
            onChange={(e) => onCambiar("mesesColchon", Math.max(1, Number(e.target.value) || 1))}
            className={inputMini}
          />
        </div>
        <div className="ml-auto text-right">
          <p className="font-display text-2xl font-bold tabular-nums text-slate-100">
            {fmtEuro(objetivo)}
          </p>
          <p className="text-xs text-slate-400">objetivo con «{nombreRegimen}»</p>
        </div>
      </div>

      <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`lh-barra h-full rounded-full ${colchonLleno ? "bg-emerald-500" : "bg-indigo-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-sm text-slate-400">
        {gastos <= 0
          ? "Apunta tus gastos para saber cuánto colchón necesitas."
          : colchonLleno
            ? `Colchón completo: aguantarías ${fmtMeses(cobertura)} sin ingresos. A partir de aquí, todo lo que ahorres puede ir a inversión.`
            : faltan === null
              ? `Con esta situación no llegas a llenarlo, porque no te sobra nada al mes. Cubres ${fmtMeses(cobertura)} de gastos.`
              : `Cubres ${fmtMeses(cobertura)} de gastos. Al ritmo actual lo llenas en ${faltan} ${faltan === 1 ? "mes" : "meses"}.`}
      </p>
    </Card>
  );
}

function Reparto({ capacidad, bolsas, pctLargo, colchonLleno, onCambiar }) {
  return (
    <Card className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <PiggyBank size={18} className="text-fuchsia-400" /> Reparto de lo que sobra
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        {colchonLleno
          ? "Con el colchón hecho, esto es lo que mueves cada mes. Automatiza la transferencia el día que cobras, no el día 28 con lo que quede."
          : "Mientras el colchón no esté lleno, todo lo que sobre va al colchón. Esto es lo que harás después."}
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-pct">
          Al largo plazo: {pctLargo}%
        </label>
        <input
          id="plan-pct"
          type="range"
          min="0"
          max="100"
          step="5"
          value={pctLargo}
          onChange={(e) => onCambiar("pctLargo", Number(e.target.value))}
          className="w-full accent-indigo-500"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
          <p className="font-display text-2xl font-bold tabular-nums text-indigo-300">
            {fmtEuro(bolsas.largo)}
          </p>
          <p className="text-sm font-medium text-slate-200">Largo plazo</p>
          <p className="mt-1 text-xs text-slate-500">
            10 años o más. Fondo indexado global, renta variable. Las caídas te dan igual mientras
            sigas comprando.
          </p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
          <p className="font-display text-2xl font-bold tabular-nums text-sky-300">
            {fmtEuro(bolsas.medio)}
          </p>
          <p className="text-sm font-medium text-slate-200">Medio plazo</p>
          <p className="mt-1 text-xs text-slate-500">
            2 o 3 años. Fondo monetario o depósito, sin riesgo. Para máster, coche o mudanza.
          </p>
        </div>
      </div>

      {capacidad <= 0 && (
        <p className="mt-3 text-xs text-amber-400">
          Ahora mismo no sobra nada que repartir en esta situación.
        </p>
      )}
    </Card>
  );
}

function Proyeccion({ proyeccion, config, bolsas, onCambiar }) {
  const { aportado, nominal, real, interes } = proyeccion;

  return (
    <Card className="mb-6">
      <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
        <TrendingUp size={18} className="text-emerald-400" /> Adónde lleva esto
      </h2>
      <p className="mb-4 text-xs text-slate-500">
        {bolsas.largo > 0
          ? `Aportando los ${fmtEuro(bolsas.largo)} al mes del largo plazo, sin subirlos nunca.`
          : "En esta situación no sobra nada, así que no hay nada que proyectar. Cambia de situación arriba para ver adónde llegas cuando sí sobre."}
      </p>

      <div className="mb-4 flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-años">
            Años
          </label>
          <input
            id="plan-años"
            type="number"
            inputMode="numeric"
            min="1"
            max="60"
            value={config.años}
            onChange={(e) => onCambiar("años", Math.max(1, Number(e.target.value) || 1))}
            className={inputMini}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-rent">
            Rentabilidad anual %
          </label>
          <input
            id="plan-rent"
            type="number"
            inputMode="decimal"
            step="0.5"
            value={config.rentabilidad}
            onChange={(e) => onCambiar("rentabilidad", Number(e.target.value) || 0)}
            className={inputMini}
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-infl">
            Inflación anual %
          </label>
          <input
            id="plan-infl"
            type="number"
            inputMode="decimal"
            step="0.1"
            value={config.inflacion}
            onChange={(e) => onCambiar("inflacion", Number(e.target.value) || 0)}
            className={inputMini}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
          <p className="font-display text-xl font-bold tabular-nums text-slate-100">
            {fmtEuro(aportado)}
          </p>
          <p className="text-xs text-slate-400">De tu bolsillo</p>
        </div>
        <div className="rounded-xl border border-slate-800 bg-slate-800/40 p-4">
          <p className="font-display text-xl font-bold tabular-nums text-emerald-400">
            {fmtEuro(interes)}
          </p>
          <p className="text-xs text-slate-400">Lo que pone el interés compuesto</p>
        </div>
        <div className="rounded-xl border border-indigo-800 bg-indigo-500/10 p-4">
          <p className="font-display text-xl font-bold tabular-nums text-indigo-300">
            {fmtEuro(real)}
          </p>
          <p className="text-xs text-slate-400">En dinero de hoy</p>
        </div>
      </div>

      {bolsas.largo > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Serían {fmtEuro(nominal)} en el papel, pero dentro de {config.años} años ese dinero
          comprará lo que hoy compran {fmtEuro(real)}. Esa segunda cifra es la que hay que mirar. Son
          estimaciones con una rentabilidad media: ningún año se parece a la media.
        </p>
      )}
    </Card>
  );
}

function BorrarRegimen({ regimenes, activo, setRegimenes, onNombre }) {
  return (
    <Card className="flex flex-wrap items-end gap-3">
      <div className="min-w-48 flex-1">
        <label className="mb-1 block text-xs text-slate-400" htmlFor="plan-nombre">
          Nombre de esta situación
        </label>
        <input
          id="plan-nombre"
          value={activo.nombre}
          onChange={(e) => onNombre(e.target.value)}
          className={`w-full ${inputCls}`}
        />
      </div>
      <button
        onClick={() => removeWithUndo(regimenes, setRegimenes, activo.id, "Situación")}
        className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-rose-500 hover:text-rose-400"
      >
        <Trash2 size={15} /> Borrar situación
      </button>
    </Card>
  );
}
