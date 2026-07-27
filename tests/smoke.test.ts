// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('token file', () => {
  const css = readFileSync('src/style/tokens.css', 'utf8');

  it('defines every ambient role', () => {
    for (const role of ['--amb-deep', '--amb-mid', '--amb-lift', '--amb-glow',
                        '--amb-accent', '--amb-ink', '--amb-ink-soft', '--amb-lum']) {
      expect(css).toContain(`${role}:`);
    }
  });

  it('never uses border-radius on a surface', () => {
    const components = readFileSync('src/style/components.css', 'utf8');
    expect(components).not.toContain('border-radius');
  });

  it('keeps colour literals out of the component stylesheet', () => {
    const components = readFileSync('src/style/components.css', 'utf8');
    const literals = components.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    // #fff and #000 inside color-mix are structural, not palette.
    const palette = literals.filter((c) => !['#fff', '#000'].includes(c.toLowerCase()));
    expect(palette).toEqual([]);
  });
});
