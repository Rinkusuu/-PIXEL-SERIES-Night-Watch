import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { skyline } from '../../src/world/city';
import { effectsFor } from '../../src/world/weather';
import { lampSpots, moonPos } from '../../src/world/bloom';
import { lanternAnchor } from '../../src/world/foreground';

const hz = horizon(900, 900 * 0.66);
const blocks = skyline(1200, hz.cityTop, hz.cityBot, 5);

describe('lampSpots', () => {
  const spots = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'), moonPos(1200, hz, 0.62));

  it('puts every window inside a real building, never in the sky', () => {
    for (const s of spots.filter((v) => v.kind === 'window')) {
      const home = blocks.find((b) => s.x >= b.x && s.x <= b.x + b.w);
      expect(home).toBeDefined();
      expect(s.y).toBeGreaterThanOrEqual(home!.top);
      expect(s.y).toBeLessThanOrEqual(hz.cityBot);
    }
  });

  it('stands the bridge lamps on the piers, above the water', () => {
    const bridge = spots.filter((s) => s.kind === 'bridge');
    expect(bridge.length).toBeGreaterThan(1);
    for (const s of bridge) expect(s.y).toBeLessThan(hz.waterTop);
  });

  it('never lets the near lantern go out — addendum §D.1', () => {
    for (const p of [0, 0.5, 1]) {
      const s = lampSpots(1200, hz, blocks, p, effectsFor('fog'), moonPos(1200, hz, p));
      const lantern = s.find((v) => v.kind === 'lantern');
      expect(lantern?.lit).toBe(true);
    }
  });

  it('lights fewer windows at dawn than at the thickest fog', () => {
    const peak = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'), moonPos(1200, hz, 0.62));
    const dawn = lampSpots(1200, hz, blocks, 1, effectsFor('clear'), moonPos(1200, hz, 1));
    const lit = (s: typeof peak) => s.filter((v) => v.kind === 'window' && v.lit).length;
    expect(lit(dawn)).toBeLessThan(lit(peak));
  });

  it('offers the moon to the water as a light like any other', () => {
    expect(spots.some((s) => s.kind === 'moon' && s.lit)).toBe(true);
  });
});

describe('moonPos', () => {
  it('rises as the night wears on', () => {
    expect(moonPos(1200, hz, 1).y).toBeLessThan(moonPos(1200, hz, 0).y);
  });
  it('stays in the sky, above the city roofs', () => {
    expect(moonPos(1200, hz, 0).y).toBeLessThan(hz.waterTop);
  });
});

describe('the lantern sits in its own housing', () => {
  it('takes its position from foreground.ts, not from a second guess', () => {
    // Two modules computing the same position separately is how the flame ends
    // up floating beside the lamp instead of inside it.
    const spots = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const lantern = spots.find((s) => s.kind === 'lantern')!;
    const anchor = lanternAnchor(1440, hz);
    expect({ x: lantern.x, y: lantern.y }).toEqual(anchor);
  });

  it('still never goes out', () => {
    for (const p of [0, 0.5, 1]) {
      const spots = lampSpots(1440, hz, blocks, p, effectsFor('fog'), moonPos(1440, hz, p));
      expect(spots.find((s) => s.kind === 'lantern')!.lit).toBe(true);
    }
  });
});

describe('the moon carries the picture', () => {
  it('is far bigger than any gas lamp', () => {
    const spots = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const moon = spots.find((s) => s.kind === 'moon')!;
    const lamp = spots.find((s) => s.kind === 'bridge')!;
    expect(moon.r).toBeGreaterThan(lamp.r * 7);
  });

  it('grows again on a full moon', () => {
    const plain = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const full = lampSpots(1440, hz, blocks, 0.5, effectsFor('fullmoon'), moonPos(1440, hz, 0.5));
    const r = (s: typeof plain) => s.find((v) => v.kind === 'moon')!.r;
    expect(r(full)).toBeGreaterThan(r(plain));
  });
});
