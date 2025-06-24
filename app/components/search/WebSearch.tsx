import React, { useState, useCallback, useEffect } from 'react'; // Added useEffect
import { useDebounce } from 'use-debounce'; // Corrected import

interface SearchResultItem {
  title: string;
  snippet: string;
  url: string;
}

export function WebSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const debouncedQuery = useDebounce(query, 500); // Debounce for 500ms

  const fetchResults = useCallback(async (searchQuery: string) => {
    if (!searchQuery.trim()) {
      setResults([]);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]); // Clear previous results

    try {
      const response = await fetch(`/api/web-search?q=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error || `HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      if (data.error) {
        throw new Error(data.error);
      }
      setResults(data.results || []);
    } catch (e: any) {
      console.error("Failed to fetch web search results:", e);
      setError(e.message || 'Failed to fetch results.');
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResults(debouncedQuery);
  }, [debouncedQuery, fetchResults]);

  return (
    <div className="p-4 bg-bolt-elements-background-depth-1 rounded-lg shadow">
      <h2 className="text-lg font-semibold text-bolt-elements-textPrimary mb-3">Web Search</h2>
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the web..."
        className="w-full px-3 py-2 mb-4 rounded-md bg-bolt-elements-background-depth-2 border border-bolt-elements-borderColor text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none focus:ring-2 focus:ring-bolt-primary"
      />

      {isLoading && (
        <div className="flex items-center justify-center text-bolt-elements-textSecondary">
          <div className="i-ph:circle-notch animate-spin mr-2 text-lg" />
          Searching...
        </div>
      )}

      {error && (
        <div className="text-red-500 bg-red-100 border border-red-400 p-3 rounded-md">
          Error: {error}
        </div>
      )}

      {!isLoading && !error && results.length === 0 && debouncedQuery && (
        <p className="text-bolt-elements-textSecondary">No results found for "{debouncedQuery}".</p>
      )}

      <div className="space-y-3 max-h-96 overflow-y-auto modern-scrollbar pr-2">
        {results.map((item, index) => (
          <div key={index} className="p-3 bg-bolt-elements-background-depth-2 rounded-md shadow-sm hover:shadow-md transition-shadow">
            <a
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-base font-medium text-bolt-primary hover:underline"
            >
              {item.title || 'Untitled'}
            </a>
            <p className="text-xs text-bolt-elements-textTertiary mt-1 break-words">
              {item.url}
            </p>
            {item.snippet && item.snippet !== item.url && ( // Avoid showing URL as snippet if it's the same
                 <p className="text-sm text-bolt-elements-textSecondary mt-1 break-words">
                    {/* Basic snippet formatting, can be improved */}
                    {item.snippet.length > 150 ? `${item.snippet.substring(0, 150)}...` : item.snippet}
                 </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
