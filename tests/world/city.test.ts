import { describe, expect, it } from 'vitest';
import {
  FAR_SCALE, MIN_SPIRE_ASPECT, SPIRE_MAX_W, drawSkyline, openings, setbackOf,
  skyline, skyline as gen,
  type ShapeKind,
} from '../../src/world/city';
import { countingCtx } from '../helpers/counting-ctx';

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

describe('every shape carries its own detail', () => {
  const style = {
    angle: -0.42, fill: '#222', ink: '#000', density: 0.34,
    openings: false, details: true,
  };

  /**
   * Detail BLOCKS per kind, counted from the code. Nothing strokes any more —
   * a one-pixel line is what stopped this reading as pixel art, so every
   * detail is a filled rect and these are fillRect counts.
   */
  const DETAIL_BLOCKS: Record<ShapeKind, number> = {
    flat: 6,        // three pots + tank + tank lid + cornice
    gable: 3,       // dormer face, its ridge, its window
    spire: 2,       // finial shaft and collar
    dome: 4,        // lantern, its lid, its spike, springing band
    clockTower: 3,  // cornice band + two hands
    factory: 3,     // two iron bands + capping ring
    crane: 9,       // mast + seven jib segments + hook
    gap: 0,         // nothing stands here; the slot is sky
  };

  for (const kind of Object.keys(DETAIL_BLOCKS) as ShapeKind[]) {
    it(`blocks ${DETAIL_BLOCKS[kind]} details on a ${kind}`, () => {
      let rects = 0;
      const g = new Proxy({} as CanvasRenderingContext2D, {
        get(_t, key) {
          if (key === 'fillRect') return () => { rects++; };
          if (key === 'createLinearGradient' || key === 'createRadialGradient') {
            return () => ({ addColorStop: () => {} });
          }
          return () => {};
        },
        set: () => true,
      });
      drawSkyline(g, [{ kind, x: 40, w: 60, top: 100, stackX: 70 }], 460, style);
      expect(rects).toBe(DETAIL_BLOCKS[kind]);
    });
  }

  it('never strokes a line anywhere in the city', () => {
    // This is the whole of the pixel look at the drawing level: one-pixel
    // strokes are what read as scratches over the silhouettes.
    const c = countingCtx();
    drawSkyline(c.g, skyline(1400, 100, 460, 17), 460, style);
    expect(c.strokes()).toBe(0);
  });

  it('leaves no shape that stands there bare', () => {
    for (const [kind, n] of Object.entries(DETAIL_BLOCKS)) {
      if (kind === 'gap') continue;
      expect(n, kind).toBeGreaterThan(0);
    }
  });
});

describe('gaps let the sky through', () => {
  const seeds = [17, 91, 404, 9182, 31];

  it('leaves some slots empty', () => {
    // A skyline that runs contiguous from edge to edge reads as one blocked-off
    // mass. In the near band a gap shows the far band through it.
    for (const seed of seeds) {
      const blocks = skyline(1400, 100, 460, seed);
      expect(blocks.some((b) => b.kind === 'gap'), `seed ${seed}`).toBe(true);
    }
  });

  it('never puts two gaps side by side', () => {
    // Two in a row is one wide hole, and the band turns into a picket fence.
    for (const seed of seeds) {
      const blocks = skyline(1400, 100, 460, seed);
      for (let i = 1; i < blocks.length; i++) {
        expect(
          blocks[i]!.kind === 'gap' && blocks[i - 1]!.kind === 'gap',
          `seed ${seed} at ${i}`,
        ).toBe(false);
      }
    }
  });

  it('keeps gaps narrow — an alley, not a square', () => {
    for (const seed of seeds) {
      for (const b of skyline(1400, 100, 460, seed).filter((v) => v.kind === 'gap')) {
        expect(b.w).toBeLessThanOrEqual(Math.round(18 * 1.4));
      }
    }
  });

  it('still covers the full width, gaps and all', () => {
    for (const seed of seeds) {
      let x = 0;
      const blocks = skyline(1400, 100, 460, seed);
      for (const b of blocks) { expect(b.x).toBe(x); x += b.w; }
      expect(x).toBeGreaterThanOrEqual(1400);
    }
  });

  it('still guarantees a clock tower and a chimney', () => {
    // Smoke needs somewhere to come from, and a landmark is still a landmark.
    for (const seed of seeds) {
      const blocks = skyline(1400, 100, 460, seed);
      expect(blocks.filter((b) => b.kind === 'clockTower')).toHaveLength(1);
      expect(blocks.some((b) => b.kind === 'factory')).toBe(true);
    }
  });

  it('gives a gap no windows to light', () => {
    for (const b of skyline(1400, 100, 460, 17).filter((v) => v.kind === 'gap')) {
      expect(openings(b, 460)).toEqual([]);
    }
  });
});

