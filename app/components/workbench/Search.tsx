import { useState, useMemo, useCallback, useEffect } from 'react';
import type { TextSearchOptions, TextSearchOnProgressCallback, WebContainer } from '@webcontainer/api';
import { workbenchStore } from '~/lib/stores/workbench';
import { webcontainer } from '~/lib/webcontainer';
import { WORK_DIR } from '~/utils/constants';
import { debounce } from '~/utils/debounce';
import Fuse from 'fuse.js';

interface DisplayMatch {
  path: string;
  lineNumber: number;
  previewText: string;
  matchCharStart: number;
  matchCharEnd: number;
}

// Original performTextSearch using WebContainer's API
async function performTextSearch(
  instance: WebContainer,
  query: string,
  options: Omit<TextSearchOptions, 'folders'>,
  onProgress: (results: DisplayMatch[]) => void,
): Promise<void> {
  if (!instance || typeof instance.internal?.textSearch !== 'function') {
    console.error('WebContainer instance not available or internal searchText method is missing/not a function.');
    onProgress([]);
    return;
  }

  const searchOptions: TextSearchOptions = { ...options, folders: [WORK_DIR] };
  let allMatches: DisplayMatch[] = [];

  const progressCallback: TextSearchOnProgressCallback = (filePath: any, apiMatches: any[]) => {
    const displayMatches: DisplayMatch[] = [];
    apiMatches.forEach((apiMatch: { preview: { text: string; matches: string | any[] }; ranges: any[] }) => {
      const previewLines = apiMatch.preview.text.split('\n');
      apiMatch.ranges.forEach((range: { startLineNumber: number; startColumn: any; endColumn: any }) => {
        let previewLineText = '(Preview line not found)';
        let lineIndexInPreview = -1;
        if (apiMatch.preview.matches.length > 0) {
          const previewStartLine = apiMatch.preview.matches[0].startLineNumber;
          lineIndexInPreview = range.startLineNumber - previewStartLine;
        }
        if (lineIndexInPreview >= 0 && lineIndexInPreview < previewLines.length) {
          previewLineText = previewLines[lineIndexInPreview];
        } else {
          previewLineText = previewLines[0] ?? '(Preview unavailable)';
        }
        displayMatches.push({
          path: filePath,
          lineNumber: range.startLineNumber,
          previewText: previewLineText,
          matchCharStart: range.startColumn,
          matchCharEnd: range.endColumn,
        });
      });
    });
    if (displayMatches.length > 0) {
      allMatches = [...allMatches, ...displayMatches];
      onProgress(allMatches); // Call onProgress with accumulated matches
    }
  };

  try {
    await instance.internal.textSearch(query, searchOptions, progressCallback);
  } catch (error) {
    console.error('Error during internal text search:', error);
    onProgress([]); // Clear results on error
  }
}

// Helper function to list all files for Fuzzy Search
async function listFilesRecursive(wcInstance: WebContainer, dir: string, allFiles: string[] = []): Promise<string[]> {
  const entries = await wcInstance.fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = `${dir}/${entry.name}`;
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') continue; // Skip common large/binary dirs

    if (entry.isDirectory()) {
      await listFilesRecursive(wcInstance, fullPath, allFiles);
    } else {
      if (!entry.name.match(/\.(png|jpg|jpeg|gif|bmp|ico|woff|woff2|ttf|eot|mp3|mp4|webm|zip|gz|tar|lock|svg)$/i) && entry.name !== 'package-lock.json') {
        allFiles.push(fullPath);
      }
    }
  }
  return allFiles;
}

