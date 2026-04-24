// Service Worker — Enduro Revolution Clasificación Móvil
// Estrategia revisada para evitar problemas de caché persistente:
//  - HTML/manifest: NETWORK-FIRST con fallback a caché (detecta actualizaciones inmediatamente)
//  - live.json, index.json, archivo/: NETWORK-FIRST (siempre datos frescos)
//  - Iconos y otros assets estáticos: CACHE-FIRST (para no saturar la red)

const CACHE_NAME = "enduro-clasif-v4";
const SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => {})
  );
  // Forzar activación inmediata (sin esperar a que se cierren las pestañas antiguas)
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    )).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  const path = url.pathname;

  // Datos vivos (live.json, index.json, archivo/*.json): network-first, sin caché
  const isLiveData = path.endsWith("live.json")
                  || path.endsWith("index.json")
                  || path.includes("/archivo/")
                  || url.hostname === "raw.githubusercontent.com";

  if (isLiveData) {
    event.respondWith(
      fetch(event.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // HTML y manifest: network-first con fallback a caché
  const isShell = path.endsWith(".html")
               || path.endsWith("/")
               || path.endsWith("manifest.json")
               || path.endsWith("sw.js");

  if (isShell) {
    event.respondWith(
      fetch(event.request).then(resp => {
        // Solo cachear respuestas OK
        if (resp.ok) {
          const copy = resp.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        }
        return resp;
      }).catch(() => caches.match(event.request).then(c => c || caches.match("./")))
    );
    return;
  }

  // Otros (iconos, etc.): cache-first
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
      if (resp.ok) {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match("./")))
  );
});
