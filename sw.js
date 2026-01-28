const CACHE_NAME = 'finanzas-v1';

const FILES_TO_CACHE = [
  '/Finanzas_basicas/',
  '/Finanzas_basicas/index.html',
  '/Finanzas_basicas/styles.css',
  '/Finanzas_basicas/app.js',
  '/Finanzas_basicas/manifest.json',
  '/Finanzas_basicas/icon-192.png',
  '/Finanzas_basicas/icon-512.png'
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
