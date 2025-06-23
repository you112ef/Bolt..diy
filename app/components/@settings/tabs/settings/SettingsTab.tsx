import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';
import { Switch } from '~/components/ui/Switch';
import type { UserProfile } from '~/components/@settings/core/types';
import { isMac } from '~/utils/os';

// Helper to get modifier key symbols/text
const getModifierSymbol = (modifier: string): string => {
  switch (modifier) {
    case 'meta':
      return isMac ? '⌘' : 'Win';
    case 'alt':
      return isMac ? '⌥' : 'Alt';
    case 'shift':
      return '⇧';
    default:
      return modifier;
  }
};

export default function SettingsTab() {
  const [currentTimezone, setCurrentTimezone] = useState('');
  const [settings, setSettings] = useState<UserProfile>(() => {
    const saved = localStorage.getItem('bolt_user_profile');
    return saved
      ? JSON.parse(saved)
      : {
          notifications: true,
          language: 'en',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
  });

  useEffect(() => {
    setCurrentTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone);
  }, []);

  // Save settings automatically when they change
  useEffect(() => {
    try {
      // Get existing profile data
      const existingProfile = JSON.parse(localStorage.getItem('bolt_user_profile') || '{}');

      // Merge with new settings
      const updatedProfile = {
        ...existingProfile,
        notifications: settings.notifications,
        language: settings.language,
        timezone: settings.timezone,
      };

      localStorage.setItem('bolt_user_profile', JSON.stringify(updatedProfile));
      toast.success('Settings updated');
    } catch (error) {
      console.error('Error saving settings:', error);
      toast.error('Failed to update settings');
    }
  }, [settings]);

  return (
    <div className="space-y-3 max-w-[360px] mx-auto"> {/* Adjusted space-y and added max-width with auto margins */}
      {/* Language & Notifications */}
      <motion.div
        className="bg-white dark:bg-[#0A0A0A] rounded-lg shadow-sm dark:shadow-none p-2.25 space-y-3" // Adjusted padding (25% reduction from p-3) and space-y
        initial={{ opacity: 0, y: 15 }} // Adjusted y-translate (25% reduction)
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-center gap-1.5 mb-2.25"> {/* Adjusted gap and mb */}
          <div className="i-ph:palette-fill w-4 h-4 text-purple-500" /> {/* Icon size w-4 h-4 */}
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Preferences</span> {/* text-sm */}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1"> {/* Adjusted gap and mb */}
            <div className="i-ph:translate-fill w-4 h-4 text-bolt-elements-textSecondary" /> {/* Icon size w-4 h-4 */}
            <label className="block text-sm text-bolt-elements-textSecondary">Language</label> {/* text-sm */}
          </div>
          <select
            value={settings.language}
            onChange={(e) => setSettings((prev) => ({ ...prev, language: e.target.value }))}
            className={classNames(
              'w-full px-1.5 py-1 rounded-md text-sm', // Adjusted padding (25% reduction), text-sm
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-1.5 focus:ring-purple-500/30', // Adjusted ring
              'transition-all duration-150', // Adjusted duration
            )}
          >
            <option value="en">English</option>
            <option value="es">Español</option>
            <option value="fr">Français</option>
            <option value="de">Deutsch</option>
            <option value="it">Italiano</option>
            <option value="pt">Português</option>
            <option value="ru">Русский</option>
            <option value="zh">中文</option>
            <option value="ja">日本語</option>
            <option value="ko">한국어</option>
          </select>
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1"> {/* Adjusted gap and mb */}
            <div className="i-ph:bell-fill w-4 h-4 text-bolt-elements-textSecondary" /> {/* Icon size w-4 h-4 */}
            <label className="block text-sm text-bolt-elements-textSecondary">Notifications</label> {/* text-sm */}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-bolt-elements-textSecondary"> {/* text-sm */}
              {settings.notifications ? 'Notifications are enabled' : 'Notifications are disabled'}
            </span>
            <Switch
              checked={settings.notifications}
              onCheckedChange={(checked) => {
                // Update local state
                setSettings((prev) => ({ ...prev, notifications: checked }));

                // Update localStorage immediately
                const existingProfile = JSON.parse(localStorage.getItem('bolt_user_profile') || '{}');
                const updatedProfile = {
                  ...existingProfile,
                  notifications: checked,
                };
                localStorage.setItem('bolt_user_profile', JSON.stringify(updatedProfile));

                // Dispatch storage event for other components
                window.dispatchEvent(
                  new StorageEvent('storage', {
                    key: 'bolt_user_profile',
                    newValue: JSON.stringify(updatedProfile),
                  }),
                );

                toast.success(`Notifications ${checked ? 'enabled' : 'disabled'}`);
              }}
            />
          </div>
        </div>
      </motion.div>

      {/* Timezone */}
      <motion.div
        className="bg-white dark:bg-[#0A0A0A] rounded-lg shadow-sm dark:shadow-none p-2.25" // Adjusted padding (25% reduction from p-3)
        initial={{ opacity: 0, y: 15 }} // Adjusted y-translate (25% reduction)
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <div className="flex items-center gap-1.5 mb-2.25"> {/* Adjusted gap and mb */}
          <div className="i-ph:clock-fill w-4 h-4 text-purple-500" /> {/* Icon size w-4 h-4 */}
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Time Settings</span> {/* text-sm */}
        </div>

        <div>
          <div className="flex items-center gap-1.5 mb-1"> {/* Adjusted gap and mb */}
            <div className="i-ph:globe-fill w-4 h-4 text-bolt-elements-textSecondary" /> {/* Icon size w-4 h-4 */}
            <label className="block text-sm text-bolt-elements-textSecondary">Timezone</label> {/* text-sm */}
          </div>
          <select
            value={settings.timezone}
            onChange={(e) => setSettings((prev) => ({ ...prev, timezone: e.target.value }))}
            className={classNames(
              'w-full px-1.5 py-1 rounded-md text-sm', // Adjusted padding (25% reduction), text-sm
              'bg-[#FAFAFA] dark:bg-[#0A0A0A]',
              'border border-[#E5E5E5] dark:border-[#1A1A1A]',
              'text-bolt-elements-textPrimary',
              'focus:outline-none focus:ring-1.5 focus:ring-purple-500/30', // Adjusted ring
              'transition-all duration-150', // Adjusted duration
            )}
          >
            <option value={currentTimezone}>{currentTimezone}</option>
          </select>
        </div>
      </motion.div>

      {/* Simplified Keyboard Shortcuts */}
      <motion.div
        className="bg-white dark:bg-[#0A0A0A] rounded-lg shadow-sm dark:shadow-none p-2.25" // Adjusted padding (25% reduction from p-3)
        initial={{ opacity: 0, y: 15 }} // Adjusted y-translate (25% reduction)
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-1.5 mb-2.25"> {/* Adjusted gap and mb */}
          <div className="i-ph:keyboard-fill w-4 h-4 text-purple-500" /> {/* Icon size w-4 h-4 */}
          <span className="text-sm font-medium text-bolt-elements-textPrimary">Keyboard Shortcuts</span> {/* text-sm */}
        </div>

        <div className="space-y-1.5"> {/* Adjusted space-y */}
          <div className="flex items-center justify-between p-1.5 rounded-lg bg-[#FAFAFA] dark:bg-[#1A1A1A] flex-wrap wrap"> {/* Adjusted padding */}
            <div className="flex flex-col mr-1.5"> {/* Adjusted mr */}
              <span className="text-sm text-bolt-elements-textPrimary break-words">Toggle Theme</span> {/* text-sm */}
              <span className="text-xs text-bolt-elements-textSecondary break-words">Switch between light and dark mode</span>
            </div>
            <div className="flex items-center gap-0.75 flex-shrink-0"> {/* Adjusted gap */}
              <kbd className="px-1.5 py-0.75 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] rounded shadow-sm"> {/* Adjusted padding */}
                {getModifierSymbol('meta')}
              </kbd>
              <kbd className="px-1.5 py-0.75 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] rounded shadow-sm"> {/* Adjusted padding */}
                {getModifierSymbol('alt')}
              </kbd>
              <kbd className="px-1.5 py-0.75 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] rounded shadow-sm"> {/* Adjusted padding */}
                {getModifierSymbol('shift')}
              </kbd>
              <kbd className="px-1.5 py-0.75 text-xs font-semibold text-bolt-elements-textSecondary bg-white dark:bg-[#0A0A0A] border border-[#E5E5E5] dark:border-[#1A1A1A] rounded shadow-sm"> {/* Adjusted padding */}
                D
              </kbd>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
