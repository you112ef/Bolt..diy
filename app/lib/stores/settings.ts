import { atom, map } from 'nanostores';
import { PROVIDER_LIST } from '~/utils/constants';
import type { IProviderConfig } from '~/types/model';
import { openDatabase, getUserSetting, setUserSetting, deleteUserSetting } from '~/lib/persistence/db'; // Added DB imports
import type {
  TabVisibilityConfig,
  TabWindowConfig,
  UserTabConfig,
  DevTabConfig,
} from '~/components/@settings/core/types';
import { DEFAULT_TAB_CONFIG } from '~/components/@settings/core/constants';
import Cookies from 'js-cookie';
import { toggleTheme } from './theme';
import { create } from 'zustand';

export interface Shortcut {
  key: string;
  ctrlKey?: boolean;
  shiftKey?: boolean;
  altKey?: boolean;
  metaKey?: boolean;
  ctrlOrMetaKey?: boolean;
  action: () => void;
  description?: string; // Description of what the shortcut does
  isPreventDefault?: boolean; // Whether to prevent default browser behavior
}

export interface Shortcuts {
  toggleTheme: Shortcut;
  toggleTerminal: Shortcut;
}

export const URL_CONFIGURABLE_PROVIDERS = ['Ollama', 'LMStudio', 'OpenAILike'];
export const LOCAL_PROVIDERS = ['OpenAILike', 'LMStudio', 'Ollama'];

export type ProviderSetting = Record<string, IProviderConfig>;

// Simplified shortcuts store with only theme toggle
export const shortcutsStore = map<Shortcuts>({
  toggleTheme: {
    key: 'd',
    metaKey: true,
    altKey: true,
    shiftKey: true,
    action: () => toggleTheme(),
    description: 'Toggle theme',
    isPreventDefault: true,
  },
  toggleTerminal: {
    key: '`',
    ctrlOrMetaKey: true,
    action: () => {
      // This will be handled by the terminal component
    },
    description: 'Toggle terminal',
    isPreventDefault: true,
  },
});

// Create a single key for provider settings
const PROVIDER_SETTINGS_KEY_DB = 'provider_settings_all'; // Renamed for DB to avoid conflict if old LS key was generic
const PROVIDER_SETTINGS_KEY_LS = 'provider_settings'; // Old localStorage key for migration

// Add this helper function at the top of the file
const isBrowser = typeof window !== 'undefined';

// ASYNC: Initialize provider settings from DB, with localStorage fallback/migration
async function loadInitialProviderSettings(db: IDBDatabase): Promise<ProviderSetting> {
  const defaultSettings: ProviderSetting = {};
  PROVIDER_LIST.forEach((provider) => {
    defaultSettings[provider.name] = {
      ...provider,
      settings: {
        enabled: !LOCAL_PROVIDERS.includes(provider.name),
      },
    };
  });

  let settingsFromDB: ProviderSetting | undefined;
  const dbValue = await getUserSetting(db, PROVIDER_SETTINGS_KEY_DB);
  if (dbValue) {
    try {
      settingsFromDB = JSON.parse(dbValue as string);
    } catch (error) {
      console.error('Error parsing provider settings from DB:', error);
    }
  }

  if (settingsFromDB) {
    // Merge with defaults to ensure all providers are present and have full structure
    Object.keys(defaultSettings).forEach(key => {
      if (settingsFromDB![key]) {
        defaultSettings[key].settings = { ...defaultSettings[key].settings, ...settingsFromDB![key].settings };
      }
    });
    return defaultSettings;
  }

  // Fallback to localStorage if not in DB
  if (isBrowser) {
    const savedSettingsLS = localStorage.getItem(PROVIDER_SETTINGS_KEY_LS);
    if (savedSettingsLS) {
      console.log('Migrating provider settings from localStorage to IndexedDB');
      try {
        const parsedLS = JSON.parse(savedSettingsLS);
        // Merge LS settings into defaults
        Object.entries(parsedLS).forEach(([key, value]) => {
          if (defaultSettings[key]) {
            defaultSettings[key].settings = (value as IProviderConfig).settings;
          }
        });
        // Save migrated settings to DB
        await setUserSetting(db, PROVIDER_SETTINGS_KEY_DB, JSON.stringify(defaultSettings));
        localStorage.removeItem(PROVIDER_SETTINGS_KEY_LS); // Remove from localStorage after migration
        return defaultSettings;
      } catch (error) {
        console.error('Error parsing/migrating provider settings from localStorage:', error);
      }
    }
  }
  // If nothing in DB or LS, save defaults to DB
  await setUserSetting(db, PROVIDER_SETTINGS_KEY_DB, JSON.stringify(defaultSettings));
  return defaultSettings;
}

