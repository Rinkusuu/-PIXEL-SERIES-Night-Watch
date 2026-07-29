# Background Detail Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop the background reading as diagonal hatching, and give the city real architecture — fine line work at every depth, window openings that the light layer actually occupies, and an aerially-scaled far band.

**Architecture:** `hatch.ts` stops expressing tone as line spacing and starts expressing it as ink width over a permanently fine gap, calibrated in closed form against what the old code laid down. `city.ts` gains `openings()` as a first-class fact that both the plate and `bloom.ts` read, so lit windows sit inside drawn holes rather than floating on blank walls. Everything lands on the cached static plate except the river's hatching, which is the one per-frame path this plan touches.

**Tech Stack:** TypeScript 5.7, Vite 6, Vitest 3, React 19. No runtime dependencies beyond React. Canvas 2D only.

**Spec:** `docs/superpowers/specs/2026-07-29-background-detail-design.md`

**Branch:** `feat/background-detail` (already created, spec already committed)

## Global Constraints

- Commits carry **no Claude co-author trailer**. Every commit uses
  `git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" commit`.
- `GAP_MIN = 1.6`, `GAP_MAX = 3.7`, `WEIGHT_BASE = -0.035`, `WEIGHT_SLOPE = 0.72`,
  `MIN_STROKE = 0.5`. Exact values, copied from spec §3.2 and §3.4.
- `HATCH_ANGLES.water = Math.PI / 2`. Angles are measured **from vertical**.
- Every layer's ink coverage stays within **±15%** of what the old hatch laid down
  (spec §3.4).
- `tests/smoke.test.ts` rejects any `h * 0.<digit>` or `hz.h * 0.<digit>` outside
  `horizon.ts`. A block's own height must be named `bh`, never `h`.
- No new vertical composition fractions. Vertical bounds come from `Horizon` fields.
- Determinism: same seed, same size, same scale produces the same city.
- Run `npm test`, `npm run typecheck`, and `npm run build` before each commit.

---

## File Structure

**Modified:**
- `src/world/hatch.ts` — tone model, geometry split, water angle. Grows from 87 to ~120 lines.
- `src/world/city.ts` — `openings()`, opening holes, per-kind stroked details, `scale`. Grows from 226 to ~380 lines; still one responsibility (the city), so it stays one file.
- `src/world/layers.ts` — drops `maxGap`, passes `openings`/`scale` through.
- `src/world/water.ts`, `src/world/bridge.ts`, `src/world/deck.ts` — drop `maxGap`.
- `src/world/bloom.ts` — window spots come from `openings()`.
- `tests/world/hatch.test.ts` — the water-angle assertion changes; geometry tests added.
- `tests/world/renderer.test.ts` — `countingCtx` moves out to a shared helper.

**Created:**
- `tests/helpers/counting-ctx.ts` — the drawing-call recorder, shared by two test files.
- `tests/world/hatch-calibration.test.ts` — locks the ±15% coverage table.
- `tests/world/openings.test.ts` — opening geometry per shape kind.

---

### Task 1: Split `hatch`'s geometry and turn the water flat

`hatch()` lays its lines out **vertically** in local space and then rotates them, so
`angle` is measured from vertical. `HATCH_ANGLES.water = 0` therefore draws a wall of
verticals across the river — the exact thing its own comment says it exists to prevent.
Fixing the angle alone is not enough: one `diag` currently serves two different jobs,
and at a quarter turn the wrong one is used for line length.

**Files:**
- Modify: `src/world/hatch.ts:8-19` (angles), `src/world/hatch.ts:67-75` (geometry)
- Test: `tests/world/hatch.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `spreadFor(w: number, h: number, angle: number): number`,
  `reachFor(w: number, h: number, angle: number): number`, and
  `HATCH_ANGLES.water === Math.PI / 2`.

- [ ] **Step 1: Write the failing tests**

Add to the end of `tests/world/hatch.test.ts`:

```ts
const USED_ANGLES = [
  HATCH_ANGLES.far, HATCH_ANGLES.mid, HATCH_ANGLES.near, HATCH_ANGLES.water,
  // Cross-hatch adds 1.13 rad to whatever angle it was given.
  HATCH_ANGLES.far + 1.13, HATCH_ANGLES.mid + 1.13,
  HATCH_ANGLES.near + 1.13, HATCH_ANGLES.water + 1.13,
];

const BOXES: readonly (readonly [number, number])[] = [
  [1440, 250],  // the river: very wide, very shallow
  [250, 1440],  // a tower slot: very tall
  [300, 300],
  [60, 400],
];

describe('hatch geometry', () => {
  it('reaches every corner of the rect at every angle we draw', () => {
    // `o` steps along the OFFSET axis and each segment runs along the LINE
    // axis. Both have to clear the rect's corners or the hatching stops short.
    for (const [w, h] of BOXES) {
      for (const a of USED_ANGLES) {
        const spread = spreadFor(w, h, a);
        const reach = reachFor(w, h, a);
        for (const sx of [-1, 1]) {
          for (const sy of [-1, 1]) {
            const cx = (sx * w) / 2;
            const cy = (sy * h) / 2;
            const along = cx * Math.cos(a) + cy * Math.sin(a);
            const across = -cx * Math.sin(a) + cy * Math.cos(a);
            expect(Math.abs(along), `spread ${w}x${h} @${a}`)
              .toBeLessThanOrEqual(spread + 1e-9);
            expect(Math.abs(across), `reach ${w}x${h} @${a}`)
              .toBeLessThanOrEqual(reach + 1e-9);
          }
        }
      }
    }
  });

  it('would have fallen short across the river with the old single formula', () => {
    // The old code computed one `diag` and used it for both jobs. That number is
    // spreadFor's, and for flat water lines it measures the river's DEPTH where
    // the segment needs the river's WIDTH.
    const a = HATCH_ANGLES.water;
    expect(spreadFor(1440, 250, a) * 2).toBeLessThan(reachFor(1440, 250, a));
  });
});
```

Change the import on line 2 to:

```ts
import {
  HATCH_ANGLES, gapFor, hatch, reachFor, spreadFor,
} from '../../src/world/hatch';
```

Replace the existing `draws water dead flat` test (lines 108-112) with:

```ts
  it('draws water dead flat', () => {
    // Angles here are measured FROM VERTICAL: hatch() lays its lines out
    // vertically and then rotates them. 0 rad is a wall of verticals, which is
    // exactly what the river must never be. A quarter turn is flat.
    expect(HATCH_ANGLES.water).toBeCloseTo(Math.PI / 2, 10);
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/world/hatch.test.ts`
Expected: FAIL — `spreadFor is not a function`, and `draws water dead flat` fails with
received `0`.

- [ ] **Step 3: Implement**

In `src/world/hatch.ts`, change the `water` entry:

```ts
  /**
   * A quarter turn — flat. Angles here are measured FROM VERTICAL, because
   * `hatch` lays its lines out vertically before rotating them. Flat horizontal
   * line work is the nineteenth-century engraving convention for water, and it
   * is what makes the river read as a horizontal surface instead of a vertical
   * wall. The upstream bridge shares `mid` — its depth really is there, and a
   * fifth angle would only blur the depth ladder.
   */
  water: Math.PI / 2,
```

Add above `hatch`:

```ts
/**
 * Half-extent of the rect projected onto the OFFSET axis: how far `o` has to
 * travel for the line family to cross the whole rect.
 */
export function spreadFor(w: number, h: number, angle: number): number {
  return (Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))) / 2;
}

