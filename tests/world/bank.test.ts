import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { drawBank, quayTop } from '../../src/world/bank';
import { archCrown } from '../../src/world/bridge';
import { horizon } from '../../src/world/horizon';
import { LADDER_STOPS } from '../../src/world/ladder';
import { countingCtx } from '../helpers/counting-ctx';

const hz = horizon(862, Math.round(862 * 0.66));
const style = { wall: '#2a3a3c', ink: '#0a0e10', dark: '#141c1e' };

describe('the far bank', () => {
  it('sits where the arches actually open onto', () => {
    // The whole reason this band exists: cityBot falls INSIDE the bridge's own
    // band, so the city's waterfront is hidden across the entire frame and the
    // arch voids are the only place anything behind the bridge can be seen.
    expect(hz.bridgeTop).toBeLessThan(hz.cityBot);
    expect(hz.cityBot).toBeLessThan(hz.bridgeBot);
  });

  it('walls off every storey the arches would otherwise show', () => {
    // The wall has to reach the underside of the roadway. Any gap between its
    // coping and the arch crown is a strip of the city's lower floors, at the
    // same window scale as the towers standing ABOVE the roadway — which is
    // what made the city read as standing in the river. At every viewport.
    for (const h of [520, 700, 862, 1100, 1600]) {
      for (const f of [0.54, 0.66, 0.8]) {
        const z = horizon(h, Math.round(h * f));
        expect(quayTop(z)).toBeLessThanOrEqual(archCrown(z));
        expect(quayTop(z)).toBeLessThan(z.cityBot);
      }
    }
  });

  it('keeps everything it draws ABOVE the waterline', () => {
    // The live river fills from waterTop down, opaquely, over this plate every
    // frame. Anything moored below the line would be washed straight back out —
    // the same trap the vignette fell into before it moved to the last pass.
    let lowest = -Infinity;
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_t, key) {
        if (key === 'fillRect') {
          return (_x: number, y: number, _w: number, h: number) => {
            lowest = Math.max(lowest, y + h);
          };
        }
        if (key === 'createLinearGradient' || key === 'createRadialGradient') {
          return () => ({ addColorStop: () => {} });
        }
        return () => {};
      },
      set: () => true,
    });
    drawBank(g, 1440, hz, style, 31);
    expect(lowest).toBeLessThanOrEqual(hz.cityBot);
  });

  it('draws its stone, its lines and its furniture', () => {
    const c = countingCtx();
    drawBank(c.g, 1440, hz, style, 31);
    expect(c.calls()).toBeGreaterThan(0);
    // Two courses along the coping. One line reads as an edge; two read as
    // dressed stone.
    expect(c.strokes()).toBe(2);
  });

  it('is deterministic for a seed', () => {
    const a = countingCtx();
    const b = countingCtx();
    drawBank(a.g, 1440, hz, style, 31);
    drawBank(b.g, 1440, hz, style, 31);
    expect(a.calls()).toBe(b.calls());
  });

  it('goes in behind the bridge, never in front of it', () => {
    const src = readFileSync('src/world/layers.ts', 'utf8');
    expect(src.indexOf('drawBank(')).toBeLessThan(src.indexOf('drawBridge('));
    expect(src.indexOf('drawSkyline(')).toBeLessThan(src.indexOf('drawBank('));
  });

  it('veils the arch voids toward the fog, never toward the near stone', () => {
    // Aerial perspective, and it is not a matter of taste: the springing of an
    // arch is the far bank's waterline, the furthest point in the picture. Both
    // haze stops must sit further from the ink than `bridge`, and the LOWER
    // stop must be the paler of the two. `hazeBot` was `deck` — the nearest
    // rung on the ladder — and every arch went darker at the bottom than the
    // stone around it.
    const src = readFileSync('src/world/layers.ts', 'utf8');
    const top = /hazeTop:\s*ladder\.(\w+)/.exec(src)?.[1] as keyof typeof LADDER_STOPS;
    const bot = /hazeBot:\s*ladder\.(\w+)/.exec(src)?.[1] as keyof typeof LADDER_STOPS;
    expect(LADDER_STOPS[bot]).toBeLessThan(LADDER_STOPS[top]);
    expect(LADDER_STOPS[top]).toBeLessThan(LADDER_STOPS.bridge);
  });

  it('lets the bank show through the arches instead of painting over it', () => {
    // drawBridge used to fill its voids opaquely. Distance is supposed to veil
    // what is through an opening, not replace it.
    const src = readFileSync('src/world/bridge.ts', 'utf8');
    const haze = src.indexOf('const haze =');
    const fill = src.indexOf('.fill()', haze);
    expect(src.slice(haze, fill)).toContain('globalAlpha');
  });
});
