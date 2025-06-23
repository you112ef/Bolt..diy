import React from 'react';

export interface WebPreviewData {
  url: string;
  title?: string;
  description?: string;
  imageUrl?: string; // URL of the screenshot
  favicon?: string;
  error?: string; // To display any scraping errors
}

interface WebPreviewProps {
  preview: WebPreviewData | null;
  loading: boolean;
}

export default function WebPreview({ preview, loading }: WebPreviewProps) {
  if (loading) {
    return (
      <div className="p-4 text-center text-bolt-theme-textSecondary animate-pulse">
        Generating preview...
      </div>
    );
  }

  if (!preview) {
    return null; // Or some placeholder if nothing is to be previewed yet
  }

  if (preview.error) {
    return (
      <div className="p-4 my-4 bg-red-100 dark:bg-red-900 border border-red-400 dark:border-red-700 text-red-700 dark:text-red-200 rounded-lg shadow">
        <h4 className="font-semibold">Error generating preview for:</h4>
        <p className="text-sm break-all">{preview.url}</p>
        <p className="mt-2 text-sm">{preview.error}</p>
      </div>
    );
  }

  return (
    <div className="my-4 p-3 bg-white dark:bg-bolt-theme-surface rounded-lg shadow-lg overflow-hidden">
      {preview.imageUrl && (
        <div className="mb-3 border-b border-bolt-elements-borderColor dark:border-bolt-elements-borderColor pb-3">
          <h3 className="text-sm font-semibold text-bolt-theme-textSecondary px-1 pb-2">Screenshot:</h3>
          <img
            src={preview.imageUrl}
            alt={`Screenshot of ${preview.title || preview.url}`}
            className="w-full object-contain rounded-md border border-bolt-elements-borderColor dark:border-bolt-elements-borderColor"
          />
        </div>
      )}
      <div className="px-1">
        <div className="flex items-center gap-2 mb-1.5">
          {preview.favicon && (
            <img src={preview.favicon} alt="favicon" className="w-4 h-4" />
          )}
          <h3 className="text-md font-semibold text-bolt-theme-primary hover:underline">
            <a href={preview.url} target="_blank" rel="noopener noreferrer">
              {preview.title || 'Untitled Page'}
            </a>
          </h3>
        </div>
        {preview.description && (
          <p className="text-sm text-bolt-theme-textSecondary mt-1 line-clamp-3">
            {preview.description}
          </p>
        )}
        <a href={preview.url} target="_blank" rel="noopener noreferrer" className="text-xs text-bolt-theme-secondary hover:underline mt-2 inline-block break-all">
          {preview.url}
        </a>
      </div>
    </div>
  );
}
