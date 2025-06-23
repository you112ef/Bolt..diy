import { atom } from 'nanostores';
import { logStore } from './logs';

export type Theme = 'dark' | 'light';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return themeStore.get() === 'dark';
}

export const DEFAULT_THEME = 'light';

export const themeStore = atom<Theme>(initStore());

function initStore() {
  if (!import.meta.env.SSR) {
    const persistedTheme = localStorage.getItem(kTheme) as Theme | undefined;
    const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');

    return persistedTheme ?? (themeAttribute as Theme) ?? DEFAULT_THEME;
  }

  return DEFAULT_THEME;
}

export function toggleTheme() {
  const currentTheme = themeStore.get();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  // Update the theme store
  themeStore.set(newTheme);

  // Update localStorage
  localStorage.setItem(kTheme, newTheme);

  // Update the HTML attribute
  document.querySelector('html')?.setAttribute('data-theme', newTheme);

  // Update user profile if it exists
  try {
    const userProfile = localStorage.getItem('bolt_user_profile');

    if (userProfile) {
      const profile = JSON.parse(userProfile);
      profile.theme = newTheme;
      localStorage.setItem('bolt_user_profile', JSON.stringify(profile));
    }
  } catch (error) {
    console.error('Error updating user profile theme:', error);
  }

  logStore.logSystem(`Theme changed to ${newTheme} mode`);
}

// Auto-switch theme based on device time
function autoSwitchTheme() {
  if (!import.meta.env.SSR) {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentHour = new Date().getHours();
    // Consider it "night" between 8 PM and 6 AM
    const isNightTime = currentHour >= 20 || currentHour < 6;
    const newTheme = (prefersDark || isNightTime) ? 'dark' : 'light';

    if (themeStore.get() !== newTheme) {
      themeStore.set(newTheme);
      localStorage.setItem(kTheme, newTheme);
      document.querySelector('html')?.setAttribute('data-theme', newTheme);
      logStore.logSystem(`Theme auto-switched to ${newTheme} mode based on device settings/time.`);
    }
  }
}

// Initialize auto-switching
if (!import.meta.env.SSR) {
  autoSwitchTheme(); // Initial check
  setInterval(autoSwitchTheme, 60 * 60 * 1000); // Check every hour

  // Listen for system theme changes
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', autoSwitchTheme);
}
