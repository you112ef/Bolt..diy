const CACHE_NAME = 'bolt-pwa-cache-v1';
const APP_SHELL_FILES = [
  '/', // Root HTML
  '/manifest.json', // Manifest file
  '/favicon.svg', // Main icon
  // Add paths to your main JS bundles and CSS files here once known.
  // For Remix, these are often in /build/_assets/....css and /build/_assets/....js
  // We'll need to identify these accurately. For now, we can add placeholders
  // or make this list dynamically populated if possible, or update it post-build.
  // Let's add some common placeholders based on Remix structure.
  // The actual filenames will have hashes, so this is a simplification for now.
  // Consider using a build step to generate this list if possible.
  '/build/entry.client.js', // Placeholder, actual name varies
  '/build/root.js', // Placeholder
  '/build/styles.css' // Placeholder
];
const API_ROUTES_PATTERN = /\/api\//; // Pattern to identify API calls

self.addEventListener('install', (event) => {
  console.log('[Service Worker] Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching app shell');
      // Add essential app shell files that are known and won't change frequently
      // between builds without a service worker update.
      const staticAssetsToCache = [
        '/',
        '/manifest.json',
        '/favicon.svg',
        // It's hard to predict hashed asset names here.
        // These should ideally be injected by a build tool.
        // For now, we'll cache the main routes and expect the browser cache
        // to handle versioned assets initially.
      ];
      return cache.addAll(staticAssetsToCache);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Handle API calls with Network First, then Cache
  if (API_ROUTES_PATTERN.test(url.pathname)) {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          // If the fetch is successful, clone it and cache it.
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // If network fails, try to serve from cache
          return caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
              return cachedResponse;
            }
            // Optional: return a generic fallback for API errors if nothing in cache
            // return new Response(JSON.stringify({ error: 'Offline and no cache available' }), {
            //   headers: { 'Content-Type': 'application/json' }
            // });
            return undefined; // Or let the browser handle the error
          });
        })
    );
  }
  // Handle navigation requests (HTML pages) with Network First, then Cache
  // This ensures users get the latest page if online, but can still access visited pages offline.
  else if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          return caches.match(event.request).then((cachedResponse) => {
            // If a cached response exists, serve it.
            if (cachedResponse) {
              return cachedResponse;
            }
            // Fallback to a pre-cached offline page if needed and available
            // return caches.match('/offline.html');
            // For now, just let it fail if not in cache and network is down
            return undefined;
          });
        })
    );
  }
  // Handle static assets with Cache First, then Network
  // This is for assets that are part of the APP_SHELL_FILES or other static content.
  else if (APP_SHELL_FILES.some(file => url.pathname.endsWith(file)) || event.request.destination === 'style' || event.request.destination === 'script' || event.request.destination === 'image' || event.request.destination === 'font') {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.ok) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
  }
  // For other requests, try network first, then cache as a fallback (generic)
  else {
    event.respondWith(
      fetch(event.request)
        .catch(() => caches.match(event.request))
    );
  }
});
