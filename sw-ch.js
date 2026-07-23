/**
 * sw-ch.js — Service worker de la app de Control Horario.
 *
 * Cumple el requisito de Chrome/Android para que la app sea instalable y
 * permite abrirla sin cobertura (los fichajes se guardan en local igualmente).
 *
 * IMPORTANTE: solo gestiona control-horario.html. No toca la app de
 * espectadores (index.html), que tiene su propio service worker.
 */

const CACHE = 'ch-v2';
const ESENCIALES = ['./control-horario.html', './manifest-ch.json'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ESENCIALES)).catch(() => {}));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k.startsWith('ch-') && k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = e.request.url;

  // NUNCA interceptar Firebase ni recursos externos: los datos van siempre en vivo.
  if (url.includes('firebasedatabase.app') || url.includes('firebaseio.com') ||
      url.includes('googleapis.com') || url.includes('gstatic.com')) return;

  // Solo gestionar la propia app de CH; el resto del sitio no es asunto nuestro.
  if (!url.includes('control-horario') && !url.includes('manifest-ch')) return;

  e.respondWith(
    fetch(e.request)
      .then(resp => {
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./control-horario.html')))
  );
});
