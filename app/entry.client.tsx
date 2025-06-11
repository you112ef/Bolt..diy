import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';

import { initializeAllSettingsFromDB } from '~/lib/stores/settings'; // Added
import { loadThemeFromDBAndMigrate } from '~/lib/stores/theme'; // Added

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);

  if ('serviceWorker' in navigator && process.env.NODE_ENV === 'production') {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js')
        .then((registration) => {
          console.log('Service Worker registered with scope:', registration.scope);
        })
        .catch((error) => {
          console.error('Service Worker registration failed:', error);
        });
    });
  }

  // Initialize settings and theme from IndexedDB
  if (typeof window !== 'undefined') { // Ensure this runs only in the browser
    initializeAllSettingsFromDB()
      .then(() => {
        console.log('All application settings loaded from IndexedDB.');
        // After settings are loaded, load and migrate theme
        return loadThemeFromDBAndMigrate();
      })
      .then(() => {
        console.log('Theme loaded and migrated from IndexedDB.');
      })
      .catch(error => {
        console.error('Error initializing settings/theme from IndexedDB:', error);
      });
  }
});
