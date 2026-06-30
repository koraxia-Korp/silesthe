const CACHE = 'silesthe-v2';

const precache = [
  './',
  'index.html',
  'css/styles.css',
  'js/store.js',
  'js/pricing.js',
  'js/app.js',
  'manifest.webmanifest',
  'icons/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(precache))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Only handle GET requests.
  if (request.method !== 'GET') {
    return;
  }

  // Only handle same-origin requests; let cross-origin pass through.
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }

      return fetch(request)
        .then((response) => {
          // Cache successful, basic (same-origin) responses.
          if (response && response.ok && response.type === 'basic') {
            const clone = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // Offline fallback: serve cached index.html for navigations.
          if (request.mode === 'navigate') {
            return caches.match('index.html').then((fallback) => {
              return fallback || caches.match('./');
            });
          }
          return Response.error();
        });
    })
  );
});
