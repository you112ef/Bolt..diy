import { RemixBrowser } from '@remix-run/react';
import { startTransition } from 'react';
import { hydrateRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';

startTransition(() => {
  hydrateRoot(document.getElementById('root')!, <RemixBrowser />);
});

registerSW({ immediate: true });
