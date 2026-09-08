# Night Watch

A focus timer that presents itself as one night's watch over Victorian London.
A session runs from dusk to dawn; the whole palette is driven by how far through
the session you are, not by the wall clock.

## Running it

    npm install
    npm run dev

Fonts are self-hosted and **are** committed — see `public/fonts/README.md`.
They were left out originally, and the result was that both `@font-face` rules
resolved to nothing for the whole life of the project: every face fell through
to `ui-monospace`, silently, because `font-display: swap` is built to degrade
without complaining. Eight kilobytes of OFL bitmap type is a cheap price for
the identity not being optional.

## Scripts

- `npm run dev` — Vite dev server
- `npm test` — Vitest, pure modules only
- `npm run build` — typecheck then production build
- `npm run typecheck` — `tsc --noEmit`

## Using it

- **Space** starts and stops the watch, **S** skips, **,** opens settings.
  Keys typed into a field belong to that field — see `src/app/useKeys.ts`.
- Hunt and respite lengths are set in The Watch's own settings fold. They are
  not a fourth card on purpose: the grid is four columns and `App.tsx` measures
  its top edge to place the balustrade, so a fourth card would redraw the
  world's composition to hold six controls.
- The end of a phase can announce itself three ways, each switchable: the tab
  title (no permission, always available), a synthesised chime, and a browser
  notification. Notification is off until asked for, and asks at that moment.
- The Ledger shows the last seven nights, or the full retained window — the
  store keeps ninety nights and the panel used to read seven of them.

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
