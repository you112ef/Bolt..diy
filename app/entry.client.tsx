import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('[Service Worker] Registered:', registration);
      })
      .catch(error => {
        console.error('[Service Worker] Registration failed:', error);
      });
  });
}

function requestNotificationPermission() {
  if ('Notification' in window) {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        console.log('Notification permission granted.');
      } else {
        console.log('Notification permission denied.');
      }
    });
  }
}

// Request notification permission once the service worker is active,
// or at a more appropriate time in the user flow.
if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
  requestNotificationPermission();
} else if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(registration => {
    if (registration.active) {
      requestNotificationPermission();
    }
  });
}
