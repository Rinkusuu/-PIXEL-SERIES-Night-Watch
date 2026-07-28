import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('the panels sit on the parapet', () => {
  const base = readFileSync('src/style/base.css', 'utf8');
  const components = readFileSync('src/style/components.css', 'utf8');
  const watch = readFileSync('src/panels/TheWatch.tsx', 'utf8');

  it('docks the chrome to the bottom of the frame', () => {
    expect(base).toContain('justify-content: flex-end');
  });

  it('keeps all three panels in one row, or the deck swallows the river', () => {
    expect(watch).not.toContain('row-2');
  });

  it('bounds the quarry list so it cannot push the parapet off screen', () => {
    expect(components).toContain('.list--scroll');
    expect(components).toContain('overflow-y: auto');
  });
});
