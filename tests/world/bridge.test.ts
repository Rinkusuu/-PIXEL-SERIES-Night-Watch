import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { ARCH_RISE, piers } from '../../src/world/bridge';

describe('piers', () => {
  const hz = horizon(900, 900 * 0.66);
  const p = piers(1400, hz);

  it('spans the frame from edge to edge', () => {
    expect(p[0]!.x).toBeLessThanOrEqual(0);
    expect(p[p.length - 1]!.x + p[p.length - 1]!.w).toBeGreaterThanOrEqual(1400);
  });

  it('spaces them evenly, so the arches are a rhythm not a scatter', () => {
    const gaps = p.slice(1).map((q, i) => q.x - p[i]!.x);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6);
  });

  it('sinks every pier below the waterline', () => {
    for (const q of p) expect(q.bot).toBeGreaterThan(hz.waterTop);
  });

  it('keeps arches segmental — flatter than a semicircle', () => {
    // A semicircular arch would rise by half the span. Roman aqueduct, not
    // Victorian Thames.
    expect(ARCH_RISE).toBeLessThan(0.5);
    expect(ARCH_RISE).toBeGreaterThan(0.15);
  });

  it('is deterministic for a size', () => {
    expect(piers(1400, hz)).toEqual(piers(1400, hz));
  });
});
