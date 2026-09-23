import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';
import type { LampSpot } from './water';
import type { Season } from './season';
import { rand } from './rng';

/**
 * Everything small and alive.
 *
 * The scene had a walker, a watcher, three birds and a barge — four bespoke
 * objects, each with its own timing code, and every one of them on a fixed
 * loop. What it did not have was anything that behaves: something that is
 * where it is because of where the light is, rather than because a modulo
 * said so.
 *
 * ONE POOL, allocated once, never grown. Every critter is a slot with a `kind`
 * tag and a dead slot is simply `kind === DEAD`. Nothing is constructed at
 * runtime, so nothing is collected at runtime — which is the whole argument
 * the reference project makes for doing it this way, and it is right: a
 * particle system that allocates stutters every few seconds when the collector
 * runs, and that stutter is the fastest way to make a careful canvas scene
 * feel cheap.
 */

const DEAD = 0;
const MOTH = 1;
const RAT = 2;

/**
 * Small. Moths are supposed to be a scatter around one lamp, not a swarm, and
 * two rats on a parapet is a night; six is an infestation and a different kind
 * of story.
 */
const POOL = 96;
const MAX_MOTHS = 30;
const MAX_RATS = 2;

type Critter = {
  kind: number;
  x: number;
  y: number;
  /** Moths: the angle around their lamp. Rats: unused. */
  a: number;
  /** Moths: the distance out. Rats: pixels per second, signed. */
  v: number;
  /** Seconds left before this slot dies. Rats also pause on it. */
  life: number;
  /** Which lamp a moth belongs to. Rats: -1. */
  host: number;
  size: number;
  /** A per-critter phase, so two moths on one lamp never fly in step. */
  seed: number;
};

/**
 * How many moths the night supports.
 *
 * Moths are a summer insect and they are drawn to gas. Both halves of that are
 * real rules here rather than decoration: the count follows the season the
 * world already knows, and follows how many lamps are actually burning — so an
 * early evening with two lamps lit has a few, the deep middle of the night
 * with everything alight has a crowd, and a January embankment has none at
 * all. Nothing else in the app tells you what month it is without words.
 */
export function mothBudget(
  season: Season, lampsLit: number, wet: boolean,
): number {
  if (season === 'winter') return 0;
  // Rain grounds them. Not to zero — there is always one idiot moth.
  const weather = wet ? 0.15 : 1;
  const warmth = season === 'summer' ? 1 : 0.55;
  return Math.round(Math.min(MAX_MOTHS, lampsLit * 2.2) * warmth * weather);
}

export type Life = ReturnType<typeof createLife>;

