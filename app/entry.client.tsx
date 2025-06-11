import { RemixBrowser } from '@remix-run/react';
import { startTransition, StrictMode } from 'react'; // Added StrictMode
import { hydrateRoot } from 'react-dom/client';

// Function to register the service worker
function registerServiceWorker() {
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
  }
}

// Call the registration function
registerServiceWorker();

// PWA Install Prompt Handling
let deferredInstallPrompt: any = null; // Use 'any' for simplicity or define a proper type

window.addEventListener('beforeinstallprompt', (event) => {
  // Prevent the mini-infobar from appearing on mobile
  event.preventDefault();
  // Stash the event so it can be triggered later.
  deferredInstallPrompt = event;
  console.log('PWA install prompt captured. Call window.triggerPwaInstall() to show it.');
  // Optionally, make it available globally for developers to trigger
  (window as any).triggerPwaInstall = () => {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      // Wait for the user to respond to the prompt
      deferredInstallPrompt.userChoice.then((choiceResult: { outcome: string }) => {
        if (choiceResult.outcome === 'accepted') {
          console.log('User accepted the PWA installation');
        } else {
          console.log('User dismissed the PWA installation');
        }
        deferredInstallPrompt = null;
      });
    } else {
      console.log('PWA install prompt not available or already used.');
    }
  };
});

window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  // Clear the deferred prompt variable, as it's no longer needed
  deferredInstallPrompt = null;
  // Remove the global trigger if it exists
  if ((window as any).triggerPwaInstall) {
    delete (window as any).triggerPwaInstall;
  }
});

startTransition(() => {
  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>,
  );
});
