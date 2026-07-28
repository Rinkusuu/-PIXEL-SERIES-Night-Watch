import type { AmbientValues } from '../ambient/types';
import { horizon } from './horizon';
import { skyline, type Block } from './city';
import { drawStatic } from './layers';
import { drawFog } from './fog';
import { drawLamps, lampSpots, moonPos } from './bloom';
import { SQUASH, createWater } from './water';
import { drawWeather, effectsFor, type Weather } from './weather';
import { createFrameClock } from './quality';

/** Largest single-channel difference between two hex colours. */
export function channelDrift(a: string, b: string): number {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.max(Math.abs(ar! - br!), Math.abs(ag! - bg!), Math.abs(ab! - bb!));
}

/** Addendum §B.3 — redraw the static plate only when it would visibly change. */
const REDRAW_THRESHOLD = 6;
/** The deck may jitter by a pixel or two as panels reflow; ignore that. */
const DECK_THRESHOLD = 4;

export type FrameInput = {
  w: number;
  h: number;
  deckTop: number;
  v: AmbientValues;
  progress: number;
  timeMs: number;
  motion: number;
  weather: Weather;
};

export function createWorldRenderer() {
  let plate: HTMLCanvasElement | null = null;
  let mirror: HTMLCanvasElement | null = null;
  let blocks: Block[] = [];
  let builds = 0;

  let cachedMid = '';
  let cachedW = 0;
  let cachedH = 0;
  let cachedDeck = -999;
  let cachedWeather: Weather | null = null;

  const water = createWater();
  const clock = createFrameClock();
  let lastTime = 0;

  function invalidate(): void {
    plate = null;
  }

  function frame(target: CanvasRenderingContext2D, input: FrameInput): void {
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    const { w, h, v, progress, timeMs, motion, weather } = input;
    const hz = horizon(h, input.deckTop);
    const fx = effectsFor(weather);

    const stale =
      plate === null ||
      cachedW !== w ||
      cachedH !== h ||
      cachedWeather !== weather ||
      Math.abs(cachedDeck - hz.deckTop) > DECK_THRESHOLD ||
      channelDrift(cachedMid, v.mid) > REDRAW_THRESHOLD;

    if (stale) {
      // The skyline only regenerates on a size change. A city that reshuffles
      // every time the palette drifts is a city made of static.
      if (blocks.length === 0 || cachedW !== w || cachedH !== h) {
        blocks = skyline(w, hz.cityTop, hz.cityBot, Math.round(w * 31 + h));
      }

      const cv = plate ?? document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      if (g) {
        g.clearRect(0, 0, w, h);
        drawStatic(g, w, hz, v, progress, blocks, weather);
      }
      plate = cv;

      // The mirror is filled HERE, from the finished plate — so the reflection's
      // source costs nothing per frame, and we never read a texture we are in
      // the middle of writing.
      const waterH = hz.waterBot - hz.waterTop;
      const wantH = Math.ceil(waterH / SQUASH) + 2;
      const srcTop = Math.max(0, hz.waterTop - wantH);
      const mh = hz.waterTop - srcTop;
      if (mh > 1) {
        const mv = mirror ?? document.createElement('canvas');
        mv.width = w;
        mv.height = mh;
        const mg = mv.getContext('2d');
        if (mg) {
          mg.clearRect(0, 0, w, mh);
          mg.drawImage(cv, 0, srcTop, w, mh, 0, 0, w, mh);
        }
        mirror = mv;
      } else {
        mirror = null;
      }

      builds++;
      cachedMid = v.mid;
      cachedW = w;
      cachedH = h;
      cachedDeck = hz.deckTop;
      cachedWeather = weather;
    }

    const notch = clock.notch();
    const dt = lastTime === 0 ? 16 : Math.min(64, timeMs - lastTime);
    lastTime = timeMs;
    water.update(dt, motion);

    const moon = moonPos(w, hz, progress);
    const lamps = lampSpots(w, hz, blocks, progress, fx, moon);

    target.clearRect(0, 0, w, h);
    if (plate) target.drawImage(plate, 0, 0);

    water.draw(target, w, hz, v, mirror, lamps, timeMs, motion, notch);
    drawWeather(target, w, hz, v, weather, blocks, water, timeMs, motion, notch);
    drawFog(target, w, hz, v, timeMs, motion, fx.fogScale);
    drawLamps(target, v, lamps, fx, timeMs, motion);

    if (started !== 0) clock.sample(performance.now() - started);
  }

  return { frame, invalidate, plateBuilds: () => builds };
}