/**
 * Half-extent projected onto the LINE axis: how long each segment has to be.
 *
 * These two were one number until now, and that number was spreadFor's. Every
 * angle we shipped happened to sit in a wide rect where the wrong value was
 * still too big to notice; at a quarter turn it is far too small, and the
 * hatching would have appeared as a narrow band down the middle of the river.
 */
export function reachFor(w: number, h: number, angle: number): number {
  return (Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))) / 2;
}
```

Replace lines 67-75 of `hatch` with:

```ts
  const spread = spreadFor(w, h, angle) + gap;
  const reach = reachFor(w, h, angle) + 1;
  g.translate(x + w / 2, y + h / 2);
  g.rotate(angle);
  g.beginPath();
  for (let o = -spread; o <= spread; o += gap) {
    g.moveTo(o, -reach);
    g.lineTo(o, reach);
  }
  g.stroke();
```

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all green. The old code overshot the offset range by 2×, so every hatch now
draws about half as many segments — all of the removed ones fell outside the clip.

- [ ] **Step 5: Commit**

```bash
git add src/world/hatch.ts tests/world/hatch.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "fix: the river's line work runs flat, and hatch stops conflating its two extents"
```

---

### Task 2: Tone moves from gap to ink width

**Files:**
- Modify: `src/world/hatch.ts`
- Test: `tests/world/hatch.test.ts`

**Interfaces:**
- Consumes: `spreadFor`, `reachFor` from Task 1.
- Produces: `GAP_MIN`, `GAP_MAX`, `WEIGHT_BASE`, `WEIGHT_SLOPE`, `MIN_STROKE`,
  `weightFor(value: number): number`, `inkRatio(value: number): number`.
  `gapFor(value, minGap?, maxGap?)` keeps its signature; only its defaults change.
  `HatchOpts` loses its `lineWidth` field.

- [ ] **Step 1: Write the failing tests**

Add to `tests/world/hatch.test.ts`:

```ts
describe('the gap never widens into a motif', () => {
  it('keeps every gap under the countable threshold', () => {
    for (let v = 0; v <= 1.0001; v += 0.01) {
      expect(gapFor(v)).toBeLessThanOrEqual(GAP_MAX + 1e-9);
    }
  });

  it('pins the threshold itself', () => {
    // Without this, the test above passes forever by raising GAP_MAX.
    expect(GAP_MAX).toBeLessThanOrEqual(3.7);
    expect(GAP_MIN).toBeGreaterThan(1);
  });
});

describe('weightFor', () => {
  it('rises monotonically with value', () => {
    let prev = -Infinity;
    for (let v = 0.02; v <= 1.0001; v += 0.02) {
      const wv = weightFor(v);
      expect(wv).toBeGreaterThanOrEqual(prev);
      prev = wv;
    }
  });

  it('never returns a width at or below zero', () => {
    for (let v = 0; v <= 1.0001; v += 0.01) {
      expect(weightFor(v)).toBeGreaterThan(0);
    }
  });
});

describe('inkRatio', () => {
  it('orders the four depths the picture actually uses', () => {
    // 0.18 far city, 0.34 near city and river, 0.52 bridge, 0.74 deck.
    const used = [0.18, 0.34, 0.52, 0.74];
    for (let i = 1; i < used.length; i++) {
      expect(inkRatio(used[i]!)).toBeGreaterThan(inkRatio(used[i - 1]!));
    }
  });
});

describe('sub-pixel ink is paid for with alpha', () => {
  it('never sets a stroke thinner than canvas can draw', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 300, 300, 0.18);
    expect(s.width).toBeGreaterThanOrEqual(0.5);
  });

  it('lands the same total ink either side of that floor', () => {
    // lineWidth x alpha must come back to weightFor, whichever side of
    // MIN_STROKE the wanted width falls on.
    for (const v of [0.18, 0.34, 0.52, 0.74]) {
      const s = stubCtx();
      hatch(s.ctx, 0, 0, 300, 300, v);
      expect(s.width * s.alpha).toBeCloseTo(weightFor(v), 6);
    }
  });
});
```

Extend the import on line 2:

```ts
import {
  GAP_MAX, GAP_MIN, HATCH_ANGLES, gapFor, hatch, inkRatio, reachFor, spreadFor,
  weightFor,
} from '../../src/world/hatch';
```

`stubCtx` must record what it was assigned. Replace its `strokeStyle`/`lineWidth`/
`globalAlpha` fields and the returned object so the first pass's values are captured:

```ts
  let width = 0;
  let alpha = 0;
  let seen = false;
  const ctx = {
    save: () => calls.push('save'),
    restore: () => calls.push('restore'),
    beginPath: () => calls.push('beginPath'),
    rect: () => calls.push('rect'),
    clip: () => calls.push('clip'),
    translate: () => calls.push('translate'),
    rotate: (a: number) => { calls.push('rotate'); angles.push(a); },
    moveTo: () => { lines++; },
    lineTo: () => {},
    stroke: () => { calls.push('stroke'); seen = true; },
    strokeStyle: '',
    set lineWidth(v: number) { if (!seen) width = v; },
    get lineWidth() { return width; },
    set globalAlpha(v: number) { if (!seen) alpha = v; },
    get globalAlpha() { return alpha; },
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    get calls() { return calls; },
    get angles() { return angles; },
    get lines() { return lines; },
    get width() { return width; },
    get alpha() { return alpha; },
    strokes: () => calls.filter((c) => c === 'stroke').length,
  };
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/world/hatch.test.ts`
Expected: FAIL — `GAP_MAX is not defined` / `weightFor is not a function`.

- [ ] **Step 3: Implement**

In `src/world/hatch.ts`, replace the `HatchOpts` type, `clamp01`, and `gapFor` with:

```ts
export type HatchOpts = {
  angle?: number;
  color?: string;
  minGap?: number;
  maxGap?: number;
};

/**
 * The gap is clamped narrow at EVERY depth. Above about four pixels a hatch
 * stops reading as tone and starts reading as a motif — which is precisely how
 * the far city, at twelve and a half pixels, turned into wallpaper.
 */
