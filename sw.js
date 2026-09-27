// Beanbound service worker — caches the app shell so the game works
// fully offline once it has been opened at least once.
//
// Bump CACHE_VERSION any time you deploy a new build of index.html so
// returning players pick up the update instead of being stuck on an
// old cached copy.
const CACHE_VERSION = 'beanbound-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_VERSION)
            .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Cache-first, falling back to network, with a background refresh so
// the cache quietly stays current whenever a connection is available.
// If the network is unreachable (offline) we just serve what we have.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.match(req).then((cached) => {
      const networkFetch = fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);

      // Serve cached instantly if we have it; otherwise wait on network.
      return cached || networkFetch;
    })
  );
});
