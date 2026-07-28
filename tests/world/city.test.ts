import { describe, expect, it } from 'vitest';
import { skyline } from '../../src/world/city';

describe('skyline', () => {
  const blocks = skyline(1200, 100, 400, 91);

  it('covers the full width with no gap and no overlap', () => {
    let x = 0;
    for (const b of blocks) {
      expect(b.x).toBe(x);
      x += b.w;
    }
    expect(x).toBeGreaterThanOrEqual(1200);
  });

  it('varies width, so the skyline is not a bar chart', () => {
    const widths = new Set(blocks.map((b) => b.w));
    expect(widths.size).toBeGreaterThan(4);
  });

  it('places exactly one clock tower — a landmark is only a landmark once', () => {
    expect(blocks.filter((b) => b.kind === 'clockTower')).toHaveLength(1);
  });

  it('always gives the smoke somewhere to come from', () => {
    const factories = blocks.filter((b) => b.kind === 'factory');
    expect(factories.length).toBeGreaterThanOrEqual(1);
    for (const f of factories) {
      expect(f.stackX).toBeGreaterThanOrEqual(f.x);
      expect(f.stackX).toBeLessThanOrEqual(f.x + f.w);
    }
  });

  it('keeps every roof inside its band', () => {
    for (const b of blocks) {
      expect(b.top).toBeGreaterThanOrEqual(100);
      expect(b.top).toBeLessThan(400);
    }
  });

  it('is deterministic for a given seed and size', () => {
    expect(skyline(1200, 100, 400, 91)).toEqual(skyline(1200, 100, 400, 91));
  });

  it('produces a different city for a different seed', () => {
    const other = skyline(1200, 100, 400, 92);
    expect(other.map((b) => b.kind).join()).not.toBe(blocks.map((b) => b.kind).join());
  });
});
