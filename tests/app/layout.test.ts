import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { DECK_MIN } from '../../src/world/horizon';

describe('the panels sit on the parapet', () => {
  const base = readFileSync('src/style/base.css', 'utf8');
  const components = readFileSync('src/style/components.css', 'utf8');


  it('docks the chrome to the bottom of the frame', () => {
    expect(base).toContain('justify-content: flex-end');
  });

  it('cannot grow the chrome past the deck clamp', () => {
    // This replaces a rule that said "one row only". The rule was a proxy for
    // the real constraint and it blocked a second row that the composition can
    // actually afford; the constraint itself is what matters.
    //
    // `App.tsx` measures the grid's top edge and `horizon.ts` clamps the deck
    // to DECK_MIN. If the grid grows past `1 - DECK_MIN` of the frame, the
    // clamp stops following it and the glass covers the parapet it is supposed
    // to be resting on — and then the river underneath it.
    //
    // So the row height is viewport-relative and bounded, and two of them plus
    // the gap and the app's padding have to fit in that budget.
    const rows = /grid-template-rows:\s*repeat\(2,\s*clamp\([^,]+,\s*([\d.]+)vh/.exec(components);
    expect(rows, 'grid-template-rows must declare 2 viewport-relative rows').not.toBeNull();
    const rowVh = Number(rows![1]);
    // Six vh of slack for the gap between rows and the app's own padding.
    expect(rowVh * 2 + 6).toBeLessThanOrEqual((1 - DECK_MIN) * 100);
  });

  it('gives the rows a hard height so content cannot move the composition', () => {
    // `minmax(..., auto)` was tried and is the same bug by another route:
    // opening the settings fold grew the row, the grid's top climbed past the
    // deck clamp, and the glass ended up over the parapet. A card that
    // outgrows its row has to scroll inside itself.
    expect(components).toMatch(/grid-template-rows:\s*repeat\(2,\s*clamp\([^)]*\)\s*\)/);
    expect(components).not.toMatch(/grid-template-rows:[^;]*auto/);
    expect(components).toContain('overflow-y: auto');
  });

  it('still docks a tall grid to the bottom rather than centring it', () => {
    // With two rows the grid is nearly half the frame. Centred, it would float
    // over the river instead of standing on the stone.
    expect(base).toContain('justify-content: flex-end');
  });

  it('bounds the quarry list so it cannot push the parapet off screen', () => {
    expect(components).toContain('.list--scroll');
    expect(components).toContain('overflow-y: auto');
  });
});
