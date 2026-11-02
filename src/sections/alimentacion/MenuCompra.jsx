import { useState, useMemo } from "react";
import { CalendarDays, ShoppingCart, RotateCcw, Wand2, Eraser } from "lucide-react";
import { Card } from "../../lib/ui";
import { sumarDias } from "../../lib/fechas";
import { hidratosDelDia, marcadosSemana, marcaSemana, COMPRA, NOTA_COMPRA, TOTAL_ARTICULOS } from "../../lib/alimentacion";
import {
  HUECOS,
  opcionesDe,
  leerMenu,
  marcaMenu,
  rellenarConEjemplo,
  vaciarMenu,
  platosEnMenu,
  listaDeLaCompra,
} from "../../lib/compra";

/*
  Menú de la semana y la lista de la compra que sale de él.

  Todo vive en `lh_comida_semana` con claves planas (ver src/lib/compra.js):
  el menú ("<lunes>|menu|<día>|<comida>") y lo ya cogido en el súper
  ("<lunes>|compra|<ingrediente>"). Se puede preparar la semana que viene: lo
  normal es hacer la compra el fin de semana para la siguiente.

  Sin menú elegido se enseña la lista fija del plan, que es la de siempre.
*/
const DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

const fechaCorta = (iso) =>
  new Date(`${iso}T00:00:00`).toLocaleDateString("es-ES", { day: "numeric", month: "short" });

const botonSecundario =
  "flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-indigo-500";

