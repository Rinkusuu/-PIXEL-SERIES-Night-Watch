import type { AmbientValues } from '../ambient/types';

const BANDS = [
  { speed: 0.018, y: 0.58, height: 0.30, alpha: 0.30 },
  { speed: -0.011, y: 0.68, height: 0.34, alpha: 0.24 },
  { speed: 0.006, y: 0.80, height: 0.28, alpha: 0.20 },
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

  BANDS.forEach((b, i) => {
    const off = fogOffset(timeMs, i, motion) % (w * 2);
    const grad = g.createLinearGradient(0, h * b.y, 0, h * (b.y + b.height));
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, v.accent);
    grad.addColorStop(1, 'transparent');

    g.save();
    g.globalAlpha = b.alpha * thickness;
    g.fillStyle = grad;
    g.translate(off % w, 0);
    g.fillRect(-w, h * b.y, w * 3, h * b.height);
    g.restore();
  });
}