// Fuzzy search implementation using Fuse.js
async function performFuzzyFileSearch(
  instance: WebContainer,
  query: string,
  options: { homeDir: string; excludes?: string[]; includes?: string[] },
  onResults: (results: DisplayMatch[]) => void,
  setTotalFiles: (count: number) => void,
  setFilesProcessed: (count: number) => void,
): Promise<void> {
  if (!instance || !query.trim()) {
    onResults([]);
    setTotalFiles(0);
    setFilesProcessed(0);
    return;
  }

  let allDisplayMatches: DisplayMatch[] = [];
  try {
    const filePaths = await listFilesRecursive(instance, options.homeDir);
    setTotalFiles(filePaths.length);
    let processedCount = 0;

    for (const filePath of filePaths) {
      // Basic exclusion based on common patterns (can be enhanced by options.excludes)
      if (options.excludes?.some(excludePattern => new RegExp(excludePattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')).test(filePath))) {
        processedCount++;
        setFilesProcessed(processedCount);
        continue;
      }
      try {
        const content = await instance.fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n');
        const fuse = new Fuse(
          lines.map((text, index) => ({ text, lineNumber: index + 1 })),
          {
            includeScore: true,
            includeMatches: true,
            minMatchCharLength: Math.max(1, Math.floor(query.length * 0.6)), // Match at least 60% of query length
            threshold: 0.5, // Fuzziness threshold (0 exact, 1 very fuzzy)
            keys: ['text'],
          },
        );
        const lineResults = fuse.search(query);
        const fileMatches: DisplayMatch[] = lineResults
          .filter(result => result.score !== undefined && result.score < 0.6) // Stricter score filtering
          .map(result => {
            const firstMatch = result.matches?.[0];
            return {
              path: filePath.replace(options.homeDir + '/', ''),
              lineNumber: result.item.lineNumber,
              previewText: result.item.text,
              matchCharStart: firstMatch?.indices?.[0]?.[0] ?? 0,
              matchCharEnd: firstMatch?.indices?.[0]?.[1] != null ? firstMatch.indices[0][1] + 1 : result.item.text.length,
            };
          }).filter(match => match.previewText.trim() !== '');

        if (fileMatches.length > 0) {
          allDisplayMatches = [...allDisplayMatches, ...fileMatches];
        }
      } catch (e) { /* ignore read errors for binary files etc. */ }
      processedCount++;
      setFilesProcessed(processedCount);
    }
    onResults(allDisplayMatches);
  } catch (error) {
    console.error('[Fuzzy Search] Error:', error);
    onResults([]);
  }
}

function groupResultsByFile(results: DisplayMatch[]): Record<string, DisplayMatch[]> {
  return results.reduce(
    (acc, result) => {
      if (!acc[result.path]) acc[result.path] = [];
      acc[result.path].push(result);
      return acc;
    },
    {} as Record<string, DisplayMatch[]>,
  );
}

export function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<DisplayMatch[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [expandedFiles, setExpandedFiles] = useState<Record<string, boolean>>({});
  const [hasSearched, setHasSearched] = useState(false);
  const [isRegexEnabled, setIsRegexEnabled] = useState(false);
  const [isFuzzyEnabled, setIsFuzzyEnabled] = useState(false);
  const [totalFilesToSearch, setTotalFilesToSearch] = useState(0);
  const [filesSearched, setFilesSearched] = useState(0);

  const groupedResults = useMemo(() => groupResultsByFile(searchResults), [searchResults]);

  useEffect(() => {
    if (searchResults.length > 0) {
      const allExpanded: Record<string, boolean> = {};
      Object.keys(groupedResults).forEach((file) => { allExpanded[file] = true; });
      setExpandedFiles(allExpanded);
    } else {
      setExpandedFiles({});
    }
  }, [searchResults]); // Only depend on searchResults

  const handleSearch = useCallback(async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setTotalFilesToSearch(0);
      setFilesSearched(0);
      setIsSearching(false);
      setHasSearched(false);
      return;
    }

    setIsSearching(true);
    setSearchResults([]);
    setHasSearched(true);
    setFilesSearched(0);
    setTotalFilesToSearch(0);

    const minLoaderTime = 300;
    const start = Date.now();

    try {
      const instance = await webcontainer;
      const commonOptions = {
        homeDir: WORK_DIR,
        includes: ['**/*.*'],
        excludes: ['**/node_modules/**', '**/package-lock.json', '**/.git/**', '**/dist/**', '**/*.lock', '**/.DS_Store', '**/*.svg'],
      };

      if (isFuzzyEnabled) {
        await performFuzzyFileSearch(instance, query, commonOptions, setSearchResults, setTotalFilesToSearch, setFilesSearched);
      } else {
        const textSearchOptions: Omit<TextSearchOptions, 'folders'> = {
          ...commonOptions,
          gitignore: true,
          requireGit: false,
          globalIgnoreFiles: true,
          ignoreSymlinks: false,
          resultLimit: 1000, // Increased limit slightly
          isRegex: isRegexEnabled,
          caseSensitive: false, // Could be another toggle
          isWordMatch: false,   // Could be another toggle
        };
        // performTextSearch will call its onProgress incrementally
        await performTextSearch(instance, query, textSearchOptions, (batch) => {
            setSearchResults(prev => [...prev, ...batch]); // Accumulate results for text search
        });
      }
    } catch (error) {
      console.error('Failed to initiate search:', error);
      setSearchResults([]);
    } finally {
      const elapsed = Date.now() - start;
      if (elapsed < minLoaderTime) {
        setTimeout(() => setIsSearching(false), minLoaderTime - elapsed);
      } else {
        setIsSearching(false);
      }
    }
  }, [isRegexEnabled, isFuzzyEnabled]); // query is handled by debouncedSearch

  const debouncedSearch = useCallback(debounce(handleSearch, 350), [handleSearch]);

  useEffect(() => {
    debouncedSearch(searchQuery);
  }, [searchQuery, debouncedSearch]);

  const handleResultClick = (filePath: string, line?: number) => {
    workbenchStore.setSelectedFile(filePath);
    const adjustedLine = typeof line === 'number' ? Math.max(0, line - 1) : undefined;
    workbenchStore.setCurrentDocumentScrollPosition({ line: adjustedLine, column: 0 });
  };

  return (
    <div className="flex flex-col h-full bg-bolt-elements-background-depth-2">
      <div className="flex items-center py-3 px-3">
        <div className="relative flex-1">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search files..."
            className="w-full px-2 py-1 rounded-md bg-bolt-elements-background-depth-3 text-bolt-elements-textPrimary placeholder-bolt-elements-textTertiary focus:outline-none transition-all"
          />
        </div>
        <label htmlFor="regex-search-toggle" title="Enable Regular Expression Search" className="ml-2 flex items-center text-sm text-bolt-elements-textSecondary cursor-pointer p-1 hover:bg-bolt-elements-background-depth-3 rounded">
          <input
            id="regex-search-toggle"
            type="checkbox"
            className="mr-1 h-3.5 w-3.5"
            checked={isRegexEnabled}
            onChange={e => {setIsRegexEnabled(e.target.checked); if (e.target.checked) setIsFuzzyEnabled(false);}}
            disabled={isFuzzyEnabled}
          />
          Regex
        </label>
        <label htmlFor="fuzzy-search-toggle" title="Enable Fuzzy Search" className="ml-2 flex items-center text-sm text-bolt-elements-textSecondary cursor-pointer p-1 hover:bg-bolt-elements-background-depth-3 rounded">
          <input
            id="fuzzy-search-toggle"
            type="checkbox"
            className="mr-1 h-3.5 w-3.5"
            checked={isFuzzyEnabled}
            onChange={e => {setIsFuzzyEnabled(e.target.checked); if (e.target.checked) setIsRegexEnabled(false);}}
            disabled={isRegexEnabled && !isFuzzyEnabled} // Disable fuzzy if regex is on, unless fuzzy is already on
          />
          Fuzzy
        </label>
      </div>

      {isSearching && isFuzzyEnabled && totalFilesToSearch > 0 && (
        <div className="px-3 pb-2 text-xs text-bolt-elements-textTertiary">
          Searching {filesSearched} / {totalFilesToSearch} files...
        </div>
      )}

      <div className="flex-1 overflow-auto py-2">
        {isSearching && !isFuzzyEnabled && ( // Show generic searching for non-fuzzy
          <div className="flex items-center justify-center h-32 text-bolt-elements-textTertiary">
            <div className="i-ph:circle-notch animate-spin mr-2" /> Searching...
          </div>
        )}
        {!isSearching && hasSearched && searchResults.length === 0 && searchQuery.trim() !== '' && (
          <div className="flex items-center justify-center h-32 text-gray-500">No results found.</div>
        )}
        {!isSearching &&
          Object.keys(groupedResults).map((file) => (
            <div key={file} className="mb-2">
              <button
                className="flex gap-2 items-center w-full text-left py-1 px-2 text-bolt-elements-textSecondary bg-transparent hover:bg-bolt-elements-background-depth-3 group"
                onClick={() => setExpandedFiles((prev) => ({ ...prev, [file]: !prev[file] }))}
              >
                <span
                  className=" i-ph:caret-down-thin w-3 h-3 text-bolt-elements-textSecondary transition-transform"
                  style={{ transform: expandedFiles[file] ? 'rotate(180deg)' : undefined }}
                />
                <span className="font-normal text-sm">{file.split('/').pop()}</span>
                <span className="h-5.5 w-5.5 flex items-center justify-center text-xs ml-auto bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded-full">
                  {groupedResults[file].length}
                </span>
              </button>
              {expandedFiles[file] && (
                <div className="">
                  {groupedResults[file].map((match, idx) => {
                    const contextChars = 30; // Increased context
                    const isStart = match.matchCharStart <= contextChars;
                    const previewStart = isStart ? 0 : match.matchCharStart - contextChars;
                    const previewText = match.previewText.slice(previewStart);
                    const matchHighlightStart = isStart ? match.matchCharStart : contextChars;
                    const matchHighlightEnd = matchHighlightStart + (match.matchCharEnd - match.matchCharStart);

                    return (
                      <div
                        key={idx}
                        className="hover:bg-bolt-elements-background-depth-3 cursor-pointer transition-colors pl-6 pr-2 py-1"
                        onClick={() => handleResultClick(match.path, match.lineNumber)}
                      >
                        <div className="text-xs text-bolt-elements-textTertiary truncate">
                          <span className="font-semibold">{match.lineNumber}:</span>
                          {!isStart && <span className="opacity-70">...</span>}
                          {previewText.slice(0, matchHighlightStart)}
                          <span className="bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent rounded px-0.5">
                            {previewText.slice(matchHighlightStart, matchHighlightEnd)}
                          </span>
                          {previewText.slice(matchHighlightEnd)}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
      </div>
    </div>
  );
}
