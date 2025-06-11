// Import Workbox
importScripts('https://storage.googleapis.com/workbox-cdn/releases/7.1.0/workbox-sw.js');

// Define constants
const OFFLINE_URL = '/offline.html'; // Ensure this is precached by Workbox
const API_DYNAMIC_CACHE_NAME = 'api-dynamic-cache-v1'; // New cache for API GET requests
const OFFLINE_REQUESTS_DB_NAME = 'boltHistory';
const OFFLINE_REQUESTS_STORE_NAME = 'offlineRequests';
const SYNC_TAG = 'retry-queued-requests';

// --- IndexedDB Helper Functions for Background Sync ( 그대로 유지 ) ---
function openOfflineDb() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(OFFLINE_REQUESTS_DB_NAME, 3); // Assumes version 3
        request.onerror = (event) => reject('Error opening DB in SW: ' + event.target.errorCode);
        request.onsuccess = (event) => resolve(event.target.result);
    });
}

async function addRequestToQueue(requestData) {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(OFFLINE_REQUESTS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(OFFLINE_REQUESTS_STORE_NAME);
            const storeRequest = store.add(requestData);
            storeRequest.onsuccess = () => resolve(storeRequest.result);
            storeRequest.onerror = (event) => reject('Failed to add request to queue: ' + event.target.error);
            transaction.oncomplete = () => db.close();
            transaction.onerror = (event) => reject('Transaction error in addRequestToQueue: ' + event.target.error);
        } catch (error) {
            reject('Error in addRequestToQueue: ' + error);
            if (db) db.close();
        }
    });
}

async function getRequestsFromQueue() {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(OFFLINE_REQUESTS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(OFFLINE_REQUESTS_STORE_NAME);
            const getAllRequest = store.getAll();
            getAllRequest.onsuccess = () => resolve(getAllRequest.result);
            getAllRequest.onerror = (event) => reject('Failed to get requests from queue: ' + event.target.error);
            transaction.oncomplete = () => db.close();
            transaction.onerror = (event) => reject('Transaction error in getRequestsFromQueue: ' + event.target.error);
        } catch (error) {
            reject('Error in getRequestsFromQueue: ' + error);
            if (db) db.close();
        }
    });
}

