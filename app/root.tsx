import { useStore } from '@nanostores/react';
import type { LinksFunction } from '@remix-run/cloudflare';
import { Links, Meta, Outlet, Scripts, ScrollRestoration } from '@remix-run/react';
import tailwindReset from '@unocss/reset/tailwind-compat.css?url';
import { themeStore } from './lib/stores/theme';
import { stripIndents } from './utils/stripIndent';
import { createHead } from 'remix-island'; // Ensure this is imported
import { useEffect, useState } from 'react'; // Ensure useState is imported if not already
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ClientOnly } from 'remix-utils/client-only';

import reactToastifyStyles from 'react-toastify/dist/ReactToastify.css?url';
import globalStyles from './styles/index.scss?url';
import xtermStyles from '@xterm/xterm/css/xterm.css?url';

import 'virtual:uno.css';

export const links: LinksFunction = () => [
  {
    rel: 'icon',
    href: '/favicon.svg',
    type: 'image/svg+xml',
  },
  { rel: 'manifest', href: '/manifest.json' }, // Add this line
  { rel: 'stylesheet', href: reactToastifyStyles },
  { rel: 'stylesheet', href: tailwindReset },
  { rel: 'stylesheet', href: globalStyles },
  { rel: 'stylesheet', href: xtermStyles },
  {
    rel: 'preconnect',
    href: 'https://fonts.googleapis.com',
  },
  {
    rel: 'preconnect',
    href: 'https://fonts.gstatic.com',
    crossOrigin: 'anonymous',
  },
  {
    rel: 'stylesheet',
    href: 'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap',
  },
];

const inlineThemeCode = stripIndents`
  setTutorialKitTheme();

  function setTutorialKitTheme() {
    let theme = localStorage.getItem('bolt_theme');

    if (!theme) {
      theme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }

    document.querySelector('html')?.setAttribute('data-theme', theme);
  }
`;

export const Head = createHead(() => (
  <>
    <meta charSet="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#000000" /> {/* Add this line */}
    <Meta />
    <Links />
    <script dangerouslySetInnerHTML={{ __html: inlineThemeCode }} />
  </>
));

export function Layout({ children }: { children: React.ReactNode }) {
  const theme = useStore(themeStore);

  useEffect(() => {
    document.querySelector('html')?.setAttribute('data-theme', theme);
  }, [theme]);

  return (
    <>
      <ClientOnly>{() => <DndProvider backend={HTML5Backend}>{children}</DndProvider>}</ClientOnly>
      <ScrollRestoration />
      <Scripts />
    </>
  );
}

import { logStore } from './lib/stores/logs';

export default function App() {
  const theme = useStore(themeStore);
  // A simple global flag for demo. In a real app, this would come from a store
  // or context indicating actual unsaved changes.
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    logStore.logSystem('Application initialized', {
      theme,
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      timestamp: new Date().toISOString(),
    });

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js')
          .then((registration) => {
            console.log('ServiceWorker registration successful with scope: ', registration.scope);

            // Check for updates
            registration.addEventListener('updatefound', () => {
              const newWorker = registration.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed') {
                    if (navigator.serviceWorker.controller) {
                      // New content is available, notify user
                      console.log('New content is available and will be used when all tabs for this scope are closed.');
                      // You can show a toast notification here to prompt the user to update.
                      // Example: showToast("New version available! Close all tabs or click here to update.", () => newWorker.postMessage({ type: 'SKIP_WAITING' }));
                      // For now, we'll just log it.
                      // To make it update immediately, you could call:
                      // newWorker.postMessage({ type: 'SKIP_WAITING' });
                    } else {
                      console.log('Content is cached for offline use.');
                    }
                  }
                });
              }
            });
          })
          .catch((error) => {
            console.log('ServiceWorker registration failed: ', error);
          });
      });

      let refreshing;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (refreshing) return;
        window.location.reload();
        refreshing = true;
      });
    }

    // Warn on page unload if there are unsaved changes
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      // For testing, let's assume there are always "unsaved changes"
      // In a real app, replace this with actual logic to check for unsaved changes from a store or state.
      // For example: if (someStore.get().hasUnsavedChanges) { ... }

      // To trigger the warning for testing, we can set a flag.
      // To actually enable it, you'd set hasUnsavedChanges to true based on application state.
      // For this subtask, we'll just set it to true to demonstrate the mechanism.
      // TODO: Replace with actual unsaved changes check
      const actualUnsavedChanges = false; // Set to true to test, or connect to real state

      if (actualUnsavedChanges) { // Or use the state: hasUnsavedChanges
        event.preventDefault();
        // Most browsers will show a generic message, but some older ones might use this string.
        event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);

    // Page Visibility API
    const handleVisibilityChange = () => {
      if (document.hidden) {
        console.log('Page is hidden');
        // Future: Pause resource-intensive operations
      } else {
        console.log('Page is visible');
        // Future: Resume operations
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };

  }, [theme]); // Add hasUnsavedChanges to dependency array if it's used directly

  // Example function to simulate unsaved changes (call this from somewhere in your app)
  // const markAsUnsaved = () => setHasUnsavedChanges(true);
  // const markAsSaved = () => setHasUnsavedChanges(false);

  return (
    <Layout>
      {/* Example buttons to test, remove later
      <button onClick={() => setHasUnsavedChanges(true)}>Simulate Unsaved Changes</button>
      <button onClick={() => setHasUnsavedChanges(false)}>Simulate Saved Changes</button>
      */}
      <Outlet />
    </Layout>
  );
}
