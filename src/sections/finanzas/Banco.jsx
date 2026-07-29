import { useState, useEffect, useMemo } from "react";
import { Landmark, RefreshCw, Link2, Unlink, Check, AlertCircle, Search } from "lucide-react";
import { usePersisted } from "../../lib/store";
import { toast } from "../../lib/toast";
import { Card } from "../../lib/ui";
import { cloudEnabled } from "../../lib/supabase";
import { listarBancos, conectarBanco, listarCuentas, listarMovimientos } from "../../lib/bancoSync";
import { CATEGORIAS, REGLAS_POR_DEFECTO, separarNuevos } from "../../lib/banco";

/*
  Conexión con el banco (GoCardless / PSD2), en tres pasos:

    1. Eliges tu entidad y autorizas en la web del banco.
    2. Al volver, eliges cuál de tus cuentas quieres seguir.
    3. "Sincronizar" trae los movimientos, los categoriza y los enseña ANTES de
       importarlos.

  El paso 3 es a propósito una previsualización y no una importación
  automática: la categoría la adivina una lista de reglas por texto
  ("mercadona" -> Comida) y acierta bastante, pero no siempre. Es mucho más
  rápido corregir cuatro categorías aquí que buscarlas luego entre cien filas.

  Reimportar es seguro: los movimientos ya importados se reconocen por el
  identificador que da el banco (`refBanco`) y no se vuelven a colar.

  El consentimiento caduca a los 90 días por normativa. Cuando pasa, el banco
  deja de dar movimientos y hay que repetir el paso 1: no es un fallo.
*/

const CONEXION_VACIA = {
  requisitionId: "",
  bancoId: "",
  bancoNombre: "",
  cuentaId: "",
  cuentaNombre: "",
  iban: "",
  conectadoEl: "",
  ultimaSync: "",
};

// La URL a la que vuelve el banco: la propia app, sin parámetros ni hash, que
// es lo único que GoCardless acepta como redirección estable.
const volverAqui = () => `${window.location.origin}${window.location.pathname}`;

const soloUltimos = (iban) => (iban ? `····${iban.slice(-4)}` : "");