async function removeRequestFromQueue(id) {
    const db = await openOfflineDb();
    return new Promise((resolve, reject) => {
        try {
            const transaction = db.transaction(OFFLINE_REQUESTS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(OFFLINE_REQUESTS_STORE_NAME);
            const deleteRequest = store.delete(id);
            deleteRequest.onsuccess = () => resolve();
            deleteRequest.onerror = (event) => reject('Failed to delete request from queue: ' + event.target.error);
            transaction.oncomplete = () => db.close();
            transaction.onerror = (event) => reject('Transaction error in removeRequestFromQueue: ' + event.target.error);
        } catch (error) {
            reject('Error in removeRequestFromQueue: ' + error);
            if (db) db.close();
        }
    });
}
// --- End IndexedDB Helper Functions ---

if (typeof workbox !== 'undefined') {
    console.log('[Service Worker] Workbox loaded');
    workbox.setConfig({ debug: false });

    workbox.precaching.precacheAndRoute(self.__WB_MANIFEST || []);
    workbox.precaching.cleanupOutdatedCaches();

    // --- fetchWithRetry Helper Function ---
    async function fetchWithRetry(request, retries = 2, initialDelay = 500) {
        let attempt = 0;
        let delay = initialDelay;
        while (attempt <= retries) {
            try {
                console.log(`[Service Worker] Attempting fetch for ${request.url}, attempt ${attempt + 1}`);
                const response = await fetch(request.clone());
                if (response.ok) {
                    console.log(`[Service Worker] Fetch successful for ${request.url}`);
                    return response;
                }
                // If it's a 4xx client error, don't retry, return the error response
                if (response.status >= 400 && response.status < 500) {
                    console.warn(`[Service Worker] Client error for ${request.url} (status: ${response.status}), not retrying.`);
                    return response;
                }
                // For 5xx server errors, retry
                console.warn(`[Service Worker] Server error for ${request.url} (status: ${response.status}), retrying...`);
                // If this was the last attempt and it's a 5xx, return the response
                if (attempt === retries) {
                    return response;
                }
            } catch (error) {
                console.warn(`[Service Worker] Network error for ${request.url}, retrying...`, error);
                // If this was the last attempt and it's a network error, re-throw
                if (attempt === retries) {
                    throw error;
                }
            }
            attempt++;
            if (attempt <= retries) {
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
            }
        }
    }
    // --- End fetchWithRetry Helper Function ---

    // Routing Strategies
    workbox.routing.registerRoute(
        ({ request }) => request.mode === 'navigate',
        new workbox.strategies.NetworkFirst({
            cacheName: 'navigation-cache',
            plugins: [
                new workbox.expiration.ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }),
                {
                    handlerDidError: async () => {
                        const cache = await caches.open(workbox.precaching.getCacheKeyForPrecaching());
                        const offlinePageResponse = await cache.match(OFFLINE_URL);
                        return offlinePageResponse || Response.error();
                    }
                }
            ],
        })
    );

    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'style',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'style-cache',
            plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 })],
        })
    );

    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'script' || request.destination === 'worker',
        new workbox.strategies.StaleWhileRevalidate({
            cacheName: 'script-worker-cache',
            plugins: [new workbox.expiration.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 30 * 24 * 60 * 60 })],
        })
    );

    workbox.routing.registerRoute(
        ({ request }) => request.destination === 'image',
        new workbox.strategies.CacheFirst({
            cacheName: 'image-cache',
            plugins: [
                new workbox.expiration.ExpirationPlugin({ maxEntries: 60, maxAgeSeconds: 30 * 24 * 60 * 60 }),
                new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
            ],
        })
    );

     workbox.routing.registerRoute(
        ({ request }) => request.destination === 'font',
        new workbox.strategies.CacheFirst({
            cacheName: 'font-cache',
            plugins: [
                new workbox.expiration.ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 180 * 24 * 60 * 60 }),
                new workbox.cacheableResponse.CacheableResponsePlugin({ statuses: [0, 200] }),
            ],
        })
    );

    // New route for API GET requests with retry and cache-aside for errors
    workbox.routing.registerRoute(
        ({ url, request }) => url.pathname.startsWith('/api/') && request.method === 'GET',
        async ({ request }) => {
            try {
                const networkResponse = await fetchWithRetry(request.clone());

                if (networkResponse && networkResponse.ok) {
                    const cache = await caches.open(API_DYNAMIC_CACHE_NAME);
                    cache.put(request.clone(), networkResponse.clone());
                    return networkResponse;
                }

                // Handle non-ok responses (4xx, 5xx after retries)
                console.warn(`[Service Worker] API GET request to ${request.url} failed or returned non-OK status after retries: ${networkResponse ? networkResponse.status : 'Unknown error'}`);
                const cachedResponse = await caches.match(request.clone(), { cacheName: API_DYNAMIC_CACHE_NAME });
                if (cachedResponse) {
                    console.log(`[Service Worker] Serving stale response from ${API_DYNAMIC_CACHE_NAME} for ${request.url}`);
                    return cachedResponse;
                }
                // If no cache and networkResponse exists (even if not .ok), return it
                if (networkResponse) {
                    return networkResponse;
                }
                // Should not be reached if fetchWithRetry behaves as expected (throws on complete failure or returns response)
                throw new Error('Network request failed and no response object available.');

            } catch (error) { // Catch errors from fetchWithRetry (complete network failure)
                console.error(`[Service Worker] API GET request to ${request.url} completely failed after retries:`, error);
                const cachedResponse = await caches.match(request.clone(), { cacheName: API_DYNAMIC_CACHE_NAME });
                if (cachedResponse) {
                    console.log(`[Service Worker] Serving stale response from ${API_DYNAMIC_CACHE_NAME} for ${request.url} after complete failure.`);
                    return cachedResponse;
                }
                return new Response(JSON.stringify({ error: 'API request failed and no cached version available.' }), {
                    status: 503,
                    headers: { 'Content-Type': 'application/json' }
                });
            }
        }
    );

} else {
    console.error('[Service Worker] Workbox failed to load');
}

