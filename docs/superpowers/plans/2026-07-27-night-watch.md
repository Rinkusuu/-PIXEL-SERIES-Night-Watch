# Night Watch Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a focus timer that presents itself as one night's watch over Victorian London — a full-screen engraved canvas world behind three pixel-glass panels, with the entire palette driven by session progress.

**Architecture:** Two rendering layers that never mix. The world layer is a single full-viewport `<canvas>` drawn with line hatching at full resolution; the chrome layer is DOM styled as pixel-glass on a 4px grid. They are joined only by a shared ambient palette written to CSS custom properties at 4 Hz. All domain logic (`ambient/`, `session/`, `store/`, `world/hatch`) is pure and unit-tested; React is a thin shell.

**Tech Stack:** Vite 6, React 19, TypeScript 5.7, Vitest 2 (jsdom only where a test touches `document`). No Tailwind, no CSS framework, no runtime dependencies beyond React.

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from `docs/superpowers/specs/2026-07-27-night-watch-design.md` and its two style parents.

**Sources of truth**
- Style parent: `../../../../Useless Dashboard/DNA.md`
- Style addendum: `../../../../Ideas/gaslamp-dna.md`
- Spec: `docs/superpowers/specs/2026-07-27-night-watch-design.md`

**Hybrid contract (addendum §B) — never violated**
- World layer: `<canvas>`, `position: fixed`, `z-index: 0`, full devicePixelRatio, engraved hatching. **Never contains text.**
- Chrome layer: DOM, `z-index: 1`, pixel-glass, 4px grid. **Never contains hatching.**
- The only separator between layers is `backdrop-filter: blur(18px)` on panels. Never add a border to "separate the panel from the background".
- Antialiasing is permitted **only** on hatch strokes. Everywhere else: `-webkit-font-smoothing: none`.

**Colour**
- Exactly one file may contain literal colour values: `src/style/tokens.css`. `grep -rn '#[0-9a-fA-F]\{3,6\}' src/components src/panels src/style/components.css` must return empty. Colour literals in `src/ambient/keyframes.ts` and `src/ambient/grade.ts` are the documented exception — they are palette data, not styling.
- Base palette (addendum §D): `--amb-deep: #0e1218`, `--amb-mid: #243039`, `--amb-lift: #4a6070`, `--amb-glow: #ffb347`, `--amb-accent: #6f8f9c`, `--amb-ink: #ece4d8`, `--amb-ink-soft: #9aa5a8`, `--amb-lum: 0.22`.
- Rare accents only: `#8c2f3a` `#ffb347` `#6f8f9c` `#b08d57` `#7d6b8a`.
- No fully saturated colour anywhere. No `#ff0000`. No `#f00`.
- All colour transitions use `linear` timing, never eased (DNA §8.2).

**Geometry**
- Base unit `--px: 4px`. Every padding, gap, border width, shadow offset and icon size is a multiple of it. The only permitted exception is `2px` for hairline detail.
- `border-radius` is forbidden on every surface. The single exception is `2px` on `:focus-visible` (DNA §9.5).
- `border: 1px solid` is forbidden. Frames are four zero-spread `box-shadow`s leaving the corner pixels empty (DNA §5.1).

**Type**
- Discrete size ladder only: 10 / 11 / 13 / 15 / 18 / 24 px. `clamp()` is permitted only on the hero display number: `clamp(28px, 5.2vw, 54px)`.
- Fonts are self-hosted from `public/fonts/`. No CDN, no `@import` from a third-party domain.

**Motion**
- `--motion` is 1 or 0 and multiplies every decorative displacement. Duration trick: `calc(7s / max(var(--motion), 0.0001))`.
- `--motion: 0` must reach the canvas: fog stops drifting, particles die, lantern pulse stops. The palette keeps shifting.
- `prefers-reduced-motion` is the default, not a lock — an in-app toggle overrides it both ways via `:root[data-motion='on'|'off']`.

**Copy (addendum §E.2)**
- Lowercase for ambient sentences, uppercase for structural labels only.
- No exclamation marks anywhere in the product. No jokes. No "Oops".
- Every empty / loading / error state has a hand-written sentence — none are default.
- Failures degrade through atmosphere, never through a banner. Error text still states what actually broke.
- Control labels are never poeticised: `MULAI`, `HENTI`, `LEWATI`, `TAMBAH`.

**Money-free, network-free**
- No accounts, no server, no fetch. Single-user, single-device, `localStorage` only.

**Commits**
- Conventional commit prefixes (`feat:`, `test:`, `docs:`, `chore:`, `style:`).
- Do not add a Claude co-author trailer.

---

## File Structure

```
NightWatch/
  index.html                        mount point, favicon data URI, font preload
  package.json  tsconfig.json  vite.config.ts
  public/fonts/                     self-hosted woff2 (see Task 1 Step 3)
  src/
    main.tsx                        React root
    App.tsx                         layout: <World/> + three panels
    style/
      tokens.css                    ONLY file with literal design values
      base.css                      reset, body, scanlines, vignette, paper grain
      components.css                panel, meter, button, digit, ico
    ambient/
      types.ts                      Rgb, Keyframe, GradeName, GradeDef, AmbientValues
      interpolate.ts                pure colour maths + resolve()
      keyframes.ts                  the five night keyframes (spec §4.2)
      grade.ts                      calm / pressed / bloodmoon (spec §4.3)
      driver.ts                     4 Hz writer to :root + subscriber fan-out
    session/
      machine.ts                    pure timer state machine
      streak.ts                     04:00 night boundary, streak length
      aggregate.ts                  minutes per night, minutes per quarry
    store/
      schema.ts                     Schema type, STORAGE_KEY, emptySchema()
      persist.ts                    load/save, corrupt recovery, 90-day prune
    world/
      hatch.ts                      gapFor(), hatch(), HATCH_ANGLES
      grain.ts                      128x128 noise -> data URI, once at boot
      layers.ts                     sky, far city, roofs, foreground -> static buffer
      fog.ts                        drifting fog bands
      bloom.ts                      lanterns, windows, moon + glow buffer
      renderer.ts                   cache policy + per-frame composition
      Canvas.tsx                    React mount, resize, rAF loop
    components/
      Panel.tsx  Meter.tsx  Button.tsx  Digit.tsx  Ico.tsx
    panels/
      TheWatch.tsx  TheQuarry.tsx  TheLedger.tsx
    app/
      copy.ts                       every hand-written sentence, spec §7
      useNightWatch.ts              wires store + machine + ambient together
  tests/                            mirrors src/ paths
```

One deviation from spec §8: `world/renderer.ts` and `app/` were not named in the spec's tree. They exist because cache policy (addendum §B.3) and the copy table (spec §7) each deserve one owner rather than being scattered across components.

---

### Task 1: Project skeleton, tokens, and the notched frame

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`
- Create: `src/main.tsx`, `src/App.tsx`
- Create: `src/style/tokens.css`, `src/style/base.css`, `src/style/components.css`
- Create: `tests/smoke.test.ts`
- Create: `public/fonts/.gitkeep`

**Interfaces:**
- Consumes: nothing.
- Produces: a booting Vite app; the CSS custom properties every later task reads; `npm test`, `npm run build`, `npm run typecheck` scripts.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "night-watch",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "react": "^19.2.7",
    "react-dom": "^19.2.7"
  },
  "devDependencies": {
    "@types/react": "^19.2.17",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^25.0.1",
    "typescript": "^5.7.2",
    "vite": "^6.0.7",
    "vitest": "^2.1.8"
  }
}
```

Run: `npm install`

- [ ] **Step 2: Create `tsconfig.json` and `vite.config.ts`**

`tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noUnusedLocals": true,
    "noEmit": true,
    "skipLibCheck": true,
    "types": ["vitest/globals"]
  },
  "include": ["src", "tests", "vite.config.ts"]
}
```

`vite.config.ts`:

```ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
  },
});
```

The default test environment is `node`. Files that touch `document` opt in per-file with `// @vitest-environment jsdom` on line 1.

- [ ] **Step 3: Add the self-hosted fonts (manual)**

Download two woff2 files and place them at exactly these paths:

- `public/fonts/press-start-2p-latin.woff2` — Press Start 2P, latin subset
- `public/fonts/silkscreen-latin.woff2` — Silkscreen regular, latin subset

Get them from the Google Fonts static host by opening `https://fonts.googleapis.com/css2?family=Press+Start+2P&family=Silkscreen` in a browser, copying the `latin` `src:` URLs from the returned CSS, and downloading those `.woff2` files directly. Do not link the stylesheet — a CDN font breaks Global Constraints.

If the files are absent the app still runs; the `@font-face` blocks in Step 4 fall through to `ui-monospace` and the acceptance checklist item "fonts self-hosted" fails until they are added.

- [ ] **Step 4: Create `src/style/tokens.css`**

```css
@font-face {
  font-family: 'Press Start 2P';
  src: url('/fonts/press-start-2p-latin.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0000-00FF, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+2718, U+2766;
}
@font-face {
  font-family: 'Silkscreen';
  src: url('/fonts/silkscreen-latin.woff2') format('woff2');
  font-display: swap;
  unicode-range: U+0000-00FF, U+2013-2014, U+2018-201A, U+201C-201E, U+2026, U+2718, U+2766;
}

:root {
  /* Ambient — overwritten at 4 Hz by src/ambient/driver.ts.
     These literals are the at:0.00 keyframe, so a boot before the first
     write already looks correct rather than unstyled. */
  --amb-deep: #0e1218;
  --amb-mid: #243039;
  --amb-lift: #4a6070;
  --amb-glow: #ffb347;
  --amb-accent: #6f8f9c;
  --amb-ink: #ece4d8;
  --amb-ink-soft: #9aa5a8;
  --amb-lum: 0.22;

  /* Rare accents (addendum §D) */
  --acc-blood: #8c2f3a;
  --acc-brass: #b08d57;
  --acc-dusk: #7d6b8a;

  /* Glass — derived, never hand-set */
  --glass-bg: color-mix(in oklab, var(--amb-deep) 86%, transparent);
  --glass-hi: color-mix(in oklab, #ffffff 14%, transparent);
  --glass-lo: color-mix(in oklab, #000000 30%, transparent);
  --glass-edge: color-mix(in oklab, var(--amb-mid) 88%, #000 12%);
  --glass-blur: 18px;

  /* Pixel geometry */
  --px: 4px;  --px2: 8px;  --px3: 12px; --px4: 16px;
  --px5: 20px; --px6: 24px; --px8: 32px;

  /* Type */
  --font-display: 'Press Start 2P', 'Silkscreen', ui-monospace, monospace;
  --font-ui: 'Silkscreen', 'Press Start 2P', ui-monospace, monospace;
  --font-body: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace;

  --fs-nano: 10px; --fs-micro: 11px; --fs-small: 13px;
  --fs-base: 15px; --fs-lg: 18px; --fs-xl: 24px;

  /* Motion */
  --motion: 1;
  --ease-spring: linear(
    0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%,
    0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001
  );
  --ease-out: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-snap: cubic-bezier(0.2, 0.9, 0.2, 1.05);
  --dur-fast: 140ms; --dur: 260ms; --dur-slow: 520ms;

  /* Elevation */
  --shadow-rest: 0 10px 26px -10px rgb(0 0 0 / .55), 0 2px 0 0 rgb(0 0 0 / .28);
  --shadow-lift: 0 22px 46px -14px rgb(0 0 0 / .62), 0 3px 0 0 rgb(0 0 0 / .30);
  --halo: 0 0 var(--px5) color-mix(in oklab, var(--amb-glow) 38%, transparent);

  /* Paper grain, replaced at boot by src/world/grain.ts */
  --grain-uri: none;
}

@media (prefers-reduced-motion: reduce) { :root { --motion: 0; } }
:root[data-motion='off'] { --motion: 0; }
:root[data-motion='on']  { --motion: 1; }
```

- [ ] **Step 5: Create `src/style/base.css`**

```css
*, *::before, *::after { box-sizing: border-box; }
html, body, #root { height: 100%; }
body {
  margin: 0;
  background: var(--amb-deep);
  color: var(--amb-ink);
  font-family: var(--font-body);
  font-size: var(--fs-small);
  -webkit-font-smoothing: none;
  font-smooth: never;
  text-rendering: optimizeSpeed;
  overflow-x: hidden;
}

/* World layer sits behind everything and never scrolls with content. */
.world {
  position: fixed;
  inset: 0;
  z-index: 0;
  display: block;
}

/* Chrome layer */
.app {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  gap: var(--px6);
  padding: var(--px5) clamp(var(--px3), 3vw, var(--px8)) var(--px5);
  max-width: 1680px;
  margin-inline: auto;
  min-height: 100%;
}
@media (min-width: 2100px) { .app { max-width: 1880px; } }

/* Atmosphere — both pointer-transparent, both fixed above the world.
   Scanlines belong to the CHROME layer per addendum §C.3; the paper grain
   belongs to the WORLD layer, so it sits below z-index 1. */
.grain {
  position: fixed; inset: 0; z-index: 0; pointer-events: none;
  opacity: 0.05;
  mix-blend-mode: overlay;
  background-image: var(--grain-uri);
  background-size: 128px 128px;
}
.scanlines {
  position: fixed; inset: 0; z-index: 2; pointer-events: none;
  opacity: 0.035;
  background: repeating-linear-gradient(to bottom, #fff 0 1px, transparent 1px 3px);
  mix-blend-mode: overlay;
}
.vignette {
  position: fixed; inset: 0; z-index: 2; pointer-events: none;
  background: radial-gradient(118% 90% at 50% 42%,
    transparent 42%, rgb(4 4 14 / .32) 78%, rgb(3 3 10 / .62) 100%);
}

:focus-visible {
  outline: var(--px) solid var(--amb-accent);
  outline-offset: var(--px);
  border-radius: 2px;
}
::selection {
  background: color-mix(in oklab, var(--amb-accent) 55%, transparent);
  color: #0b0d1c;
}
```

- [ ] **Step 6: Create `src/style/components.css` with the notched frame**

```css
.panel {
  --frame: var(--glass-edge);
  position: relative;
  padding: var(--px4);
  isolation: isolate;
  display: flex;
  flex-direction: column;

  background: var(--glass-bg);
  backdrop-filter: blur(var(--glass-blur)) saturate(1.3);
  -webkit-backdrop-filter: blur(var(--glass-blur)) saturate(1.3);

  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--frame),
    0 var(--px)            0 0 var(--frame),
    calc(-1 * var(--px)) 0 0 0 var(--frame),
    var(--px)            0 0 0 var(--frame),
    inset 0 var(--px)            0 0 var(--glass-hi),
    inset 0 calc(-1 * var(--px)) 0 0 var(--glass-lo),
    var(--shadow-rest);

  animation-name: panelIn;
  animation-duration: 620ms;
  animation-timing-function: var(--ease-spring);
  animation-delay: calc(var(--i, 0) * 55ms);
  animation-fill-mode: both;
}

.panel::before {
  content: '';
  position: absolute; inset: 0;
  z-index: -1;
  pointer-events: none;
  background: linear-gradient(142deg,
    color-mix(in oklab, #fff 9%, transparent) 0%,
    transparent 34%,
    transparent 66%,
    color-mix(in oklab, var(--amb-glow) 7%, transparent) 100%);
}

@keyframes panelIn {
  from {
    opacity: 0;
    transform: translate3d(0, calc(22px * var(--motion)), 0)
               scale(calc(1 - 0.03 * var(--motion)));
    filter: blur(calc(6px * var(--motion)));
  }
  to { opacity: 1; transform: none; filter: blur(0); }
}

@keyframes floatY {
  0%, 100% { translate: 0 0; }
  50%      { translate: 0 calc(-5px * var(--motion)); }
}
.panel--float {
  animation-name: panelIn, floatY;
  animation-duration: 620ms, var(--float-dur, 6.2s);
  animation-timing-function: var(--ease-spring), ease-in-out;
  animation-delay: calc(var(--i, 0) * 55ms), var(--float-delay, 0s);
  animation-iteration-count: 1, infinite;
  animation-fill-mode: both, none;
}
@media (hover: hover) { .panel--float:hover { animation-play-state: running, paused; } }

.panel__head { display: flex; align-items: center; gap: var(--px2); margin-bottom: var(--px3); }
.panel__title {
  font-family: var(--font-ui); font-size: var(--fs-micro); font-weight: 700;
  letter-spacing: 0.16em; text-transform: uppercase; color: var(--amb-ink-soft);
}
.panel__tools { margin-left: auto; display: flex; gap: var(--px); }
.panel__body { flex: 1; min-height: 0; display: flex; flex-direction: column; justify-content: center; }
.panel__body > * { width: 100%; }

.panel__spark {
  width: var(--px2); height: var(--px2); flex: none;
  background: var(--amb-glow);
  box-shadow: 0 0 var(--px3) var(--amb-glow);
  animation: sparkPulse calc(2.4s / max(var(--motion), 0.0001)) ease-in-out infinite;
}
@keyframes sparkPulse {
  0%, 100% { opacity: .55; transform: scale(1); }
  50%      { opacity: 1;   transform: scale(1.35); }
}

.divider {
  height: 2px; margin: var(--px3) 0; border: 0;
  background: repeating-linear-gradient(90deg,
    color-mix(in oklab, var(--amb-mid) 90%, transparent) 0 4px,
    transparent 4px 8px);
}

.label {
  font-family: var(--font-ui); font-size: var(--fs-nano); letter-spacing: 0.14em;
  text-transform: uppercase; color: var(--amb-ink-soft);
}
```

