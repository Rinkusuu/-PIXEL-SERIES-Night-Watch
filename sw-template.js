/* ============================================================================
   sw-template.js — the service worker, before the build fills in the blanks.

   `__PRECACHE__` below is replaced at build time by vite.config.ts with the
   real, content-hashed asset list. Writing `index-abc123.js` in here by hand
   would be a lie that survives exactly one build.

   This app is SIMPLER than the dashboard next door, and the worker is allowed
   to be simpler with it: Night Watch makes no network requests at all. There is
   no weather to go stale, no API whose silence has to be explained. Everything
   the app knows it wrote to localStorage itself, and everything it draws it
   draws from arithmetic. So there is one strategy here, not two:

     · THE SHELL (html, js, css, fonts, icons) — cache-first. Every chunk is
       content-hashed, so a cached copy can never be stale: if the content
       changed, the filename changed, and the new name is not in the old cache.

   The fonts matter more here than they look. They live in `public/`, so they
   are copied verbatim rather than emitted into the bundle, which means they do
   NOT appear in the asset list the plugin reads — they have to be named. And
   `font-display: swap` fails silently: a watch that boots offline without them
   does not throw, it just quietly stops being pixel type.
   ========================================================================== */

const VERSION = '__VERSION__';
const SHELL = `nightwatch-shell-${VERSION}`;

const PRECACHE = __PRECACHE__;

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches
      .open(SHELL)
      .then((c) => c.addAll(PRECACHE))
      // Take over at once. The alternative is waiting for every tab to close,
      // and the one thing we know about this app's tabs is that they are left
      // open for fifty minutes at a time.
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith('nightwatch-shell-') && k !== SHELL)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  if (new URL(req.url).origin !== self.location.origin) return;

  // `ignoreVary` is not a nicety. A static host may answer with `Vary: Origin`
  // — Vite's own preview server does — and `caches.match` honours Vary, so a
  // stored response is only handed back when the new request's Origin header
  // matches the one `addAll` sent. It does not: `addAll` fetches with no Origin
  // and the page's own subresource requests carry one. The shell was in the
  // cache and the browser still refused it, and every script and stylesheet
  // fell through to a fetch that could not happen. Offline the app booted to a
  // blank page with the right title.
  //
  // Vary means nothing here anyway. Every shell file is content-hashed, so the
  // URL alone determines the bytes; there is no second representation to pick.
  e.respondWith(
    caches.match(req, { ignoreVary: true }).then((hit) => {
      if (hit) return hit;

      return fetch(req)
        .then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(SHELL).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => {
          /* A reload while offline still has to produce a page. Without this a
             hard refresh mid-watch shows the browser's own error page — and the
             watch it interrupted is recoverable only because the app gets to
             run and read what it stored. */
          if (req.mode === 'navigate') return caches.match('/index.html', { ignoreVary: true });
          return new Response('', { status: 504 });
        });
    }),
  );
});
