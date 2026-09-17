import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';
import { stream } from './rng';
import { piers } from './bridge';
import { ditherPattern } from './dither';
import { hexToRgb } from '../ambient/interpolate';
import { ARC_LIGHT } from './ladder';

/**
 * How hard the world above is compressed as it comes back up out of the water.
 * Below 1, each row of river shows more of the world — so a tall spire folds
 * into a short river instead of running out of room halfway down its own shaft.
 */
export const SQUASH = 0.78;

/** Reflection row step per quality notch. Texture degrades; geometry never. */
export const REFLECT_STEP = [3, 4, 6] as const;

/** Ripple count multiplier per quality notch. */
export const RIPPLE_SCALE = [1, 0.6, 0.35] as const;

export const RING_LIMIT = 32;

/** How many rows the wash off a cutwater runs for before it dies. */
const WASH_LEN = 9;

export type Ring = { x: number; y: number; r: number; life: number; max: number };

/** A light source that the river can reflect. */
export type LampSpot = {
  x: number;
  y: number;
  r: number;
  lit: boolean;
  kind: 'window' | 'bridge' | 'street' | 'arc' | 'lantern' | 'moon' | 'clockface';
  /**
   * How hard this one burns, around 1. Only the windows use it.
   *
   * Every lit window used to draw at exactly the same brightness, so a city of
   * hundreds of them read as one texture at one value — the critique for it was
   * "kotak kuning kecil, tidak ada variasi", and that is precisely what a flat
   * alpha produces. A room with the lamp turned up and a room with one candle
   * are both lit; they are not the same light.
   */
  power?: number;
};

/**
 * Which row of the mirror lands on river row `y`. Walking UP the mirror as we
 * walk DOWN the river is the whole trick; SQUASH decides how much world fits in
 * how much water. Returns -1 when we have run out of world to reflect.
 */
export function mirrorRow(y: number, waterTop: number, mirrorH: number): number {
  const my = mirrorH - 1 - Math.round((y - waterTop) / SQUASH);
  return my < 0 ? -1 : my;
}

/**
 * `d` is 0 at the waterline and 1 at your feet. A reflection that stays strong
 * all the way down makes the river look like a sheet of glass lying on the
 * stone — the fade is what gives the water depth.
 */
export function reflectAlpha(d: number): number {
  return Math.pow(1 - d, 1.35) * 0.55;
}

/** Two detuned sines per row. Zero when motion is off — still, but not absent. */
export function rowWobble(y: number, d: number, timeMs: number, motion: number): number {
  if (motion === 0) return 0;
  const t = timeMs / 1000;
  return Math.sin(y * 0.55 + t * 1.4) * (0.8 + d * 2.6)
       + Math.sin(y * 0.23 - t * 0.9) * (0.4 + d * 1.4);
}

/**
 * How much of the world a given row of river gives back, 0 to 1.
 *
 * The reflection used to be a straight row-for-row copy of the plate with a
 * couple of pixels of shear on it, fading smoothly toward your feet. Held up
 * against real water that reads as a photograph sheared sideways: the giveaway
 * is that EVERY row reflects equally well, so a building comes back as a
 * building with a wobble rather than as a building the water has torn up.
 *
 * Water does not do that. It reflects in bands. A stretch of surface tilted
 * toward you throws the sky back and shows almost nothing of the far bank; the
 * stretch beside it is flat and mirrors hard. The edges between those bands are
 * where a reflection actually breaks.
 *
 * Three detuned frequencies, so the bands never land on a repeating rhythm —
 * the same reason the fog's lobes and the barge's reflection slices are
 * detuned. The lowest frequency makes the wide quiet stretches; the highest
 * chops their edges.
 */
export function reflectBreak(y: number, timeMs: number, motion: number): number {
  const t = motion === 0 ? 0 : timeMs / 1000;
  const slow = Math.sin(y * 0.041 + t * 0.35);
  const mid = Math.sin(y * 0.130 - t * 0.62);
  const fast = Math.sin(y * 0.310 + t * 1.10);
  // Weighted so the slow term decides WHERE a band is and the fast one only
  // roughens its edge. Mapped to 0..1 with a floor: a row that gives back
  // nothing at all reads as a hole punched in the river, not as a ripple.
  const n = slow * 0.55 + mid * 0.30 + fast * 0.15;
  return 0.18 + 0.82 * Math.min(1, Math.max(0, (n + 1) / 2) ** 1.6);
}