- [ ] **Step 7: Create `index.html`, `src/main.tsx`, `src/App.tsx`**

`index.html`:

```html
<!doctype html>
<html lang="id" data-motion="auto">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Night Watch</title>
    <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Crect width='16' height='16' fill='%230e1218'/%3E%3Crect x='6' y='3' width='4' height='6' fill='%23ffb347'/%3E%3Crect x='7' y='9' width='2' height='4' fill='%23243039'/%3E%3C/svg%3E" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:

```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './style/tokens.css';
import './style/base.css';
import './style/components.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx` — a deliberate stub. Later tasks replace its body; this version exists so Step 9 has something to build.

```tsx
export function App() {
  return (
    <>
      <div className="app">
        <section className="panel" style={{ ['--i' as string]: 0 }}>
          <header className="panel__head">
            <span className="panel__spark" />
            <h2 className="panel__title">The Watch</h2>
          </header>
          <div className="panel__body">
            <p className="label">the lamps are unlit.</p>
          </div>
        </section>
      </div>
      <div className="grain" />
      <div className="scanlines" />
      <div className="vignette" />
    </>
  );
}
```

- [ ] **Step 8: Write the failing smoke test**

`tests/smoke.test.ts`:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

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
```

- [ ] **Step 9: Run the test and the build**

Run: `npm test`
Expected: 3 passing.

Run: `npm run build`
Expected: `tsc --noEmit` clean, `vite build` writes `dist/`.

Run: `npm run dev` and open the page. Expected: a single dark notched glass panel, corners visibly **empty** (not mitred, not rounded), on a flat dark background.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat: project skeleton, design tokens, notched glass frame"
```

---

### Task 2: Ambient colour maths

**Files:**
- Create: `src/ambient/types.ts`, `src/ambient/interpolate.ts`
- Test: `tests/ambient/interpolate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type Rgb = readonly [number, number, number]`
  - `type Keyframe = { at: number; sky: readonly [string, string, string]; glow: string; accent: string; lum: number; ink: string; inkSoft: string }`
  - `type GradeName = 'calm' | 'pressed' | 'bloodmoon'`
  - `type GradeDef = { desat: number; dark: number; tint: string | null; tintAmt: number }`
  - `type AmbientValues = { deep: string; mid: string; lift: string; glow: string; accent: string; ink: string; inkSoft: string; lum: number; sky: readonly [string, string, string] }`
  - `smoothstep(t: number): number`
  - `hexToRgb(hex: string): Rgb`
  - `rgbToHex(rgb: Rgb): string`
  - `mixRgb(a: Rgb, b: Rgb, t: number): Rgb`
  - `desaturateRgb(rgb: Rgb, amount: number): Rgb`
  - `scaleRgb(rgb: Rgb, factor: number): Rgb`
  - `luminance(rgb: Rgb): number`
  - `lerpKeyframe(keys: readonly Keyframe[], at: number): Keyframe`
  - `resolve(keys: readonly Keyframe[], at: number, grades: readonly GradeDef[]): AmbientValues`

- [ ] **Step 1: Create `src/ambient/types.ts`**

```ts
export type Rgb = readonly [number, number, number];

export type Keyframe = {
  at: number;
  /** zenith, mid-band, horizon — three stops, never two (DNA §3.3) */
  sky: readonly [string, string, string];
  glow: string;
  accent: string;
  lum: number;
  ink: string;
  inkSoft: string;
};

export type GradeName = 'calm' | 'pressed' | 'bloodmoon';

export type GradeDef = {
  /** 0..1, pulls sky colours toward their own grey */
  desat: number;
  /** multiplier on sky lightness and lum; 1 = unchanged */
  dark: number;
  /** hex mixed into the key light, or null */
  tint: string | null;
  /** 0..1 strength of tint */
  tintAmt: number;
};

export type AmbientValues = {
  deep: string;
  mid: string;
  lift: string;
  glow: string;
  accent: string;
  ink: string;
  inkSoft: string;
  lum: number;
  sky: readonly [string, string, string];
};
```

- [ ] **Step 2: Write the failing test**

`tests/ambient/interpolate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Keyframe, GradeDef } from '../../src/ambient/types';
import {
  smoothstep, hexToRgb, rgbToHex, mixRgb, desaturateRgb, scaleRgb,
  luminance, lerpKeyframe, resolve,
} from '../../src/ambient/interpolate';

const KEYS: Keyframe[] = [
  { at: 0,   sky: ['#000000', '#404040', '#808080'], glow: '#ff0000',
    accent: '#00ff00', lum: 0, ink: '#ffffff', inkSoft: '#cccccc' },
  { at: 0.5, sky: ['#101010', '#505050', '#909090'], glow: '#ee1111',
    accent: '#11ee11', lum: 0.5, ink: '#eeeeee', inkSoft: '#bbbbbb' },
  { at: 1,   sky: ['#202020', '#606060', '#a0a0a0'], glow: '#dd2222',
    accent: '#22dd22', lum: 1, ink: '#dddddd', inkSoft: '#aaaaaa' },
];

const CALM: GradeDef = { desat: 0, dark: 1, tint: null, tintAmt: 0 };

describe('smoothstep', () => {
  it('pins the ends and eases the middle', () => {
    expect(smoothstep(0)).toBe(0);
    expect(smoothstep(1)).toBe(1);
    expect(smoothstep(0.5)).toBe(0.5);
    expect(smoothstep(0.25)).toBeLessThan(0.25);
    expect(smoothstep(0.75)).toBeGreaterThan(0.75);
  });
});

describe('hex round trip', () => {
  it('parses and re-emits', () => {
    expect(hexToRgb('#ffb347')).toEqual([255, 179, 71]);
    expect(rgbToHex([255, 179, 71])).toBe('#ffb347');
    expect(rgbToHex(hexToRgb('#0e1218'))).toBe('#0e1218');
  });

  it('clamps out-of-range channels', () => {
    expect(rgbToHex([-20, 300, 128])).toBe('#00ff80');
  });
});

describe('mixRgb', () => {
  it('returns a at t=0 and b at t=1', () => {
    expect(mixRgb([0, 0, 0], [255, 255, 255], 0)).toEqual([0, 0, 0]);
    expect(mixRgb([0, 0, 0], [255, 255, 255], 1)).toEqual([255, 255, 255]);
  });
  it('interpolates linearly', () => {
    expect(mixRgb([0, 0, 0], [200, 100, 50], 0.5)).toEqual([100, 50, 25]);
  });
});

describe('desaturateRgb', () => {
  it('leaves colour untouched at 0 and greys it at 1', () => {
    expect(desaturateRgb([200, 100, 50], 0)).toEqual([200, 100, 50]);
    const grey = desaturateRgb([200, 100, 50], 1);
    expect(grey[0]).toBe(grey[1]);
    expect(grey[1]).toBe(grey[2]);
  });
});

describe('scaleRgb', () => {
  it('multiplies and clamps', () => {
    expect(scaleRgb([100, 100, 100], 0.5)).toEqual([50, 50, 50]);
    expect(scaleRgb([200, 200, 200], 2)).toEqual([255, 255, 255]);
  });
});

describe('lerpKeyframe', () => {
  it('returns the exact keyframe at a keyframe boundary', () => {
    expect(lerpKeyframe(KEYS, 0).sky[1]).toBe('#404040');
    expect(lerpKeyframe(KEYS, 1).sky[1]).toBe('#606060');
  });

  it('clamps outside the range instead of extrapolating', () => {
    expect(lerpKeyframe(KEYS, -3).sky[1]).toBe('#404040');
    expect(lerpKeyframe(KEYS, 9).sky[1]).toBe('#606060');
  });

  it('eases between keyframes rather than moving linearly', () => {
    // smoothstep(0.5) === 0.5, so the midpoint of a segment is the linear midpoint
    expect(lerpKeyframe(KEYS, 0.25).sky[1]).toBe('#484848');
    // a quarter into the segment must be nearer the start than linear would be
    const quarter = hexToRgb(lerpKeyframe(KEYS, 0.125).sky[1])[0];
    expect(quarter).toBeLessThan(0x40 + (0x50 - 0x40) * 0.25);
  });
});

describe('resolve', () => {
  it('keeps every surface dark at every point in the night', () => {
    for (let at = 0; at <= 1.0001; at += 0.05) {
      const v = resolve(KEYS, at, [CALM]);
      expect(luminance(hexToRgb(v.deep))).toBeLessThan(60);
      expect(luminance(hexToRgb(v.mid))).toBeLessThan(110);
    }
  });

  it('derives deep from the sky mid-band, not the zenith', () => {
    // zenith is pure black in KEYS; if deep came from it, the glow tint would
    // be the only colour present and the two would be identical
    const v = resolve(KEYS, 1, [CALM]);
    expect(v.deep).not.toBe(rgbToHex(mixRgb([0x20, 0x20, 0x20], [8, 8, 16], 0.72)));
  });

  it('leaves ink untouched by grade so contrast survives', () => {
    const calm = resolve(KEYS, 0.5, [CALM]);
    const dark = resolve(KEYS, 0.5, [{ desat: 0.5, dark: 0.5, tint: null, tintAmt: 0 }]);
    expect(dark.ink).toBe(calm.ink);
    expect(dark.inkSoft).toBe(calm.inkSoft);
  });

  it('stacks grades instead of replacing them', () => {
    const a: GradeDef = { desat: 0.2, dark: 0.9, tint: null, tintAmt: 0 };
    const b: GradeDef = { desat: 0.1, dark: 0.8, tint: null, tintAmt: 0 };
    const both = resolve(KEYS, 0.5, [a, b]);
    const onlyA = resolve(KEYS, 0.5, [a]);
    expect(luminance(hexToRgb(both.mid))).toBeLessThan(luminance(hexToRgb(onlyA.mid)));
  });

  it('tints only the key light', () => {
    const tinted = resolve(KEYS, 0.5, [
      { desat: 0, dark: 1, tint: '#0000ff', tintAmt: 0.5 },
    ]);
    const plain = resolve(KEYS, 0.5, [CALM]);
    expect(tinted.glow).not.toBe(plain.glow);
    expect(hexToRgb(tinted.glow)[2]).toBeGreaterThan(hexToRgb(plain.glow)[2]);
    expect(tinted.accent).toBe(plain.accent);
  });

  it('scales lum by the stacked dark factor', () => {
    const v = resolve(KEYS, 1, [{ desat: 0, dark: 0.5, tint: null, tintAmt: 0 }]);
    expect(v.lum).toBeCloseTo(0.5, 5);
  });
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `npx vitest run tests/ambient/interpolate.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/ambient/interpolate"`.

- [ ] **Step 4: Implement `src/ambient/interpolate.ts`**

```ts
import type { AmbientValues, GradeDef, Keyframe, Rgb } from './types';

/** DNA §3.3 — linear interpolation reads as a wipe. */
export const smoothstep = (t: number): number => t * t * (3 - 2 * t);

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp255 = (v: number) => clamp(Math.round(v), 0, 255);

export function hexToRgb(hex: string): Rgb {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function rgbToHex(rgb: Rgb): string {
  return '#' + rgb.map((c) => clamp255(c).toString(16).padStart(2, '0')).join('');
}

export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  return [
    a[0] + (b[0] - a[0]) * t,
    a[1] + (b[1] - a[1]) * t,
    a[2] + (b[2] - a[2]) * t,
  ];
}

/** Rec. 601 weights — close enough to perceived brightness for a dark-floor check. */
export function luminance(rgb: Rgb): number {
  return 0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2];
}

export function desaturateRgb(rgb: Rgb, amount: number): Rgb {
  const g = luminance(rgb);
  return mixRgb(rgb, [g, g, g], clamp(amount, 0, 1));
}

export function scaleRgb(rgb: Rgb, factor: number): Rgb {
  return [clamp255(rgb[0] * factor), clamp255(rgb[1] * factor), clamp255(rgb[2] * factor)];
}

/** The ink the chrome sinks toward. DNA §3.4. */
const INK_BLACK: Rgb = [8, 8, 16];

function mixHex(a: string, b: string, t: number): string {
  return rgbToHex(mixRgb(hexToRgb(a), hexToRgb(b), t));
}

export function lerpKeyframe(keys: readonly Keyframe[], at: number): Keyframe {
  const first = keys[0];
  const last = keys[keys.length - 1];
  if (!first || !last) throw new Error('lerpKeyframe: keys must not be empty');
  if (at <= first.at) return first;
  if (at >= last.at) return last;

  let i = 0;
  while (i < keys.length - 2 && at > keys[i + 1]!.at) i++;
  const a = keys[i]!;
  const b = keys[i + 1]!;
  const span = b.at - a.at || 1;
  const t = smoothstep(clamp((at - a.at) / span, 0, 1));

  return {
    at,
    sky: [
      mixHex(a.sky[0], b.sky[0], t),
      mixHex(a.sky[1], b.sky[1], t),
      mixHex(a.sky[2], b.sky[2], t),
    ],
    glow: mixHex(a.glow, b.glow, t),
    accent: mixHex(a.accent, b.accent, t),
    lum: a.lum + (b.lum - a.lum) * t,
    ink: mixHex(a.ink, b.ink, t),
    inkSoft: mixHex(a.inkSoft, b.inkSoft, t),
  };
}

export function resolve(
  keys: readonly Keyframe[],
  at: number,
  grades: readonly GradeDef[],
): AmbientValues {
  const k = lerpKeyframe(keys, at);

  // Grades stack: desaturation sums (clamped), darkening multiplies, tints apply
  // in order. Ink is deliberately excluded — dimming text is how this system
  // would fail its contrast checks.
  let desat = 0;
  let dark = 1;
  for (const g of grades) {
    desat += g.desat;
    dark *= g.dark;
  }
  desat = clamp(desat, 0, 1);

  const gradeSky = k.sky.map((s) =>
    rgbToHex(scaleRgb(desaturateRgb(hexToRgb(s), desat), dark)),
  ) as unknown as readonly [string, string, string];

  let glow = hexToRgb(k.glow);
  for (const g of grades) {
    if (g.tint) glow = mixRgb(glow, hexToRgb(g.tint), clamp(g.tintAmt, 0, 1));
  }
  const glowHex = rgbToHex(glow);

  // The mid band, not the zenith: at night the zenith is nearly achromatic and
  // its tint vanishes completely from the chrome. DNA §3.4.
  const base = hexToRgb(gradeSky[1]);
  const deep = mixRgb(base, INK_BLACK, 0.72);
  const deepTinted = mixRgb(deep, glow, 0.06);

  return {
    deep: rgbToHex(deepTinted),
    mid: rgbToHex(mixRgb(base, INK_BLACK, 0.42)),
    lift: rgbToHex(mixRgb(mixRgb(base, INK_BLACK, 0.3), glow, 0.22)),
    glow: glowHex,
    accent: k.accent,
    ink: k.ink,
    inkSoft: k.inkSoft,
    lum: clamp(k.lum * dark, 0, 1),
    sky: gradeSky,
  };
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npx vitest run tests/ambient/interpolate.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 6: Commit**

```bash
git add src/ambient tests/ambient
git commit -m "feat: ambient colour interpolation with stacked grades"
```

---

### Task 3: Night keyframes, grades, and the 4 Hz driver

**Files:**
- Create: `src/ambient/keyframes.ts`, `src/ambient/grade.ts`, `src/ambient/driver.ts`
- Test: `tests/ambient/keyframes.test.ts`, `tests/ambient/driver.test.ts`

**Interfaces:**
- Consumes: everything from Task 2.
- Produces:
  - `NIGHT_KEYS: readonly Keyframe[]` — the five keyframes of spec §4.2
  - `GRADES: Record<GradeName, GradeDef>`
  - `gradesFor(names: readonly GradeName[]): GradeDef[]`
  - `writeAmbient(root: HTMLElement, v: AmbientValues): void`
  - `startAmbientDriver(opts: { read: () => { progress: number; grades: readonly GradeName[] }; onValues?: (v: AmbientValues) => void; root?: HTMLElement; intervalMs?: number }): () => void`

- [ ] **Step 1: Create `src/ambient/keyframes.ts`**

```ts
import type { Keyframe } from './types';