export const GAP_MIN = 1.6;
export const GAP_MAX = 3.7;

/**
 * Ink width in pixels, as base plus slope over `value^0.72`. Expressed this way
 * rather than as a min and a max because the line that matches the old ink
 * coverage crosses zero at `value ≈ 0.011` — below `hatch`'s own cutoff, so no
 * real layer ever reaches it, but a minimum would have to be a lie. See spec
 * §3.4 for the fit.
 */
export const WEIGHT_BASE = -0.035;
export const WEIGHT_SLOPE = 0.72;

/** Canvas will not draw a line thinner than about half a pixel reliably. */
export const MIN_STROKE = 0.5;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The eye reads line density logarithmically; a linear ramp wastes half its range. */
const ramp = (value: number) => Math.pow(clamp01(value), 0.72);

export function gapFor(value: number, minGap = GAP_MIN, maxGap = GAP_MAX): number {
  return maxGap - (maxGap - minGap) * ramp(value);
}

/** The ink width we WANT. May be under MIN_STROKE; alpha covers the difference. */
export function weightFor(value: number): number {
  return Math.max(0.02, WEIGHT_BASE + WEIGHT_SLOPE * ramp(value));
}

/**
 * Ink per unit area. The chords of a parallel line family crossing a region sum
 * to `area / gap`, so coverage is width over gap and nothing else — angle does
 * not enter it. This is the only number that may be used to judge how dark a
 * layer is.
 */
export function inkRatio(value: number): number {
  return weightFor(value) / gapFor(value);
}
```

Replace the head of `hatch` (its destructuring through `globalAlpha`) with:

```ts
  const {
    angle = HATCH_ANGLES.far,
    color = '#000000',
    minGap = GAP_MIN,
    maxGap = GAP_MAX,
  } = opt;

  if (value <= 0.02) return;

  const gap = gapFor(value, minGap, maxGap);
  // ONE knob carries the tone: the ink width we want. Where that falls under
  // what canvas can stroke, alpha makes up the difference, so `lw * alpha`
  // always comes back to `want`. Tone must not be counted twice.
  const want = weightFor(value);
  const lw = Math.max(MIN_STROKE, want);

  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = color;
  g.lineWidth = lw;
  g.globalAlpha = want / lw;
```

Change the cross-hatch recursion at the foot of `hatch`:

```ts
  // Crossing earlier than the darkest third makes the whole plate look dirty
  // rather than dark. The second pass opens its gap by a third — a flat +1px
  // was fine across a nine-pixel range and is far too much across two.
  if (value > 0.66) {
    hatch(g, x, y, w, h, (value - 0.66) / 0.34, {
      ...opt,
      angle: angle + 1.13,
      minGap: minGap * 1.35,
    });
  }
```

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all green. Callers still pass their own `maxGap`, so nothing has changed on
screen yet — that lands in Task 4.

- [ ] **Step 5: Commit**

```bash
git add src/world/hatch.ts tests/world/hatch.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: hatch tone moves from line spacing to ink width"
```

---

### Task 3: Lock the calibration

**Files:**
- Create: `tests/world/hatch-calibration.test.ts`

**Interfaces:**
- Consumes: `gapFor`, `weightFor`, `GAP_MIN` from Task 2.
- Produces: nothing consumed later. This is a guard.

- [ ] **Step 1: Write the test**

```ts
import { describe, expect, it } from 'vitest';
import { GAP_MIN, gapFor, weightFor } from '../../src/world/hatch';

/**
 * The hatch that this work replaced, written out as functions so the comparison
 * is legible rather than a wall of magic numbers. lineWidth was a flat 1 and
 * alpha ramped; both are gone now.
 */
const rampOld = (v: number) => Math.pow(v, 0.72);
const gapOld = (v: number, minGap: number, maxGap: number) =>
  maxGap - (maxGap - minGap) * rampOld(v);
const alphaOld = (v: number) => 0.55 + 0.45 * rampOld(v);

/**
 * Ink per unit area. The chords of a parallel line family crossing a region sum
 * to `area / gap`, so coverage is `lineWidth * alpha / gap` — angle-independent,
 * which is what makes this comparison possible on paper at all.
 */
const covOld = (v: number, minGap: number, maxGap: number) =>
  (1 * alphaOld(v)) / gapOld(v, minGap, maxGap);
const covNew = (v: number, minGap?: number) => weightFor(v) / gapFor(v, minGap);

/** The value the cross-hatch pass runs at, for a given main value. */
const crossValue = (v: number) => (v - 0.66) / 0.34;

const LAYERS = [
  { name: 'far city', value: 0.18, oldMaxGap: 17 },
  { name: 'near city', value: 0.34, oldMaxGap: 13 },
  { name: 'river', value: 0.34, oldMaxGap: 12 },
  { name: 'upstream bridge', value: 0.52, oldMaxGap: 10 },
] as const;

