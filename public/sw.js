// Vite replaces these markers with the complete, content-versioned app shell.
const PRECACHE = '__PRECACHE_MANIFEST__';
const VERSION = '__PRECACHE_VERSION__';
const SCOPE = self.registration.scope;
const PREFIX = `tiny-bean-cafe:${encodeURIComponent(SCOPE)}:`;
const CACHE = `${PREFIX}${VERSION}`;
const SHELL = new URL('./index.html', SCOPE).href;

self.addEventListener('install', (event) => {
  // Do not activate until even assets loaded before registration are available
  // offline. A failed install leaves the previous working worker/cache intact.
  event.waitUntil((async () => {
    if (!Array.isArray(PRECACHE)) throw new Error('Service worker must be built by Vite');
    const cache = await caches.open(CACHE);
    await cache.addAll(PRECACHE.map((path) => new Request(new URL(path, SCOPE), { cache: 'reload' })));
  })());
  // Let updates wait for old tabs to close; replacing a live worker can mix
  // versions or remove assets still needed by an open game.
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key.startsWith(PREFIX) && key !== CACHE).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(SCOPE)) return;
  if (req.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const response = await fetch(req);
        if (response.ok) return response;
      } catch { /* Use the complete installed shell when offline. */ }
      const cache = await caches.open(CACHE);
      const shell = await cache.match(SHELL);
      if (!shell) return Response.error();
      // A relative-base build must reopen at its app root. Serving its HTML at
      // a nested bookmark would resolve ./assets against the wrong directory.
      if (url.pathname !== new URL(SCOPE).pathname && url.pathname !== new URL(SHELL).pathname) {
        return Response.redirect(SCOPE);
      }
      return shell;
    })());
    return;
  }
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(req);
    if (cached) return cached;
    const response = await fetch(req);
    if (response.ok) {
      // Keep runtime writes alive even after the response is handed to the page.
      event.waitUntil(cache.put(req, response.clone()).catch(() => {}));
    }
    return response;
  })());
});
