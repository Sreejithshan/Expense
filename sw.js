const CACHE_NAME = 'finmob-v7';

const APP_SHELL = [
  '/Expense/',
  '/Expense/index.html',
  '/Expense/manifest.json',
  '/Expense/sw.js'
];

// Install and cache app shell
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(APP_SHELL))
  );

  self.skipWaiting();
});

// Activate and clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      )
    )
  );

  self.clients.claim();
});

// Fetch handler
self.addEventListener('fetch', event => {

  // Ignore non-GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(response => {

        // Save fresh copy to cache
        const responseClone = response.clone();

        caches.open(CACHE_NAME)
          .then(cache => cache.put(event.request, responseClone));

        return response;

      })
      .catch(() => {

        // Offline fallback
        return caches.match(event.request)
          .then(cached => {

            if (cached) {
              return cached;
            }

            // Fallback to app shell
            return caches.match('/Expense/index.html');

          });

      })
  );
});