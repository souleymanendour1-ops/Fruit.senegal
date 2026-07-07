// Service worker minimal : cache de l'app shell pour un usage hors-ligne basique.
const CACHE = 'fruit-senegal-v1';
const ASSETS = [
  '/', '/index.html',
  '/css/styles.css',
  '/js/app.js', '/js/api.js',
  '/manifest.webmanifest',
  '/icons/icon.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const { request } = e;
  // On ne met jamais en cache les appels API : toujours réseau.
  if (request.method !== 'GET' || new URL(request.url).pathname.startsWith('/api/')) return;
  e.respondWith(
    caches.match(request).then(cached =>
      cached || fetch(request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(request, copy)).catch(() => {});
        return res;
      }).catch(() => cached)
    )
  );
});
