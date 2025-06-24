import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const query = url.searchParams.get('q');

  if (!query) {
    return json({ error: 'Query parameter "q" is required' }, { status: 400 });
  }

  try {
    // Using a simple, publicly available endpoint from DuckDuckGo for text results (HTML format)
    // We will need to parse this on the client or find a JSON API if available and reliable
    // For now, we'll proxy the HTML and let the client handle it, or find a more suitable JSON API.
    // A more robust solution might involve a server-side HTML parser if a clean JSON API isn't available.

    // Let's try the DuckDuckGo HTML API first, as the JSON one can be unreliable or restricted.
    // We will fetch the HTML and the client can then decide how to parse/display it,
    // or we can attempt a very basic parse here.
    // The official JSON API (https://api.duckduckgo.com/?q=...&format=json) is often blocked for automated requests.

    // As an alternative, we can use a third-party service that proxies search results if direct access is problematic.
    // For simplicity in this step, we'll aim for a simple fetch.
    // If direct DDG access is problematic, this part might need a more robust solution (e.g. a dedicated search API key).

    // Let's try a non-official JSON endpoint which might be less restrictive for simple queries.
    // This is for demonstration; a production app should use an official, reliable API.
    const searchUrl = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&pretty=1&no_html=1&skip_disambig=1`;

    const response = await fetch(searchUrl, {
      headers: {
        // DuckDuckGo might block requests without a common user-agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`DuckDuckGo API error: ${response.status} ${response.statusText}`, errorText);
      return json({ error: `Failed to fetch search results from DuckDuckGo. Status: ${response.status}. ${errorText}` }, { status: response.status });
    }

    const data = await response.json();

    // We are interested in 'AbstractText', 'AbstractURL', and 'Heading' from RelatedTopics or a direct Abstract
    // The structure of DDG's JSON response can vary.
    let results = [];
    if (data.AbstractText) {
        results.push({
            title: data.Heading || query,
            snippet: data.AbstractText,
            url: data.AbstractURL || `https://duckduckgo.com/?q=${encodeURIComponent(query)}`
        });
    }

    if (data.RelatedTopics) {
        for (const topic of data.RelatedTopics) {
            if (topic.Result) { // For grouped results
                 // Extracting from HTML, which is not ideal.
                 // const match = topic.Result.match(/<a href="([^"]+)">([^<]+)<\/a>(.*)/);
                 // if (match) {
                 // results.push({ title: match[2], url: match[1], snippet: topic.Text || '' });
                 // }
            } else if (topic.Text && topic.FirstURL) { // For individual results
                results.push({ title: topic.Text, url: topic.FirstURL, snippet: topic.Text });
            }
        }
    }

    // A simple filter for "Results" array which is more common for general queries
    if (data.Results && Array.isArray(data.Results)) {
        results = data.Results.map((item: any) => ({
            title: item.Text || 'No title',
            snippet: item.FirstURL, // DDG JSON API often puts URL here for "Results"
            url: item.FirstURL
        }));
    }


    // If results are still empty, try to get some from "RelatedTopics" under "Topics" key (another DDG structure)
    if (results.length === 0 && data.RelatedTopics) {
        data.RelatedTopics.forEach((group: any) => {
            if (group.Name && group.Topics && Array.isArray(group.Topics)) {
                group.Topics.forEach((topic: any) => {
                    if (topic.FirstURL && topic.Text) {
                        results.push({
                            title: topic.Text,
                            snippet: topic.FirstURL, // Or some other field if available
                            url: topic.FirstURL,
                        });
                    }
                });
            } else if (group.FirstURL && group.Text) { // Ungrouped topic
                 results.push({
                    title: group.Text,
                    snippet: group.FirstURL,
                    url: group.FirstURL,
                });
            }
        });
    }


    return json({ results });

  } catch (error: any) {
    console.error('Error fetching from DuckDuckGo API:', error);
    return json({ error: 'Failed to fetch search results: ' + error.message }, { status: 500 });
  }
}
