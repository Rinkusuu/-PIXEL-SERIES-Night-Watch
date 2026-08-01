import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';

/**
 * Band positions are fractions OF THE RIVER, not of the frame. Fog belongs to
 * the water — it rolls off it — so when `deckTop` moves the fog follows the
 * river instead of drifting onto the stone.
 */
const BANDS = [
  { speed: 0.018, y: 0.10, height: 0.42, alpha: 0.34, lobe: 150 },
  { speed: -0.011, y: 0.44, height: 0.46, alpha: 0.28, lobe: 190 },
  { speed: 0.006, y: 0.78, height: 0.40, alpha: 0.22, lobe: 125 },
];

/**
 * How many puffs a band is made of, at this width.
 *
 * These used to be flat counts — five, four and six — which meant the puff was
 * `w / 5` wide and the fog got COARSER the wider the screen. At 1440 the first
 * band was a 288-pixel lobe, and a lobe that size stops reading as a puff of
 * anything and reads as a stain on the glass. The whole point of drawing fog as
 * lobes rather than as a gradient strip is that the lobes have an edge; past a
 * certain size the edge leaves the frame and there is nothing left to see.
 *
 * So the LOBE is the constant and the count follows the width. The overlap
 * ratio is unchanged — radius is still 0.8 of the spacing — so the accumulated
 * opacity at any point comes out the same and the band alphas above did not
 * have to be retuned.
 */
function puffCount(w: number, lobe: number): number {
  return Math.max(4, Math.round(w / lobe));
}

/** Target lobe width for the pool at the city's feet, for the same reason. */
const POOL_LOBE_W = 66;

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
  // Same rule as the drifting bands: fix the lobe, let the count follow the
  // frame. At a flat 22 the pool's lobes grew with the viewport too.
  const lobes = Math.max(12, Math.round(w / POOL_LOBE_W));
  const lobeW = w / lobes;

  g.save();
  for (let i = 0; i < lobes; i++) {
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
    const puffs = puffCount(w, b.lobe);
    const puffW = w / puffs;
    const wrap = w + puffW * 2;
    const off = fogOffset(timeMs, i, motion);

    g.save();
    g.globalAlpha = Math.min(0.85, b.alpha * thickness);

    for (let k = 0; k < puffs + 2; k++) {
      // Spacing and size both wander, keyed off the puff's own index so the
      // wander travels WITH the puff as it wraps and the band stays seamless.
      //
      // At five puffs to a frame even spacing did not matter — you cannot see a
      // rhythm in five things. At ten or twelve you can, and a row of identical
      // lobes at identical intervals reads as a comb. Trading one artefact for
      // another is not a fix.
      const jitter = Math.sin(k * 2.39 + i * 1.7) * puffW * 0.26;
      const rad = puffW * (0.66 + Math.abs(Math.sin(k * 1.13 + i * 2.1)) * 0.26);
      const raw = k * puffW + off + jitter;
      const x = ((raw % wrap) + wrap) % wrap - puffW;

      g.save();
      g.translate(x, bandY);
      // Vertical radius stays `bandH / 2` whatever the horizontal radius is —
      // the band owns its own height, and a puff that got taller as it got
      // wider would make the band's edge bulge wherever a fat lobe landed.
      g.scale(1, (bandH / 2) / rad);
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, rad);
      grad.addColorStop(0, v.accent);
      grad.addColorStop(1, 'transparent');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, rad, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    g.restore();
  });
}
