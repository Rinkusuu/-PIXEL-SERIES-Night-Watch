import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';

/**
 * Band positions are fractions OF THE RIVER, not of the frame. Fog belongs to
 * the water — it rolls off it — so when `deckTop` moves the fog follows the
 * river instead of drifting onto the stone.
 */
const BANDS = [
  { speed: 0.018, y: 0.10, height: 0.42, alpha: 0.34, puffs: 5 },
  { speed: -0.011, y: 0.44, height: 0.46, alpha: 0.28, puffs: 4 },
  { speed: 0.006, y: 0.78, height: 0.40, alpha: 0.22, puffs: 6 },
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

/** How many soft lobes make up the pool at the city's feet. */
const POOL_LOBES = 22;

/**
 * The pool. Buildings must come OUT of the fog, not stand on top of it — as
 * long as their feet are cut off at a ruled line, the best silhouette in the
 * world still reads as a sticker pasted on the sky.
 *
 * Drawn as overlapping lobes with an uneven top edge rather than as a gradient
 * band, for the same reason the drifting bands are puffs: a strip that is
 * uniform along x has no shape for the eye to catch.
 */
function drawPool(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  thickness: number,
): void {
  const baseY = hz.cityBot;
  const lobeW = w / POOL_LOBES;

  g.save();
  for (let i = 0; i < POOL_LOBES; i++) {
    const x = (i + 0.5) * lobeW;
    // Two detuned sines give the top edge a ragged line without any randomness,
    // so the pool is identical between plate rebuilds.
    const lift = 0.55 + Math.sin(i * 1.7) * 0.22 + Math.sin(i * 0.6) * 0.16;
    const ry = (hz.cityBot - hz.bridgeTop) * lift;

    g.globalAlpha = Math.min(0.7, 0.30 * thickness);
    const grad = g.createRadialGradient(x, baseY, 0, x, baseY, lobeW * 1.35);
    grad.addColorStop(0, v.accent);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.save();
    g.translate(x, baseY);
    g.scale(1, ry / (lobeW * 1.35));
    g.beginPath();
    g.arc(0, 0, lobeW * 1.35, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.restore();
}

/**
 * Each band is a row of soft puffs, NOT a flat gradient strip. A strip that is
 * uniform along x looks identical after a horizontal translation, so drifting
 * it would be invisible — the puffs are what make the motion readable.
 */
export function drawFog(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  timeMs: number,
  motion: number,
  fogScale: number,
): void {
  // Thicker fog as the world darkens, and thicker again on a foggy night.
  const thickness = (1 - v.lum) * fogScale;
  if (thickness <= 0.01) return;

  // The pool goes first: the drifting bands belong to the river and must ride
  // over it, not under it.
  drawPool(g, w, hz, v, thickness);

  const top = hz.waterTop;
  const span = hz.h - hz.waterTop;

  BANDS.forEach((b, i) => {
    const bandY = top + span * (b.y + b.height / 2);
    const bandH = span * b.height;
    const puffW = w / b.puffs;
    const wrap = w + puffW * 2;
    const off = fogOffset(timeMs, i, motion);

    g.save();
    g.globalAlpha = Math.min(0.85, b.alpha * thickness);

    for (let k = 0; k < b.puffs + 2; k++) {
      const raw = k * puffW + off;
      const x = ((raw % wrap) + wrap) % wrap - puffW;

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
