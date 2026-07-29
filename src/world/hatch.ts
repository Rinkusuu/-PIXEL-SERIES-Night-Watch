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
  lineWidth?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Density is read logarithmically; a linear ramp wastes half its range. */
export function gapFor(value: number, minGap: number, maxGap: number): number {
  const t = Math.pow(clamp01(value), 0.72);
  return maxGap - (maxGap - minGap) * t;
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
    minGap = 2,
    maxGap = 11,
    lineWidth = 1,
  } = opt;

  if (value <= 0.02) return;

  const t = Math.pow(clamp01(value), 0.72);
  const gap = gapFor(value, minGap, maxGap);

  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.globalAlpha = 0.55 + 0.45 * t;

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
  // rather than dark.
  if (value > 0.66) {
    hatch(g, x, y, w, h, (value - 0.66) / 0.34, {
      ...opt,
      angle: angle + 1.13,
      minGap: minGap + 1,
    });
  }
}
