import React, { useState, useCallback } from 'react';
import type { EditorView } from '@codemirror/view';
// import { findNext, findPrevious, openSearchPanel, closeSearchPanel, setSearchQuery } from '@codemirror/search';
// import { SearchQuery } from '@codemirror/search';
// import Fuse from 'fuse.js';

interface EditorSearchPanelProps {
  view?: EditorView; // The CodeMirror EditorView instance
  onClose: () => void;
}

export function EditorSearchPanel({ view, onClose }: EditorSearchPanelProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isFuzzy, setIsFuzzy] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  // const [replaceTerm, setReplaceTerm] = useState(''); // For future replace functionality

  const handleFindNext = useCallback(() => {
    if (!view || !searchTerm) return;
    // Placeholder: Actual search logic will be more complex
    // For now, this just logs. We'll need to properly use @codemirror/search commands
    // or implement custom search + decoration for fuzzy.
    console.log('Find Next:', { searchTerm, isRegex, isFuzzy, isCaseSensitive });

    // Example of how to use search commands (would need to be properly integrated)
    // view.dispatch(setSearchQuery.of(new SearchQuery({ search: searchTerm, caseSensitive: isCaseSensitive, regexp: isRegex })));
    // findNext(view);

  }, [view, searchTerm, isRegex, isFuzzy, isCaseSensitive]);

  // const handleFindPrevious = useCallback(() => {
  //   if (!view || !searchTerm) return;
  //   findPrevious(view);
  // }, [view, searchTerm]);

  return (
    <div className="bg-bolt-elements-background-depth-2 p-2 shadow-md rounded-b-md border-t border-bolt-elements-borderColor">
      <div className="flex items-center gap-2 mb-1">
        <input
          type="text"
          placeholder="Find in file..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow px-2 py-1 text-xs rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor focus:border-bolt-primary outline-none"
          // autoFocus // Consider carefully, might steal focus unexpectedly
        />
        <button onClick={handleFindNext} className="px-2 py-1 text-xs bg-bolt-primary text-white rounded-md hover:bg-bolt-primary-dark">
          Next
        </button>
        {/* <button onClick={handleFindPrevious} className="px-2 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700">Prev</button> */}
        <button onClick={onClose} title="Close Search Panel" className="p-1 text-xs text-bolt-elements-textSecondary hover:text-bolt-elements-textPrimary">
          <div className="i-ph:x text-lg" />
        </button>
      </div>
      <div className="flex items-center gap-3 text-xs text-bolt-elements-textSecondary">
        <label htmlFor="editor-search-regex" className="flex items-center cursor-pointer">
          <input type="checkbox" id="editor-search-regex" className="mr-1" checked={isRegex} onChange={(e) => { setIsRegex(e.target.checked); if (e.target.checked) setIsFuzzy(false); }} disabled={isFuzzy} />
          Regex
        </label>
        <label htmlFor="editor-search-fuzzy" className="flex items-center cursor-pointer">
          <input type="checkbox" id="editor-search-fuzzy" className="mr-1" checked={isFuzzy} onChange={(e) => { setIsFuzzy(e.target.checked); if (e.target.checked) setIsRegex(false); }} disabled={isRegex} />
          Fuzzy
        </label>
        <label htmlFor="editor-search-case" className="flex items-center cursor-pointer">
          <input type="checkbox" id="editor-search-case" className="mr-1" checked={isCaseSensitive} onChange={(e) => setIsCaseSensitive(e.target.checked)} />
          Aa
        </label>
      </div>
      {/* Future: Replace input and buttons
      <div className="flex items-center gap-2 mt-1">
        <input
          type="text"
          placeholder="Replace with..."
          value={replaceTerm}
          onChange={(e) => setReplaceTerm(e.target.value)}
          className="flex-grow px-2 py-1 text-xs rounded-md bg-bolt-elements-background-depth-3 border border-bolt-elements-borderColor focus:border-bolt-primary outline-none"
        />
        <button className="px-2 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700">Replace</button>
        <button className="px-2 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700">All</button>
      </div>
      */}
    </div>
  );
}
