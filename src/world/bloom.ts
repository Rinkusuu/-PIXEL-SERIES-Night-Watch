import type { AmbientValues } from '../ambient/types';
import { roofline, type Building } from './layers';

const TOTAL_LAMPS = 14;

/**
 * Windows and lamps light up through the evening and go out toward dawn.
 * Peak is at 0.62 — the thickest fog, when the gas is doing the most work.
 */
export function lampCount(progress: number, total = TOTAL_LAMPS): number {
  const p = Math.min(1, Math.max(0, progress));
  const curve = p <= 0.62 ? p / 0.62 : 1 - (p - 0.62) / 0.38;
  const n = 2 + (total - 2) * Math.max(0, curve);
  return Math.max(1, Math.min(total, Math.round(n)));
}

/**
 * Windows sit inside real buildings, not scattered over the sky. The order is
 * shuffled by a co-prime stride so the ones that light up first are spread
 * across the skyline instead of marching in from one edge.
 */
export function windowSpots(buildings: readonly Building[]): { x: number; y: number; r: number }[] {
  const n = buildings.length;
  const stride = 5; // co-prime with 14
  const out: { x: number; y: number; r: number }[] = [];
  for (let k = 0; k < n; k++) {
    const i = (k * stride) % n;
    const b = buildings[i];
    if (!b) continue;
    out.push({
      x: b.x + b.w * (0.3 + ((i * 7) % 5) / 12),
      y: b.y + 14 + ((i * 11) % 4) * 9,
      r: 2 + (i % 2),
    });
  }
  return out;
}

function glowBlob(
  g: CanvasRenderingContext2D,
  x: number, y: number, radius: number, colour: string, alpha: number,
): void {
  const halo = g.createRadialGradient(x, y, 0, x, y, radius);
  halo.addColorStop(0, colour);
  halo.addColorStop(1, 'transparent');
  g.globalAlpha = alpha;
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
}

export function drawLamps(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: AmbientValues,
  progress: number,
  timeMs: number,
  motion: number,
): void {
  const n = lampCount(progress);
  const spots = windowSpots(roofline(w, h));

  // Emissive things are HOLES in the hatching, drawn after it. If everything
  // glowed, nothing would. Addendum §C.2.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n && i < spots.length; i++) {
    const s = spots[i]!;
    const pulse = 1 + Math.sin(timeMs / 900 + i) * 0.06 * motion;
    const rad = s.r * pulse;
    glowBlob(g, s.x, s.y, rad * 8, v.glow, 0.34);
    g.globalAlpha = 1;
    g.fillStyle = v.glow;
    g.fillRect(s.x - rad, s.y - rad * 1.4, rad * 2, rad * 2.8);
  }
  g.restore();

  // A row of street lamps along the near railing, thinning out with distance.
  const streetY = h * 0.855;
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 5; k++) {
    const x = w * (0.18 + k * 0.19);
    const lit = k < Math.max(1, Math.round((n / TOTAL_LAMPS) * 5));
    if (!lit) continue;
    const pulse = 1 + Math.sin(timeMs / 1100 + k * 2) * 0.05 * motion;
    glowBlob(g, x, streetY, 46 * pulse, v.glow, 0.3);
    g.globalAlpha = 1;
    g.fillStyle = v.glow;
    g.fillRect(x - 2, streetY - 5, 4, 10);
  }
  g.restore();

  // The near lantern never goes out, at any state. Addendum §D.1.
  const lx = w * 0.08;
  const ly = h * 0.74;
  g.save();
  g.globalCompositeOperation = 'lighter';
  glowBlob(g, lx, ly, 90, v.glow, 0.55);
  g.globalAlpha = 1;
  g.fillStyle = v.glow;
  g.fillRect(lx - 3, ly - 6, 6, 12);
  g.restore();

  // Moon: rises with the night. Given a soft halo so it reads as light rather
  // than as a sticker pasted on the sky.
  const my = h * (0.42 - progress * 0.24);
  const mx = w * 0.78;
  g.save();
  g.globalCompositeOperation = 'lighter';
  glowBlob(g, mx, my, 70, v.glow, 0.16 + v.lum * 0.1);
  g.globalAlpha = 0.3 + v.lum * 0.18;
  g.fillStyle = v.glow;
  g.beginPath();
  g.arc(mx, my, 16, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