export default function MenuCompra({ semanas, setSemanas, lunesHoy, estancada }) {
  const [cual, setCual] = useState("esta");
  const lunes = cual === "esta" ? lunesHoy : sumarDias(lunesHoy, 7);
  const diaHoy = cual === "esta" ? (new Date().getDay() + 6) % 7 : -1;

  const menu = useMemo(() => leerMenu(semanas, lunes), [semanas, lunes]);
  const platos = platosEnMenu(menu);
  const lista = useMemo(() => listaDeLaCompra(menu), [menu]);
  const cogidos = marcadosSemana(semanas, lunes, "compra");

  const guardar = (cambios) => setSemanas({ ...semanas, ...cambios });
  const marcar = (id, valor) => guardar(marcaSemana(lunes, "compra", id, valor));
  const desmarcarTodo = () =>
    guardar(Object.assign({}, ...cogidos.map((id) => marcaSemana(lunes, "compra", id, false))));

  // Con menú, solo cuentan los artículos que están en la lista de ahora (lo de
  // "mira si te queda" incluido): uno marcado que ya no hace falta porque
  // cambiaste el plato no debe sumar.
  const idsLista = platos
    ? [...lista.grupos.flatMap((g) => g.articulos.map((a) => a.id)), ...lista.despensa.map((a) => a.id)]
    : null;
  const marcados = idsLista ? cogidos.filter((id) => idsLista.includes(id)).length : cogidos.length;
  const totalLista = idsLista ? idsLista.length : TOTAL_ARTICULOS;

  return (
    <>
      <Card className="mb-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <CalendarDays size={18} className="text-seccion-400" aria-hidden="true" /> Menú de la semana
          </h2>
          <div className="flex gap-1.5" role="group" aria-label="Qué semana">
            {[
              ["esta", `Esta semana · ${fechaCorta(lunesHoy)}`],
              ["siguiente", `La que viene · ${fechaCorta(sumarDias(lunesHoy, 7))}`],
            ].map(([id, texto]) => (
              <button
                key={id}
                onClick={() => setCual(id)}
                aria-pressed={cual === id}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  cual === id
                    ? "bg-indigo-500 text-white"
                    : "border border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500"
                }`}
              >
                {texto}
              </button>
            ))}
          </div>
        </div>
        <p className="mb-3 text-xs text-slate-400">
          Elige qué vas a comer y la lista de la compra de abajo sale sola con lo que llevan esos platos.
        </p>

        <div className="space-y-2">
          <div className="hidden gap-2 px-2 text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500 lg:grid lg:grid-cols-[7rem_repeat(4,minmax(0,1fr))]">
            <span>Día</span>
            {HUECOS.map((h) => (
              <span key={h.id}>{h.nombre}</span>
            ))}
          </div>
          {menu.map((dia, d) => {
            const p = hidratosDelDia(d, { estancada });
            return (
              <div
                key={d}
                className={`grid gap-2 rounded-lg p-2 sm:grid-cols-2 lg:grid-cols-[7rem_repeat(4,minmax(0,1fr))] lg:items-center ${
                  d === diaHoy ? "bg-indigo-500/10 ring-1 ring-inset ring-indigo-500/40" : "bg-slate-800/30"
                }`}
              >
                <div className="sm:col-span-2 lg:col-span-1">
                  <p className="text-sm font-semibold text-slate-200">{DIAS[d]}</p>
                  <p className="text-2xs text-slate-500">
                    Hidratos: {p.comida} + {p.cena} {p.comida + p.cena === 1 ? "puño" : "puños"}
                  </p>
                </div>
                {HUECOS.map((h) => (
                  <select
                    key={h.id}
                    value={dia[h.id]}
                    onChange={(e) => guardar(marcaMenu(lunes, d, h.id, e.target.value))}
                    aria-label={`${h.nombre} del ${DIAS[d].toLowerCase()}`}
                    className={`w-full min-w-0 rounded-lg border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs focus:border-indigo-500 focus:outline-none ${
                      dia[h.id] ? "text-slate-100" : "text-slate-500"
                    }`}
                  >
                    <option value="">{h.nombre}: sin elegir</option>
                    {opcionesDe(h.id).map((g) => (
                      <optgroup key={g.grupo} label={g.grupo}>
                        {g.recetas.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.nombre}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </select>
                ))}
              </div>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {platos < 28 && (
            <button onClick={() => guardar(rellenarConEjemplo(menu, lunes))} className={botonSecundario}>
              <Wand2 size={14} aria-hidden="true" /> {platos ? "Completar los huecos con el menú de ejemplo" : "Usar el menú de ejemplo"}
            </button>
          )}
          {platos > 0 && (
            <button onClick={() => guardar(vaciarMenu(lunes))} className={botonSecundario}>
              <Eraser size={14} aria-hidden="true" /> Vaciar la semana
            </button>
          )}
        </div>
      </Card>

      <Card>
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <ShoppingCart size={18} className="text-seccion-400" aria-hidden="true" /> Lista de la compra
          </h2>
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums text-slate-500">
              {marcados} / {totalLista}
            </span>
            {cogidos.length > 0 && (
              <button
                onClick={desmarcarTodo}
                aria-label="Desmarcar toda la lista de la compra"
                title="Desmarcar todo"
                className="p-1 text-slate-500 transition hover:text-indigo-400"
              >
                <RotateCcw size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
        <p className="mb-3 text-2xs text-slate-500">
          {platos
            ? `Lo que llevan los ${platos} ${platos === 1 ? "plato" : "platos"} de la semana del ${fechaCorta(lunes)}. A la derecha, en cuántos sale.`
            : "Aún no hay menú para esta semana: esta es la lista base del plan. Elige el menú arriba y saldrá la tuya."}
        </p>

        {platos ? (
          <ListaDelMenu lista={lista} cogidos={cogidos} marcar={marcar} />
        ) : (
          <ListaBase cogidos={cogidos} marcar={marcar} />
        )}
        <p className="mt-3 text-xs text-slate-500">{NOTA_COMPRA}</p>
      </Card>
    </>
  );
}

function Articulo({ id, cogido, marcar, children, detalle = null }) {
  return (
    <li>
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={cogido}
          onChange={() => marcar(id, !cogido)}
          className="h-4 w-4 shrink-0 accent-indigo-500"
        />
        <span className={`min-w-0 flex-1 ${cogido ? "text-slate-500 line-through" : "text-slate-300"}`}>{children}</span>
        {detalle && (
          <span className={`shrink-0 tabular-nums ${cogido ? "text-slate-600" : "text-slate-400"}`}>{detalle}</span>
        )}
      </label>
    </li>
  );
}

function ListaDelMenu({ lista, cogidos, marcar }) {
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {lista.grupos.map((g) => (
        <div key={g.grupo}>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">{g.grupo}</p>
          <ul className="space-y-1">
            {g.articulos.map((a) => (
              <Articulo
                key={a.id}
                id={a.id}
                cogido={cogidos.includes(a.id)}
                marcar={marcar}
                detalle={a.platos ? `${a.platos} ${a.platos === 1 ? "plato" : "platos"}` : null}
              >
                {a.nombre}
              </Articulo>
            ))}
          </ul>
        </div>
      ))}
      {lista.despensa.length > 0 && (
        <div>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">Mira si te queda</p>
          <ul className="space-y-1">
            {lista.despensa.map((a) => (
              <Articulo key={a.id} id={a.id} cogido={cogidos.includes(a.id)} marcar={marcar}>
                {a.nombre}
              </Articulo>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function ListaBase({ cogidos, marcar }) {
  return (
    <div className="grid gap-x-8 gap-y-3 sm:grid-cols-2">
      {COMPRA.map((g) => (
        <div key={g.grupo}>
          <p className="mb-1 text-2xs font-semibold uppercase tracking-[0.08em] text-slate-500">{g.grupo}</p>
          <ul className="space-y-1">
            {g.articulos.map(([id, texto]) => (
              <Articulo key={id} id={id} cogido={cogidos.includes(id)} marcar={marcar}>
                {texto}
              </Articulo>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
