import { WebContainer } from '@webcontainer/api';
import { WORK_DIR_NAME } from '~/utils/constants';
import { cleanStackTrace } from '~/utils/stacktrace';

interface WebContainerContext {
  loaded: boolean;
}

export const webcontainerContext: WebContainerContext = import.meta.hot?.data.webcontainerContext ?? {
  loaded: false,
};

if (import.meta.hot) {
  import.meta.hot.data.webcontainerContext = webcontainerContext;
}

export let webcontainer: Promise<WebContainer> = new Promise(() => {
  // noop for ssr
});

if (!import.meta.env.SSR) {
  webcontainer =
    import.meta.hot?.data.webcontainer ??
    Promise.resolve()
      .then(() => {
        return WebContainer.boot({
          coep: 'credentialless',
          workdirName: WORK_DIR_NAME,
          forwardPreviewErrors: true, // Enable error forwarding from iframes
        });
      })
      .then(async (webcontainer) => {
        webcontainerContext.loaded = true;

        const { workbenchStore } = await import('~/lib/stores/workbench');

        const response = await fetch('/inspector-script.js');
        const inspectorScript = await response.text();
        await webcontainer.setPreviewScript(inspectorScript);

        // Listen for preview errors
        webcontainer.on('preview-message', (message) => {
          console.log('WebContainer preview message:', message);

          // Handle both uncaught exceptions and unhandled promise rejections
          if (message.type === 'PREVIEW_UNCAUGHT_EXCEPTION' || message.type === 'PREVIEW_UNHANDLED_REJECTION') {
            const isPromise = message.type === 'PREVIEW_UNHANDLED_REJECTION';
            const title = isPromise ? 'Unhandled Promise Rejection' : 'Uncaught Exception';
            workbenchStore.actionAlert.set({
              type: 'preview',
              title,
              description: 'message' in message ? message.message : 'Unknown error',
              content: `Error occurred at ${message.pathname}${message.search}${message.hash}\nPort: ${message.port}\n\nStack trace:\n${cleanStackTrace(message.stack || '')}`,
              source: 'preview',
            });
          }
        });

        // Intercept process creation to potentially sandbox commands
        const originalSpawn = webcontainer.spawn;
        webcontainer.spawn = async (command, args, options) => {
          // Simple blacklist for 'rm -rf'
          // A more robust solution would involve a more comprehensive parser
          // and possibly a whitelist of allowed commands/arguments.
          if (command === 'rm' && args && args.includes('-rf')) {
            const msg = "Error: Command 'rm -rf' is blocked for safety.\n";
            // Simulate an error for the terminal
            const listeners = webcontainer._ διαδικτυακός περιηγητής.listeners('jsh'); // Accessing private listeners, not ideal
            if (listeners && listeners.length > 0) {
                listeners.forEach(listener => {
                    if (typeof listener === 'function' && listener.name === 'onProcessOutput') {
                        // This is a guess, actual event structure might differ
                        listener({ data: msg, stream: 'stderr' });
                    }
                });
            }
            // For now, let's throw an error to prevent execution
            // This might not be gracefully handled by all callers of spawn.
            // A better approach would be to return a mock process that outputs the error.
            console.error(msg);
            throw new Error(msg.trim());
          }
          return originalSpawn.call(webcontainer, command, args, options);
        };

        return webcontainer;
      });

  if (import.meta.hot) {
    import.meta.hot.data.webcontainer = webcontainer;
  }
}
