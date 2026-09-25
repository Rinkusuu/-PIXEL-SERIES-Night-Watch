import type { AmbientValues } from '../ambient/types';
import { horizon } from './horizon';
import { skyline, type Block } from './city';
import { drawGroundPlate, drawSkyPlate, inkFor } from './layers';
import { drawWalker } from './figure';
import { drawFog } from './fog';
import { drawShafts } from './shafts';
import { drawLamps, drawPointerLantern, lampSpots, moonPos } from './bloom';
import { createLife } from './life';
import { drawClouds, drawStars } from './sky';
import type { Season } from './season';
import type { LampSpot } from './water';
import { SQUASH, createWater, stoneSkip } from './water';
import { drawForeground } from './foreground';
import { VIGNETTE_INK } from './ladder';
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

/**
 * How far the moon may travel before the plate is rebuilt.
 *
 * The moon's body lives on the plate now, so the city can stand in front of it
 * — which means a plate that never rebuilds shows a moon frozen where it rose.
 * It climbs roughly a hundred pixels over a whole session, so at three pixels
 * this adds about thirty rebuilds an hour, against the palette drift that
 * already triggers them several times a minute.
 */
const MOON_THRESHOLD = 3;

export type FrameInput = {
  w: number;
  h: number;
  deckTop: number;
  v: AmbientValues;
  progress: number;
  timeMs: number;
  motion: number;
  weather: Weather;
  /**
   * Where the pointer is over the WORLD, or null when it is over the chrome,
   * off the window, or on a touch screen that has no hover to speak of.
   *
   * In scene coordinates, not client ones. The canvas is one CSS pixel per
   * drawn pixel so they happen to agree today, and writing the conversion at
   * the one place that owns the buffer keeps that a coincidence rather than an
   * assumption spread through the renderer.
   */
  pointer: { x: number; y: number } | null;
  /**
   * Tonight's season. Passed in rather than read from the clock here: the app
   * already derives the night key once per tick, and a renderer that calls
   * `Date.now()` inside its own frame is a renderer that can disagree with the
   * panel sitting next to it about what month it is.
   */
  season: Season;
};

