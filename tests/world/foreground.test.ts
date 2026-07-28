import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { horizon } from '../../src/world/horizon';
import { GATE_X, STANDARD_X, lanternAnchor } from '../../src/world/foreground';

const hz = horizon(900, 900 * 0.66);

describe('placement', () => {
  it('hugs both edges without leaving the frame', () => {
    expect(GATE_X.left).toBeGreaterThan(0);
    expect(GATE_X.left).toBeLessThan(0.06);
    expect(GATE_X.right).toBeGreaterThan(0.94);
    expect(GATE_X.right).toBeLessThan(1);
  });

  it('stands the gas standard inside the left gate pier, not on top of it', () => {
    expect(STANDARD_X).toBeGreaterThan(GATE_X.left);
    expect(STANDARD_X).toBeLessThan(0.2);
  });

  it('hangs the lantern above the deck and below the bridge', () => {
    const a = lanternAnchor(1440, hz);
    expect(a.y).toBeLessThan(hz.deckTop);
    expect(a.y).toBeGreaterThan(hz.bridgeTop);
  });

  it('reaches the bracket arm inward, so the flame clears the shaft', () => {
    const a = lanternAnchor(1440, hz);
    expect(a.x).toBeGreaterThan(STANDARD_X * 1440);
  });

  it('is deterministic', () => {
    expect(lanternAnchor(1440, hz)).toEqual(lanternAnchor(1440, hz));
  });
});

describe('the vignette never touches the ambient palette', () => {
  const src = readFileSync('src/world/foreground.ts', 'utf8');

  it('takes its ink as an argument and derives nothing', () => {
    expect(src).not.toContain('AmbientValues');
    expect(src).not.toContain('v.sky');
    expect(src).not.toContain('v.deep');
  });

  it('reads every vertical bound off the Horizon, inventing no fractions', () => {
    // tests/smoke.test.ts already forbids `h * 0.x` outside horizon.ts; this
    // states the intent so a reader knows the omission is deliberate.
    for (const line of src.split('\n')) {
      expect(/\bh\s*\*\s*0\.\d/.test(line), line.trim()).toBe(false);
    }
  });
});
