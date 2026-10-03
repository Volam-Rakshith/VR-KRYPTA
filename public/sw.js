/* VR KRYPTA service worker — offline app shell + runtime caching.
   The app shell is precached on install; the Pyodide CDN runtime is cached
   on first use, so Python-backed operations work offline afterwards. */
const SHELL = 'vrk-shell-v1';
const RUNTIME = 'vrk-runtime-v1';
const SHELL_ASSETS = ['/', '/index.html', '/manifest.webmanifest', '/icons/favicon.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL).then((c) => c.addAll(SHELL_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== RUNTIME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET') return;

  // Pyodide CDN: cache-first once fetched (it is pinned + immutable).
  if (url.hostname === 'cdn.jsdelivr.net') {
    event.respondWith(
      caches.open(RUNTIME).then(async (cache) => {
        const hit = await cache.match(event.request);
        if (hit) return hit;
        const res = await fetch(event.request);
        if (res.ok) cache.put(event.request, res.clone());
        return res;
      })
    );
    return;
  }

  if (url.origin !== self.location.origin) return;

  // Static assets: cache-first; everything else: network-first with cache fallback.
  if (/\.(?:js|css|svg|png|woff2?)$/.test(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((hit) => hit || fetch(event.request).then((res) => {
        if (res.ok) {
          const clone = res.clone();
          caches.open(SHELL).then((c) => c.put(event.request, clone));
        }
        return res;
      }))
    );
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((res) => {
        if (res.ok && url.pathname === '/') {
          const clone = res.clone();
          caches.open(SHELL).then((c) => c.put('/', clone));
        }
        return res;
      })
      .catch(() => caches.match(event.request).then((hit) => hit || caches.match('/')))
  );
});
