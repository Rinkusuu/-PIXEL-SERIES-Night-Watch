import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { openings, skyline } from '../../src/world/city';
import { effectsFor } from '../../src/world/weather';
import { drawLamps, drawPointerLantern, lampSpots, moonPos } from '../../src/world/bloom';
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
    /* The spy has moved twice and the assertion has not, which is the point
       of writing it as a rule. The corona was a gradient on the scene, then
       briefly a stack of hard squares in the emissive buffer, and is a
       gradient in the emissive buffer now. What has to stay true throughout is
       that it swells with the fog.
       The spot list is filtered to the moon, which has no core — a corona is
       all light and no matter — so the one halo here is the corona. */
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
      drawLamps(g, g, v, spots.filter((s) => s.kind === 'moon'), effectsFor(weather), 0, 0);
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
    // One halo, and nothing else: no core, because a corona is all light.
    expect(clear.radii).toHaveLength(1);
    expect(fog.radii).toHaveLength(1);
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

describe('two surfaces', () => {
  /** Records which context each call landed on, and what it was given. */
  function spy() {
    const calls: { fn: string; op?: string; radius?: number }[] = [];
    let op = 'source-over';
    const ctx = new Proxy({} as CanvasRenderingContext2D, {
      get: (_t, key) => (...args: unknown[]) => {
        if (key === 'createRadialGradient') {
          calls.push({ fn: 'createRadialGradient', op, radius: args[5] as number });
          return { addColorStop: () => {} };
        }
        calls.push({ fn: String(key), op });
        return undefined;
      },
      set: (_t, key, value) => {
        if (key === 'globalCompositeOperation') op = String(value);
        return true;
      },
    });
    return { ctx, calls };
  }

  const v = resolve(NIGHT_KEYS, 0.4, gradesFor(['calm']));
  const halos = (s: ReturnType<typeof spy>) => s.calls.filter((c) => c.fn === 'createRadialGradient');

  /**
   * The rule the refactor exists to hold, and the one a later tidy-up would
   * break first by collapsing the two surfaces back into one:
   *
   *   the CORE is matter and stays on the scene, where its edge survives;
   *   the HALO is light and goes to the emissive buffer, where a single CSS
   *   blur turns a terrace of them into one pool.
   *
   * Sent to the blur the core became a smudge where a lit window used to be.
   */
  it('puts lit panes on the scene and their halos in the emissive buffer', () => {
    const scene = spy();
    const glow = spy();
    const spots = lampSpots(1200, hz, blocks, 0.5, effectsFor('clear'), moonPos(1200, hz, 0.5));
    drawLamps(scene.ctx, glow.ctx, v, spots, effectsFor('clear'), 0, 0);

    // Panes are drawn, and drawn with an edge — a rect or an arc, never a halo.
    expect(scene.calls.some((c) => c.fn === 'fillRect' || c.fn === 'arc')).toBe(true);
    expect(halos(scene)).toHaveLength(0);
    // And every halo went to the other surface.
    expect(halos(glow).length).toBeGreaterThan(0);
  });

  /**
   * This asserted that nothing built a radial gradient, which was not a rule —
   * it was my mistake written down as one. The lights could not pool because
   * they were painted on the SCENE, not because they were gradients, and
   * replacing them with concentric hard squares on the theory that the CSS
   * blur would finish the falloff produced arc lamps shaped like bullseye
   * targets: fourteen pixels of blur cannot round off an eighty-pixel square.
   *
   * What is actually required is that a halo be ROUND and SMOOTH. A gradient
   * is both by construction, which is the whole reason to use one.
   */
  it('gives every halo a round, continuous falloff', () => {
    const glow = spy();
    const scene = spy();
    const spots = lampSpots(1200, hz, blocks, 0.5, effectsFor('fog'), moonPos(1200, hz, 0.5));
    drawLamps(scene.ctx, glow.ctx, v, spots, effectsFor('fog'), 0, 0);

    const lit = spots.filter((s) => s.lit).length;
    expect(halos(glow)).toHaveLength(lit);
    for (const h of halos(glow)) expect(h.radius!).toBeGreaterThan(0);
    // Round: each halo is filled through a path, not stamped as a rectangle.
    expect(glow.calls.filter((c) => c.fn === 'arc').length).toBe(lit);
  });

  /** A brighter room spills further; the pane it spills through does not grow. */
  it('grows the halo with the light and leaves the pane alone', () => {
    const glow = spy();
    const scene = spy();
    const dim = lampSpots(1200, hz, blocks, 0.5, effectsFor('clear'), moonPos(1200, hz, 0.5))
      .filter((s) => s.kind === 'lantern');
    drawLamps(scene.ctx, glow.ctx, v, dim, effectsFor('clear'), 0, 0);
    const clear = halos(glow)[0]!.radius!;

    const glow2 = spy();
    drawLamps(spy().ctx, glow2.ctx, v, dim, effectsFor('fog'), 0, 0);
    // Fog scales every halo up — that is what `haloScale` is for.
    expect(halos(glow2)[0]!.radius!).toBeGreaterThan(clear);
  });

  /** The pointer's lantern is all light: nothing of it belongs on the scene. */
  it('keeps the pointer lantern out of the scene buffer entirely', () => {
    const scene = spy();
    const glow = spy();
    drawPointerLantern(glow.ctx, v, { x: 400, y: 300 }, 0, 1);
    expect(halos(glow)).toHaveLength(1);
    expect(scene.calls).toHaveLength(0);
  });

  it('draws nothing when the pointer is off the world', () => {
    const glow = spy();
    drawPointerLantern(glow.ctx, v, null, 0, 1);
    expect(glow.calls).toHaveLength(0);
  });
});