// Initialize store with synchronous defaults, then update asynchronously
const syncDefaultProviderSettings = (): ProviderSetting => {
  const initialSettings: ProviderSetting = {};
  PROVIDER_LIST.forEach((provider) => {
    initialSettings[provider.name] = { ...provider, settings: { enabled: !LOCAL_PROVIDERS.includes(provider.name) } };
  });
  if (isBrowser) { // Quick check from LS for initial paint before DB load
    const savedSettings = localStorage.getItem(PROVIDER_SETTINGS_KEY_LS);
    if (savedSettings) {
      try {
        const parsed = JSON.parse(savedSettings);
        Object.entries(parsed).forEach(([key, value]) => {
          if (initialSettings[key]) initialSettings[key].settings = (value as IProviderConfig).settings;
        });
      } catch {/* ignore */}
    }
  }
  return initialSettings;
};
export const providersStore = map<ProviderSetting>(syncDefaultProviderSettings());

// ASYNC: Create a function to update provider settings that handles both store and persistence
export const updateProviderSettings = async (providerKey: string, newSettings: Partial<IProviderConfig['settings']>) => {
  const db = await openDatabase();
  if (!db) return;

  const currentProviders = providersStore.get();
  const providerToUpdate = currentProviders[providerKey];

  if (providerToUpdate) {
    const updatedProvider = {
      ...providerToUpdate,
      settings: {
        ...providerToUpdate.settings,
        ...newSettings,
      },
    };
    providersStore.setKey(providerKey, updatedProvider); // Update nanostore

    const allSettingsForDB = providersStore.get(); // Get the full map after update
    await setUserSetting(db, PROVIDER_SETTINGS_KEY_DB, JSON.stringify(allSettingsForDB));
  }
};

export const isDebugMode = atom(false);

// Define keys for localStorage and IndexedDB
// Using the same key for DB as for LS to simplify migration logic for these individual settings
const SETTINGS_KEYS = {
  LATEST_BRANCH: 'isLatestBranch', // DB key will be the same
  AUTO_SELECT_TEMPLATE: 'autoSelectTemplate',
  CONTEXT_OPTIMIZATION: 'contextOptimizationEnabled',
  EVENT_LOGS: 'isEventLogsEnabled',
  PROMPT_ID: 'promptId',
  DEVELOPER_MODE: 'isDeveloperMode', // DB key will be the same
} as const;

type IndividualSettingValue = boolean | string;

// ASYNC: Load an individual setting from DB with LS fallback/migration
async function loadIndividualSetting<T extends IndividualSettingValue>(
  db: IDBDatabase,
  key: string,
  defaultValue: T,
  isBoolean = false
): Promise<T> {
  let valueFromDB = await getUserSetting(db, key);

  if (valueFromDB !== undefined) {
    // Ensure correct type, especially for booleans stored as strings by old LS
    if (isBoolean && typeof valueFromDB === 'string') return JSON.parse(valueFromDB) as T;
    if (isBoolean && typeof valueFromDB !== 'boolean') return defaultValue; // Or handle error
    if (!isBoolean && typeof valueFromDB !== 'string') return defaultValue; // Or handle error for string settings
    return valueFromDB as T;
  }

  // Fallback to localStorage if not in DB
  if (isBrowser) {
    const valueFromLS = localStorage.getItem(key);
    if (valueFromLS !== null) {
      console.log(`Migrating setting '${key}' from localStorage to IndexedDB`);
      let parsedValue: T;
      try {
        parsedValue = isBoolean ? JSON.parse(valueFromLS) as T : valueFromLS as T;
      } catch (e) {
        parsedValue = defaultValue; // If parsing LS fails, use default
      }
      await setUserSetting(db, key, parsedValue);
      localStorage.removeItem(key); // Remove from localStorage after migration
      return parsedValue;
    }
  }

  // If not in DB or LS, save default to DB and return it
  await setUserSetting(db, key, defaultValue);
  return defaultValue;
}


