// Attempt ES6 module style, assuming a modern build process for sw.js
import { precacheAndRoute, cleanupOutdatedCaches, getCacheKeyForURL } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

console.log('Service Worker (Workbox): Registered');

// --- IndexedDB for Offline Message Queue ---
const DB_NAME = 'bolt-offline-queue-db';
const STORE_NAME = 'queuedMessages';
const DB_VERSION = 1;

const openQueuedMessagesDB = () => {
  return new Promise((resolve, reject) => {
    const request = self.indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (event) => reject("Error opening IndexedDB for queued messages in SW: " + (event.target as any).error);
    request.onsuccess = (event) => resolve((event.target as any).result);
    request.onupgradeneeded = (event) => {
      const db = (event.target as any).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: 'id' });
      }
    };
  });
};

const getAllQueuedMessages = (db) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    request.onerror = (event) => reject("Error fetching queued messages: " + (event.target as any).error);
    request.onsuccess = (event) => resolve((event.target as any).result);
  });
};

const deleteQueuedMessage = (db, messageId) => {
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(messageId);
    request.onerror = (event) => reject("Error deleting queued message: " + (event.target as any).error);
    request.onsuccess = () => resolve(true);
    transaction.oncomplete = () => resolve(true); // Ensure transaction completion
    transaction.onabort = (event) => reject("Transaction aborted while deleting message: " + (event.target as any).error);
  });
};
// --- End IndexedDB ---


// --- Event Listeners ---
self.addEventListener('install', (event) => {
  console.log('Service Worker (Workbox): Installing...');
  self.skipWaiting(); // Force the waiting service worker to become the active service worker.
});

