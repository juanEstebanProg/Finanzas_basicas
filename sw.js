const CACHE_NAME = 'finanzas-v1';

const FILES_TO_CACHE = [
  './',
  './index.html',
  './styles.css',
  './app.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(FILES_TO_CACHE))
  );
});

self.addEventListener('fetch', e => {
  e.respondWith(
    caches.match(e.request).then(res => res || fetch(e.request))
  );
});