/**
 * Spec §4.2. Spacing is deliberately uneven — dense between 0.62 and 0.85
 * where the change matters most (DNA §3.3).
 *
 * Two values look like mistakes and are not:
 *  - glow BRIGHTENS at 0.62. Thick fog scatters gaslight yellower, not dimmer.
 *  - glow turns COLD at 1.00. Dawn puts the gas out. It is the only cold key
 *    light in the app, and it is the reward for finishing.
 */
export const NIGHT_KEYS: readonly Keyframe[] = [
  { at: 0.00, sky: ['#2b2233', '#4a3450', '#8a5a4e'],
    glow: '#ffb347', accent: '#6f8f9c', lum: 0.46,
    ink: '#ece4d8', inkSoft: '#b3a79c' },
  { at: 0.35, sky: ['#161c2a', '#26303f', '#4a4a52'],
    glow: '#ffb347', accent: '#6f8f9c', lum: 0.30,
    ink: '#ece4d8', inkSoft: '#a2a5a3' },
  { at: 0.62, sky: ['#0f141c', '#1a2430', '#2b3740'],
    glow: '#ffc46b', accent: '#6f8f9c', lum: 0.18,
    ink: '#ece4d8', inkSoft: '#9aa5a8' },
  { at: 0.85, sky: ['#080b11', '#0e1218', '#161e26'],
    glow: '#ffb347', accent: '#6f8f9c', lum: 0.08,
    ink: '#e6ded2', inkSoft: '#95a0a4' },
  { at: 1.00, sky: ['#1b2733', '#33465a', '#7d8a92'],
    glow: '#cfd8dc', accent: '#b08d57', lum: 0.52,
    ink: '#f2ece2', inkSoft: '#aab4b8' },
];
```

- [ ] **Step 2: Create `src/ambient/grade.ts`**

```ts
import type { GradeDef, GradeName } from './types';

/** Spec §4.3. `pressed` and `bloodmoon` stack; their effects compound. */
export const GRADES: Record<GradeName, GradeDef> = {
  calm:      { desat: 0,    dark: 1,    tint: null,      tintAmt: 0    },
  pressed:   { desat: 0.18, dark: 0.92, tint: null,      tintAmt: 0    },
  bloodmoon: { desat: 0.10, dark: 0.88, tint: '#8c2f3a', tintAmt: 0.16 },
};

export function gradesFor(names: readonly GradeName[]): GradeDef[] {
  return names.length === 0 ? [GRADES.calm] : names.map((n) => GRADES[n]);
}
```

- [ ] **Step 3: Write the failing keyframe test**

`tests/ambient/keyframes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { GRADES, gradesFor } from '../../src/ambient/grade';
import { hexToRgb, luminance, resolve } from '../../src/ambient/interpolate';

describe('NIGHT_KEYS', () => {
  it('runs from 0 to 1 in ascending order', () => {
    expect(NIGHT_KEYS[0]!.at).toBe(0);
    expect(NIGHT_KEYS[NIGHT_KEYS.length - 1]!.at).toBe(1);
    for (let i = 1; i < NIGHT_KEYS.length; i++) {
      expect(NIGHT_KEYS[i]!.at).toBeGreaterThan(NIGHT_KEYS[i - 1]!.at);
    }
  });

  it('is unevenly spaced', () => {
    const gaps = NIGHT_KEYS.slice(1).map((k, i) => k.at - NIGHT_KEYS[i]!.at);
    const min = Math.min(...gaps);
    const max = Math.max(...gaps);
    expect(max - min).toBeGreaterThan(0.05);
  });

  it('brightens the key light in the thickest fog', () => {
    const fog = NIGHT_KEYS.find((k) => k.at === 0.62)!;
    const before = NIGHT_KEYS.find((k) => k.at === 0.35)!;
    expect(luminance(hexToRgb(fog.glow))).toBeGreaterThan(luminance(hexToRgb(before.glow)));
  });

  it('turns the key light cold only at dawn', () => {
    const cold = (hex: string) => hexToRgb(hex)[2] > hexToRgb(hex)[0];
    expect(cold(NIGHT_KEYS[NIGHT_KEYS.length - 1]!.glow)).toBe(true);
    for (const k of NIGHT_KEYS.slice(0, -1)) expect(cold(k.glow)).toBe(false);
  });

  it('uses no fully saturated colour', () => {
    for (const k of NIGHT_KEYS) {
      for (const hex of [...k.sky, k.glow, k.accent, k.ink, k.inkSoft]) {
        const [r, g, b] = hexToRgb(hex);
        const spread = Math.max(r, g, b) - Math.min(r, g, b);
        expect(spread).toBeLessThan(230);
      }
    }
  });
});

describe('the darkest reachable state', () => {
  it('never collapses to black', () => {
    // witching hour + bloodmoon + pressed is the worst combination that exists
    const v = resolve(NIGHT_KEYS, 0.85, gradesFor(['pressed', 'bloodmoon']));
    expect(luminance(hexToRgb(v.deep))).toBeGreaterThan(4);
    // and the lantern stays fully lit — addendum §D.1
    expect(luminance(hexToRgb(v.glow))).toBeGreaterThan(120);
  });

  it('keeps body text legible against the panel at every point', () => {
    for (const grades of [['calm'], ['pressed'], ['bloodmoon'], ['pressed', 'bloodmoon']] as const) {
      for (let at = 0; at <= 1.0001; at += 0.05) {
        const v = resolve(NIGHT_KEYS, at, gradesFor(grades));
        const contrast = luminance(hexToRgb(v.ink)) - luminance(hexToRgb(v.deep));
        expect(contrast).toBeGreaterThan(120);
      }
    }
  });
});

describe('gradesFor', () => {
  it('falls back to calm when nothing is active', () => {
    expect(gradesFor([])).toEqual([GRADES.calm]);
  });
  it('preserves order for stacking', () => {
    expect(gradesFor(['pressed', 'bloodmoon'])).toEqual([GRADES.pressed, GRADES.bloodmoon]);
  });
});
```

- [ ] **Step 4: Run it**

Run: `npx vitest run tests/ambient/keyframes.test.ts`
Expected: PASS, 8 tests. If the contrast assertion fails, the fix is to lift `ink` in the offending keyframe — never to lighten `deep`, which would break the dark-surface rule.

- [ ] **Step 5: Write the failing driver test**

`tests/ambient/driver.test.ts`:

```ts
// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { startAmbientDriver, writeAmbient } from '../../src/ambient/driver';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  document.documentElement.removeAttribute('style');
});

describe('writeAmbient', () => {
  it('writes all eight roles', () => {
    const root = document.documentElement;
    writeAmbient(root, resolve(NIGHT_KEYS, 0.5, gradesFor(['calm'])));
    for (const role of ['--amb-deep', '--amb-mid', '--amb-lift', '--amb-glow',
                        '--amb-accent', '--amb-ink', '--amb-ink-soft', '--amb-lum']) {
      expect(root.style.getPropertyValue(role)).not.toBe('');
    }
  });
});

describe('startAmbientDriver', () => {
  it('writes once immediately so the first paint is already correct', () => {
    const root = document.createElement('div');
    startAmbientDriver({ read: () => ({ progress: 0, grades: ['calm'] }), root });
    expect(root.style.getPropertyValue('--amb-glow')).not.toBe('');
  });

  it('ticks at 4 Hz', () => {
    const root = document.createElement('div');
    const onValues = vi.fn();
    startAmbientDriver({ read: () => ({ progress: 0, grades: ['calm'] }), root, onValues });
    onValues.mockClear();
    vi.advanceTimersByTime(1000);
    expect(onValues).toHaveBeenCalledTimes(4);
  });

  it('reads fresh state on every tick', () => {
    const root = document.createElement('div');
    let progress = 0;
    startAmbientDriver({ read: () => ({ progress, grades: ['calm'] }), root });
    const first = root.style.getPropertyValue('--amb-deep');
    progress = 1;
    vi.advanceTimersByTime(250);
    expect(root.style.getPropertyValue('--amb-deep')).not.toBe(first);
  });

  it('stops when the returned function is called', () => {
    const root = document.createElement('div');
    const onValues = vi.fn();
    const stop = startAmbientDriver({
      read: () => ({ progress: 0, grades: ['calm'] }), root, onValues,
    });
    stop();
    onValues.mockClear();
    vi.advanceTimersByTime(2000);
    expect(onValues).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 6: Run it to verify it fails**

Run: `npx vitest run tests/ambient/driver.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/ambient/driver"`.

- [ ] **Step 7: Implement `src/ambient/driver.ts`**

```ts
import { gradesFor } from './grade';
import { resolve } from './interpolate';
import { NIGHT_KEYS } from './keyframes';
import type { AmbientValues, GradeName } from './types';

/**
 * Writing a custom property invalidates style for the whole subtree, and no eye
 * can follow colour faster than this. DNA §3.4 — 4 Hz, not per frame.
 */
const TICK_MS = 250;

export function writeAmbient(root: HTMLElement, v: AmbientValues): void {
  const s = root.style;
  s.setProperty('--amb-deep', v.deep);
  s.setProperty('--amb-mid', v.mid);
  s.setProperty('--amb-lift', v.lift);
  s.setProperty('--amb-glow', v.glow);
  s.setProperty('--amb-accent', v.accent);
  s.setProperty('--amb-ink', v.ink);
  s.setProperty('--amb-ink-soft', v.inkSoft);
  s.setProperty('--amb-lum', v.lum.toFixed(3));
}

export function startAmbientDriver(opts: {
  read: () => { progress: number; grades: readonly GradeName[] };
  onValues?: (v: AmbientValues) => void;
  root?: HTMLElement;
  intervalMs?: number;
}): () => void {
  const root = opts.root ?? document.documentElement;
  const every = opts.intervalMs ?? TICK_MS;

  const tick = () => {
    const { progress, grades } = opts.read();
    const v = resolve(NIGHT_KEYS, progress, gradesFor(grades));
    writeAmbient(root, v);
    opts.onValues?.(v);
  };

  tick();
  const id = setInterval(tick, every);
  return () => clearInterval(id);
}
```

- [ ] **Step 8: Run both ambient test files**

Run: `npx vitest run tests/ambient`
Expected: PASS, all files green.

- [ ] **Step 9: Commit**

```bash
git add src/ambient tests/ambient
git commit -m "feat: night keyframes, grade table, 4 Hz ambient driver"
```

---

### Task 4: Persistence with corrupt recovery

**Files:**
- Create: `src/store/schema.ts`, `src/store/persist.ts`
- Test: `tests/store/persist.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `STORAGE_KEY = 'nightwatch:v1'`
  - `type Quarry = { id: string; name: string; minutes: number; done: boolean; createdAt: number }`
  - `type SessionRecord = { startedAt: number; minutes: number; quarryId: string | null }`
  - `type Settings = { huntMinutes: number; respiteMinutes: number; motion: 'auto' | 'on' | 'off' }`
  - `type Schema = { version: 1; quarry: Quarry[]; sessions: SessionRecord[]; settings: Settings }`
  - `emptySchema(): Schema`
  - `pruneSessions(sessions: readonly SessionRecord[], now: number, days?: number): SessionRecord[]`
  - `load(storage?: Storage): { data: Schema; recovered: boolean }`
  - `save(data: Schema, now?: number, storage?: Storage): void`

- [ ] **Step 1: Create `src/store/schema.ts`**

```ts
export const STORAGE_KEY = 'nightwatch:v1';
export const CORRUPT_PREFIX = 'nightwatch:corrupt:';
/** The Ledger needs 7 days, the streak needs the running chain. 90 gives room
    without letting localStorage grow forever. Spec §9. */
export const RETENTION_DAYS = 90;

export type Quarry = {
  id: string;
  name: string;
  minutes: number;
  done: boolean;
  createdAt: number;
};

export type SessionRecord = {
  startedAt: number;
  minutes: number;
  quarryId: string | null;
};

export type Settings = {
  huntMinutes: number;
  respiteMinutes: number;
  motion: 'auto' | 'on' | 'off';
};

export type Schema = {
  version: 1;
  quarry: Quarry[];
  sessions: SessionRecord[];
  settings: Settings;
};

export function emptySchema(): Schema {
  return {
    version: 1,
    quarry: [],
    sessions: [],
    settings: { huntMinutes: 50, respiteMinutes: 10, motion: 'auto' },
  };
}
```

- [ ] **Step 2: Write the failing test**

`tests/store/persist.test.ts`:

```ts
// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CORRUPT_PREFIX, STORAGE_KEY, emptySchema } from '../../src/store/schema';
import { load, pruneSessions, save } from '../../src/store/persist';

const DAY = 86_400_000;

beforeEach(() => localStorage.clear());

describe('load / save round trip', () => {
  it('returns what was written', () => {
    const data = emptySchema();
    data.quarry.push({ id: 'q1', name: 'refactor auth', minutes: 25, done: false, createdAt: 1 });
    save(data);
    const { data: back, recovered } = load();
    expect(recovered).toBe(false);
    expect(back.quarry[0]!.name).toBe('refactor auth');
  });

  it('returns an empty schema when nothing is stored', () => {
    const { data, recovered } = load();
    expect(recovered).toBe(false);
    expect(data).toEqual(emptySchema());
  });
});

describe('recovery', () => {
  it('starts clean but preserves unreadable data instead of deleting it', () => {
    localStorage.setItem(STORAGE_KEY, '{ this is not json');
    const { data, recovered } = load();
    expect(recovered).toBe(true);
    expect(data).toEqual(emptySchema());

    const rescued = Object.keys(localStorage).filter((k) => k.startsWith(CORRUPT_PREFIX));
    expect(rescued).toHaveLength(1);
    expect(localStorage.getItem(rescued[0]!)).toBe('{ this is not json');
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it('treats an unknown version as unreadable', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 7, quarry: [] }));
    const { recovered } = load();
    expect(recovered).toBe(true);
  });

  it('treats a structurally wrong payload as unreadable', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, quarry: 'nope' }));
    const { recovered } = load();
    expect(recovered).toBe(true);
  });

  it('fills in a missing settings block rather than failing', () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, quarry: [], sessions: [] }));
    const { data, recovered } = load();
    expect(recovered).toBe(false);
    expect(data.settings.huntMinutes).toBe(50);
  });
});

