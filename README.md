# [PIXEL SERIES] Night Watch

A focus timer that presents itself as one night's watch over Victorian London.
A session runs from dusk to dawn; the whole palette is driven by how far through
the session you are, not by the wall clock.

Second in the PIXEL SERIES, after
[Useless Dashboard](https://github.com/Rinkusuu/-PIXEL-SERIES-Useless-Dashboard).
Same visual language — pixel-glass chrome over a hand-drawn world — turned to a
different purpose: that one rewards you for being present and doing nothing,
this one is about the hour you actually sit down and work.

## Running it

    npm install
    npm run dev

## Scripts

- `npm run dev` — Vite dev server
- `npm test` — Vitest, pure modules only
- `npm run build` — typecheck then production build
- `npm run typecheck` — `tsc --noEmit`

## Using it

- **Space** starts and stops the watch, **S** skips, **Z** is zen, **,** opens
  settings, **⌘K** / **Ctrl K** opens the command palette. Keys typed into a
  field belong to that field — see `src/app/useKeys.ts`.
- **Zen** hides the chrome and lets the world expand into the room it was
  using: the deck drops to its floor, the city grows, and the river gets the
  depth its reflection was always short of.
- **Throw a stone at the river.** It skips. A flat throw at the near water
  carries further than a steep one at the far bank.
- The end of a phase can announce itself three ways, each switchable: the tab
  title (no permission, always available), a synthesised chime, and a browser
  notification. Notification is off until asked for, and asks at that moment.
- **The Ledger** shows the last seven nights, or the full retained window of
  ninety — and the notes: what the watch saw while you worked.

## Two languages, on purpose

**The watch speaks English. The controls speak Indonesian.** The watchman is a
Londoner in 1880 and the river is the Thames; his sentences are his. The buttons
are not his — they are yours, on your machine, in your language. The rule is
written at the top of `src/app/copy.ts` and `tests/app/copy.test.ts` enforces it.

## Design

- Spec: `docs/superpowers/specs/2026-07-27-night-watch-design.md`
- Scene spec: `docs/superpowers/specs/2026-07-28-river-scene-design.md`
- Scene queue: `docs/superpowers/specs/2026-08-01-scene-detail-queue.md`

Two rendering layers that never mix: an engraved `<canvas>` world at full
resolution, and pixel-glass DOM chrome on a 4px grid. They share one thing — the
ambient palette written to CSS custom properties at 4 Hz.

### The world layer

Every composition line lives in `src/world/horizon.ts`. No other module may
compute a fraction of the frame height — there is a test in `tests/smoke.test.ts`
that enforces it, because `layers.ts` and `bloom.ts` had already drifted to two
disagreeing copies of the same number.

Depth values come from `src/world/ladder.ts`, never from a module's own mix. The
frame-edge ink is a fixed constant that never touches the ambient palette — it
is the picture's value anchor.

Large soft fields are dithered through a Bayer 4×4 matrix rather than blended
(`src/world/dither.ts`). A smooth gradient reads as CSS; a quantised one reads
as 16-bit. The tile is four pixels wide, because a vertical gradient does not
vary in x and the matrix repeats every four columns — so that tile *is* the
whole pattern, not an approximation of it.

The near vignette (`src/world/foreground.ts`) is drawn **last**, in the live
pass — on the cached plate the river would wash the gate piers back out.

Each night's weather (`clear` / `fog` / `rain` / `fullmoon`) is rolled
deterministically from the same `nightKey()` the streak counts by, so a night
never reshuffles on a resize.

### One cold light

Everything in this picture burns gas except two lamps on the near rail, which
are electric and therefore cold. The Victoria Embankment took Jablochkoff arc
lamps in 1878 and was the first street in London lit by electricity; people
complained the light was ghastly, that it made faces look like the faces of the
dead. They are lit from the first frame while the gas comes up behind them,
because an arc lamp is thrown by a switch and every gas standard waits for a man
with a pole.

## Fonts

Self-hosted and committed — see `public/fonts/README.md`. They were left out
originally and both `@font-face` rules resolved to nothing for the whole life of
the project: every face fell through to `ui-monospace`, silently, because
`font-display: swap` is built to degrade without complaining.

## Offline

The app makes no network requests at all — the world is arithmetic and the
ledger is `localStorage` — so once the shell is on disk there is nothing left to
go wrong. `sw-template.js` precaches it; `vite.config.ts` fills in the real,
content-hashed file list at build time, because a handwritten one is correct for
exactly one build. Fonts and icons live in `public/`, so they are copied rather
than bundled and have to be named explicitly; `tests/build/offline.test.ts`
checks that list against what is actually on disk.

Every cache lookup passes `ignoreVary: true`. A host that answers `Vary: Origin`
— Vite's own preview server does — otherwise makes every lookup miss, because
`addAll` stored its responses without an Origin header and the page's own
subresource requests send one. The shell was entirely in the cache and the
browser still refused it; offline the app booted to a blank page with the right
title in the tab. It was found by killing the server, not by reading the code.

Verified end to end: a watch started, the server killed mid-session, the page
reloaded — both pixel faces loaded from cache, the canvas painted, no failed
requests, and the clock had kept counting through the outage.

There is no service worker in dev, on purpose. A cache-first worker in front of
Vite's HMR is a machine for serving you yesterday's code.

## Testing policy

Pure modules (`ambient/`, `session/`, `store/`, `app/`, `world/hatch`) are
unit-tested. Visual output is not; it is verified against the acceptance
checklists in the style parents.
