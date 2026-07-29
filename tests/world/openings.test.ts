import { describe, expect, it } from 'vitest';
import { openings, skyline } from '../../src/world/city';

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
