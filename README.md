# Night Watch

A focus timer that presents itself as one night's watch over Victorian London.
A session runs from dusk to dawn; the whole palette is driven by how far through
the session you are, not by the wall clock.

## Running it

    npm install
    npm run dev

Fonts are self-hosted and are **not** committed. See
`docs/superpowers/plans/2026-07-27-night-watch.md`, Task 1 Step 3.

## Scripts

- `npm run dev` — Vite dev server
- `npm test` — Vitest, pure modules only
- `npm run build` — typecheck then production build
- `npm run typecheck` — `tsc --noEmit`

## Design

- Spec: `docs/superpowers/specs/2026-07-27-night-watch-design.md`
- Scene spec: `docs/superpowers/specs/2026-07-28-river-scene-design.md`
- Style addendum (shared with two sibling projects): `../Ideas/gaslamp-dna.md`
- Style parent: `../Useless Dashboard/DNA.md`

Two rendering layers that never mix: an engraved `<canvas>` world at full
resolution, and pixel-glass DOM chrome on a 4px grid. They share one thing — the
ambient palette written to CSS custom properties at 4 Hz. Read addendum §B
before changing either.

### The world layer

Every composition line lives in `src/world/horizon.ts`. No other module may
compute a fraction of the frame height — there is a test in `tests/smoke.test.ts`
that enforces it, because `layers.ts` and `bloom.ts` had already drifted to two
disagreeing copies of the same number.

The balustrade is drawn at the panel row's **measured** position, read by a
`ResizeObserver` in `App.tsx`, so the glass genuinely rests on the parapet at
every viewport size rather than at the one it was tuned on.

Each night's weather (`clear` / `fog` / `rain` / `fullmoon`) is rolled
deterministically from the same `nightKey()` the streak counts by, so a night
never reshuffles on a resize.

Depth values come from `src/world/ladder.ts`, never from a module's own mix. The
frame-edge ink is a fixed constant that never touches the ambient palette — it
is the picture's value anchor, and letting it follow ambient would collapse the
contrast at exactly the moment the fog is thickest. `tests/world/ladder.test.ts`
checks the rungs stay in order across every keyframe and grade combination.

The near vignette (`src/world/foreground.ts`) is what makes the scene read as a
place you are standing in rather than a backdrop. It is drawn **last**, in the
live pass — on the cached plate the river would wash the gate piers back out.

## Testing policy

Pure modules (`ambient/`, `session/`, `store/`, `world/hatch`) are unit-tested.
Visual output is not; it is verified against the acceptance checklist in
`DNA.md` §14 and `gaslamp-dna.md` §G.
