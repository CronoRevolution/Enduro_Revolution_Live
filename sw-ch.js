/**
 * sw-ch.js — Service worker mínimo para la app de Control Horario.
 *
 * Su único cometido es cumplir el requisito de Chrome/Android para que la app
 * sea instalable ("Añadir a pantalla de inicio") y que arranque aunque el móvil
 * esté sin cobertura en ese momento.
 *
 * Estrategia deliberadamente simple: red primero, caché como respaldo.
 * NO cacheamos datos de Firebase (esos van siempre en vivo); solo el HTML y el
 * manifest, para que la app abra sin cobertura y siga fichando en local.
 */

const CACHE = 'ch-v1';
const ESENCIALES = [
  './control-horario.html',
  './manifest-ch.json',
];

self.addEventListener('install', (e) => {
  // Activar de inmediato la versión nueva sin esperar a que se cierren pestañas
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(ESENCIALES)).catch(() => {})
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = e.request.url;
  // Nunca interceptar Firebase ni peticiones que no sean GET: los datos siempre
  // deben ir en vivo, jamás servidos desde caché.
  if (e.request.method !== 'GET') return;
  if (url.includes('firebasedatabase.app') ||
      url.includes('firebaseio.com') ||
      url.includes('googleapis.com') ||
      url.includes('gstatic.com')) return;

  // Red primero; si falla (sin cobertura), servir de caché.
  e.respondWith(
    fetch(e.request)
      .then(resp => {
        // Guardar una copia fresca para la próxima vez que no haya red
        const copia = resp.clone();
        caches.open(CACHE).then(c => c.put(e.request, copia)).catch(() => {});
        return resp;
      })
      .catch(() => caches.match(e.request).then(r => r || caches.match('./control-horario.html')))
  );
});
