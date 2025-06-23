import React from 'react';

// Define a type for individual search result items
export interface SearchResultItem {
  id: string;
  title: string;
  link: string;
  snippet: string;
  imageUrl?: string; // Optional image URL for image search results
}

interface WebSearchResultsProps {
  results: SearchResultItem[];
  loading: boolean;
}

export default function WebSearchResults({ results, loading }: WebSearchResultsProps) {
  if (loading) {
    return (
      <div className="p-4 text-center text-bolt-theme-textSecondary">
        Loading search results...
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="p-4 text-center text-bolt-theme-textSecondary">
        No results found. Try a different search term.
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {results.map((item) => (
        <div key={item.id} className="p-3 bg-white dark:bg-bolt-theme-surface rounded-lg shadow hover:shadow-md transition-shadow">
          {item.imageUrl && (
            <img
              src={item.imageUrl}
              alt={item.title}
              className="w-full h-48 object-cover rounded-md mb-2" // Fixed height for consistency
            />
          )}
          <h3 className="text-md font-semibold text-bolt-theme-primary hover:underline">
            <a href={item.link} target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
          </h3>
          <p className="text-sm text-bolt-theme-textSecondary mt-1">{item.snippet}</p>
          <a href={item.link} target="_blank" rel="noopener noreferrer" className="text-xs text-bolt-theme-secondary hover:underline mt-1 inline-block">
            {item.link}
          </a>
        </div>
      ))}
    </div>
  );
}
