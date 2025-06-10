import React from 'react';
import { useConnectionStatus } from '~/lib/hooks/useConnectionStatus';
import { classNames } from '~/utils/classNames';
import { WifiHigh, WifiSlash, WarningCircle } from '@phosphor-icons/react';

export const ConnectionStatusNotifier: React.FC = () => {
  const { hasConnectionIssues, currentIssue, acknowledgeIssue, resetAcknowledgment, isOnline } = useConnectionStatus();
  const [showOnlineStatus, setShowOnlineStatus] = React.useState(false);
  const [internalIsOnline, setInternalIsOnline] = React.useState(true); // Track previous online state

  React.useEffect(() => {
    if (isOnline && !internalIsOnline) {
      // Was offline, now online
      setShowOnlineStatus(true);
      const timer = setTimeout(() => {
        setShowOnlineStatus(false);
      }, 3000); // Show "Online" for 3 seconds
      return () => clearTimeout(timer);
    }
    setInternalIsOnline(isOnline);
  }, [isOnline, internalIsOnline]);

  if (showOnlineStatus) {
    return (
      <div
        className={classNames(
          'fixed bottom-4 right-4 p-3 rounded-lg text-white text-sm shadow-lg z-50',
          'bg-green-500 dark:bg-green-700'
        )}
      >
        <div className="flex items-center">
          <WifiHigh size={20} weight="bold" />
          <span className="ml-2">Back Online</span>
        </div>
      </div>
    );
  }

  // If no current issue and not actively having connection issues (e.g., after acknowledgment but before re-check confirmed online)
  // and not showing the temporary "Online" status, render nothing.
  if (!currentIssue && !hasConnectionIssues) {
    return null;
  }

  let message = '';
  let bgColor = 'bg-gray-600 dark:bg-gray-700'; // Default for acknowledged
  let IconComponent = WifiHigh;
  let iconColor = "text-white";

  if (hasConnectionIssues) { // Active, unacknowledged issue
    if (currentIssue === 'disconnected') {
      message = 'Offline. Some features may be unavailable.';
      bgColor = 'bg-red-500 dark:bg-red-700';
      IconComponent = WifiSlash;
    } else if (currentIssue === 'high-latency') {
      message = 'Connection is slow. Performance may be affected.';
      bgColor = 'bg-yellow-500 dark:bg-yellow-700 text-gray-800 dark:text-yellow-100';
      IconComponent = WarningCircle;
      iconColor = "text-gray-800 dark:text-yellow-100";
    }
  } else if (currentIssue) { // Acknowledged issue, but still present
    // Subtle indication that an issue was acknowledged but might still be ongoing
    // User can click to re-check/reset.
    if (currentIssue === 'disconnected') {
      message = 'Offline (acknowledged). Click to re-check.';
      IconComponent = WifiSlash;
      bgColor = 'bg-gray-400 dark:bg-gray-600'; // More subtle
      iconColor = "text-gray-700 dark:text-gray-300";
    } else if (currentIssue === 'high-latency') {
      message = 'Slow connection (acknowledged). Click to re-check.';
      IconComponent = WarningCircle;
      bgColor = 'bg-gray-400 dark:bg-gray-600'; // More subtle
      iconColor = "text-gray-700 dark:text-gray-300";
    }
  }

  // If no message (e.g. issue resolved after acknowledgment, currentIssue is null), render nothing.
  if (!message) {
    return null;
  }

  const handleClick = () => {
    if (hasConnectionIssues) {
      acknowledgeIssue();
    } else {
      // If issue was acknowledged and user clicks again, reset acknowledgment
      // This will make `hasConnectionIssues` true again if the issue persists,
      // or it will clear if the connection is now fine.
      resetAcknowledgment();
    }
  };

  return (
    <div
      className={classNames(
        'fixed bottom-4 right-4 p-3 rounded-lg text-sm shadow-lg cursor-pointer z-50',
        bgColor,
        currentIssue === 'high-latency' && hasConnectionIssues ? 'text-gray-800 dark:text-yellow-100' : 'text-white'
      )}
      onClick={handleClick}
      title={hasConnectionIssues ? "Click to acknowledge this issue" : "Click to re-check connection status"}
      role="alert"
      aria-live="assertive"
    >
      <div className="flex items-center">
        <IconComponent size={20} weight="bold" className={classNames(iconColor)} />
        <span className="ml-2">{message}</span>
      </div>
    </div>
  );
};