describe('pruneSessions', () => {
  const now = 1_000 * DAY;

  it('keeps the last 90 days and drops the rest', () => {
    const sessions = [
      { startedAt: now - 1 * DAY, minutes: 50, quarryId: null },
      { startedAt: now - 89 * DAY, minutes: 50, quarryId: null },
      { startedAt: now - 91 * DAY, minutes: 50, quarryId: null },
    ];
    const kept = pruneSessions(sessions, now);
    expect(kept).toHaveLength(2);
    expect(kept.every((s) => s.startedAt > now - 90 * DAY)).toBe(true);
  });

  it('runs on save', () => {
    const data = emptySchema();
    data.sessions.push({ startedAt: now - 200 * DAY, minutes: 50, quarryId: null });
    data.sessions.push({ startedAt: now - 2 * DAY, minutes: 50, quarryId: null });
    save(data, now);
    expect(load().data.sessions).toHaveLength(1);
  });
});

describe('quota failure', () => {
  it('does not throw when the write is rejected', () => {
    const hostile: Storage = {
      length: 0,
      clear: () => {},
      getItem: () => null,
      key: () => null,
      removeItem: () => {},
      setItem: () => { throw new DOMException('full', 'QuotaExceededError'); },
    };
    expect(() => save(emptySchema(), Date.now(), hostile)).not.toThrow();
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/store/persist.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/store/persist"`.

- [ ] **Step 4: Implement `src/store/persist.ts`**

```ts
import {
  CORRUPT_PREFIX, RETENTION_DAYS, STORAGE_KEY,
  type Schema, type SessionRecord, emptySchema,
} from './schema';

const DAY = 86_400_000;

export function pruneSessions(
  sessions: readonly SessionRecord[],
  now: number,
  days: number = RETENTION_DAYS,
): SessionRecord[] {
  const floor = now - days * DAY;
  return sessions.filter((s) => s.startedAt > floor);
}

function isSchema(v: unknown): v is Schema {
  if (typeof v !== 'object' || v === null) return false;
  const o = v as Record<string, unknown>;
  return o.version === 1 && Array.isArray(o.quarry) && Array.isArray(o.sessions);
}

export function load(storage: Storage = localStorage): { data: Schema; recovered: boolean } {
  const raw = storage.getItem(STORAGE_KEY);
  if (raw === null) return { data: emptySchema(), recovered: false };

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    parsed = null;
  }

  if (!isSchema(parsed)) {
    // Never destroy what we could not read. The user may want it back.
    storage.setItem(`${CORRUPT_PREFIX}${Date.now()}`, raw);
    storage.removeItem(STORAGE_KEY);
    return { data: emptySchema(), recovered: true };
  }

  // A missing settings block is a shape we can repair, not a corruption.
  const base = emptySchema();
  return {
    data: { ...parsed, settings: { ...base.settings, ...(parsed.settings ?? {}) } },
    recovered: false,
  };
}

export function save(
  data: Schema,
  now: number = Date.now(),
  storage: Storage = localStorage,
): void {
  const trimmed: Schema = { ...data, sessions: pruneSessions(data.sessions, now) };
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // A full disk is not worth a crash, and DNA §11 forbids a banner about it.
    // The session in memory continues; the next save may succeed after pruning.
  }
}
```

- [ ] **Step 5: Run it to verify it passes**

Run: `npx vitest run tests/store/persist.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/store tests/store
git commit -m "feat: versioned localStorage with corrupt recovery and 90-day prune"
```

---

### Task 5: The session state machine

**Files:**
- Create: `src/session/machine.ts`
- Test: `tests/session/machine.test.ts`

**Interfaces:**
- Consumes: `SessionRecord` from `src/store/schema.ts`.
- Produces:
  - `type Phase = 'idle' | 'hunt' | 'respite'`
  - `type SessionState = { phase: Phase; startedAt: number | null; huntMs: number; respiteMs: number; quarryId: string | null; frozenProgress: number }`
  - `type SessionEvent` — the union below
  - `initialState(huntMinutes: number, respiteMinutes: number): SessionState`
  - `reduce(state: SessionState, ev: SessionEvent): { state: SessionState; completed: SessionRecord | null }`
  - `elapsedMs(state: SessionState, now: number): number`
  - `progressOf(state: SessionState, now: number): number`

- [ ] **Step 1: Write the failing test**

`tests/session/machine.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  elapsedMs, initialState, progressOf, reduce,
  type SessionState,
} from '../../src/session/machine';

const T0 = 1_700_000_000_000;
const MIN = 60_000;
const fresh = (): SessionState => initialState(50, 10);

const start = (at = T0) => reduce(fresh(), { type: 'start', at }).state;

describe('idle', () => {
  it('starts at zero progress and stays there', () => {
    const s = fresh();
    expect(s.phase).toBe('idle');
    expect(progressOf(s, T0 + 99 * MIN)).toBe(0);
  });

  it('ignores a stop it never started', () => {
    const { state, completed } = reduce(fresh(), { type: 'stop', at: T0 });
    expect(state.phase).toBe('idle');
    expect(completed).toBeNull();
  });
});

describe('hunt', () => {
  it('advances with wall-clock time, not with tick count', () => {
    const s = start();
    expect(elapsedMs(s, T0 + 25 * MIN)).toBe(25 * MIN);
    expect(progressOf(s, T0 + 25 * MIN)).toBeCloseTo(0.5, 5);
  });

  it('a tick before the end changes nothing', () => {
    const { state, completed } = reduce(start(), { type: 'tick', at: T0 + 10 * MIN });
    expect(state.phase).toBe('hunt');
    expect(completed).toBeNull();
  });

  it('completes into respite and emits the record', () => {
    const s = reduce(start(), { type: 'selectQuarry', quarryId: 'q1' }).state;
    const { state, completed } = reduce(s, { type: 'tick', at: T0 + 50 * MIN });
    expect(state.phase).toBe('respite');
    expect(completed).toEqual({ startedAt: T0, minutes: 50, quarryId: 'q1' });
  });

  it('completes exactly once even after a long background gap', () => {
    const first = reduce(start(), { type: 'tick', at: T0 + 400 * MIN });
    expect(first.completed).not.toBeNull();
    expect(first.state.phase).toBe('respite');
    const second = reduce(first.state, { type: 'tick', at: T0 + 401 * MIN });
    expect(second.completed).toBeNull();
  });

  it('never reports progress above 1', () => {
    expect(progressOf(start(), T0 + 900 * MIN)).toBe(1);
  });

  it('stop records the partial minutes and returns to idle', () => {
    const { state, completed } = reduce(start(), { type: 'stop', at: T0 + 12.7 * MIN });
    expect(state.phase).toBe('idle');
    expect(completed).toEqual({ startedAt: T0, minutes: 12, quarryId: null });
  });

  it('stop under one minute records nothing', () => {
    const { completed } = reduce(start(), { type: 'stop', at: T0 + 30_000 });
    expect(completed).toBeNull();
  });
});

describe('respite', () => {
  it('freezes progress instead of rewinding the sky', () => {
    const done = reduce(start(), { type: 'tick', at: T0 + 50 * MIN }).state;
    expect(progressOf(done, T0 + 55 * MIN)).toBe(1);
    expect(done.frozenProgress).toBe(1);
  });

  it('returns to idle when the respite runs out', () => {
    const done = reduce(start(), { type: 'tick', at: T0 + 50 * MIN }).state;
    const { state } = reduce(done, { type: 'tick', at: T0 + 61 * MIN });
    expect(state.phase).toBe('idle');
  });
});

describe('skip', () => {
  it('leaves a hunt without recording anything', () => {
    const { state, completed } = reduce(start(), { type: 'skip', at: T0 + 20 * MIN });
    expect(state.phase).toBe('idle');
    expect(completed).toBeNull();
  });

  it('ends a respite early', () => {
    const done = reduce(start(), { type: 'tick', at: T0 + 50 * MIN }).state;
    expect(reduce(done, { type: 'skip', at: T0 + 51 * MIN }).state.phase).toBe('idle');
  });
});

describe('changing duration mid-hunt', () => {
  it('recomputes progress against the new duration', () => {
    const s = start();
    expect(progressOf(s, T0 + 25 * MIN)).toBeCloseTo(0.5, 5);
    const { state } = reduce(s, { type: 'setDurations', huntMinutes: 25, respiteMinutes: 5, at: T0 + 10 * MIN });
    expect(progressOf(state, T0 + 20 * MIN)).toBeCloseTo(0.8, 5);
    expect(state.startedAt).toBe(T0);
  });

  it('completes immediately if the new duration is already exceeded', () => {
    const s = start();
    const shortened = reduce(s, { type: 'setDurations', huntMinutes: 5, respiteMinutes: 5, at: T0 + 20 * MIN });
    expect(progressOf(shortened.state, T0 + 20 * MIN)).toBe(1);
    const { state, completed } = reduce(shortened.state, { type: 'tick', at: T0 + 20 * MIN });
    expect(state.phase).toBe('respite');
    expect(completed!.minutes).toBe(5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/session/machine.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/session/machine"`.

- [ ] **Step 3: Implement `src/session/machine.ts`**

```ts
import type { SessionRecord } from '../store/schema';

export type Phase = 'idle' | 'hunt' | 'respite';

export type SessionState = {
  phase: Phase;
  /** wall-clock ms when the current phase began; null when idle */
  startedAt: number | null;
  huntMs: number;
  respiteMs: number;
  quarryId: string | null;
  /** progress held during respite so the sky does not rewind. Spec §4.1 */
  frozenProgress: number;
};

export type SessionEvent =
  | { type: 'start'; at: number }
  | { type: 'stop'; at: number }
  | { type: 'skip'; at: number }
  | { type: 'tick'; at: number }
  | { type: 'setDurations'; huntMinutes: number; respiteMinutes: number; at: number }
  | { type: 'selectQuarry'; quarryId: string | null };

const MIN = 60_000;

export function initialState(huntMinutes: number, respiteMinutes: number): SessionState {
  return {
    phase: 'idle',
    startedAt: null,
    huntMs: huntMinutes * MIN,
    respiteMs: respiteMinutes * MIN,
    quarryId: null,
    frozenProgress: 0,
  };
}

/**
 * Derived from timestamps, never accumulated from ticks. A backgrounded tab, a
 * sleeping laptop and a dropped frame all leave this correct. Spec §10.
 */
export function elapsedMs(state: SessionState, now: number): number {
  if (state.startedAt === null) return 0;
  return Math.max(0, now - state.startedAt);
}

export function progressOf(state: SessionState, now: number): number {
  if (state.phase === 'idle') return 0;
  if (state.phase === 'respite') return state.frozenProgress;
  if (state.huntMs <= 0) return 1;
  return Math.min(1, elapsedMs(state, now) / state.huntMs);
}

function record(state: SessionState, now: number): SessionRecord | null {
  const minutes = Math.floor(elapsedMs(state, now) / MIN);
  if (minutes < 1 || state.startedAt === null) return null;
  return { startedAt: state.startedAt, minutes, quarryId: state.quarryId };
}

export function reduce(
  state: SessionState,
  ev: SessionEvent,
): { state: SessionState; completed: SessionRecord | null } {
  switch (ev.type) {
    case 'start':
      if (state.phase === 'hunt') return { state, completed: null };
      return {
        state: { ...state, phase: 'hunt', startedAt: ev.at, frozenProgress: 0 },
        completed: null,
      };

    case 'stop': {
      if (state.phase !== 'hunt') {
        return { state: { ...state, phase: 'idle', startedAt: null }, completed: null };
      }
      return {
        state: { ...state, phase: 'idle', startedAt: null, frozenProgress: 0 },
        completed: record(state, ev.at),
      };
    }

    case 'skip':
      return {
        state: { ...state, phase: 'idle', startedAt: null, frozenProgress: 0 },
        completed: null,
      };

    case 'tick': {
      if (state.phase === 'hunt' && elapsedMs(state, ev.at) >= state.huntMs) {
        const completed: SessionRecord | null = state.startedAt === null ? null : {
          startedAt: state.startedAt,
          minutes: Math.round(state.huntMs / MIN),
          quarryId: state.quarryId,
        };
        return {
          state: { ...state, phase: 'respite', startedAt: ev.at, frozenProgress: 1 },
          completed,
        };
      }
      if (state.phase === 'respite' && elapsedMs(state, ev.at) >= state.respiteMs) {
        return {
          state: { ...state, phase: 'idle', startedAt: null, frozenProgress: 0 },
          completed: null,
        };
      }
      return { state, completed: null };
    }

    case 'setDurations':
      // startedAt is untouched: the hunt keeps its origin, only the target moves.
      return {
        state: {
          ...state,
          huntMs: ev.huntMinutes * MIN,
          respiteMs: ev.respiteMinutes * MIN,
        },
        completed: null,
      };

    case 'selectQuarry':
      return { state: { ...state, quarryId: ev.quarryId }, completed: null };
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/session/machine.test.ts`
Expected: PASS, 14 tests.

- [ ] **Step 5: Commit**

```bash
git add src/session tests/session
git commit -m "feat: pure session state machine driven by timestamps"
```

---

### Task 6: Streak and aggregation across the 04:00 boundary

**Files:**
- Create: `src/session/streak.ts`, `src/session/aggregate.ts`
- Test: `tests/session/streak.test.ts`, `tests/session/aggregate.test.ts`

**Interfaces:**
- Consumes: `SessionRecord`, `Quarry` from `src/store/schema.ts`.
- Produces:
  - `NIGHT_BOUNDARY_HOUR = 4`
  - `nightKey(ts: number): string` — `'YYYY-MM-DD'` of the night a timestamp belongs to
  - `streakLength(sessions: readonly SessionRecord[], now: number): number`
  - `minutesByNight(sessions: readonly SessionRecord[], now: number, days?: number): { key: string; minutes: number }[]`
  - `minutesByQuarry(sessions: readonly SessionRecord[]): Record<string, number>`

- [ ] **Step 1: Write the failing streak test**

`tests/session/streak.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { NIGHT_BOUNDARY_HOUR, nightKey, streakLength } from '../../src/session/streak';

/** Local-time helper so these tests pass in any timezone. */
const at = (y: number, m: number, d: number, h: number, min = 0) =>
  new Date(y, m - 1, d, h, min, 0, 0).getTime();

const session = (ts: number) => ({ startedAt: ts, minutes: 50, quarryId: null });

describe('nightKey', () => {
  it('uses a 04:00 boundary, not midnight', () => {
    expect(NIGHT_BOUNDARY_HOUR).toBe(4);
    // 01:30 on the 12th still belongs to the night of the 11th
    expect(nightKey(at(2026, 7, 12, 1, 30))).toBe('2026-07-11');
    // 04:00 on the 12th starts the new night
    expect(nightKey(at(2026, 7, 12, 4, 0))).toBe('2026-07-12');
    expect(nightKey(at(2026, 7, 12, 23, 0))).toBe('2026-07-12');
  });

  it('rolls back across a month boundary', () => {
    expect(nightKey(at(2026, 8, 1, 2, 0))).toBe('2026-07-31');
  });

  it('rolls back across a year boundary', () => {
    expect(nightKey(at(2027, 1, 1, 3, 59))).toBe('2026-12-31');
  });
});

describe('streakLength', () => {
  const now = at(2026, 7, 27, 22, 0);

  it('is zero with no sessions', () => {
    expect(streakLength([], now)).toBe(0);
  });

  it('counts a chain ending tonight', () => {
    const s = [
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 26, 21, 0)),
      session(at(2026, 7, 25, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(3);
  });

  it('counts a chain ending last night when tonight is still empty', () => {
    const s = [session(at(2026, 7, 26, 21, 0)), session(at(2026, 7, 25, 21, 0))];
    expect(streakLength(s, now)).toBe(2);
  });

  it('breaks when a night is missed', () => {
    const s = [
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 25, 21, 0)),
      session(at(2026, 7, 24, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(1);
  });

  it('is zero when the last session is older than last night', () => {
    expect(streakLength([session(at(2026, 7, 20, 21, 0))], now)).toBe(0);
  });

  it('does not count two sessions in one night twice', () => {
    const s = [
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 28, 1, 0)),   // same night as above
      session(at(2026, 7, 26, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(2);
  });

  it('is order-independent', () => {
    const s = [
      session(at(2026, 7, 25, 21, 0)),
      session(at(2026, 7, 27, 21, 0)),
      session(at(2026, 7, 26, 21, 0)),
    ];
    expect(streakLength(s, now)).toBe(3);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/session/streak.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/session/streak"`.

- [ ] **Step 3: Implement `src/session/streak.ts`**

```ts
import type { SessionRecord } from '../store/schema';

/**
 * Spec §10. Midnight is the wrong boundary for people who work at night: a
 * session finishing at 01:30 belongs to the night before, and the theme agrees.
 */
export const NIGHT_BOUNDARY_HOUR = 4;

const pad = (n: number) => String(n).padStart(2, '0');

export function nightKey(ts: number): string {
  const d = new Date(ts);
  // Shifting the local hour handles month, year and DST rollover for free.
  d.setHours(d.getHours() - NIGHT_BOUNDARY_HOUR);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function previousNightKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number) as [number, number, number];
  const prev = new Date(y, m - 1, d - 1, 12, 0, 0, 0);
  return `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}-${pad(prev.getDate())}`;
}

export function streakLength(sessions: readonly SessionRecord[], now: number): number {
  if (sessions.length === 0) return 0;
  const nights = new Set(sessions.map((s) => nightKey(s.startedAt)));

  const tonight = nightKey(now);
  const lastNight = previousNightKey(tonight);

  // A streak may end tonight or last night; anything older is already broken.
  let cursor = nights.has(tonight) ? tonight : nights.has(lastNight) ? lastNight : null;
  if (cursor === null) return 0;

  let count = 0;
  while (nights.has(cursor)) {
    count++;
    cursor = previousNightKey(cursor);
  }
  return count;
}
```

- [ ] **Step 4: Write the failing aggregate test**

`tests/session/aggregate.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { minutesByNight, minutesByQuarry } from '../../src/session/aggregate';

const at = (y: number, m: number, d: number, h: number) =>
  new Date(y, m - 1, d, h, 0, 0, 0).getTime();

const now = at(2026, 7, 27, 22);

describe('minutesByNight', () => {
  it('returns exactly `days` rows, oldest first, gaps filled with zero', () => {
    const rows = minutesByNight([{ startedAt: at(2026, 7, 27, 21), minutes: 50, quarryId: null }], now, 7);
    expect(rows).toHaveLength(7);
    expect(rows[0]!.key).toBe('2026-07-21');
    expect(rows[6]!.key).toBe('2026-07-27');
    expect(rows[6]!.minutes).toBe(50);
    expect(rows[0]!.minutes).toBe(0);
  });

  it('sums several sessions in one night', () => {
    const rows = minutesByNight([
      { startedAt: at(2026, 7, 27, 21), minutes: 50, quarryId: null },
      { startedAt: at(2026, 7, 28, 1), minutes: 25, quarryId: null },
    ], now, 7);
    expect(rows[6]!.minutes).toBe(75);
  });

  it('ignores sessions outside the window', () => {
    const rows = minutesByNight([{ startedAt: at(2026, 6, 1, 21), minutes: 50, quarryId: null }], now, 7);
    expect(rows.every((r) => r.minutes === 0)).toBe(true);
  });
});

describe('minutesByQuarry', () => {
  it('totals per quarry and drops unattached sessions', () => {
    const totals = minutesByQuarry([
      { startedAt: 1, minutes: 50, quarryId: 'q1' },
      { startedAt: 2, minutes: 25, quarryId: 'q1' },
      { startedAt: 3, minutes: 10, quarryId: 'q2' },
      { startedAt: 4, minutes: 99, quarryId: null },
    ]);
    expect(totals).toEqual({ q1: 75, q2: 10 });
  });

  it('is an empty object for no sessions', () => {
    expect(minutesByQuarry([])).toEqual({});
  });
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `npx vitest run tests/session/aggregate.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/session/aggregate"`.

- [ ] **Step 6: Implement `src/session/aggregate.ts`**

```ts
import type { SessionRecord } from '../store/schema';
import { nightKey } from './streak';

const DAY = 86_400_000;

export function minutesByNight(
  sessions: readonly SessionRecord[],
  now: number,
  days = 7,
): { key: string; minutes: number }[] {
  const totals = new Map<string, number>();
  for (const s of sessions) {
    const k = nightKey(s.startedAt);
    totals.set(k, (totals.get(k) ?? 0) + s.minutes);
  }

  const rows: { key: string; minutes: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const key = nightKey(now - i * DAY);
    rows.push({ key, minutes: totals.get(key) ?? 0 });
  }
  return rows;
}

export function minutesByQuarry(sessions: readonly SessionRecord[]): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const s of sessions) {
    if (s.quarryId === null) continue;
    totals[s.quarryId] = (totals[s.quarryId] ?? 0) + s.minutes;
  }
  return totals;
}
```

- [ ] **Step 7: Run the whole session suite**

Run: `npx vitest run tests/session`
Expected: PASS, all files green.

- [ ] **Step 8: Commit**

```bash
git add src/session tests/session
git commit -m "feat: streak and aggregation across the 04:00 night boundary"
```

---

### Task 7: Engraved hatching

**Files:**
- Create: `src/world/hatch.ts`
- Test: `tests/world/hatch.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `HATCH_ANGLES = { far: -0.42, mid: -0.95, near: 0.30 }` (radians)
  - `type HatchOpts = { angle?: number; color?: string; minGap?: number; maxGap?: number; lineWidth?: number }`
  - `gapFor(value: number, minGap: number, maxGap: number): number`
  - `hatch(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, value: number, opt?: HatchOpts): void`

- [ ] **Step 1: Write the failing test**

`tests/world/hatch.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { HATCH_ANGLES, gapFor, hatch } from '../../src/world/hatch';

/** Minimal recorder standing in for a 2D context. */
function stubCtx() {
  const calls: string[] = [];
  const angles: number[] = [];
  let lines = 0;
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
    stroke: () => calls.push('stroke'),
    strokeStyle: '',
    lineWidth: 0,
    globalAlpha: 0,
  };
  return {
    ctx: ctx as unknown as CanvasRenderingContext2D,
    get calls() { return calls; },
    get angles() { return angles; },
    get lines() { return lines; },
    strokes: () => calls.filter((c) => c === 'stroke').length,
  };
}

describe('gapFor', () => {
  it('is widest at zero and tightest at one', () => {
    expect(gapFor(0, 2, 11)).toBeCloseTo(11, 5);
    expect(gapFor(1, 2, 11)).toBeCloseTo(2, 5);
  });

  it('decreases monotonically as value rises', () => {
    let prev = Infinity;
    for (let v = 0; v <= 1.0001; v += 0.05) {
      const g = gapFor(v, 2, 11);
      expect(g).toBeLessThanOrEqual(prev + 1e-9);
      prev = g;
    }
  });

  it('is not linear — the eye reads line density logarithmically', () => {
    const mid = gapFor(0.5, 2, 11);
    const linear = 11 - (11 - 2) * 0.5;
    expect(mid).toBeLessThan(linear);
  });

  it('clamps values outside 0..1', () => {
    expect(gapFor(-5, 2, 11)).toBeCloseTo(11, 5);
    expect(gapFor(9, 2, 11)).toBeCloseTo(2, 5);
  });
});

describe('hatch', () => {
  it('draws nothing on near-blank paper', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 100, 100, 0.01);
    expect(s.calls).toHaveLength(0);
  });

  it('always balances save with restore', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 100, 100, 0.4);
    expect(s.calls.filter((c) => c === 'save')).toHaveLength(
      s.calls.filter((c) => c === 'restore').length,
    );
  });

  it('draws more lines at a higher value', () => {
    const light = stubCtx();
    const heavy = stubCtx();
    hatch(light.ctx, 0, 0, 200, 200, 0.2);
    hatch(heavy.ctx, 0, 0, 200, 200, 0.6);
    expect(heavy.lines).toBeGreaterThan(light.lines);
  });

  it('does not cross-hatch below the dark third', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 200, 200, 0.6);
    expect(s.strokes()).toBe(1);
  });

  it('cross-hatches above 0.66 at a different angle', () => {
    const s = stubCtx();
    hatch(s.ctx, 0, 0, 200, 200, 0.85, { angle: HATCH_ANGLES.near });
    expect(s.strokes()).toBe(2);
    expect(s.angles).toHaveLength(2);
    expect(Math.abs(s.angles[1]! - s.angles[0]!)).toBeGreaterThan(0.5);
  });

  it('exposes one angle per depth layer, all distinct', () => {
    const values = Object.values(HATCH_ANGLES);
    expect(new Set(values).size).toBe(values.length);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/world/hatch.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/hatch"`.

- [ ] **Step 3: Implement `src/world/hatch.ts`**

```ts
/**
 * Addendum §C. Engraving has no grey: mid-tones come from the distance between
 * lines. Dark = tight. Light = loose. Darkest = two directions crossing.
 *
 * Angle marks DEPTH, not object — everything at the same distance shares one
 * angle, or the picture reads as matted fur.
 */
export const HATCH_ANGLES = { far: -0.42, mid: -0.95, near: 0.30 } as const;

export type HatchOpts = {
  angle?: number;
  color?: string;
  minGap?: number;
  maxGap?: number;
  lineWidth?: number;
};

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** Density is read logarithmically; a linear ramp wastes half its range. */
export function gapFor(value: number, minGap: number, maxGap: number): number {
  const t = Math.pow(clamp01(value), 0.72);
  return maxGap - (maxGap - minGap) * t;
}

export function hatch(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  value: number,
  opt: HatchOpts = {},
): void {
  const {
    angle = HATCH_ANGLES.far,
    color = '#000000',
    minGap = 2,
    maxGap = 11,
    lineWidth = 1,
  } = opt;

  if (value <= 0.02) return;

  const t = Math.pow(clamp01(value), 0.72);
  const gap = gapFor(value, minGap, maxGap);

  g.save();
  g.beginPath();
  g.rect(x, y, w, h);
  g.clip();
  g.strokeStyle = color;
  g.lineWidth = lineWidth;
  g.globalAlpha = 0.55 + 0.45 * t;

  const diag = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
  g.translate(x + w / 2, y + h / 2);
  g.rotate(angle);
  g.beginPath();
  for (let o = -diag; o <= diag; o += gap) {
    g.moveTo(o, -diag);
    g.lineTo(o, diag);
  }
  g.stroke();
  g.restore();

  // Crossing earlier than the darkest third makes the whole plate look dirty
  // rather than dark.
  if (value > 0.66) {
    hatch(g, x, y, w, h, (value - 0.66) / 0.34, {
      ...opt,
      angle: angle + 1.13,
      minGap: minGap + 1,
    });
  }
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/world/hatch.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/world tests/world
git commit -m "feat: engraved line hatching with depth-locked angles"
```

---

### Task 8: The world layer

**Files:**
- Create: `src/world/grain.ts`, `src/world/bloom.ts`, `src/world/fog.ts`, `src/world/layers.ts`, `src/world/renderer.ts`, `src/world/Canvas.tsx`
- Modify: `src/App.tsx` (mount `<World />`)
- Test: `tests/world/renderer.test.ts`

**Interfaces:**
- Consumes: `AmbientValues` (Task 2), `hatch`/`HATCH_ANGLES`/`gapFor` (Task 7).
- Produces:
  - `makeGrainUri(size?: number): string`
  - `lampCount(progress: number, total?: number): number`
  - `drawLamps(g: CanvasRenderingContext2D, w: number, h: number, v: AmbientValues, progress: number, timeMs: number, motion: number): void`
  - `fogOffset(timeMs: number, band: number, motion: number): number`
  - `drawFog(g: CanvasRenderingContext2D, w: number, h: number, v: AmbientValues, timeMs: number, motion: number): void`
  - `drawStatic(g: CanvasRenderingContext2D, w: number, h: number, v: AmbientValues, progress: number): void`
  - `channelDrift(a: string, b: string): number`
  - `createWorldRenderer(): { frame(target: CanvasRenderingContext2D, w: number, h: number, v: AmbientValues, progress: number, timeMs: number, motion: number): void; invalidate(): void }`
  - `<World progress={number} motion={number} values={AmbientValues} />`

- [ ] **Step 1: Write the failing test**

`tests/world/renderer.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { channelDrift } from '../../src/world/renderer';
import { lampCount } from '../../src/world/bloom';
import { fogOffset } from '../../src/world/fog';

describe('channelDrift', () => {
  it('is zero for identical colours', () => {
    expect(channelDrift('#243039', '#243039')).toBe(0);
  });
  it('reports the largest single-channel difference', () => {
    expect(channelDrift('#000000', '#0a0014')).toBe(0x14);
  });
});

describe('lampCount', () => {
  it('starts nearly dark and peaks in the thickest fog', () => {
    expect(lampCount(0)).toBe(2);
    expect(lampCount(0.62)).toBeGreaterThan(lampCount(0.35));
    expect(lampCount(0.62)).toBe(14);
  });

  it('falls back toward dawn as the gas goes out', () => {
    expect(lampCount(1)).toBeLessThan(lampCount(0.62));
  });

  it('never exceeds the total or drops below one', () => {
    for (let p = 0; p <= 1.0001; p += 0.02) {
      const n = lampCount(p, 14);
      expect(n).toBeGreaterThanOrEqual(1);
      expect(n).toBeLessThanOrEqual(14);
      expect(Number.isInteger(n)).toBe(true);
    }
  });
});

describe('fogOffset', () => {
  it('freezes completely when motion is zero', () => {
    expect(fogOffset(0, 0, 0)).toBe(fogOffset(9_999_999, 0, 0));
  });

  it('advances with time when motion is one', () => {
    expect(fogOffset(4000, 0, 1)).not.toBe(fogOffset(0, 0, 1));
  });

  it('drifts each band at a different rate and direction', () => {
    const a = fogOffset(5000, 0, 1);
    const b = fogOffset(5000, 1, 1);
    const c = fogOffset(5000, 2, 1);
    expect(a).not.toBeCloseTo(b, 3);
    expect(b).not.toBeCloseTo(c, 3);
    expect(Math.sign(a)).not.toBe(Math.sign(b));
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/world/renderer.test.ts`
Expected: FAIL — unresolved imports for `renderer`, `bloom`, `fog`.

- [ ] **Step 3: Implement `src/world/grain.ts`**

```ts
/**
 * Addendum §C.3. Paper grain replaces the CRT scanline in the WORLD layer only;
 * the scanline still sits above the chrome. Above 0.07 this stops reading as
 * paper and starts reading as bad video compression.
 */
export function makeGrainUri(size = 128): string {
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d');
  if (!g) return 'none';

  const img = g.createImageData(size, size);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = 110 + Math.random() * 70;
    d[i] = n; d[i + 1] = n; d[i + 2] = n; d[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return `url(${cv.toDataURL('image/png')})`;
}
```

- [ ] **Step 4: Implement `src/world/bloom.ts`**

```ts
import type { AmbientValues } from '../ambient/types';

const TOTAL_LAMPS = 14;

/**
 * Windows and lamps light up through the evening and go out toward dawn.
 * Peak is at 0.62 — the thickest fog, when the gas is doing the most work.
 */
export function lampCount(progress: number, total = TOTAL_LAMPS): number {
  const p = Math.min(1, Math.max(0, progress));
  const curve = p <= 0.62 ? p / 0.62 : 1 - (p - 0.62) / 0.38;
  const n = 2 + (total - 2) * Math.max(0, curve);
  return Math.max(1, Math.min(total, Math.round(n)));
}

/** Deterministic scatter so the same window lights up every render. */
function lampAt(i: number, w: number, h: number): { x: number; y: number; r: number } {
  const gx = ((i * 97) % 100) / 100;
  const gy = ((i * 53) % 37) / 37;
  return { x: gx * w, y: h * (0.52 + gy * 0.22), r: 2 + (i % 3) };
}

export function drawLamps(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: AmbientValues,
  progress: number,
  timeMs: number,
  motion: number,
): void {
  const n = lampCount(progress);

  // Emissive things are HOLES in the hatching, drawn after it. If everything
  // glowed, nothing would. Addendum §C.2.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const { x, y, r } = lampAt(i, w, h);
    const pulse = 1 + Math.sin(timeMs / 900 + i) * 0.06 * motion;
    const rad = r * pulse;

    const halo = g.createRadialGradient(x, y, 0, x, y, rad * 9);
    halo.addColorStop(0, v.glow);
    halo.addColorStop(1, 'transparent');
    g.globalAlpha = 0.42;
    g.fillStyle = halo;
    g.beginPath();
    g.arc(x, y, rad * 9, 0, Math.PI * 2);
    g.fill();

    g.globalAlpha = 1;
    g.fillStyle = v.glow;
    g.beginPath();
    g.arc(x, y, rad, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();

  // The near lantern never goes out, at any state. Addendum §D.1.
  const lx = w * 0.08;
  const ly = h * 0.74;
  const halo = g.createRadialGradient(lx, ly, 0, lx, ly, 90);
  halo.addColorStop(0, v.glow);
  halo.addColorStop(1, 'transparent');
  g.save();
  g.globalCompositeOperation = 'lighter';
  g.globalAlpha = 0.55;
  g.fillStyle = halo;
  g.beginPath();
  g.arc(lx, ly, 90, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;
  g.fillStyle = v.glow;
  g.fillRect(lx - 3, ly - 6, 6, 12);
  g.restore();

  // Moon: rises with the night, cools and fades at dawn.
  const my = h * (0.42 - progress * 0.24);
  const mr = 16;
  g.save();
  g.globalAlpha = 0.28 + v.lum * 0.2;
  g.fillStyle = v.glow;
  g.beginPath();
  g.arc(w * 0.78, my, mr, 0, Math.PI * 2);
  g.fill();
  g.restore();
}
```

- [ ] **Step 5: Implement `src/world/fog.ts`**

```ts
import type { AmbientValues } from '../ambient/types';

const BANDS = [
  { speed: 0.018, y: 0.58, height: 0.30, alpha: 0.30 },
  { speed: -0.011, y: 0.68, height: 0.34, alpha: 0.24 },
  { speed: 0.006, y: 0.80, height: 0.28, alpha: 0.20 },
];

/**
 * Adjacent bands drift at different speeds and opposite signs, so the fog never
 * reads as one sliding sheet. Motion 0 freezes it dead — this is the wide-area
 * movement that actually causes vestibular trouble. DNA §8.1.
 */
export function fogOffset(timeMs: number, band: number, motion: number): number {
  const b = BANDS[band % BANDS.length]!;
  return timeMs * b.speed * motion;
}

export function drawFog(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: AmbientValues,
  timeMs: number,
  motion: number,
): void {
  // Thicker fog as the world darkens.
  const thickness = 1 - v.lum;

  BANDS.forEach((b, i) => {
    const off = fogOffset(timeMs, i, motion) % (w * 2);
    const grad = g.createLinearGradient(0, h * b.y, 0, h * (b.y + b.height));
    grad.addColorStop(0, 'transparent');
    grad.addColorStop(0.5, v.accent);
    grad.addColorStop(1, 'transparent');

    g.save();
    g.globalAlpha = b.alpha * thickness;
    g.fillStyle = grad;
    g.translate(off % w, 0);
    g.fillRect(-w, h * b.y, w * 3, h * b.height);
    g.restore();
  });
}
```

- [ ] **Step 6: Implement `src/world/layers.ts`**

```ts
import type { AmbientValues } from '../ambient/types';
import { HATCH_ANGLES, hatch } from './hatch';

/** Deterministic pseudo-random so the skyline is identical between redraws. */
function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/**
 * Four depth layers, one hatch angle each (addendum §C.2). The sky is the only
 * part that is NOT hatched — it is the blank paper everything else is cut into.
 */
export function drawStatic(
  g: CanvasRenderingContext2D,
  w: number,
  h: number,
  v: AmbientValues,
  progress: number,
): void {
  // 1. Sky — three stops, never two (DNA §3.3).
  const sky = g.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, v.sky[0]);
  sky.addColorStop(0.55, v.sky[1]);
  sky.addColorStop(1, v.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, h);

  const ink = v.deep;

  // 2. Far city — spires and chimneys, loose hatching, first to vanish in fog.
  const farTop = h * 0.55;
  for (let i = 0; i < 26; i++) {
    const bw = w / 26;
    const bh = 30 + rand(i) * 90;
    const x = i * bw;
    g.fillStyle = v.sky[1];
    g.fillRect(x, farTop - bh, bw + 1, bh + 1);
    hatch(g, x, farTop - bh, bw + 1, bh + 1, 0.30 + rand(i + 7) * 0.15, {
      angle: HATCH_ANGLES.far, color: ink, maxGap: 13,
    });
  }
  g.fillStyle = v.sky[1];
  g.fillRect(0, farTop, w, h - farTop);

  // 3. Mid roofs — the layer the windows are cut out of.
  const midTop = h * 0.66;
  for (let i = 0; i < 14; i++) {
    const bw = w / 14;
    const bh = 40 + rand(i + 31) * 70;
    const x = i * bw;
    hatch(g, x, midTop - bh, bw + 1, bh + 1 + (h - midTop), 0.48 + rand(i + 11) * 0.12, {
      angle: HATCH_ANGLES.mid, color: ink, maxGap: 11,
    });
    // chimney
    const cx = x + bw * (0.2 + rand(i + 3) * 0.6);
    hatch(g, cx, midTop - bh - 22, 9, 24, 0.6, { angle: HATCH_ANGLES.mid, color: ink });
  }

  // 4. Near — railing and the lamp post, densest, into cross-hatch territory.
  const nearTop = h * 0.86;
  hatch(g, 0, nearTop, w, h - nearTop, 0.72 + progress * 0.1, {
    angle: HATCH_ANGLES.near, color: ink, maxGap: 9,
  });
  for (let x = 0; x < w; x += 26) {
    hatch(g, x, nearTop - 34, 4, 36, 0.8, { angle: HATCH_ANGLES.near, color: ink, maxGap: 7 });
  }
}
```

- [ ] **Step 7: Implement `src/world/renderer.ts`**

```ts
import type { AmbientValues } from '../ambient/types';
import { drawFog } from './fog';
import { drawLamps } from './bloom';
import { drawStatic } from './layers';

/** Largest single-channel difference between two hex colours. */
export function channelDrift(a: string, b: string): number {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.max(
    Math.abs(ar! - br!), Math.abs(ag! - bg!), Math.abs(ab! - bb!),
  );
}

/** Addendum §B.3 — redraw the static plate only when it would visibly change. */
const REDRAW_THRESHOLD = 6;

export function createWorldRenderer() {
  let cache: HTMLCanvasElement | null = null;
  let cachedMid = '';
  let cachedW = 0;
  let cachedH = 0;

  function invalidate(): void {
    cache = null;
  }

  function frame(
    target: CanvasRenderingContext2D,
    w: number,
    h: number,
    v: AmbientValues,
    progress: number,
    timeMs: number,
    motion: number,
  ): void {
    const stale =
      cache === null ||
      cachedW !== w ||
      cachedH !== h ||
      channelDrift(cachedMid, v.mid) > REDRAW_THRESHOLD;

    if (stale) {
      const cv = cache ?? document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      if (g) {
        g.clearRect(0, 0, w, h);
        drawStatic(g, w, h, v, progress);
      }
      cache = cv;
      cachedMid = v.mid;
      cachedW = w;
      cachedH = h;
    }

    target.clearRect(0, 0, w, h);
    if (cache) target.drawImage(cache, 0, 0);
    drawFog(target, w, h, v, timeMs, motion);
    drawLamps(target, w, h, v, progress, timeMs, motion);
  }

  return { frame, invalidate };
}
```

- [ ] **Step 8: Implement `src/world/Canvas.tsx`**

```tsx
import { useEffect, useRef } from 'react';
import type { AmbientValues } from '../ambient/types';
import { createWorldRenderer } from './renderer';

type Props = {
  values: AmbientValues;
  progress: number;
  motion: number;
};

export function World({ values, progress, motion }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read through a ref so the rAF loop is started exactly once.
  const latest = useRef({ values, progress, motion });
  latest.current = { values, progress, motion };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;

    const renderer = createWorldRenderer();
    let raf = 0;
    let w = 0;
    let h = 0;

    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.ceil(window.innerWidth);
      h = Math.ceil(window.innerHeight);
      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      renderer.invalidate();
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };

    const loop = (t: number) => {
      const s = latest.current;
      renderer.frame(g, w, h, s.values, s.progress, t, s.motion);
      raf = requestAnimationFrame(loop);
    };

    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return <canvas ref={ref} className="world" aria-hidden="true" />;
}
```

`aria-hidden` is correct here and not a shortcut: the world carries no information a screen reader could use, and every fact it depicts is also stated in the chrome.

- [ ] **Step 9: Mount it — replace the body of `src/App.tsx`**

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { World } from './world/Canvas';
import { makeGrainUri } from './world/grain';
import { startAmbientDriver } from './ambient/driver';
import { resolve } from './ambient/interpolate';
import { NIGHT_KEYS } from './ambient/keyframes';
import { gradesFor } from './ambient/grade';
import type { AmbientValues } from './ambient/types';

export function App() {
  // Temporary harness: a slider stands in for session progress until Task 10.
  const [progress, setProgress] = useState(0);
  const progressRef = useRef(progress);
  progressRef.current = progress;

  const [values, setValues] = useState<AmbientValues>(() =>
    resolve(NIGHT_KEYS, 0, gradesFor(['calm'])),
  );

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-uri', makeGrainUri());
  }, []);

  useEffect(() =>
    startAmbientDriver({
      read: () => ({ progress: progressRef.current, grades: ['calm'] }),
      onValues: setValues,
    }),
  []);

  const motion = useMemo(
    () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1),
    [],
  );

  return (
    <>
      <World values={values} progress={progress} motion={motion} />
      <div className="app">
        <section className="panel" style={{ ['--i' as string]: 0 }}>
          <header className="panel__head">
            <span className="panel__spark" />
            <h2 className="panel__title">The Watch</h2>
          </header>
          <div className="panel__body">
            <input
              type="range" min={0} max={1} step={0.01} value={progress}
              onChange={(e) => setProgress(Number(e.target.value))}
              aria-label="night progress"
            />
            <p className="label">progress {progress.toFixed(2)}</p>
          </div>
        </section>
      </div>
      <div className="grain" />
      <div className="scanlines" />
      <div className="vignette" />
    </>
  );
}
```

- [ ] **Step 10: Run the tests and check it by eye**

Run: `npx vitest run tests/world`
Expected: PASS.

Run: `npm run dev`, then drag the slider from 0 to 1. Expected:
- The whole scene shifts dusk → night → fog → witching hour → dawn, and the panel, its border and its text shift with it — not just the background.
- Lamps light up through the middle and fade toward dawn; the near lantern never goes out.
- Zoom to 400%: hatch lines stay smooth, panel corners stay square. That contrast is the hybrid contract working.

- [ ] **Step 11: Commit**

```bash
git add src tests
git commit -m "feat: engraved world layer with cached plate, fog and bloom"
```

---

### Task 9: Chrome components

**Files:**
- Create: `src/components/Panel.tsx`, `src/components/Button.tsx`, `src/components/Meter.tsx`, `src/components/Digit.tsx`, `src/components/Ico.tsx`
- Modify: `src/style/components.css` (append the button, meter, well and digit rules)
- Test: `tests/components/digit.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `splitDigits(text: string): string[]`
  - `<Panel title={string} index={number} float?={boolean} spark?={boolean} tools?={ReactNode}>{children}</Panel>`
  - `<Button onClick={() => void} pressed?={boolean} disabled?={boolean}>{children}</Button>`
  - `<Meter value={number} label?={string} />` — `value` is 0..1
  - `<Digits text={string} />`
  - `<Ico name={'lamp' | 'motion' | 'clock'} />`

