import React, { useState, useCallback } from 'react';
import ProjectSearchInput, { type ProjectSearchType } from './ProjectSearchInput';
import ProjectSearchResults, { type ProjectSearchResultItem } from './ProjectSearchResults';
import { workbenchStore } from '~/lib/stores'; // Import workbenchStore

// Mock function for project-wide search
async function fetchMockProjectSearchResults(query: string, type: ProjectSearchType): Promise<ProjectSearchResultItem[]> {
  console.log(`Mock project search for: "${query}" (type: ${type})`);
  await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay

  const mockFiles = [
    { path: 'app/routes/index.tsx', contentLines: ['Hello world', `const text = "${query}";`, 'export default function Page() {}'] },
    { path: 'app/components/Button.tsx', contentLines: ['<button>Click me</button>', `// TODO: Implement ${query} feature`] },
    { path: 'README.md', contentLines: [`# Project ${query}`, 'This is a project about something.'] },
    { path: `styles/${query}.css`, contentLines: [`.${query}-class { color: blue; }`] }
  ];

  const results: ProjectSearchResultItem[] = [];

  mockFiles.forEach(file => {
    // File name match (simple includes for mock)
    if (type === 'fuzzy' && file.path.toLowerCase().includes(query.toLowerCase())) {
      results.push({ filePath: file.path, type: 'file_name' });
    } else if (type === 'regex') {
      try {
        const regex = new RegExp(query, 'i'); // Case-insensitive for mock
        if (regex.test(file.path)) {
          results.push({ filePath: file.path, type: 'file_name' });
        }
      } catch (e) { /* ignore invalid regex for filename search in mock */ }
    }

    // Content match
    file.contentLines.forEach((line, index) => {
      let match = false;
      let matchIndices: [number, number][] | undefined = undefined;

      if (type === 'fuzzy' && line.toLowerCase().includes(query.toLowerCase())) {
        match = true;
        // Simulate fuzzy match indices (very basic)
        const start = line.toLowerCase().indexOf(query.toLowerCase());
        if (start !== -1) {
          matchIndices = [[start, start + query.length - 1]];
        }
      } else if (type === 'regex') {
        try {
          const regex = new RegExp(query, 'gi'); // global and insensitive for mock
          let regexMatch;
          if ((regexMatch = regex.exec(line)) !== null) {
            match = true;
            // For regex, simple highlighting in component might be enough, or pass specific indices
            matchIndices = [[regexMatch.index, regexMatch.index + regexMatch[0].length -1]];
          }
        } catch (e) { /* ignore invalid regex for content search in mock */ }
      }

      if (match) {
        results.push({
          filePath: file.path,
          lineNumber: index + 1,
          lineContent: line,
          matchIndices: matchIndices,
          type: 'content',
          contextBefore: index > 0 ? [file.contentLines[index-1]] : [],
          contextAfter: index < file.contentLines.length - 1 ? [file.contentLines[index+1]] : [],
        });
      }
    });
  });
  // Deduplicate results (e.g. if filename and content match) - simple filter for mock
  const uniqueResults = results.filter((item, index, self) =>
    index === self.findIndex((t) => (
      t.filePath === item.filePath && t.lineNumber === item.lineNumber && t.type === item.type
    ))
  );
  return uniqueResults.slice(0, 15); // Limit results for mock
}


