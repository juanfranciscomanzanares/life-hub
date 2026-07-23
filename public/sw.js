// Service worker sencillo: cachea la app y sirve offline (stale-while-revalidate).
const CACHE = "life-hub-v1";

self.addEventListener("install", (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.add("/")));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
  );
  self.clients.claim();
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
  // Solo peticiones GET del propio origen; el resto (APIs externas) van directas.
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((cached) => {
      const network = fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => cached || caches.match("/"));
      return cached || network;
    })
  );
});
