const CACHE_NAME = 'bolt-app-cache-v1';
const assetsToPrecache = [
  '/',
  '/offline.html',
  '/favicon.svg',
  '/logo.svg' // Assuming this exists and is a key UI asset
  // Note: Main CSS/JS are typically hashed, so runtime caching is more effective for them.
  // If there are unhashed, consistently named global assets (e.g., fonts, specific images), add them here.
];

console.log('Service Worker: Registered. Cache Name:', CACHE_NAME, 'Assets to precache:', assetsToPrecache);

self.addEventListener('install', (event) => {
  console.log('Service Worker: Installing...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Caching core assets...');
        return cache.addAll(assetsToPrecache);
      })
      .then(() => {
        console.log('Service Worker: Core assets cached successfully.');
      })
      .catch((error) => {
        console.error('Service Worker: Failed to cache core assets:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker: Activating...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Service Worker: Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Old caches cleaned up.');
      return self.clients.claim(); // Take control of uncontrolled clients
    }).then(() => {
      console.log('Service Worker: Claimed clients. Notifying about new version.');
      return self.clients.matchAll({ type: 'window' });
    }).then(clients => {
      clients.forEach(client => {
        client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
      });
    }).catch(error => {
      console.error('Service Worker: Cache cleanup or client notification failed:', error);
    })
  );
});

self.addEventListener('fetch', (event) => {
  // console.log('Service Worker: Fetching', event.request.url, 'Mode:', event.request.mode);

  // Handle navigation requests (HTML documents)
  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .catch(() => {
          console.log('Service Worker: Network fetch failed for navigation, serving offline page.');
          return caches.match('/offline.html');
        })
    );
    return; // Important to return here to not process further for navigate requests
  }

  // Handle other requests (static assets like CSS, JS, images) - Cache-first strategy
  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // console.log('Service Worker: Serving from cache:', event.request.url);
          return cachedResponse;
        }

        // console.log('Service Worker: Not in cache, fetching from network:', event.request.url);
        return fetch(event.request).then((networkResponse) => {
          // Check if we received a valid response
          if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
            // For 'basic' type, it means same-origin requests.
            // Non-basic types (e.g., 'cors', 'opaque') might not be cacheable or might behave unexpectedly.
            // console.log('Service Worker: Not caching non-basic or error response:', event.request.url, networkResponse && networkResponse.type);
            return networkResponse;
          }

          // Clone the response to put it in the cache and to be served
          const responseToCache = networkResponse.clone();

          caches.open(CACHE_NAME)
            .then((cache) => {
              // console.log('Service Worker: Caching new asset:', event.request.url);
              cache.put(event.request, responseToCache);
            })
            .catch(err => {
                console.error('Service Worker: Failed to cache asset:', event.request.url, err);
            });

          return networkResponse;
        }).catch(error => {
          console.error('Service Worker: Network fetch failed for asset:', event.request.url, error);
          // Optionally, you could return a generic placeholder for failed assets,
          // but for non-navigation requests, failing might be better than showing a wrong placeholder.
          // For images, a placeholder image could be returned: return caches.match('/placeholder-image.png');
          // For now, just let the browser handle the error (e.g. broken image icon).
          throw error; // Re-throw to indicate the fetch failed
        });
      })
  );
});
