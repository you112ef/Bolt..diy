// Using window.require for Electron in renderer, assuming contextBridge exposure
// const { Notification: ElectronNotification, shell: ElectronShell } = window.require?.('electron') || {};
// A more robust way for Electron would be via a preload script exposing these.
// For now, this is a placeholder for how Electron context might be accessed.
// If not in Electron, these will be undefined.

interface NotificationOptions {
  title: string;
  body: string;
  type?: 'success' | 'error' | 'warning' | 'info'; // Added 'info'
  silent?: boolean; // For Web API, silent means no sound/vibration. For Electron, it means no default sound.
  icon?: string; // URL or path to an icon
  actions?: Array<{ title: string, action: string }>; // For interactive notifications
  onClick?: () => void; // Action when notification body is clicked
  onAction?: (action: string) => void; // Action when a button is clicked
}

const DEFAULT_SUCCESS_SOUND = '/sounds/success.mp3'; // Placeholder, ensure these exist in /public/sounds
const DEFAULT_ERROR_SOUND = '/sounds/error.mp3';
const DEFAULT_WARNING_SOUND = '/sounds/warning.mp3';

const VIBRATION_PATTERN_SUCCESS = [100, 50, 100];
const VIBRATION_PATTERN_ERROR = [200, 100, 200, 100, 200];
const VIBRATION_PATTERN_WARNING = [150, 75, 150];

// Helper to check if running in Electron
function isElectron(): boolean {
  // @ts-ignore
  return typeof window !== 'undefined' && typeof window.process === 'object' && window.process.type === 'renderer';
}

async function requestWebNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) {
    console.warn('This browser does not support desktop notification');
    return false;
  }
  if (Notification.permission === 'granted') {
    return true;
  }
  if (Notification.permission !== 'denied') {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
}

export const notificationService = {
  async showNotification(options: NotificationOptions): Promise<void> {
    const { title, body, type = 'info', silent = false, icon, actions, onClick, onAction } = options;

    let soundPath: string | undefined;
    let vibrationPattern: number[] | undefined;

    switch (type) {
      case 'success':
        soundPath = DEFAULT_SUCCESS_SOUND;
        vibrationPattern = VIBRATION_PATTERN_SUCCESS;
        break;
      case 'error':
        soundPath = DEFAULT_ERROR_SOUND;
        vibrationPattern = VIBRATION_PATTERN_ERROR;
        break;
      case 'warning':
        soundPath = DEFAULT_WARNING_SOUND;
        vibrationPattern = VIBRATION_PATTERN_WARNING;
        break;
    }

    if (isElectron() && (window as any).electron?.showNotification) {
        // Assumes a preload script exposed 'electron.showNotification'
        // This is a more robust way than window.require
        try {
            (window as any).electron.showNotification({
                title,
                body,
                silent: silent || !soundPath, // Electron's silent means no OS default sound
                sound: soundPath, // Electron handles sounds differently, might need specific setup
                icon, // Electron uses nativeImage, path conversion might be needed in main process
                actions: actions?.map(a => ({ type: 'button', text: a.title })), // Electron actions format
                // onClick and onAction handling in Electron would require IPC back from main process
            });
            if (!silent && vibrationPattern && navigator.vibrate) {
                 navigator.vibrate(vibrationPattern); // Still use browser vibrate if possible
            }
        } catch (e) {
            console.error("Electron notification failed, falling back to web notification if possible:", e);
            this.showWebNotification(options, soundPath, vibrationPattern); // Fallback
        }

    } else if ('Notification' in window) {
      this.showWebNotification(options, soundPath, vibrationPattern);
    } else {
      console.warn('Notifications not supported in this environment.');
      // Fallback to a simple console log or an in-app alert
      alert(`[${type.toUpperCase()}] ${title}: ${body}`);
    }
  },

  async showWebNotification(
    options: NotificationOptions,
    soundPath: string | undefined,
    vibrationPattern: number[] | undefined
  ) {
    const { title, body, type = 'info', silent = false, icon, actions, onClick, onAction } = options;
    const permissionGranted = await requestWebNotificationPermission();
    if (!permissionGranted) {
      console.warn('Notification permission not granted.');
      // Optionally fallback to an in-app alert here if permission is denied
      // alert(`[${type.toUpperCase()}] ${title}: ${body}`);
      return;
    }

    const notificationOptions: globalThis.NotificationOptions = {
      body,
      tag: `bolt-notification-${Date.now()}`, // Tag to prevent multiple similar notifications if needed, or manage updates
      silent: silent, // If true, no sound or vibration
      icon: icon || (type === 'success' ? '/icons/icon.png' : type === 'error' ? '/icons/icon.png' : '/icons/icon.png'), // Placeholder icons
      ...(actions && { actions: actions.map(a => ({ title: a.title, action: a.action })) }),
    };

    if (!silent) {
      if (soundPath) notificationOptions.sound = soundPath; // Note: sound support is inconsistent across browsers
      if (vibrationPattern) notificationOptions.vibrate = vibrationPattern;
    }

    const notification = new Notification(title, notificationOptions);

    notification.onclick = () => {
      onClick?.();
      // Standard behavior: focus the window
      window.focus();
      notification.close();
    };

    if (actions && onAction) {
      notification.onshow = () => { // Or listen on the notification object itself if API supports it directly
        // Web Notification API handles actions via events on the service worker registration in more complex PWA scenarios
        // For simple non-PWA notifications, actions are primarily visual cues; actual handling is via 'notificationclick' event on service worker.
        // Here, we'll simulate by attaching to the notification object if possible, or it's mainly for display.
        // The 'actions' property itself defines buttons, but their click events are not directly on the Notification object.
        // This part is simplified for non-PWA contexts.
      };
      // A common way to handle actions for non-persistent notifications is to simply have the onClick handler.
      // For more complex actions, a service worker is typically involved.
      // The `notification.addEventListener('action', ...)` is not standard.
      // Actions are typically handled in a service worker via `self.addEventListener('notificationclick', event => event.action)`.
      // For this context, we'll assume actions are informational or handled by the main onClick.
    }

    notification.onerror = (err) => {
      console.error('Notification error:', err);
    };
  },

  // Helper to request permission proactively if desired
  async ensurePermission(): Promise<boolean> {
    if (isElectron()) return true; // Electron handles permissions differently, usually at app level
    return requestWebNotificationPermission();
  }
};

