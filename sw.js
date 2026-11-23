// Service worker: keeps the print page, pdf-lib and templates on the device so printing works offline.
// Strategy: serve from the device copy first (fast, works offline), then refresh that copy from the
// server in the background whenever there is a connection.
// Bump VERSION when you change files and want devices to drop old copies.
const VERSION = 'v1';
const CACHE = 'print-page-' + VERSION;
const PRECACHE = ['index.html', 'pdf-lib.min.js', 'template.pdf'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('print-page-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  // Treat "/" and "index.html?..." as the same page; values after # never reach the network anyway.
  const key = url.pathname.endsWith('/') ? url.pathname + 'index.html' : url.pathname;

  e.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const stored = await cache.match(key);
    const network = fetch(e.request).then(resp => {
      if (resp.ok) cache.put(key, resp.clone());   // also stores any new template (e.g. NOV.pdf) on first use
      return resp;
    });
    if (stored) { e.waitUntil(network.catch(() => {})); return stored; }
    return network;   // not stored yet: must come from the server (fails offline)
  })());
});