export default function Banco({ movimientosActuales, onImportar }) {
  const [conexion, setConexion] = usePersisted("lh_banco_conexion", CONEXION_VACIA);
  const [reglas] = usePersisted("lh_banco_reglas", REGLAS_POR_DEFECTO);

  const [bancos, setBancos] = useState([]);
  const [busqueda, setBusqueda] = useState("");
  const [cuentas, setCuentas] = useState([]);
  const [pendientes, setPendientes] = useState(null); // previsualización
  const [yaEstaban, setYaEstaban] = useState(0);
  const [cargando, setCargando] = useState("");
  const [error, setError] = useState("");

  const conectado = Boolean(conexion.cuentaId);
  const autorizando = Boolean(conexion.requisitionId) && !conectado;

  const fallo = (e) => setError(e instanceof Error ? e.message : String(e));

  /*
    Al volver del banco no hay ningún parámetro fiable en la URL, así que lo
    que se mira es si quedó una autorización a medias: si la hay, se preguntan
    las cuentas concedidas. Si el usuario canceló, el banco no concede ninguna
    y se queda esperando, que es lo correcto.
  */
  useEffect(() => {
    if (!autorizando) return;
    let vivo = true;

    setCargando("cuentas");
    listarCuentas(conexion.requisitionId)
      .then((r) => {
        if (!vivo) return;
        setCuentas(r.cuentas ?? []);
        if ((r.cuentas ?? []).length === 0) {
          setError("El banco todavía no ha concedido ninguna cuenta. Termina la autorización y vuelve.");
        }
      })
      .catch((e) => vivo && fallo(e))
      .finally(() => vivo && setCargando(""));

    return () => {
      vivo = false;
    };
  }, [autorizando, conexion.requisitionId]);

  const bancosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    const lista = q ? bancos.filter((b) => b.nombre.toLowerCase().includes(q)) : bancos;
    return lista.slice(0, 40);
  }, [bancos, busqueda]);

  const cargarBancos = async () => {
    setError("");
    setCargando("bancos");
    try {
      setBancos(await listarBancos("ES"));
    } catch (e) {
      fallo(e);
    } finally {
      setCargando("");
    }
  };

  const conectar = async (banco) => {
    setError("");
    setCargando("conectar");
    try {
      const { requisitionId, enlace } = await conectarBanco({
        bancoId: banco.id,
        dias: banco.dias,
        volverA: volverAqui(),
      });
      // Se guarda ANTES de salir de la app: al volver, esto es lo único que
      // permite saber qué autorización estaba en marcha.
      setConexion({ ...CONEXION_VACIA, requisitionId, bancoId: banco.id, bancoNombre: banco.nombre });
      window.location.href = enlace;
    } catch (e) {
      fallo(e);
      setCargando("");
    }
  };

  const elegirCuenta = (cuenta) => {
    setConexion({
      ...conexion,
      cuentaId: cuenta.id,
      cuentaNombre: cuenta.nombre,
      iban: cuenta.iban,
      conectadoEl: new Date().toISOString().slice(0, 10),
    });
    setCuentas([]);
    setError("");
  };

  const desconectar = () => {
    setConexion(CONEXION_VACIA);
    setCuentas([]);
    setPendientes(null);
    setBancos([]);
    setError("");
  };

  const sincronizar = async () => {
    setError("");
    setPendientes(null);
    setCargando("sync");
    try {
      const movimientos = await listarMovimientos(conexion.cuentaId);
      const { nuevos, yaEstaban: repetidos } = separarNuevos(movimientos, movimientosActuales, reglas);

      setYaEstaban(repetidos.length);
      setPendientes(nuevos.map((m) => ({ ...m, importar: true })));
      setConexion({ ...conexion, ultimaSync: new Date().toISOString() });

      if (nuevos.length === 0) toast("Sin movimientos nuevos: ya está todo importado");
    } catch (e) {
      fallo(e);
    } finally {
      setCargando("");
    }
  };

  const importar = () => {
    const elegidos = pendientes.filter((m) => m.importar).map(({ importar: _, ...fila }) => fila);
    if (elegidos.length === 0) return;
    onImportar(elegidos);
    setPendientes(null);
    toast(`${elegidos.length} ${elegidos.length === 1 ? "movimiento importado" : "movimientos importados"}`);
  };

  const cambiar = (id, cambios) =>
    setPendientes(pendientes.map((m) => (m.id === id ? { ...m, ...cambios } : m)));

  const marcados = pendientes?.filter((m) => m.importar).length ?? 0;

  return (
    <Card className="mb-6">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Landmark size={18} className="text-teal-400" />
        <h2 className="text-lg font-semibold text-slate-100">Banco</h2>
        {conectado && (
          <span className="rounded-full bg-teal-500/15 px-3 py-1 text-xs font-semibold text-teal-300">
            {conexion.bancoNombre} · {conexion.cuentaNombre} {soloUltimos(conexion.iban)}
          </span>
        )}
        {conectado && (
          <button
            onClick={desconectar}
            className="ml-auto flex items-center gap-1.5 text-xs text-slate-500 transition hover:text-rose-400"
          >
            <Unlink size={13} /> Desconectar
          </button>
        )}
      </div>

      {!cloudEnabled && (
        <p className="text-sm text-slate-400">
          Para conectar el banco hace falta la nube (Supabase) configurada y la función{" "}
          <code className="text-slate-300">bank-sync</code> desplegada. Mientras tanto, puedes seguir
          apuntando los movimientos a mano.
        </p>
      )}

      {error && (
        <p className="mb-3 flex items-start gap-2 rounded-lg bg-rose-500/10 px-3 py-2 text-sm text-rose-300">
          <AlertCircle size={16} className="mt-0.5 shrink-0" /> {error}
        </p>
      )}

      {/* Paso 1: elegir entidad */}
      {cloudEnabled && !conectado && !autorizando && (
        <div>
          <p className="mb-3 text-sm text-slate-400">
            Conecta tu banco y los gastos e ingresos entran solos. Es solo lectura: se pueden
            consultar movimientos, nunca mover dinero.
          </p>
          {bancos.length === 0 ? (
            <button
              onClick={cargarBancos}
              disabled={cargando === "bancos"}
              className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:opacity-50"
            >
              <Link2 size={16} /> {cargando === "bancos" ? "Cargando bancos..." : "Conectar banco"}
            </button>
          ) : (
            <>
              <div className="mb-3 flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800 px-3">
                <Search size={15} className="text-slate-500" />
                <label className="sr-only" htmlFor="banco-buscar">
                  Buscar tu banco
                </label>
                <input
                  id="banco-buscar"
                  name="banco-buscar"
                  value={busqueda}
                  onChange={(e) => setBusqueda(e.target.value)}
                  placeholder="Busca tu banco (BBVA, Santander, ING...)"
                  className="w-full bg-transparent py-2 text-sm text-slate-100 placeholder-slate-500 focus:outline-none"
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {bancosFiltrados.map((b) => (
                  <button
                    key={b.id}
                    onClick={() => conectar(b)}
                    disabled={cargando === "conectar"}
                    className="rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs text-slate-300 transition hover:border-teal-500 hover:text-teal-300 disabled:opacity-50"
                  >
                    {b.nombre}
                  </button>
                ))}
                {bancosFiltrados.length === 0 && (
                  <p className="text-sm text-slate-500">Ningún banco con ese nombre.</p>
                )}
              </div>
            </>
          )}
        </div>
      )}

      {/* Paso 2: elegir cuenta */}
      {autorizando && (
        <div>
          <p className="mb-3 text-sm text-slate-400">
            {cargando === "cuentas"
              ? `Comprobando qué cuentas ha concedido ${conexion.bancoNombre}...`
              : `Elige la cuenta de ${conexion.bancoNombre} que quieres seguir.`}
          </p>
          <div className="space-y-2">
            {cuentas.map((c) => (
              <button
                key={c.id}
                onClick={() => elegirCuenta(c)}
                className="flex w-full items-center gap-3 rounded-lg border border-slate-700 bg-slate-800/60 px-3 py-2 text-left text-sm transition hover:border-teal-500"
              >
                <span className="flex-1 text-slate-200">{c.nombre}</span>
                <span className="text-xs text-slate-500">{soloUltimos(c.iban)}</span>
              </button>
            ))}
          </div>
          <button onClick={desconectar} className="mt-3 text-xs text-slate-500 underline">
            Cancelar la conexión
          </button>
        </div>
      )}

      {/* Paso 3: sincronizar e importar */}
      {conectado && (
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={sincronizar}
              disabled={cargando === "sync"}
              className="flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-400 disabled:opacity-50"
            >
              <RefreshCw size={16} className={cargando === "sync" ? "animate-spin" : ""} />
              {cargando === "sync" ? "Sincronizando..." : "Sincronizar movimientos"}
            </button>
            {conexion.ultimaSync && (
              <span className="text-xs text-slate-500">
                Última vez: {new Date(conexion.ultimaSync).toLocaleString("es-ES")}
              </span>
            )}
          </div>

          {pendientes && pendientes.length > 0 && (
            <div className="mt-4">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-slate-200">
                  {pendientes.length} {pendientes.length === 1 ? "movimiento nuevo" : "movimientos nuevos"}
                </p>
                {yaEstaban > 0 && (
                  <span className="text-xs text-slate-500">({yaEstaban} ya estaban importados)</span>
                )}
                <button
                  onClick={importar}
                  disabled={marcados === 0}
                  className="ml-auto flex items-center gap-2 rounded-lg bg-indigo-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:opacity-40"
                >
                  <Check size={16} /> Importar {marcados}
                </button>
              </div>

              <div className="max-h-96 space-y-1.5 overflow-y-auto pr-1">
                {pendientes.map((m) => (
                  <div
                    key={m.id}
                    className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-800 bg-slate-800/40 px-3 py-2 text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={m.importar}
                      onChange={(e) => cambiar(m.id, { importar: e.target.checked })}
                      aria-label={`Importar ${m.concepto}`}
                      className="h-4 w-4 accent-indigo-500"
                    />
                    <span className="w-20 shrink-0 text-xs text-slate-500">{m.fecha}</span>
                    <span className="min-w-0 flex-1 truncate text-slate-200">{m.concepto}</span>
                    <label className="sr-only" htmlFor={`cat-${m.id}`}>
                      Categoría de {m.concepto}
                    </label>
                    <select
                      id={`cat-${m.id}`}
                      value={m.categoria}
                      onChange={(e) => cambiar(m.id, { categoria: e.target.value })}
                      className="rounded bg-slate-800 px-2 py-1 text-xs text-slate-300 focus:outline-none"
                    >
                      {CATEGORIAS.map((c) => (
                        <option key={c}>{c}</option>
                      ))}
                    </select>
                    <span
                      className={`w-20 shrink-0 text-right font-semibold ${
                        m.monto >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {m.monto}€
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
