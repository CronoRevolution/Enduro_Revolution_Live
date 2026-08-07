// Service worker mínimo: solo existe para que la PWA sea instalable.
// NO intercepta peticiones de red: la app necesita datos siempre frescos
// de Supabase, y cachear/interceptar causaba errores. Dejamos que el
// navegador maneje todas las peticiones con normalidad.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));
// Sin handler de "fetch": el navegador hace las peticiones directamente.
