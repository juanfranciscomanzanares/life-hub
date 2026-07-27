import React from "react";

/*
  Red de seguridad. Sin esto, cualquier error de JavaScript deja el <div id="root">
  vacío y, como el body es #020617, se ve una pantalla casi en negro sin ninguna
  pista de qué ha pasado (justo el síntoma del móvil).

  Con esto, el error se ve en pantalla y hay un botón para limpiar caché +
  service worker, que es lo que arregla el 90% de los casos en un PWA.
*/
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error("Life Hub - error no controlado:", error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <div className="min-h-screen bg-slate-950 p-6 text-slate-200">
        <div className="mx-auto max-w-lg rounded-2xl border border-rose-900 bg-slate-900 p-6">
          <h1 className="mb-2 text-lg font-bold text-rose-300">Algo ha fallado</h1>
          <p className="mb-4 text-sm text-slate-400">
            La app no ha podido cargar. Prueba a reiniciarla; si sigue igual, envíame
            el texto de abajo.
          </p>
          <pre className="mb-4 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-slate-950 p-3 text-xs text-rose-300">
            {String(this.state.error?.stack || this.state.error)}
          </pre>
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