- [ ] **Step 1: Append to `src/style/components.css`**

```css
/* ── Control surface (DNA §5.3, tier 2) ─────────────────────────────────── */
.btn {
  font-family: var(--font-ui);
  font-size: var(--fs-micro);
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--amb-ink);
  background: color-mix(in oklab, var(--amb-mid) 46%, transparent);
  backdrop-filter: blur(var(--px2));
  border: 0;
  padding: var(--px2) var(--px3);
  cursor: pointer;
  transition: transform var(--dur-fast) var(--ease-snap),
              box-shadow var(--dur-fast) var(--ease-snap),
              background var(--dur) linear,
              color var(--dur) linear;
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--glass-edge),
    0 var(--px)            0 0 var(--glass-edge),
    calc(-1 * var(--px)) 0 0 0 var(--glass-edge),
    var(--px)            0 0 0 var(--glass-edge),
    inset 0 var(--px)            0 0 var(--glass-hi),
    inset 0 calc(-1 * var(--px)) 0 0 var(--glass-lo);
}
@media (hover: hover) {
  .btn:hover {
    transform: translate3d(0, calc(-3px * var(--motion)), 0);
    box-shadow:
      0 calc(-1 * var(--px)) 0 0 var(--amb-lift),
      0 var(--px)            0 0 var(--amb-lift),
      calc(-1 * var(--px)) 0 0 0 var(--amb-lift),
      var(--px)            0 0 0 var(--amb-lift),
      inset 0 var(--px)            0 0 var(--glass-hi),
      inset 0 calc(-1 * var(--px)) 0 0 var(--glass-lo),
      var(--halo);
  }
}
.btn:active {
  transform: translateY(1px);
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--glass-edge),
    0 var(--px)            0 0 var(--glass-edge),
    calc(-1 * var(--px)) 0 0 0 var(--glass-edge),
    var(--px)            0 0 0 var(--glass-edge),
    inset 0 2px 0 0 var(--glass-lo);
}
.btn:disabled { opacity: .38; cursor: not-allowed; pointer-events: none; }
.btn[aria-pressed='true'] {
  color: #10121f;
  background: var(--amb-glow);
  box-shadow:
    0 calc(-1 * var(--px)) 0 0 var(--amb-glow),
    0 var(--px)            0 0 var(--amb-glow),
    calc(-1 * var(--px)) 0 0 0 var(--amb-glow),
    var(--px)            0 0 0 var(--amb-glow),
    inset 0 2px 0 0 rgb(255 255 255 / .45),
    var(--halo);
}

/* ── Well (DNA §5.3, tier 3) — bevel inverted so it reads sunken ─────────── */
.well {
  background: color-mix(in oklab, #000 42%, transparent);
  box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--amb-mid) 70%, transparent);
}

/* ── Meter ──────────────────────────────────────────────────────────────── */
.meter {
  position: relative; height: var(--px3); overflow: hidden;
  background: color-mix(in oklab, #000 42%, transparent);
  box-shadow: inset 0 0 0 2px color-mix(in oklab, var(--amb-mid) 70%, transparent);
}
.meter__fill {
  position: relative; height: 100%;
  background: linear-gradient(90deg, var(--amb-accent),
              color-mix(in oklab, var(--amb-glow) 80%, #fff));
  box-shadow: 0 0 var(--px3) color-mix(in oklab, var(--amb-glow) 60%, transparent);
  transition: width var(--dur-slow) var(--ease-spring);
}
.meter__fill::after {
  content: ''; position: absolute; inset: 0;
  background: repeating-linear-gradient(115deg,
    transparent 0 6px, rgb(255 255 255 / .16) 6px 12px);
  animation: meterSlide calc(1.4s / max(var(--motion), 0.0001)) linear infinite;
}
@keyframes meterSlide { to { transform: translateX(12px); } }

/* ── Hero digits ────────────────────────────────────────────────────────── */
.digits {
  font-family: var(--font-display);
  font-size: clamp(28px, 5.2vw, 54px);
  letter-spacing: 0.02em;
  color: var(--amb-ink);
  text-shadow:
    0 var(--px) 0 rgb(0 0 0 / .45),
    0 0 var(--px5) color-mix(in oklab, var(--amb-glow) 55%, transparent);
}
.digit {
  display: inline-block; min-width: 0.62em; text-align: center;
  font-variant-numeric: tabular-nums;
}
.digit--flip { animation: digitFlip var(--dur) var(--ease-out); }
@keyframes digitFlip {
  0%   { transform: translateY(calc(-0.16em * var(--motion))) scale(1.08);
         opacity: .25; filter: blur(calc(2px * var(--motion))); }
  100% { transform: none; opacity: 1; filter: none; }
}

/* ── Icons (DNA §10.1) — 12x12 grid, 45° corners only ───────────────────── */
.ico { width: 12px; height: 12px; flex: none; background: currentColor; display: inline-block; }
.ico[data-ico='lamp']   { clip-path: polygon(42% 0,58% 0,75% 33%,75% 58%,25% 58%,25% 33%); }
.ico[data-ico='motion'] { clip-path: polygon(8% 42%,33% 42%,33% 17%,92% 50%,33% 83%,33% 58%,8% 58%); }
.ico[data-ico='clock']  { clip-path: polygon(42% 8%,58% 8%,58% 46%,84% 46%,84% 62%,42% 62%); }

/* ── Content grid (DNA §6.3) ────────────────────────────────────────────── */
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(min(260px, 100%), 1fr));
  gap: clamp(var(--px3), 1.4vw, var(--px5));
  align-content: start;
}
@media (min-width: 900px) {
  .grid { grid-template-columns: repeat(4, 1fr); }
  .span-2 { grid-column: span 2; }
  .row-2  { grid-row: span 2; }
}
```