// ASYNC: Load all individual settings
async function loadAllIndividualSettings(db: IDBDatabase) {
  const settings = {
    latestBranch: await loadIndividualSetting(db, SETTINGS_KEYS.LATEST_BRANCH, false, true),
    autoSelectTemplate: await loadIndividualSetting(db, SETTINGS_KEYS.AUTO_SELECT_TEMPLATE, true, true),
    contextOptimization: await loadIndividualSetting(db, SETTINGS_KEYS.CONTEXT_OPTIMIZATION, true, true),
    eventLogs: await loadIndividualSetting(db, SETTINGS_KEYS.EVENT_LOGS, true, true),
    promptId: await loadIndividualSetting(db, SETTINGS_KEYS.PROMPT_ID, 'default', false),
    developerMode: await loadIndividualSetting(db, SETTINGS_KEYS.DEVELOPER_MODE, false, true),
  };
  // Update stores after loading
  latestBranchStore.set(settings.latestBranch);
  autoSelectStarterTemplate.set(settings.autoSelectTemplate);
  enableContextOptimizationStore.set(settings.contextOptimization);
  isEventLogsEnabled.set(settings.eventLogs);
  promptStore.set(settings.promptId);
  developerModeStore.set(settings.developerMode); // For developerModeStore
}

// Initialize stores with synchronous defaults (or quick LS check for initial paint)
const getSyncInitialIndividualSetting = <T extends IndividualSettingValue>(key: string, defaultValue: T, isBoolean = false): T => {
  if (!isBrowser) return defaultValue;
  const stored = localStorage.getItem(key);
  if (stored === null) return defaultValue;
  try {
    return isBoolean ? JSON.parse(stored) : (stored as T);
  } catch {
    return defaultValue;
  }
};

export const latestBranchStore = atom<boolean>(getSyncInitialIndividualSetting(SETTINGS_KEYS.LATEST_BRANCH, false, true));
export const autoSelectStarterTemplate = atom<boolean>(getSyncInitialIndividualSetting(SETTINGS_KEYS.AUTO_SELECT_TEMPLATE, true, true));
export const enableContextOptimizationStore = atom<boolean>(getSyncInitialIndividualSetting(SETTINGS_KEYS.CONTEXT_OPTIMIZATION, true, true));
export const isEventLogsEnabled = atom<boolean>(getSyncInitialIndividualSetting(SETTINGS_KEYS.EVENT_LOGS, true, true));
export const promptStore = atom<string>(getSyncInitialIndividualSetting(SETTINGS_KEYS.PROMPT_ID, 'default', false));
// Developer mode store is handled below separately for its direct atom definition

// ASYNC: Helper functions to update settings with persistence to IndexedDB
async function updateSettingInDB<T extends IndividualSettingValue>(store: ReturnType<typeof atom<T>>, dbKey: string, value: T) {
  store.set(value);
  const db = await openDatabase();
  if (db) {
    await setUserSetting(db, dbKey, value);
  }
}

export const updateLatestBranch = (enabled: boolean) => updateSettingInDB(latestBranchStore, SETTINGS_KEYS.LATEST_BRANCH, enabled);
export const updateAutoSelectTemplate = (enabled: boolean) => updateSettingInDB(autoSelectStarterTemplate, SETTINGS_KEYS.AUTO_SELECT_TEMPLATE, enabled);
export const updateContextOptimization = (enabled: boolean) => updateSettingInDB(enableContextOptimizationStore, SETTINGS_KEYS.CONTEXT_OPTIMIZATION, enabled);
export const updateEventLogs = (enabled: boolean) => updateSettingInDB(isEventLogsEnabled, SETTINGS_KEYS.EVENT_LOGS, enabled);
export const updatePromptId = (id: string) => updateSettingInDB(promptStore, SETTINGS_KEYS.PROMPT_ID, id);


// Developer mode store (already an atom, just need to update its persistence)
export const developerModeStore = atom<boolean>(getSyncInitialIndividualSetting(SETTINGS_KEYS.DEVELOPER_MODE, false, true));
export const setDeveloperMode = (value: boolean) => updateSettingInDB(developerModeStore, SETTINGS_KEYS.DEVELOPER_MODE, value);

// --- Main Async Initializer for All Settings ---
// This should be called once when the client-side app initializes.
// It ensures all settings are loaded from DB and stores are updated.
let initializationPromise: Promise<void> | null = null;

