import React, { useState } from 'react';

interface WebSearchInputProps {
  onSearch: (query: string) => void;
  loading: boolean;
}

export default function WebSearchInput({ onSearch, loading }: WebSearchInputProps) {
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2 p-2 bg-white dark:bg-bolt-theme-surface rounded-lg shadow">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search the web..."
        className="flex-grow p-2 rounded-md text-sm bg-transparent text-bolt-theme-text focus:outline-none"
        disabled={loading}
      />
      <button
        type="submit"
        disabled={loading || !query.trim()}
        className="px-4 py-2 text-sm font-medium text-white bg-bolt-theme-primary rounded-md hover:bg-opacity-90 focus:outline-none disabled:opacity-50"
      >
        {loading ? 'Searching...' : 'Search'}
      </button>
    </form>
  );
}
