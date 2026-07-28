import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// Registro del service worker (PWA: instalable y offline)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("/sw.js");

      // Busca versión nueva al abrir y cada 30 min. Sin esto, un móvil que ya
      // tenía la app instalada podía quedarse con una versión antigua para
      // siempre y no ver ninguna corrección.
      reg.update();
      setInterval(() => reg.update(), 30 * 60 * 1000);

      // Cuando entra un SW nuevo, se activa y recargamos una sola vez.
      let recargado = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (recargado) return;
        recargado = true;
        window.location.reload();
      });
      reg.addEventListener("updatefound", () => {
        const nuevo = reg.installing;
        if (!nuevo) return;
        nuevo.addEventListener("statechange", () => {
          if (nuevo.state === "installed" && navigator.serviceWorker.controller) {
            nuevo.postMessage("SKIP_WAITING");
          }
        });
      });
    } catch (err) {
      console.warn("SW no registrado:", err);
    }
  });
}