- [ ] **Step 2: Write the failing digit test**

`tests/components/digit.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { splitDigits } from '../../src/components/Digit';

describe('splitDigits', () => {
  it('splits a clock into individually addressable characters', () => {
    expect(splitDigits('02:41')).toEqual(['0', '2', ':', '4', '1']);
  });

  it('handles an empty string', () => {
    expect(splitDigits('')).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `npx vitest run tests/components/digit.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/components/Digit"`.

- [ ] **Step 4: Implement `src/components/Digit.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react';

export function splitDigits(text: string): string[] {
  return text.split('');
}

/**
 * A clock TICKS, it does not blink: only the characters that actually changed
 * are animated. DNA §8.6.
 */
export function Digits({ text }: { text: string }) {
  const chars = splitDigits(text);
  const prev = useRef<string[]>(chars);
  const [flipping, setFlipping] = useState<boolean[]>(() => chars.map(() => false));

  useEffect(() => {
    const changed = chars.map((c, i) => c !== prev.current[i]);
    prev.current = chars;
    if (changed.some(Boolean)) {
      setFlipping(changed);
      const id = window.setTimeout(() => setFlipping(chars.map(() => false)), 260);
      return () => window.clearTimeout(id);
    }
    return undefined;
  }, [text]);

  return (
    <span className="digits">
      {chars.map((c, i) => (
        <span
          key={i}
          className={flipping[i] ? 'digit digit--flip' : 'digit'}
        >
          {c}
        </span>
      ))}
    </span>
  );
}
```

