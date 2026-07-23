// Service Worker — Enduro Revolution Clasificación Móvil
// v7: Igual que v6, pero IGNORA por completo la app de comisario.
//   El problema de v6: `comisario.html` acababa en `.html`, entraba por la regla
//   del shell (stale-while-revalidate) y se servía desde caché — devolviendo la
//   clasificación en lugar de la app del comisario. Además, el fallback final
//   `caches.match("./")` reforzaba el efecto.
//   Solución: una lista de rutas EXCLUIDAS que el SW deja pasar a la red sin
//   interceptar. Así el comisario siempre recibe su HTML fresco del servidor.
//
//   - Shell HTML/CSS/JS: stale-while-revalidate (rápido + detecta updates).
//   - Datos en vivo (live.json, índice, archivo/*.json): network-first.
//   - Iconos / imágenes: cache-first.

const CACHE_NAME = "enduro-clasif-v7";
const SHELL = ["./", "./index.html", "./manifest.json", "./icon-192.png", "./icon-512.png"];

// Rutas que este SW NO debe tocar nunca (tienen su propio ciclo de vida).
const EXCLUIDAS = ["comisario.html", "manifest-comisario.json", "control-horario.html"];
function estaExcluida(path) {
  return EXCLUIDAS.some(x => path.includes(x));
}

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

  // ── App de comisario: NO interceptar. Va directa a la red. ────────────────
  // Sin esta salida temprana, el SW le servía la clasificación desde caché.
  if (estaExcluida(path)) return;

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

  // Otros (imágenes, iconos): cache-first.
  // El fallback a "./" solo se aplica a recursos de la propia clasificación.
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
