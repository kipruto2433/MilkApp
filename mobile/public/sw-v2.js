// This distinct worker URL replaces the original self-cached worker.
const CACHE_NAME = 'milktrack-shell-v4';
const APP_SHELL = ['/', '/manifest.json', '/icons/milktrack-icon.svg', '/icons/milktrack-maskable.svg'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys
      .filter((key) => key !== CACHE_NAME)
      .map((key) => caches.delete(key))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET' || new URL(event.request.url).origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => response)
        .catch(() => caches.match('/'))
    );
    return;
  }

  // App code is always returned from the network. Do not cache a response
  // here: Cache Storage consumes response bodies and can race the browser's
  // use of the same stream, which caused the blank screen on launch.
  event.respondWith(
    fetch(event.request)
      .then((response) => response)
      .catch(() => caches.match(event.request))
  );
});
