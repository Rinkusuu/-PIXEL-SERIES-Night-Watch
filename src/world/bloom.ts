import type { AmbientValues } from '../ambient/types';
import type { Block } from './city';
import { openings } from './city';
import type { Horizon } from './horizon';
import type { LampSpot } from './water';
import type { WeatherFx } from './weather';
import { LAMP_H, REFUGE_H, piers } from './bridge';
import { lanternAnchor } from './foreground';
import { rand } from './rng';

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
  const candidates: { x: number; y: number; r: number; block: number }[] = [];
  for (const [bi, b] of blocks.entries()) {
    if (b.kind === 'crane') continue;
    for (const o of openings(b, hz.cityBot)) {
      if (o.kind !== 'window') continue;
      // Nothing below the upstream bridge's parapet is visible. The roadway
      // runs the full width of the frame from `bridgeTop` down, and what shows
      // through its arches is the embankment, which rises to meet the crown —
      // so the city's lower storeys are behind stone everywhere.
      //
      // The bloom pass is drawn LIVE, over the finished plate, so occlusion
      // that the plate handles correctly by painting one thing over another
      // does not happen here: a window the bridge covers still lit a halo on
      // top of the bridge. It has to be culled at the source, and the source is
      // this list — which the river's glitter columns read too, so a lamp
      // culled here also stops reflecting.
      if (o.y + o.h / 2 >= hz.bridgeTop) continue;
      candidates.push({
        x: Math.round(o.x + o.w / 2),
        y: Math.round(o.y + o.h / 2),
        r: Math.max(2, Math.round(Math.min(o.w, o.h) * 0.6)),
        block: bi,
      });
    }
  }

  // `n` counts LAMPS, and it was calibrated when a whole building carried one
  // window. A city now offers hundreds, so a flat fourteen would leave it 97%
  // dark. Windows scale with how many there are; the gas standards do not.
  //
  // And they keep a floor. A lamplighter puts the gas out; nobody puts a
  // household out, so the windows thin toward dawn rather than going dark.
  const curve = WINDOW_LIT_FLOOR + (1 - WINDOW_LIT_FLOOR) * (n / TOTAL_LAMPS);
  const frac = WINDOW_LIT_PEAK * curve;
  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i]!;
    // Every opening holds a fixed lottery ticket, drawn from a pure function of
    // its index — so it is stable frame to frame, and the lit set only ever
    // GROWS as the night deepens. A window never blinks off because its
    // neighbour lit.
    //
    // The threshold carries a per-BUILDING term because a household lights more
    // than one window. Even per-window noise gives a uniform sprinkle, and a
    // uniform sprinkle is not what a lit city looks like. `0.15 + u * 1.70`
    // averages exactly 1, so clustering costs no overall brightness.
    const wake = 0.15 + rand(c.block * 7 + 9001) * 1.70;
    if (rand(i + 1) >= frac * wake) continue;
    out.push({ x: c.x, y: c.y, r: c.r, lit: true, kind: 'window' });
  }

  // Gas standards on the bridge piers. These are the lights the river reflects
  // best, because they sit directly above it.
  const p = piers(w, hz);
  for (const [i, q] of p.entries()) {
    out.push({
      x: Math.round(q.x + q.w / 2),
      // `LAMP_H` above the parapet, from bridge.ts — which is the module that
      // draws the post this flame sits on. Two copies of the number is a flame
      // floating beside its own lantern.
      y: hz.bridgeTop - REFUGE_H - LAMP_H,
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
      // The corona is moisture, not light. It swells with the fog and all but
      // vanishes on the clearest night, which ties the weather to the moon
      // without adding a knob for it. Drawn FIRST so the tight halo and the
      // hard disc sit on top of it.
      glowBlob(
        g, s.x, s.y,
        rad * HALO.moon * 2.6 * (0.6 + fx.fogScale * 0.5),
        v.glow, 0.05 + fx.fogScale * 0.05,
      );
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
