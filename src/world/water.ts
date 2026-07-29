import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';
import { dither } from './dither';
import { stream } from './rng';

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
      dither(g, 0, top, w, depth, 0.34, { color: v.deep });

      g.restore();

      // 7 — the waterline. Without a busy seam the reflection simply starts, and
      //     a reflection that starts at a ruled line looks like a screenshot
      //     pasted upside down.
      g.save();
      g.globalAlpha = 0.5;
      g.fillStyle = v.lift;
      for (let x = 0; x < w; x++) {
        const n = Math.abs(Math.sin(x * 0.35 + t / 3));
        if (n > 0.56) g.fillRect(x, top + (n > 0.72 ? 1 : 0), 1 + Math.round(n), 1);
      }
      g.restore();
    },
  };
}
