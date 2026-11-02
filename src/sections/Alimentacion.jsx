import { useState, useMemo } from "react";
import { Utensils, Check, Ruler, ChefHat, Hand, Plus } from "lucide-react";
import { usePersisted } from "../lib/store";
import { Card, SectionTitle, todayISO } from "../lib/ui";
import { lunesDe } from "../lib/fechas";
import { nuevoId } from "../lib/id";
import { evaluarCintura, MENSAJE_CINTURA } from "../lib/planFisico";
import {
  hidratosDelDia,
  QUE_TOCA,
  COMIDAS_DEL_DIA,
  leerDia,
  marcarDia,
  marcadosSemana,
  marcaSemana,
  cumplimiento,
  OBJETIVO,
  PLATO,
  REGLAS,
  COCINA_DOMINGO,
  NOTA_COCINA,
  RECETAS,
  NOTAS_RECETAS,
  EJEMPLO_MARTES,
} from "../lib/alimentacion";
import { CampoNumero } from "./gym/CampoNumero";
import MenuCompra from "./alimentacion/MenuCompra.jsx";

/*
  Alimentación: la parte de comida del plan físico, sin contar calorías.

  Las marcas van en objetos PLANOS, una clave por marca (ver `leerDia` en
  src/lib/alimentacion.js para el porqué: con un objeto por día, marcar el
  desayuno en el móvil y la cena en el PC perdía una de las dos al sincronizar).

    - `lh_comida_dias`   { "aaaa-mm-dd|proteina|0": true, "aaaa-mm-dd|fruta": 2, ... }
    - `lh_comida_semana` { "<lunes>|compra|huevos": true, "<lunes>|cocina|0": true,
                           "<lunes>|menu|<día>|<comida>": "id de receta", ... }
      (el menú y la lista de la compra están en alimentacion/MenuCompra.jsx)
    - la cintura va a `lh_plan_mediciones`, la misma lista que la pestaña Plan
      del gimnasio: es una sola medida y no debe vivir en dos sitios.
*/
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const PESTANAS_RECETAS = [
  { id: "desayunos", nombre: "Desayunos" },
  { id: "comidas", nombre: "Comidas" },
  { id: "meriendas", nombre: "Meriendas" },
  { id: "cenas", nombre: "Cenas" },
];

const punos = (n) => (n === 0 ? "sin hidratos" : `${n} ${n === 1 ? "puño" : "puños"}`);

