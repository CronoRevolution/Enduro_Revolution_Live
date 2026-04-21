// Service Worker — Clasificación Enduro
// Estrategia:
//  - HTML, CSS, JS del shell: cache-first (la app se cargue offline tras primera visita)
//  - live.json: network-first con fallback a caché (permite ver últimos datos si se pierde red)

const CACHE_NAME = "enduro-clasif-v2";
const SHELL = ["./", "./index.html", "./manifest.json"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(SHELL)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(
      keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
    ))
  );
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);
  const isLiveData = url.pathname.endsWith("live.json") || url.hostname === "raw.githubusercontent.com";

  if (isLiveData) {
    // Network-first for live data
    event.respondWith(
      fetch(event.request).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
        return resp;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Cache-first for shell
  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(resp => {
      if (resp.ok && event.request.method === "GET") {
        const copy = resp.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)).catch(() => {});
      }
      return resp;
    }).catch(() => caches.match("./")))
  );
});
