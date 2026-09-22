import { describe, expect, it } from 'vitest';
import { ESTIMATE_MAX, clampEstimate } from '../../src/store/schema';
import { fromTransfer, toTransfer } from '../../src/store/transfer';
import { emptySchema } from '../../src/store/schema';

describe('clampEstimate', () => {
  it('reads an empty or zero estimate as no estimate at all', () => {
    expect(clampEstimate(0)).toBeUndefined();
    expect(clampEstimate(-3)).toBeUndefined();
    expect(clampEstimate(Number.NaN)).toBeUndefined();
  });

  it('keeps a plausible plan whole', () => {
    expect(clampEstimate(3)).toBe(3);
    expect(clampEstimate(2.4)).toBe(2);
    expect(clampEstimate(2.6)).toBe(3);
  });

  /** Nobody plans past this honestly, and the row holds one digit. */
  it('caps a plan nobody is going to keep', () => {
    expect(clampEstimate(400)).toBe(ESTIMATE_MAX);
  });
});

describe('an estimate through export and import', () => {
  /**
   * The field is optional, so the risk is not that it is mangled — it is that
   * a merge quietly drops it, which would look exactly like never having set
   * one. `fromTransfer` keeps the quarry it already has and only takes the
   * larger total, so a machine that never saw the estimate must not win.
   */
  it('survives a round trip', () => {
    const mine = emptySchema();
    mine.quarry.push({
      id: 'q1', name: 'menulis spec', minutes: 100, done: false, createdAt: 1, estimate: 4,
    });
    const r = fromTransfer(JSON.stringify(toTransfer(mine)), emptySchema());
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.quarry[0]!.estimate).toBe(4);
  });

  it('is carried in by a quarry the reader has never seen', () => {
    const theirs = emptySchema();
    theirs.quarry.push({
      id: 'q9', name: 'refactor dunia', minutes: 50, done: false, createdAt: 1, estimate: 2,
    });
    const r = fromTransfer(JSON.stringify(toTransfer(theirs)), emptySchema());
    expect(r.ok).toBe(true);
    expect(r.ok && r.data.quarry).toHaveLength(1);
    expect(r.ok && r.data.quarry[0]!.estimate).toBe(2);
  });
});
