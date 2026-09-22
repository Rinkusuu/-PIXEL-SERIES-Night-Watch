import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PUBLIC_SHELL } from '../../vite.config';

const template = readFileSync('sw-template.js', 'utf8');

/** Every file under public/ that the browser actually asks for. */
function servedFiles(dir = 'public', prefix = ''): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory()
      ? servedFiles(join(dir, e.name), `${prefix}/${e.name}`)
      : /\.(woff2|svg|webmanifest|png)$/.test(e.name)
        ? [`${prefix}/${e.name}`]
        : [],
  );
}

describe('the offline shell', () => {
  /**
   * The failure this guards is silent. A font left out of the precache does not
   * throw offline — `font-display: swap` falls back to a system face and the
   * watch simply stops being pixel type, with nothing in the console.
   */
  it('names every file the build copies out of public/', () => {
    expect([...PUBLIC_SHELL].sort()).toEqual(servedFiles().sort());
  });

  it('precaches every font the stylesheet asks for', () => {
    const css = readFileSync('src/style/tokens.css', 'utf8');
    const urls = [...css.matchAll(/url\('([^']+)'\)/g)].map((m) => m[1]!);
    expect(urls.length).toBeGreaterThan(0);
    for (const u of urls) expect(PUBLIC_SHELL).toContain(u);
  });
});

describe('the service worker template', () => {
  /**
   * Both tokens must exist for the build to have anything to replace, and
   * `__PRECACHE__` appears more than once because the doc comment names it.
   * That second occurrence is the whole reason the plugin uses `replaceAll`: a
   * plain `replace` would substitute into the COMMENT, leave the real token
   * standing, and ship a worker that throws a ReferenceError on every install.
   */
  it('carries both build tokens, with __PRECACHE__ named twice', () => {
    expect(template.split('__PRECACHE__').length - 1).toBeGreaterThan(1);
    expect(template).toContain('__VERSION__');
  });

  it('serves the shell when a navigation misses the cache', () => {
    expect(template).toContain("req.mode === 'navigate'");
  });

  /**
   * Found by unplugging the server rather than by reading the code: a host that
   * answers `Vary: Origin` makes every `caches.match` miss, because `addAll`
   * stored the response without an Origin header and the page's subresource
   * requests send one. The files were all in the cache and the app still booted
   * blank. Every lookup here has to ignore Vary.
   */
  it('ignores Vary on every cache lookup', () => {
    const lookups = template.match(/caches\.match\(/g) ?? [];
    expect(lookups.length).toBeGreaterThan(1);
    expect(template.match(/ignoreVary: true/g) ?? []).toHaveLength(lookups.length);
  });

  /** Old shells go; nothing else does. The ledger lives in localStorage. */
  it('only ever deletes its own old caches', () => {
    expect(template).toMatch(/startsWith\('nightwatch-shell-'\) && k !== SHELL/);
  });
});
