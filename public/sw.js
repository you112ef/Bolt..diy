const CACHE_NAME = 'jules-ai-cache-v1';
const OFFLINE_URL = '/offline.html';

// List of URLs to cache during the install phase
// This list will need to be expanded with actual JS/CSS bundles later.
// For now, it includes the essentials and previously copied icons.
const STATIC_ASSETS_TO_PRECACHE = [
    '/', // The main HTML shell
    OFFLINE_URL,
    '/favicon.svg',
    '/icons/app_icon_192.png',
    '/icons/app_icon_512.png',
    // Placeholder for main CSS bundle - will need to identify actual file name
    // e.g., '/assets/index-XXXXXX.css'
    // Placeholder for main JS bundle - will need to identify actual file name
    // e.g., '/assets/entry.client-XXXXXX.js'
    // Add other critical static assets if known (e.g., logo, key UI images)
];

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install event');
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => {
                console.log('[Service Worker] Precaching static assets');
                return cache.addAll(STATIC_ASSETS_TO_PRECACHE);
            })
            .then(() => {
                console.log('[Service Worker] Static assets precached successfully');
            })
            .catch((error) => {
                console.error('[Service Worker] Precaching failed:', error);
            })
    );
    self.skipWaiting(); // Activate the new service worker immediately
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate event');
    // Remove old caches
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
    return self.clients.claim(); // Take control of all open clients
});

self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // Serve static assets from cache first
    if (STATIC_ASSETS_TO_PRECACHE.includes(url.pathname) || url.origin === self.location.origin && (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/css/') || url.pathname.startsWith('/js/'))) {
        event.respondWith(
            caches.match(event.request)
                .then((cachedResponse) => {
                    if (cachedResponse) {
                        return cachedResponse;
                    }
                    // If not in cache, fetch from network, cache it, then return
                    return fetch(event.request).then((networkResponse) => {
                        // Check if we received a valid response
                        if(!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                            return networkResponse;
                        }
                        const responseToCache = networkResponse.clone();
                        caches.open(CACHE_NAME)
                            .then((cache) => {
                                cache.put(event.request, responseToCache);
                            });
                        return networkResponse;
                    }).catch(() => {
                        // If network fetch also fails (e.g. offline for a new asset not in precache)
                        // This part might be refined depending on specific asset types.
                        // For now, just return the error.
                        if (event.request.mode === 'navigate') {
                             return caches.match(OFFLINE_URL);
                        }
                        // For non-navigation requests, let the browser handle the error.
                        return new Response('', { status: 503, statusText: 'Service Unavailable' });
                    });
                })
        );
    }
    // Network-first for API calls and other dynamic content
    else if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((networkResponse) => {
                    // Check if we received a valid response
                    if(!networkResponse || networkResponse.status !== 200) {
                         // If network fails, and it's a navigation, try offline page.
                        if (event.request.mode === 'navigate') {
                           return caches.match(OFFLINE_URL);
                        }
                        return networkResponse; // Return error response as is
                    }
                    // Optional: Cache successful API responses if appropriate for your app
                    // For now, just returning network response without caching for API calls
                    return networkResponse;
                })
                .catch(() => {
                    // Network request failed, serve offline page for navigation requests
                    if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    }
                    // For non-navigation API calls, return a generic error
                    return new Response(JSON.stringify({ error: 'offline' }), {
                        headers: { 'Content-Type': 'application/json' },
                        status: 503,
                        statusText: 'Service Unavailable (Offline)'
                    });
                })
        );
    }
    // For all other requests, try network first, then cache, then offline for navigations
    else {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                try {
                    const networkResponse = await fetch(event.request);
                    // Check if we received a valid response
                    if (networkResponse && networkResponse.status === 200 && event.request.method === 'GET') {
                        // Cache the successful response for GET requests
                        cache.put(event.request, networkResponse.clone());
                    }
                    return networkResponse;
                } catch (error) {
                    // Network request failed
                    const cachedResponse = await cache.match(event.request);
                    if (cachedResponse) {
                        return cachedResponse;
                    } else if (event.request.mode === 'navigate') {
                        return caches.match(OFFLINE_URL);
                    } else {
                        // For non-navigation requests, let the browser handle the error.
                        return new Response('', { status: 503, statusText: 'Service Unavailable' });
                    }
                }
            })
        );
    }
});