export function initializeAllSettingsFromDB() {
  if (import.meta.env.SSR) return Promise.resolve();
  if (!initializationPromise) {
    initializationPromise = (async () => {
      console.log('Initializing all settings from IndexedDB...');
      const db = await openDatabase();
      if (!db) {
        console.error('Failed to open database. Settings will not be loaded from IndexedDB.');
        return;
      }
      // Load provider settings and update store
      const providerSettings = await loadInitialProviderSettings(db);
      providersStore.set(providerSettings); // Update the map store

      // Load individual settings and update stores (loadAllIndividualSettings already updates them)
      await loadAllIndividualSettings(db);

      // Load tab configuration and update store
      const tabConfig = await loadInitialTabConfiguration(db);
      tabConfigurationStore.set(tabConfig); // Update the map store

      // Theme is handled separately by its own module, but we need to import and call its loader.
      // To avoid circular dependencies if theme.ts imports settings.ts,
      // it's better to call loadThemeFromDBAndMigrate from the application entry point
      // after calling initializeAllSettingsFromDB.
      // For now, let's assume it can be called here or ensure no circular deps.
      // import { loadThemeFromDBAndMigrate } from './theme'; // This might cause issues if theme.ts imports settings.ts
      // await loadThemeFromDBAndMigrate(); // Call this from entry.client.tsx instead is safer

      console.log('All settings initialized from IndexedDB.');
    })();
  }
  return initializationPromise;
}


const TAB_CONFIG_KEY_DB = 'tab_configuration_v1'; // New DB key
const TAB_CONFIG_KEY_LS = 'bolt_tab_configuration'; // Old LS key

// ASYNC: Initialize tab configuration from DB, with localStorage fallback/migration
async function loadInitialTabConfiguration(db: IDBDatabase): Promise<TabWindowConfig> {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
    developerTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is DevTabConfig => tab.window === 'developer'),
  };

  const dbValue = await getUserSetting(db, TAB_CONFIG_KEY_DB);
  if (dbValue) {
    try {
      // Basic validation, can be more thorough
      const parsedDB = JSON.parse(dbValue as string);
      if (parsedDB?.userTabs && parsedDB?.developerTabs) {
        return {
          userTabs: parsedDB.userTabs.filter((tab: TabVisibilityConfig): tab is UserTabConfig => tab.window === 'user'),
          developerTabs: parsedDB.developerTabs.filter((tab: TabVisibilityConfig): tab is DevTabConfig => tab.window === 'developer'),
        };
      }
    } catch (error) {
      console.error('Error parsing tab configuration from DB:', error);
    }
  }

  // Fallback to localStorage if not in DB
  if (isBrowser) {
    const savedLS = localStorage.getItem(TAB_CONFIG_KEY_LS);
    if (savedLS) {
      console.log('Migrating tab configuration from localStorage to IndexedDB');
      try {
        const parsedLS = JSON.parse(savedLS);
        if (parsedLS?.userTabs && parsedLS?.developerTabs) {
          const validConfig = {
            userTabs: parsedLS.userTabs.filter((tab: TabVisibilityConfig): tab is UserTabConfig => tab.window === 'user'),
            developerTabs: parsedLS.developerTabs.filter((tab: TabVisibilityConfig): tab is DevTabConfig => tab.window === 'developer'),
          };
          await setUserSetting(db, TAB_CONFIG_KEY_DB, JSON.stringify(validConfig));
          localStorage.removeItem(TAB_CONFIG_KEY_LS); // Remove from LS
          Cookies.remove('tabConfiguration'); // Also remove old cookie if it existed
          return validConfig;
        }
      } catch (error) {
        console.error('Error parsing/migrating tab configuration from localStorage:', error);
      }
    }
    // Also check for old cookie as a last resort before defaults
    const savedCookie = Cookies.get('tabConfiguration');
    if (savedCookie) {
        console.log('Migrating tab configuration from Cookie to IndexedDB');
        try {
            const parsedCookie = JSON.parse(savedCookie);
             if (parsedCookie?.userTabs && parsedCookie?.developerTabs) {
                const validConfig = {
                    userTabs: parsedCookie.userTabs.filter((tab: TabVisibilityConfig): tab is UserTabConfig => tab.window === 'user'),
                    developerTabs: parsedCookie.developerTabs.filter((tab: TabVisibilityConfig): tab is DevTabConfig => tab.window === 'developer'),
                };
                await setUserSetting(db, TAB_CONFIG_KEY_DB, JSON.stringify(validConfig));
                Cookies.remove('tabConfiguration');
                localStorage.removeItem(TAB_CONFIG_KEY_LS); // Ensure LS is also cleared
                return validConfig;
            }
        } catch (error) {
            console.error('Error parsing/migrating tab configuration from Cookie:', error);
        }
    }
  }

  // If nothing in DB or LS/Cookie, save default to DB
  await setUserSetting(db, TAB_CONFIG_KEY_DB, JSON.stringify(defaultConfig));
  return defaultConfig;
}

