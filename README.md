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
- Style addendum (shared with two sibling projects): `../Ideas/gaslamp-dna.md`
- Style parent: `../Useless Dashboard/DNA.md`

Two rendering layers that never mix: an engraved `<canvas>` world at full
resolution, and pixel-glass DOM chrome on a 4px grid. They share one thing — the
ambient palette written to CSS custom properties at 4 Hz. Read addendum §B
before changing either.

## Testing policy

Pure modules (`ambient/`, `session/`, `store/`, `world/hatch`) are unit-tested.
Visual output is not; it is verified against the acceptance checklist in
`DNA.md` §14 and `gaslamp-dna.md` §G.
