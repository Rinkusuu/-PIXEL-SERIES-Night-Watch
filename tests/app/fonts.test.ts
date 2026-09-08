import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync, statSync } from 'node:fs';

/**
 * The identity of this app is bitmap type. It ran on `ui-monospace` for its
 * whole life because these two files were never added and `font-display: swap`
 * degrades without complaining — no console error, no missing box, just the
 * wrong typeface forever.
 *
 * So the files are asserted to exist, and the CSS is asserted to point at them.
 * A silent failure needs a loud test.
 */
describe('the self-hosted faces', () => {
  const tokens = readFileSync('src/style/tokens.css', 'utf8');
  const faces = [...tokens.matchAll(/src:\s*url\('([^']+)'\)/g)].map((m) => m[1]!);

  it('declares both faces from a local path, never a CDN', () => {
    // A CDN font would be the app's only third-party request.
    expect(faces).toHaveLength(2);
    for (const f of faces) {
      expect(f.startsWith('/')).toBe(true);
      expect(f).not.toMatch(/^https?:/);
    }
  });

  it('ships every file the CSS asks for', () => {
    for (const f of faces) {
      const path = `public${f}`;
      expect(existsSync(path), `${path} is declared in tokens.css but missing`).toBe(true);
      // A zero-byte or truncated woff2 loads as an error just as a missing one
      // does, and looks identical from the outside.
      expect(statSync(path).size).toBeGreaterThan(1000);
    }
  });

  it('is a real woff2, not an HTML error page saved with the wrong name', () => {
    for (const f of faces) {
      const head = readFileSync(`public${f}`).subarray(0, 4).toString('latin1');
      expect(head, `public${f} is not woff2`).toBe('wOF2');
    }
  });

  it('carries the licence that lets it be redistributed', () => {
    expect(existsSync('public/fonts/OFL-press-start-2p.txt')).toBe(true);
    expect(existsSync('public/fonts/OFL-silkscreen.txt')).toBe(true);
  });
});
