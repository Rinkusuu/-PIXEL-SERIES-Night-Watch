import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { balusters, settRows } from '../../src/world/deck';
import { gateSpans } from '../../src/world/foreground';

describe('settRows', () => {
  const hz = horizon(900, 900 * 0.66);
  const rows = settRows(hz);

  it('starts at the deck and ends at the bottom of the frame', () => {
    expect(rows[0]).toBeGreaterThanOrEqual(hz.deckTop);
    expect(rows[rows.length - 1]).toBeLessThanOrEqual(hz.h);
  });

  it('spaces rows wider as the stones come toward you', () => {
    const gaps = rows.slice(1).map((y, i) => y - rows[i]!);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!).toBeGreaterThan(gaps[i - 1]!);
    }
  });

  it('gives enough rows to read as paving, not as a floor', () => {
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });
});

describe('balusters', () => {
  const b = balusters(1000);

  it('covers the full width', () => {
    expect(b[0]!.x).toBeLessThanOrEqual(0);
    expect(b[b.length - 1]!.x + b[b.length - 1]!.w).toBeGreaterThanOrEqual(1000);
  });

  it('leaves a gap between each, or it is a wall not a balustrade', () => {
    const pitch = b[1]!.x - b[0]!.x;
    expect(pitch).toBeGreaterThan(b[0]!.w);
  });

  it('is deterministic', () => {
    expect(balusters(1000)).toEqual(balusters(1000));
  });

  it('stands clear of both gates', () => {
    // A run of stone posts marching straight through a gateway says the
    // ironwork is painted on the parapet rather than set into it.
    for (const w of [900, 1000, 1440, 1920]) {
      for (const gt of gateSpans(w)) {
        const inside = balusters(w).filter((p) => p.x + p.w > gt.x0 && p.x < gt.x1);
        expect(inside, `w=${w}`).toHaveLength(0);
      }
    }
  });

  it('carries the run on heavier newels', () => {
    // A balustrade of identical posts has no rhythm and, more to the point,
    // nothing holding it up.
    const all = balusters(1440);
    const newels = all.filter((p) => p.newel);
    expect(newels.length).toBeGreaterThan(3);
    expect(newels.length).toBeLessThan(all.length / 4);
    for (const n of newels) expect(n.w).toBeGreaterThan(all.find((p) => !p.newel)!.w);
  });
});
