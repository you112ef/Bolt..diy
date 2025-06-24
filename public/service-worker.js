const CACHE_NAME = 'bolt-ai-cache-v2'; // Increment cache version
const APP_SHELL_FILES = [
  '/', // الصفحة الرئيسية
  '/manifest.webmanifest',
  '/favicon.svg',
  '/assets/icons/icon.png', // أيقونة PWA الرئيسية
  '/offline.html' // صفحة الاحتياط عند عدم الاتصال
];
// لا نضع هنا ملفات CSS/JS المبنية ذات الهاشات، ستُخزن ديناميكيًا

self.addEventListener('install', (event) => {
  console.log('[Service Worker V2] Install');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker V2] Caching app shell essentials');
        return cache.addAll(APP_SHELL_FILES);
      })
      .catch(error => {
        console.error('[Service Worker V2] App shell caching failed during install:', error);
      })
  );
});

self.addEventListener('activate', (event) => {
  console.log('[Service Worker V2] Activate');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName.startsWith('bolt-ai-cache-')) { // Delete old bolt-ai caches
            console.log('[Service Worker V2] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim()) // Ensure new SW takes control immediately
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;

  // تجاهل الطلبات التي ليست GET أو طلبات لملحقات المتصفح
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension://')) {
    return;
  }

  // طلبات API: Network only (أو Network first إذا كان هناك منطق لتخزين بعضها)
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request)
        .catch(() => {
          return new Response(JSON.stringify({ error: 'API request failed and you are offline.' }), {
            headers: { 'Content-Type': 'application/json' },
            status: 503 // Service Unavailable
          });
        })
    );
    return;
  }

  // استراتيجية Stale-While-Revalidate للملفات المبنية (CSS, JS, fonts, images)
  if (request.destination === 'script' ||
      request.destination === 'style' ||
      request.destination === 'font' ||
      request.destination === 'image') {
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          const fetchPromise = fetch(request).then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              cache.put(request, networkResponse.clone());
            }
            return networkResponse;
          }).catch(error => {
            // console.warn('[Service Worker V2] Network request failed for asset:', request.url, error);
            if (!cachedResponse) { // Only throw if not in cache, otherwise stale-while-revalidate serves cache
                // console.error('[Service Worker V2] Asset not in cache and network failed:', request.url);
            }
            // If not in cache and network fails, the browser will handle the error (e.g. broken image)
            // We don't want to return offline.html for a missing image/script if the page itself is cached
            return new Response('', {status: 404, statusText: 'Not Found'});
          });
          return cachedResponse || fetchPromise;
        });
      })
    );
    return;
  }

  // استراتيجية Cache falling back to network (with offline page) لطلبات التنقل (HTML)
  if (request.mode === 'navigate') {
    event.respondWith(
      caches.open(CACHE_NAME).then(cache => {
        return cache.match(request)
          .then((response) => {
            const fetchAndCache = fetch(request)
              .then(networkResponse => {
                  if (networkResponse && networkResponse.status === 200) {
                      const responseToCache = networkResponse.clone();
                      cache.put(request, responseToCache);
                  }
                  return networkResponse;
              });
            return response || fetchAndCache.catch(() => cache.match('/offline.html'));
          }).catch(() => { // This catch is for cache.match errors
             return fetch(request).catch(() => caches.match('/offline.html'));
          })
      })
    );
    return;
  }

  // استراتيجية Cache-First للملفات الأساسية المحددة (App Shell)
  // إذا كان الطلب لملف من APP_SHELL_FILES
  if (APP_SHELL_FILES.some(fileUrl => request.url.endsWith(fileUrl))) {
    event.respondWith(
      caches.match(request).then(response => {
        return response || fetch(request).then(networkResponse => {
          if (networkResponse && networkResponse.status === 200) {
            const clonedResponse = networkResponse.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, clonedResponse));
          }
          return networkResponse;
        }).catch(() => {
            // For app shell files, if not in cache and network fails, try offline page
            if (request.destination === 'document') {
                return caches.match('/offline.html');
            }
        });
      })
    );
    return;
  }

  // Default: try cache, then network for any other GET requests not handled above
  event.respondWith(
    caches.match(request).then(response => {
      return response || fetch(request);
    })
  );
});

// Listen for messages from clients (e.g., the main app)
self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SHOW_NOTIFICATION') {
    const { title, options } = event.data.payload;
    event.waitUntil(
      self.registration.showNotification(title, {
        body: options.body || 'Bolt AI Notification',
        icon: options.icon || '/assets/icons/icon.png', // Default icon
        badge: options.badge || '/assets/icons/icon.png', // Icon for notification bar (Android)
        vibrate: options.vibrate || [200, 100, 200], // Default vibration pattern
        sound: options.sound || undefined, // Path to sound file or rely on system default
        tag: options.tag || 'bolt-notification', // Tag to group or replace notifications
        renotify: options.renotify || false, // Whether to renotify if tag is the same
        requireInteraction: options.requireInteraction || false, // Keep notification until user interacts
        actions: options.actions || [], // Example: [{ action: 'explore', title: 'Explore' }]
        // data: options.data || {} // Custom data to pass along
      })
    );
  }
});
