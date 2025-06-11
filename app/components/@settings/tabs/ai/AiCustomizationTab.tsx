import React, { useState, useEffect, useCallback } from 'react';
import { Switch } from '@radix-ui/react-switch'; // Assuming this is the path from ControlPanel
import { Button } from '~/components/ui/Button';
import { Label } from '~/components/ui/Label'; // Assuming Label component exists
import { toast } from 'react-toastify';
import { classNames } from '~/utils/classNames';

const LOCAL_STORAGE_PROMPT_KEY = 'bolt_custom_ai_prompt';
const LOCAL_STORAGE_ENABLED_KEY = 'bolt_custom_ai_prompt_enabled';

export default function AiCustomizationTab() {
  const [customPromptText, setCustomPromptText] = useState<string>('');
  const [isCustomPromptEnabled, setIsCustomPromptEnabled] = useState<boolean>(false);

  useEffect(() => {
    const savedPrompt = localStorage.getItem(LOCAL_STORAGE_PROMPT_KEY);
    const savedEnabled = localStorage.getItem(LOCAL_STORAGE_ENABLED_KEY);

    if (savedPrompt) {
      setCustomPromptText(savedPrompt);
    }
    if (savedEnabled) {
      setIsCustomPromptEnabled(savedEnabled === 'true');
    }
  }, []);

  const handleSave = useCallback(() => {
    localStorage.setItem(LOCAL_STORAGE_PROMPT_KEY, customPromptText);
    localStorage.setItem(LOCAL_STORAGE_ENABLED_KEY, String(isCustomPromptEnabled));
    toast.success('AI customization settings saved!');
  }, [customPromptText, isCustomPromptEnabled]);

  const handleClear = useCallback(() => {
    setCustomPromptText('');
    setIsCustomPromptEnabled(false);
    localStorage.setItem(LOCAL_STORAGE_PROMPT_KEY, '');
    localStorage.setItem(LOCAL_STORAGE_ENABLED_KEY, 'false');
    toast.info('AI customization settings cleared and disabled.');
  }, []);

  return (
    <div className="space-y-6 p-1"> {/* Added p-1 for a little space from edges if not inside a padded container already */}
      <div>
        <h2 className="text-lg font-medium text-bolt-elements-textPrimary mb-2">
          Customize AI Behavior
        </h2>
        <p className="text-sm text-bolt-elements-textSecondary mb-4">
          Define a custom prompt that will be pre-pended to certain AI interactions.
          Enable or disable this feature as needed.
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-ai-prompt-toggle" className="text-bolt-elements-textPrimary">
          Enable Custom Prompt
        </Label>
        <div className="flex items-center space-x-2">
          <Switch
            id="custom-ai-prompt-toggle"
            checked={isCustomPromptEnabled}
            onCheckedChange={setIsCustomPromptEnabled}
            className={classNames(
              'relative inline-flex h-6 w-11 items-center rounded-full flex-shrink-0',
              'transition-colors duration-200 ease-in-out',
              'focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2',
              isCustomPromptEnabled ? 'bg-purple-600' : 'bg-gray-200 dark:bg-gray-700'
            )}
          >
            <span
              className={classNames(
                'inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out',
                isCustomPromptEnabled ? 'translate-x-5' : 'translate-x-0.5'
              )}
            />
          </Switch>
          <span className="text-sm text-bolt-elements-textSecondary">
            {isCustomPromptEnabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="custom-ai-prompt-text" className="text-bolt-elements-textPrimary">
          Custom Prompt Text
        </Label>
        <textarea
          id="custom-ai-prompt-text"
          value={customPromptText}
          onChange={(e) => setCustomPromptText(e.target.value)}
          rows={6}
          placeholder="e.g., Always respond in a concise and professional tone. Focus on providing actionable advice."
          className={classNames(
            'flex min-h-[80px] w-full rounded-md border border-bolt-elements-borderColor bg-transparent px-3 py-2 text-sm',
            'placeholder:text-bolt-elements-textTertiary',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-purple-500 focus-visible:ring-offset-1',
            'disabled:cursor-not-allowed disabled:opacity-50'
          )}
          disabled={!isCustomPromptEnabled}
        />
        <p className="text-xs text-bolt-elements-textTertiary">
          This prompt will be added by the system when interacting with the AI in relevant contexts.
        </p>
      </div>

      <div className="flex space-x-3 pt-4">
        <Button onClick={handleSave} variant="default" size="default">
          Save Changes
        </Button>
        <Button onClick={handleClear} variant="outline" size="default">
          Clear & Disable
        </Button>
      </div>
    </div>
  );
}
