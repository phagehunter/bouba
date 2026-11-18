// Keeps a copy of the app on the device so it opens without a connection.
// The cache is named after the app version, so a new version replaces the old copy.
const VERSION = new URL(self.location.href).searchParams.get('v') || 'dev';
const CACHE = 'name-check-2-' + VERSION;

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(['./', './manifest.webmanifest', './icon-192.png', './icon-512.png', './fonts/Fredoka-variable.ttf', './fonts/AtkinsonHyperlegibleNext-variable.ttf'])));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('name-check-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  // Pages: try the network first so updates arrive, and fall back to the saved copy.
  if (req.mode === 'navigate') {
    event.respondWith(fetch(req).then((res) => { caches.open(CACHE).then((c) => c.put('./', res.clone())); return res; }).catch(() => caches.match('./')));
    return;
  }
  // Everything else: use the saved copy if there is one.
  event.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
    return res;
  })));
});
