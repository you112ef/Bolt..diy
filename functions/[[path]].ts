import type { ServerBuild, AppLoadContext } from '@remix-run/cloudflare';
import { createPagesFunctionHandler, logDevReady } from '@remix-run/cloudflare-pages';
import { ambientale } from 'ambientale';

// @ts-ignore
if (process.env.NODE_ENV === 'development') {
  logDevReady({ assetsPort: 8002 });
}

// Define the types for your same.new API functions
interface SameNewSearchParams {
  query: string;
  num_results?: number; // Optional, default is 10
  similarity_threshold?: number; // Optional, default is 0.7
  // Add other params as needed
}

interface SameNewScrapeParams {
  url: string;
  // Add other params as needed
}

interface SameNewRunTerminalParams {
  command: string;
  // Add other params as needed
}

// Environment variables expected by same.new (if any, for auth etc.)
interface SameNewEnv {
  SAME_NEW_API_KEY?: string; // Example
}

// Helper function to call same.new API
async function callSameNewAPI(endpoint: string, params: any, env: SameNewEnv) {
  const apiUrl = `https://same.new/api/${endpoint}`; // Adjust if the base URL is different
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      // Add Authorization header if SAME_NEW_API_KEY is used
      ...(env.SAME_NEW_API_KEY ? { 'Authorization': `Bearer ${env.SAME_NEW_API_KEY}` } : {}),
    },
    body: JSON.stringify(params),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`same.new API error (${response.status}): ${errorText}`);
  }
  return response.json();
}


export const onRequest: PagesFunction<SameNewEnv> = async (context) => {
  const serverBuild = (await import('../build/server')) as unknown as ServerBuild;

  // Enhance context with same.new functions
  const enhancedContext: AppLoadContext = {
    ...context.env, // Pass through existing environment variables
    sameNew: {
      webSearch: async (params: SameNewSearchParams) => {
        // Note: same.new might have different endpoint names or parameter structures.
        // This is a generic example. Adjust 'web_search' and params as per actual API.
        return callSameNewAPI('web_search', params, context.env);
      },
      webScrape: async (params: SameNewScrapeParams) => {
        return callSameNewAPI('web_scrape', params, context.env);
      },
      runTerminalCmd: async (params: SameNewRunTerminalParams) => {
        // This might interact with a different part of same.new or your own backend
        // if same.new doesn't directly offer sandboxed terminal execution via API.
        // For this example, assuming a hypothetical 'run_terminal_cmd' endpoint.
        return callSameNewAPI('run_terminal_cmd', params, context.env);
      },
    },
  };


  const handler = createPagesFunctionHandler({
    build: serverBuild,
    getLoadContext: () => enhancedContext, // Provide the enhanced context
    mode: process.env.NODE_ENV,
  });

  return handler(context);
};
