import type { AmbientValues } from '../ambient/types';
import type { Block } from './city';
import type { Horizon } from './horizon';
import type { Water } from './water';
import { hashString, rand } from './rng';

export type Weather = 'clear' | 'fog' | 'rain' | 'fullmoon';

const TABLE: readonly (readonly [Weather, number])[] = [
  ['clear', 0.40],
  ['fog', 0.30],
  ['rain', 0.20],
  ['fullmoon', 0.10],
];

/**
 * Seeded from `nightKey()`, so the same night is always the same weather. The
 * scene must not reshuffle on a resize, and there must be a reason to open the
 * app again tomorrow.
 */
export function weatherFor(key: string): Weather {
  const t = (hashString(key) % 10_000) / 10_000;
  let acc = 0;
  for (const [name, weight] of TABLE) {
    acc += weight;
    if (t < acc) return name;
  }
  return 'clear';
}

export type WeatherFx = {
  /** multiplier on fog band opacity */
  fogScale: number;
  /** multiplier on lamp halo radius */
  haloScale: number;
  /** added to the moon's brightness */
  lumLift: number;
  moonScale: number;
  /** 0..1 rain density */
  rain: number;
  birds: boolean;
};

export function effectsFor(w: Weather): WeatherFx {
  switch (w) {
    case 'fog':
      return { fogScale: 2.0, haloScale: 1.35, lumLift: 0, moonScale: 1, rain: 0, birds: false };
    case 'rain':
      // Rain washes the fog out. A wet London night is the CLEAREST one you get,
      // and the lamps harden into points instead of blooming.
      return { fogScale: 0.55, haloScale: 0.80, lumLift: 0, moonScale: 1, rain: 1, birds: false };
    case 'fullmoon':
      return { fogScale: 0.85, haloScale: 1.10, lumLift: 0.12, moonScale: 2, rain: 0, birds: true };
    default:
      return { fogScale: 1, haloScale: 1, lumLift: 0, moonScale: 1, rain: 0, birds: true };
  }
}

export const BARGE_PERIOD_MS = 15 * 60_000;
export const BARGE_CROSS_MS = 90_000;

/**
 * Driven by the wall clock, not by session progress. The river does not care
 * about your timer, and a barge that only passes while you work would read as a
 * reward rather than as a river. Position is a pure function of the clock —
 * no state, no randomness.
 *
 * Returns x as a fraction of width, or null when it is not crossing.
 */
export function bargeAt(nowMs: number): number | null {
  const phase = ((nowMs % BARGE_PERIOD_MS) + BARGE_PERIOD_MS) % BARGE_PERIOD_MS;
  if (phase >= BARGE_CROSS_MS) return null;
  return -0.15 + (phase / BARGE_CROSS_MS) * 1.32;
}

export const BIRD_COUNT = 3;
const BIRD_PERIOD_MS = 40_000;
const BIRD_CROSS_MS = 20_000;

export function birdAt(nowMs: number, i: number): { x: number; y: number } | null {
  const offset = i * (BIRD_PERIOD_MS / BIRD_COUNT) + rand(i + 5) * 3000;
  const phase = ((nowMs + offset) % BIRD_PERIOD_MS + BIRD_PERIOD_MS) % BIRD_PERIOD_MS;
  if (phase >= BIRD_CROSS_MS) return null;
  const t = phase / BIRD_CROSS_MS;
  return {
    x: -0.1 + t * 1.2,
    y: 0.12 + rand(i + 19) * 0.2 + Math.sin(t * 6 + i) * 0.02,
  };
}

/**
 * Everything that moves in front of the plate but is not water and not fog.
 * Smoke comes only from real chimneys — `blocks` supplies them, so a column can
 * never end up floating in empty air.
 */
export function drawWeather(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  weather: Weather,
  blocks: readonly Block[],
  water: Water,
  timeMs: number,
  motion: number,
  notch: number,
): void {
  const fx = effectsFor(weather);
  const t = timeMs / 1000;

  // 1 — smoke, from factory stacks only.
  const stacks = blocks.filter((b) => b.kind === 'factory').slice(0, 4 - Math.min(notch, 2));
  g.save();
  g.fillStyle = v.accent;
  for (const [i, b] of stacks.entries()) {
    const puffs = 12 - notch * 3;
    for (let k = 0; k < puffs; k++) {
      const age = (k + (motion === 0 ? 0 : (t * 0.35) % 1)) / puffs;
      const rise = age * (hz.cityTop * 0.9 + 40);
      const lean = age * age * 34 + Math.sin(t * 0.4 + i) * 6 * motion;
      const radius = 3 + age * 16;
      g.globalAlpha = (1 - age) * 0.13;
      g.beginPath();
      g.arc(b.stackX! + lean, b.top - rise, radius, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // 2 — the barge. Silhouette, one bow light, and a bow wave that hits the same
  //     ring field the rain uses.
  const bx = motion === 0 ? null : bargeAt(timeMs);
  if (bx !== null) {
    const x = bx * w;
    const y = hz.waterTop + (hz.waterBot - hz.waterTop) * 0.42;
    const bw = Math.max(70, w * 0.09);
    const bh = Math.max(9, bw * 0.14);
    g.save();
    g.fillStyle = v.deep;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + bw, y);
    g.lineTo(x + bw * 0.88, y + bh);
    g.lineTo(x + bw * 0.08, y + bh);
    g.closePath();
    g.fill();
    g.fillRect(x + bw * 0.62, y - bh * 1.5, bw * 0.06, bh * 1.5);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.8;
    g.fillStyle = v.glow;
    g.fillRect(x + bw * 0.9, y - 3, 3, 3);
    g.restore();
    if (Math.floor(timeMs / 400) !== Math.floor((timeMs - 16) / 400)) {
      water.ring(x + bw, y + bh, 0.7);
    }
  }

  // 3 — birds.
  if (fx.birds && motion !== 0) {
    g.save();
    g.strokeStyle = v.deep;
    g.lineWidth = 1;
    g.globalAlpha = 0.6;
    for (let i = 0; i < BIRD_COUNT; i++) {
      const b = birdAt(timeMs, i);
      if (!b) continue;
      const x = b.x * w;
      const y = b.y * hz.waterTop * 2;
      const flap = Math.sin(t * 7 + i) * 2;
      g.beginPath();
      g.moveTo(x - 4, y + flap);
      g.lineTo(x, y - 1);
      g.lineTo(x + 4, y + flap);
      g.stroke();
    }
    g.restore();
  }

  // 4 — rain. Only on a rainy night, and never when motion is off: rain that
  //     hangs in the air is wrong. Wet stone (drawn in layers.ts) stands in.
  if (fx.rain > 0 && motion !== 0) {
    const density = Math.round(220 * fx.rain * [1, 0.6, 0.35][Math.min(notch, 2)]!);
    g.save();
    g.strokeStyle = v.lift;
    g.globalAlpha = 0.22;
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < density; i++) {
      const speed = 900 + rand(i) * 700;
      const x = ((rand(i + 3) * w + t * 90) % (w + 60)) - 30;
      const y = (rand(i + 7) * hz.railBot + t * speed) % hz.railBot;
      g.moveTo(x, y);
      g.lineTo(x - 4, y + 13);
    }
    g.stroke();
    g.restore();

    // A few of them land, and what lands rings the water.
    if (Math.floor(timeMs / 90) !== Math.floor((timeMs - 16) / 90)) {
      const k = Math.floor(timeMs / 90);
      water.ring(
        rand(k) * w,
        hz.waterTop + rand(k + 1) * (hz.waterBot - hz.waterTop),
        0.45,
      );
    }
  }
}
