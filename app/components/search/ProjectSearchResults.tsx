import React from 'react';

export interface ProjectSearchResultItem {
  filePath: string;
  lineNumber?: number; // For content matches
  lineContent?: string; // The actual line content with the match
  matchIndices?: [number, number][]; // For highlighting fuzzy matches, [start, end]
  contextBefore?: string[]; // Lines before the match
  contextAfter?: string[]; // Lines after the match
  type: 'file_name' | 'content';
}

interface ProjectSearchResultsProps {
  results: ProjectSearchResultItem[];
  loading: boolean;
  onResultClick: (filePath: string, lineNumber?: number) => void;
  searchQuery?: string; // To help with highlighting
  searchType?: 'regex' | 'fuzzy';
}

// Helper to highlight matches in a string
const HighlightedText: React.FC<{ text: string; query?: string; type?: 'regex' | 'fuzzy'; indices?: [number, number][] }> = ({ text, query, type, indices }) => {
  if (!text) return null;

  if (type === 'fuzzy' && indices && indices.length > 0) {
    let lastIndex = 0;
    const parts = [];
    indices.forEach(([start, end], i) => {
      if (start > lastIndex) {
        parts.push(<span key={`text-${i}-pre`}>{text.substring(lastIndex, start)}</span>);
      }
      parts.push(<mark key={`mark-${i}`} className="bg-yellow-300 dark:bg-yellow-700 px-0.5 rounded">{text.substring(start, end + 1)}</mark>);
      lastIndex = end + 1;
    });
    if (lastIndex < text.length) {
      parts.push(<span key="text-post">{text.substring(lastIndex)}</span>);
    }
    return <>{parts}</>;
  } else if (type === 'regex' && query) {
    try {
      const regex = new RegExp(`(${query})`, 'gi');
      const parts = text.split(regex);
      return (
        <>
          {parts.map((part, i) =>
            regex.test(part) && part.toLowerCase() === query.toLowerCase() ? ( // Check if it's the actual query match part
              <mark key={i} className="bg-yellow-300 dark:bg-yellow-700 px-0.5 rounded">{part}</mark>
            ) : (
              part
            )
          )}
        </>
      );
    } catch (e) {
      // Invalid regex, return text as is
      return <>{text}</>;
    }
  }
  return <>{text}</>;
};


export default function ProjectSearchResults({ results, loading, onResultClick, searchQuery, searchType }: ProjectSearchResultsProps) {
  if (loading) {
    return (
      <div className="p-4 text-center text-bolt-theme-textSecondary">
        Searching project files...
      </div>
    );
  }

  if (!results.length) {
    return (
      <div className="p-4 text-center text-bolt-theme-textSecondary">
        No matches found in the project.
      </div>
    );
  }

  return (
    <div className="space-y-3 mt-4">
      {results.map((item, index) => (
        <div
          key={`${item.filePath}-${item.lineNumber || index}`}
          className="p-3 bg-white dark:bg-bolt-theme-surface rounded-lg shadow hover:shadow-md transition-shadow cursor-pointer"
          onClick={() => onResultClick(item.filePath, item.lineNumber)}
        >
          <h4 className="text-sm font-semibold text-bolt-theme-primary hover:underline break-all">
            <HighlightedText text={item.filePath} query={searchQuery} type={searchType} />
            {item.lineNumber && <span className="text-xs text-bolt-theme-textSecondary ml-2">:L{item.lineNumber}</span>}
          </h4>
          {item.type === 'content' && item.lineContent && (
            <pre className="mt-1.5 text-xs text-bolt-theme-textSecondary bg-gray-100 dark:bg-gray-800 p-2 rounded overflow-x-auto whitespace-pre-wrap break-words">
              {item.contextBefore?.map((line, i) => (
                <div key={`ctx-b-${i}`} className="opacity-70">
                  <span className="select-none mr-2">{item.lineNumber! - item.contextBefore!.length + i}.</span>
                  {line}
                </div>
              ))}
              <div className="text-bolt-theme-textPrimary dark:text-bolt-theme-text">
                 <span className="select-none mr-2">{item.lineNumber}.</span>
                 <HighlightedText text={item.lineContent} query={searchQuery} type={searchType} indices={item.matchIndices} />
              </div>
              {item.contextAfter?.map((line, i) => (
                <div key={`ctx-a-${i}`} className="opacity-70">
                  <span className="select-none mr-2">{item.lineNumber! + 1 + i}.</span>
                  {line}
                </div>
              ))}
            </pre>
          )}
           {item.type === 'file_name' && !item.lineContent && (
             <p className="text-xs text-bolt-theme-textSecondary mt-1 italic">Matched file name.</p>
           )}
        </div>
      ))}
    </div>
  );
}
