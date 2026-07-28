// Service worker de Life Hub.
//
// Estrategia (importante, arreglo del "pantallazo negro" en el móvil):
//   - Navegaciones (el HTML): SIEMPRE red primero. Si no hay red, cae al HTML
//     cacheado. Nunca al revés: si servimos el HTML viejo desde caché, ese HTML
//     apunta a bundles /assets/index-XXXX.js que ya no existen en el servidor
//     tras un redespliegue → 404 → pantalla en blanco/negra para siempre.
//   - Assets con hash (/assets/...): caché primero, son inmutables.
//   - Resto de GET del propio origen: stale-while-revalidate.
//   - Nunca devolvemos HTML como respuesta a una petición de JS/CSS (provocaría
//     un error de MIME type y también dejaría la pantalla en negro).
const VERSION = "v3";
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

// Permite que la página fuerce la actualización del SW.
self.addEventListener("message", (e) => {
  if (e.data === "SKIP_WAITING") self.skipWaiting();
});

// --- Notificaciones push (Web Push) ---
// Requiere claves VAPID y un backend que envíe los mensajes (ver INTEGRACIONES.md).
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

  // 1) Navegaciones: red primero, caché solo como respaldo sin conexión.
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

  // 2) Assets con hash: inmutables, caché primero.
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
