import React, { useState } from 'react';
import { Switch } from '~/components/ui/Switch'; // Assuming a Switch component exists
import { Label } from '~/components/ui/Label';   // Assuming a Label component exists

export type ProjectSearchType = 'regex' | 'fuzzy';

interface ProjectSearchInputProps {
  onSearch: (query: string, type: ProjectSearchType) => void;
  loading: boolean;
}

export default function ProjectSearchInput({ onSearch, loading }: ProjectSearchInputProps) {
  const [query, setQuery] = useState('');
  const [searchType, setSearchType] = useState<ProjectSearchType>('fuzzy'); // Default to fuzzy

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim(), searchType);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3 p-3 bg-white dark:bg-bolt-theme-surface rounded-lg shadow">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search project files (content or names)..."
        className="w-full p-2 rounded-md text-sm bg-transparent text-bolt-theme-text border border-bolt-elements-borderColor focus:outline-none focus:ring-1 focus:ring-bolt-theme-primary"
        disabled={loading}
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center space-x-2">
          <Switch
            id="search-type-toggle"
            checked={searchType === 'regex'}
            onCheckedChange={(checked) => setSearchType(checked ? 'regex' : 'fuzzy')}
            disabled={loading}
          />
          <Label htmlFor="search-type-toggle" className="text-sm text-bolt-theme-textSecondary cursor-pointer">
            Use Regular Expression (Current: {searchType === 'regex' ? 'Regex' : 'Fuzzy'})
          </Label>
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-bolt-theme-primary rounded-md hover:bg-opacity-90 focus:outline-none disabled:opacity-50"
        >
          {loading ? 'Searching...' : 'Search Project'}
        </button>
      </div>
    </form>
  );
}
