import React, { useState, useCallback } from 'react';
import WebPreview, { type WebPreviewData } from './WebPreview';

export default function WebScraper() {
  const [url, setUrl] = useState<string>('');
  const [previewData, setPreviewData] = useState<WebPreviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);

  const handleScrape = useCallback(async () => {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) {
      setPreviewData({ url: '', error: 'Please enter a URL to scrape.' });
      return;
    }

    setLoading(true);
    setPreviewData(null); // Clear previous preview

    try {
      const response = await fetch(`/api/scrape?url=${encodeURIComponent(trimmedUrl)}`);
      if (!response.ok) {
        let errorText = `Error: ${response.status} ${response.statusText}`;
        try {
            const errorData = await response.json();
            errorText = errorData.error || errorText;
        } catch (e) {
            // Ignore if response is not json
        }
        throw new Error(errorText);
      }
      const data: WebPreviewData = await response.json();
      setPreviewData(data);
    } catch (err: any) {
      console.error('Scraping failed:', err);
      setPreviewData({ url: trimmedUrl, error: err.message || 'An unexpected error occurred while scraping.' });
    } finally {
      setLoading(false);
    }
  }, [url]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleScrape();
  };

  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto">
      <h2 className="text-xl font-semibold text-bolt-theme-text mb-4">Web Page Preview</h2>
      <form onSubmit={handleSubmit} className="flex items-center gap-2 mb-4">
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="Enter URL (e.g., https://example.com)"
          className="flex-grow p-2 rounded-md text-sm bg-white dark:bg-bolt-theme-surface border border-bolt-elements-borderColor text-bolt-theme-text focus:outline-none focus:ring-2 focus:ring-bolt-theme-primary"
          disabled={loading}
        />
        <button
          type="submit"
          disabled={loading || !url.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-bolt-theme-primary rounded-md hover:bg-opacity-90 focus:outline-none disabled:opacity-50"
        >
          {loading ? 'Previewing...' : 'Preview'}
        </button>
      </form>

      <WebPreview preview={previewData} loading={loading && !previewData} /> {/* Ensure loading state is accurate */}
    </div>
  );
}
