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
      if (navigator.vibrate) {
        navigator.vibrate(50); // Vibrate for 50ms
      }
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

// Push Notification Subscription Handling

// IMPORTANT: Replace this with your own VAPID public key generated securely!
const VAPID_PUBLIC_KEY = 'YOUR_VAPID_PUBLIC_KEY_HERE_REPLACE_ME';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

async function requestNotificationPermission() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push notifications are not supported in this browser.');
    return false;
  }

  const permission = await Notification.requestPermission();
  if (permission === 'granted') {
    console.log('Notification permission granted.');
    return true;
  } else {
    console.log('Notification permission denied.');
    return false;
  }
}

async function subscribeUserToPush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    console.warn('Push Manager not supported.');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.ready; // Ensure SW is active
    const existingSubscription = await registration.pushManager.getSubscription();

    if (existingSubscription) {
      console.log('User is already subscribed:', existingSubscription);
      // Optionally, send the existing subscription to your backend here
      // sendSubscriptionToBackend(existingSubscription);
      return existingSubscription;
    }

    if (VAPID_PUBLIC_KEY === 'YOUR_VAPID_PUBLIC_KEY_HERE_REPLACE_ME') {
        alert('Error: VAPID public key is a placeholder. Please replace it with a real key to test push subscriptions.');
        console.error('Error: VAPID_PUBLIC_KEY is a placeholder. Cannot subscribe without a valid key.');
        return null;
    }

    const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: applicationServerKey,
    });

    console.log('User subscribed successfully:', subscription);
    // TODO: Send the new subscription object to your backend server
    // sendSubscriptionToBackend(subscription);
    alert('Successfully subscribed to notifications! (Placeholder - VAPID key needs replacement and backend integration)');


    return subscription;
  } catch (error) {
    console.error('Failed to subscribe the user: ', error);
    if (Notification.permission === 'denied') {
      console.warn('Permission for notifications was denied.');
    }
    return null;
  }
}

// Example of how you might call this.
// For now, we'll just log a message. A real app would have a UI element.
// This could be called after service worker registration, for example.
// Or, for better UX, call `requestNotificationPermission` first on a user gesture,
// then if granted, call `subscribeUserToPush`.

// We can expose this for manual testing via console for now:
if (typeof window !== 'undefined') {
  (window as any).askNotificationPermissionAndSubscribe = async () => {
    const permissionGranted = await requestNotificationPermission();
    if (permissionGranted) {
      await subscribeUserToPush();
    }
  };
  console.log("To test push notification subscription, call `window.askNotificationPermissionAndSubscribe()` from the console.");
  console.warn("REMINDER: The VAPID_PUBLIC_KEY in app/entry.client.tsx is a placeholder and MUST be replaced with your own valid key for push notifications to work.");
}

startTransition(() => {
  hydrateRoot(
    document.getElementById('root')!,
    <StrictMode>
      <RemixBrowser />
    </StrictMode>,
  );
});