// Synchronous getter for initial store population
const syncGetInitialTabConfiguration = (): TabWindowConfig => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter(t => t.window === 'user') as UserTabConfig[],
    developerTabs: DEFAULT_TAB_CONFIG.filter(t => t.window === 'developer') as DevTabConfig[],
  };
  if (!isBrowser) return defaultConfig;
  try {
    const saved = localStorage.getItem(TAB_CONFIG_KEY_LS) || Cookies.get('tabConfiguration');
    if (!saved) return defaultConfig;
    const parsed = JSON.parse(saved);
    if (!parsed?.userTabs || !parsed?.developerTabs) return defaultConfig;
    return {
      userTabs: parsed.userTabs.filter((t: TabVisibilityConfig) => t.window === 'user') as UserTabConfig[],
      developerTabs: parsed.developerTabs.filter((t: TabVisibilityConfig) => t.window === 'developer') as DevTabConfig[],
    };
  } catch { return defaultConfig; }
};

export const tabConfigurationStore = map<TabWindowConfig>(syncGetInitialTabConfiguration());

// ASYNC: Helper function to update tab configuration in IndexedDB
export const updateTabConfiguration = async (config: TabVisibilityConfig) => {
  const currentConfig = tabConfigurationStore.get();
  const isUserTab = config.window === 'user';
  const targetArray = isUserTab ? 'userTabs' : 'developerTabs';

  let updatedTabs = [...currentConfig[targetArray]]; // Clone the array
  const tabIndex = updatedTabs.findIndex((tab) => tab.id === config.id);

  if (tabIndex > -1) {
    updatedTabs[tabIndex] = { ...updatedTabs[tabIndex], ...config }; // Update existing
  } else {
    updatedTabs.push(config); // Add new
  }

  const newConfig: TabWindowConfig = { ...currentConfig, [targetArray]: updatedTabs };
  tabConfigurationStore.set(newConfig);

  const db = await openDatabase();
  if (db) {
    await setUserSetting(db, TAB_CONFIG_KEY_DB, JSON.stringify(newConfig));
  }
  // Remove old cookie persistence
  Cookies.remove('tabConfiguration');
};

// ASYNC: Helper function to reset tab configuration in IndexedDB
export const resetTabConfiguration = async () => {
  const defaultConfig: TabWindowConfig = {
    userTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is UserTabConfig => tab.window === 'user'),
    developerTabs: DEFAULT_TAB_CONFIG.filter((tab): tab is DevTabConfig => tab.window === 'developer'),
  };
  tabConfigurationStore.set(defaultConfig);

  const db = await openDatabase();
  if (db) {
    await setUserSetting(db, TAB_CONFIG_KEY_DB, JSON.stringify(defaultConfig));
  }
  // Remove old cookie/LS persistence
  Cookies.remove('tabConfiguration');
  if (isBrowser) localStorage.removeItem(TAB_CONFIG_KEY_LS);
};

// Developer mode store with persistence
export const developerModeStore = atom<boolean>(initialSettings.developerMode);

export const setDeveloperMode = (value: boolean) => {
  developerModeStore.set(value);

  if (isBrowser) {
    localStorage.setItem(SETTINGS_KEYS.DEVELOPER_MODE, JSON.stringify(value));
  }
};

// First, let's define the SettingsStore interface
// No changes needed for SettingsStore (Zustand store), it's UI state, not persistent settings.
interface SettingsStore {
  isOpen: boolean;
  selectedTab: string;
  openSettings: () => void;
  closeSettings: () => void;
  setSelectedTab: (tab: string) => void;
}

export const useSettingsStore = create<SettingsStore>((set) => ({
  isOpen: false,
  selectedTab: 'user', // Default tab

  openSettings: () => {
    set({
      isOpen: true,
      selectedTab: 'user', // Always open to user tab
    });
  },

  closeSettings: () => {
    set({
      isOpen: false,
      selectedTab: 'user', // Reset to user tab when closing
    });
  },

  setSelectedTab: (tab: string) => {
    set({ selectedTab: tab });
  },
}));
