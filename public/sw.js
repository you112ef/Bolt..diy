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

// At the end of public/sw.js

self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      console.warn('[Service Worker] Push event data is not JSON, treating as text.');
      data = { title: 'Push Notification', body: event.data.text() };
    }
  } else {
    data = { title: 'Push Notification', body: 'You received a new message.' };
  }

  const title = data.title || 'Bolt AI Notification';
  const options = {
    body: data.body || 'You have a new update.',
    icon: '/icons/android-launcher-192x192.png', // Ensure this icon exists
    badge: '/icons/android-launcher-192x192.png', // Ensure this icon exists (for notification bar)
    // tag: 'bolt-notification-tag', // Optional: use a tag to group or replace notifications
    // actions: [ // Optional: add actions to the notification
    //   { action: 'explore', title: 'Explore', icon: '/icons/explore.png' },
    //   { action: 'close', title: 'Close', icon: '/icons/close.png' },
    // ]
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Optional: Handle notification click
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.', event.notification.tag);
  event.notification.close(); // Close the notification

  // Example: Focus or open a window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // If a window for this PWA is already open, focus it.
      for (const client of clientList) {
        // You might need a more specific URL or way to identify the correct client
        if (client.url === '/' && 'focus' in client) { // Check if root is open
          return client.focus();
        }
      }
      // If no window is open, open a new one.
      if (clients.openWindow) {
        return clients.openWindow('/'); // Open the root of the app
      }
    })
  );

  // Example: Handle notification actions
  // if (event.action === 'explore') {
  //   console.log('Explore action clicked');
  //   clients.openWindow('/explore-page'); // Open a specific page
  // } else if (event.action === 'close') {
  //   console.log('Close action clicked');
  // }
});
