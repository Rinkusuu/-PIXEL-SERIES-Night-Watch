/**
 * Addendum §C. Engraving has no grey: mid-tones come from the distance between
 * lines. Dark = tight. Light = loose. Darkest = two directions crossing.
 *
 * Angle marks DEPTH, not object — everything at the same distance shares one
 * angle, or the picture reads as matted fur.
 */
export const HATCH_ANGLES = {
  far: -0.42,
  mid: -0.95,
  near: 0.30,
  /**
   * A quarter turn — flat. Angles here are measured FROM VERTICAL, because
   * `hatch` lays its lines out vertically before rotating them. 0 rad is a wall
   * of verticals, which is exactly what the river must never be.
   *
   * Flat horizontal line work is how nineteenth-century engraving draws water,
   * and it is what makes the river read as a horizontal surface instead of a
   * vertical wall. The upstream bridge shares `mid` — its depth really is
   * there, and a fifth angle would only blur the depth ladder.
   */
  water: Math.PI / 2,
} as const;

export type HatchOpts = {
  angle?: number;
  color?: string;
  minGap?: number;
  maxGap?: number;
};

/**
 * The gap is clamped narrow at EVERY depth. Above about four pixels a hatch
 * stops reading as tone and starts reading as a motif — which is precisely how
 * the far city, at twelve and a half pixels, turned into wallpaper.
 */
export const GAP_MIN = 1.6;
export const GAP_MAX = 3.7;

/**
 * Ink width in pixels, as base plus slope over `value^0.72`. Expressed this way
 * rather than as a min and a max because the line that matches the old ink
 * coverage crosses zero at `value ≈ 0.011` — below `hatch`'s own cutoff, so no
 * real layer ever reaches it, but a minimum would have to be a lie.
 */
export const WEIGHT_BASE = -0.035;
export const WEIGHT_SLOPE = 0.72;

/** Canvas will not draw a line thinner than about half a pixel reliably. */
export const MIN_STROKE = 0.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The eye reads line density logarithmically; a linear ramp wastes half its range. */
const ramp = (value: number) => Math.pow(clamp01(value), 0.72);

export function gapFor(value: number, minGap = GAP_MIN, maxGap = GAP_MAX): number {
  return maxGap - (maxGap - minGap) * ramp(value);
}

/** The ink width we WANT. May be under MIN_STROKE; alpha covers the difference. */
export function weightFor(value: number): number {
  return Math.max(0.02, WEIGHT_BASE + WEIGHT_SLOPE * ramp(value));
}

/**
 * Ink per unit area. The chords of a parallel line family crossing a region sum
 * to `area / gap`, so coverage is width over gap and nothing else — angle does
 * not enter it. This is the only number that may be used to judge how dark a
 * layer is.
 */
export function inkRatio(value: number): number {
  return weightFor(value) / gapFor(value);
}

/**
 * Half-extent of the rect projected onto the OFFSET axis: how far `o` has to
 * travel for the line family to cross the whole rect.
 */
export function spreadFor(w: number, h: number, angle: number): number {
  return (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
}

/**
 * Half-extent projected onto the LINE axis: how long each segment has to be.
 *
 * These two were one number until now, and that number was spreadFor's. Every
 * angle we shipped happened to sit in a wide rect where the wrong value was
 * still too big to notice; at a quarter turn it is far too small, and the
 * hatching would appear as a narrow band down the middle of the river.
 */
export function reachFor(w: number, h: number, angle: number): number {
  return (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
}

export function hatch(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  opt: HatchOpts = {},
): void {
  const {
    angle = HATCH_ANGLES.far,
    color = '#000000',
    minGap = GAP_MIN,
    maxGap = GAP_MAX,
  } = opt;

  if (value <= 0.02) return;

  const gap = gapFor(value, minGap, maxGap);
  // ONE knob carries the tone: the ink width we want. Where that falls under
  // what canvas can stroke, alpha makes up the difference, so `lw * alpha`
  // always comes back to `want`. Tone must not be counted twice.
  const want = weightFor(value);
  const lw = Math.max(MIN_STROKE, want);

  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.globalAlpha = want / lw;

  const spread = spreadFor(w, h, angle) + gap;
  const reach = reachFor(w, h, angle) + 1;
  g.translate(x + w / 2, y + h / 2);
  g.rotate(angle);
  g.beginPath();
  for (let o = -spread; o <= spread; o += gap) {
    g.moveTo(o, -reach);
    g.lineTo(o, reach);
  }
  g.stroke();
  g.restore();

  // Crossing earlier than the darkest third makes the whole plate look dirty
  // rather than dark. The second pass opens its gap by a third — a flat +1px
  // was fine across a nine-pixel range and is far too much across two.
  if (value > 0.66) {
    hatch(g, x, y, w, h, (value - 0.66) / 0.34, {
      ...opt,
      angle: angle + 1.13,
      minGap: minGap * 1.35,
    });
  }
}