export default function Alimentacion() {
  const [dias, setDias] = usePersisted("lh_comida_dias", {});
  const [semanas, setSemanas] = usePersisted("lh_comida_semana", {});
  const [mediciones, setMediciones] = usePersisted("lh_plan_mediciones", []);
  const [recetas, setRecetas] = useState("comidas");
  const [cintura, setCintura] = useState(0);

  const hoy = todayISO();
  const diaSemana = (new Date().getDay() + 6) % 7;
  const lunes = lunesDe(hoy);

  const registro = leerDia(dias, hoy);
  const semana = { cocina: marcadosSemana(semanas, lunes, "cocina") };

  const estadoCintura = useMemo(() => evaluarCintura(mediciones), [mediciones]);
  const raciones = hidratosDelDia(diaSemana, {
    estancada: estadoCintura.estado === "estancada",
    conTenis: Boolean(registro.conTenis),
  });
  const { hechos, total } = cumplimiento(registro);

  const guardarDia = (cambios) => setDias({ ...dias, ...marcarDia(hoy, cambios) });
  const marcar = (lista, id, valor) => setSemanas({ ...semanas, ...marcaSemana(lunes, lista, id, valor) });

  const alternarProteina = (i) => guardarDia({ proteina: [i, !registro.proteina[i]] });

  const apuntarCintura = () => {
    if (!(cintura > 0)) return;
    setMediciones([{ id: nuevoId(), fecha: hoy, cintura }, ...mediciones]);
    setCintura(0);
  };

  const chip = (activo) =>
    `flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm transition ${
      activo
        ? "border-emerald-700 bg-emerald-500/15 text-emerald-300"
        : "border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
    }`;

  return (
    <div>
      <SectionTitle icon={Utensils} title="Alimentación" subtitle="Sin pesar ni contar: la mano como medida" />

      <div className="mb-4 grid gap-4 lg:grid-cols-3">
        {/* Hoy */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-semibold text-slate-100">Hoy · {DIAS[diaSemana]}</h2>
            <span className="text-sm tabular-nums text-slate-400">
              {hechos} de {total}
            </span>
          </div>
          <p className="mb-3 text-sm text-slate-400">{QUE_TOCA[diaSemana]}</p>

          <div className="mb-4 grid grid-cols-2 gap-2">
            <div className="rounded-lg bg-slate-800/60 px-3 py-2">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">Hidratos en la comida</p>
              <p className="font-display text-xl font-bold text-slate-100">{punos(raciones.comida)}</p>
            </div>
            <div className="rounded-lg bg-slate-800/60 px-3 py-2">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">Hidratos en la cena</p>
              <p className="font-display text-xl font-bold text-slate-100">{punos(raciones.cena)}</p>
            </div>
          </div>
          {diaSemana === 4 && (
            <label className="mb-4 flex items-center gap-2 text-sm text-slate-300">
              <input
                type="checkbox"
                checked={Boolean(registro.conTenis)}
                onChange={(e) => guardarDia({ conTenis: e.target.checked })}
                className="h-4 w-4 accent-indigo-500"
              />
              Hoy juego al tenis en Lorca (cuenta como día de tenis)
            </label>
          )}

          <p className="mb-2 text-xs font-semibold text-slate-400">Proteína en cada comida</p>
          <div className="mb-4 flex flex-wrap gap-2">
            {COMIDAS_DEL_DIA.map((nombre, i) => (
              <button key={nombre} onClick={() => alternarProteina(i)} aria-pressed={registro.proteina[i]} className={chip(registro.proteina[i])}>
                {registro.proteina[i] && <Check size={14} aria-hidden="true" />} {nombre}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-400">Piezas de fruta (2-3)</p>
              <div className="flex gap-1.5" role="group" aria-label="Piezas de fruta">
                {[0, 1, 2, 3].map((n) => (
                  <button
                    key={n}
                    onClick={() => guardarDia({ fruta: n })}
                    aria-pressed={registro.fruta === n}
                    className={`h-9 w-9 rounded-lg border text-sm font-semibold tabular-nums transition ${
                      registro.fruta === n
                        ? n >= 2
                          ? "border-emerald-700 bg-emerald-500/15 text-emerald-300"
                          : "border-indigo-500 bg-indigo-500/15 text-indigo-300"
                        : "border-slate-700 bg-slate-800 text-slate-400 hover:border-indigo-500"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold text-slate-400">Bebida</p>
              <button onClick={() => guardarDia({ agua: !registro.agua })} aria-pressed={registro.agua} className={chip(registro.agua)}>
                {registro.agua && <Check size={14} aria-hidden="true" />} Solo agua hoy
              </button>
            </div>
          </div>
        </Card>

        {/* Cintura */}
        <Card>
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-slate-100">
            <Ruler size={18} className="text-seccion-400" aria-hidden="true" /> Cintura
          </h2>
          <p className="font-display text-3xl font-bold tabular-nums text-slate-100">
            {estadoCintura.ultima ? `${String(estadoCintura.ultima.cintura).replace(".", ",")} cm` : "—"}
          </p>
          {estadoCintura.cambio14 != null && (
            <p className="text-xs tabular-nums text-slate-500">
              {estadoCintura.cambio14 > 0 ? "+" : ""}
              {String(estadoCintura.cambio14).replace(".", ",")} cm en 2 semanas
            </p>
          )}
          <p
            className={`mt-2 text-sm ${
              estadoCintura.estado === "estancada" ? "text-amber-300" : "text-slate-400"
            }`}
          >
            {MENSAJE_CINTURA[estadoCintura.estado]}
          </p>
          <div className="mt-4 flex gap-2">
            <label className="sr-only" htmlFor="cintura-hoy">Cintura de hoy en centímetros</label>
            <CampoNumero
              id="cintura-hoy"
              decimales
              value={cintura}
              onChange={setCintura}
              onKeyDown={(e) => e.key === "Enter" && apuntarCintura()}
              placeholder="cm"
              className="w-24 rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-center text-sm text-slate-100 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
            />
            <button
              onClick={apuntarCintura}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400"
            >
              <Plus size={15} aria-hidden="true" /> Apuntar
            </button>
          </div>
          <p className="mt-2 text-2xs text-slate-500">Semanal, en ayunas, a la altura del ombligo.</p>
        </Card>
      </div>

      {/* El plato */}
      <Card className="mb-4">
        <h2 className="mb-1 flex items-center gap-2 text-lg font-semibold text-slate-100">
          <Hand size={18} className="text-seccion-400" aria-hidden="true" /> Cómo montar cada plato
        </h2>
        <p className="mb-3 text-sm text-slate-400">{OBJETIVO}</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLATO.map((p) => (
            <div key={p.parte} className="rounded-lg bg-slate-800/60 px-3 py-2.5">
              <p className="text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">{p.parte}</p>
              <p className="mb-1 text-sm font-semibold text-slate-100">{p.racion}</p>
              <p className="text-xs text-slate-400">{p.ejemplos}</p>
            </div>
          ))}
        </div>
        <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-300">Cinco reglas</h3>
        <ol className="list-decimal space-y-1 pl-5 text-sm text-slate-300">
          {REGLAS.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ol>
      </Card>

      {/* Recetas */}
      <Card className="mb-4">
        <h2 className="mb-3 text-lg font-semibold text-slate-100">Qué comer</h2>
        {/* Botones con aria-pressed y no role="tab": el patrón de pestañas
            pide flechas y foco itinerante, y a medias confunde más que ayuda. */}
        <div className="lh-pestanas mb-3 gap-1.5 pb-1" role="group" aria-label="Tipo de comida">
          {PESTANAS_RECETAS.map((p) => (
            <button
              key={p.id}
              aria-pressed={recetas === p.id}
              onClick={() => setRecetas(p.id)}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
                recetas === p.id
                  ? "bg-indigo-500 text-white"
                  : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
              }`}
            >
              {p.nombre}
            </button>
          ))}
        </div>
        {NOTAS_RECETAS[recetas] && <p className="mb-3 text-xs text-slate-400">{NOTAS_RECETAS[recetas]}</p>}
        <ul className="grid gap-2 sm:grid-cols-2">
          {RECETAS[recetas].map(({ id, nombre, como, tiempo }) => (
            <li key={id} className="rounded-lg border border-slate-800 bg-slate-800/30 px-3 py-2">
              <p className="flex items-baseline justify-between gap-2 text-sm font-semibold text-slate-100">
                {nombre}
                {tiempo && <span className="shrink-0 text-xs font-normal tabular-nums text-slate-500">{tiempo}</span>}
              </p>
              <p className="text-xs text-slate-400">{como}</p>
            </li>
          ))}
        </ul>

        <h3 className="mt-4 mb-2 text-sm font-semibold text-slate-300">Ejemplo: un martes</h3>
        <ol className="space-y-1 text-sm">
          {EJEMPLO_MARTES.map(([hora, que]) => (
            <li key={hora} className="flex gap-3">
              <span className="w-12 shrink-0 font-semibold tabular-nums text-slate-400">{hora}</span>
              <span className="text-slate-300">{que}</span>
            </li>
          ))}
        </ol>
      </Card>

      {/* Cocina del domingo */}
      <Card className="mb-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <ChefHat size={18} className="text-seccion-400" aria-hidden="true" /> Cocina del domingo
          </h2>
          <span className="text-xs text-slate-500">1 h para media semana</span>
        </div>
        <ul className="space-y-2">
          {COCINA_DOMINGO.map((paso, i) => {
            const hecho = semana.cocina.includes(String(i));
            return (
              <li key={paso}>
                <label className="flex cursor-pointer items-start gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={hecho}
                    onChange={() => marcar("cocina", i, !hecho)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-indigo-500"
                  />
                  <span className={hecho ? "text-slate-500 line-through" : "text-slate-300"}>{paso}</span>
                </label>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-slate-500">{NOTA_COCINA}</p>
      </Card>

      <MenuCompra
        semanas={semanas}
        setSemanas={setSemanas}
        lunesHoy={lunes}
        estancada={estadoCintura.estado === "estancada"}
      />
    </div>
  );
}
