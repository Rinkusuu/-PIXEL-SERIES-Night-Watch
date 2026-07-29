import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { drawBank } from '../../src/world/bank';
import { horizon } from '../../src/world/horizon';
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

  it('lets the bank show through the arches instead of painting over it', () => {
    // drawBridge used to fill its voids opaquely. Distance is supposed to veil
    // what is through an opening, not replace it.
    const src = readFileSync('src/world/bridge.ts', 'utf8');
    const haze = src.indexOf('const haze =');
    const fill = src.indexOf('.fill()', haze);
    expect(src.slice(haze, fill)).toContain('globalAlpha');
  });
});
