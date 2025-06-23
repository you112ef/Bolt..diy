import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
// import { WebContainer } from '@webcontainer/api'; // For actual implementation
// import Fuse from 'fuse.js'; // For actual fuzzy search

// This would need to be initialized and made available here, e.g. via a singleton or passed context
// let webContainerInstance: WebContainer;

interface ProjectSearchResultItemDTO {
  filePath: string;
  lineNumber?: number;
  lineContent?: string;
  matchIndices?: [number, number][];
  contextBefore?: string[];
  contextAfter?: string[];
  type: 'file_name' | 'content';
}

// MOCK IMPLEMENTATION - Replace with actual WebContainer file system traversal and search logic
async function searchProjectFiles(
  query: string,
  type: 'regex' | 'fuzzy'
  // wcInstance: WebContainer // Pass WebContainer instance here
): Promise<ProjectSearchResultItemDTO[]> {
  console.log(`API: Mock project search for "${query}" (type: ${type})`);
  await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API delay

  // Sample file structure and content for mock
  const mockFs = {
    'app/routes/index.tsx': [
      'import { Link } from "@remix-run/react";',
      'export default function Index() {',
      `  const message = "Welcome to ${query} Remix!";`,
      '  return <Link to="/about">About Us</Link>;',
      '}',
    ],
    'app/components/search/ProjectSearch.tsx': [
      'function ProjectSearchComponent() {',
      `  // TODO: Implement actual search for ${query}`,
      '  return <div>Search UI</div>;',
      '}',
    ],
    'README.md': [
      `# My ${query} Project`,
      'This project uses Remix and React.',
      'It demonstrates a simple setup.',
    ],
    'package.json': [
      '{',
      '  "name": "my-project",',
      `  "description": "A cool project about ${query}",`,
      '  "dependencies": { "@remix-run/react": "*" }',
      '}',
    ],
  };

  const results: ProjectSearchResultItemDTO[] = [];
  const MAX_RESULTS = 20;

  for (const filePath in mockFs) {
    if (results.length >= MAX_RESULTS) break;

    // File name match
    if (type === 'fuzzy' && filePath.toLowerCase().includes(query.toLowerCase())) {
      results.push({ filePath, type: 'file_name' });
    } else if (type === 'regex') {
      try {
        if (new RegExp(query, 'i').test(filePath)) {
          results.push({ filePath, type: 'file_name' });
        }
      } catch (e) { /* ignore invalid regex for filename */ }
    }

    if (results.length >= MAX_RESULTS) break;

    // Content match
    const lines = mockFs[filePath as keyof typeof mockFs];
    for (let i = 0; i < lines.length; i++) {
      if (results.length >= MAX_RESULTS) break;
      const line = lines[i];
      let match = false;
      let matchIndices: [number, number][] | undefined = undefined;

      if (type === 'fuzzy' && line.toLowerCase().includes(query.toLowerCase())) {
        match = true;
        const start = line.toLowerCase().indexOf(query.toLowerCase());
        if (start !== -1) matchIndices = [[start, start + query.length - 1]];
      } else if (type === 'regex') {
        try {
          const regex = new RegExp(query, 'gi');
          let regexMatch;
          if ((regexMatch = regex.exec(line)) !== null) {
            match = true;
            matchIndices = [[regexMatch.index, regexMatch.index + regexMatch[0].length -1]];
          }
        } catch (e) { /* ignore invalid regex for content */ }
      }

      if (match) {
        results.push({
          filePath,
          lineNumber: i + 1,
          lineContent: line,
          matchIndices,
          type: 'content',
          contextBefore: i > 0 ? [lines[i-1]] : [],
          contextAfter: i < lines.length - 1 ? [lines[i+1]] : [],
        });
      }
    }
  }
  return results;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get("q");
  const type = url.searchParams.get("type") as 'regex' | 'fuzzy' | null;

  if (!query) {
    return json({ error: "Search query (q) is missing" }, { status: 400 });
  }
  if (!type || (type !== 'regex' && type !== 'fuzzy')) {
    return json({ error: "Search type is missing or invalid (must be 'regex' or 'fuzzy')" }, { status: 400 });
  }

  // TODO: Get WebContainer instance here
  // if (!webContainerInstance) {
  //   return json({ error: "WebContainer not initialized" }, { status: 503 });
  // }

  try {
    const results = await searchProjectFiles(query, type /*, webContainerInstance */);
    return json(results);
  } catch (error: any) {
    console.error("Project search API error:", error);
    return json({ error: "Failed to execute project search.", details: error.message }, { status: 500 });
  }
}
