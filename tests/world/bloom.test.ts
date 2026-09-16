import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { openings, skyline } from '../../src/world/city';
import { effectsFor } from '../../src/world/weather';
import { drawLamps, lampSpots, moonPos } from '../../src/world/bloom';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
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

describe('window lights come from real openings', () => {
  const centre = (o: { x: number; y: number; w: number; h: number }) =>
    `${Math.round(o.x + o.w / 2)},${Math.round(o.y + o.h / 2)}`;

  const spots = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'),
                          moonPos(1200, hz, 0.62));
  const windows = spots.filter((s) => s.kind === 'window');

  it('never invents a position of its own', () => {
    // Two modules computing window positions separately is how the glow ends up
    // beside the window instead of inside it.
    const legal = new Set<string>();
    for (const b of blocks) {
      for (const o of openings(b, hz.cityBot)) {
        if (o.kind === 'window') legal.add(centre(o));
      }
    }
    expect(windows.length).toBeGreaterThan(0);
    for (const s of windows) expect(legal.has(`${s.x},${s.y}`)).toBe(true);
  });

  it('never lights the same opening twice', () => {
    expect(new Set(windows.map((s) => `${s.x},${s.y}`)).size).toBe(windows.length);
  });

  it('scatters them instead of marching in from one edge', () => {
    const xs = windows.map((s) => s.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1200 * 0.4);
  });

  it('only ever adds windows as the night deepens, never blinks one off', () => {
    // The lottery ticket is a pure function of the opening's index, so a rising
    // threshold can only let more through. A window that went dark because its
    // neighbour lit would read as a rendering fault, not as a city.
    const at = (p: number) => new Set(
      lampSpots(1200, hz, blocks, p, effectsFor('clear'), moonPos(1200, hz, p))
        .filter((s) => s.kind === 'window')
        .map((s) => `${s.x},${s.y}`),
    );
    const quiet = at(0);
    const peak = at(0.62);
    expect(peak.size).toBeGreaterThan(quiet.size);
    for (const k of quiet) expect(peak.has(k)).toBe(true);
  });

  it('is identical frame to frame', () => {
    // lampSpots runs every frame. Anything stateful in here would flicker.
    const a = lampSpots(1200, hz, blocks, 0.4, effectsFor('clear'), moonPos(1200, hz, 0.4));
    const b = lampSpots(1200, hz, blocks, 0.4, effectsFor('clear'), moonPos(1200, hz, 0.4));
    expect(a).toEqual(b);
  });

  it('clusters the lit windows into households rather than sprinkling them', () => {
    // A per-window roll alone gives a uniform sprinkle. Real streets have dark
    // houses beside bright ones, so the threshold carries a per-building term.
    // Measured as: the buildings that are lit at all carry more than one window
    // each, on average.
    const lit = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'), moonPos(1200, hz, 0.62))
      .filter((s) => s.kind === 'window');
    const homes = new Set(
      lit.map((s) => blocks.findIndex((b) => s.x >= b.x && s.x <= b.x + b.w)),
    );
    expect(lit.length / homes.size).toBeGreaterThan(1.6);
  });
});

describe('the moon carries the picture', () => {
  it('is far bigger than any gas lamp', () => {
    const spots = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const moon = spots.find((s) => s.kind === 'moon')!;
    const lamp = spots.find((s) => s.kind === 'bridge')!;
    expect(moon.r).toBeGreaterThan(lamp.r * 7);
  });

  it('wears a corona that is moisture, not light', () => {
    // The corona swells with the fog and all but vanishes on the clearest
    // night. That is what ties the weather to the moon without a knob for it.
    const radii: number[] = [];
    const alphas: number[] = [];
    const g = new Proxy({} as CanvasRenderingContext2D, {
      get(_t, key) {
        if (key === 'createRadialGradient') {
          return (_x0: number, _y0: number, _r0: number, _x1: number, _y1: number, r1: number) => {
            radii.push(r1);
            return { addColorStop: () => {} };
          };
        }
        return () => {};
      },
      set: (_t, key, value) => {
        if (key === 'globalAlpha') alphas.push(value as number);
        return true;
      },
    });

    const draw = (weather: Parameters<typeof effectsFor>[0]) => {
      radii.length = 0; alphas.length = 0;
      const v = resolve(NIGHT_KEYS, 0.35, gradesFor(['calm']));
      const spots = lampSpots(1200, hz, blocks, 0.35, effectsFor(weather),
                              moonPos(1200, hz, 0.35));
      drawLamps(g, v, spots.filter((s) => s.kind === 'moon'), effectsFor(weather), 0, 0);
      return { radii: [...radii], alphas: [...alphas] };
    };

    const clear = draw('clear');
    const fog = draw('fog');

    // ONE blob for the moon now, and that is the point. The tight halo and the
    // disc moved to `sky.ts`, onto the plate, so the city can stand in front of
    // them; drawn in this pass they sat on top of the finished picture and the
    // moon floated in front of the buildings. What is left here is the wide
    // corona, which belongs in front — it is moisture in the air between you
    // and everything else.
    expect(clear.radii.length).toBe(1);
    // And it grows in the fog.
    expect(fog.radii[0]).toBeGreaterThan(clear.radii[0]!);
  });

  it('grows again on a full moon', () => {
    const plain = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const full = lampSpots(1440, hz, blocks, 0.5, effectsFor('fullmoon'), moonPos(1440, hz, 0.5));
    const r = (s: typeof plain) => s.find((v) => v.kind === 'moon')!.r;
    expect(r(full)).toBeGreaterThan(r(plain));
  });
});
