import { describe, expect, it } from 'vitest';
import { COPY, ambientLine, formatClock } from '../../src/app/copy';

describe('formatClock', () => {
  it('formats minutes and seconds, zero-padded', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(161_000)).toBe('02:41');
    expect(formatClock(3_600_000)).toBe('60:00');
  });
  it('never goes negative', () => {
    expect(formatClock(-5000)).toBe('00:00');
  });
});

describe('ambientLine', () => {
  const base = { phase: 'hunt' as const, progress: 0, hasQuarry: true, bloodmoon: false };

  it('has a distinct sentence for each stage of the night', () => {
    const seen = new Set<string>();
    for (const progress of [0.1, 0.5, 0.7, 0.95]) {
      seen.add(ambientLine({ ...base, progress }));
    }
    expect(seen.size).toBe(4);
  });

  it('distinguishes idle with and without a quarry', () => {
    const withQuarry = ambientLine({ ...base, phase: 'idle', hasQuarry: true });
    const without = ambientLine({ ...base, phase: 'idle', hasQuarry: false });
    expect(withQuarry).not.toBe(without);
  });

  it('lets the blood moon override the stage sentence', () => {
    expect(ambientLine({ ...base, progress: 0.5, bloodmoon: true })).toBe('the moon has turned.');
  });

  it('has its own sentence for respite', () => {
    expect(ambientLine({ ...base, phase: 'respite' })).toBe('the watch rests. the fog does not.');
  });
});

describe('every hand-written string', () => {
  const all: string[] = [
    ...(Object.values(COPY) as unknown[]).filter((v) => typeof v === 'string') as string[],
    ...Object.values(COPY.labels),
    ...[0.1, 0.5, 0.7, 0.95].map((progress) =>
      ambientLine({ phase: 'hunt', progress, hasQuarry: true, bloodmoon: false })),
    ambientLine({ phase: 'idle', progress: 0, hasQuarry: false, bloodmoon: false }),
    ambientLine({ phase: 'respite', progress: 1, hasQuarry: true, bloodmoon: false }),
  ];

  it('contains no exclamation mark', () => {
    for (const line of all) expect(line).not.toContain('!');
  });

  it('keeps ambient sentences lowercase', () => {
    const labels: string[] = Object.values(COPY.labels);
    // The product's own name is a proper noun, not a sentence in the watchman's
    // voice — it is what the tab, the favicon and the heading all call this
    // thing. The rule is about the prose.
    const exempt = new Set([...labels, COPY.title]);
    const ambient = all.filter((l) => !exempt.has(l));
    for (const line of ambient) expect(line).toBe(line.toLowerCase());
  });

  it('keeps control labels uppercase and unpoeticised', () => {
    expect(Object.values(COPY.labels)).toEqual(['MULAI', 'HENTI', 'LEWATI', 'TAMBAH']);
  });
});