describe('setbacks', () => {
  it('steps a wide box in, and leaves a narrow one alone', () => {
    const wide = { kind: 'flat' as const, x: 0, w: 80, top: 100 };
    const narrow = { kind: 'flat' as const, x: 0, w: 30, top: 100 };
    expect(setbackOf(wide, 460)).not.toBeNull();
    expect(setbackOf(narrow, 460)).toBeNull();
  });

  it('never steps anything but a box', () => {
    for (const kind of ['spire', 'dome', 'gable', 'factory', 'crane', 'gap'] as const) {
      // A needle spire that juts out halfway up is a construction fault, not
      // variety.
      expect(setbackOf({ kind, x: 0, w: 80, top: 100 }, 460), kind).toBeNull();
    }
  });

  it('keeps the upper windows on the upper mass', () => {
    // The massing and openings() read the SAME setback. Computed twice and the
    // top storeys hang off the shoulder in mid-air.
    const b = { kind: 'flat' as const, x: 200, w: 80, top: 100 };
    const sb = setbackOf(b, 460)!;
    for (const o of openings(b, 460)) {
      if (o.y + o.h <= sb.shoulder) {
        expect(o.x).toBeGreaterThanOrEqual(b.x + sb.inset);
        expect(o.x + o.w).toBeLessThanOrEqual(b.x + b.w - sb.inset);
      }
    }
  });

  it('still puts every opening inside the block', () => {
    for (const seed of [17, 91, 404]) {
      for (const b of skyline(1400, 100, 460, seed)) {
        for (const o of openings(b, 460)) {
          expect(o.x).toBeGreaterThanOrEqual(b.x);
          expect(o.x + o.w).toBeLessThanOrEqual(b.x + b.w);
        }
      }
    }
  });
});

describe('aerial perspective', () => {
  it('packs more, narrower buildings into the far band', () => {
    // Distance does not just fade a skyline, it multiplies it. An opening at
    // twelve pixels wide is a smudge, so density is all the far band gets.
    const near = skyline(1400, 100, 460, 17, 1);
    const far = skyline(1400, 100, 460, 17, FAR_SCALE);
    expect(far.length).toBeGreaterThan(near.length);
  });

  it('still covers the full width with no gap and no overlap at either scale', () => {
    for (const scale of [1, FAR_SCALE]) {
      let x = 0;
      for (const b of skyline(1400, 100, 460, 17, scale)) {
        expect(b.x, `scale ${scale}`).toBe(x);
        x += b.w;
      }
      expect(x).toBeGreaterThanOrEqual(1400);
    }
  });

  it('keeps the spire aspect guarantee at the small scale', () => {
    for (const b of skyline(1400, 100, 460, 17, FAR_SCALE)) {
      if (b.kind !== 'spire' && b.kind !== 'clockTower') continue;
      expect((460 - b.top) / Math.min(b.w, SPIRE_MAX_W))
        .toBeGreaterThanOrEqual(MIN_SPIRE_ASPECT);
    }
  });

  it('is still deterministic per scale', () => {
    expect(skyline(1400, 100, 460, 17, FAR_SCALE))
      .toEqual(skyline(1400, 100, 460, 17, FAR_SCALE));
  });
});
