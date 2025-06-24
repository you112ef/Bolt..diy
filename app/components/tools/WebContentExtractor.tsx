import React, { useState, useCallback } from 'react';

interface ExtractedContent {
  title: string;
  extractedText: string;
  originalUrl: string;
}

export function WebContentExtractor() {
  const [urlInput, setUrlInput] = useState('');
  const [extractedContent, setExtractedContent] = useState<ExtractedContent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleExtract = useCallback(async () => {
    if (!urlInput.trim()) {
      setError('Please enter a URL.');
      setExtractedContent(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setExtractedContent(null);

    try {
      // Basic URL validation (browser also does this, but good to have)
      let parsedUrl;
      try {
        parsedUrl = new URL(urlInput.startsWith('http') ? urlInput : `http://${urlInput}`);
      } catch (_) {
        throw new Error('Invalid URL format.');
      }

      const response = await fetch(`/api/extract-text?url=${encodeURIComponent(parsedUrl.toString())}`);
      const data = await response.json();

      if (!response.ok || data.error) {
        throw new Error(data.error || `HTTP error! status: ${response.status}`);
      }

      setExtractedContent(data);
    } catch (e: any) {
      console.error("Failed to extract web content:", e);
      setError(e.message || 'Failed to extract content.');
      setExtractedContent(null);
    } finally {
      setIsLoading(false);
    }
  }, [urlInput]);

  return (
    <div className="p-4 bg-bolt-elements-background-depth-1 rounded-lg shadow">
      <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-3">Extract Web Content (Text Only)</h2>
      <div className="flex gap-2 mb-4">
        <input
          type="url"
          value={urlInput}
          onChange={(e) => setUrlInput(e.target.value)}
          placeholder="Enter URL (e.g., https://example.com)"
          className="flex-grow px-3 py-2 rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-bolt-primary"
        />
        <button
          onClick={handleExtract}
          disabled={isLoading}
          className="px-4 py-2 bg-bolt-primary text-white rounded-md hover:bg-bolt-primary-dark focus:outline-none focus:ring-2 focus:ring-bolt-primary focus:ring-opacity-50 disabled:opacity-50"
        >
          {isLoading ? (
            <div className="i-ph:circle-notch animate-spin text-lg" />
          ) : (
            'Extract Text'
          )}
        </button>
      </div>

      {error && (
        <div className="text-red-500 bg-red-100 border border-red-400 p-3 rounded-md mb-4">
          Error: {error}
        </div>
      )}

      {extractedContent && (
        <div className="p-3 bg-bolt-elements-background-depth-2 rounded-md shadow-sm">
          <h3 className="text-md font-semibold text-bolt-elements-textPrimary mb-1">
            Content from: <a href={extractedContent.originalUrl} target="_blank" rel="noopener noreferrer" className="text-bolt-primary hover:underline">{extractedContent.title || extractedContent.originalUrl}</a>
          </h3>
          <div className="max-h-96 overflow-y-auto modern-scrollbar p-2 border border-bolt-elements-borderColor rounded bg-bolt-elements-background-depth-3">
            <pre className="whitespace-pre-wrap text-sm text-bolt-elements-textSecondary">
              {extractedContent.extractedText}
            </pre>
          </div>
        </div>
      )}

      {/* Test Notifications Section */}
      <div className="mt-6 pt-4 border-t border-bolt-elements-borderColor">
        <h3 className="text-md font-semibold text-bolt-elements-textPrimary mb-2">Test Notifications</h3>
        <div className="flex gap-2">
          <button
            onClick={() => {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  payload: {
                    title: 'Success!',
                    options: {
                      body: 'The task completed successfully.',
                      icon: '/favicon.svg', // Or a success icon
                      vibrate: [100, 50, 100],
                      // sound: '/sounds/success.mp3' // Example sound
                    }
                  }
                });
              } else {
                alert('Service worker not ready to show notifications.');
              }
            }}
            className="px-3 py-1.5 bg-green-500 text-white rounded-md hover:bg-green-600 text-xs"
          >
            Show Success Notification
          </button>
          <button
            onClick={() => {
              if (navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage({
                  type: 'SHOW_NOTIFICATION',
                  payload: {
                    title: 'Error Occurred',
                    options: {
                      body: 'Something went wrong with the task.',
                      icon: '/favicon.ico', // Or an error icon
                      vibrate: [200, 100, 200, 100, 200], // Different pattern for error
                      // sound: '/sounds/error.mp3' // Example sound
                    }
                  }
                });
              } else {
                alert('Service worker not ready to show notifications.');
              }
            }}
            className="px-3 py-1.5 bg-red-500 text-white rounded-md hover:bg-red-600 text-xs"
          >
            Show Error Notification
          </button>
        </div>
      </div>
    </div>
  );
}
