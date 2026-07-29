import type { AmbientValues } from '../ambient/types';
import type { Block } from './city';
import { openings } from './city';
import type { Horizon } from './horizon';
import type { LampSpot } from './water';
import type { WeatherFx } from './weather';
import { piers } from './bridge';
import { lanternAnchor } from './foreground';

const TOTAL_LAMPS = 14;

/**
 * Fraction of a city's windows burning at the height of the night. Most of a
 * Victorian city was dark after midnight, and the dark is what makes the lit
 * ones mean anything — but three per cent is not a city, it is a power cut.
 */
const WINDOW_LIT_PEAK = 0.12;

/** How much of that peak still burns at the quietest hour. */
const WINDOW_LIT_FLOOR = 0.35;

/**
 * Windows and lamps light up through the evening and go out toward dawn. Peak is
 * at 0.62 — the thickest fog, when the gas is doing the most work.
 */
export function lampCount(progress: number, total = TOTAL_LAMPS): number {
  const p = Math.min(1, Math.max(0, progress));
  const curve = p <= 0.62 ? p / 0.62 : 1 - (p - 0.62) / 0.38;
  const n = 2 + (total - 2) * Math.max(0, curve);
  return Math.max(1, Math.min(total, Math.round(n)));
}

export function moonPos(w: number, hz: Horizon, progress: number): { x: number; y: number } {
  return {
    x: w * 0.78,
    y: hz.skyBot - progress * (hz.skyBot - hz.cityTop * 0.4),
  };
}

/**
 * A stride co-prime with `n` walks every index exactly once. The size matters
 * as much as the co-primality: candidates arrive grouped by building, and a
 * building carries twenty-odd windows, so a small stride like 7 never leaves
 * the wall it started on — every lit window lands on one house.
 *
 * The golden ratio is the classic low-discrepancy step: it spreads any prefix
 * of the walk as evenly as a prefix can be spread.
 */
function scatterStride(n: number): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  let s = Math.max(1, Math.round(n * 0.6180339887));
  while (s > 1 && gcd(s, n) !== 1) s--;
  return s;
}

/**
 * ONE list of lights, consumed by both the bloom pass and the river's glitter
 * columns. Two lists computed separately is how you get a reflection that does
 * not line up with the lamp casting it.
 */
export function lampSpots(
  w: number,
  hz: Horizon,
  blocks: readonly Block[],
  progress: number,
  fx: WeatherFx,
  moon: { x: number; y: number },
): LampSpot[] {
  const out: LampSpot[] = [];
  const n = lampCount(progress);

  // Windows. Positions come from city.ts, never from a second guess here.
  // Only the LIT ones become spots: an unlit window is already drawn dark on
  // the plate, and pushing hundreds of dead entries through the glitter and
  // bloom loops every frame buys nothing.
  const candidates: { x: number; y: number; r: number }[] = [];
  for (const b of blocks) {
    if (b.kind === 'crane') continue;
    for (const o of openings(b, hz.cityBot)) {
      if (o.kind !== 'window') continue;
      candidates.push({
        x: Math.round(o.x + o.w / 2),
        y: Math.round(o.y + o.h / 2),
        r: Math.max(2, Math.round(Math.min(o.w, o.h) * 0.6)),
      });
    }
  }
  if (candidates.length > 0) {
    // `n` counts LAMPS, and it was calibrated when a whole building carried one
    // window. A city now offers hundreds, so a flat fourteen would leave it 97%
    // dark. Windows scale with how many there are; the gas standards do not.
    //
    // And they keep a floor. A lamplighter puts the gas out; nobody puts a
    // household out, so the windows thin toward dawn rather than going dark.
    // At the floor alone the city still reads as inhabited.
    const curve = WINDOW_LIT_FLOOR + (1 - WINDOW_LIT_FLOOR) * (n / TOTAL_LAMPS);
    const want = Math.round(candidates.length * WINDOW_LIT_PEAK * curve);
    const stride = scatterStride(candidates.length);
    for (let k = 0; k < Math.min(want, candidates.length); k++) {
      out.push({
        ...candidates[(k * stride) % candidates.length]!, lit: true, kind: 'window',
      });
    }
  }

  // Gas standards on the bridge piers. These are the lights the river reflects
  // best, because they sit directly above it.
  const p = piers(w, hz);
  for (const [i, q] of p.entries()) {
    out.push({
      x: Math.round(q.x + q.w / 2),
      y: hz.bridgeTop - 9,
      r: 3,
      lit: i < Math.max(1, Math.round((n / TOTAL_LAMPS) * p.length)),
      kind: 'bridge',
    });
  }

  // Street standards along the near rail.
  for (let k = 0; k < 5; k++) {
    out.push({
      x: Math.round(w * (0.18 + k * 0.19)),
      y: hz.railTop - 6,
      r: 3,
      lit: k < Math.max(1, Math.round((n / TOTAL_LAMPS) * 5)),
      kind: 'street',
    });
  }

  // The near lantern never goes out, at any state. Addendum §D.1. Its position
  // comes from foreground.ts so the flame lands inside the glass housing that
  // module draws — one source, not two that can drift apart.
  const lantern = lanternAnchor(w, hz);
  out.push({ x: lantern.x, y: lantern.y, r: 5, lit: true, kind: 'lantern' });

  out.push({
    // The moon is the picture's key light, not a decoration in the corner. At
    // r16 it read as a sticker; this is the size it has to be to justify the
    // reflection column it drops down the whole river.
    x: Math.round(moon.x), y: Math.round(moon.y), r: 30 * fx.moonScale,
    lit: true, kind: 'moon',
  });

  return out;
}

