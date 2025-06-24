self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open('pwa-cache').then((cache) =>
      cache.addAll([
        '/',
        '/index.html',
        '/manifest.webmanifest',
        '/icons/icon-192x192.png',
        '/icons/icon-512x512.png'
      ])
    ).catch(err => console.error('Install error:', err))
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request)
      .then((response) => response || fetch(e.request))
      .catch(err => {
        console.error('Fetch error:', err);
        return new Response('Offline or error.', { status: 503 });
      })
  );
});
