// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';

describe('token file', () => {
  const css = readFileSync('src/style/tokens.css', 'utf8');

  it('defines every ambient role', () => {
    for (const role of ['--amb-deep', '--amb-mid', '--amb-lift', '--amb-glow',
                        '--amb-accent', '--amb-ink', '--amb-ink-soft', '--amb-lum']) {
      expect(css).toContain(`${role}:`);
    }
  });

  it('never uses border-radius on a surface', () => {
    const components = readFileSync('src/style/components.css', 'utf8');
    expect(components).not.toContain('border-radius');
  });

  it('keeps colour literals out of the component stylesheet', () => {
    const components = readFileSync('src/style/components.css', 'utf8');
    const literals = components.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    // #fff and #000 inside color-mix are structural, not palette.
    const palette = literals.filter((c) => !['#fff', '#000'].includes(c.toLowerCase()));
    expect(palette).toEqual([]);
  });
});

describe('composition lines', () => {
  const files = readdirSync('src/world').filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

  it('keeps every vertical composition fraction inside horizon.ts', () => {
    // layers.ts once said `h * 0.86` while bloom.ts independently said
    // `h * 0.855`. Two copies of one fact, already disagreeing. This test is
    // what stops that happening a third time.
    //
    // Vertical only: `w * 0.08` for the lantern's bollard is a placement, not a
    // composition line, and horizon.ts holds the vertical ladder alone.
    const offenders: string[] = [];
    for (const f of files) {
      if (f === 'horizon.ts') continue;
      const src = readFileSync(`src/world/${f}`, 'utf8');
      for (const line of src.split('\n')) {
        if (/\bh\s*\*\s*0\.\d/.test(line) || /\bhz\.h\s*\*\s*0\.\d/.test(line)) {
          offenders.push(`${f}: ${line.trim()}`);
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('has a horizon module for them to live in', () => {
    expect(files).toContain('horizon.ts');
  });
});
