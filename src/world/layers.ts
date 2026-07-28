import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import type { Block } from './city';
import type { Horizon } from './horizon';
import type { Weather } from './weather';
import { HATCH_ANGLES } from './hatch';
import { drawSkyline } from './city';
import { drawBridge } from './bridge';
import { drawDeck } from './deck';

/**
 * Engraving ink. `--amb-deep` alone is too close to the sky at night and the
 * whole plate washes out; the ink is pushed most of the way to black so the
 * hatching still reads at lum 0.08.
 */
export function inkFor(v: AmbientValues): string {
  return rgbToHex(mixRgb(hexToRgb(v.deep), [2, 3, 6], 0.62));
}

/**
 * The static plate: everything that only changes when the palette, the size, or
 * the weather does. The river, the lamps, the smoke and the fog are drawn live
 * on top of this by the renderer.
 *
 * Not one composition number is computed here — they all come from `hz`.
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
  const deepRgb = hexToRgb(v.deep);
  const skyMid = hexToRgb(v.sky[1]);

  // 2 — far city.
  drawSkyline(g, blocks, hz.cityBot, {
    angle: HATCH_ANGLES.far,
    fill: rgbToHex(mixRgb(skyMid, deepRgb, 0.55)),
    ink,
    density: 0.34,
    maxGap: 13,
  });

  // 3 — upstream bridge, standing in front of the city's feet. That overlap is
  //     what gives the picture its depth.
  drawBridge(g, w, hz, {
    fill: rgbToHex(mixRgb(skyMid, deepRgb, 0.82)),
    ink,
    density: 0.52,
    // Pulled well down toward the stone. At full horizon brightness the voids
    // stop reading as openings and start reading as lamps.
    hazeTop: rgbToHex(mixRgb(hexToRgb(v.sky[2]), hexToRgb(v.mid), 0.58)),
    hazeBot: v.deep,
  });

  // 4 — the stone you are standing on. Wet on a rainy night: darker, so the
  //     live reflections read stronger against it.
  const wet = weather === 'rain' ? 0.18 : 0;
  drawDeck(g, w, hz, {
    fill: rgbToHex(mixRgb(deepRgb, [2, 3, 6], 0.35 + wet + progress * 0.05)),
    ink,
    rail: rgbToHex(mixRgb(deepRgb, [2, 3, 6], 0.18 + wet)),
  });
}
