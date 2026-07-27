import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import { HATCH_ANGLES, hatch } from './hatch';

/** Deterministic pseudo-random so the skyline is identical between redraws. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

export type Building = { x: number; y: number; w: number; h: number };

const MID_COUNT = 14;

/**
 * The mid roofs, shared with bloom.ts so lit windows land on actual buildings
 * rather than floating in the sky. Deterministic for a given size.
 */
export function roofline(w: number, h: number): Building[] {
  const top = h * 0.66;
  const bw = w / MID_COUNT;
  const out: Building[] = [];
  for (let i = 0; i < MID_COUNT; i++) {
    const bh = 46 + rand(i + 31) * 86;
    out.push({ x: i * bw, y: top - bh, w: bw + 1, h: bh + (h - top) + 1 });
  }
  return out;
}

/**
 * Engraving ink. `--amb-deep` alone is too close to the sky at night and the
 * whole plate washes out; the ink is pushed most of the way to black so the
 * hatching still reads at lum 0.08.
 */
function inkFor(v: AmbientValues): string {
  return rgbToHex(mixRgb(hexToRgb(v.deep), [2, 3, 6], 0.62));
}

/**
 * Four depth layers, one hatch angle each (addendum §C.2). The sky is the only
 * part that is NOT hatched — it is the blank paper everything else is cut into.
 */
export function drawStatic(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: AmbientValues,
  progress: number,
): void {
  // 1. Sky — three stops, never two (DNA §3.3).
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, v.sky[0]);
  sky.addColorStop(0.55, v.sky[1]);
  sky.addColorStop(1, v.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const ink = inkFor(v);
  const deepRgb = hexToRgb(v.deep);

  // 2. Far city — spires and chimneys, loose hatching, first to vanish in fog.
  //    Each block is silhouetted first, or the hatch has nothing to sit on.
  const farTop = h * 0.55;
  const farFill = rgbToHex(mixRgb(hexToRgb(v.sky[1]), deepRgb, 0.55));
  for (let i = 0; i < 26; i++) {
    const bw = w / 26;
    const bh = 30 + rand(i) * 90;
    const x = i * bw;
    g.fillStyle = farFill;
    g.fillRect(x, farTop - bh, bw + 1, bh + 1);
    hatch(g, x, farTop - bh, bw + 1, bh + 1, 0.30 + rand(i + 7) * 0.15, {
      angle: HATCH_ANGLES.far, color: ink, maxGap: 13,
    });
  }
  g.fillStyle = farFill;
  g.fillRect(0, farTop, w, h - farTop);

  // 3. Mid roofs — the layer the windows are cut out of.
  const midFill = rgbToHex(mixRgb(hexToRgb(v.sky[1]), deepRgb, 0.82));
  for (const [i, b] of roofline(w, h).entries()) {
    g.fillStyle = midFill;
    g.fillRect(b.x, b.y, b.w, b.h);
    hatch(g, b.x, b.y, b.w, b.h, 0.46 + rand(i + 11) * 0.14, {
      angle: HATCH_ANGLES.mid, color: ink, maxGap: 11,
    });
    // chimney
    const cx = b.x + b.w * (0.2 + rand(i + 3) * 0.6);
    g.fillStyle = midFill;
    g.fillRect(cx, b.y - 22, 9, 22);
    hatch(g, cx, b.y - 22, 9, 24, 0.62, { angle: HATCH_ANGLES.mid, color: ink });
  }

  // 4. Near — railing and the lamp post, densest, into cross-hatch territory.
  const nearTop = h * 0.86;
  g.fillStyle = rgbToHex(mixRgb(deepRgb, [2, 3, 6], 0.35));
  g.fillRect(0, nearTop, w, h - nearTop);
  hatch(g, 0, nearTop, w, h - nearTop, 0.72 + progress * 0.1, {
    angle: HATCH_ANGLES.near, color: ink, maxGap: 9,
  });
  for (let x = 0; x < w; x += 26) {
    hatch(g, x, nearTop - 34, 4, 36, 0.8, { angle: HATCH_ANGLES.near, color: ink, maxGap: 7 });
  }
}
