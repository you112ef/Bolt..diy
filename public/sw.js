// Attempt ES6 module style, assuming a modern build process for sw.js
import { precacheAndRoute, cleanupOutdatedCaches, getCacheKeyForURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

console.log('Service Worker (Workbox): Registered');

// --- Event Listeners ---
self.addEventListener('install', (event) => {
  console.log('Service Worker (Workbox): Installing...');
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker (Workbox): Activating...');
  event.waitUntil(
    (async () => {
      // Calling cleanupOutdatedCaches will remove any old Workbox caches that are no longer used.
      cleanupOutdatedCaches();
      console.log('Service Worker (Workbox): Old Workbox caches cleaned up.');

      // Take control of uncontrolled clients
      await self.clients.claim();
      console.log('Service Worker (Workbox): Claimed clients.');

      // Notify clients about the new version.
      const clients = await self.clients.matchAll({ type: 'window' });
      clients.forEach(client => {
        client.postMessage({ type: 'NEW_VERSION_AVAILABLE' });
      });
      console.log('Service Worker (Workbox): Notified clients about new version.');
    })().catch(error => {
      console.error('Service Worker (Workbox): Activation phase failed:', error);
    })
  );
});

// --- Precaching ---
// self.__WB_MANIFEST is injected by Workbox build tools.
// Using a manual list as a fallback for this exercise.
const assetsToPrecache = self.__WB_MANIFEST || [
  { url: '/', revision: null },
  { url: '/offline.html', revision: null },
  { url: '/favicon.svg', revision: null },
  { url: '/logo.svg', revision: 'v1' }, // Assuming v1, or null if unversioned
  { url: '/manifest.json', revision: null }
];
console.log('Service Worker (Workbox): Assets to precache:', assetsToPrecache);
precacheAndRoute(assetsToPrecache);


// --- Runtime Caching Strategies ---

// Navigation Route (Offline Fallback)
const offlineFallbackPage = '/offline.html';
// Ensure offline.html is also precached so getCacheKeyForURL works as expected.
// It is already in assetsToPrecache.

registerRoute(
  ({ request }) => request.mode === 'navigate',
  async (args) => {
    try {
      // Use NetworkFirst for navigation requests
      const networkFirst = new NetworkFirst({
        cacheName: 'navigations',
        plugins: [
          new CacheableResponsePlugin({ statuses: [0, 200] }) // Cache opaque responses for navigations if needed, or just 200
        ]
      });
      const networkResponse = await networkFirst.handle(args);
      return networkResponse;
    } catch (error) {
      console.warn('Service Worker (Workbox): Navigation failed, serving offline fallback.', error);
      // Try to get the offline page from the precache.
      // Ensure the offline page URL exactly matches what's in the precache manifest.
      const cache = await self.caches.open(getCacheKeyForURL(offlineFallbackPage).split('?')[0].split('#')[0]); // getCacheKeyForURL might include revision, split it
      let offlinePageResponse = await cache.match(offlineFallbackPage);

      if (!offlinePageResponse) {
        // Fallback if somehow not in the specific precache (e.g. different revision or name)
        // This is a safeguard; it should ideally be found via getCacheKeyForURL.
        offlinePageResponse = await caches.match(offlineFallbackPage);
      }
      return offlinePageResponse || new Response("Offline fallback page not found in cache.", { status: 404 });
    }
  }
);

// Static Assets (CSS, JS - StaleWhileRevalidate)
registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }), // Cache opaque responses if from CDN
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
    ],
  })
);

// Images (CacheFirst or StaleWhileRevalidate - CacheFirst is often good for images that don't change often)
registerRoute(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
    ],
  })
);

// Fonts (CacheFirst)
registerRoute(
  ({ request }) => request.destination === 'font',
  new CacheFirst({
    cacheName: 'fonts',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 24 * 60 * 60 }), // 60 Days
    ],
  })
);

// Example: Caching API calls with a StaleWhileRevalidate strategy (if applicable)
// registerRoute(
//   ({url}) => url.pathname.startsWith('/api/'),
//   new StaleWhileRevalidate({
//     cacheName: 'api-cache',
//     plugins: [
//       new CacheableResponsePlugin({statuses: [0, 200]}),
//       new ExpirationPlugin({maxEntries: 50, maxAgeSeconds: 5 * 60}), // Cache for 5 minutes
//     ]
//   })
// );

console.log('Service Worker (Workbox): Event listeners and routes configured.');

// --- Push Event Handler ---
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');

  let pushData = {
    title: 'Bolt App Notification',
    body: 'You have a new update or message!',
    icon: '/favicon.svg', // Default icon
    badge: '/favicon.svg', // Default badge
    data: { url: '/' } // Default URL to open on click
  };

  if (event.data) {
    try {
      const data = event.data.json(); // Assuming JSON payload
      pushData.title = data.title || pushData.title;
      pushData.body = data.body || pushData.body;
      pushData.icon = data.icon || pushData.icon;
      pushData.badge = data.badge || pushData.badge;
      pushData.data = data.data || pushData.data; // e.g., { url: '/some-path' }
      console.log('[Service Worker] Push data parsed:', data);
    } catch (e) {
      // If data is not JSON, try to parse as text.
      // This is useful if the push service sends a simple string.
      try {
        const textData = event.data.text();
        if (textData) {
          pushData.body = textData;
          console.log('[Service Worker] Push data parsed as text:', textData);
        }
      } catch (textErr) {
        console.error('[Service Worker] Push event data parsing error (JSON and text):', e, textErr);
      }
    }
  } else {
    console.log('[Service Worker] Push event contained no data.');
  }

  const notificationOptions = {
    body: pushData.body,
    icon: pushData.icon,
    badge: pushData.badge,
    data: pushData.data, // Store data to be used when notification is clicked
    // common actions:
    // actions: [
    //   { action: 'explore', title: 'Explore now' },
    //   { action: 'close', title: 'Close' }
    // ]
  };

  event.waitUntil(
    self.registration.showNotification(pushData.title, notificationOptions)
      .then(() => console.log('[Service Worker] Notification shown.'))
      .catch(err => console.error('[Service Worker] Showing notification failed:', err))
  );
});


// Remove old vanilla SW fetch listener if it was separate
// self.removeEventListener('fetch', oldFetchHandler); // Assuming oldFetchHandler was the name
// For this task, overwriting the file effectively removes the old logic.