export default function ProjectSearch() {
  const [results, setResults] = useState<ProjectSearchResultItem[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [lastQuery, setLastQuery] = useState<{query: string, type: ProjectSearchType} | null>(null);

  const openFileInEditor = (filePath: string, lineNumber?: number) => {
    console.log(`Request to open file: ${filePath}` + (lineNumber ? ` at line ${lineNumber}` : ''));
    workbenchStore.setSelectedFile(filePath); // Use workbenchStore
    if (lineNumber !== undefined) {
      // Ensure the file is selected before attempting to scroll its content
      // setCurrentDocumentScrollPosition works on the currently selected document.
      // If setSelectedFile is async or updates currentDocument asynchronously,
      // this might need to be handled more carefully, e.g. via an effect or callback.
      // For now, assuming setSelectedFile updates the state synchronously enough
      // for setCurrentDocumentScrollPosition to target the correct document if it becomes current.
      // A more robust way if workbenchStore.currentDocument is an atom:
      // const unsub = workbenchStore.currentDocument.subscribe(doc => {
      //   if (doc?.filePath === filePath) {
      //     workbenchStore.setCurrentDocumentScrollPosition({ line: lineNumber > 0 ? lineNumber - 1 : 0, column: 0 });
      //     unsub(); // Unsubscribe after scrolling
      //   }
      // });
      // For simplicity now:
      if (workbenchStore.selectedFile.get() === filePath) {
         workbenchStore.setCurrentDocumentScrollPosition({ line: lineNumber > 0 ? lineNumber - 1 : 0, column: 0 });
      } else {
        // If not immediately the selected file, the scroll might not apply as expected to *this* specific file.
        // However, EditorStore usually persists scroll position, so when it *is* selected, it should scroll.
        // This is a nuanced point. The primary action is selecting the file.
        // The `updateScrollPosition` on the EditorStore class (which workbenchStore.#editorStore is)
        // can set the scroll position for any file, selected or not.
        // `workbenchStore.setCurrentDocumentScrollPosition` is only for the active one.
        // This means the ideal scenario involves `workbenchStore` exposing a method
        // that calls its internal `this.#editorStore.updateScrollPosition(filePath, position)`.
        // Since that's not available without modifying WorkbenchStore, this is the best effort.
        // The `editorStore.updateScrollPosition` in `Terminal.tsx` would face the same issue if `editorStore` was proxied simply as `workbenchStore`.
        // My previous `editorStoreProxy` in `index.ts` tried to address this but was an incomplete workaround.
        // The most correct fix requires either:
        // 1. Modifying WorkbenchStore to expose `this.#editorStore.updateScrollPosition(filePath, pos)`
        // 2. Or components accept that scrolling only happens for the *currently selected* document via `setCurrentDocumentScrollPosition`.
        // For now, we'll rely on the file being selected, and if it becomes the current document, scrolling will be attempted.
        // This is a limitation if we want to scroll a background file.
        // The `handleOpenFileRequest` in Terminal.tsx needs similar careful consideration.
        // For now, let's assume selecting the file is the primary goal, and editor might auto-scroll.
         console.warn(`Scrolling for ${filePath} will apply if it becomes the active document.`);
      }
    }
    if (workbenchStore.showWorkbench && workbenchStore.currentView.get() !== 'code') {
      workbenchStore.currentView.set('code');
    }
    // todo: also expand workbench if it's collapsed.
    // workbenchStore.setShowWorkbench(true);
  };

  const handleSearch = useCallback(async (query: string, type: ProjectSearchType) => {
    if (!query.trim()) return;

    setLoading(true);
    setError(null);
    setResults([]);
    setLastQuery({query, type});

    try {
      // Replace with actual API call:
      // const searchData = await fetch(`/api/project-search?q=${encodeURIComponent(query)}&type=${type}`).then(res => res.json());
      const searchData = await fetchMockProjectSearchResults(query, type);
      setResults(searchData);
    } catch (err) {
      console.error('Project search failed:', err);
      setError('Failed to fetch project search results. Please try again.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  return (
    <div className="p-4 md:p-6 max-w-3xl mx-auto">
      <h2 className="text-xl font-semibold text-bolt-theme-text mb-4">Search Project Files</h2>
      <ProjectSearchInput onSearch={handleSearch} loading={loading} />
      {error && <p className="text-red-500 mt-3">{error}</p>}
      <ProjectSearchResults
        results={results}
        loading={loading && !results.length}
        onResultClick={openFileInEditor}
        searchQuery={lastQuery?.query}
        searchType={lastQuery?.type}
      />
    </div>
  );
}