self.addEventListener('activate', (event) => {
  console.log('Service Worker (Workbox): Activating...');
  event.waitUntil(
    (async () => {
      cleanupOutdatedCaches();
      console.log('Service Worker (Workbox): Old Workbox caches cleaned up.');
      await self.clients.claim();
      console.log('Service Worker (Workbox): Claimed clients.');
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
const assetsToPrecache = self.__WB_MANIFEST || [
  { url: '/', revision: null },
  { url: '/offline.html', revision: null },
  { url: '/favicon.svg', revision: null },
  { url: '/logo.svg', revision: 'v1' },
  { url: '/manifest.json', revision: null }
];
console.log('Service Worker (Workbox): Assets to precache:', assetsToPrecache);
precacheAndRoute(assetsToPrecache);

// --- Runtime Caching Strategies ---
const offlineFallbackPage = '/offline.html';
registerRoute(
  ({ request }) => request.mode === 'navigate',
  async (args) => {
    try {
      const networkFirst = new NetworkFirst({
        cacheName: 'navigations',
        plugins: [ new CacheableResponsePlugin({ statuses: [0, 200] }) ]
      });
      return await networkFirst.handle(args);
    } catch (error) {
      console.warn('Service Worker (Workbox): Navigation failed, serving offline fallback.', error);
      try {
        const precacheCache = await self.caches.open(getCacheKeyForURL(offlineFallbackPage).split('?')[0].split('#')[0]);
        let offlinePageResponse = await precacheCache.match(offlineFallbackPage);
        if (offlinePageResponse) return offlinePageResponse;

        // Fallback if not found in specific precache (should not happen if precached correctly)
        return await caches.match(offlineFallbackPage) || new Response("Offline fallback page not found.", { status: 404 });
      } catch (cacheError) {
        console.error('Service Worker (Workbox): Error fetching offline page from cache.', cacheError);
        return new Response("Offline fallback unavailable.", { status: 500 });
      }
    }
  }
);

registerRoute(
  ({ request }) => request.destination === 'style' || request.destination === 'script' || request.destination === 'worker',
  new StaleWhileRevalidate({
    cacheName: 'static-resources',
    plugins: [
      new CacheableResponsePlugin({ statuses: [0, 200] }),
      new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 }), // 30 Days
    ],
  })
);

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

console.log('Service Worker (Workbox): Event listeners and routes configured.');

// --- Sync Event Handler ---
self.addEventListener('sync', (event) => {
  console.log('[Service Worker] Sync event received:', event.tag);
  if (event.tag === 'send-queued-chat-messages') {
    event.waitUntil(handleSyncEvent());
  }
});

async function handleSyncEvent() {
  console.log('[Service Worker] Handling sync event for queued chat messages...');
  let db;
  try {
    db = await openQueuedMessagesDB();
    const queuedMessages = await getAllQueuedMessages(db);

    if (!queuedMessages || queuedMessages.length === 0) {
      console.log('[Service Worker] No queued messages to send.');
      return;
    }

    console.log(`[Service Worker] Found ${queuedMessages.length} queued messages. Attempting to send...`);

    for (const queuedMessage of queuedMessages) {
      console.log('[Service Worker] Processing message:', queuedMessage.id, queuedMessage.content);
      try {
        // Construct the message content, handling potential array for images
        let messageContentForAPI = [];
        if (queuedMessage.content && typeof queuedMessage.content === 'string') {
            messageContentForAPI.push({ type: 'text', text: queuedMessage.content });
        }
        // Assuming imageDataList was stored directly if images were part of the message
        if (queuedMessage.uploadedFilesData && Array.isArray(queuedMessage.uploadedFilesData)) {
            queuedMessage.uploadedFilesData.forEach(imageData => {
                messageContentForAPI.push({ type: 'image', image: imageData });
            });
        }
        if (messageContentForAPI.length === 0) { // if only content was a simple string and no images
             messageContentForAPI.push({ type: 'text', text: queuedMessage.content || '' });
        }


        const requestBody = {
          messages: [{
            id: queuedMessage.id, // Use the temp client ID
            role: 'user',
            content: messageContentForAPI, // Use the constructed content
            // Ensure `content` here matches what your `useChat` hook expects for a user message
            // If it should be a simple string, and images handled differently, adjust here.
            // Based on Chat.client.tsx, `append` gets an object like:
            // { role: 'user', content: [ { type: 'text', text: '...' }, { type: 'image', image: '...' } ] }
          }],
          model: queuedMessage.model,
          provider: { name: queuedMessage.providerName }, // Assuming API expects this structure
          customPromptText: queuedMessage.customPromptText,
          isCustomPromptEnabled: queuedMessage.isCustomPromptEnabled,
          // TODO: Retrieve and include other necessary fields for /api/chat if required:
          // apiKeys, files (might be complex from IDB), promptId, contextOptimization,
          // chatMode, designScheme, supabase credentials
          // For now, this is a simplified body, with AI customization context added.
        };

        console.log('[Service Worker] Sending message to /api/chat:', JSON.stringify(requestBody));

        const response = await fetch('/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestBody),
        });

        if (response.ok) {
          console.log('[Service Worker] Message sent successfully:', queuedMessage.id);
          await deleteQueuedMessage(db, queuedMessage.id);
          console.log('[Service Worker] Message deleted from queue:', queuedMessage.id);
          // Optionally notify client of success for this specific message
          notifyClientOfMessageStatus(queuedMessage.id, 'sent');
        } else {
          console.error('[Service Worker] Failed to send message:', queuedMessage.id, 'Status:', response.status, response.statusText);
          // If it's a client error (4xx), likely don't retry indefinitely.
          if (response.status >= 400 && response.status < 500) {
            console.warn('[Service Worker] Client error for message, deleting from queue:', queuedMessage.id);
            await deleteQueuedMessage(db, queuedMessage.id);
            notifyClientOfMessageStatus(queuedMessage.id, 'failed', `Error: ${response.statusText}`);
          }
          // For server errors (5xx) or network issues, it will remain and be retried.
        }
      } catch (error) {
        console.error('[Service Worker] Error sending queued message:', queuedMessage.id, error);
        // Message remains in queue for next sync attempt
      }
    }
  } catch (error) {
    console.error('[Service Worker] Error during sync handling:', error);
  } finally {
    if (db) {
      db.close();
    }
  }
}

async function notifyClientOfMessageStatus(messageId, status, errorDetails = '') {
    const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    clients.forEach(client => {
        client.postMessage({
            type: 'QUEUED_MESSAGE_STATUS',
            payload: { id: messageId, status, error: errorDetails }
        });
    });
}

// --- Push Event Handler ---
self.addEventListener('push', (event) => {
  console.log('[Service Worker] Push Received.');

  let pushData = {
    title: 'Bolt App Notification',
    body: 'You have a new update or message!',
    icon: '/favicon.svg', // Default icon
    badge: '/favicon.svg', // Default badge
    url: '/' // Default URL to open on click
  };

  if (event.data) {
    try {
      const data = event.data.json(); // Assuming JSON payload
      pushData.title = data.title || pushData.title;
      pushData.body = data.body || pushData.body;
      pushData.icon = data.icon || pushData.icon;
      pushData.badge = data.badge || pushData.badge;
      // Ensure data.url is correctly passed for the notification's data field
      pushData.url = data.data && data.data.url ? data.data.url : pushData.url;
      console.log('[Service Worker] Push data parsed:', data);
    } catch (e) {
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
    data: {
        url: pushData.url // Pass the URL in the data payload for click handling
    },
    actions: [
      { action: 'explore', title: 'Explore Now' },
      { action: 'dismiss', title: 'Dismiss' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(pushData.title, notificationOptions)
      .then(() => console.log('[Service Worker] Notification shown.'))
      .catch(err => console.error('[Service Worker] Showing notification failed:', err))
  );
});

// --- Notification Click Handler ---
self.addEventListener('notificationclick', (event) => {
  console.log('[Service Worker] Notification click Received.', event.action, event.notification.data);
  event.notification.close(); // Close the notification

  event.waitUntil(
    (async () => {
      if (!self.clients) {
        console.error('[Service Worker] Clients API is not available.');
        return;
      }

      const urlToOpen = event.notification.data && event.notification.data.url ? event.notification.data.url : '/';

      if (event.action === 'explore' || !event.action ) { // Default click (no action) also explores
        console.log('[Service Worker] Performing explore/default action for URL:', urlToOpen);
        // Attempt to focus an existing window or open a new one.
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          if (client.url === urlToOpen && 'focus' in client) {
             try {
                await client.focus();
                console.log('[Service Worker] Focused existing client for URL:', urlToOpen);
                return;
             } catch (err) {
                console.error('[Service Worker] Failed to focus existing client:', err);
             }
          }
        }
        // If no existing client is focused or found, open a new window.
        console.log('[Service Worker] Opening new window for URL:', urlToOpen);
        const newClient = await self.clients.openWindow(urlToOpen);
        if (!newClient) {
            console.error('[Service Worker] Failed to open new window for URL:', urlToOpen);
        }
      } else if (event.action === 'dismiss') {
        console.log('[Service Worker] Performing dismiss action. Notification closed.');
        // Notification is already closed. No further action needed here.
      }
    })()
  );
});
