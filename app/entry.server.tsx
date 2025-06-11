import type { AppLoadContext } from '@remix-run/cloudflare';
import { RemixServer } from '@remix-run/react';
import { isbot } from 'isbot';
import { renderToReadableStream } from 'react-dom/server';
import { renderHeadToString } from 'remix-island';
import { Head } from './root';
import { themeStore } from '~/lib/stores/theme';

export default async function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  remixContext: any,
  _loadContext: AppLoadContext,
) {
  // await initializeModelList({});

  const readable = await renderToReadableStream(<RemixServer context={remixContext} url={request.url} />, {
    signal: request.signal,
    onError(error: unknown) {
      console.error(error);
      responseStatusCode = 500;
    },
  });

  const body = new ReadableStream({
    start(controller) {
      const head = renderHeadToString({ request, remixContext, Head });

      controller.enqueue(
        new Uint8Array(
          new TextEncoder().encode(
            `<!DOCTYPE html><html lang="en" data-theme="${themeStore.value}"><head>${head}</head><body><div id="root" class="w-full h-full">`,
          ),
        ),
      );

      const reader = readable.getReader();

      function read() {
        reader
          .read()
          .then(({ done, value }) => {
            if (done) {
              controller.enqueue(new Uint8Array(new TextEncoder().encode('</div></body></html>')));
              controller.close();

              return;
            }

            controller.enqueue(value);
            read();
          })
          .catch((error) => {
            controller.error(error);
            readable.cancel();
          });
      }
      read();
    },

    cancel() {
      readable.cancel();
    },
  });

  if (isbot(request.headers.get('user-agent') || '')) {
    await readable.allReady;
  }

  responseHeaders.set('Content-Type', 'text/html');

  // Existing COOP/COEP headers
  responseHeaders.set('Cross-Origin-Embedder-Policy', 'require-corp');
  responseHeaders.set('Cross-Origin-Opener-Policy', 'same-origin');

  // Add Content-Security-Policy
  const cspDirectives = [
    "default-src 'self'",
    // Vite's dev server and some Remix patterns might use inline scripts/styles.
    // For production, it's better to use hashes or nonces if possible, but 'unsafe-inline' is a common starting point.
    // The ?url imports for styles might also need to be considered for stricter policies.
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com", // Allow Google Fonts styles
    "font-src 'self' https://fonts.gstatic.com", // Allow Google Fonts
    "img-src 'self' data: https:", // Allow self, data URIs, and any HTTPS images (adjust if too broad)
    "object-src 'none'",
    "upgrade-insecure-requests",
    "block-all-mixed-content",
    // Add other directives as needed, e.g., connect-src for APIs
    // "connect-src 'self' https://api.example.com",
  ];
  // responseHeaders.set('Content-Security-Policy', cspDirectives.join('; ')); // Commented out to debug worker exception

  // Optional: Add HSTS if the site is confirmed to be fully HTTPS
  // responseHeaders.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');

  return new Response(body, {
    headers: responseHeaders,
    status: responseStatusCode,
  });
}
