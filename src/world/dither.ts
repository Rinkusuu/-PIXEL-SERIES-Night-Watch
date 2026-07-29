/**
 * Ordered dither — DNA §9.1, restored.
 *
 * The Gaslamp addendum §C replaced dither with hatching on the grounds that the
 * world layer was an engraved plate. That is now reversed: the world renders
 * into a small buffer and blows up with nearest neighbour, and line work a
 * couple of pixels wide simply does not survive the trip. Tone comes from a
 * threshold matrix again, which is what pixel art has always used and what the
 * parent DNA specified in the first place.
 *
 * Every hatch call site becomes a dither call site with the same `value`
 * meaning: 0 is bare paper, 1 is solid ink.
 */

/**
 * Bayer 4×4. Its whole virtue is that the thresholds are spread as far apart as
 * a 4×4 grid allows, so a large flat area never grows a visible clump — which
 * is exactly what a random threshold does and why noise dither looks dirty.
 */
export const BAYER4 = [
  0, 8, 2, 10,
  12, 4, 14, 6,
  3, 11, 1, 9,
  15, 7, 13, 5,
] as const;

export const BAYER_N = 4;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/**
 * Fitted to the ink the calibrated hatch actually laid down, so the value
 * ladder built two rounds ago survives the change of technique. The four call
 * sites keep their `density` numbers and land on:
 *
 *     0.18 far city → 1/16     0.52 bridge → 3/16
 *     0.34 city, river → 2/16  0.74 deck   → 5/16
 *
 * The naive curve — reusing `^0.72` from `gapFor` — put the deck at 13/16.
 * Eighty per cent coverage is not a dark tone, it is a black rectangle with
 * holes in it, and every layer came out two to three times heavier than the
 * line work it replaced.
 */
const LEVEL_SCALE = 7.45;
const LEVEL_POWER = 1.323;

export function ditherLevel(value: number): number {
  const cells = LEVEL_SCALE * Math.pow(clamp01(value), LEVEL_POWER);
  return Math.min(BAYER_N * BAYER_N, Math.round(cells));
}

/**
 * Which cells of the 4×4 tile are inked at this value. Pure, so the pattern can
 * be tested without a canvas — the tile-building below cannot.
 */
export function ditherMask(value: number): boolean[] {
  const level = ditherLevel(value);
  return BAYER4.map((threshold) => threshold < level);
}

/** How much of the tile is inked. The only number that judges a layer's tone. */
export function inkRatio(value: number): number {
  return ditherLevel(value) / (BAYER_N * BAYER_N);
}

type Tile = { pattern: CanvasPattern | null };
const tiles = new Map<string, Tile>();

/**
 * A 4×4 pattern, built once per value-and-colour and reused. Rebuilding it per
 * call would be a canvas allocation inside the draw loop.
 */
function tileFor(
  g: CanvasRenderingContext2D, value: number, color: string,
): CanvasPattern | null {
  const level = ditherLevel(value);
  const key = `${level}|${color}`;
  const hit = tiles.get(key);
  if (hit) return hit.pattern;

  let pattern: CanvasPattern | null = null;
  if (level > 0 && typeof document !== 'undefined') {
    const c = document.createElement('canvas');
    c.width = BAYER_N;
    c.height = BAYER_N;
    const p = c.getContext('2d');
    if (p) {
      p.fillStyle = color;
      for (let i = 0; i < BAYER4.length; i++) {
        if (BAYER4[i]! < level) p.fillRect(i % BAYER_N, Math.floor(i / BAYER_N), 1, 1);
      }
      pattern = g.createPattern(c, 'repeat');
    }
  }
  tiles.set(key, { pattern });
  return pattern;
}

export type DitherOpts = { color?: string };

/**
 * Fills a rect with ordered dither at `value`.
 *
 * The tile is laid out in BUFFER pixels, not in the caller's units — the
 * context is scaled by 1/PIXEL_SCALE, so the pattern has to be drawn under the
 * inverse of that transform or the dots come out blurred across three device
 * pixels each, which is the one thing this whole change exists to prevent.
 */
export function dither(
  g: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  value: number,
  opt: DitherOpts = {},
): void {
  if (value <= 0.02 || w <= 0 || h <= 0) return;
  const pattern = tileFor(g, value, opt.color ?? '#000000');
  if (!pattern) return;

  g.save();
  g.fillStyle = pattern;

  // A pattern is transformed by the current matrix. Under a 1/3 scale the 4×4
  // tile would land as 1.33 pixels and smear across the grid — the exact fault
  // this whole change exists to remove. So the fill is done with the transform
  // reset and the rect converted by hand. Any clip already in force stays in
  // force: clips live in device space once set.
  const m = typeof g.getTransform === 'function' ? g.getTransform() : null;
  if (m && typeof m.a === 'number') {
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillRect(x * m.a + m.e, y * m.d + m.f, w * m.a, h * m.d);
  } else {
    g.fillRect(x, y, w, h);
  }
  g.restore();
}
