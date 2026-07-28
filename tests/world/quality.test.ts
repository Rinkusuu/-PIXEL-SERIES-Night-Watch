import { describe, expect, it } from 'vitest';
import {
  DROP_MS, NOTCHES, RAISE_MS, createFrameClock, qualityStep,
} from '../../src/world/quality';

describe('qualityStep', () => {
  it('drops a notch when the budget is blown', () => {
    expect(qualityStep(DROP_MS + 1, 0)).toBe(1);
  });
  it('climbs back when there is headroom', () => {
    expect(qualityStep(RAISE_MS - 1, 2)).toBe(1);
  });
  it('holds inside the dead band — that band IS the hysteresis', () => {
    const middle = (DROP_MS + RAISE_MS) / 2;
    expect(qualityStep(middle, 0)).toBe(0);
    expect(qualityStep(middle, 1)).toBe(1);
    expect(qualityStep(middle, 2)).toBe(2);
  });
  it('never leaves the notch range', () => {
    expect(qualityStep(999, NOTCHES - 1)).toBe(NOTCHES - 1);
    expect(qualityStep(0, 0)).toBe(0);
  });
});

describe('createFrameClock', () => {
  it('says nothing until it has a full window', () => {
    const clock = createFrameClock(4);
    expect(clock.sample(99)).toBe(0);
    expect(clock.sample(99)).toBe(0);
    expect(clock.sample(99)).toBe(0);
  });
  it('drops after a full window of slow frames', () => {
    const clock = createFrameClock(4);
    let notch = 0;
    for (let i = 0; i < 4; i++) notch = clock.sample(20);
    expect(notch).toBe(1);
  });
  it('recovers after a full window of fast frames', () => {
    const clock = createFrameClock(4);
    for (let i = 0; i < 4; i++) clock.sample(20);
    let notch = 0;
    for (let i = 0; i < 4; i++) notch = clock.sample(1);
    expect(notch).toBe(0);
  });
  it('does not oscillate on frames inside the dead band', () => {
    const clock = createFrameClock(4);
    for (let i = 0; i < 40; i++) clock.sample((DROP_MS + RAISE_MS) / 2);
    expect(clock.notch()).toBe(0);
  });
});
