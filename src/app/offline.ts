/**
 * Register the service worker.
 *
 * This is the only reason Night Watch can be OPENED with no network. The app
 * itself never asks the network for anything once it is running — the world is
 * arithmetic and the ledger is localStorage — so an installed watch is a real
 * offline application, not a degraded one.
 *
 * Dev has no worker on purpose: a cache-first worker sitting in front of Vite's
 * HMR is a machine for serving you yesterday's code and making you doubt your
 * own eyes.
 */
export function initServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV) return;

  addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch((err: Error) => {
      // Not fatal, and not worth telling the watchman about. The app works; it
      // just will not survive a cold start with the network gone.
      console.warn('[watch] service worker did not register:', err.message);
    });
  });
}
