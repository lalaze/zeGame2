// Vite replaces these markers. Each row is [path, content revision, 1 if precached]; it
// lists the whole build, so art cached on first use can still follow later versions.
const FILES = '__PRECACHE_MANIFEST__';
const VERSION = '__PRECACHE_VERSION__';
const SCOPE = self.registration.scope;
const PREFIX = `tiny-bean-cafe:${encodeURIComponent(SCOPE)}:`;
const CACHE = `${PREFIX}${VERSION}`;
const SHELL = new URL('./index.html', SCOPE).href;
/** Written last, so a cache that has one is known to come from a finished install. */
const REVISIONS = new URL('./__revisions__', SCOPE).href;

async function finishedInstalls() {
  const names = (await caches.keys()).filter((name) => name.startsWith(PREFIX) && name !== CACHE);
  const installs = [];
  for (const name of names) {
    const cache = await caches.open(name);
    const record = await cache.match(REVISIONS);
    if (record) installs.push({ cache, revisions: await record.json() });
  }
  return installs;
}

self.addEventListener('install', (event) => {
  // Do not activate until even assets loaded before registration are available
  // offline. A failed install leaves the previous working worker/cache intact.
  event.waitUntil((async () => {
    if (!Array.isArray(FILES)) throw new Error('Service worker must be built by Vite');
    const cache = await caches.open(CACHE);
    // An update only downloads what changed: anything earlier installs already hold at the
    // same revision moves across, including art the player has picked up along the way.
    const installs = await finishedInstalls();
    const missing = [];
    for (const [path, revision, precached] of FILES) {
      const url = new URL(path, SCOPE).href;
      let kept;
      for (const install of installs) {
        if (install.revisions[path] === revision) kept = await install.cache.match(url);
        if (kept) break;
      }
      if (kept) await cache.put(url, kept);
      else if (precached) missing.push(url);
    }
    // Leave network capacity for the game's foreground image loader. Each
    // batch must succeed before starting the next; installation still waits
    // for the complete shell. A failed batch may leave a partial new-version
    // cache, but it cannot activate, and a retry reloads every entry safely.
    // no-cache always checks with the server, so it can't store a stale file, but reuses the
    // copy the page is already downloading instead of fetching every opening image twice.
    const batchSize = 4;
    for (let start = 0; start < missing.length; start += batchSize) {
      const requests = missing.slice(start, start + batchSize)
        .map((url) => new Request(url, { cache: 'no-cache' }));
      await cache.addAll(requests);
    }
    await cache.put(REVISIONS, new Response(JSON.stringify(Object.fromEntries(FILES))));
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
      // Multi-page builds include the artwork gallery as well as the game shell.
      // Prefer the matching precached page instead of redirecting its offline visit.
      const page = new URL(req.url);
      page.search = '';
      page.hash = '';
      const cachedPage = await cache.match(page.href);
      if (cachedPage) return cachedPage;
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
    // What gets stored here counts as this version's copy from now on, so it must not be an
    // older build's file left in the browser's HTTP cache.
    const response = await fetch(req, { cache: 'no-cache' });
    if (response.ok) {
      // Keep runtime writes alive even after the response is handed to the page.
      event.waitUntil(cache.put(req, response.clone()).catch(() => {}));
    }
    return response;
  })());
});