self.addEventListener('install', (event) => {
    console.log('[Service Worker] Install event');
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    console.log('[Service Worker] Activate event');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            const validCacheNames = new Set([
                workbox.core.cacheNames.precache,
                workbox.core.cacheNames.runtime,
                'navigation-cache',
                'style-cache',
                'script-worker-cache',
                'image-cache',
                'font-cache',
                API_DYNAMIC_CACHE_NAME // Add the new API cache here
            ]);
            // For Workbox v6+, runtime cache names are not directly exposed via workbox.core.cacheNames.runtime
            // We manually list known runtime cache names and the new API_DYNAMIC_CACHE_NAME
            // Or, more generically, preserve all caches starting with 'workbox-'
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (!cacheName.startsWith('workbox-') && !validCacheNames.has(cacheName)) {
                         console.log('[Service Worker] Deleting old/unknown custom cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    if (request.method !== 'GET' && !url.protocol.startsWith('chrome-extension')) {
        event.respondWith(
            fetch(request.clone())
                .catch(async (error) => {
                    console.log('[Service Worker] Non-GET request failed, queuing for background sync:', request.url, error);
                    try {
                        const serializedHeaders = {};
                        request.headers.forEach((value, key) => { serializedHeaders[key] = value; });

                        let body = null;
                        const contentLength = request.headers.get('Content-Length');
                        const transferEncoding = request.headers.get('Transfer-Encoding');
                        if ((contentLength && parseInt(contentLength, 10) > 0) || (transferEncoding && transferEncoding.includes('chunked'))) {
                            try {
                                const clonedRequest = request.clone();
                                if (clonedRequest.headers.get('Content-Type')?.includes('application/json')) {
                                    body = await clonedRequest.json();
                                } else if (clonedRequest.headers.get('Content-Type')?.includes('text/')) {
                                    body = await clonedRequest.text();
                                } else {
                                    body = await clonedRequest.blob();
                                    console.warn('[Service Worker] Body type not JSON/text, stored as Blob for offline queue:', clonedRequest.headers.get('Content-Type'));
                                }
                            } catch (bodyError) {
                                console.error('[Service Worker] Error reading request body for offline queue:', bodyError);
                            }
                        }

                        const requestData = {
                            url: request.url,
                            method: request.method,
                            headers: serializedHeaders,
                            body: body,
                            timestamp: Date.now()
                        };
                        await addRequestToQueue(requestData);
                        if (self.registration.sync) {
                           await self.registration.sync.register(SYNC_TAG);
                        } else {
                           console.warn('[Service Worker] Background Sync not supported.');
                        }

                        return new Response(JSON.stringify({ error: 'Request queued due to network failure.' }), {
                            status: 503,
                            headers: { 'Content-Type': 'application/json' }
                        });
                    } catch (queueError) {
                        console.error('[Service Worker] Error adding request to offline queue:', queueError);
                        throw error;
                    }
                })
        );
    }
});

self.addEventListener('sync', (event) => {
    if (event.tag === SYNC_TAG) {
        console.log('[Service Worker] Sync event triggered for', SYNC_TAG);
        event.waitUntil(processRequestQueue());
    }
});

async function processRequestQueue() {
    console.log('[Service Worker] Processing offline request queue...');
    let requestsProcessed = 0;
    const db = await openOfflineDb();
    try {
        const transaction = db.transaction(OFFLINE_REQUESTS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(OFFLINE_REQUESTS_STORE_NAME);
        const queuedRequests = await new Promise((resolve, reject) => {
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        if (!queuedRequests || queuedRequests.length === 0) {
            console.log('[Service Worker] Offline request queue is empty.');
            db.close();
            return;
        }

        console.log(`[Service Worker] Found ${queuedRequests.length} requests in the queue.`);
        for (const reqData of queuedRequests) {
            try {
                console.log('[Service Worker] Attempting to replay request:', reqData.id, reqData.url);
                let bodyToSend = reqData.body;
                if (reqData.body && !(reqData.body instanceof Blob) && typeof reqData.body === 'object') {
                    bodyToSend = JSON.stringify(reqData.body);
                }

                const response = await fetch(reqData.url, {
                    method: reqData.method,
                    headers: reqData.headers,
                    body: bodyToSend
                });

                if (response.ok) {
                    console.log('[Service Worker] Successfully replayed request:', reqData.id, reqData.url, response.status);
                    await new Promise((resolve, reject) => {
                        const delReq = store.delete(reqData.id);
                        delReq.onsuccess = () => resolve();
                        delReq.onerror = () => reject(delReq.error);
                    });
                    requestsProcessed++;
                } else {
                    console.error('[Service Worker] Failed to replay request:', reqData.id, reqData.url, response.status, await response.text());
                    if (response.status === 400 || response.status === 401 || response.status === 403 || response.status === 404) {
                        console.warn('[Service Worker] Removing unrecoverable request from queue:', reqData.id, response.status);
                        await new Promise((resolve, reject) => {
                           const delReq = store.delete(reqData.id);
                           delReq.onsuccess = () => resolve();
                           delReq.onerror = () => reject(delReq.error);
                        });
                    }
                }
            } catch (error) {
                console.error('[Service Worker] Error replaying request from queue:', reqData.id, reqData.url, error);
            }
        }
        console.log(`[Service Worker] Finished processing queue. ${requestsProcessed} of ${queuedRequests.length} requests replayed successfully.`);
    } catch (error) {
        console.error('[Service Worker] Error processing request queue:', error);
    } finally {
        if (db) db.close();
    }
}

// Push Notification Event Listener
self.addEventListener('push', event => {
    console.log('[Service Worker] Push Received.');
    console.log(`[Service Worker] Push had this data: "${event.data ? event.data.text() : 'no payload'}"`);

    let notificationTitle = 'Jules AI Web App';
    let notificationOptions = {
        body: 'You have a new notification.',
        icon: '/icons/app_icon_192.png', // Ensure this path is correct from public root
        badge: '/icons/app_icon_192.png', // Badge is often a monochrome version
        // Example actions (require more handling in 'notificationclick'):
        // actions: [
        //   { action: 'explore', title: 'Explore now' },
        //   { action: 'close', title: 'Close' }
        // ],
        // data: { url: '/' } // Custom data to pass to notificationclick
    };

    if (event.data) {
        try {
            const data = event.data.json(); // Assuming server sends JSON payload
            notificationTitle = data.title || notificationTitle;
            notificationOptions.body = data.body || notificationOptions.body;
            if (data.icon) notificationOptions.icon = data.icon;
            if (data.badge) notificationOptions.badge = data.badge;
            // if (data.actions) notificationOptions.actions = data.actions;
            // if (data.data) notificationOptions.data = data.data;
        } catch (e) {
            // If payload is not JSON, use text
            notificationOptions.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(notificationTitle, notificationOptions)
    );
});

// Optional: Add a 'notificationclick' listener to handle clicks on notifications
self.addEventListener('notificationclick', event => {
    console.log('[Service Worker] Notification click Received.');
    event.notification.close(); // Close the notification

    // Example: Open the app or a specific URL
    // const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';
    event.waitUntil(
        clients.matchAll({ type: 'window' }).then(clientList => {
            for (const client of clientList) {
                if (client.url === '/' && 'focus' in client) { // Focus existing window if open
                    return client.focus();
                }
            }
            if (clients.openWindow) { // Open new window
                return clients.openWindow('/');
            }
        })
    );
});
// Ensure a newline at the end of the file
