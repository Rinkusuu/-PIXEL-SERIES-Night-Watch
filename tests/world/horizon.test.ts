import { describe, expect, it } from 'vitest';
import { DECK_MAX, DECK_MIN, WATER_MIN, horizon } from '../../src/world/horizon';

const SIZES = [420, 600, 900, 1200, 1600];
const DECKS = [0.2, 0.4, 0.54, 0.66, 0.8, 0.95];

describe('horizon', () => {
  it('orders every band top to bottom without a gap', () => {
    for (const h of SIZES) {
      for (const f of DECKS) {
        const z = horizon(h, h * f);
        expect(z.cityTop).toBeLessThan(z.skyBot);
        expect(z.skyBot).toBeLessThan(z.bridgeTop);
        expect(z.bridgeTop).toBeLessThan(z.waterTop);
        expect(z.waterTop).toBeLessThan(z.railTop);
        expect(z.railTop).toBeLessThan(z.deckTop);
        expect(z.deckTop).toBeLessThanOrEqual(h);
        // no gap: the water's foot IS the rail's head, to the pixel
        expect(z.waterBot).toBe(z.railTop);
        expect(z.railBot).toBe(z.deckTop);
        expect(z.cityBot).toBe(z.waterTop);
      }
    }
  });

  it('clamps deckTop into its band', () => {
    const h = 900;
    expect(horizon(h, 0).deckTop).toBe(Math.round(h * DECK_MIN));
    expect(horizon(h, h * 2).deckTop).toBe(Math.round(h * DECK_MAX));
  });

  it('never lets the river be squeezed below its floor', () => {
    for (const h of SIZES) {
      for (const f of DECKS) {
        const z = horizon(h, h * f);
        expect(z.waterBot - z.waterTop).toBeGreaterThanOrEqual(Math.floor(h * WATER_MIN) - 1);
      }
    }
  });

  it('sinks the bridge piers into the water', () => {
    const z = horizon(900, 900 * 0.66);
    expect(z.bridgeBot).toBeGreaterThan(z.waterTop);
  });

  it('returns integers, so two modules cannot round differently', () => {
    const z = horizon(901, 901 * 0.63);
    for (const value of Object.values(z)) expect(Number.isInteger(value)).toBe(true);
  });
});