- [ ] **Step 5: Implement the remaining components**

`src/components/Panel.tsx`:

```tsx
import type { ReactNode } from 'react';

type Props = {
  title: string;
  index: number;
  /** Cards holding fine controls must NOT float — DNA §8.5. */
  float?: boolean;
  spark?: boolean;
  tools?: ReactNode;
  className?: string;
  children: ReactNode;
};

export function Panel({ title, index, float = false, spark = true, tools, className = '', children }: Props) {
  // Periods spread over co-prime cycles and negative phase offsets, so no two
  // cards ever float in step. DNA §8.5.
  const style = {
    ['--i' as string]: index,
    ['--float-dur' as string]: `${6.2 + (index % 5) * 0.9}s`,
    ['--float-delay' as string]: `${(index % 7) * -0.73}s`,
  };

  return (
    <section className={`panel ${float ? 'panel--float' : ''} ${className}`} style={style}>
      <header className="panel__head">
        {spark && <span className="panel__spark" />}
        <h2 className="panel__title">{title}</h2>
        {tools && <div className="panel__tools">{tools}</div>}
      </header>
      <div className="panel__body">{children}</div>
    </section>
  );
}
```

`src/components/Button.tsx`:

```tsx
import type { ReactNode } from 'react';

export function Button({
  onClick, children, pressed, disabled,
}: {
  onClick: () => void;
  children: ReactNode;
  pressed?: boolean;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn"
      onClick={onClick}
      disabled={disabled}
      {...(pressed === undefined ? {} : { 'aria-pressed': pressed })}
    >
      {children}
    </button>
  );
}
```

`src/components/Meter.tsx`:

```tsx
export function Meter({ value, label }: { value: number; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div
      className="meter"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={pct}
      {...(label ? { 'aria-label': label } : {})}
    >
      <div className="meter__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}
```

`src/components/Ico.tsx`:

```tsx
export function Ico({ name }: { name: 'lamp' | 'motion' | 'clock' }) {
  return <i className="ico" data-ico={name} aria-hidden="true" />;
}
```

- [ ] **Step 6: Run the test and the typecheck**

Run: `npx vitest run tests/components/digit.test.ts`
Expected: PASS, 2 tests.

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 7: Commit**

```bash
git add src/components src/style tests/components
git commit -m "feat: chrome components — panel, button, meter, digits, icons"
```

---

### Task 10: Copy table, app state, and the three panels

