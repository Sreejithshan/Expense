// ═══════════════════════════════════════════════════════════
// FinMob — Production Service Worker
// GitHub Pages: https://sreejithshan.github.io/Expense/
// ═══════════════════════════════════════════════════════════

const BASE        = '/Expense/';
const SHELL_CACHE = 'finmob-shell-v5';
const DATA_CACHE  = 'finmob-data-v5';

// App shell — cached immediately on install
const SHELL_FILES = [
  BASE,
  BASE + 'index.html',
  BASE + 'manifest.json',
  BASE + 'sw.js',
];

// ── INSTALL: cache app shell ──────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(SHELL_CACHE)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())   // activate immediately
      .catch(err => console.warn('SW install error:', err))
  );
});

// ── ACTIVATE: delete old caches ──────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== SHELL_CACHE && k !== DATA_CACHE)
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())  // take control of all tabs
  );
});

// ── FETCH: smart caching strategy ────────────────────────
self.addEventListener('fetch', e => {
  const req = e.request;
  const url = new URL(req.url);

  // Only handle GET requests from our own origin
  if (req.method !== 'GET') return;
  if (url.origin !== location.origin) return;

  // ── JSON data files: Network-first ──
  if (url.pathname.endsWith('.json') && !url.pathname.endsWith('manifest.json')) {
    e.respondWith(networkFirst(req, DATA_CACHE));
    return;
  }

  // ── App shell (HTML, JS, CSS): Stale-while-revalidate ──
  // Serve from cache instantly (fast), update cache in background
  e.respondWith(staleWhileRevalidate(req));
});

// ── STRATEGY: Stale-while-revalidate ─────────────────────
async function staleWhileRevalidate(req) {
  const cache  = await caches.open(SHELL_CACHE);
  const cached = await cache.match(req);

  // Fetch from network in background to keep cache fresh
  const fetchPromise = fetch(req)
    .then(resp => {
      if (resp && resp.status === 200) {
        cache.put(req, resp.clone());
      }
      return resp;
    })
    .catch(() => null);

  // Return cached immediately, or wait for network if not cached
  return cached || fetchPromise || fallback();
}

// ── STRATEGY: Network-first with cache fallback ───────────
async function networkFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  try {
    const resp = await fetch(req, { cache: 'no-store' });
    if (resp && resp.status === 200) {
      cache.put(req, resp.clone());
    }
    return resp;
  } catch {
    return (await cache.match(req)) || fallback();
  }
}

// ── FALLBACK: serve index.html when fully offline ─────────
async function fallback() {
  const cache = await caches.open(SHELL_CACHE);
  return cache.match(BASE + 'index.html');
}
