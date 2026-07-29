import { describe, expect, it } from 'vitest';
import { drawSkyline, openings, skyline } from '../../src/world/city';
import { countingCtx } from '../helpers/counting-ctx';

const BANDS: readonly (readonly [number, number, number])[] = [
  [1400, 100, 460],
  [900, 60, 300],
  [1920, 140, 520],
];

describe('openings', () => {
  it('keeps every opening inside the block it belongs to', () => {
    // The spire aspect guarantee makes towers narrow; a fixed-pitch grid spills
    // straight out of a narrow shaft unless it is clamped.
    for (const [w, top, bot] of BANDS) {
      for (const seed of [17, 91, 404]) {
        for (const b of skyline(w, top, bot, seed)) {
          for (const o of openings(b, bot)) {
            const where = `${b.kind} x=${b.x} w=${b.w}`;
            expect(o.x, where).toBeGreaterThanOrEqual(b.x);
            expect(o.x + o.w, where).toBeLessThanOrEqual(b.x + b.w);
            expect(o.y, where).toBeGreaterThanOrEqual(b.top);
            expect(o.y + o.h, where).toBeLessThanOrEqual(bot);
            expect(o.w, where).toBeGreaterThan(0);
            expect(o.h, where).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('is deterministic', () => {
    const b = skyline(1400, 100, 460, 17)[3]!;
    expect(openings(b, 460)).toEqual(openings(b, 460));
  });

  it('gives the clock tower exactly one clock', () => {
    // A landmark is only a landmark once, and that holds for its face too.
    for (const [w, top, bot] of BANDS) {
      const tower = skyline(w, top, bot, 17).find((b) => b.kind === 'clockTower')!;
      expect(openings(tower, bot).filter((o) => o.kind === 'clock')).toHaveLength(1);
    }
  });

  it('leaves cranes blank — a shed with a jib has nothing to light', () => {
    for (const b of skyline(1400, 100, 460, 17).filter((v) => v.kind === 'crane')) {
      expect(openings(b, 460)).toEqual([]);
    }
  });

  it('returns nothing rather than a clipped row when a block is too small', () => {
    expect(openings({ kind: 'flat', x: 0, w: 8, top: 0 }, 9)).toEqual([]);
  });

  it('puts windows on the boxes that carry most of the city', () => {
    // Boxes are the backbone of the skyline, so if they were blank the city
    // would be blank. This is the test that would catch a regression in
    // pickKind as much as one in the grid.
    const blocks = skyline(1400, 100, 460, 17);
    const boxes = blocks.filter((b) => b.kind === 'flat' || b.kind === 'gable');
    expect(boxes.length).toBeGreaterThan(blocks.length * 0.4);
    const lit = boxes.filter((b) => openings(b, 460).length > 0);
    expect(lit.length).toBeGreaterThan(boxes.length * 0.5);
  });

  it('gives the city enough windows for the gas to have somewhere to be', () => {
    const total = skyline(1400, 100, 460, 17)
      .flatMap((b) => openings(b, 460))
      .filter((o) => o.kind === 'window').length;
    expect(total).toBeGreaterThan(100);
  });
});

describe('openings are cut into the plate', () => {
  const blocks = skyline(1400, 100, 460, 17);
  const style = {
    angle: -0.42, fill: '#222', ink: '#000', density: 0.34, details: false,
  };

  it('does more drawing when the openings are switched on', () => {
    const off = countingCtx();
    const on = countingCtx();
    drawSkyline(off.g, blocks, 460, { ...style, openings: false });
    drawSkyline(on.g, blocks, 460, { ...style, openings: true });
    expect(on.calls()).toBeGreaterThan(off.calls());
  });

  it('draws one call per opening, so none are silently dropped', () => {
    const off = countingCtx();
    const on = countingCtx();
    drawSkyline(off.g, blocks, 460, { ...style, openings: false });
    drawSkyline(on.g, blocks, 460, { ...style, openings: true });
    const total = blocks.flatMap((b) => openings(b, 460));
    const rects = total.filter((o) => o.kind !== 'clock').length;
    const clocks = total.filter((o) => o.kind === 'clock').length;
    // A rect is one fillRect; a clock face is beginPath + arc + fill. The
    // fillStyle and globalAlpha assignments around them are property SETS, and
    // countingCtx only counts gets.
    expect(on.calls() - off.calls()).toBe(rects + clocks * 3);
  });
});
