import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import type { Block } from './city';
import type { Horizon } from './horizon';
import { HATCH_ANGLES } from './hatch';
import { FAR_SCALE, drawSkyline, skyline } from './city';
import { drawBridge } from './bridge';
import { drawDeck } from './deck';
import { valueLadder } from './ladder';
import { drawWatcher } from './figure';
import { drawSky } from './sky';
import { moonPos } from './bloom';
import { effectsFor, type Weather } from './weather';

/**
 * Engraving ink. Pushed most of the way to black so the hatching still reads
 * against the fog, which is now the brightest thing in the picture rather than
 * a dark veil over it.
 */
export function inkFor(v: AmbientValues): string {
  return rgbToHex(mixRgb(hexToRgb(v.sky[2]), [4, 6, 8], 0.82));
}

/**
 * The static plate: everything that only changes when the palette, the size, or
 * the weather does.
 *
 * Not one composition number is computed here — they all come from `hz`. Not one
 * depth value either — they all come from `valueLadder`.
 */
export function drawStatic(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  progress: number,
  blocks: readonly Block[],
  weather: Weather,
): void {
  // 1 — sky. Three stops, never two (DNA §3.3). The only unhatched surface in
  //     the picture: it is the blank paper everything else is cut into.
  const sky = g.createLinearGradient(0, 0, 0, hz.waterTop);
  sky.addColorStop(0, v.sky[0]);
  sky.addColorStop(0.55, v.sky[1]);
  sky.addColorStop(1, v.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, hz.waterTop);

  const ink = inkFor(v);
  const wet = weather === 'rain' ? 0.18 : 0;
  const ladder = valueLadder(v, wet);

  // 1b — what is IN the sky. Stars, the gas dome over the city, and the cloud
  //      banks, in that order back to front. The moon's position comes from
  //      bloom.ts rather than a second guess here: the clouds are lit from it,
  //      and a rim on the wrong side is worse than no rim.
  drawSky(
    g, w, hz, v, blocks, moonPos(w, hz, progress),
    effectsFor(weather).fogScale, ink, Math.round(w * 13 + hz.h),
  );

  // 2 — the band BEHIND the skyline. Its own seed, so its towers land between
  //     the near ones rather than behind them, and a much paler fill: the whole
  //     signal of "further away" is that it is closer to the fog's own value.
  //     Generated here rather than in the renderer because nothing outside the
  //     plate ever needs it — only the near band feeds smoke its chimneys.
  const far = skyline(w, hz.cityTop, hz.cityBot, Math.round(w * 17 + hz.h), FAR_SCALE);
  drawSkyline(g, far, hz.cityBot, {
    angle: HATCH_ANGLES.far,
    fill: ladder.cityFar,
    ink,
    density: 0.18,
    openings: false,
    details: false,
  });

  // 3 — far city, veiled by distance.
  drawSkyline(g, blocks, hz.cityBot, {
    angle: HATCH_ANGLES.far,
    fill: ladder.city,
    ink,
    density: 0.34,
    openings: true,
    details: true,
  });

  // 4 — upstream bridge, standing in front of the city's feet. That overlap is
  //     what gives the picture its depth.
  drawBridge(g, w, hz, {
    fill: ladder.bridge,
    ink,
    density: 0.52,
    // What you see through an arch is the city's own feet, one rung further
    // away than the stone around it — so it comes from the ladder, like every
    // other depth. Hand-mixing it off `sky[2]` put the voids on a scale of
    // their own, well above the fog, and a dozen arches lit up like a row of
    // eggs instead of reading as openings.
    hazeTop: ladder.city,
    hazeBot: ladder.deck,
  });

  // 4b — the watcher on the upstream bridge. Drawn after the bridge he stands
  //      on and before the near stone, so the deck can never occlude him and he
  //      can never float in front of the river.
  drawWatcher(g, w, hz, v, ink);

  // 5 — the stone you are standing on.
  drawDeck(g, w, hz, { fill: ladder.deck, ink, rail: ladder.rail });

  // The near vignette is NOT drawn here. It belongs in front of the river, the
  // fog and the lamps, all of which are painted live over this plate — put it on
  // the plate and the water washes the gate piers straight back out. The
  // renderer draws it last. See renderer.ts.

  void progress;
}
