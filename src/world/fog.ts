import type { AmbientValues } from '../ambient/types';

const BANDS = [
  { speed: 0.018, y: 0.60, height: 0.26, alpha: 0.34, puffs: 5 },
  { speed: -0.011, y: 0.70, height: 0.30, alpha: 0.28, puffs: 4 },
  { speed: 0.006, y: 0.81, height: 0.24, alpha: 0.22, puffs: 6 },
];

/**
 * Adjacent bands drift at different speeds and opposite signs, so the fog never
 * reads as one sliding sheet. Motion 0 freezes it dead — this is the wide-area
 * movement that actually causes vestibular trouble. DNA §8.1.
 */
export function fogOffset(timeMs: number, band: number, motion: number): number {
  const b = BANDS[band % BANDS.length]!;
  return timeMs * b.speed * motion;
}

/**
 * Each band is a row of soft puffs, NOT a flat gradient strip. A strip that is
 * uniform along x looks identical after a horizontal translation, so drifting
 * it would be invisible — the puffs are what make the motion readable.
 */
export function drawFog(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: AmbientValues,
  timeMs: number,
  motion: number,
): void {
  // Thicker fog as the world darkens.
  const thickness = 1 - v.lum;
  if (thickness <= 0.01) return;

  BANDS.forEach((b, i) => {
    const bandY = h * (b.y + b.height / 2);
    const bandH = h * b.height;
    const puffW = w / b.puffs;
    const span = w + puffW * 2;
    const off = fogOffset(timeMs, i, motion);

    g.save();
    g.globalAlpha = b.alpha * thickness;

    for (let k = 0; k < b.puffs + 2; k++) {
      // Wrap into [-puffW, w + puffW) so puffs enter and leave off-screen.
      const raw = k * puffW + off;
      const x = ((raw % span) + span) % span - puffW;

      g.save();
      g.translate(x, bandY);
      g.scale(1, bandH / (puffW * 1.6));
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, puffW * 0.8);
      grad.addColorStop(0, v.accent);
      grad.addColorStop(1, 'transparent');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, puffW * 0.8, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    g.restore();
  });
}
