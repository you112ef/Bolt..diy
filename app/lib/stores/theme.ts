import { atom } from 'nanostores';
import { logStore } from './logs';
import { openDatabase, getUserSetting, setUserSetting } from '~/lib/persistence/db'; // Added DB imports

export type Theme = 'dark' | 'light';

export const kTheme = 'bolt_theme';

export function themeIsDark() {
  return themeStore.get() === 'dark';
}

export const DEFAULT_THEME = 'light';

export const themeStore = atom<Theme>(initStore()); // Initialize with sync part

// Synchronous part for initial load to prevent FOUC
function initStore(): Theme {
  if (!import.meta.env.SSR) {
    const persistedTheme = localStorage.getItem(kTheme) as Theme | undefined;
    const themeAttribute = document.querySelector('html')?.getAttribute('data-theme');
    // Priority: localStorage, then HTML attribute, then default
    const initialTheme = persistedTheme ?? (themeAttribute as Theme) ?? DEFAULT_THEME;
    // Ensure HTML attribute is set early if found in LS
    if (persistedTheme) {
        document.querySelector('html')?.setAttribute('data-theme', persistedTheme);
    }
    return initialTheme;
  }
  return DEFAULT_THEME;
}

// Asynchronous part to load from DB and migrate if needed
export async function loadThemeFromDBAndMigrate() {
  if (import.meta.env.SSR) return;

  const db = await openDatabase();
  if (!db) {
    console.warn('DB not available for theme loading.');
    return;
  }

  let themeFromDB = await getUserSetting(db, kTheme) as Theme | undefined;

  if (themeFromDB) {
    if (themeStore.get() !== themeFromDB) { // Only update if different from initial sync load
        themeStore.set(themeFromDB);
    }
    document.querySelector('html')?.setAttribute('data-theme', themeFromDB);
    // Ensure localStorage is also in sync with DB as the source of truth
    localStorage.setItem(kTheme, themeFromDB);
  } else {
    const themeFromLS = localStorage.getItem(kTheme) as Theme | undefined;
    if (themeFromLS) {
      console.log('Migrating theme from localStorage to IndexedDB');
      await setUserSetting(db, kTheme, themeFromLS);
      if (themeStore.get() !== themeFromLS) {
        themeStore.set(themeFromLS);
      }
      document.querySelector('html')?.setAttribute('data-theme', themeFromLS);
    } else {
      // If nothing in DB or LS, take current store value (from initStore) and save to DB
      const currentTheme = themeStore.get();
      await setUserSetting(db, kTheme, currentTheme);
      // localStorage is likely already set by initStore if it used default/attribute
    }
  }
}


export async function toggleTheme() {
  const currentTheme = themeStore.get();
  const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

  themeStore.set(newTheme);
  localStorage.setItem(kTheme, newTheme); // Keep LS for FOUC script
  document.querySelector('html')?.setAttribute('data-theme', newTheme);

  const db = await openDatabase();
  if (db) {
    await setUserSetting(db, kTheme, newTheme);
  }

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
