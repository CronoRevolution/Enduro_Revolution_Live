// Service Worker — Enduro Revolution Clasificación Móvil
// v6: Estrategia equilibrada para fiabilidad + actualizaciones
//   - Shell HTML/CSS/JS: stale-while-revalidate (sirve rápido desde caché, pero
//     siempre comprueba red en segundo plano y guarda nueva versión para próxima
//     visita). Permite uso offline y a la vez detecta updates rápido.
//   - Datos en vivo (live.json, índice del archivo, archivo/*.json): network-first
//     con fallback a caché. Datos siempre frescos cuando hay red.
//   - Iconos / imágenes: cache-first (no cambian con frecuencia).
// Esto resuelve dos problemas: la app funciona offline (espectadores en zonas
// rurales), y a la vez los updates llegan sin necesidad de cambiar CACHE_NAME.

const CACHE_NAME = "enduro-clasif-v6";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

// Mensaje opcional para forzar skip-waiting desde la app
self.addEventListener("message", event => {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  const path = url.pathname;

  // Datos en vivo: network-first
  const isLiveData = path.endsWith("live.json")
                  || path.endsWith("index.json")
                  || path.includes("/archivo/")
                  || url.hostname === "raw.githubusercontent.com";

  if (isLiveData) {
    event.respondWith(
      fetch(event.request).then(resp => {
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Shell HTML/CSS/JS: stale-while-revalidate
  const isShell = path.endsWith(".html")
               || path.endsWith("/")
               || path.endsWith("manifest.json")
               || path.endsWith(".js")
               || path.endsWith(".css");

  if (isShell) {
    event.respondWith(
      caches.match(event.request).then(cached => {
        const fetchPromise = fetch(event.request).then(resp => {
          if (resp.ok) {
            const copy = resp.clone();
            caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
          }
          return resp;
        }).catch(() => cached);
        return cached || fetchPromise;
      })
    );
    return;
  }

  // Otros (imágenes, iconos): cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(c => c.put(event.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match("./")))
  );
});
