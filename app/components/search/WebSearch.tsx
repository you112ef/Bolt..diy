import React, { useState, useCallback } from 'react';
import WebSearchInput from './WebSearchInput';
import WebSearchResults, { type SearchResultItem } from './WebSearchResults';
// For now, we'll use a mock search API. Later, this should be replaced with a real API call.

// Mock function to simulate API call for search results
async function fetchMockSearchResults(query: string): Promise<SearchResultItem[]> {
  console.log(`Mock searching for: ${query}`);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate network delay

  // Return some mock data based on the query
  const mockItems: SearchResultItem[] = [
    {
      id: '1',
      title: `Result 1 for "${query}"`,
      link: `https://example.com/search?q=${encodeURIComponent(query)}&result=1`,
      snippet: `This is a mock snippet for the first search result related to "${query}". It provides a brief overview.`,
      imageUrl: `https://source.unsplash.com/random/800x600?${encodeURIComponent(query)}&sig=1`
    },
    {
      id: '2',
      title: `Result 2 for "${query}" - An interesting article`,
      link: `https://example.com/search?q=${encodeURIComponent(query)}&result=2`,
      snippet: `Discover more about "${query}" in this detailed article. Contains useful information and resources.`,
    },
    {
      id: '3',
      title: `Image result for "${query}"`,
      link: `https://example.com/images?q=${encodeURIComponent(query)}&result=3`,
      snippet: `A beautiful image related to "${query}".`,
      imageUrl: `https://source.unsplash.com/random/800x600?${encodeURIComponent(query)}&sig=3`
    },
     {
      id: '4',
      title: `Another text result for "${query}"`,
      link: `https://example.com/search?q=${encodeURIComponent(query)}&result=4`,
      snippet: `Exploring the various aspects of "${query}". This result offers a different perspective.`,
    },
  ];
  // Simulate a mix of text and image results
  return mockItems.filter(item => item.imageUrl || Math.random() > 0.3);
}


export default function WebSearch() {
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]); // Clear previous results

    try {
      // In a real implementation, you would call your search API endpoint here.
      // For example: const searchData = await fetch(`/api/search?q=${encodeURIComponent(query)}`).then(res => res.json());
      const searchData = await fetchMockSearchResults(query);
      setResults(searchData);
    } catch (err) {
      console.error('Search failed:', err);
      setError('Failed to fetch search results. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold text-bolt-theme-text mb-4">Web Search</h2>
      <WebSearchInput onSearch={handleSearch} loading={loading} />
      {error && <p className="text-red-500 mt-3">{error}</p>}
      <WebSearchResults results={results} loading={loading && !results.length} />
    </div>
  );
}
