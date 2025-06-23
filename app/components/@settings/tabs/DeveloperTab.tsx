import React from 'react';

import { useAtom } from '@nanostores/react';
import { Button } from '~/components/ui/Button';
import { Label } from '~/components/ui/Label';
import { Switch } from '~/components/ui/Switch';
import { logStore } from '~/lib/stores/logs';
import { developerModeStore, isEventLogsEnabled, setDeveloperMode, updateEventLogs } from '~/lib/stores/settings';

export function DeveloperTab() {
  const eventLogs = useAtom(isEventLogsEnabled);
  const devMode = useAtom(developerModeStore);

  const handleEventLogsChange = (checked: boolean) => {
    updateEventLogs(checked);
  };

  const handleDeveloperModeChange = (checked: boolean) => {
    setDeveloperMode(checked);

    // Optionally, enable/disable more detailed logging or metrics when dev mode changes
    if (checked) {
      logStore.logSystem('Developer Mode Enabled');
      // You might enable more verbose logging here, e.g., logStore.setLogLevel('debug');
    } else {
      logStore.logSystem('Developer Mode Disabled');
      // Reset to default log level, e.g., logStore.setLogLevel('info');
    }
  };

  const handleForceReload = () => {
    window.location.reload();
  };

  // Placeholder for metrics display
  const renderMetrics = () => {
    /*
     * Example: Fetch and display some metrics from logStore or a dedicated metrics store
     * const metrics = logStore.getMetrics(); // This is hypothetical
     * return <pre>{JSON.stringify(metrics, null, 2)}</pre>;
     */
    return <p className="text-sm text-gray-500">Metrics display area (placeholder).</p>;
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div>
        <h3 className="text-lg font-medium">Developer Settings</h3>
        <p className="text-sm text-gray-500">Configure advanced settings for development and debugging.</p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label
            htmlFor="developer-mode"
            className="flex flex-col space-y-1"
          >
            <span>Developer Mode</span>
            <span className="font-normal leading-snug text-gray-500">Enables additional debugging tools and logs.</span>
          </Label>
          <Switch
            id="developer-mode"
            checked={devMode}
            onCheckedChange={handleDeveloperModeChange}
          />
        </div>

        {devMode && (
          <>
            <div className="flex items-center justify-between">
              <Label
                htmlFor="event-logs"
                className="flex flex-col space-y-1"
              >
                <span>Enable Event Logs</span>
                <span className="font-normal leading-snug text-gray-500">
                  Captures detailed application events for debugging.
                </span>
              </Label>
              <Switch
                id="event-logs"
                checked={eventLogs}
                onCheckedChange={handleEventLogsChange}
              />
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">Debug Metrics</h4>
              {renderMetrics()}
            </div>

            <div>
              <h4 className="text-md font-medium mb-2">Actions</h4>
              <Button
                variant="outline"
                onClick={handleForceReload}
              >
                Force Reload Application
              </Button>
              {/*
               * TODO: "Force reload component" would require more specific
               * component targeting logic
               */}
              <p className="text-xs text-gray-500 mt-1">
                &quot;Force reload component&quot; is a more advanced feature and would require component-level state
                management or a debug context.
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
