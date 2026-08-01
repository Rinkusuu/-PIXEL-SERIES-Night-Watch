import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';
import { stream } from './rng';
import { piers } from './bridge';

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
  kind: 'window' | 'bridge' | 'street' | 'lantern' | 'moon';
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

export function advanceRing(r: Ring, dtMs: number): Ring {
  const dt = dtMs / 1000;
  const life = r.life + dt;
  const decay = Math.max(0, 1 - life / r.max);
  return { ...r, life, r: r.r + dt * 34 * Math.pow(decay, 0.6) };
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
      const body = g.createLinearGradient(0, top, 0, bot);
      body.addColorStop(0, v.mid);
      body.addColorStop(1, v.deep);
      g.save();
      g.beginPath();
      g.rect(0, top, w, depth);
      g.clip();
      g.fillStyle = body;
      g.fillRect(0, top, w, depth);

      // 2 — the reflection.
      if (mirror) {
        const step = REFLECT_STEP[Math.min(notch, REFLECT_STEP.length - 1)]!;
        for (let y = top; y < bot; y += step) {
          const d = (y - top) / depth;
          const my = mirrorRow(y, top, mirror.height);
          if (my < 0) break;
          const a = reflectAlpha(d);
          if (a < 0.02) break;
          g.globalAlpha = a;
          g.drawImage(
            mirror, 0, my, w, 1,
            Math.round(rowWobble(y, d, timeMs, motion)), y, w, step,
          );
        }
        g.globalAlpha = 1;
      }

      // 3 — the glitter path under every light above the water. Reflected
      //     gaslight on a river is the most London image there is; this is the
      //     part that must never be economised.
      g.globalCompositeOperation = 'lighter';
      g.fillStyle = v.glow;
      for (const lamp of lamps) {
        if (!lamp.lit) continue;
        if (lamp.kind !== 'bridge' && lamp.kind !== 'window' && lamp.kind !== 'moon') continue;
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
