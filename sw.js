// FinMob Service Worker — always fetch fresh, update instantly
const CACHE = 'finmob-v5';

self.addEventListener('install', e => {
  self.skipWaiting(); // activate immediately
});

self.addEventListener('activate', e => {
  // delete ALL old caches on every activation
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  // Always go to network first — never serve stale cache
  e.respondWith(
    fetch(e.request, { cache: 'no-store' })
      .catch(() => {
        // Only use cache as fallback when offline
        return caches.match(e.request);
      })
  );
});
