import './i18n'; // Initialize i18next
import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);

  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch(error => {
          console.error('Service Worker registration failed:', error);
        });
    });

    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data && event.data.type === 'NEW_VERSION_AVAILABLE') {
        console.log('New version available! Please refresh.');
        if (confirm('A new version of the app is available. Refresh to update?')) {
          window.location.reload();
        }
      }
    });
  }
});
