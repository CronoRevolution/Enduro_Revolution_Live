// Service Worker — Enduro Revolution Clasificación Móvil
// v5: SW simplificado al máximo. La caché de navegador estándar ya hace el trabajo bien.
//     El SW solo existe para que sea una PWA instalable.
//     No interceptamos nada (pasa-todo), así no hay caché interna que pueda quedarse vieja.

const VERSION = "v5";

self.addEventListener("install", event => {
  // Forzar activación inmediata
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    (async () => {
      // Borrar TODAS las cachés anteriores sin excepción
      const keys = await caches.keys();
      await Promise.all(keys.map(k => caches.delete(k)));
      // Reclamar control inmediato de todas las pestañas abiertas
      await self.clients.claim();
      // Recargar todas las pestañas que el nuevo SW acaba de reclamar
      const clients = await self.clients.matchAll({ type: "window" });
      clients.forEach(client => {
        try { client.navigate(client.url); } catch (e) {}
      });
    })()
  );
});

// Pasa-todo: no interceptamos nada. El navegador usa su caché HTTP normal,
// que respeta los headers Cache-Control que envía GitHub Pages (~10 min para HTML).
// Esto es MUCHO más fiable que intentar gestionar caché nosotros con un SW.
self.addEventListener("fetch", event => {
  // Sin event.respondWith() → el navegador maneja la petición de forma nativa
});

// Mensaje de sanity para depurar
self.addEventListener("message", event => {
  if (event.data && event.data.type === "GET_VERSION") {
    event.ports[0]?.postMessage({ version: VERSION });
  }
});
