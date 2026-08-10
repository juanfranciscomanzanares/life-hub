// Service worker de Life Hub.
//
// Estrategia (importante, arreglo del "pantallazo negro" en el mÃ³vil):
//   - Navegaciones (el HTML): SIEMPRE red primero. Si no hay red, cae al HTML
//     cacheado. Nunca al revÃ©s: si servimos el HTML viejo desde cachÃ©, ese HTML
//     apunta a bundles /assets/index-XXXX.js que ya no existen en el servidor
//     tras un redespliegue â†’ 404 â†’ pantalla en blanco/negra para siempre.
//   - Assets con hash (/assets/...): cachÃ© primero, son inmutables.
//   - Resto de GET del propio origen: stale-while-revalidate.
//   - Nunca devolvemos HTML como respuesta a una peticiÃ³n de JS/CSS (provocarÃ­a
//     un error de MIME type y tambiÃ©n dejarÃ­a la pantalla en negro).
// SÃºbela al cambiar iconos o manifest: al activarse, el SW borra las cachÃ©s de
// versiones anteriores. Sin eso, "stale-while-revalidate" servirÃ­a el icono
// viejo durante toda la primera visita y el nuevo no se verÃ­a hasta la segunda.
const VERSION = "v6";
const CACHE = "life-hub-" + VERSION;
const OFFLINE_URL = "/";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then((c) => c.add(new Request(OFFLINE_URL, { cache: "reload" })))
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

// Permite que la pÃ¡gina fuerce la actualizaciÃ³n del SW.
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

// --- Notificaciones push (Web Push) ---
// Requiere claves VAPID y un backend que envÃ­e los mensajes (ver INTEGRACIONES.md).
self.addEventListener("push", (e) => {
  let payload = { title: "Life Hub", body: "Tienes una novedad." };
  try {
    if (e.data) payload = { ...payload, ...e.data.json() };
  } catch {
    /* payload por defecto */
  }
  e.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  e.waitUntil(self.clients.openWindow("/"));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // APIs externas (Supabase) van directas

  // 1) Navegaciones: red primero, cachÃ© solo como respaldo sin conexiÃ³n.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(OFFLINE_URL, copy));
          return res;
        })
        .catch(() => caches.match(OFFLINE_URL).then((r) => r || Response.error()))
    );
    return;
  }

  // 2) Assets con hash: inmutables, cachÃ© primero.
  const esAssetConHash = url.pathname.startsWith("/assets/");
  if (esAssetConHash) {
    e.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            if (res.ok) {
              const copy = res.clone();
              caches.open(CACHE).then((c) => c.put(req, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // 3) Resto (iconos, manifest...): stale-while-revalidate.
  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached); // ojo: NO devolvemos el HTML de "/" como respaldo
      return cached || network;
    })
  );
});
