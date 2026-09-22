import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

const here = fileURLToPath(new URL('.', import.meta.url));

/**
 * Files that are copied out of `public/` rather than emitted into the bundle,
 * and so are invisible to `generateBundle`. They have to be named.
 *
 * Kept next to the plugin and guarded by a test, because the failure is silent:
 * a missing font does not throw, it falls back to a system face, and the app
 * boots offline looking subtly wrong with nothing in the console to say why.
 */
export const PUBLIC_SHELL = [
  '/manifest.webmanifest',
  '/icon.svg',
  '/icon-maskable.svg',
  '/fonts/press-start-2p-latin.woff2',
  '/fonts/silkscreen-latin.woff2',
];

/**
 * Emit the service worker with the REAL asset list baked in.
 *
 * Vite content-hashes every chunk, so the precache list can only be known once
 * the bundle exists — which is why this runs in `generateBundle` and not from a
 * checked-in constant.
 *
 * `order: 'post'` is load-bearing. Vite's own CSS plugin adds the stylesheet to
 * the bundle in ITS `generateBundle`, and hooks run in registration order, so a
 * plain hook here reads the bundle before the CSS is in it and precaches
 * everything except the styles — an app that boots offline with all its words
 * and none of its world.
 */
function serviceWorker() {
  return {
    name: 'nightwatch-service-worker',
    apply: 'build' as const,

    generateBundle: {
      order: 'post' as const,
      handler(_options: unknown, bundle: Record<string, unknown>) {
        const assets = Object.keys(bundle).map((f) => `/${f}`);
        const precache = ['/', '/index.html', ...PUBLIC_SHELL, ...assets];
        const version = Date.now().toString(36);

        // `replaceAll`, not `replace`: the template's own comment names
        // `__PRECACHE__`, and a string pattern substitutes the FIRST match only
        // — which would inject the asset list into the comment and ship the
        // real token untouched, throwing a ReferenceError on every install.
        const sw = readFileSync(resolve(here, 'sw-template.js'), 'utf8')
          .replaceAll('__PRECACHE__', JSON.stringify([...new Set(precache)], null, 2))
          .replaceAll('__VERSION__', version);

        // @ts-expect-error — `this` is Rollup's plugin context.
        this.emitFile({ type: 'asset', fileName: 'sw.js', source: sw });
      },
    },
  };
}

export default defineConfig({
  plugins: [react(), serviceWorker()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