// Example of how a preload script might expose Electron features:
// contextBridge.exposeInMainWorld('electron', {
//   showNotification: (options) => ipcRenderer.invoke('show-notification', options),
//   // Any other APIs needed from Electron main process
// });
// And in main process:
// ipcMain.handle('show-notification', (event, options) => {
//   new ElectronNotification(options).show();
// });

// It's good practice to create placeholder sound files if they are referenced
// e.g., in /public/sounds/success.mp3, error.mp3, warning.mp3
// These can be silent or actual sounds. For now, the paths are placeholders.
// If sounds are not desired or available, `soundPath` should remain undefined or `silent` be true.

// To play sounds more reliably without the Notification API's sound option (which can be flaky):
// export function playSound(soundUrl: string) {
//   if (!soundUrl) return;
//   const audio = new Audio(soundUrl);
//   audio.play().catch(e => console.warn("Error playing sound:", e));
// }
// Then call `playSound(soundPath)` alongside showing the notification if `!silent`.
// This gives more control over audio playback.
// For this implementation, I'm relying on the Notification API's `sound` and `vibrate` options.
// If those are insufficient, manual sound playing via `Audio` element is the way to go.
// And for Electron, sound path needs to be resolvable by main process or be a system sound name.
// Electron's `sound` option is also a bit platform-dependent.
// For vibration, `navigator.vibrate` is the standard web API.
// Electron does not have a direct API for vibration in `Notification`, it's OS-dependent.
// So, for Electron, vibration would rely on `navigator.vibrate` if the renderer has access to it.

// Note on icons:
// Web Notifications: URL to an image.
// Electron Notifications: Path to a local file or a NativeImage.
// The service might need to handle this difference or expect a common format (URL)
// and have the Electron main process part (if using IPC) convert URL to NativeImage if needed.
// For simplicity, passing icon URL directly.
// Placeholders like '/icons/icon.png' should point to actual assets in your /public folder.
// For specific notification types, you might have '/icons/success.png', '/icons/error.png' etc.
// I'll use a generic one for now.
