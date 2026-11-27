// Primero internet (siempre lo más nuevo); si no hay conexión, la copia guardada.
// Cambia el número de versión cuando actualices la app (y el de index.html).
const CACHE = 'finanzas-v3';
const ARCHIVOS = ['./', 'index.html', 'style.css', 'app.js', 'manifest.json', 'icon-180.png', 'icon-512.png'];

self.addEventListener('install', e =>
  e.waitUntil(caches.open(CACHE)
    // 'reload' evita guardar copias viejas que el navegador tenga en memoria
    .then(c => c.addAll(ARCHIVOS.map(u => new Request(u, { cache: 'reload' }))))
    .then(() => self.skipWaiting())));

self.addEventListener('activate', e =>
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim())));

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then(r => {
        if (r.ok) { const copia = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copia)); }
        return r;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true })));
});
