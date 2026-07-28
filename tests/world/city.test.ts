import { describe, expect, it } from 'vitest';
import { MIN_SPIRE_ASPECT, SPIRE_MAX_W, skyline, skyline as gen } from '../../src/world/city';

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

describe('gothic verticality', () => {
  const blocks = gen(1400, 100, 460, 17);

  it('makes every spire taller than it is wide, well past square', () => {
    // A spire as wide as it is tall is a tent. The reference's towers are needles.
    // Measured against the SHAFT, not the slot: the massing caps a tower's shaft
    // at SPIRE_MAX_W however wide a slot the cursor happened to draw for it.
    for (const b of blocks.filter((v) => v.kind === 'spire' || v.kind === 'clockTower')) {
      const shaft = Math.min(b.w, SPIRE_MAX_W);
      expect((460 - b.top) / shaft, `${b.kind} at x=${b.x}`)
        .toBeGreaterThanOrEqual(MIN_SPIRE_ASPECT);
    }
  });

  it('clusters towers into districts instead of sprinkling them evenly', () => {
    const idx = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.kind === 'spire')
      .map(({ i }) => i);
    // At least one adjacent pair — a city has tower districts, not one tower
    // every other block.
    const adjacent = idx.some((v, k) => k > 0 && v - idx[k - 1]! === 1);
    expect(adjacent).toBe(true);
  });

  it('is still deterministic after the change', () => {
    expect(gen(1400, 100, 460, 17)).toEqual(gen(1400, 100, 460, 17));
  });
});
