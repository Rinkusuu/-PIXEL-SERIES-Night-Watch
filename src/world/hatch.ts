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
   * Dead flat. Not a free choice: horizontal line work is how nineteenth-century
   * engraving draws water, and it is what makes the river read as a horizontal
   * surface instead of a vertical wall. The upstream bridge shares `mid` — its
   * depth really is there, and a fifth angle would only blur the depth ladder.
   */
  water: 0.00,
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

  const diag = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
  g.translate(x + w / 2, y + h / 2);
  g.rotate(angle);
  g.beginPath();
  for (let o = -diag; o <= diag; o += gap) {
    g.moveTo(o, -diag);
    g.lineTo(o, diag);
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