export function advanceRing(r: Ring, dtMs: number): Ring {
  const dt = dtMs / 1000;
  const life = r.life + dt;
  const decay = Math.max(0, 1 - life / r.max);
  return { ...r, life, r: r.r + dt * 34 * Math.pow(decay, 0.6) };
}

/** How far a skimmed stone carries between its first two bounces, in pixels. */
const STONE_STEP = 16;

/**
 * Where a stone thrown at `(x, y)` touches the water.
 *
 * Pure, and it lives here because the ring field lives here — the module that
 * owns the thing owns what you can do to the thing. A caller computing bounce
 * positions itself would need its own copy of where the river is, which is a
 * second truth about the water that is wrong the moment the horizon moves.
 *
 * Returns an empty list for a throw that never reached the river. Saying so is
 * better than quietly rippling somewhere the pointer never was.
 */
export function stoneSkip(
  x: number, y: number, hz: Horizon, roll = Math.random(),
): { x: number; y: number; strength: number }[] {
  if (y < hz.waterTop || y > hz.waterBot) return [];

  const depth = Math.max(1, hz.waterBot - hz.waterTop);
  // Nearer water is closer to you, so a flatter throw gets more bounces. The
  // curve is deliberately generous: this is meant to be a nice thing to do with
  // a hand, not a test of aim.
  const d = (y - hz.waterTop) / depth;
  const bounces = 1 + Math.floor(d * 4 + roll * 1.4);

  const out: { x: number; y: number; strength: number }[] = [];
  let bx = x;
  let by = y;
  for (let i = 0; i < bounces; i++) {
    out.push({ x: bx, y: by, strength: 1 - i / (bounces + 1) });
    // Each bounce carries further and lands shallower — upstream, away from
    // you, which is the direction a skimmed stone actually travels.
    bx += STONE_STEP * (1 - i / bounces) + 6;
    by -= depth * 0.06 * (1 - i / bounces);
    if (by < hz.waterTop) break;
  }
  return out;
}

export type Water = {
  /** Rain, the barge's bow wave, and the ripple field all call THIS. */
  ring(x: number, y: number, strength?: number): void;
  update(dtMs: number, motion: number): void;
  draw(
    g: CanvasRenderingContext2D,
    w: number,
    hz: Horizon,
    v: AmbientValues,
    mirror: HTMLCanvasElement | null,
    lamps: readonly LampSpot[],
    timeMs: number,
    motion: number,
    notch: number,
  ): void;
  rings(): readonly Ring[];
};

