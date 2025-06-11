const CACHE_NAME = 'bolt-ai-cache-v1'; // Consider versioning this for updates
const urlsToCache = [
  '/',
  '/favicon.svg',
  // Add other important static assets here
  // Note: these paths should be relative to the public folder after build
];

// Install: Cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service Worker: Opened cache');
        return cache.addAll(urlsToCache);
      })
      .then(() => {
        console.log('Service Worker: Core assets cached');
        return self.skipWaiting(); // Force activation of new service worker
      })
  );
});

// Activate: Clean up old caches and take control
self.addEventListener('activate', (event) => {
  const cacheWhitelist = [CACHE_NAME]; // Add new cache names here
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            console.log('Service Worker: Deleting old cache', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('Service Worker: Activated and old caches cleaned');
      return self.clients.claim(); // Take control of all open clients
    })
  );
});

// Fetch: Serve from cache, fallback to network
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests and specific paths like API calls
  if (event.request.method !== 'GET' || event.request.url.includes('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((response) => {
        if (response) {
          // Serve from cache
          // console.log('Service Worker: Serving from cache', event.request.url);
          return response;
        }
        // Not in cache, fetch from network
        // console.log('Service Worker: Fetching from network', event.request.url);
        return fetch(event.request).then((networkResponse) => {
          // Optionally, cache new requests dynamically (be careful with this)
          // if (networkResponse && networkResponse.status === 200) {
          //   const responseToCache = networkResponse.clone();
          //   caches.open(CACHE_NAME).then((cache) => {
          //     cache.put(event.request, responseToCache);
          //   });
          // }
          return networkResponse;
        }).catch((error) => {
          console.error('Service Worker: Fetch failed, serving offline fallback (if any)', error);
          // Optionally, return a generic offline page here
          // return caches.match('/offline.html');
        });
      }
    )
  );
});

// Message: Handle messages from clients (e.g., for update checks)
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
  if (event.data && event.data.type === 'GET_VERSION') {
    event.ports[0].postMessage({ version: CACHE_NAME }); // Example versioning
  }
});

// Background Sync (Optional - Example)
// self.addEventListener('sync', (event) => {
//   if (event.tag === 'myFirstSync') {
//     event.waitUntil(doSomeStuff());
//   }
// });
// async function doSomeStuff() {
//   const response = await fetch('/api/some-data');
//   const data = await response.json();
//   console.log('Background sync: got data', data);
//   // Here you might update IndexedDB or show a notification
// }
