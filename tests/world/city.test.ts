import { describe, expect, it } from 'vitest';
import {
  FAR_SCALE, MIN_SPIRE_ASPECT, SPIRE_MAX_W, drawSkyline, openings, setbackOf,
  skyline, skyline as gen,
  type ShapeKind,
  LANDMARK_X, towerOf,
} from '../../src/world/city';
import { countingCtx } from '../helpers/counting-ctx';

describe('skyline', () => {
  // With a landmark ceiling: the near band is the one that carries the tower.
  const blocks = skyline(1200, 100, 400, 91, 1, 55);

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

  it('keeps every roof inside its band, except the one that is meant to break it', () => {
    for (const b of blocks) {
      // The landmark has a ceiling of its own, ABOVE the band, and that margin
      // is the whole reason the eye can find it. Everything else stays in.
      if (b.kind === 'clockTower') {
        expect(b.top).toBeLessThan(100);
        continue;
      }
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
    angle: -0.42, fill: '#222', ink: '#000', lit: '#333', shade: '#111', density: 0.34,
    openings: false, details: true,
  };

  /**
   * Detail BLOCKS per kind, counted from the code. Nothing strokes any more —
   * a one-pixel line is what stopped this reading as pixel art, so every
   * detail is a filled rect and these are fillRect counts.
   */
  // Every kind also carries ONE shadow-side band, painted clipped to the
  // silhouette before the details — it is in each count below.
  // Not `Record<ShapeKind, number>`: `flat` is covered separately, below.
  const DETAIL_BLOCKS: Partial<Record<ShapeKind, number>> = {
    // `flat` is deliberately absent: its count is no longer fixed. A flat roof
    // now picks one of four characters from its own x and a tall one also gets
    // a fire escape, so the number varies by design — which is the point, since
    // forty identical rooflines was a lot of objects carrying one fact. It is
    // covered by its own test below instead.
    gable: 8,       // shade + three shingle courses + dormer face, lid, window + eaves
    spire: 9,       // shade + six crockets + cross shaft and arm
    dome: 10,       // shade + lantern, lid, spike + four ribs + band and its lip
    clockTower: 14, // shade + three cornices, each a band and a lip
                    // + two pinnacles, each a shaft and a cap + two hands + finial
    factory: 7,     // shade + two iron bands + cap + eaves band and lip + plinth
    crane: 10,      // shade + mast + seven jib segments + hook
    gap: 0,         // nothing stands here; the slot is sky
  };

  for (const [kind, want] of Object.entries(DETAIL_BLOCKS) as [ShapeKind, number][]) {
    it(`blocks ${want} details on a ${kind}`, () => {
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
      expect(rects).toBe(want);
    });
  }

  it('gives a flat roof a different character depending on where it stands', () => {
    // Four characters, chosen from the block's x. Two blocks far enough apart
    // must not come out identical, or the variety is not reaching the picture.
    const count = (x: number, top = 100) => {
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
      drawSkyline(g, [{ kind: 'flat', x, w: 60, top }], 460, style);
      return rects;
    };
    const seen = new Set([0, 37, 91, 140, 213, 288, 355, 420].map((x) => count(x)));
    expect(seen.size, 'every roof came out the same').toBeGreaterThan(1);
  });

  it('never leaves a flat roof bare, whichever character it drew', () => {
    for (const x of [0, 37, 91, 140, 213, 288, 355, 420]) {
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
      drawSkyline(g, [{ kind: 'flat', x, w: 60, top: 100 }], 460, style);
      expect(rects, `x=${x}`).toBeGreaterThan(5);
    }
  });

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
      // The near band is the one that carries the landmark, so it is the one
      // this guarantee is about — the bands behind get none by design.
      const blocks = skyline(1400, 100, 460, seed, 1, 55);
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

describe('the landmark', () => {
  const W = 1440;
  const TOP = 100;
  const BOT = 400;
  const LM = 55;

  it('stands where it was put, not where a wide block happened to fall', () => {
    // It used to go on whichever block came out widest, so the one thing the
    // eye is meant to find moved every seed. Across many seeds it must now land
    // near the same place.
    for (const seed of [3, 17, 91, 404, 1234, 90210]) {
      const blocks = skyline(W, TOP, BOT, seed, 1, LM);
      const t = blocks.find((b) => b.kind === 'clockTower');
      expect(t, `seed ${seed}`).toBeDefined();
      const cx = t!.x + t!.w / 2;
      // Within a block's width of the target, which is as close as a cursor
      // walking random widths can be asked to come.
      expect(Math.abs(cx - W * LANDMARK_X), `seed ${seed}`).toBeLessThan(90);
    }
  });

  it('is the tallest thing in the band, by a margin nothing else can reach', () => {
    for (const seed of [3, 17, 91, 404]) {
      const blocks = skyline(W, TOP, BOT, seed, 1, LM);
      const t = blocks.find((b) => b.kind === 'clockTower')!;
      const others = blocks.filter((b) => b !== t && b.kind !== 'gap');
      expect(t.top).toBe(LM);
      for (const b of others) expect(b.top, `seed ${seed}`).toBeGreaterThan(t.top);
    }
  });

  it('never appears in a band behind, where it would be a pair and not a hero', () => {
    for (const seed of [3, 17, 91, 404]) {
      const far = skyline(W, TOP, BOT, seed, FAR_SCALE);
      expect(far.some((b) => b.kind === 'clockTower'), `seed ${seed}`).toBe(false);
    }
  });

  it('keeps the cursor covering the width exactly, tower and all', () => {
    // The tower converts an existing block rather than inserting one, because
    // every later block's `x` is the running sum of the widths before it.
    const blocks = skyline(W, TOP, BOT, 77, 1, LM);
    let sum = 0;
    for (const b of blocks) {
      expect(b.x).toBe(sum);
      sum += b.w;
    }
    expect(sum).toBeGreaterThanOrEqual(W);
  });

  it('lands its clock face and louvres on the stages the massing drew', () => {
    const b = { kind: 'clockTower' as const, x: 200, w: 44, top: LM };
    const t = towerOf(b, BOT);
    const os = openings(b, BOT);
    const face = os.find((o) => o.kind === 'clock')!;
    expect(face.y).toBeGreaterThanOrEqual(t.stageTop);
    expect(face.y + face.h).toBeLessThanOrEqual(t.stageBot);
    for (const l of os.filter((o) => o.kind === 'louvre')) {
      expect(l.y).toBeGreaterThanOrEqual(t.belfryTop);
      expect(l.y + l.h).toBeLessThanOrEqual(t.belfryBot);
      expect(l.x).toBeGreaterThanOrEqual(t.belfryX);
      expect(l.x + l.w).toBeLessThanOrEqual(t.belfryX + t.belfryW);
    }
  });

  it('oversails: the clock stage is wider than the shaft under it', () => {
    // The one profile in the whole vocabulary that goes OUT before it goes up,
    // which is what makes the eye find it without being told.
    const t = towerOf({ kind: 'clockTower', x: 0, w: 44, top: LM }, BOT);
    expect(t.stageW).toBeGreaterThan(t.shaftW);
    expect(t.belfryW).toBeLessThan(t.stageW);
  });
});