export function createWater(seed = 777): Water {
  let live: Ring[] = [];
  const r = stream(seed);
  // Ripple field, laid out once and reused. Positions are fractions so the
  // field survives a resize without regenerating.
  const field = Array.from({ length: 150 }, () => ({
    fx: r(),
    fy: Math.pow(r(), 0.7),
    w: 3 + Math.floor(r() * 7),
    phase: r() * Math.PI * 2,
    speed: 0.25 + r() * 0.5,
  }));

  // Moored craft, laid out once. Fractions of the river rather than pixels, so
  // the reach keeps its traffic through a resize — the same rule the ripple
  // field above follows and for the same reason.
  const traffic = Array.from({ length: 7 }, (_, i) => ({
    fx: 0.05 + r() * 0.9,
    // Biased toward the far bank. Craft moored at your feet would crowd the
    // one part of the river the reflection column and the barge both need.
    fy: Math.pow(r(), 1.8) * 0.55,
    buoy: i >= 5,
  }));

  return {
    ring(x, y, strength = 1) {
      live.push({ x, y, r: 1, life: 0, max: 0.9 * strength });
      if (live.length > RING_LIMIT) live.shift();
    },

    update(dtMs, motion) {
      if (motion === 0) return;
      live = live.map((ring) => advanceRing(ring, dtMs)).filter((ring) => ring.life < ring.max);
    },

    rings: () => live,

    draw(g, w, hz, v, mirror, lamps, timeMs, motion, notch) {
      const top = hz.waterTop;
      const bot = hz.waterBot;
      const depth = bot - top;
      if (depth <= 1) return;

      // The ONE clock this layer reads. Freezing it here is what stops the
      // ripples winking and the waterline shimmering with motion off — every
      // sine below runs off `t`, never off `timeMs`, so there is no second
      // place for time to leak back in.
      const t = motion === 0 ? 0 : timeMs / 1000;

      // 1 — the body. Near water is deeper and darker.
      //
      //     Dithered like the sky (DNA §9.1). The tile is four pixels wide by
      //     the river's depth, so rebuilding it every frame is a few hundred
      //     writes — cheap enough that the palette can keep moving at 4 Hz
      //     without this needing a cache of its own.
      g.save();
      g.beginPath();
      g.rect(0, top, w, depth);
      g.clip();
      const body = ditherPattern(g, depth, [
        { at: 0, color: hexToRgb(v.mid) },
        { at: 1, color: hexToRgb(v.deep) },
      ]);
      if (body) {
        // The pattern's origin is the canvas origin, so it has to be shifted
        // down to the waterline or the gradient starts at the top of the frame
        // and the river is painted with the wrong slice of it.
        g.save();
        g.translate(0, top);
        g.fillStyle = body;
        g.fillRect(0, 0, w, depth);
        g.restore();
      } else {
        const grad = g.createLinearGradient(0, top, 0, bot);
        grad.addColorStop(0, v.mid);
        grad.addColorStop(1, v.deep);
        g.fillStyle = grad;
        g.fillRect(0, top, w, depth);
      }

      // 2 — the reflection.
      if (mirror) {
        const step = REFLECT_STEP[Math.min(notch, REFLECT_STEP.length - 1)]!;
        for (let y = top; y < bot; y += step) {
          const d = (y - top) / depth;
          const my = mirrorRow(y, top, mirror.height);
          if (my < 0) break;
          const a = reflectAlpha(d);
          if (a < 0.02) break;
          // Distance decides how MUCH is left; the break decides how much of
          // that this particular row gives back. Multiplying them is what turns
          // an even fade into water.
          const bk = reflectBreak(y, timeMs, motion);
          g.globalAlpha = a * bk;
          // A broken row is also a displaced one — the surface that is not
          // mirroring is the surface that is tilted, so it shears hardest.
          const shear = rowWobble(y, d, timeMs, motion) * (1 + (1 - bk) * 2.4);
          g.drawImage(
            mirror, 0, my, w, 1,
            Math.round(shear), y, w, step,
          );
        }
        g.globalAlpha = 1;
      }

      // 3 — the glitter path under every light above the water. Reflected
      //     gaslight on a river is the most London image there is; this is the
      //     part that must never be economised.
      g.globalCompositeOperation = 'lighter';
      for (const lamp of lamps) {
        if (!lamp.lit) continue;
        if (lamp.kind !== 'bridge' && lamp.kind !== 'window' && lamp.kind !== 'moon'
            && lamp.kind !== 'arc' && lamp.kind !== 'clockface') continue;
        // The arcs stand at the river's near edge and are the one light in the
        // picture that is not gas, so their column is cold. Set per lamp rather
        // than once before the loop: whichever colour the last lamp left behind
        // would otherwise paint the next one's path.
        g.fillStyle = lamp.kind === 'arc' ? ARC_LIGHT : v.glow;
        const cx = lamp.x;

        // How far down the river this light's path runs, and how hard. A gas
        // standard stands just above the water and throws a path all the way to
        // your feet; a window two hundred pixels up in the city throws a short
        // smear near the far bank. Giving every light the same full-depth column
        // is what turned the river to gravel the moment the city started
        // offering hundreds of lit windows instead of fourteen.
        const above = Math.max(0, top - lamp.y);
        const run = lamp.kind === 'moon'
          ? depth
          : depth * Math.max(0.10, 1 - above / (depth * 1.6));
        const dim = lamp.kind === 'window' ? 0.5 : 1;
        // Each light scatters on its own phase. Without it every column dashes
        // in step and the water reads as a printed halftone.
        const phase = ((cx * 0.37 + lamp.y * 0.11) % 1 + 1) % 1;
        const end = Math.min(bot, top + run);

        for (let y = top + 1; y < end; y += 2) {
          const d = (y - top) / depth;
          // Dies out at its OWN end, not at the river's.
          const fade = 1 - (y - top) / run;
          const halfW = 1.5 + d * (lamp.kind === 'moon' ? 26 : 9);
          const dash = 1 + Math.floor(d * 4);
          const gap = 2 + Math.floor(d * 6);
          const scroll = t * (8 + d * 22) + phase * (dash + gap);
          for (let x = cx - halfW; x < cx + halfW; x += dash + gap) {
            const j = Math.sin(x * 0.7 + y * 0.9 + t * 2.2 + phase * 6.28);
            if (j < -0.25) continue;
            const edge = 1 - Math.abs(x - cx) / halfW;
            const a = edge * (0.16 + 0.2 * j) * (1 - d * 0.35) * fade * dim;
            if (a < 0.03) continue;
            g.globalAlpha = Math.min(1, a);
            g.fillRect(
              Math.round(x + rowWobble(y, d, timeMs, motion) + ((scroll % (dash + gap)) - gap)),
              y, dash, 1,
            );
          }
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // 4 — ripple highlights, drifting with the current.
      const count = Math.round(field.length * RIPPLE_SCALE[Math.min(notch, 2)]!);
      const drift = t * 6;
      g.fillStyle = v.lift;
      for (let i = 0; i < count; i++) {
        const rp = field[i]!;
        const y = top + 3 + rp.fy * (depth - 3);
        const d = (y - top) / depth;
        const a = Math.max(0, Math.sin(t * rp.speed + rp.phase)) * (0.34 - d * 0.16);
        if (a < 0.04) continue;
        const x = ((rp.fx * w + drift) % w + w) % w;
        g.globalAlpha = a;
        g.fillRect(Math.round(x + rowWobble(y, d, timeMs, motion)), Math.round(y), rp.w, 1);
      }
      g.globalAlpha = 1;

      // 5 — rings, from rain, the barge, anything that hits the water. Squashed
      //     vertically: we look at the river at an angle, so a circular ripple
      //     projects as an ellipse. A round ring reads as a ball on the surface.
      g.strokeStyle = v.lift;
      g.lineWidth = 1;
      for (const ring of live) {
        const a = Math.pow(1 - ring.life / ring.max, 1.5) * 0.5;
        if (a < 0.03) continue;
        g.globalAlpha = a;
        g.beginPath();
        g.ellipse(ring.x, ring.y, ring.r, Math.max(1, ring.r * 0.32), 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;

      // 6 — flat line work over the whole body. This is the engraver's water,
      //     and it is why the river reads as a surface rather than a photograph
      //     dropped into a drawing.

      g.restore();

      // 5b — light falling ON the surface, from the lamps standing at your own
      //      parapet.
      //
      //      These do not get a mirror column and cannot: a lamp on the near
      //      rail reflects straight down, which is under the deck and off the
      //      frame. What it actually does to the river is light the water in
      //      front of it — a pool on the surface, not an image in it, and the
      //      difference is why this is a separate pass from the glitter above.
      //
      //      Broken by the same `reflectBreak` the reflection uses, so the
      //      spill ripples on the same water rather than on a private one.
      g.globalCompositeOperation = 'lighter';
      for (const lamp of lamps) {
        if (!lamp.lit) continue;
        if (lamp.kind !== 'street' && lamp.kind !== 'lantern' && lamp.kind !== 'arc') continue;
        const cold = lamp.kind === 'arc';
        g.fillStyle = cold ? ARC_LIGHT : v.glow;
        // Reaches from the near bank up the river, fading fast. The lantern is
        // the brightest thing on the parapet, so it reaches furthest.
        const reach = depth * (lamp.kind === 'lantern' ? 0.62 : 0.4);
        const wide = lamp.r * (cold ? 7 : 11);
        for (let y = bot - 1; y > bot - reach; y -= 2) {
          const up = (bot - y) / reach;
          // Light on water spreads as it goes: the far edge of a pool is wider
          // and weaker than the near edge.
          const halfW = wide * (0.45 + up * 1.5);
          const fade = (1 - up) ** 2;
          const bk = reflectBreak(y, timeMs, motion);
          const a = fade * bk * (cold ? 0.10 : 0.13);
          if (a < 0.006) continue;
          g.globalAlpha = a;
          const sway = rowWobble(y, up, timeMs, motion) * 0.6;
          g.fillRect(lamp.x - halfW + sway, y, halfW * 2, 2);
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // 6a — moored craft. The river had exactly one boat on it and that boat
      //      was only there for ninety seconds every fifteen minutes; the rest
      //      of the time the busiest waterway in the world was empty.
      //
      //      Lighters tied up along the reach, and a buoy or two. All static,
      //      all from one seed laid down when the module was created, so they
      //      neither drift nor reshuffle on a resize.
      //
      //      Drawn HERE rather than on the plate because everything from
      //      `waterTop` down is repainted opaquely by this pass every frame —
      //      the same reason the wash below is here and not in `bridge.ts`.
      g.save();
      for (const c of traffic) {
        const cx = c.fx * w;
        // Further up the reach means smaller and paler: the river recedes just
        // as hard as the city does, and a full-size lighter at the far bank
        // would sit in front of the bridge it is moored beside.
        const near = c.fy;
        const cy = top + depth * c.fy;
        const bw = Math.round(6 + near * 26);
        const bh = Math.max(2, Math.round(bw * 0.22));
        g.globalAlpha = 0.30 + near * 0.45;
        g.fillStyle = v.deep;
        if (c.buoy) {
          g.fillRect(Math.round(cx - 1), Math.round(cy - bh * 1.6), 2, Math.round(bh * 2.6));
          continue;
        }
        g.beginPath();
        g.moveTo(cx - bw / 2, cy);
        g.lineTo(cx + bw / 2, cy);
        g.lineTo(cx + bw * 0.4, cy + bh);
        g.lineTo(cx - bw * 0.4, cy + bh);
        g.closePath();
        g.fill();
        // A mast stump, on the ones big enough to carry one.
        if (bw > 16) g.fillRect(Math.round(cx + bw * 0.2), Math.round(cy - bh * 2), 1, bh * 2);
        // …and its own short reflection, squashed like everything else.
        g.globalAlpha *= 0.4;
        g.fillRect(Math.round(cx - bw * 0.4), Math.round(cy + bh), bw * 0.8, Math.max(1, bh));
      }
      g.restore();

      // 6b — the wash off the piers. A pier standing in a moving river throws a
      //      V downstream from its cutwater, and without one the piers read as
      //      posts set into a painted surface rather than as stone the current
      //      is running past. It is the cheapest thing in the scene that says
      //      the river MOVES.
      //
      //      Drawn here rather than in `bridge.ts` because everything from
      //      `waterTop` down belongs to this module and is repainted opaquely
      //      over the plate every frame — a V drawn on the plate would be
      //      washed out before anybody saw it. Positions come from `piers()`,
      //      not from a second guess about where the piers are.
      //
      //      Static in shape and frozen with `motion`: the river already has
      //      its budget of moving things, and a V that animates competes with
      //      the rings for the same attention while saying less.
      g.save();
      g.fillStyle = v.lift;
      for (const q of piers(w, hz)) {
        const cx = Math.round(q.x + q.w / 2);
        for (let k = 1; k <= WASH_LEN; k++) {
          // One step out for every step down: a wake angle, not a splash.
          const dx = Math.round(k * 1.7);
          const y = top + k;
          if (y >= bot) break;
          g.globalAlpha = 0.34 * (1 - k / WASH_LEN);
          g.fillRect(cx - dx, y, 2, 1);
          g.fillRect(cx + dx - 1, y, 2, 1);
        }
      }
      g.restore();

      // 7 — the waterline. Without a busy seam the reflection simply starts, and
      //     a reflection that starts at a ruled line looks like a screenshot
      //     pasted upside down.
      //
      //     A stepped EDGE, two pixels deep, not a one-pixel sine. The seam was
      //     a single row of lit dots following one sine, which at this scale is
      //     a dotted rule — and a dotted rule is exactly the ruled line it was
      //     put there to break up. Two detuned sines quantised to whole pixels
      //     give the bank a ragged lip instead, in the same stepped vocabulary
      //     as the roofs, the arch ring and the barge's reflection.
      g.save();
      g.fillStyle = v.lift;
      for (let x = 0; x < w; x++) {
        const n = Math.sin(x * 0.35 + t / 3) * 0.6 + Math.sin(x * 0.11 - t / 5) * 0.4;
        // Quantised to 0, 1 or 2 — the whole point is that the edge STEPS.
        const rise = Math.round(Math.abs(n) * 2);
        if (rise === 0) continue;
        g.globalAlpha = 0.42;
        g.fillRect(x, top, 1, rise);
        // The lit crest sits on top of the step it belongs to, so the two never
        // separate into a line of dots floating above a line of edge.
        g.globalAlpha = 0.62;
        g.fillRect(x, top + rise - 1, 1, 1);
      }
      g.restore();
    },
  };
}