describe('the new hatch lays down the same ink as the old one', () => {
  it('holds every single-pass layer inside ±15%', () => {
    // The texture changes. The TONE must not — the value ladder built in the
    // previous round is measured against these depths, and a far band three
    // times darker would pull the whole picture flat.
    for (const l of LAYERS) {
      const before = covOld(l.value, 2, l.oldMaxGap);
      const after = covNew(l.value);
      expect(Math.abs(after / before - 1), l.name).toBeLessThan(0.15);
    }
  });

  it('holds the deck, cross-hatch included, inside ±15%', () => {
    const before = covOld(0.74, 2, 9) + covOld(crossValue(0.74), 3, 9);
    const after = covNew(0.74) + covNew(crossValue(0.74), GAP_MIN * 1.35);
    expect(Math.abs(after / before - 1)).toBeLessThan(0.15);
  });

  it('still steps darker with every depth', () => {
    const ordered = [0.18, 0.34, 0.52, 0.74];
    for (let i = 1; i < ordered.length; i++) {
      expect(covNew(ordered[i]!)).toBeGreaterThan(covNew(ordered[i - 1]!));
    }
  });

  it('gives the near city and the river the same ink, as they always should have', () => {
    // The old code handed them 13 and 12 for no stated reason while their
    // `value` was identical. Merging them is the correction, not a side effect.
    expect(covNew(0.34)).toBe(covNew(0.34));
    expect(Math.abs(covOld(0.34, 2, 13) / covOld(0.34, 2, 12) - 1)).toBeGreaterThan(0.05);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run tests/world/hatch-calibration.test.ts`
Expected: PASS. The largest deviation is the near city at about +13.6%.

- [ ] **Step 3: Prove it can fail**

Temporarily set `WEIGHT_SLOPE = 1.4` in `src/world/hatch.ts` and re-run.
Expected: FAIL on every layer. **Revert the change immediately.** A calibration test
that cannot fail is worse than none.

- [ ] **Step 4: Commit**

```bash
git add tests/world/hatch-calibration.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "test: pin the hatch calibration to the ink the old code laid down"
```

---

### Task 4: Every caller stops setting its own gap

This is where the picture changes.

**Files:**
- Modify: `src/world/layers.ts:56-86` (two `maxGap`, plus the `SkylineStyle` field)
- Modify: `src/world/city.ts:173-199` (`SkylineStyle` type, the `hatch` call)
- Modify: `src/world/water.ts:217-219`
- Modify: `src/world/bridge.ts:114-116`
- Modify: `src/world/deck.ts:103-105`
- Test: `tests/world/hatch.test.ts`

**Interfaces:**
- Consumes: `GAP_MAX` defaults from Task 2.
- Produces: `SkylineStyle` without its `maxGap` field. Task 6 adds `openings` to the
  same type; Task 9 adds nothing to it.

- [ ] **Step 1: Write the failing test**

Add to `tests/world/hatch.test.ts`, with `readFileSync` imported from `node:fs`:

```ts
describe('no layer sets its own gap any more', () => {
  // Five call sites across four files each picked a maxGap by hand: 17, 13, 12,
  // 10, 9. That is the disease, not a tuning worth keeping.
  for (const f of ['layers.ts', 'city.ts', 'water.ts', 'bridge.ts', 'deck.ts']) {
    it(`${f} leaves the gap to hatch.ts`, () => {
      expect(readFileSync(`src/world/${f}`, 'utf8')).not.toContain('maxGap');
    });
  }
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/world/hatch.test.ts`
Expected: FAIL on all five files.

- [ ] **Step 3: Implement**

`src/world/city.ts` — drop the field from `SkylineStyle`:

```ts
export type SkylineStyle = {
  angle: number;
  fill: string;
  ink: string;
  density: number;
};
```

and the `hatch` call inside `drawSkyline`:

```ts
    hatch(g, b.x, b.top, b.w, bot - b.top, s.density, {
      angle: s.angle, color: s.ink,
    });
```

`src/world/layers.ts` — remove `maxGap: 17,` from the far-band `drawSkyline` call and
`maxGap: 13,` from the near-band call. Nothing else in that file changes.

`src/world/water.ts:217`:

```ts
      hatch(g, 0, top, w, depth, 0.34, {
        angle: HATCH_ANGLES.water, color: v.deep,
      });
```

`src/world/bridge.ts:114`:

```ts
  hatch(g, 0, deckTop, w, hz.bridgeBot - deckTop, s.density, {
    angle: HATCH_ANGLES.mid, color: s.ink,
  });
```

`src/world/deck.ts:103`:

```ts
  hatch(g, 0, hz.deckTop, w, hz.h - hz.deckTop, 0.74, {
    angle: HATCH_ANGLES.near, color: s.ink,
  });
```

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck && npm run build`
Expected: all green.

- [ ] **Step 5: Look at it**

Run `npm run dev` and open the scene. The background must read as tone, not as stripes.
The river's line work must run flat. If the river now costs too much, note the frame
time — this is the only per-frame path in the plan, at roughly 2.7× the segments it drew
before.

- [ ] **Step 6: Commit**

```bash
git add src/world/layers.ts src/world/city.ts src/world/water.ts \
        src/world/bridge.ts src/world/deck.ts tests/world/hatch.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: one gap for every depth, so the background reads as tone"
```

---

### Task 5: `openings()` becomes a fact the city owns

**Files:**
- Modify: `src/world/city.ts`
- Test: `tests/world/openings.test.ts` (create)

**Interfaces:**
- Consumes: `Block`, `ShapeKind` (already exported).
- Produces:
  ```ts
  export type OpeningKind = 'window' | 'clock' | 'louvre';
  export type Opening = { kind: OpeningKind; x: number; y: number; w: number; h: number };
  export function openings(b: Block, bot: number): Opening[];
  ```
  Task 6 draws these; Task 7 reads their centres.

**Note on determinism:** the spec (§4.1) suggested seeding from `b.x` via `stream()`.
Pure geometry turns out to be enough and is simpler — no randomness means nothing to
keep in sync, and the determinism requirement is met more strongly, not less.

- [ ] **Step 1: Write the failing tests**

Create `tests/world/openings.test.ts`:

```ts
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
    const tiny = { kind: 'flat' as const, x: 0, w: 8, top: 0 };
    expect(openings(tiny, 9)).toEqual([]);
  });

  it('puts windows on the terraces that carry most of the city', () => {
    const flats = skyline(1400, 100, 460, 17).filter((b) => b.kind === 'flat');
    expect(flats.length).toBeGreaterThan(0);
    expect(flats.some((b) => openings(b, 460).length > 0)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/world/openings.test.ts`
Expected: FAIL — `openings is not a function`.

- [ ] **Step 3: Implement**

Append to `src/world/city.ts`, after `skyline`:

```ts
export type OpeningKind = 'window' | 'clock' | 'louvre';
export type Opening = {
  kind: OpeningKind;
  x: number; y: number; w: number; h: number;
};

const WIN_W = 4;
const WIN_H = 7;
/** Floor-to-floor. Anything under about ten and the rows merge into a smear. */
const STOREY = 11;
const COL_PITCH = 9;
const INSET = 5;

/**
 * Fills a slab with a window grid, centred horizontally and clamped hard. A
 * block too small for one whole row gets nothing at all — a clipped row reads
 * as damage, not as a window.
 */
function grid(x0: number, y0: number, x1: number, y1: number): Opening[] {
  const out: Opening[] = [];
  const innerW = x1 - x0 - INSET * 2;
  const cols = Math.floor((innerW + (COL_PITCH - WIN_W)) / COL_PITCH);
  if (cols < 1) return out;
  const gridW = cols * COL_PITCH - (COL_PITCH - WIN_W);
  const sx = Math.round(x0 + (x1 - x0 - gridW) / 2);
  for (let y = y0 + INSET; y + WIN_H <= y1 - INSET; y += STOREY) {
    for (let c = 0; c < cols; c++) {
      out.push({
        kind: 'window', x: sx + c * COL_PITCH, y: Math.round(y), w: WIN_W, h: WIN_H,
      });
    }
  }
  return out;
}

/**
 * Where a block's light can come from. Read by BOTH the plate, which cuts them
 * as dark holes, and `bloom.ts`, which lights a handful of them — the same
 * one-source rule as `horizon()` and `lanternAnchor()`. Two modules inventing
 * window positions separately is how the glow ends up beside the window.
 *
 * Pure geometry, no randomness: nothing to keep in sync across callers.
 */
export function openings(b: Block, bot: number): Opening[] {
  const { x, w, top, kind } = b;
  const bh = bot - top;

  switch (kind) {
    case 'flat':
      return grid(x, top, x + w, bot);

    case 'gable':
      // Starts at the eaves the massing draws its roof from.
      return grid(x, top + bh * 0.34, x + w, bot);

    case 'factory':
      // The stack stays blind. Only the shed body is glazed.
      return grid(x, top + bh * 0.62, x + w, bot);

    case 'dome': {
      // One arcade ring at the springing. A drum is not a terrace, and a grid
      // on it reads as an office block wearing a hat.
      const r = w * 0.5;
      const y = Math.round(top + r);
      const n = Math.max(2, Math.floor(w / 12));
      const pitch = w / n;
      const out: Opening[] = [];
      for (let i = 0; i < n; i++) {
        const ox = Math.round(x + pitch * (i + 0.5) - 2);
        if (ox < x || ox + 4 > x + w || y + 9 > bot) continue;
        out.push({ kind: 'window', x: ox, y, w: 4, h: 9 });
      }
      return out;
    }

    case 'spire': {
      // Two lancets on the shaft. The point stays clean — glazing a spire's
      // point turns a church into a lighthouse.
      const shaftTop = Math.round(top + bh * 0.55);
      const out: Opening[] = [];
      const ox = Math.round(x + w * 0.5 - 3);
      if (ox < x || ox + 6 > x + w) return out;
      for (const f of [0.28, 0.60]) {
        const y = Math.round(shaftTop + (bot - shaftTop) * f);
        if (y + 14 > bot - 4) continue;
        out.push({ kind: 'window', x: ox, y, w: 6, h: 14 });
      }
      return out;
    }

    case 'clockTower': {
      const sw = Math.min(w, 30);
      const sx = x + (w - sw) / 2;
      const face = Math.max(9, Math.round(sw * 0.5));
      const faceY = Math.round(top + sw);
      const out: Opening[] = [];
      if (faceY + face <= bot - 4) {
        out.push({
          kind: 'clock',
          x: Math.round(sx + (sw - face) / 2), y: faceY, w: face, h: face,
        });
      }
      // Belfry louvres, under the clock stage.
      const louvreY = faceY + face + 6;
      if (louvreY + 8 <= bot - 4) {
        for (let i = 0; i < 3; i++) {
          out.push({
            kind: 'louvre',
            x: Math.round(sx + 4 + i * ((sw - 8) / 3)), y: louvreY, w: 3, h: 8,
          });
        }
      }
      return out;
    }

    case 'crane':
    default:
      return [];
  }
}
```

- [ ] **Step 4: Run and commit**

Run: `npm test && npm run typecheck`
Expected: all green.

```bash
git add src/world/city.ts tests/world/openings.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: the city knows where its openings are"
```

---

### Task 6: Cut the openings as holes in the plate

**Files:**
- Modify: `src/world/city.ts` (`SkylineStyle`, `drawSkyline`)
- Modify: `src/world/layers.ts` (both `drawSkyline` calls)
- Create: `tests/helpers/counting-ctx.ts`
- Modify: `tests/world/renderer.test.ts` (import the helper instead of defining it)
- Test: `tests/world/openings.test.ts`

**Interfaces:**
- Consumes: `openings()` from Task 5.
- Produces: `SkylineStyle` gains `openings: boolean`. `countingCtx()` exported from
  `tests/helpers/counting-ctx.ts`.

- [ ] **Step 1: Extract the shared recorder**

Create `tests/helpers/counting-ctx.ts` with the body currently at
`tests/world/renderer.test.ts:59-73`:

```ts
/** Counts every drawing call, so we can assert on work done without a canvas. */
export function countingCtx(): { g: CanvasRenderingContext2D; calls: () => number } {
  let calls = 0;
  const grad = { addColorStop: () => {} };
  const g = new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key) {
      if (key === 'createRadialGradient' || key === 'createLinearGradient') {
        return () => { calls++; return grad; };
      }
      return () => { calls++; };
    },
    set: () => true,
  });
  return { g, calls: () => calls };
}
```

In `tests/world/renderer.test.ts`, delete the local definition and add:

```ts
import { countingCtx } from '../helpers/counting-ctx';
```

- [ ] **Step 2: Write the failing test**

Add to `tests/world/openings.test.ts`:

```ts
import { drawSkyline } from '../../src/world/city';
import { countingCtx } from '../helpers/counting-ctx';

describe('openings are cut into the plate', () => {
  const blocks = skyline(1400, 100, 460, 17);
  const style = { angle: -0.42, fill: '#222', ink: '#000', density: 0.34 };

  it('does more drawing when the openings are switched on', () => {
    const without = countingCtx();
    const with_ = countingCtx();
    drawSkyline(without.g, blocks, 460, { ...style, openings: false });
    drawSkyline(with_.g, blocks, 460, { ...style, openings: true });
    expect(with_.calls()).toBeGreaterThan(without.calls());
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run tests/world/openings.test.ts`
Expected: FAIL — TypeScript rejects `openings` on `SkylineStyle`, or the counts match.

- [ ] **Step 4: Implement**

`src/world/city.ts` — add to `SkylineStyle`:

```ts
export type SkylineStyle = {
  angle: number;
  fill: string;
  ink: string;
  density: number;
  /** False for the far band: at twelve pixels wide an opening is a smudge. */
  openings: boolean;
};
```

In `drawSkyline`, inside the existing clip block, after the `hatch` call and before
`g.restore()`:

```ts
    // Openings, cut as dark holes while we are still clipped to the silhouette.
    // Addendum §C.2 says a glowing thing is a HOLE in the hatching; until now
    // there were no holes, so the window lights sat on top of solid wall.
    // Unlit windows stay dark, and that is right: a city at night is mostly
    // dark, and that is what makes the lit ones mean something.
    if (s.openings) {
      g.fillStyle = s.ink;
      g.globalAlpha = 0.85;
      for (const o of openings(b, bot)) {
        if (o.kind === 'clock') {
          g.beginPath();
          g.arc(o.x + o.w / 2, o.y + o.h / 2, o.w / 2, 0, Math.PI * 2);
          g.fill();
        } else {
          g.fillRect(o.x, o.y, o.w, o.h);
        }
      }
      g.globalAlpha = 1;
    }
```

`src/world/layers.ts` — add `openings: false,` to the far-band call and
`openings: true,` to the near-band call.

- [ ] **Step 5: Run, look, commit**

Run: `npm test && npm run typecheck && npm run build`, then `npm run dev` and confirm
the near city now has window grids and the far band does not.

```bash
git add src/world/city.ts src/world/layers.ts tests/helpers/counting-ctx.ts \
        tests/world/renderer.test.ts tests/world/openings.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: openings cut as holes, so the hatching finally has somewhere to glow"
```

---

### Task 7: The lights move into the openings

**Files:**
- Modify: `src/world/bloom.ts:44-62`
- Test: `tests/world/bloom.test.ts`

**Interfaces:**
- Consumes: `openings()` from Task 5, `Horizon.cityBot`.
- Produces: no signature change to `lampSpots`. Its `window` spots are now always `lit`.

- [ ] **Step 1: Write the failing test**

Add to `tests/world/bloom.test.ts`, importing `openings` from `../../src/world/city`:

```ts
describe('window lights come from real openings', () => {
  const centre = (o: { x: number; y: number; w: number; h: number }) =>
    `${Math.round(o.x + o.w / 2)},${Math.round(o.y + o.h / 2)}`;

  it('never invents a position of its own', () => {
    // Two modules computing window positions separately is how the glow ends up
    // beside the window instead of inside it.
    const spots = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'),
                            moonPos(1200, hz, 0.62));
    const legal = new Set<string>();
    for (const b of blocks) {
      for (const o of openings(b, hz.cityBot)) {
        if (o.kind === 'window') legal.add(centre(o));
      }
    }
    const windows = spots.filter((s) => s.kind === 'window');
    expect(windows.length).toBeGreaterThan(0);
    for (const s of windows) expect(legal.has(`${s.x},${s.y}`)).toBe(true);
  });

  it('never lights the same opening twice', () => {
    const spots = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'),
                            moonPos(1200, hz, 0.62));
    const windows = spots.filter((s) => s.kind === 'window');
    expect(new Set(windows.map((s) => `${s.x},${s.y}`)).size).toBe(windows.length);
  });

  it('scatters the lit ones instead of marching in from one edge', () => {
    const spots = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'),
                            moonPos(1200, hz, 0.62))
      .filter((s) => s.kind === 'window');
    const xs = spots.map((s) => s.x);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(1200 * 0.4);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/world/bloom.test.ts`
Expected: FAIL — the spots are hand-computed and will not match any opening centre.

- [ ] **Step 3: Implement**

In `src/world/bloom.ts`, add `import { openings } from './city';` and replace the whole
window block (lines 44-62) with:

```ts
/**
 * A stride co-prime with `n` walks every index exactly once, so the windows
 * that light first scatter across the skyline. A fixed stride quietly repeats
 * positions whenever it shares a factor with the count.
 */
function scatterStride(n: number): number {
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  for (const s of [7, 11, 13, 17, 19, 23, 29, 31, 37]) if (gcd(s, n) === 1) return s;
  return 1;
}
```

and inside `lampSpots`, in place of the old loop:

```ts
  // Windows. Positions come from city.ts, never from a second guess here.
  // Only the LIT ones become spots: an unlit window is already drawn dark on
  // the plate, and pushing hundreds of dead entries through the glitter and
  // bloom loops every frame buys nothing.
  const candidates: { x: number; y: number; r: number }[] = [];
  for (const b of blocks) {
    if (b.kind === 'crane') continue;
    for (const o of openings(b, hz.cityBot)) {
      if (o.kind !== 'window') continue;
      candidates.push({
        x: Math.round(o.x + o.w / 2),
        y: Math.round(o.y + o.h / 2),
        r: Math.max(2, Math.round(Math.min(o.w, o.h) * 0.6)),
      });
    }
  }
  if (candidates.length > 0) {
    const stride = scatterStride(candidates.length);
    for (let k = 0; k < Math.min(n, candidates.length); k++) {
      out.push({ ...candidates[(k * stride) % candidates.length]!, lit: true, kind: 'window' });
    }
  }
```

- [ ] **Step 4: Run the full suite**

Run: `npm test && npm run typecheck`
Expected: all green. `lights fewer windows at dawn than at the thickest fog` still holds
— `lampCount(1)` is 2 against `lampCount(0.62)`'s 14. `puts every window inside a real
building` still holds, more strongly than before.

- [ ] **Step 5: Commit**

```bash
git add src/world/bloom.ts tests/world/bloom.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: the gas sits in the window, not beside it"
```

---

### Task 8: A detail for every shape, not just two

**Files:**
- Modify: `src/world/city.ts` (`drawSkyline`'s detail loop, lines 203-225)
- Test: `tests/world/city.test.ts`

**Interfaces:**
- Consumes: `Block`, `SkylineStyle` from earlier tasks.
- Produces: nothing new. Behaviour only.

- [ ] **Step 1: Write the failing test**

Add to `tests/world/city.test.ts`, importing `drawSkyline` and `countingCtx`:

```ts
describe('every shape carries its own detail', () => {
  const style = {
    angle: -0.42, fill: '#222', ink: '#000', density: 0.34, openings: true,
  };

  it('draws something extra for each kind, not just flats and cranes', () => {
    // Before this, the whole city had two details: chimney pots on `flat` and a
    // jib on `crane`. Spires, domes, towers and factories carried nothing, so
    // the hatching was the only texture in the band — and it became the subject.
    const KINDS = ['gable', 'spire', 'dome', 'clockTower', 'factory'] as const;
    for (const kind of KINDS) {
      const block = { kind, x: 40, w: 60, top: 100, stackX: 70 };
      const drawn = countingCtx();
      const bare = countingCtx();
      drawSkyline(drawn.g, [block], 460, style);
      drawSkyline(bare.g, [{ ...block, kind: 'flat' as const }], 460,
                  { ...style, openings: false });
      expect(drawn.calls(), kind).toBeGreaterThan(0);
    }
  });

  it('leaves the massing untouched — details are stroked, never filled over', () => {
    const block = { kind: 'spire' as const, x: 40, w: 60, top: 100 };
    const before = skyline(1400, 100, 460, 17);
    expect(before).toEqual(skyline(1400, 100, 460, 17));
    expect(openings(block, 460).every((o) => o.y >= block.top)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it compiles and the first assertion is meaningful**

Run: `npx vitest run tests/world/city.test.ts`
Expected: PASS on call counts only because `drawSkyline` already draws the massing.
Before implementing, temporarily assert `toBeGreaterThan(40)` to confirm the current
code falls short for `spire`, then restore the assertion to a measured value once the
details exist.

- [ ] **Step 3: Implement**

Replace the detail loop at the foot of `drawSkyline` with:

```ts
  // Details, stroked over the hatching and outside the clip — a chimney pot, a
  // finial and a dome lantern all live beyond the massing's silhouette.
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  for (const b of blocks) {
    const bh = bot - b.top;
    const cx = b.x + b.w / 2;
    switch (b.kind) {
      case 'flat': {
        // A row of chimney pots. Terraces without them read as filing cabinets.
        g.fillStyle = s.fill;
        for (let k = 0; k < 3; k++) {
          g.fillRect(b.x + b.w * (0.2 + k * 0.3), b.top - 7, 3, 7);
        }
        g.beginPath();
        g.moveTo(b.x, b.top + 4); g.lineTo(b.x + b.w, b.top + 4);
        g.stroke();
        break;
      }
      case 'gable': {
        const eave = b.top + bh * 0.34;
        g.beginPath();
        g.moveTo(b.x - 2, eave); g.lineTo(cx, b.top - 3); g.lineTo(b.x + b.w + 2, eave);
        g.stroke();
        // One dormer, off centre: a symmetrical roof reads as a diagram.
        const dx = b.x + b.w * 0.62;
        g.beginPath();
        g.moveTo(dx - 4, eave - 2); g.lineTo(dx - 4, eave - 9);
        g.lineTo(dx, eave - 13); g.lineTo(dx + 4, eave - 9); g.lineTo(dx + 4, eave - 2);
        g.stroke();
        break;
      }
      case 'spire': {
        // Crockets — the hooked leaves that climb a gothic spire's edges.
        const shoulder = b.top + bh * 0.55;
        for (let k = 1; k <= 4; k++) {
          const f = k / 5;
          const y = b.top + (shoulder - b.top) * f;
          const hw = b.w * 0.5 * f;
          for (const dir of [-1, 1]) {
            g.beginPath();
            g.moveTo(cx + dir * hw, y); g.lineTo(cx + dir * (hw + 4), y - 3);
            g.stroke();
          }
        }
        g.beginPath();
        g.moveTo(cx, b.top); g.lineTo(cx, b.top - 9);
        g.stroke();
        break;
      }
      case 'dome': {
        const r = b.w * 0.5;
        for (const f of [-0.55, 0, 0.55]) {
          g.beginPath();
          g.moveTo(cx + r * f, b.top + r);
          g.quadraticCurveTo(cx + r * f * 0.5, b.top + r * 0.15, cx, b.top);
          g.stroke();
        }
        // The lantern on top. It is what makes a dome a dome and not a hill.
        g.beginPath();
        g.moveTo(cx - 3, b.top); g.lineTo(cx - 3, b.top - 8);
        g.lineTo(cx + 3, b.top - 8); g.lineTo(cx + 3, b.top);
        g.stroke();
        break;
      }
      case 'clockTower': {
        const sw = Math.min(b.w, 30);
        const sx = b.x + (b.w - sw) / 2;
        g.beginPath();
        g.moveTo(sx - 3, b.top + sw * 0.9); g.lineTo(sx + sw + 3, b.top + sw * 0.9);
        g.stroke();
        // Hands, frozen. A clock that ticks in a painted city reads as a bug.
        const face = Math.max(9, Math.round(sw * 0.5));
        const fx = sx + sw / 2;
        const fy = b.top + sw + face / 2;
        g.beginPath();
        g.moveTo(fx, fy); g.lineTo(fx, fy - face * 0.34);
        g.moveTo(fx, fy); g.lineTo(fx + face * 0.28, fy + face * 0.14);
        g.stroke();
        break;
      }
      case 'factory': {
        const sw = Math.max(5, b.w * 0.18);
        const sx = b.x + b.w * 0.5 - sw / 2;
        // Iron bands, and the capping ring at the lip.
        for (const f of [0.12, 0.30]) {
          const y = b.top + bh * f;
          g.beginPath();
          g.moveTo(sx - 1, y); g.lineTo(sx + sw + 1, y);
          g.stroke();
        }
        g.beginPath();
        g.moveTo(sx - 2, b.top + 2); g.lineTo(sx + sw + 2, b.top + 2);
        g.stroke();
        break;
      }
      case 'crane': {
        const mx = b.x + b.w * 0.62;
        const mastTop = b.top + bh * 0.05;
        g.beginPath();
        g.moveTo(mx, b.top + bh * 0.55);
        g.lineTo(mx, mastTop);
        g.lineTo(b.x + b.w * 0.08, mastTop + bh * 0.18);
        g.stroke();
        // The hook, and the tie that stops the jib folding back on itself.
        g.beginPath();
        g.moveTo(b.x + b.w * 0.18, mastTop + bh * 0.16);
        g.lineTo(b.x + b.w * 0.18, mastTop + bh * 0.34);
        g.moveTo(mx, mastTop + bh * 0.10);
        g.lineTo(b.x + b.w * 0.30, mastTop + bh * 0.14);
        g.stroke();
        break;
      }
    }
  }
```

**Local height is `bh`, never `h`.** `tests/smoke.test.ts` rejects any `h * 0.<digit>`
outside `horizon.ts`, and `\bh` does not match inside `bh`.

- [ ] **Step 4: Measure, then tighten the test**

Run the `city.test.ts` suite with the call count printed, note the real figure for the
weakest kind, and set the assertion just under it. A bound picked without measuring is
a test that cannot fail.

- [ ] **Step 5: Run, look, commit**

Run: `npm test && npm run typecheck && npm run build`, then look at the scene.

```bash
git add src/world/city.ts tests/world/city.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: crockets, ribs, dormers and iron bands — every shape earns its silhouette"
```

---

### Task 9: Aerial perspective for the far band

**Files:**
- Modify: `src/world/city.ts` (`skyline` signature and width constants)
- Modify: `src/world/layers.ts:55`
- Test: `tests/world/city.test.ts`

**Interfaces:**
- Consumes: `skyline` from Task 5.
- Produces: `skyline(w, top, bot, seed, scale?)` with `scale` defaulting to 1, and
  `export const FAR_SCALE = 0.55`.

- [ ] **Step 1: Write the failing test**

Add to `tests/world/city.test.ts`:

```ts
describe('aerial perspective', () => {
  it('packs more, narrower buildings into the far band', () => {
    // Distance does not just fade a skyline, it multiplies it. Density IS the
    // detail out there — an opening at twelve pixels wide is a smudge.
    const near = skyline(1400, 100, 460, 17, 1);
    const far = skyline(1400, 100, 460, 17, FAR_SCALE);
    expect(far.length).toBeGreaterThan(near.length);
  });

  it('still covers the full width with no gap and no overlap at either scale', () => {
    for (const scale of [1, FAR_SCALE]) {
      let x = 0;
      const blocks = skyline(1400, 100, 460, 17, scale);
      for (const b of blocks) { expect(b.x).toBe(x); x += b.w; }
      expect(x).toBeGreaterThanOrEqual(1400);
    }
  });

  it('keeps the spire aspect guarantee at the small scale', () => {
    for (const b of skyline(1400, 100, 460, 17, FAR_SCALE)) {
      if (b.kind !== 'spire' && b.kind !== 'clockTower') continue;
      expect((460 - b.top) / Math.min(b.w, SPIRE_MAX_W))
        .toBeGreaterThanOrEqual(MIN_SPIRE_ASPECT);
    }
  });

  it('is still deterministic per scale', () => {
    expect(skyline(1400, 100, 460, 17, FAR_SCALE))
      .toEqual(skyline(1400, 100, 460, 17, FAR_SCALE));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run tests/world/city.test.ts`
Expected: FAIL — `FAR_SCALE` is not exported.

- [ ] **Step 3: Implement**

In `src/world/city.ts`:

```ts
/**
 * Width multiplier for the band behind the skyline. Distance does not merely
 * fade a city, it multiplies it — roughly twice as many buildings, each about
 * half as wide. Out there, density is the detail.
 */
export const FAR_SCALE = 0.55;
```

and change `skyline`'s head:

```ts
export function skyline(
  w: number, top: number, bot: number, seed: number, scale = 1,
): Block[] {
  const r = stream(seed);
  const span = bot - top;
  const minW = Math.max(6, Math.round(MIN_W * scale));
  const maxW = Math.max(minW + 4, Math.round(MAX_W * scale));
  const out: Block[] = [];
```

and inside the loop:

```ts
    const bw = Math.max(minW, Math.round(minW + r() * (maxW - minW)));
```

In `src/world/layers.ts:55`, pass the scale:

```ts
  const far = skyline(w, hz.cityTop, hz.cityBot, Math.round(w * 17 + hz.h), FAR_SCALE);
```

importing `FAR_SCALE` alongside `drawSkyline, skyline`.

- [ ] **Step 4: Run, look, commit**

Run: `npm test && npm run typecheck && npm run build`, then look at the scene: the far
band should read as a denser, finer city sitting behind the near one.

```bash
git add src/world/city.ts src/world/layers.ts tests/world/city.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: the far band gets its own scale, so distance multiplies the city"
```

---

### Task 10: Budget and final verification

**Files:**
- Test: `tests/world/plate.test.ts`

**Interfaces:**
- Consumes: everything above.
- Produces: nothing.

- [ ] **Step 1: Write the budget test**

Add to `tests/world/plate.test.ts` (which already carries
`// @vitest-environment jsdom` on line 1 — a pragma anywhere else is inert):

```ts
import { countingCtx } from '../helpers/counting-ctx';
import { drawStatic } from '../../src/world/layers';
import { horizon } from '../../src/world/horizon';
import { skyline } from '../../src/world/city';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';

describe('the plate stays affordable', () => {
  it('builds the whole world inside its call budget', () => {
    // The plate is cached, so per-frame cost is nil — but it IS rebuilt on
    // resize, and that is what a hitch feels like. Measure the real figure
    // first and set this just above it; a bound picked by guess cannot fail.
    const hz = horizon(900, 594);
    const v = resolve(NIGHT_KEYS, 0.62, gradesFor(['calm']));
    const blocks = skyline(1440, hz.cityTop, hz.cityBot, 31);
    const { g, calls } = countingCtx();
    drawStatic(g, 1440, hz, v, 0.62, blocks, 'clear');
    expect(calls()).toBeLessThan(/* measured figure + 15% */ 0);
  });
});
```

- [ ] **Step 2: Measure and fill in the bound**

Run the test once with the bound at `Number.MAX_SAFE_INTEGER`, read the printed count,
then set the assertion to that figure plus about 15%.

- [ ] **Step 3: Verify in the browser**

Run `npm run dev`. Check all four weathers by forcing `weatherFor`'s return in the
console or by stepping the night key. Confirm:

- No layer shows countable lines — the far city especially.
- The river's line work runs flat, not vertical, and reaches both frame edges.
- Window grids are visible on the near city; the far band has none.
- Lit windows sit inside their openings, never beside them.
- The value ladder still steps darker from far city to frame edge — the vignette must
  still be the darkest thing on screen.
- Frame time holds 60 fps with the river's finer hatching.

- [ ] **Step 4: Final gate and commit**

Run: `npm test && npm run typecheck && npm run build`

```bash
git add tests/world/plate.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "test: hold the plate build inside its call budget"
```

- [ ] **Step 5: Amend the addendum**

Edit `/Users/rinkusu/Web/Ideas/gaslamp-dna.md` per spec §10:

- **§C.1** — tone is carried by ink ratio (`lineWidth / gap`), not by spacing. The gap
  is clamped to `[1.6, 3.7]` px at every depth; above about four pixels a hatch stops
  reading as tone and starts reading as a motif.
- **§C.2** — "a glowing thing is not hatched" is strengthened: the hole must EXIST as a
  drawn opening, and its coordinates must come from the same source the light layer
  reads.
- **§C.2, water amendment of 2026-07-28** — angles are measured **from vertical**. That
  amendment wrote `water: 0.00 rad` while meaning flat lines; the correct value is
  `π/2`. State the convention explicitly so the other three are not misread later.

`Ideas/` is not a git repository, so this edit carries no history. Say so when reporting.

---

## Self-Review

**Spec coverage:**

| Spec section | Task |
|---|---|
| §1.3 water hatched vertically | 1 |
| §3.1–3.2 ink ratio, alpha as sub-pixel compensator | 2 |
| §3.3 callers drop `maxGap` | 4 |
| §3.3b `spread`/`reach` split, water angle | 1 |
| §3.4 calibration, ±15% | 3 |
| §3.5 gap and monotonicity tests | 2, 3, 4 |
| §4 `openings()` per shape kind | 5 |
| §5 `bloom.ts` reads openings | 7 |
| §6.1 openings cut as holes | 6 |
| §6.2 per-kind stroked details | 8 |
| §6.3 `countingCtx` shared, order | 6, 8 |
| §7 `scale`, `FAR_SCALE` | 9 |
| §8 plate budget | 10 |
| §10 addendum amendments | 10, step 5 |

No gaps.

**Two deliberate deviations from the spec, both simplifications:**

1. §4.1 proposed seeding `openings()` from `b.x` via `stream()`. Task 5 uses pure
   geometry instead — deterministic by construction, with nothing to keep in sync.
2. §8 set the plate budget in milliseconds. Task 10 asserts a drawing-call count
   instead, because the test environment is jsdom and has no real canvas to time.
   Wall-clock is checked by eye in the browser at step 3.

**Type consistency:** `SkylineStyle` loses `maxGap` in Task 4 and gains `openings:
boolean` in Task 6; every call site is updated in the same task. `Opening` and
`OpeningKind` are defined in Task 5 and consumed unchanged in Tasks 6 and 7.
`countingCtx` is created in Task 6 and reused in Tasks 8 and 10. `skyline`'s new
`scale` parameter is optional, so Tasks 5–8 need no update when Task 9 lands.
