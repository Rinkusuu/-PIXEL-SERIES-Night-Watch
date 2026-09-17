import type { AmbientValues } from '../ambient/types';
import type { Block } from './city';
import { openings } from './city';
import type { Horizon } from './horizon';
import type { LampSpot } from './water';
import type { WeatherFx } from './weather';
import { LAMP_H, REFUGE_H, piers } from './bridge';
import { lanternAnchor } from './foreground';
import { rand } from './rng';
import { ARC_LIGHT } from './ladder';

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
      // The landmark's clock face is the one opening in the city that is lit
      // from behind rather than from a room. It is also the whole reason the
      // tower is a focal point after dark: an unlit clock is a dark disc on a
      // dark tower, and the eye has nothing to find.
      if (o.kind === 'clock') {
        out.push({
          x: Math.round(o.x + o.w / 2),
          y: Math.round(o.y + o.h / 2),
          r: Math.round(o.w * 0.5),
          lit: true,
          kind: 'clockface',
        });
        continue;
      }
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
    // Skewed LOW: most rooms are dim and a few are blazing, which is what a
    // street of windows actually looks like. A flat spread would only move the
    // uniformity from one value to a slightly noisier one.
    const power = 0.4 + Math.pow(rand(i + 4242), 2.2) * 2.1;
    out.push({ x: c.x, y: c.y, r: c.r, lit: true, kind: 'window', power });
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

  // Standards along the near rail. Two of the five are electric, and they are
  // the two at the FAR end — the new lamps went up from one end of the
  // Embankment, so a mixed row is a row caught mid-replacement.
  for (let k = 0; k < 5; k++) {
    out.push({
      x: Math.round(w * (0.18 + k * 0.19)),
      y: hz.railTop - 6,
      // An arc lamp is physically bigger and throws further. This is the only
      // place in the app where two lamp kinds sit at the same depth, so it is
      // the only place the size difference can actually be read.
      r: k >= 3 ? 4 : 3,
      // The electric ones are ALWAYS lit, and the gas comes up behind them as
      // the night deepens. That is the right way round twice over: an arc lamp
      // is thrown by a switch at a generating station, while every gas standard
      // waits for a man with a pole — and it also means the one cold light in
      // the picture is visible from the first frame instead of arriving in the
      // last ten minutes of a session nobody watches to the end.
      lit: k >= 3 || k < Math.max(1, Math.round((n / TOTAL_LAMPS) * 5)),
      kind: k >= 3 ? 'arc' : 'street',
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
    x: Math.round(moon.x), y: Math.round(moon.y), r: MOON_BASE_R * fx.moonScale,
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
export const MOON_DISC = '#f4f7f4';



/**
 * The moon's radius before the weather scales it. Shared with `sky.ts`, which
 * draws the body onto the plate so the skyline can stand in front of it — two
 * copies of this number is a disc and a halo of different sizes.
 */
export const MOON_BASE_R = 30;

const HALO: Record<LampSpot['kind'], number> = {
  // The arc's halo is TIGHTER than the gas beside it, not wider. A flame in a
  // glass box scatters; an arc between two carbon rods is nearly a point, and
  // a hard little light next to a soft big one is what sells the difference.
  window: 8, bridge: 12, street: 15, arc: 9, lantern: 20, moon: 3.6,
  // Tighter than a window's for its size: a clock face is a big pane of glass
  // with a lamp behind it, not a room spilling out of an opening.
  clockface: 2.6,
};
const ALPHA: Record<LampSpot['kind'], number> = {
  window: 0.34, bridge: 0.34, street: 0.30, arc: 0.44, lantern: 0.55, moon: 0.30,
  clockface: 0.42,
};

/** Everything burns gas except the arcs. */
const lightColour = (kind: LampSpot['kind'], glow: string) =>
  (kind === 'arc' ? ARC_LIGHT : glow);

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
      // ONLY the wide corona is left here. The disc and its tight halo moved to
      // `sky.ts`, onto the plate, because drawn in this pass they sat on top of
      // the finished picture and the moon floated in front of the city.
      //
      // This one belongs in front: it is moisture in the air between you and
      // everything else, so it genuinely does wash over the near buildings. It
      // swells with the fog and all but vanishes on the clearest night, which
      // ties the weather to the moon without adding a knob for it.
      glowBlob(
        g, s.x, s.y,
        rad * HALO.moon * 2.6 * (0.6 + fx.fogScale * 0.5),
        v.glow, 0.05 + fx.fogScale * 0.05,
      );
      continue;
    }

    const colour = lightColour(s.kind, v.glow);
    const power = s.power ?? 1;
    // The halo grows with the light and the core does not: a brighter room
    // spills further through the glass, but the pane it spills through is the
    // same size. Scaling both would just make some windows bigger.
    glowBlob(
      g, s.x, s.y,
      rad * HALO[s.kind] * fx.haloScale * (0.6 + power * 0.5),
      colour, Math.min(0.9, ALPHA[s.kind] * power),
    );
    g.globalAlpha = Math.min(1, 0.45 + power * 0.45);
    g.fillStyle = colour;
    if (s.kind === 'clockface') {
      // A DISC, not the tall bar every other light gets. That bar is the shape
      // of a lit window — correct for a window, and for a clock it drew a
      // glowing rectangle sitting inside the dark circle the plate had already
      // cut for the dial.
      g.beginPath();
      g.arc(s.x, s.y, rad, 0, Math.PI * 2);
      g.fill();
      continue;
    }
    g.fillRect(s.x - rad / 2, s.y - rad, Math.max(2, rad), rad * 2.4);
  }
  g.restore();
}