**Files:**
- Create: `src/app/copy.ts`, `src/app/useNightWatch.ts`
- Create: `src/panels/TheWatch.tsx`, `src/panels/TheQuarry.tsx`, `src/panels/TheLedger.tsx`
- Modify: `src/App.tsx` (replace the Task 8 harness with the real layout)
- Test: `tests/app/copy.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 2–9.
- Produces:
  - `ambientLine(input: { phase: Phase; progress: number; hasQuarry: boolean; bloodmoon: boolean }): string`
  - `COPY` — the fixed strings for empty and error states
  - `formatClock(ms: number): string`
  - `useNightWatch()` — returns `{ state, values, progress, motion, grades, data, remainingMs, streak, ledger, actions }`

- [ ] **Step 1: Write the failing copy test**

`tests/app/copy.test.ts`:

```ts
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
  const all = [
    ...Object.values(COPY),
    ...[0.1, 0.5, 0.7, 0.95].map((progress) =>
      ambientLine({ phase: 'hunt', progress, hasQuarry: true, bloodmoon: false })),
    ambientLine({ phase: 'idle', progress: 0, hasQuarry: false, bloodmoon: false }),
    ambientLine({ phase: 'respite', progress: 1, hasQuarry: true, bloodmoon: false }),
  ];

  it('contains no exclamation mark', () => {
    for (const line of all) expect(line).not.toContain('!');
  });

  it('keeps ambient sentences lowercase', () => {
    const ambient = all.filter((l) => !Object.values(COPY.labels).includes(l));
    for (const line of ambient) expect(line).toBe(line.toLowerCase());
  });

  it('keeps control labels uppercase and unpoeticised', () => {
    expect(Object.values(COPY.labels)).toEqual(['MULAI', 'HENTI', 'LEWATI', 'TAMBAH']);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/app/copy.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/app/copy"`.

- [ ] **Step 3: Implement `src/app/copy.ts`**

```ts
import type { Phase } from '../session/machine';

/**
 * Spec §7. Every state has a hand-written sentence; none are defaults.
 * The voice is a night watchman: it observes, it never encourages.
 */
export const COPY = {
  idleWithQuarry: 'the lamps are unlit.',
  idleNoQuarry: 'no quarry named. the street is quiet.',
  dusk: 'the lamps are lit.',
  fog: 'the fog comes up off the river.',
  deep: 'nothing moves but the fog.',
  late: 'the hour holds.',
  done: 'dawn. the watch is kept.',
  respite: 'the watch rests. the fog does not.',
  bloodmoon: 'the moon has turned.',
  quarryEmpty: 'no quarry named.',
  ledgerEmpty: 'the ledger is blank. nothing kept yet.',
  storeRecovered: 'the ledger was water-damaged. starting a clean page.',
  labels: {
    start: 'MULAI',
    stop: 'HENTI',
    skip: 'LEWATI',
    add: 'TAMBAH',
  },
} as const;

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ambientLine(input: {
  phase: Phase;
  progress: number;
  hasQuarry: boolean;
  bloodmoon: boolean;
}): string {
  if (input.phase === 'idle') {
    return input.hasQuarry ? COPY.idleWithQuarry : COPY.idleNoQuarry;
  }
  if (input.phase === 'respite') return COPY.respite;
  if (input.bloodmoon) return COPY.bloodmoon;
  if (input.progress >= 1) return COPY.done;
  if (input.progress >= 0.85) return COPY.late;
  if (input.progress >= 0.62) return COPY.deep;
  if (input.progress >= 0.35) return COPY.fog;
  return COPY.dusk;
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `npx vitest run tests/app/copy.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Implement `src/app/useNightWatch.ts`**

```ts
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { startAmbientDriver } from '../ambient/driver';
import { gradesFor } from '../ambient/grade';
import { resolve } from '../ambient/interpolate';
import { NIGHT_KEYS } from '../ambient/keyframes';
import type { AmbientValues, GradeName } from '../ambient/types';
import { initialState, progressOf, reduce, type SessionState } from '../session/machine';
import { minutesByNight } from '../session/aggregate';
import { streakLength } from '../session/streak';
import { load, save } from '../store/persist';
import type { Schema } from '../store/schema';

const BLOODMOON_STREAK = 5;
const PRESSED_MS = 5 * 60_000;

export function useNightWatch() {
  const boot = useMemo(() => load(), []);
  const [data, setData] = useState<Schema>(boot.data);
  const [session, setSession] = useState<SessionState>(() =>
    initialState(boot.data.settings.huntMinutes, boot.data.settings.respiteMinutes),
  );
  const [now, setNow] = useState(() => Date.now());
  const [values, setValues] = useState<AmbientValues>(() =>
    resolve(NIGHT_KEYS, 0, gradesFor(['calm'])),
  );

  const streak = useMemo(() => streakLength(data.sessions, now), [data.sessions, now]);
  const ledger = useMemo(() => minutesByNight(data.sessions, now, 7), [data.sessions, now]);

  const progress = progressOf(session, now);
  const remainingMs = session.phase === 'idle'
    ? session.huntMs
    : Math.max(0, session.huntMs - (now - (session.startedAt ?? now)));

  const grades = useMemo<GradeName[]>(() => {
    const g: GradeName[] = [];
    if (session.phase === 'hunt' && remainingMs <= PRESSED_MS) g.push('pressed');
    if (streak >= BLOODMOON_STREAK) g.push('bloodmoon');
    return g.length === 0 ? ['calm'] : g;
  }, [session.phase, remainingMs, streak]);

  // The rAF-free heartbeat: one tick a second is enough for a clock, and the
  // machine reads wall-clock time anyway.
  const sessionRef = useRef(session);
  sessionRef.current = session;
  useEffect(() => {
    const id = window.setInterval(() => {
      const at = Date.now();
      setNow(at);
      const { state, completed } = reduce(sessionRef.current, { type: 'tick', at });
      if (state !== sessionRef.current) setSession(state);
      if (completed) {
        setData((d) => {
          const next: Schema = {
            ...d,
            sessions: [...d.sessions, completed],
            quarry: d.quarry.map((q) =>
              q.id === completed.quarryId ? { ...q, minutes: q.minutes + completed.minutes } : q,
            ),
          };
          save(next, at);
          return next;
        });
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  const gradesRef = useRef(grades);
  gradesRef.current = grades;
  const progressRef = useRef(progress);
  progressRef.current = progress;

  useEffect(() =>
    startAmbientDriver({
      read: () => ({ progress: progressRef.current, grades: gradesRef.current }),
      onValues: setValues,
    }),
  []);

  const motion = data.settings.motion === 'off' ? 0
    : data.settings.motion === 'on' ? 1
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;

  useEffect(() => {
    document.documentElement.dataset.motion = data.settings.motion;
  }, [data.settings.motion]);

  const dispatch = useCallback((ev: Parameters<typeof reduce>[1]) => {
    setSession((s) => {
      const { state, completed } = reduce(s, ev);
      if (completed) {
        setData((d) => {
          const next: Schema = { ...d, sessions: [...d.sessions, completed] };
          save(next);
          return next;
        });
      }
      return state;
    });
  }, []);

  const actions = useMemo(() => ({
    start: () => dispatch({ type: 'start', at: Date.now() }),
    stop: () => dispatch({ type: 'stop', at: Date.now() }),
    skip: () => dispatch({ type: 'skip', at: Date.now() }),
    selectQuarry: (quarryId: string | null) => dispatch({ type: 'selectQuarry', quarryId }),
    addQuarry: (name: string) => setData((d) => {
      const trimmed = name.trim();
      if (trimmed === '') return d;
      const next: Schema = {
        ...d,
        quarry: [...d.quarry, {
          id: `q${Date.now()}`, name: trimmed, minutes: 0, done: false, createdAt: Date.now(),
        }],
      };
      save(next);
      return next;
    }),
    toggleQuarryDone: (id: string) => setData((d) => {
      const next: Schema = {
        ...d,
        quarry: d.quarry.map((q) => (q.id === id ? { ...q, done: !q.done } : q)),
      };
      save(next);
      return next;
    }),
    cycleMotion: () => setData((d) => {
      const order = ['auto', 'on', 'off'] as const;
      const i = order.indexOf(d.settings.motion);
      const next: Schema = {
        ...d,
        settings: { ...d.settings, motion: order[(i + 1) % order.length]! },
      };
      save(next);
      return next;
    }),
  }), [dispatch]);

  return {
    session, values, progress, motion, grades, data, remainingMs, streak, ledger,
    recovered: boot.recovered, actions,
  };
}
```

- [ ] **Step 6: Implement the three panels**

`src/panels/TheWatch.tsx`:

```tsx
import { Button } from '../components/Button';
import { Digits } from '../components/Digit';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { COPY, ambientLine, formatClock } from '../app/copy';
import type { Phase } from '../session/machine';

export function TheWatch({
  phase, progress, remainingMs, quarryName, bloodmoon, onStart, onStop, onSkip,
}: {
  phase: Phase;
  progress: number;
  remainingMs: number;
  quarryName: string | null;
  bloodmoon: boolean;
  onStart: () => void;
  onStop: () => void;
  onSkip: () => void;
}) {
  const line = ambientLine({ phase, progress, hasQuarry: quarryName !== null, bloodmoon });

  return (
    <Panel title="The Watch" index={0} float className="span-2 row-2">
      {quarryName && <p className="label">{quarryName}</p>}
      <Digits text={formatClock(remainingMs)} />
      <p className="label">{line}</p>
      <Meter value={progress} label="night progress" />
      <div style={{ display: 'flex', gap: 'var(--px2)', marginTop: 'var(--px3)' }}>
        {phase === 'idle'
          ? <Button onClick={onStart}>{COPY.labels.start}</Button>
          : <Button onClick={onStop}>{COPY.labels.stop}</Button>}
        <Button onClick={onSkip} disabled={phase === 'idle'}>{COPY.labels.skip}</Button>
      </div>
    </Panel>
  );
}
```

`src/panels/TheQuarry.tsx`:

```tsx
import { useState } from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';
import type { Quarry } from '../store/schema';

export function TheQuarry({
  quarry, selectedId, onAdd, onSelect, onToggleDone,
}: {
  quarry: readonly Quarry[];
  selectedId: string | null;
  onAdd: (name: string) => void;
  onSelect: (id: string | null) => void;
  onToggleDone: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');

  // NOT floating: you cannot hit a moving target. DNA §8.5.
  return (
    <Panel title="The Quarry" index={1}>
      <form
        onSubmit={(e) => { e.preventDefault(); onAdd(draft); setDraft(''); }}
        style={{ display: 'flex', gap: 'var(--px2)' }}
      >
        <input
          className="well"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="nama buruan"
          style={{
            flex: 1, border: 0, color: 'var(--amb-ink)', padding: 'var(--px2)',
            fontFamily: 'var(--font-body)', fontSize: 'var(--fs-small)',
          }}
        />
        <Button onClick={() => { onAdd(draft); setDraft(''); }}>{COPY.labels.add}</Button>
      </form>

      <hr className="divider" />

      {quarry.length === 0
        ? <p className="label">{COPY.quarryEmpty}</p>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {quarry.map((q) => (
              <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--px2)', padding: 'var(--px) 0' }}>
                <Button
                  onClick={() => onSelect(selectedId === q.id ? null : q.id)}
                  pressed={selectedId === q.id}
                >
                  {q.name}
                </Button>
                <span className="label" style={{ marginLeft: 'auto' }}>{q.minutes}m</span>
                <input
                  type="checkbox"
                  checked={q.done}
                  onChange={() => onToggleDone(q.id)}
                  aria-label={`selesai: ${q.name}`}
                />
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}
```

`src/panels/TheLedger.tsx`:

```tsx
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';

export function TheLedger({
  rows, streak,
}: {
  rows: readonly { key: string; minutes: number }[];
  streak: number;
}) {
  const peak = Math.max(60, ...rows.map((r) => r.minutes));
  const total = rows.reduce((sum, r) => sum + r.minutes, 0);
  const empty = total === 0;

  return (
    <Panel title="The Ledger" index={2} float>
      {empty
        ? <p className="label">{COPY.ledgerEmpty}</p>
        : (
          <>
            {rows.map((r, i) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--px2)', padding: 'var(--px) 0' }}>
                <span className="label" style={{ width: '5.5em' }}>{r.key.slice(5)}</span>
                <div style={{ flex: 1 }}>
                  <Meter value={r.minutes / peak} label={`${r.key}: ${r.minutes} menit`} />
                </div>
                {i === rows.length - 1 && <span className="panel__spark" />}
              </div>
            ))}
            <hr className="divider" />
            <p className="label">streak {streak} malam · {total}m minggu ini</p>
          </>
        )}
    </Panel>
  );
}
```

- [ ] **Step 7: Replace `src/App.tsx` with the real layout**

```tsx
import { World } from './world/Canvas';
import { makeGrainUri } from './world/grain';
import { useEffect } from 'react';
import { useNightWatch } from './app/useNightWatch';
import { TheWatch } from './panels/TheWatch';
import { TheQuarry } from './panels/TheQuarry';
import { TheLedger } from './panels/TheLedger';
import { COPY } from './app/copy';

export function App() {
  const nw = useNightWatch();

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-uri', makeGrainUri());
  }, []);

  const selected = nw.data.quarry.find((q) => q.id === nw.session.quarryId) ?? null;

  return (
    <>
      <World values={nw.values} progress={nw.progress} motion={nw.motion} />
      <main className="app">
        {nw.recovered && <p className="label">{COPY.storeRecovered}</p>}
        <div className="grid">
          <TheWatch
            phase={nw.session.phase}
            progress={nw.progress}
            remainingMs={nw.remainingMs}
            quarryName={selected?.name ?? null}
            bloodmoon={nw.grades.includes('bloodmoon')}
            onStart={nw.actions.start}
            onStop={nw.actions.stop}
            onSkip={nw.actions.skip}
          />
          <TheQuarry
            quarry={nw.data.quarry}
            selectedId={nw.session.quarryId}
            onAdd={nw.actions.addQuarry}
            onSelect={nw.actions.selectQuarry}
            onToggleDone={nw.actions.toggleQuarryDone}
          />
          <TheLedger rows={nw.ledger} streak={nw.streak} />
        </div>
      </main>
      <div className="grain" />
      <div className="scanlines" />
      <div className="vignette" />
    </>
  );
}
```

- [ ] **Step 8: Run everything**

Run: `npm test`
Expected: all suites PASS.

Run: `npm run build`
Expected: clean.

Run: `npm run dev`. Expected: three panels over the engraved city. Add a quarry, select it, press `MULAI` — the clock counts down, the meter fills, and the whole scene darkens as the session runs.

- [ ] **Step 9: Commit**

```bash
git add src tests
git commit -m "feat: watch, quarry and ledger panels wired to session state"
```

---

### Task 11: The motion brake, and the acceptance pass

**Files:**
- Create: `src/app/motion.ts`, `README.md`
- Modify: `src/app/useNightWatch.ts` (import `nextMotion`, `motionValue`)
- Modify: `src/panels/TheWatch.tsx` (add the toggle to `tools`)
- Test: `tests/app/motion.test.ts`

**Interfaces:**
- Consumes: `Settings['motion']` from `src/store/schema.ts`.
- Produces:
  - `nextMotion(current: Settings['motion']): Settings['motion']`
  - `motionValue(setting: Settings['motion'], prefersReduced: boolean): 0 | 1`
  - `motionLabel(setting: Settings['motion']): string`

- [ ] **Step 1: Write the failing test**

`tests/app/motion.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { motionLabel, motionValue, nextMotion } from '../../src/app/motion';

describe('nextMotion', () => {
  it('cycles auto -> on -> off -> auto', () => {
    expect(nextMotion('auto')).toBe('on');
    expect(nextMotion('on')).toBe('off');
    expect(nextMotion('off')).toBe('auto');
  });
});

describe('motionValue', () => {
  it('follows the OS preference on auto', () => {
    expect(motionValue('auto', true)).toBe(0);
    expect(motionValue('auto', false)).toBe(1);
  });

  it('overrides the OS preference in BOTH directions', () => {
    // A bare media query cannot be cancelled by the user. DNA §4.
    expect(motionValue('on', true)).toBe(1);
    expect(motionValue('off', false)).toBe(0);
  });
});

describe('motionLabel', () => {
  it('has a distinct uppercase label per setting', () => {
    const labels = (['auto', 'on', 'off'] as const).map(motionLabel);
    expect(new Set(labels).size).toBe(3);
    for (const l of labels) expect(l).toBe(l.toUpperCase());
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run tests/app/motion.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/app/motion"`.

- [ ] **Step 3: Implement `src/app/motion.ts`**

```ts
import type { Settings } from '../store/schema';

type Motion = Settings['motion'];

const ORDER: readonly Motion[] = ['auto', 'on', 'off'];

export function nextMotion(current: Motion): Motion {
  const i = ORDER.indexOf(current);
  return ORDER[(i + 1) % ORDER.length]!;
}

/**
 * The OS preference is the DEFAULT, not a lock. A bare media query cannot be
 * cancelled by the user, so the setting must be able to win both ways. DNA §4.
 */
export function motionValue(setting: Motion, prefersReduced: boolean): 0 | 1 {
  if (setting === 'on') return 1;
  if (setting === 'off') return 0;
  return prefersReduced ? 0 : 1;
}

export function motionLabel(setting: Motion): string {
  return { auto: 'GERAK: AUTO', on: 'GERAK: HIDUP', off: 'GERAK: MATI' }[setting];
}
```

- [ ] **Step 4: Use it in `src/app/useNightWatch.ts`**

Replace the inline `motion` expression and the `cycleMotion` action body.

Add to the imports at the top:

```ts
import { motionValue, nextMotion } from './motion';
```

Replace:

```ts
  const motion = data.settings.motion === 'off' ? 0
    : data.settings.motion === 'on' ? 1
    : window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 1;
```

with:

```ts
  const motion = motionValue(
    data.settings.motion,
    window.matchMedia('(prefers-reduced-motion: reduce)').matches,
  );
```

Replace the `cycleMotion` body:

```ts
    cycleMotion: () => setData((d) => {
      const next: Schema = {
        ...d,
        settings: { ...d.settings, motion: nextMotion(d.settings.motion) },
      };
      save(next);
      return next;
    }),
```

- [ ] **Step 5: Surface the toggle in `src/panels/TheWatch.tsx`**

Add these imports:

```tsx
import { Ico } from '../components/Ico';
import { motionLabel } from '../app/motion';
import type { Settings } from '../store/schema';
```

Add two props to the component's prop type and destructuring:

```tsx
  motionSetting: Settings['motion'];
  onCycleMotion: () => void;
```

Pass them through `<Panel>`:

```tsx
    <Panel
      title="The Watch"
      index={0}
      float
      className="span-2 row-2"
      tools={
        <button type="button" className="btn" onClick={onCycleMotion} title={motionLabel(motionSetting)}>
          <Ico name="motion" />
        </button>
      }
    >
```

And in `src/App.tsx`, add to `<TheWatch … />`:

```tsx
            motionSetting={nw.data.settings.motion}
            onCycleMotion={nw.actions.cycleMotion}
```

- [ ] **Step 6: Run the tests**

Run: `npm test`
Expected: all suites PASS.

Run: `npm run build`
Expected: clean.

- [ ] **Step 7: Walk the acceptance checklist by hand**

Run `npm run dev` and confirm each line. Every failure is a bug in this task, not a note for later.

**Shape**
- [ ] Panel corners are notched (empty), not mitred, not rounded
- [ ] Every border is exactly `--px` or a multiple; no stray `1px`
- [ ] Bevel consistent: light on top, dark on the bottom, on every surface
- [ ] The quarry input reads as sunken — its bevel is inverted
- [ ] Browser zoom 200%: pixels stay square and sharp

**Colour**
- [ ] `grep -rn '#[0-9a-fA-F]\{3,6\}' src/components src/panels src/style/components.css` returns empty
- [ ] Drag a session from start to finish: panels, buttons, text, meters and borders all move with it — not just the background
- [ ] Text is legible at the brightest and the darkest state
- [ ] No fully saturated colour anywhere

**Type**
- [ ] Screenshot at 800%: no grey pixels on the bitmap faces
- [ ] Every small size comes from the discrete ladder, not `clamp()`
- [ ] The clock does not shift the layout around it as digits change
- [ ] Network tab shows no third-party domain

**Motion**
- [ ] With the toggle on `MATI`: **nothing translates**, and the fog on the canvas is frozen — but the palette still shifts and the spark still pulses
- [ ] Set the OS to reduced motion, then set the toggle to `HIDUP`: motion returns. The preference is a default, not a lock.
- [ ] Cards float out of step with one another
- [ ] The Quarry panel does not float
- [ ] Buttons sink when pressed
- [ ] Panels enter staggered, not together
- [ ] Colour transitions are `linear`, not eased

**Texture**
- [ ] No smooth gradient over a large area — the world is hatched
- [ ] Dividers are dashed, not solid
- [ ] Scanlines ≤ 0.04 opacity, paper grain ≤ 0.06
- [ ] Only narratively-lit things bloom

**Hybrid (addendum §G)**
- [ ] No text anywhere inside the canvas
- [ ] No hatching inside any DOM element
- [ ] Zoom 400%: hatch lines stay smooth while panel pixels stay square
- [ ] Panels stay legible when passing over the brightest part of the world
- [ ] Hatch angles are consistent per depth layer, not random per object
- [ ] Cross-hatching appears only in the darkest areas
- [ ] Lit things are not hatched
- [ ] Canvas lanterns and panel halos use the exact same `--amb-glow`
- [ ] At the darkest state, at least one full-brightness glow source remains
- [ ] DevTools performance profile: frame work ≤ 4 ms

**Voice**
- [ ] Every empty / error state has a hand-written sentence
- [ ] No exclamation marks
- [ ] Failure degrades through atmosphere, not a banner
- [ ] No control label is ambiguous for the sake of atmosphere

- [ ] **Step 8: Write `README.md`**

```markdown
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
```

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "feat: motion brake with two-way OS override, acceptance pass, readme"
```

---

## Self-Review

Run against `docs/superpowers/specs/2026-07-27-night-watch-design.md`.

**Spec coverage**

| Spec section | Task |
|---|---|
| §3 hybrid contract | Global Constraints, Task 8, Task 11 Step 7 |
| §4.1 ambient source, respite freeze, mid-session duration change | Task 3 (keyframes), Task 5 (`frozenProgress`, `setDurations`) |
| §4.2 five keyframes, uneven spacing, warm 0.62, cold 1.00 | Task 3 |
| §4.3 grade table, stacking, darkest-combination tuning | Task 2 (stacking), Task 3 (`GRADES`, darkest-state test) |
| §5.1 four depth layers, lit windows as holes, fog, chimney smoke | Task 8 |
| §5.2 static cache, redraw triggers, 4 ms budget | Task 8 (`createWorldRenderer`, `channelDrift`), Task 11 Step 7 |
| §5.3 reduced motion reaches the canvas | Task 11 |
| §6.1 The Watch | Task 10 |
| §6.2 The Quarry, non-floating | Task 10 |
| §6.3 The Ledger, 7 rows, streak, today's spark | Task 10 |
| §6.4 layout, `span-2 row-2`, stacking under 900px | Task 9 (grid CSS), Task 10 |
| §7 copy table | Task 10 (`copy.ts` + tests asserting the rules) |
| §8 module structure and boundaries | File Structure; each module lands in its own task |
| §8.2 stack choice | Task 1 |
| §9 schema, storage key, recovery, 90-day retention | Task 4 |
| §10 timestamp-derived time, long background gaps, no banner, 04:00 streak boundary | Task 5, Task 6, Task 4 |
| §11 test matrix | Tasks 2–7 cover every row |
| §12 out of scope | Nothing in any task adds accounts, sound, notifications, export or a light theme |

One gap found and closed while reviewing: §5.1 calls for chimney smoke particles, which the world task drew but no checklist item covered. It is now part of the Task 11 motion check ("the fog on the canvas is frozen") and `drawStatic` renders the chimneys themselves.

**Placeholder scan:** no `TBD`, no `TODO`, no "similar to Task N", no "add error handling". Every code step contains the code.

**Type consistency:** `AmbientValues` fields (`deep`/`mid`/`lift`/`glow`/`accent`/`ink`/`inkSoft`/`lum`/`sky`) are identical in Tasks 2, 3, 8. `SessionRecord` is defined once in Task 4 and consumed unchanged by Tasks 5, 6, 10. `progressOf` (not `progress`) is used consistently in Tasks 5 and 10. `gradesFor` returns `GradeDef[]` and is the only caller-facing bridge from `GradeName` to `GradeDef` in Tasks 3 and 10. `motionValue` returns `0 | 1`, matching the `motion` prop on `<World />`.
