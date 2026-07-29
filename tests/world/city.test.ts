import { describe, expect, it } from 'vitest';
import {
  FAR_SCALE, MIN_SPIRE_ASPECT, SPIRE_MAX_W, drawSkyline, skyline, skyline as gen,
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
   * Stroked details per kind, counted from the code. The hatch contributes
   * exactly one stroke at density 0.34 (it only crosses above 0.66), so the
   * expected total is that one plus the details.
   *
   * Before this pass the whole vocabulary carried two entries: chimney pots on
   * `flat` and a jib on `crane`. Everything else was a bare shape.
   */
  const DETAIL_STROKES: Record<ShapeKind, number> = {
    flat: 1,        // cornice
    gable: 2,       // ridge + dormer
    spire: 9,       // eight crockets + finial
    dome: 4,        // three ribs + lantern
    clockTower: 2,  // cornice band + hands
    factory: 3,     // two iron bands + capping ring
    crane: 2,       // jib + hook and tie
  };

  for (const kind of Object.keys(DETAIL_STROKES) as ShapeKind[]) {
    it(`strokes ${DETAIL_STROKES[kind]} details on a ${kind}`, () => {
      const c = countingCtx();
      drawSkyline(c.g, [{ kind, x: 40, w: 60, top: 100, stackX: 70 }], 460, style);
      expect(c.strokes()).toBe(1 + DETAIL_STROKES[kind]);
    });
  }

  it('leaves no shape bare', () => {
    for (const n of Object.values(DETAIL_STROKES)) expect(n).toBeGreaterThan(0);
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
