import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import type { Block } from './city';
import type { Horizon } from './horizon';
import { FAR_SCALE, MID_SCALE, drawSkyline, skyline } from './city';
import { drawBridge } from './bridge';
import { drawDeck } from './deck';
import { valueLadder } from './ladder';
import { drawWatcher } from './figure';
import { drawBank } from './bank';
import { drawSky } from './sky';
import { MOON_BASE_R, moonPos } from './bloom';
import { effectsFor, type Weather } from './weather';
import { ditherPattern } from './dither';

/**
 * Engraving ink. Pushed most of the way to black so the hatching still reads
 * against the fog, which is now the brightest thing in the picture rather than
 * a dark veil over it.
 */
export function inkFor(v: AmbientValues): string {
  return rgbToHex(mixRgb(hexToRgb(v.sky[2]), [4, 6, 8], 0.82));
}

/**
 * The lit and shadowed faces of a body on a given rung.
 *
 * Both are mixed from the SAME two anchors every other depth uses — the fog
 * above and the ink below — so a building's three values stay on the one ladder
 * instead of forming a private scale of their own. `strength` is how far the
 * band is allowed to separate: the far band gets half, because distance takes
 * value separation before it takes anything else.
 */
export function facets(
  fill: string, v: AmbientValues, strength: number,
): { lit: string; shade: string } {
  const body = hexToRgb(fill);
  return {
    lit: rgbToHex(mixRgb(body, hexToRgb(v.sky[2]), 0.30 * strength)),
    shade: rgbToHex(mixRgb(body, [4, 6, 8], 0.34 * strength)),
  };
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
  //     Dithered, not a browser gradient. This is the single largest soft
  //     field in the picture, so it is the one that most decides whether the
  //     whole thing reads as pixel art or as CSS — DNA §9.1. Built once per
  //     plate rebuild, from a four-pixel tile: see dither.ts for why that is
  //     the whole pattern and not an approximation of it.
  const sky = ditherPattern(g, hz.waterTop, [
    { at: 0, color: hexToRgb(v.sky[0]) },
    { at: 0.55, color: hexToRgb(v.sky[1]) },
    { at: 1, color: hexToRgb(v.sky[2]) },
  ]);
  if (sky) {
    g.fillStyle = sky;
  } else {
    // No 2-D context for the tile (jsdom, and some privacy modes). A smooth
    // gradient is the right fallback: wrong texture beats no sky.
    const grad = g.createLinearGradient(0, 0, 0, hz.waterTop);
    grad.addColorStop(0, v.sky[0]);
    grad.addColorStop(0.55, v.sky[1]);
    grad.addColorStop(1, v.sky[2]);
    g.fillStyle = grad;
  }
  g.fillRect(0, 0, w, hz.waterTop);

  const ink = inkFor(v);
  const wet = weather === 'rain' ? 0.18 : 0;
  const ladder = valueLadder(v, wet);

  // 1b — what is IN the sky. Stars, the gas dome over the city, and the cloud
  //      banks, in that order back to front. The moon's position comes from
  //      bloom.ts rather than a second guess here: the clouds are lit from it,
  //      and a rim on the wrong side is worse than no rim.
  const fx = effectsFor(weather);
  drawSky(
    g, w, hz, v, blocks, moonPos(w, hz, progress), MOON_BASE_R * fx.moonScale,
    fx.fogScale, ink, Math.round(w * 13 + hz.h),
  );

  // 2 — the band BEHIND the skyline. Its own seed, so its towers land between
  //     the near ones rather than behind them, and a much paler fill: the whole
  //     signal of "further away" is that it is closer to the fog's own value.
  //     Generated here rather than in the renderer because nothing outside the
  //     plate ever needs it — only the near band feeds smoke its chimneys.
  const far = skyline(w, hz.cityTopFar, hz.cityBot, Math.round(w * 17 + hz.h), FAR_SCALE);
  drawSkyline(g, far, hz.cityBot, {
    fill: ladder.cityFar,
    ink,
    // Half the near band's separation. Distance flattens VALUE before it takes
    // detail away — a far tower with the near band's shading would step in
    // front of it however pale its body is.
    ...facets(ladder.cityFar, v, 0.5),
    density: 0.18,
    openings: false,
    details: false,
  });

  // 2b — the band BETWEEN. Its own seed again, so its towers land in neither
  //      of the other two bands' gaps by accident. Openings yes, details no: at
  //      0.78 a window is still a window, but a crocket is four pixels and at
  //      that scale a band of them reads as grit.
  const mid = skyline(w, hz.cityTopMid, hz.cityBot, Math.round(w * 23 + hz.h), MID_SCALE);
  drawSkyline(g, mid, hz.cityBot, {
    fill: ladder.cityMid,
    ink,
    ...facets(ladder.cityMid, v, 0.75),
    density: 0.26,
    openings: true,
    details: false,
  });

  // 3 — far city, veiled by distance.
  drawSkyline(g, blocks, hz.cityBot, {
    fill: ladder.city,
    ink,
    ...facets(ladder.city, v, 1),
    density: 0.34,
    openings: true,
    details: true,
  });

  // 3b — the far bank. Drawn between the city and the bridge, so the bridge
  //      covers it everywhere except through its own arches — which is the only
  //      place it can be seen at all, and the reason each arch stops being a
  //      hole with a gradient in it. See bank.ts.
  drawBank(g, w, hz, {
    // Between the city's rung and the bridge's, but MOST of the way to the
    // bridge. At 0.45 the quay now fills the whole arch void, and a void that
    // much paler than the stone around it turns a bridge into a row of lit
    // eggs — the exact failure the void's own colour was moved onto the ladder
    // to fix. It has to be readably behind the stone and no further: what
    // carries the depth is the coping line and the wet foot, not the value gap.
    wall: rgbToHex(mixRgb(hexToRgb(ladder.city), hexToRgb(ladder.bridge), 0.72)),
    ink,
    dark: ladder.deck,
  }, Math.round(w * 7 + hz.h));

  // 4 — upstream bridge, standing in front of the city's feet. That overlap is
  //     what gives the picture its depth.
  drawBridge(g, w, hz, {
    fill: ladder.bridge,
    ink,
    ...facets(ladder.bridge, v, 1),
    density: 0.52,
    // What you see through an arch is the far bank, further away than the stone
    // around it — so both stops come from the ladder, like every other depth,
    // and both are PALER than `bridge`. The lower stop is the paler of the two:
    // the springing is the waterline, the furthest point in the picture and the
    // height fog pools at. It used to be handed `deck` — the nearest rung on
    // the whole ladder — which made each void darker at the bottom than the
    // stone surrounding it. See `BridgeStyle.hazeBot`.
    hazeTop: ladder.city,
    hazeBot: ladder.cityFar,
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
