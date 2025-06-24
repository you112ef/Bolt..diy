import type { LoaderFunctionArgs } from '@remix-run/cloudflare';
import { json } from '@remix-run/cloudflare';

// Basic function to strip HTML tags. This is very naive and won't handle all cases.
// A proper HTML parsing/text extraction library would be much better for robustness.
function stripHtml(html: string): string {
  // Remove script and style elements and their content
  let text = html.replace(/<script[^>]*>([\S\s]*?)<\/script>/gmi, '');
  text = text.replace(/<style[^>]*>([\S\s]*?)<\/style>/gmi, '');
  // Remove all HTML tags
  text = text.replace(/<\/?[^>]+(>|$)/g, '');
  // Replace multiple spaces with a single space
  text = text.replace(/\s+/g, ' ').trim();
  // Decode HTML entities (basic ones)
  text = text.replace(/&nbsp;/g, ' ');
  text = text.replace(/&amp;/g, '&');
  text = text.replace(/&lt;/g, '<');
  text = text.replace(/&gt;/g, '>');
  text = text.replace(/&quot;/g, '"');
  text = text.replace(/&#39;/g, "'");
  return text;
}

export async function loader({ request }: LoaderFunctionArgs) {
  const url = new URL(request.url);
  const pageUrl = url.searchParams.get('url');

  if (!pageUrl) {
    return json({ error: 'URL parameter "url" is required' }, { status: 400 });
  }

  let validUrl: URL;
  try {
    validUrl = new URL(pageUrl); // Validate and parse the URL
  } catch (_) {
    return json({ error: 'Invalid URL provided' }, { status: 400 });
  }

  try {
    const response = await fetch(validUrl.toString(), {
      headers: {
        // Mimic a browser User-Agent
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
      }
    });

    if (!response.ok) {
      return json({ error: `Failed to fetch URL. Status: ${response.status}` }, { status: response.status });
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('text/html')) {
      return json({ error: 'Fetched content is not HTML.' }, { status: 400 });
    }

    const htmlContent = await response.text();
    const extractedText = stripHtml(htmlContent);

    return json({
      originalUrl: validUrl.toString(),
      extractedText: extractedText.length > 50000 ? extractedText.substring(0, 50000) + '... (truncated)' : extractedText, // Truncate long texts
      title: validUrl.hostname // Basic title, can be improved by parsing <title> tag
    });

  } catch (error: any) {
    console.error('Error fetching or parsing page content:', error);
    return json({ error: 'Failed to fetch or parse page content: ' + error.message }, { status: 500 });
  }
}
