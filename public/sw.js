// Offline support: cache-first for assets, network-first for the page itself.
const CACHE = 'tiny-bean-cafe-v1';

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  const put = (res) => {
    if (res.ok) {
      const copy = res.clone();
      caches.open(CACHE).then((c) => c.put(req, copy));
    }
    return res;
  };
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then(put).catch(() => caches.match(req).then((r) => r || caches.match('./'))));
    return;
  }
  event.respondWith(caches.match(req).then((cached) => cached || fetch(req).then(put)));
});