export function createWorldRenderer() {
  /**
   * TWO plates, with the live sky between them.
   *
   * `skyPlate` is the gradient, the gas dome and the moon; `plate` is
   * everything in front of the sky, on a transparent canvas. Stars and cloud
   * banks are drawn between the two every frame, so they can move while the
   * city still stands in front of them — which is the whole reason for the
   * split. One plate meant either a frozen sky or a rebuild every frame.
   */
  let skyPlate: HTMLCanvasElement | null = null;
  let plate: HTMLCanvasElement | null = null;
  let mirror: HTMLCanvasElement | null = null;
  let blocks: Block[] = [];
  let builds = 0;

  let cachedMid = '';
  let cachedW = 0;
  let cachedH = 0;
  let cachedDeck = -999;
  let cachedWeather: Weather | null = null;
  let cachedMoonY = -999;

  /**
   * The lit lights from the last frame, kept so a click can be tested against
   * them.
   *
   * Recomputing `lampSpots` for a hit test would be the wrong answer twice: it
   * walks every opening of every building, and it takes `progress`, so a test
   * run outside the frame could disagree with what is actually burning on
   * screen — you would click a lit window and be told there is nobody there.
   */
  let litWindows: LampSpot[] = [];

  const water = createWater();
  const life = createLife();
  const clock = createFrameClock();
  let lastTime = 0;

  function invalidate(): void {
    // BOTH. The split into two plates left this nulling only one of them, so
    // an explicit throw-away kept the old sky at the old size. The staleness
    // check below happens to catch a resize anyway, which is exactly why a
    // bug like this sits there.
    skyPlate = null;
    plate = null;
  }

  /**
   * `glow` is the emissive buffer: a second surface, the same size, carrying
   * nothing but light. CSS blurs it once and screen-blends it over the scene,
   * which is real bloom for the price of one blur — and, more to the point, it
   * is the only way the lights in this picture can belong to the same air
   * instead of each being sealed inside its own gradient.
   */
  function frame(
    target: CanvasRenderingContext2D,
    glow: CanvasRenderingContext2D,
    input: FrameInput,
  ): void {
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
      channelDrift(cachedMid, v.mid) > REDRAW_THRESHOLD ||
      Math.abs(cachedMoonY - moonPos(w, hz, progress).y) > MOON_THRESHOLD;

    if (stale) {
      // The skyline only regenerates on a size change. A city that reshuffles
      // every time the palette drifts is a city made of static.
      if (blocks.length === 0 || cachedW !== w || cachedH !== h) {
        // Only the near band gets the landmark: a second tower at a second
        // distance is a pair, and a pair has no centre.
        blocks = skyline(w, hz.cityTop, hz.cityBot, Math.round(w * 31 + h), 1, hz.landmarkTop);
      }

      const sv = skyPlate ?? document.createElement('canvas');
      sv.width = w;
      sv.height = h;
      const sg = sv.getContext('2d');
      if (sg) {
        sg.clearRect(0, 0, w, h);
        drawSkyPlate(sg, w, hz, v, progress, blocks, weather);
      }
      skyPlate = sv;

      const cv = plate ?? document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      if (g) {
        g.clearRect(0, 0, w, h);
        drawGroundPlate(g, w, hz, v, progress, blocks, weather);
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
          // Both plates, in order. The live sky is deliberately NOT in here:
          // a reflection rebuilt once per plate would freeze whatever the
          // clouds happened to be doing at that instant and then hold it,
          // which is worse than a river that reflects the sky's colour
          // without its weather.
          mg.drawImage(sv, 0, srcTop, w, mh, 0, 0, w, mh);
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
      cachedMoonY = moonPos(w, hz, progress).y;
    }

    const notch = clock.notch();
    // Clamped at BOTH ends. The cap was always here; the floor was not, and a
    // clock that ever went backwards handed a negative `dt` to the water,
    // which turned into a negative ripple radius and threw `IndexSizeError`
    // out of a canvas call. rAF is monotonic so it should not happen — but
    // "should not" is what a clamp is for, and it cost one call.
    const dt = lastTime === 0 ? 16 : Math.max(0, Math.min(64, timeMs - lastTime));
    lastTime = timeMs;
    water.update(dt, motion);

    const moon = moonPos(w, hz, progress);
    const lamps = lampSpots(w, hz, blocks, progress, fx, moon);
    litWindows = lamps.filter((l) => l.lit && l.kind === 'window');

    target.clearRect(0, 0, w, h);
    // CLEARED, not painted over. Its transparent pixels are what `screen`
    // leaves alone; a black fill would be screened too and lift the whole
    // frame off its own black.
    glow.clearRect(0, 0, w, h);

    /* Sky, then what is IN the sky, then everything in front of it.
       The stars twinkle and the banks drift here, between two cached images —
       which is the only place they can, because they have to move and the
       city has to occlude them. */
    if (skyPlate) target.drawImage(skyPlate, 0, 0);
    const moonAt = moonPos(w, hz, progress);
    const skySeed = Math.round(w * 13 + hz.h);
    drawStars(target, w, hz, v, moonAt, fx.fogScale, timeMs, skySeed);
    drawClouds(target, w, hz, v, moonAt, timeMs, motion, skySeed);
    if (plate) target.drawImage(plate, 0, 0);

    water.draw(target, w, hz, v, mirror, lamps, timeMs, motion, notch);
    drawWeather(target, w, hz, v, weather, blocks, water, timeMs, motion, notch);
    // The walker goes in BEFORE the fog, so the fog veils him the way it veils
    // everything else at that depth. Painted over it he would read as a decal.
    //
    // Engraving ink, NOT the vignette's: he stands out at the bridge, and the
    // frame-edge black would put him nearer than the stone he is on. And the
    // same `timeMs` the barge reads — one clock for the world, or the two of
    // them drift apart over a long session.
    drawWalker(target, w, hz, v, inkFor(v), timeMs, motion);

    drawFog(target, w, hz, v, timeMs, motion, fx.fogScale);
    // Between the fog and the halos, and it has to be exactly there. A beam is
    // lit fog, so the fog must already be down for it to cut into; and the halo
    // is the beam's source, so it must go on top or the lamp ends up behind its
    // own light. See shafts.ts.
    drawShafts(target, hz, v, lamps, fx.fogScale);
    /* Between the halos and the near vignette.
       After the halos because a moth is only legible as a dark speck crossing
       one — drawn before them it would be painted over by the very light that
       makes it visible. Before the vignette because the gate piers and the
       near lamp are closer than the parapet a rat runs along. */
    life.update(dt, hz, w, lamps, input.season, fx.rain > 0 || fx.snow > 0, motion);
    life.draw(target, glow, v, inkFor(v));

    drawLamps(target, glow, v, lamps, fx, timeMs, motion);
    // Last into the emissive buffer, so it lights everything the passes above
    // just put there rather than being lit by them.
    drawPointerLantern(glow, v, input.pointer, timeMs, motion);

    // The near vignette goes LAST. It is the closest thing in the picture, so
    // nothing may be painted over it — least of all the river, which would wash
    // the gate piers straight back out. Cheap enough to redraw every frame, and
    // it must be: the layers in front of the plate are all live.
    drawForeground(target, w, hz, VIGNETTE_INK);

    if (started !== 0) clock.sample(performance.now() - started);
  }

  /**
   * A stone, thrown at the river from wherever the pointer was.
   *
   * The geometry is `stoneSkip` in water.ts, which is where the ring field
   * lives; this only turns its answer into rings. Returns how many times the
   * stone bounced, or 0 for a throw that never touched the water — the count
   * is the whole of the game.
   */
  function skip(x: number, y: number, h: number, deckTop: number): number {
    const hits = stoneSkip(x, y, horizon(h, deckTop));
    for (const p of hits) water.ring(p.x, p.y, p.strength);
    return hits.length;
  }

  /**
   * The lit window nearest a click, or null.
   *
   * The tolerance is generous — a window is four pixels across and a finger is
   * not. It is measured in SCREEN distance rather than by a rectangle test so
   * that the nearest one wins when two are close, instead of whichever happens
   * to be first in the list.
   */
  function windowAt(x: number, y: number): LampSpot | null {
    let best: LampSpot | null = null;
    let bestD = 18 * 18;
    for (const s of litWindows) {
      const dx = s.x - x;
      const dy = s.y - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; best = s; }
    }
    return best;
  }

  return { frame, invalidate, skip, windowAt, plateBuilds: () => builds };
}