function glowBlob(
  g: CanvasRenderingContext2D,
  x: number, y: number, radius: number, colour: string, alpha: number,
): void {
  if (radius <= 0) return;
  const halo = g.createRadialGradient(x, y, 0, x, y, radius);
  halo.addColorStop(0, colour);
  halo.addColorStop(1, 'transparent');
  g.globalAlpha = alpha;
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
}

/**
 * The moon's disc. Fixed, like `VIGNETTE_INK` in ladder.ts and for the same
 * reason: it is the TOP of the value range, and a top that drifts with the
 * ambient palette is not a top.
 */
const MOON_DISC = '#f4f7f4';

const HALO: Record<LampSpot['kind'], number> = {
  window: 8, bridge: 12, street: 15, lantern: 20, moon: 3.6,
};
const ALPHA: Record<LampSpot['kind'], number> = {
  window: 0.34, bridge: 0.34, street: 0.30, lantern: 0.55, moon: 0.30,
};

export function drawLamps(
  g: CanvasRenderingContext2D,
  v: AmbientValues,
  lamps: readonly LampSpot[],
  fx: WeatherFx,
  timeMs: number,
  motion: number,
): void {
  // Emissive things are HOLES in the hatching, drawn after it. If everything
  // glowed, nothing would. Addendum §C.2.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [i, s] of lamps.entries()) {
    if (!s.lit) continue;
    const pulse = 1 + Math.sin(timeMs / 900 + i) * 0.06 * motion;
    const rad = s.r * pulse;

    if (s.kind === 'moon') {
      glowBlob(g, s.x, s.y, rad * HALO.moon, v.glow, ALPHA.moon + v.lum * 0.1 + fx.lumLift);
      // A hard, near-white disc. A soft dim one reads as a smudge, and the
      // reference's moon is the brightest thing on screen by a wide margin.
      g.globalAlpha = Math.min(1, 0.62 + v.lum * 0.3 + fx.lumLift);
      g.fillStyle = MOON_DISC;
      g.beginPath();
      g.arc(s.x, s.y, rad, 0, Math.PI * 2);
      g.fill();
      continue;
    }

    glowBlob(g, s.x, s.y, rad * HALO[s.kind] * fx.haloScale, v.glow, ALPHA[s.kind]);
    g.globalAlpha = 1;
    g.fillStyle = v.glow;
    g.fillRect(s.x - rad / 2, s.y - rad, Math.max(2, rad), rad * 2.4);
  }
  g.restore();
}