export function createLife(seed = 4211) {
  // Allocated once, here, and never again.
  const pool: Critter[] = Array.from({ length: POOL }, () => ({
    kind: DEAD, x: 0, y: 0, a: 0, v: 0, life: 0, host: -1, size: 1, seed: 0,
  }));
  let n = 0;
  let spawnClock = 0;

  const spawn = (): Critter | null => {
    for (let i = 0; i < POOL; i++) {
      const c = pool[i]!;
      if (c.kind === DEAD) return c;
    }
    return null;
  };

  const count = (kind: number): number => {
    let k = 0;
    for (const c of pool) if (c.kind === kind) k++;
    return k;
  };

  function update(
    dtMs: number,
    hz: Horizon,
    w: number,
    lamps: readonly LampSpot[],
    season: Season,
    wet: boolean,
    motion: number,
  ): void {
    // Motion zero freezes them where they are rather than removing them. An
    // empty embankment is a different picture; a still one is the same picture
    // holding its breath. DNA §8.1.
    if (motion === 0) return;
    const dt = Math.min(0.064, dtMs / 1000);
    spawnClock += dt;

    /* Moths orbit the lamps they can actually see burning, so the candidate
       list is the SAME `lampSpots` the bloom pass drew from. A second list
       would put moths around lamps that are out. */
    const hosts: number[] = [];
    for (const [i, l] of lamps.entries()) {
      if (!l.lit) continue;
      if (l.kind === 'window' || l.kind === 'moon' || l.kind === 'clockface') continue;
      hosts.push(i);
    }

    const wantMoths = mothBudget(season, hosts.length, wet);
    const haveMoths = count(MOTH);

    // One arrival at a time, a few a second. A budget that filled instantly
    // would make the lamps blink into a cloud the moment the gas came up.
    if (haveMoths < wantMoths && spawnClock > 0.35 && hosts.length > 0) {
      spawnClock = 0;
      const c = spawn();
      if (c) {
        n++;
        const host = hosts[Math.floor(rand(seed + n) * hosts.length) % hosts.length]!;
        c.kind = MOTH;
        c.host = host;
        c.a = rand(seed + n * 3) * Math.PI * 2;
        c.v = 7 + rand(seed + n * 7) * 13;
        c.size = rand(seed + n * 11) > 0.75 ? 2 : 1;
        c.seed = rand(seed + n * 13);
        // Long enough to watch, short enough that the population keeps
        // turning over instead of becoming a fixed constellation.
        c.life = 14 + rand(seed + n * 17) * 26;
        c.x = lamps[host]!.x;
        c.y = lamps[host]!.y;
      }
    }

    if (count(RAT) < MAX_RATS && spawnClock > 0.35 && rand(seed + Math.floor(spawnClock * 1e4)) > 0.994) {
      const c = spawn();
      if (c) {
        n++;
        c.kind = RAT;
        // Enters from whichever edge it is heading away from.
        const rightward = rand(seed + n * 19) > 0.5;
        c.v = (rightward ? 1 : -1) * (26 + rand(seed + n * 23) * 22);
        c.x = rightward ? -8 : w + 8;
        // On the coping, which is the one near surface a rat would actually
        // run along, and the one the reader is looking straight at.
        c.y = hz.railTop - 2;
        c.size = 1;
        c.seed = rand(seed + n * 29);
        c.life = 0;
      }
    }

    for (const c of pool) {
      if (c.kind === DEAD) continue;

      if (c.kind === MOTH) {
        c.life -= dt;
        const l = lamps[c.host];
        // The lamp went out, or the frame resized the list out from under it.
        // Either way the reason for this moth to be here is gone.
        if (c.life <= 0 || !l || !l.lit) { c.kind = DEAD; continue; }
        /* Erratic on purpose, and not random per frame: two detuned sines on
           the moth's own seed. A moth that jitters by `Math.random()` every
           frame reads as television static, because it has no momentum — the
           eye needs the path to be continuous to read it as flight. */
        const t = c.seed * 100;
        c.a += dt * (1.4 + Math.sin(t + c.life * 0.9) * 1.1);
        const r = c.v * (0.75 + Math.sin(t * 1.7 + c.life * 2.3) * 0.25);
        c.x = l.x + Math.cos(c.a) * r;
        c.y = l.y + Math.sin(c.a) * r * 0.62;
        continue;
      }

      // RAT. Scurry, freeze, scurry — which is the whole of how a rat moves,
      // and a rat that crosses at a constant speed reads as a thrown object.
      c.life -= dt;
      if (c.life > 0) continue;
      c.x += c.v * dt;
      if (rand(seed + Math.floor(c.x * 7)) > 0.996) c.life = 0.2 + c.seed * 0.5;
      if (c.x < -12 || c.x > w + 12) c.kind = DEAD;
    }
  }

  /**
   * Matter on the scene, and a hole punched in the light.
   *
   * A moth is not a light. It is a speck of matter crossing in front of one,
   * and it reads only as a silhouette — put into the emissive buffer it would
   * be a bright mote, which is a firefly, a different insect and a warmer,
   * less sooty city.
   *
   * But drawing it dark on the scene alone does not work either, and the
   * reason is the whole point of having two surfaces. The emissive buffer is
   * screened OVER the scene, and `screen` lightens: a dark speck sitting under
   * a bright halo comes out bright. The moth would be washed away by exactly
   * the light it is supposed to be crossing.
   *
   * So it is drawn twice — dark on the scene, and erased out of the glow with
   * `destination-out`. That is not a trick to get around the blend mode; it is
   * what a moth does. It is opaque, it is between you and the lamp, and it
   * stops that much light. The hole is wider than the body because the blur
   * spreads it back, and the erase is partial because a moth's wings are thin
   * enough to glow through.
   */
  function draw(
    g: CanvasRenderingContext2D,
    glow: CanvasRenderingContext2D,
    v: AmbientValues,
    ink: string,
  ): void {
    g.save();
    glow.save();
    glow.globalCompositeOperation = 'destination-out';

    for (const c of pool) {
      if (c.kind === DEAD) continue;
      if (c.kind === MOTH) {
        // Not fully opaque: it is small enough that the halo shows through the
        // wings, which is what stops it reading as a dead pixel.
        g.globalAlpha = 0.72;
        g.fillStyle = v.deep;
        g.fillRect(Math.round(c.x), Math.round(c.y), c.size, c.size);

        glow.globalAlpha = 0.55;
        const bite = c.size + 2;
        glow.fillStyle = '#000';
        glow.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 1, bite, bite);
      } else {
        g.globalAlpha = 0.9;
        g.fillStyle = ink;
        // Three pixels of body and one of tail. At this size that is the
        // entire difference between a rat and a crumb.
        g.fillRect(Math.round(c.x), Math.round(c.y), 3, 2);
        g.fillRect(Math.round(c.x) - Math.sign(c.v) * 2, Math.round(c.y), 2, 1);

        glow.globalAlpha = 0.8;
        glow.fillStyle = '#000';
        glow.fillRect(Math.round(c.x) - 2, Math.round(c.y) - 1, 7, 4);
      }
    }

    glow.restore();
    g.restore();
  }

  /** For the tests, and for anyone wondering whether the pool ever grows. */
  const debug = () => ({ pool: POOL, moths: count(MOTH), rats: count(RAT) });

  return { update, draw, debug };
}
