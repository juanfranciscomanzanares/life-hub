import React from "react";

/*
  Red de seguridad. Sin esto, cualquier error de JavaScript deja el <div id="root">
  vacío y, como el body es #020617, se ve una pantalla casi en negro sin ninguna
  pista de qué ha pasado.

  Ojo con el formato: en WebKit (Safari y Chrome en iPhone) `error.stack` contiene
  SOLO los frames, sin el mensaje — al revés que en Chrome de escritorio. Por eso
  aquí se pintan por separado el nombre, el mensaje, el componente que falló y la
  pila. Sin el mensaje, la traza sola no sirve para diagnosticar nada.
*/
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null, componentStack: "", copiado: false };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    this.setState({ componentStack: info?.componentStack || "" });
    console.error("Life Hub - error no controlado:", error, info);
  }

  informe() {
    const e = this.state.error;
    return [
      "MENSAJE: " + (e?.name || "Error") + ": " + (e?.message || String(e)),
      "",
      "COMPONENTE:" + (this.state.componentStack || " (no disponible)"),
      "",
      "PILA:",
      e?.stack || "(no disponible)",
      "",
      "NAVEGADOR: " + navigator.userAgent,
    ].join("\n");
  }

  copiar = async () => {
    try {
      await navigator.clipboard.writeText(this.informe());
      this.setState({ copiado: true });
    } catch {
      this.setState({ copiado: false });
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    const e = this.state.error;

    return (
      <div className="min-h-screen bg-slate-950 p-4 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-900 bg-slate-900 p-5">
          <h1 className="mb-3 text-lg font-bold text-rose-300">Algo ha fallado</h1>

          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Error
          </p>
          <p className="mb-4 rounded-lg bg-slate-950 p-3 text-sm font-semibold text-rose-300">
            {(e?.name || "Error") + ": " + (e?.message || String(e))}
          </p>

          {this.state.componentStack && (
            <>
              <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Componente
              </p>
              <pre className="mb-4 max-h-32 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-amber-300">
                {this.state.componentStack.trim()}
              </pre>
            </>
          )}

          <details className="mb-4">
            <summary className="cursor-pointer text-xs text-slate-500">Ver pila completa</summary>
            <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-slate-400">
              {e?.stack || "(no disponible)"}
            </pre>
          </details>

          <button
            onClick={this.copiar}
            className="mb-2 w-full rounded-lg bg-slate-700 px-4 py-2.5 text-sm font-semibold text-white"
          >
            {this.state.copiado ? "✓ Copiado" : "Copiar informe de error"}
          </button>
          <button
            onClick={reiniciarApp}
            className="w-full rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Reiniciar app (borra caché)
          </button>
        </div>
      </div>
    );
  }
}

/*
  Borra service workers y cachés y recarga. NO toca localStorage, así que los
  datos guardados y la sesión se conservan.
*/
export async function reiniciarApp() {
  try {
    if ("serviceWorker" in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch (e) {
    console.warn("No se pudo limpiar del todo:", e);
  }
  window.location.replace(window.location.origin + "/?fresh=" + Date.now());
}
