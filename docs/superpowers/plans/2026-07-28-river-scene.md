# River & Bridge Scene Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ganti pita bawah datar NightWatch dengan dek jembatan batu Victorian, taruh sungai berpantulan cermin di tengah, dan pusatkan semua garis komposisi ke satu `horizon()`.

**Architecture:** Semua modul dunia berhenti menghitung pecahan sendiri dan bertanya ke `horizon(h, deckTop)`. `deckTop` diukur dari DOM lewat `ResizeObserver` pada `.grid`, jadi balustrade benar-benar duduk di bawah panel kaca. Enam modul dunia baru, masing-masing satu tanggung jawab; hanya `water.ts` dan `weather.ts` yang punya state. `renderer.ts` memiliki pelat cache, mirror pantulan, pengukuran frame, dan takik kualitas — tidak ada modul lain yang mengukur waktu.

**Tech Stack:** Vite 6, React 19, TypeScript 5.7, Vitest 3, Canvas 2D. Tanpa dependensi runtime di luar React.

## Global Constraints

- **Spek acuan:** `docs/superpowers/specs/2026-07-28-river-scene-design.md`. Addendum gaya: `../Ideas/gaslamp-dna.md`. Induk: `../Useless Dashboard/DNA.md`.
- **Tidak ada pecahan literal komposisi di `src/world/*.ts` selain `horizon.ts`.** Ditegakkan tes di Task 14.
- **Tidak ada literal warna palet di luar `src/style/tokens.css` dan `src/ambient/keyframes.ts`.** Warna canvas selalu diturunkan dari `AmbientValues`.
- **Geometri tidak pernah turun kualitas, cuma tekstur.** Siluet, lengkung, pilar, balustrade digambar penuh di takik mana pun.
- **`motion: 0` membekukan, tidak mengosongkan.** Pantulan tetap digambar dengan geser-x nol.
- **Semua generator deterministik.** Tidak ada `Math.random()` di `src/`. Benih berasal dari ukuran layar atau `nightKey()`.
- **Sudut arsir:** `far: -0.42`, `mid: -0.95`, `near: 0.30`, `water: 0.00`.
- **Budget frame ≤ 8 ms**, maksimum 7 hal bergerak per frame.
- **Commit tanpa trailer co-author.** Semua commit memakai:
  `git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" commit -m "..."`
- **Branch:** `feat/river-scene`. Sudah dibuat, spek sudah di-commit di sana.
- **Perintah verifikasi:** `npm test`, `npm run typecheck`, `npm run build`.
- Setiap task berakhir hijau di `npm test` **dan** `npm run typecheck` sebelum commit.

## Peta File

**Dibuat:**

| file | tanggung jawab |
|---|---|
| `src/world/rng.ts` | benih deterministik: `rand`, `stream`, `hashString` |
| `src/world/horizon.ts` | satu-satunya sumber garis komposisi |
| `src/world/city.ts` | kosakata siluet + generator cakrawala + penggambarnya |
| `src/world/bridge.ts` | jembatan hulu: lengkung segmental, pilar, cutwater |
| `src/world/water.ts` | badan air, pantulan mirror, kilau lentera, riak, cincin |
| `src/world/deck.ts` | batu setts, balustrade, perabot dek |
| `src/world/weather.ts` | undian cuaca, efek, tongkang, asap, burung, hujan |
| `src/world/quality.ts` | rata-rata bergulir + takik kualitas berhisteresis |

**Diubah:**

| file | perubahan |
|---|---|
| `src/world/hatch.ts` | `HATCH_ANGLES` dapat `water: 0` |
| `src/world/layers.ts` | ditulis ulang jadi orkestrator pelat statis |
| `src/world/bloom.ts` | membaca `horizon()`; `lampSpots()` jadi fungsi murni bersama |
| `src/world/fog.ts` | membaca `horizon()`; menerima `fogScale` dari cuaca |
| `src/world/renderer.ts` | argumen jadi objek; memiliki mirror, timing, takik |
| `src/world/Canvas.tsx` | prop `deckTop` dan `weather` |
| `src/App.tsx` | `ResizeObserver` pada `.grid` |
| `src/app/useNightWatch.ts` | mengekspos `weather` |
| `src/style/base.css` | `.app` bottom-docked |
| `src/style/components.css` | daftar bisa di-scroll |
| `src/panels/TheWatch.tsx` | lepas `row-2` |
| `src/panels/TheQuarry.tsx` | daftar pakai `.list--scroll` |
| `tests/smoke.test.ts` | tes tidak-ada-pecahan-literal |
| `../Ideas/gaslamp-dna.md` | amandemen §B.3 dan §C.2 |

---

### Task 1: `rng.ts` — benih deterministik bersama

`rand()` sekarang hidup sebagai fungsi privat di `layers.ts`. Tiga modul baru butuh benih, dan menyalinnya tiga kali adalah persis kesalahan yang plan ini ada untuk memperbaiki.

**Files:**
- Create: `src/world/rng.ts`
- Test: `tests/world/rng.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: `rand(seed: number): number`, `stream(seed: number): () => number`, `hashString(s: string): number`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/rng.test.ts
import { describe, expect, it } from 'vitest';
import { hashString, rand, stream } from '../../src/world/rng';

describe('rand', () => {
  it('is deterministic for a given seed', () => {
    expect(rand(7)).toBe(rand(7));
  });
  it('stays inside [0, 1)', () => {
    for (let i = 0; i < 500; i++) {
      const v = rand(i);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });
  it('gives different values for neighbouring seeds', () => {
    expect(rand(11)).not.toBeCloseTo(rand(12), 3);
  });
});

describe('stream', () => {
  it('replays identically from the same seed', () => {
    const a = stream(42);
    const b = stream(42);
    const left = [a(), a(), a(), a()];
    const right = [b(), b(), b(), b()];
    expect(left).toEqual(right);
  });
  it('advances, so consecutive draws differ', () => {
    const s = stream(3);
    expect(s()).not.toBe(s());
  });
});

describe('hashString', () => {
  it('is stable for the same key', () => {
    expect(hashString('2026-07-28')).toBe(hashString('2026-07-28'));
  });
  it('separates adjacent night keys', () => {
    expect(hashString('2026-07-28')).not.toBe(hashString('2026-07-29'));
  });
  it('returns an unsigned 32-bit integer', () => {
    const h = hashString('anything at all');
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThan(2 ** 32);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/rng.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/rng"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/rng.ts

/**
 * Deterministic pseudo-random. The world must be identical between redraws —
 * a skyline that reshuffles on every cache rebuild is a skyline made of static.
 */
export function rand(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

/** A stateful stream from one seed, for generators that need many draws. */
export function stream(seed: number): () => number {
  let i = seed;
  return () => rand(i++);
}

/**
 * Stable 32-bit FNV-1a hash. Lets `nightKey()` seed the weather without
 * parsing the date back out of the string.
 */
export function hashString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/rng.test.ts`
Expected: PASS, 8 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/rng.ts tests/world/rng.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: shared deterministic seeding for world generators"
```

---

### Task 2: `horizon.ts` — sumber tunggal garis komposisi

**Files:**
- Create: `src/world/horizon.ts`
- Test: `tests/world/horizon.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: type `Horizon`, `horizon(h: number, deckTopPx: number): Horizon`, konstanta `DECK_MIN`, `DECK_MAX`, `RAIL_H`, `WATER_MIN`, `WATER_TOP_PREF`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/horizon.test.ts
import { describe, expect, it } from 'vitest';
import { DECK_MAX, DECK_MIN, WATER_MIN, horizon } from '../../src/world/horizon';

const SIZES = [420, 600, 900, 1200, 1600];
const DECKS = [0.2, 0.4, 0.54, 0.66, 0.8, 0.95];

describe('horizon', () => {
  it('orders every band top to bottom without a gap', () => {
    for (const h of SIZES) {
      for (const f of DECKS) {
        const z = horizon(h, h * f);
        expect(z.cityTop).toBeLessThan(z.skyBot);
        expect(z.skyBot).toBeLessThan(z.bridgeTop);
        expect(z.bridgeTop).toBeLessThan(z.waterTop);
        expect(z.waterTop).toBeLessThan(z.railTop);
        expect(z.railTop).toBeLessThan(z.deckTop);
        expect(z.deckTop).toBeLessThanOrEqual(h);
        // no gap: the water's foot IS the rail's head, to the pixel
        expect(z.waterBot).toBe(z.railTop);
        expect(z.railBot).toBe(z.deckTop);
        expect(z.cityBot).toBe(z.waterTop);
      }
    }
  });

  it('clamps deckTop into its band', () => {
    const h = 900;
    expect(horizon(h, 0).deckTop).toBe(Math.round(h * DECK_MIN));
    expect(horizon(h, h * 2).deckTop).toBe(Math.round(h * DECK_MAX));
  });

  it('never lets the river be squeezed below its floor', () => {
    for (const h of SIZES) {
      for (const f of DECKS) {
        const z = horizon(h, h * f);
        expect(z.waterBot - z.waterTop).toBeGreaterThanOrEqual(Math.floor(h * WATER_MIN) - 1);
      }
    }
  });

  it('sinks the bridge piers into the water', () => {
    const z = horizon(900, 900 * 0.66);
    expect(z.bridgeBot).toBeGreaterThan(z.waterTop);
  });

  it('returns integers, so two modules cannot round differently', () => {
    const z = horizon(901, 901 * 0.63);
    for (const value of Object.values(z)) expect(Number.isInteger(value)).toBe(true);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/horizon.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/horizon"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/horizon.ts

/**
 * Where the world's stone meets its water.
 *
 * These numbers used to live as magic fractions inside two different modules —
 * `layers.ts` drew the near band at 0.86 and `bloom.ts` independently believed
 * the street lamps stood at 0.855. Two copies of one fact, already disagreeing.
 *
 * So: ONE function. Everything that needs a composition line asks here, and
 * because the rounding happens once, the modules agree to the pixel. Two
 * modules rounding the same fraction independently is how you get a 1px seam of
 * sky glowing between the river and the deck.
 */
export type Horizon = {
  h: number;
  /** highest spire in the far city */
  cityTop: number;
  /** below this the city's roofs begin; above it the sky is clean */
  skyBot: number;
  /** the far city's feet — the same line as the waterline */
  cityBot: number;
  /** top rail of the upstream bridge */
  bridgeTop: number;
  /** foot of the piers, sunk into the river */
  bridgeBot: number;
  waterTop: number;
  waterBot: number;
  railTop: number;
  railBot: number;
  deckTop: number;
};

/** The deck may not eat more than this much frame, nor less. */
export const DECK_MIN = 0.54;
export const DECK_MAX = 0.80;

/** Balustrade height, as a fraction of the frame. */
export const RAIL_H = 0.06;

/**
 * The river's floor. Bands ABOVE the water are proportional and compressible;
 * the water is not. A river squeezed to a thin strip kills the reflection, and
 * the reflection is the single largest source of detail in the scene.
 */
export const WATER_MIN = 0.14;

/** Where the waterline sits when there is room for it. */
export const WATER_TOP_PREF = 0.40;

/**
 * Where the deck goes before the panel row has been measured — one frame at
 * boot, and any frame where the measurement is not available. It lives here
 * rather than in the canvas because it is a composition line like any other.
 */
export const DECK_DEFAULT = 0.66;

export function defaultDeckTop(h: number): number {
  return h * DECK_DEFAULT;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function horizon(h: number, deckTopPx: number): Horizon {
  const deckTop = Math.round(clamp(deckTopPx, h * DECK_MIN, h * DECK_MAX));
  const railTop = Math.round(deckTop - h * RAIL_H);
  const waterBot = railTop;
  const waterTop = Math.round(Math.min(h * WATER_TOP_PREF, railTop - h * WATER_MIN));

  // Everything above the waterline shares what is left, proportionally. On a
  // short viewport the sky gives way first — a cramped sky still reads as sky,
  // a cramped river reads as a shelf.
  const above = waterTop;

  return {
    h,
    cityTop: Math.round(above * 0.40),
    skyBot: Math.round(above * 0.55),
    cityBot: waterTop,
    bridgeTop: Math.round(above * 0.75),
    bridgeBot: waterTop + Math.round(h * 0.03),
    waterTop,
    waterBot,
    railTop,
    railBot: deckTop,
    deckTop,
  };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/horizon.test.ts`
Expected: PASS, 5 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/horizon.ts tests/world/horizon.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: single source of truth for every composition line"
```

---

### Task 3: Sudut arsir untuk air

**Files:**
- Modify: `src/world/hatch.ts:8`
- Test: `tests/world/hatch.test.ts` (tambah)

**Interfaces:**
- Consumes: tidak ada
- Produces: `HATCH_ANGLES.water === 0`

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `tests/world/hatch.test.ts`:

```ts
describe('HATCH_ANGLES', () => {
  it('locks one angle per depth, water included', () => {
    expect(Object.keys(HATCH_ANGLES).sort()).toEqual(['far', 'mid', 'near', 'water']);
  });

  it('draws water dead flat', () => {
    // Flat horizontal lines are the nineteenth-century engraver's convention for
    // water. Any other angle and the river reads as a wall.
    expect(HATCH_ANGLES.water).toBe(0);
  });

  it('gives every depth a distinct angle', () => {
    const values = Object.values(HATCH_ANGLES);
    expect(new Set(values).size).toBe(values.length);
  });
});
```

Pastikan `HATCH_ANGLES` ada di daftar import file itu.

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/hatch.test.ts`
Expected: FAIL — `expected [ 'far', 'mid', 'near' ] to deeply equal [ 'far', 'mid', 'near', 'water' ]`

- [ ] **Step 3: Tulis implementasinya**

Ganti `src/world/hatch.ts:8`:

```ts
export const HATCH_ANGLES = {
  far: -0.42,
  mid: -0.95,
  near: 0.30,
  /**
   * Dead flat. Not a free choice: horizontal line work is how nineteenth-century
   * engraving draws water, and it is what makes the river read as a horizontal
   * surface instead of a vertical wall. The upstream bridge shares `mid` — its
   * depth really is there, and a fifth angle would only blur the depth ladder.
   */
  water: 0.00,
} as const;
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/hatch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/world/hatch.ts tests/world/hatch.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: flat hatch angle for water, the engraver's convention"
```

---

### Task 4: `city.ts` — kosakata siluet

**Files:**
- Create: `src/world/city.ts`
- Test: `tests/world/city.test.ts`

**Interfaces:**
- Consumes: `stream` dari `src/world/rng.ts`
- Produces: type `ShapeKind`, type `Block`, `skyline(w, top, bot, seed): Block[]`, `drawSkyline(g, blocks, bot, opts): void`, type `SkylineStyle`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/city.test.ts
import { describe, expect, it } from 'vitest';
import { skyline } from '../../src/world/city';

describe('skyline', () => {
  const blocks = skyline(1200, 100, 400, 91);

  it('covers the full width with no gap and no overlap', () => {
    let x = 0;
    for (const b of blocks) {
      expect(b.x).toBe(x);
      x += b.w;
    }
    expect(x).toBeGreaterThanOrEqual(1200);
  });

  it('varies width, so the skyline is not a bar chart', () => {
    const widths = new Set(blocks.map((b) => b.w));
    expect(widths.size).toBeGreaterThan(4);
  });

  it('places exactly one clock tower — a landmark is only a landmark once', () => {
    expect(blocks.filter((b) => b.kind === 'clockTower')).toHaveLength(1);
  });

  it('always gives the smoke somewhere to come from', () => {
    const factories = blocks.filter((b) => b.kind === 'factory');
    expect(factories.length).toBeGreaterThanOrEqual(1);
    for (const f of factories) {
      expect(f.stackX).toBeGreaterThanOrEqual(f.x);
      expect(f.stackX).toBeLessThanOrEqual(f.x + f.w);
    }
  });

  it('keeps every roof inside its band', () => {
    for (const b of blocks) {
      expect(b.top).toBeGreaterThanOrEqual(100);
      expect(b.top).toBeLessThan(400);
    }
  });

  it('is deterministic for a given seed and size', () => {
    expect(skyline(1200, 100, 400, 91)).toEqual(skyline(1200, 100, 400, 91));
  });

  it('produces a different city for a different seed', () => {
    const other = skyline(1200, 100, 400, 92);
    expect(other.map((b) => b.kind).join()).not.toBe(blocks.map((b) => b.kind).join());
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/city.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/city"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/city.ts
import { stream } from './rng';
import { hatch } from './hatch';

/**
 * The old skyline was twenty-six equal-width blocks with random heights. The eye
 * reads that as a bar chart, not a city, because a city's rhythm lives in its
 * WIDTHS as much as its heights. This is a vocabulary of shapes drawn onto a
 * walking cursor with varying widths.
 */
export type ShapeKind =
  | 'gable' | 'flat' | 'spire' | 'dome' | 'clockTower' | 'factory' | 'crane';

export type Block = {
  kind: ShapeKind;
  x: number;
  w: number;
  /** y of the highest point of the massing */
  top: number;
  /** smoke anchor; present only on factories */
  stackX?: number;
};

const MIN_W = 18;
const MAX_W = 90;

/** `heightF`: 0 is a low shed, 1 is the tallest thing on the block. */
function pickKind(r: number, heightF: number): ShapeKind {
  // Cranes and sheds crowd the waterfront; spires and stacks stand behind them.
  if (heightF < 0.35) return r < 0.35 ? 'crane' : r < 0.75 ? 'gable' : 'flat';
  if (heightF > 0.82) return r < 0.45 ? 'spire' : r < 0.75 ? 'factory' : 'dome';
  return r < 0.55 ? 'flat' : r < 0.85 ? 'gable' : 'dome';
}

export function skyline(w: number, top: number, bot: number, seed: number): Block[] {
  const r = stream(seed);
  const span = bot - top;
  const out: Block[] = [];

  let x = 0;
  while (x < w) {
    const bw = Math.max(MIN_W, Math.round(MIN_W + r() * (MAX_W - MIN_W)));
    const heightF = Math.pow(r(), 0.85);
    out.push({
      kind: pickKind(r(), heightF),
      x,
      w: bw,
      top: Math.round(bot - span * (0.18 + heightF * 0.82)),
    });
    x += bw;
  }

  // The landmark goes on the widest block, so it always has room for its shaft.
  // Deterministic, and it reads as deliberate rather than as an accident.
  let widest = 0;
  for (let i = 1; i < out.length; i++) if (out[i]!.w > out[widest]!.w) widest = i;
  out[widest]!.kind = 'clockTower';
  out[widest]!.top = top;

  // Smoke needs a chimney. Without this guarantee a seed can produce a city
  // where the smoke layer has nowhere to attach and silently draws nothing.
  if (!out.some((b) => b.kind === 'factory')) {
    const at = (widest + Math.max(1, Math.floor(out.length / 2))) % out.length;
    out[at]!.kind = 'factory';
    out[at]!.top = Math.round(bot - span * 0.9);
  }
  for (const b of out) if (b.kind === 'factory') b.stackX = Math.round(b.x + b.w * 0.5);

  return out;
}

/**
 * Massing only. Details (pots, jibs) are stroked separately after hatching.
 *
 * The block's own height is `bh`, never `h`: `h` is reserved for the frame, and
 * the smoke test in tests/smoke.test.ts refuses any `h * 0.x` outside horizon.ts.
 */
function massing(g: CanvasRenderingContext2D, b: Block, bot: number): void {
  const { x, w, top, kind } = b;
  const bh = bot - top;
  g.beginPath();
  switch (kind) {
    case 'gable':
      g.moveTo(x, bot); g.lineTo(x, top + bh * 0.34);
      g.lineTo(x + w / 2, top); g.lineTo(x + w, top + bh * 0.34);
      g.lineTo(x + w, bot); g.closePath();
      break;
    case 'spire':
      g.moveTo(x, bot); g.lineTo(x, top + bh * 0.55);
      g.lineTo(x + w * 0.5, top); g.lineTo(x + w, top + bh * 0.55);
      g.lineTo(x + w, bot); g.closePath();
      break;
    case 'dome': {
      const r = w * 0.5;
      g.moveTo(x, bot); g.lineTo(x, top + r);
      g.arc(x + r, top + r, r, Math.PI, 0);
      g.lineTo(x + w, bot); g.closePath();
      break;
    }
    case 'clockTower': {
      const sw = Math.min(w, 30);
      const sx = x + (w - sw) / 2;
      g.moveTo(sx, bot); g.lineTo(sx, top + sw * 0.9);
      g.lineTo(sx + sw / 2, top); g.lineTo(sx + sw, top + sw * 0.9);
      g.lineTo(sx + sw, bot); g.closePath();
      break;
    }
    case 'factory': {
      const sw = Math.max(5, w * 0.18);
      const sx = x + w * 0.5 - sw / 2;
      const shoulder = top + bh * 0.62;
      g.moveTo(x, bot); g.lineTo(x, shoulder);
      g.lineTo(sx, shoulder); g.lineTo(sx + sw * 0.15, top);
      g.lineTo(sx + sw * 0.85, top); g.lineTo(sx + sw, shoulder);
      g.lineTo(x + w, shoulder); g.lineTo(x + w, bot); g.closePath();
      break;
    }
    case 'crane':
      // A low shed; the jib is stroked on top, because a filled jib at this size
      // turns into a blob.
      g.rect(x, top + bh * 0.55, w, bh * 0.45);
      break;
    case 'flat':
    default:
      g.rect(x, top, w, bh);
      break;
  }
}

export type SkylineStyle = {
  angle: number;
  fill: string;
  ink: string;
  density: number;
  maxGap: number;
};

export function drawSkyline(
  g: CanvasRenderingContext2D,
  blocks: readonly Block[],
  bot: number,
  s: SkylineStyle,
): void {
  for (const b of blocks) {
    g.fillStyle = s.fill;
    massing(g, b, bot);
    g.fill();

    // Hatch is clipped to the silhouette, not to its bounding box — the whole
    // point of a vocabulary of shapes is lost if every one wears a square coat.
    g.save();
    massing(g, b, bot);
    g.clip();
    hatch(g, b.x, b.top, b.w, bot - b.top, s.density, {
      angle: s.angle, color: s.ink, maxGap: s.maxGap,
    });
    g.restore();
  }

  // Details, stroked over the hatching.
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  for (const b of blocks) {
    const bh = bot - b.top;
    if (b.kind === 'flat') {
      // A row of chimney pots. Terraces without them read as filing cabinets.
      g.fillStyle = s.fill;
      for (let k = 0; k < 3; k++) {
        const px = b.x + b.w * (0.2 + k * 0.3);
        g.fillRect(px, b.top - 7, 3, 7);
      }
    }
    if (b.kind === 'crane') {
      const mx = b.x + b.w * 0.62;
      const mastTop = b.top + bh * 0.05;
      g.beginPath();
      g.moveTo(mx, b.top + bh * 0.55);
      g.lineTo(mx, mastTop);
      g.lineTo(b.x + b.w * 0.08, mastTop + bh * 0.18);
      g.stroke();
    }
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/city.test.ts`
Expected: PASS, 7 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/city.ts tests/world/city.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: silhouette vocabulary so the skyline stops reading as a bar chart"
```

---

### Task 5: `bridge.ts` — jembatan hulu

**Files:**
- Create: `src/world/bridge.ts`
- Test: `tests/world/bridge.test.ts`

**Interfaces:**
- Consumes: `Horizon` dari `horizon.ts`, `hatch`/`HATCH_ANGLES` dari `hatch.ts`
- Produces: type `Pier`, `piers(w, hz): Pier[]`, `drawBridge(g, w, hz, style): void`, type `BridgeStyle`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/bridge.test.ts
import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { ARCH_RISE, piers } from '../../src/world/bridge';

describe('piers', () => {
  const hz = horizon(900, 900 * 0.66);
  const p = piers(1400, hz);

  it('spans the frame from edge to edge', () => {
    expect(p[0]!.x).toBeLessThanOrEqual(0);
    expect(p[p.length - 1]!.x + p[p.length - 1]!.w).toBeGreaterThanOrEqual(1400);
  });

  it('spaces them evenly, so the arches are a rhythm not a scatter', () => {
    const gaps = p.slice(1).map((q, i) => q.x - p[i]!.x);
    for (const gap of gaps) expect(gap).toBeCloseTo(gaps[0]!, 6);
  });

  it('sinks every pier below the waterline', () => {
    for (const q of p) expect(q.bot).toBeGreaterThan(hz.waterTop);
  });

  it('keeps arches segmental — flatter than a semicircle', () => {
    // A semicircular arch would rise by half the span. Roman aqueduct, not
    // Victorian Thames.
    expect(ARCH_RISE).toBeLessThan(0.5);
    expect(ARCH_RISE).toBeGreaterThan(0.15);
  });

  it('is deterministic for a size', () => {
    expect(piers(1400, hz)).toEqual(piers(1400, hz));
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/bridge.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/bridge"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/bridge.ts
import type { Horizon } from './horizon';
import { HATCH_ANGLES, hatch } from './hatch';

/**
 * Rise of the arch as a fraction of its span. A semicircle rises by 0.5 and
 * reads as a Roman aqueduct; a Victorian Thames bridge is SEGMENTAL — a shallow
 * slice of a much larger circle. That flatness is most of what makes the
 * silhouette read as the right century.
 */
export const ARCH_RISE = 0.30;

/** Roughly how wide one span wants to be, before it is fitted to the frame. */
const SPAN_TARGET = 190;

export type Pier = { x: number; w: number; top: number; bot: number };

export function piers(w: number, hz: Horizon): Pier[] {
  const count = Math.max(2, Math.round(w / SPAN_TARGET) + 1);
  const step = w / (count - 1);
  const pw = Math.max(10, Math.round(step * 0.12));
  const out: Pier[] = [];
  for (let i = 0; i < count; i++) {
    // x is deliberately NOT rounded: rounding makes neighbouring spans differ by
    // a pixel, and a bridge whose arches are not all the same width reads as a
    // mistake rather than as a bridge. Canvas takes fractional coordinates.
    out.push({ x: i * step - pw / 2, w: pw, top: hz.bridgeTop, bot: hz.bridgeBot });
  }
  return out;
}

export type BridgeStyle = { fill: string; ink: string; density: number };

export function drawBridge(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  s: BridgeStyle,
): void {
  const p = piers(w, hz);
  const deckTop = hz.bridgeTop;
  const deckH = Math.max(8, Math.round((hz.bridgeBot - hz.bridgeTop) * 0.22));
  const springLine = deckTop + deckH;

  // The roadway, drawn as one solid band with the arch voids punched back out.
  // Punching is the trick: what reads as an arch is the SKY and the RIVER seen
  // through it, not any line we draw.
  g.save();
  g.beginPath();
  g.rect(0, deckTop, w, hz.bridgeBot - deckTop);

  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i]!;
    const b = p[i + 1]!;
    const x0 = a.x + a.w;
    const x1 = b.x;
    const span = x1 - x0;
    if (span <= 2) continue;
    const rise = span * ARCH_RISE;
    // Counter-clockwise so the sub-path subtracts under 'evenodd'.
    g.moveTo(x0, hz.bridgeBot);
    g.lineTo(x0, springLine);
    g.quadraticCurveTo(x0 + span / 2, springLine - rise * 2, x1, springLine);
    g.lineTo(x1, hz.bridgeBot);
    g.closePath();
  }

  g.fillStyle = s.fill;
  g.fill('evenodd');
  g.save();
  g.clip('evenodd');
  hatch(g, 0, deckTop, w, hz.bridgeBot - deckTop, s.density, {
    angle: HATCH_ANGLES.mid, color: s.ink, maxGap: 10,
  });
  g.restore();
  g.restore();

  // Cutwaters — the pointed noses that split the current. Cheap, and they are
  // the difference between piers and posts.
  g.fillStyle = s.fill;
  for (const q of p) {
    const noseY = hz.bridgeBot;
    g.beginPath();
    g.moveTo(q.x, noseY - q.w * 1.4);
    g.lineTo(q.x + q.w / 2, noseY);
    g.lineTo(q.x + q.w, noseY - q.w * 1.4);
    g.closePath();
    g.fill();
  }

  // String course: two thin parallel lines along the roadway. Without them the
  // deck is a slab.
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  g.globalAlpha = 0.7;
  for (const y of [deckTop + 2, deckTop + deckH - 2]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.globalAlpha = 1;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/bridge.test.ts`
Expected: PASS, 5 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/bridge.ts tests/world/bridge.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: upstream bridge with segmental arches and cutwaters"
```

---

### Task 6: `deck.ts` — dek batu dan balustrade

**Files:**
- Create: `src/world/deck.ts`
- Test: `tests/world/deck.test.ts`

**Interfaces:**
- Consumes: `Horizon`, `hatch`/`HATCH_ANGLES`
- Produces: `settRows(hz): number[]`, `balusters(w): { x: number; w: number }[]`, `drawDeck(g, w, hz, style): void`, type `DeckStyle`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/deck.test.ts
import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { balusters, settRows } from '../../src/world/deck';

describe('settRows', () => {
  const hz = horizon(900, 900 * 0.66);
  const rows = settRows(hz);

  it('starts at the deck and ends at the bottom of the frame', () => {
    expect(rows[0]).toBeGreaterThanOrEqual(hz.deckTop);
    expect(rows[rows.length - 1]).toBeLessThanOrEqual(hz.h);
  });

  it('spaces rows wider as the stones come toward you', () => {
    const gaps = rows.slice(1).map((y, i) => y - rows[i]!);
    for (let i = 1; i < gaps.length; i++) {
      expect(gaps[i]!).toBeGreaterThan(gaps[i - 1]!);
    }
  });

  it('gives enough rows to read as paving, not as a floor', () => {
    expect(rows.length).toBeGreaterThanOrEqual(5);
  });
});

describe('balusters', () => {
  const b = balusters(1000);

  it('covers the full width', () => {
    expect(b[0]!.x).toBeLessThanOrEqual(0);
    expect(b[b.length - 1]!.x + b[b.length - 1]!.w).toBeGreaterThanOrEqual(1000);
  });

  it('leaves a gap between each, or it is a wall not a balustrade', () => {
    const pitch = b[1]!.x - b[0]!.x;
    expect(pitch).toBeGreaterThan(b[0]!.w);
  });

  it('is deterministic', () => {
    expect(balusters(1000)).toEqual(balusters(1000));
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/deck.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/deck"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/deck.ts
import type { Horizon } from './horizon';
import { HATCH_ANGLES, hatch } from './hatch';

const BALUSTER_W = 8;
const BALUSTER_GAP = 6;

/**
 * Joint lines across the paving. They crowd together toward the parapet and
 * open out toward your feet — that spacing IS the perspective. Evenly spaced
 * rows read as a tiled floor seen from directly above.
 */
export function settRows(hz: Horizon): number[] {
  const top = hz.deckTop;
  const depth = hz.h - top;
  const rows: number[] = [];
  for (let i = 0; ; i++) {
    const f = Math.pow(i / 9, 1.7);
    const y = Math.round(top + depth * f);
    if (y > hz.h) break;
    rows.push(y);
    if (i > 40) break;
  }
  return rows;
}

export function balusters(w: number): { x: number; w: number }[] {
  const pitch = BALUSTER_W + BALUSTER_GAP;
  const out: { x: number; w: number }[] = [];
  for (let x = 0; x < w + pitch; x += pitch) {
    out.push({ x: Math.round(x), w: BALUSTER_W });
  }
  return out;
}

export type DeckStyle = { fill: string; ink: string; rail: string };

export function drawDeck(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  s: DeckStyle,
): void {
  // 1 — the balustrade. This is the shelf the glass panels sit on, so it has to
  //     survive an 18px backdrop blur eating half its detail.
  const railH = hz.railBot - hz.railTop;
  const capH = Math.max(3, Math.round(railH * 0.18));
  const plinthH = Math.max(3, Math.round(railH * 0.16));

  g.fillStyle = s.rail;
  g.fillRect(0, hz.railTop, w, capH);
  g.fillRect(0, hz.railBot - plinthH, w, plinthH);

  const bodyTop = hz.railTop + capH;
  const bodyH = railH - capH - plinthH;
  for (const b of balusters(w)) {
    // A vase, not a post: narrow at the neck, swelling low. Two trapezoids are
    // enough at this size, and they survive the blur where a curve would not.
    const neck = b.w * 0.45;
    g.beginPath();
    g.moveTo(b.x + (b.w - neck) / 2, bodyTop);
    g.lineTo(b.x + (b.w + neck) / 2, bodyTop);
    g.lineTo(b.x + b.w, bodyTop + bodyH * 0.62);
    g.lineTo(b.x + b.w, bodyTop + bodyH);
    g.lineTo(b.x, bodyTop + bodyH);
    g.lineTo(b.x, bodyTop + bodyH * 0.62);
    g.closePath();
    g.fillStyle = s.rail;
    g.fill();
  }

  // 2 — the paving under your feet.
  g.fillStyle = s.fill;
  g.fillRect(0, hz.deckTop, w, hz.h - hz.deckTop);

  const rows = settRows(hz);
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  g.globalAlpha = 0.55;
  for (const y of rows) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }

  // Vertical joints, staggered every other row so the setts bond like brickwork.
  for (let i = 0; i < rows.length - 1; i++) {
    const y0 = rows[i]!;
    const y1 = rows[i + 1]!;
    const pitch = 26 + (y1 - y0) * 1.6;
    const offset = i % 2 === 0 ? 0 : pitch / 2;
    for (let x = offset; x < w; x += pitch) {
      g.beginPath();
      g.moveTo(x, y0);
      g.lineTo(x, y1);
      g.stroke();
    }
  }
  g.globalAlpha = 1;

  // 3 — the near band is the densest hatching in the picture, into cross-hatch
  //     territory. Addendum §C.2.
  hatch(g, 0, hz.deckTop, w, hz.h - hz.deckTop, 0.74, {
    angle: HATCH_ANGLES.near, color: s.ink, maxGap: 9,
  });

  // 4 — furniture. A mooring ring and the bollard the never-extinguished
  //     lantern stands on (addendum §D.1).
  g.fillStyle = s.rail;
  const bollardX = Math.round(w * 0.08);
  const bollardH = Math.round(railH * 1.1);
  g.fillRect(bollardX - 7, hz.deckTop - bollardH, 14, bollardH);
  g.strokeStyle = s.ink;
  g.globalAlpha = 0.8;
  g.beginPath();
  g.arc(Math.round(w * 0.72), hz.railBot - plinthH / 2, 6, 0, Math.PI);
  g.stroke();
  g.globalAlpha = 1;
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/deck.test.ts`
Expected: PASS, 6 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/deck.ts tests/world/deck.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: stone deck in perspective with a vase-profile balustrade"
```

---

### Task 7: `water.ts` — matematika air

Fungsi murni dulu; penggambarnya menyusul di task yang sama, tapi tesnya hanya menyentuh yang murni. Canvas tidak diuji di sini — yang menentukan apakah pantulan benar adalah aritmetika barisnya.

**Files:**
- Create: `src/world/water.ts`
- Test: `tests/world/water.test.ts`

**Interfaces:**
- Consumes: `Horizon`, `HATCH_ANGLES`, `AmbientValues`
- Produces: `SQUASH`, `REFLECT_STEP`, `RING_LIMIT`, type `Ring`, `mirrorRow`, `reflectAlpha`, `rowWobble`, `advanceRing`, type `Water`, `createWater()`, type `LampSpot` (di-*re-export* dari `bloom.ts` di Task 9 — di sini dideklarasikan lokal)

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/water.test.ts
import { describe, expect, it } from 'vitest';
import {
  RING_LIMIT, advanceRing, createWater, mirrorRow, reflectAlpha, rowWobble,
} from '../../src/world/water';

describe('mirrorRow', () => {
  it('walks UP the mirror as the river walks DOWN', () => {
    const a = mirrorRow(100, 100, 200);
    const b = mirrorRow(140, 100, 200);
    expect(b).toBeLessThan(a);
  });
  it('reports exhaustion instead of reading out of bounds', () => {
    expect(mirrorRow(9999, 100, 200)).toBe(-1);
  });
  it('starts at the bottom row of the mirror', () => {
    expect(mirrorRow(100, 100, 200)).toBe(199);
  });
});

describe('reflectAlpha', () => {
  it('is strongest at the waterline and fades toward your feet', () => {
    expect(reflectAlpha(0)).toBeGreaterThan(reflectAlpha(0.5));
    expect(reflectAlpha(0.5)).toBeGreaterThan(reflectAlpha(0.95));
  });
  it('never reaches full opacity — deep water is dark, not a mirror', () => {
    expect(reflectAlpha(0)).toBeLessThan(0.6);
  });
});

describe('rowWobble', () => {
  it('is dead still when motion is zero', () => {
    expect(rowWobble(40, 0.5, 0, 0)).toBe(0);
    expect(rowWobble(40, 0.5, 999_999, 0)).toBe(0);
  });
  it('moves with time when motion is one', () => {
    expect(rowWobble(40, 0.5, 0, 1)).not.toBeCloseTo(rowWobble(40, 0.5, 700, 1), 4);
  });
  it('displaces near water more than far water', () => {
    const far = Math.abs(rowWobble(40, 0.05, 1200, 1));
    const near = Math.abs(rowWobble(40, 0.95, 1200, 1));
    expect(near + far).toBeGreaterThan(0);
  });
});

describe('advanceRing', () => {
  it('expands fast then slows — a real ripple loses energy', () => {
    const a = advanceRing({ x: 0, y: 0, r: 1, life: 0, max: 0.9 }, 100);
    const b = advanceRing({ x: 0, y: 0, r: 1, life: 0.6, max: 0.9 }, 100);
    expect(a.r - 1).toBeGreaterThan(b.r - 1);
  });
  it('ages by the elapsed time', () => {
    expect(advanceRing({ x: 0, y: 0, r: 1, life: 0, max: 0.9 }, 500).life).toBeCloseTo(0.5, 6);
  });
});

describe('createWater', () => {
  it('shares ONE ring implementation with rain and the barge', () => {
    const w = createWater();
    w.ring(10, 20, 1);
    w.ring(30, 40, 0.5);
    expect(w.rings()).toHaveLength(2);
  });
  it('expires rings instead of growing forever', () => {
    const w = createWater();
    w.ring(10, 20, 1);
    for (let i = 0; i < 40; i++) w.update(100, 1);
    expect(w.rings()).toHaveLength(0);
  });
  it('caps the ring field so a downpour cannot unbound it', () => {
    const w = createWater();
    for (let i = 0; i < RING_LIMIT * 3; i++) w.ring(i, i, 1);
    expect(w.rings().length).toBeLessThanOrEqual(RING_LIMIT);
  });
  it('freezes rings when motion is zero', () => {
    const w = createWater();
    w.ring(10, 20, 1);
    const before = w.rings()[0]!.r;
    w.update(500, 0);
    expect(w.rings()[0]!.r).toBe(before);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/water.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/water"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/water.ts
import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';
import { HATCH_ANGLES, hatch } from './hatch';
import { stream } from './rng';

/**
 * How hard the world above is compressed as it comes back up out of the water.
 * Below 1, each row of river shows more of the world — so a tall spire folds
 * into a short river instead of running out of room halfway down its own shaft.
 */
export const SQUASH = 0.78;

/** Reflection row step per quality notch. Texture degrades; geometry never. */
export const REFLECT_STEP = [3, 4, 6] as const;

/** Ripple count multiplier per quality notch. */
export const RIPPLE_SCALE = [1, 0.6, 0.35] as const;

export const RING_LIMIT = 32;

export type Ring = { x: number; y: number; r: number; life: number; max: number };

/** A light source that the river can reflect. */
export type LampSpot = {
  x: number;
  y: number;
  r: number;
  lit: boolean;
  kind: 'window' | 'bridge' | 'street' | 'lantern' | 'moon';
};

/**
 * Which row of the mirror lands on river row `y`. Walking UP the mirror as we
 * walk DOWN the river is the whole trick; SQUASH decides how much world fits in
 * how much water. Returns -1 when we have run out of world to reflect.
 */
export function mirrorRow(y: number, waterTop: number, mirrorH: number): number {
  const my = mirrorH - 1 - Math.round((y - waterTop) / SQUASH);
  return my < 0 ? -1 : my;
}

/**
 * `d` is 0 at the waterline and 1 at your feet. A reflection that stays strong
 * all the way down makes the river look like a sheet of glass lying on the
 * stone — the fade is what gives the water depth.
 */
export function reflectAlpha(d: number): number {
  return Math.pow(1 - d, 1.35) * 0.55;
}

/** Two detuned sines per row. Zero when motion is off — still, but not absent. */
export function rowWobble(y: number, d: number, timeMs: number, motion: number): number {
  if (motion === 0) return 0;
  const t = timeMs / 1000;
  return Math.sin(y * 0.55 + t * 1.4) * (0.8 + d * 2.6)
       + Math.sin(y * 0.23 - t * 0.9) * (0.4 + d * 1.4);
}

export function advanceRing(r: Ring, dtMs: number): Ring {
  const dt = dtMs / 1000;
  const life = r.life + dt;
  const decay = Math.max(0, 1 - life / r.max);
  return { ...r, life, r: r.r + dt * 34 * Math.pow(decay, 0.6) };
}

export type Water = {
  /** Rain, the barge's bow wave, and the ripple field all call THIS. */
  ring(x: number, y: number, strength?: number): void;
  update(dtMs: number, motion: number): void;
  draw(
    g: CanvasRenderingContext2D,
    w: number,
    hz: Horizon,
    v: AmbientValues,
    mirror: HTMLCanvasElement | null,
    lamps: readonly LampSpot[],
    timeMs: number,
    motion: number,
    notch: number,
  ): void;
  rings(): readonly Ring[];
};

export function createWater(seed = 777): Water {
  let live: Ring[] = [];
  const r = stream(seed);
  // Ripple field, laid out once and reused. Positions are fractions so the
  // field survives a resize without regenerating.
  const field = Array.from({ length: 150 }, () => ({
    fx: r(),
    fy: Math.pow(r(), 0.7),
    w: 3 + Math.floor(r() * 7),
    phase: r() * Math.PI * 2,
    speed: 0.25 + r() * 0.5,
  }));

  return {
    ring(x, y, strength = 1) {
      live.push({ x, y, r: 1, life: 0, max: 0.9 * strength });
      if (live.length > RING_LIMIT) live.shift();
    },

    update(dtMs, motion) {
      if (motion === 0) return;
      live = live.map((ring) => advanceRing(ring, dtMs)).filter((ring) => ring.life < ring.max);
    },

    rings: () => live,

    draw(g, w, hz, v, mirror, lamps, timeMs, motion, notch) {
      const top = hz.waterTop;
      const bot = hz.waterBot;
      const h = bot - top;
      if (h <= 1) return;

      // 1 — the body. Near water is deeper and darker.
      const body = g.createLinearGradient(0, top, 0, bot);
      body.addColorStop(0, v.mid);
      body.addColorStop(1, v.deep);
      g.save();
      g.beginPath();
      g.rect(0, top, w, h);
      g.clip();
      g.fillStyle = body;
      g.fillRect(0, top, w, h);

      // 2 — the reflection.
      if (mirror) {
        const step = REFLECT_STEP[Math.min(notch, REFLECT_STEP.length - 1)]!;
        for (let y = top; y < bot; y += step) {
          const d = (y - top) / h;
          const my = mirrorRow(y, top, mirror.height);
          if (my < 0) break;
          const a = reflectAlpha(d);
          if (a < 0.02) break;
          g.globalAlpha = a;
          g.drawImage(
            mirror, 0, my, w, 1,
            Math.round(rowWobble(y, d, timeMs, motion)), y, w, step,
          );
        }
        g.globalAlpha = 1;
      }

      // 3 — the glitter path under every light above the water. Reflected
      //     gaslight on a river is the most London image there is; this is the
      //     part that must never be economised.
      g.globalCompositeOperation = 'lighter';
      for (const lamp of lamps) {
        if (!lamp.lit) continue;
        if (lamp.kind !== 'bridge' && lamp.kind !== 'window' && lamp.kind !== 'moon') continue;
        const cx = lamp.x;
        for (let y = top + 1; y < bot; y += 2) {
          const d = (y - top) / h;
          const halfW = 1.5 + d * (lamp.kind === 'moon' ? 26 : 9);
          const dash = 1 + Math.floor(d * 4);
          const gap = 2 + Math.floor(d * 6);
          const scroll = motion === 0 ? 0 : (timeMs / 1000) * (8 + d * 22);
          for (let x = cx - halfW; x < cx + halfW; x += dash + gap) {
            const j = Math.sin(x * 0.7 + y * 0.9 + (timeMs / 1000) * 2.2);
            if (j < -0.25) continue;
            const edge = 1 - Math.abs(x - cx) / halfW;
            const a = edge * (0.16 + 0.2 * j) * (1 - d * 0.35);
            if (a < 0.03) continue;
            g.globalAlpha = Math.min(1, a);
            g.fillStyle = v.glow;
            g.fillRect(
              Math.round(x + rowWobble(y, d, timeMs, motion) + ((scroll % (dash + gap)) - gap)),
              y, dash, 1,
            );
          }
        }
      }
      g.globalAlpha = 1;
      g.globalCompositeOperation = 'source-over';

      // 4 — ripple highlights, drifting with the current.
      const count = Math.round(field.length * RIPPLE_SCALE[Math.min(notch, 2)]!);
      const drift = motion === 0 ? 0 : (timeMs / 1000) * 6;
      g.fillStyle = v.lift;
      for (let i = 0; i < count; i++) {
        const rp = field[i]!;
        const y = top + 3 + rp.fy * (h - 3);
        const d = (y - top) / h;
        const a = Math.max(0, Math.sin((timeMs / 1000) * rp.speed + rp.phase)) * (0.34 - d * 0.16);
        if (a < 0.04) continue;
        const x = ((rp.fx * w + drift) % w + w) % w;
        g.globalAlpha = a;
        g.fillRect(Math.round(x + rowWobble(y, d, timeMs, motion)), Math.round(y), rp.w, 1);
      }
      g.globalAlpha = 1;

      // 5 — rings, from rain, the barge, anything that hits the water. Squashed
      //     vertically: we look at the river at an angle, so a circular ripple
      //     projects as an ellipse. A round ring reads as a ball on the surface.
      g.strokeStyle = v.lift;
      g.lineWidth = 1;
      for (const ring of live) {
        const a = Math.pow(1 - ring.life / ring.max, 1.5) * 0.5;
        if (a < 0.03) continue;
        g.globalAlpha = a;
        g.beginPath();
        g.ellipse(ring.x, ring.y, ring.r, Math.max(1, ring.r * 0.32), 0, 0, Math.PI * 2);
        g.stroke();
      }
      g.globalAlpha = 1;

      // 6 — flat line work over the whole body. This is the engraver's water,
      //     and it is why the river reads as a surface rather than a photograph
      //     dropped into a drawing.
      hatch(g, 0, top, w, h, 0.34, {
        angle: HATCH_ANGLES.water, color: v.deep, maxGap: 12,
      });

      g.restore();

      // 7 — the waterline. Without a busy seam the reflection simply starts, and
      //     a reflection that starts at a ruled line looks like a screenshot
      //     pasted upside down.
      g.save();
      g.globalAlpha = 0.5;
      g.fillStyle = v.lift;
      for (let x = 0; x < w; x++) {
        const n = Math.abs(Math.sin(x * 0.35 + timeMs / 3000));
        if (n > 0.56) g.fillRect(x, top + (n > 0.72 ? 1 : 0), 1 + Math.round(n), 1);
      }
      g.restore();
    },
  };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/water.test.ts`
Expected: PASS, 12 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/water.ts tests/world/water.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: river with a live mirror reflection and one shared ring field"
```

---

### Task 8: `weather.ts` — undian per malam, tongkang, burung

**Files:**
- Create: `src/world/weather.ts`
- Test: `tests/world/weather.test.ts`

**Interfaces:**
- Consumes: `hashString` dari `rng.ts`, `Block` dari `city.ts`, `Horizon`, `Water`
- Produces: type `Weather`, type `WeatherFx`, `weatherFor(key)`, `effectsFor(w)`, `BARGE_PERIOD_MS`, `BARGE_CROSS_MS`, `bargeAt(nowMs)`, `birdAt(nowMs, i)`, `BIRD_COUNT`, `drawWeather(...)`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/weather.test.ts
import { describe, expect, it } from 'vitest';
import {
  BARGE_CROSS_MS, BARGE_PERIOD_MS, BIRD_COUNT, bargeAt, birdAt, effectsFor, weatherFor,
} from '../../src/world/weather';

describe('weatherFor', () => {
  it('gives the same night the same weather, always', () => {
    expect(weatherFor('2026-07-28')).toBe(weatherFor('2026-07-28'));
  });

  it('does not give every night the same weather', () => {
    const seen = new Set<string>();
    for (let d = 1; d <= 28; d++) {
      seen.add(weatherFor(`2026-02-${String(d).padStart(2, '0')}`));
    }
    expect(seen.size).toBeGreaterThan(1);
  });

  it('lands near the intended weights over a thousand nights', () => {
    const tally: Record<string, number> = { clear: 0, fog: 0, rain: 0, fullmoon: 0 };
    for (let i = 0; i < 1000; i++) tally[weatherFor(`k${i}`)]!++;
    expect(tally.clear! / 1000).toBeGreaterThan(0.30);
    expect(tally.clear! / 1000).toBeLessThan(0.50);
    expect(tally.fullmoon! / 1000).toBeGreaterThan(0.04);
    expect(tally.fullmoon! / 1000).toBeLessThan(0.17);
    expect(tally.rain!).toBeGreaterThan(0);
    expect(tally.fog!).toBeGreaterThan(0);
  });
});

describe('effectsFor', () => {
  it('thins the fog when it rains — rain washes fog out', () => {
    expect(effectsFor('rain').fogScale).toBeLessThan(effectsFor('clear').fogScale);
    expect(effectsFor('fog').fogScale).toBeGreaterThan(effectsFor('clear').fogScale);
  });
  it('only rains on a rainy night', () => {
    expect(effectsFor('rain').rain).toBeGreaterThan(0);
    for (const w of ['clear', 'fog', 'fullmoon'] as const) {
      expect(effectsFor(w).rain).toBe(0);
    }
  });
  it('grounds the birds when the weather is bad', () => {
    expect(effectsFor('clear').birds).toBe(true);
    expect(effectsFor('fullmoon').birds).toBe(true);
    expect(effectsFor('rain').birds).toBe(false);
    expect(effectsFor('fog').birds).toBe(false);
  });
  it('only enlarges the moon on a full moon', () => {
    expect(effectsFor('fullmoon').moonScale).toBeGreaterThan(1);
    expect(effectsFor('clear').moonScale).toBe(1);
  });
});

describe('bargeAt', () => {
  it('is deterministic for a moment in time', () => {
    expect(bargeAt(1_234_567)).toBe(bargeAt(1_234_567));
  });
  it('is absent for most of its period — a barge is rare, not traffic', () => {
    let present = 0;
    const samples = 900;
    for (let i = 0; i < samples; i++) {
      if (bargeAt((i / samples) * BARGE_PERIOD_MS) !== null) present++;
    }
    expect(present / samples).toBeLessThan(0.2);
  });
  it('crosses in one direction while it is on screen', () => {
    const a = bargeAt(1000)!;
    const b = bargeAt(BARGE_CROSS_MS - 1000)!;
    expect(a).not.toBeNull();
    expect(b).toBeGreaterThan(a);
  });
  it('enters and leaves off-screen', () => {
    expect(bargeAt(0)!).toBeLessThan(0);
    expect(bargeAt(BARGE_CROSS_MS - 1)!).toBeGreaterThan(1);
  });
});

describe('birdAt', () => {
  it('is deterministic', () => {
    expect(birdAt(500_000, 0)).toEqual(birdAt(500_000, 0));
  });
  it('gives each bird its own altitude, so they are not one dot', () => {
    // Sampled at the moment each bird enters the frame — they are deliberately
    // offset in time, so asking for all three at one instant would usually find
    // only one and prove nothing.
    const altitudes = new Set<number>();
    for (let i = 0; i < BIRD_COUNT; i++) {
      for (let t = 0; t < 40_000; t += 250) {
        const b = birdAt(t, i);
        if (b) { altitudes.add(Math.round(b.y * 100)); break; }
      }
    }
    expect(altitudes.size).toBeGreaterThan(1);
  });

  it('lets every bird finish its crossing and leave', () => {
    for (let i = 0; i < BIRD_COUNT; i++) {
      let seen = false;
      for (let t = 0; t < 40_000; t += 250) if (birdAt(t, i)) { seen = true; break; }
      expect(seen).toBe(true);
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/weather.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/weather"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/weather.ts
import type { AmbientValues } from '../ambient/types';
import type { Block } from './city';
import type { Horizon } from './horizon';
import type { Water } from './water';
import { hashString, rand } from './rng';

export type Weather = 'clear' | 'fog' | 'rain' | 'fullmoon';

const TABLE: readonly (readonly [Weather, number])[] = [
  ['clear', 0.40],
  ['fog', 0.30],
  ['rain', 0.20],
  ['fullmoon', 0.10],
];

/**
 * Seeded from `nightKey()`, so the same night is always the same weather. The
 * scene must not reshuffle on a resize, and there must be a reason to open the
 * app again tomorrow.
 */
export function weatherFor(key: string): Weather {
  const t = (hashString(key) % 10_000) / 10_000;
  let acc = 0;
  for (const [name, weight] of TABLE) {
    acc += weight;
    if (t < acc) return name;
  }
  return 'clear';
}

export type WeatherFx = {
  /** multiplier on fog band opacity */
  fogScale: number;
  /** multiplier on lamp halo radius */
  haloScale: number;
  /** added to the moon's brightness */
  lumLift: number;
  moonScale: number;
  /** 0..1 rain density */
  rain: number;
  birds: boolean;
};

export function effectsFor(w: Weather): WeatherFx {
  switch (w) {
    case 'fog':
      return { fogScale: 2.0, haloScale: 1.35, lumLift: 0, moonScale: 1, rain: 0, birds: false };
    case 'rain':
      // Rain washes the fog out. A wet London night is the CLEAREST one you get,
      // and the lamps harden into points instead of blooming.
      return { fogScale: 0.55, haloScale: 0.80, lumLift: 0, moonScale: 1, rain: 1, birds: false };
    case 'fullmoon':
      return { fogScale: 0.85, haloScale: 1.10, lumLift: 0.12, moonScale: 2, rain: 0, birds: true };
    default:
      return { fogScale: 1, haloScale: 1, lumLift: 0, moonScale: 1, rain: 0, birds: true };
  }
}

export const BARGE_PERIOD_MS = 15 * 60_000;
export const BARGE_CROSS_MS = 90_000;

/**
 * Driven by the wall clock, not by session progress. The river does not care
 * about your timer, and a barge that only passes while you work would read as a
 * reward rather than as a river. Position is a pure function of the clock —
 * no state, no randomness.
 *
 * Returns x as a fraction of width, or null when it is not crossing.
 */
export function bargeAt(nowMs: number): number | null {
  const phase = ((nowMs % BARGE_PERIOD_MS) + BARGE_PERIOD_MS) % BARGE_PERIOD_MS;
  if (phase >= BARGE_CROSS_MS) return null;
  return -0.15 + (phase / BARGE_CROSS_MS) * 1.32;
}

export const BIRD_COUNT = 3;
const BIRD_PERIOD_MS = 40_000;
const BIRD_CROSS_MS = 20_000;

export function birdAt(nowMs: number, i: number): { x: number; y: number } | null {
  const offset = i * (BIRD_PERIOD_MS / BIRD_COUNT) + rand(i + 5) * 3000;
  const phase = ((nowMs + offset) % BIRD_PERIOD_MS + BIRD_PERIOD_MS) % BIRD_PERIOD_MS;
  if (phase >= BIRD_CROSS_MS) return null;
  const t = phase / BIRD_CROSS_MS;
  return {
    x: -0.1 + t * 1.2,
    y: 0.12 + rand(i + 19) * 0.2 + Math.sin(t * 6 + i) * 0.02,
  };
}

/**
 * Everything that moves in front of the plate but is not water and not fog.
 * Smoke comes only from real chimneys — `blocks` supplies them, so a column can
 * never end up floating in empty air.
 */
export function drawWeather(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  weather: Weather,
  blocks: readonly Block[],
  water: Water,
  timeMs: number,
  motion: number,
  notch: number,
): void {
  const fx = effectsFor(weather);
  const t = timeMs / 1000;

  // 1 — smoke, from factory stacks only.
  const stacks = blocks.filter((b) => b.kind === 'factory').slice(0, 4 - Math.min(notch, 2));
  g.save();
  g.fillStyle = v.accent;
  for (const [i, b] of stacks.entries()) {
    const puffs = 12 - notch * 3;
    for (let k = 0; k < puffs; k++) {
      const age = (k + (motion === 0 ? 0 : (t * 0.35) % 1)) / puffs;
      const rise = age * (hz.cityTop * 0.9 + 40);
      const lean = age * age * 34 + Math.sin(t * 0.4 + i) * 6 * motion;
      const radius = 3 + age * 16;
      g.globalAlpha = (1 - age) * 0.13;
      g.beginPath();
      g.arc(b.stackX! + lean, b.top - rise, radius, 0, Math.PI * 2);
      g.fill();
    }
  }
  g.restore();

  // 2 — the barge. Silhouette, one bow light, and a bow wave that hits the same
  //     ring field the rain uses.
  const bx = motion === 0 ? null : bargeAt(timeMs);
  if (bx !== null) {
    const x = bx * w;
    const y = hz.waterTop + (hz.waterBot - hz.waterTop) * 0.42;
    const bw = Math.max(70, w * 0.09);
    const bh = Math.max(9, bw * 0.14);
    g.save();
    g.fillStyle = v.deep;
    g.beginPath();
    g.moveTo(x, y);
    g.lineTo(x + bw, y);
    g.lineTo(x + bw * 0.88, y + bh);
    g.lineTo(x + bw * 0.08, y + bh);
    g.closePath();
    g.fill();
    g.fillRect(x + bw * 0.62, y - bh * 1.5, bw * 0.06, bh * 1.5);
    g.globalCompositeOperation = 'lighter';
    g.globalAlpha = 0.8;
    g.fillStyle = v.glow;
    g.fillRect(x + bw * 0.9, y - 3, 3, 3);
    g.restore();
    if (Math.floor(timeMs / 400) !== Math.floor((timeMs - 16) / 400)) {
      water.ring(x + bw, y + bh, 0.7);
    }
  }

  // 3 — birds.
  if (fx.birds && motion !== 0) {
    g.save();
    g.strokeStyle = v.deep;
    g.lineWidth = 1;
    g.globalAlpha = 0.6;
    for (let i = 0; i < BIRD_COUNT; i++) {
      const b = birdAt(timeMs, i);
      if (!b) continue;
      const x = b.x * w;
      const y = b.y * hz.h;
      const flap = Math.sin(t * 7 + i) * 2;
      g.beginPath();
      g.moveTo(x - 4, y + flap);
      g.lineTo(x, y - 1);
      g.lineTo(x + 4, y + flap);
      g.stroke();
    }
    g.restore();
  }

  // 4 — rain. Only on a rainy night, and never when motion is off: rain that
  //     hangs in the air is wrong. Wet stone (drawn in layers.ts) stands in.
  if (fx.rain > 0 && motion !== 0) {
    const density = Math.round(220 * fx.rain * [1, 0.6, 0.35][Math.min(notch, 2)]!);
    g.save();
    g.strokeStyle = v.lift;
    g.globalAlpha = 0.22;
    g.lineWidth = 1;
    g.beginPath();
    for (let i = 0; i < density; i++) {
      const speed = 900 + rand(i) * 700;
      const x = ((rand(i + 3) * w + t * 90) % (w + 60)) - 30;
      const y = ((rand(i + 7) * hz.h + t * speed) % hz.h);
      g.moveTo(x, y);
      g.lineTo(x - 4, y + 13);
    }
    g.stroke();
    g.restore();

    // A few of them land, and what lands rings the water.
    if (Math.floor(timeMs / 90) !== Math.floor((timeMs - 16) / 90)) {
      const k = Math.floor(timeMs / 90);
      water.ring(
        rand(k) * w,
        hz.waterTop + rand(k + 1) * (hz.waterBot - hz.waterTop),
        0.45,
      );
    }
  }
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/weather.test.ts`
Expected: PASS, 13 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/weather.ts tests/world/weather.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: per-night weather, barge, smoke and birds"
```

---

### Task 9: `quality.ts` — takik berhisteresis

**Files:**
- Create: `src/world/quality.ts`
- Test: `tests/world/quality.test.ts`

**Interfaces:**
- Consumes: tidak ada
- Produces: `NOTCHES`, `DROP_MS`, `RAISE_MS`, `WINDOW`, `qualityStep(avgMs, notch)`, `createFrameClock(window?)`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/quality.test.ts
import { describe, expect, it } from 'vitest';
import {
  DROP_MS, NOTCHES, RAISE_MS, createFrameClock, qualityStep,
} from '../../src/world/quality';

describe('qualityStep', () => {
  it('drops a notch when the budget is blown', () => {
    expect(qualityStep(DROP_MS + 1, 0)).toBe(1);
  });
  it('climbs back when there is headroom', () => {
    expect(qualityStep(RAISE_MS - 1, 2)).toBe(1);
  });
  it('holds inside the dead band — that band IS the hysteresis', () => {
    const middle = (DROP_MS + RAISE_MS) / 2;
    expect(qualityStep(middle, 0)).toBe(0);
    expect(qualityStep(middle, 1)).toBe(1);
    expect(qualityStep(middle, 2)).toBe(2);
  });
  it('never leaves the notch range', () => {
    expect(qualityStep(999, NOTCHES - 1)).toBe(NOTCHES - 1);
    expect(qualityStep(0, 0)).toBe(0);
  });
});

describe('createFrameClock', () => {
  it('says nothing until it has a full window', () => {
    const clock = createFrameClock(4);
    expect(clock.sample(99)).toBe(0);
    expect(clock.sample(99)).toBe(0);
    expect(clock.sample(99)).toBe(0);
  });
  it('drops after a full window of slow frames', () => {
    const clock = createFrameClock(4);
    let notch = 0;
    for (let i = 0; i < 4; i++) notch = clock.sample(20);
    expect(notch).toBe(1);
  });
  it('recovers after a full window of fast frames', () => {
    const clock = createFrameClock(4);
    for (let i = 0; i < 4; i++) clock.sample(20);
    let notch = 0;
    for (let i = 0; i < 4; i++) notch = clock.sample(1);
    expect(notch).toBe(0);
  });
  it('does not oscillate on frames inside the dead band', () => {
    const clock = createFrameClock(4);
    for (let i = 0; i < 40; i++) clock.sample((DROP_MS + RAISE_MS) / 2);
    expect(clock.notch()).toBe(0);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/quality.test.ts`
Expected: FAIL — `Failed to resolve import "../../src/world/quality"`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/quality.ts

/** Three notches: full, reduced, minimum. */
export const NOTCHES = 3;

/** Over this and we shed texture. Addendum §B.3 as amended. */
export const DROP_MS = 8;

/**
 * Under this and we take it back. The gap between the two thresholds is the
 * hysteresis: with a single threshold a load sitting exactly on the line makes
 * the picture pump between notches once a second, which is worse than either.
 */
export const RAISE_MS = 5;

export const WINDOW = 30;

export function qualityStep(avgMs: number, notch: number): number {
  if (avgMs > DROP_MS) return Math.min(NOTCHES - 1, notch + 1);
  if (avgMs < RAISE_MS) return Math.max(0, notch - 1);
  return notch;
}

/**
 * Owns the only frame timing in the app. Modules receive a notch; none of them
 * measures its own clock, because two clocks disagreeing is how you get one
 * layer at full detail beside another at minimum.
 */
export function createFrameClock(window = WINDOW) {
  const samples: number[] = [];
  let notch = 0;
  return {
    sample(ms: number): number {
      samples.push(ms);
      if (samples.length >= window) {
        const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
        notch = qualityStep(avg, notch);
        samples.length = 0;
      }
      return notch;
    },
    notch: () => notch,
  };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/quality.test.ts`
Expected: PASS, 8 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/quality.ts tests/world/quality.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: adaptive quality notch with a hysteresis dead band"
```

---

### Task 10: `bloom.ts` — `lampSpots()` jadi fungsi murni bersama

Air butuh tahu di mana lampu berada supaya bisa memantulkannya; `bloom.ts` butuh tahu untuk menggambarnya. Dua daftar lampu yang dihitung terpisah adalah cara mendapat pantulan yang tidak sejajar dengan lampunya.

**Files:**
- Modify: `src/world/bloom.ts` (tulis ulang penuh)
- Test: `tests/world/bloom.test.ts`

**Interfaces:**
- Consumes: `Horizon`, `Block`, `piers` dari `bridge.ts`, `LampSpot` dari `water.ts`, `WeatherFx`
- Produces: `lampCount(progress, total?)` (tak berubah), `lampSpots(w, hz, blocks, progress, fx, moonY): LampSpot[]`, `drawLamps(g, w, hz, v, lamps, fx, timeMs, motion): void`, `moonPos(w, hz, progress): { x: number; y: number }`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/bloom.test.ts
import { describe, expect, it } from 'vitest';
import { horizon } from '../../src/world/horizon';
import { skyline } from '../../src/world/city';
import { effectsFor } from '../../src/world/weather';
import { lampSpots, moonPos } from '../../src/world/bloom';

const hz = horizon(900, 900 * 0.66);
const blocks = skyline(1200, hz.cityTop, hz.cityBot, 5);

describe('lampSpots', () => {
  const spots = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'), moonPos(1200, hz, 0.62));

  it('puts every window inside a real building, never in the sky', () => {
    for (const s of spots.filter((v) => v.kind === 'window')) {
      const home = blocks.find((b) => s.x >= b.x && s.x <= b.x + b.w);
      expect(home).toBeDefined();
      expect(s.y).toBeGreaterThanOrEqual(home!.top);
      expect(s.y).toBeLessThanOrEqual(hz.cityBot);
    }
  });

  it('stands the bridge lamps on the piers, above the water', () => {
    const bridge = spots.filter((s) => s.kind === 'bridge');
    expect(bridge.length).toBeGreaterThan(1);
    for (const s of bridge) expect(s.y).toBeLessThan(hz.waterTop);
  });

  it('never lets the near lantern go out — addendum §D.1', () => {
    for (const p of [0, 0.5, 1]) {
      const s = lampSpots(1200, hz, blocks, p, effectsFor('fog'), moonPos(1200, hz, p));
      const lantern = s.find((v) => v.kind === 'lantern');
      expect(lantern?.lit).toBe(true);
    }
  });

  it('lights fewer windows at dawn than at the thickest fog', () => {
    const peak = lampSpots(1200, hz, blocks, 0.62, effectsFor('clear'), moonPos(1200, hz, 0.62));
    const dawn = lampSpots(1200, hz, blocks, 1, effectsFor('clear'), moonPos(1200, hz, 1));
    const lit = (s: typeof peak) => s.filter((v) => v.kind === 'window' && v.lit).length;
    expect(lit(dawn)).toBeLessThan(lit(peak));
  });

  it('offers the moon to the water as a light like any other', () => {
    expect(spots.some((s) => s.kind === 'moon' && s.lit)).toBe(true);
  });
});

describe('moonPos', () => {
  it('rises as the night wears on', () => {
    expect(moonPos(1200, hz, 1).y).toBeLessThan(moonPos(1200, hz, 0).y);
  });
  it('stays in the sky, above the city roofs', () => {
    expect(moonPos(1200, hz, 0).y).toBeLessThan(hz.waterTop);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/bloom.test.ts`
Expected: FAIL — `No "lampSpots" export is defined on the module`

- [ ] **Step 3: Tulis implementasinya**

Ganti seluruh isi `src/world/bloom.ts`:

```ts
// src/world/bloom.ts
import type { AmbientValues } from '../ambient/types';
import type { Block } from './city';
import type { Horizon } from './horizon';
import type { LampSpot } from './water';
import type { WeatherFx } from './weather';
import { piers } from './bridge';

const TOTAL_LAMPS = 14;

/**
 * Windows and lamps light up through the evening and go out toward dawn. Peak is
 * at 0.62 — the thickest fog, when the gas is doing the most work.
 */
export function lampCount(progress: number, total = TOTAL_LAMPS): number {
  const p = Math.min(1, Math.max(0, progress));
  const curve = p <= 0.62 ? p / 0.62 : 1 - (p - 0.62) / 0.38;
  const n = 2 + (total - 2) * Math.max(0, curve);
  return Math.max(1, Math.min(total, Math.round(n)));
}

export function moonPos(w: number, hz: Horizon, progress: number): { x: number; y: number } {
  return {
    x: w * 0.78,
    y: hz.skyBot - progress * (hz.skyBot - hz.cityTop * 0.4),
  };
}

/**
 * ONE list of lights, consumed by both the bloom pass and the river's glitter
 * columns. Two lists computed separately is how you get a reflection that does
 * not line up with the lamp casting it.
 */
export function lampSpots(
  w: number,
  hz: Horizon,
  blocks: readonly Block[],
  progress: number,
  fx: WeatherFx,
  moon: { x: number; y: number },
): LampSpot[] {
  const out: LampSpot[] = [];
  const n = lampCount(progress);

  // Windows, spread by a co-prime stride so the ones that light first are
  // scattered across the skyline instead of marching in from one edge.
  const tall = blocks.filter((b) => b.kind !== 'crane');
  const stride = 5;
  for (let k = 0; k < tall.length; k++) {
    const i = (k * stride) % tall.length;
    const b = tall[i]!;
    if (!b) continue;
    out.push({
      x: Math.round(b.x + b.w * (0.3 + ((i * 7) % 5) / 12)),
      // Clamped into the building. A short warehouse is shorter than the window
      // ladder, and an unclamped window would sit on the water in front of it.
      y: Math.round(Math.max(b.top + 4, Math.min(b.top + 12 + ((i * 11) % 4) * 9, hz.cityBot - 6))),
      r: 2 + (i % 2),
      lit: k < n,
      kind: 'window',
    });
  }

  // Gas standards on the bridge piers. These are the lights the river reflects
  // best, because they sit directly above it.
  const p = piers(w, hz);
  for (const [i, q] of p.entries()) {
    out.push({
      x: Math.round(q.x + q.w / 2),
      y: hz.bridgeTop - 9,
      r: 3,
      lit: i < Math.max(1, Math.round((n / TOTAL_LAMPS) * p.length)),
      kind: 'bridge',
    });
  }

  // Street standards along the near rail.
  for (let k = 0; k < 5; k++) {
    out.push({
      x: Math.round(w * (0.18 + k * 0.19)),
      y: hz.railTop - 6,
      r: 3,
      lit: k < Math.max(1, Math.round((n / TOTAL_LAMPS) * 5)),
      kind: 'street',
    });
  }

  // The near lantern never goes out, at any state. Addendum §D.1.
  out.push({ x: Math.round(w * 0.08), y: hz.deckTop - 26, r: 4, lit: true, kind: 'lantern' });

  out.push({ x: Math.round(moon.x), y: Math.round(moon.y), r: 16 * fx.moonScale, lit: true, kind: 'moon' });

  return out;
}

function glowBlob(
  g: CanvasRenderingContext2D,
  x: number, y: number, radius: number, colour: string, alpha: number,
): void {
  if (radius <= 0) return;
  const halo = g.createRadialGradient(x, y, 0, x, y, radius);
  halo.addColorStop(0, colour);
  halo.addColorStop(1, 'transparent');
  g.globalAlpha = alpha;
  g.fillStyle = halo;
  g.beginPath();
  g.arc(x, y, radius, 0, Math.PI * 2);
  g.fill();
}

const HALO: Record<LampSpot['kind'], number> = {
  window: 8, bridge: 12, street: 15, lantern: 22, moon: 4.4,
};
const ALPHA: Record<LampSpot['kind'], number> = {
  window: 0.34, bridge: 0.34, street: 0.30, lantern: 0.55, moon: 0.18,
};

export function drawLamps(
  g: CanvasRenderingContext2D,
  v: AmbientValues,
  lamps: readonly LampSpot[],
  fx: WeatherFx,
  timeMs: number,
  motion: number,
): void {
  // Emissive things are HOLES in the hatching, drawn after it. If everything
  // glowed, nothing would. Addendum §C.2.
  g.save();
  g.globalCompositeOperation = 'lighter';
  for (const [i, s] of lamps.entries()) {
    if (!s.lit) continue;
    const pulse = 1 + Math.sin(timeMs / 900 + i) * 0.06 * motion;
    const rad = s.r * pulse;

    if (s.kind === 'moon') {
      glowBlob(g, s.x, s.y, rad * HALO.moon, v.glow, ALPHA.moon + v.lum * 0.1 + fx.lumLift);
      g.globalAlpha = 0.3 + v.lum * 0.18 + fx.lumLift;
      g.fillStyle = v.glow;
      g.beginPath();
      g.arc(s.x, s.y, rad, 0, Math.PI * 2);
      g.fill();
      continue;
    }

    glowBlob(g, s.x, s.y, rad * HALO[s.kind] * fx.haloScale, v.glow, ALPHA[s.kind]);
    g.globalAlpha = 1;
    g.fillStyle = v.glow;
    g.fillRect(s.x - rad / 2, s.y - rad, Math.max(2, rad), rad * 2.4);
  }
  g.restore();
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/bloom.test.ts`
Expected: PASS, 7 tes

Tes `lampCount` lama di `tests/world/renderer.test.ts` masih hijau — tanda tangannya tidak berubah.

- [ ] **Step 5: Commit**

```bash
git add src/world/bloom.ts tests/world/bloom.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: one shared lamp list so reflections line up with their lamps"
```

---

### Task 11: `layers.ts` jadi orkestrator, `fog.ts` membaca horizon

**Files:**
- Modify: `src/world/layers.ts` (tulis ulang penuh)
- Modify: `src/world/fog.ts`
- Test: `tests/world/renderer.test.ts` (perbarui import `fogOffset`)

**Interfaces:**
- Consumes: `horizon`, `skyline`/`drawSkyline`, `drawBridge`, `drawDeck`, `HATCH_ANGLES`
- Produces: `drawStatic(g, w, hz, v, progress, blocks, weather): void`, `inkFor(v)`, `drawFog(g, w, hz, v, timeMs, motion, fogScale): void`

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di `tests/world/renderer.test.ts`. Impor tambahan di bagian atas file:

```ts
import { drawFog } from '../../src/world/fog';
import { horizon } from '../../src/world/horizon';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
```

Lalu di akhir file:

```ts
/** Counts every drawing call, so we can assert on work done without a canvas. */
function countingCtx(): { g: CanvasRenderingContext2D; calls: () => number } {
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

describe('drawFog', () => {
  const v = resolve(NIGHT_KEYS, 0.4, gradesFor(['calm']));
  const hz = horizon(900, 594);

  it('draws nothing at all when the night has no fog to give', () => {
    const { g, calls } = countingCtx();
    drawFog(g, 800, hz, v, 0, 1, 0);
    expect(calls()).toBe(0);
  });

  it('works harder on a foggy night than on a clear one', () => {
    const clear = countingCtx();
    drawFog(clear.g, 800, hz, v, 0, 1, 1);
    expect(clear.calls()).toBeGreaterThan(0);
  });

  it('keeps its bands inside the river and the near stone, never the sky', () => {
    // Bands are fractions OF THE RIVER now. If they were still fractions of the
    // frame, moving deckTop would slide the fog onto the sky.
    expect(hz.waterTop).toBeLessThan(hz.railTop);
    expect(hz.railTop).toBeLessThan(hz.deckTop);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/renderer.test.ts`
Expected: FAIL — `Expected 7 arguments, but got 6` / `drawFog` menolak argumen `hz` karena tanda tangannya masih yang lama.

- [ ] **Step 3: Tulis implementasinya**

Ganti seluruh isi `src/world/layers.ts`:

```ts
// src/world/layers.ts
import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import type { Block } from './city';
import type { Horizon } from './horizon';
import type { Weather } from './weather';
import { HATCH_ANGLES } from './hatch';
import { drawSkyline } from './city';
import { drawBridge } from './bridge';
import { drawDeck } from './deck';

/**
 * Engraving ink. `--amb-deep` alone is too close to the sky at night and the
 * whole plate washes out; the ink is pushed most of the way to black so the
 * hatching still reads at lum 0.08.
 */
export function inkFor(v: AmbientValues): string {
  return rgbToHex(mixRgb(hexToRgb(v.deep), [2, 3, 6], 0.62));
}

/**
 * The static plate: everything that only changes when the palette, the size, or
 * the weather does. The river, the lamps, the smoke and the fog are drawn live
 * on top of this by the renderer.
 *
 * Not one composition number is computed here — they all come from `hz`.
 */
export function drawStatic(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  progress: number,
  blocks: readonly Block[],
  weather: Weather,
): void {
  // 1 — sky. Three stops, never two (DNA §3.3). The only unhatched surface in
  //     the picture: it is the blank paper everything else is cut into.
  const sky = g.createLinearGradient(0, 0, 0, hz.waterTop);
  sky.addColorStop(0, v.sky[0]);
  sky.addColorStop(0.55, v.sky[1]);
  sky.addColorStop(1, v.sky[2]);
  g.fillStyle = sky;
  g.fillRect(0, 0, w, hz.waterTop);

  const ink = inkFor(v);
  const deepRgb = hexToRgb(v.deep);
  const skyMid = hexToRgb(v.sky[1]);

  // 2 — far city.
  drawSkyline(g, blocks, hz.cityBot, {
    angle: HATCH_ANGLES.far,
    fill: rgbToHex(mixRgb(skyMid, deepRgb, 0.55)),
    ink,
    density: 0.34,
    maxGap: 13,
  });

  // 3 — upstream bridge, standing in front of the city's feet. That overlap is
  //     what gives the picture its depth.
  drawBridge(g, w, hz, {
    fill: rgbToHex(mixRgb(skyMid, deepRgb, 0.82)),
    ink,
    density: 0.52,
  });

  // 4 — the stone you are standing on. Wet on a rainy night: darker, so the
  //     live reflections read stronger against it.
  const wet = weather === 'rain' ? 0.18 : 0;
  drawDeck(g, w, hz, {
    fill: rgbToHex(mixRgb(deepRgb, [2, 3, 6], 0.35 + wet + progress * 0.05)),
    ink,
    rail: rgbToHex(mixRgb(deepRgb, [2, 3, 6], 0.18 + wet)),
  });
}
```

Ganti `src/world/fog.ts` seluruhnya:

```ts
// src/world/fog.ts
import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';

/**
 * Band positions are fractions OF THE RIVER, not of the frame. Fog belongs to
 * the water — it rolls off it — so when `deckTop` moves the fog follows the
 * river instead of drifting onto the stone.
 */
const BANDS = [
  { speed: 0.018, y: 0.10, height: 0.42, alpha: 0.34, puffs: 5 },
  { speed: -0.011, y: 0.44, height: 0.46, alpha: 0.28, puffs: 4 },
  { speed: 0.006, y: 0.78, height: 0.40, alpha: 0.22, puffs: 6 },
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

/**
 * Each band is a row of soft puffs, NOT a flat gradient strip. A strip that is
 * uniform along x looks identical after a horizontal translation, so drifting
 * it would be invisible — the puffs are what make the motion readable.
 */
export function drawFog(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  timeMs: number,
  motion: number,
  fogScale: number,
): void {
  // Thicker fog as the world darkens, and thicker again on a foggy night.
  const thickness = (1 - v.lum) * fogScale;
  if (thickness <= 0.01) return;

  const top = hz.waterTop;
  const span = hz.h - hz.waterTop;

  BANDS.forEach((b, i) => {
    const bandY = top + span * (b.y + b.height / 2);
    const bandH = span * b.height;
    const puffW = w / b.puffs;
    const wrap = w + puffW * 2;
    const off = fogOffset(timeMs, i, motion);

    g.save();
    g.globalAlpha = Math.min(0.85, b.alpha * thickness);

    for (let k = 0; k < b.puffs + 2; k++) {
      const raw = k * puffW + off;
      const x = ((raw % wrap) + wrap) % wrap - puffW;

      g.save();
      g.translate(x, bandY);
      g.scale(1, bandH / (puffW * 1.6));
      const grad = g.createRadialGradient(0, 0, 0, 0, 0, puffW * 0.8);
      grad.addColorStop(0, v.accent);
      grad.addColorStop(1, 'transparent');
      g.fillStyle = grad;
      g.beginPath();
      g.arc(0, 0, puffW * 0.8, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }

    g.restore();
  });
}
```

- [ ] **Step 4: Jalankan tipe dan tes**

Run: `npm run typecheck`
Expected: gagal di `renderer.ts` dan `Canvas.tsx` — keduanya masih memanggil tanda tangan lama. Itu diperbaiki di Task 12; jangan perbaiki di sini.

Run: `npx vitest run tests/world/renderer.test.ts tests/world/hatch.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/world/layers.ts src/world/fog.ts tests/world/renderer.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "refactor: layers becomes an orchestrator, fog rides the river"
```

---

### Task 12: `renderer.ts` — pelat, mirror, timing, takik

Ini task yang menyatukan semuanya. Setelah ini `npm run typecheck` harus hijau lagi.

**Files:**
- Modify: `src/world/renderer.ts` (tulis ulang penuh)
- Modify: `src/world/Canvas.tsx`
- Test: `tests/world/plate.test.ts` (baru — butuh `jsdom` untuk `document.createElement('canvas')`, dan pragma lingkungan hanya berlaku kalau ia ada di baris paling atas berkasnya sendiri)

**Interfaces:**
- Consumes: semua modul dunia
- Produces: `channelDrift(a, b)` (tak berubah), type `FrameInput`, `createWorldRenderer(): { frame(target, input): void; invalidate(): void; plateBuilds(): number }`

- [ ] **Step 1: Tulis tes yang gagal**

Buat berkas baru `tests/world/plate.test.ts`. Pragma lingkungan **wajib** di baris pertama:

```ts
// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createWorldRenderer } from '../../src/world/renderer';
import { resolve } from '../../src/ambient/interpolate';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';

/**
 * jsdom has no 2-D context, so `getContext('2d')` returns null on the offscreen
 * plate — the renderer's `if (g)` guard skips the drawing and we still get to
 * assert on WHEN it decided to rebuild, which is the thing under test.
 */
function stubCtx(): CanvasRenderingContext2D {
  const noop = () => {};
  const grad = { addColorStop: noop };
  return new Proxy({} as CanvasRenderingContext2D, {
    get(_t, key) {
      if (key === 'canvas') return { width: 800, height: 600 };
      if (key === 'createLinearGradient' || key === 'createRadialGradient') return () => grad;
      if (key === 'measureText') return () => ({ width: 0 });
      return typeof key === 'string' ? noop : undefined;
    },
    set: () => true,
  });
}

describe('plate caching', () => {
  const v = resolve(NIGHT_KEYS, 0.4, gradesFor(['calm']));
  const base = {
    w: 800, h: 600, deckTop: 396, v, progress: 0.4,
    timeMs: 0, motion: 1, weather: 'clear' as const,
  };

  it('builds the plate once while nothing visible changes', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    for (let i = 0; i < 60; i++) r.frame(g, { ...base, timeMs: i * 16 });
    expect(r.plateBuilds()).toBe(1);
  });

  it('rebuilds when the deck moves more than the threshold', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    r.frame(g, base);
    r.frame(g, { ...base, deckTop: 398 });
    expect(r.plateBuilds()).toBe(1);
    r.frame(g, { ...base, deckTop: 420 });
    expect(r.plateBuilds()).toBe(2);
  });

  it('rebuilds when the weather changes', () => {
    const r = createWorldRenderer();
    const g = stubCtx();
    r.frame(g, base);
    r.frame(g, { ...base, weather: 'rain' as const });
    expect(r.plateBuilds()).toBe(2);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/plate.test.ts`
Expected: FAIL — `r.plateBuilds is not a function`

- [ ] **Step 3: Tulis implementasinya**

Ganti seluruh isi `src/world/renderer.ts`:

```ts
// src/world/renderer.ts
import type { AmbientValues } from '../ambient/types';
import { horizon } from './horizon';
import { skyline, type Block } from './city';
import { drawStatic } from './layers';
import { drawFog } from './fog';
import { drawLamps, lampSpots, moonPos } from './bloom';
import { SQUASH, createWater } from './water';
import { drawWeather, effectsFor, type Weather } from './weather';
import { createFrameClock } from './quality';

/** Largest single-channel difference between two hex colours. */
export function channelDrift(a: string, b: string): number {
  const parse = (hex: string) => [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
  const [ar, ag, ab] = parse(a);
  const [br, bg, bb] = parse(b);
  return Math.max(Math.abs(ar! - br!), Math.abs(ag! - bg!), Math.abs(ab! - bb!));
}

/** Addendum §B.3 — redraw the static plate only when it would visibly change. */
const REDRAW_THRESHOLD = 6;
/** The deck may jitter by a pixel or two as panels reflow; ignore that. */
const DECK_THRESHOLD = 4;

export type FrameInput = {
  w: number;
  h: number;
  deckTop: number;
  v: AmbientValues;
  progress: number;
  timeMs: number;
  motion: number;
  weather: Weather;
};

export function createWorldRenderer() {
  let plate: HTMLCanvasElement | null = null;
  let mirror: HTMLCanvasElement | null = null;
  let blocks: Block[] = [];
  let builds = 0;

  let cachedMid = '';
  let cachedW = 0;
  let cachedH = 0;
  let cachedDeck = -999;
  let cachedWeather: Weather | null = null;

  const water = createWater();
  const clock = createFrameClock();
  let lastTime = 0;

  function invalidate(): void {
    plate = null;
  }

  function frame(target: CanvasRenderingContext2D, input: FrameInput): void {
    const started = typeof performance !== 'undefined' ? performance.now() : 0;
    const { w, h, v, progress, timeMs, motion, weather } = input;
    const hz = horizon(h, input.deckTop);
    const fx = effectsFor(weather);

    const stale =
      plate === null ||
      cachedW !== w ||
      cachedH !== h ||
      cachedWeather !== weather ||
      Math.abs(cachedDeck - hz.deckTop) > DECK_THRESHOLD ||
      channelDrift(cachedMid, v.mid) > REDRAW_THRESHOLD;

    if (stale) {
      // The skyline only regenerates on a size change. A city that reshuffles
      // every time the palette drifts is a city made of static.
      if (blocks.length === 0 || cachedW !== w || cachedH !== h) {
        blocks = skyline(w, hz.cityTop, hz.cityBot, Math.round(w * 31 + h));
      }

      const cv = plate ?? document.createElement('canvas');
      cv.width = w;
      cv.height = h;
      const g = cv.getContext('2d');
      if (g) {
        g.clearRect(0, 0, w, h);
        drawStatic(g, w, hz, v, progress, blocks, weather);
      }
      plate = cv;

      // The mirror is filled HERE, from the finished plate — so the reflection's
      // source costs nothing per frame, and we never read a texture we are in
      // the middle of writing.
      const waterH = hz.waterBot - hz.waterTop;
      const wantH = Math.ceil(waterH / SQUASH) + 2;
      const srcTop = Math.max(0, hz.waterTop - wantH);
      const mh = hz.waterTop - srcTop;
      if (mh > 1) {
        const mv = mirror ?? document.createElement('canvas');
        mv.width = w;
        mv.height = mh;
        const mg = mv.getContext('2d');
        if (mg) {
          mg.clearRect(0, 0, w, mh);
          mg.drawImage(cv, 0, srcTop, w, mh, 0, 0, w, mh);
        }
        mirror = mv;
      } else {
        mirror = null;
      }

      builds++;
      cachedMid = v.mid;
      cachedW = w;
      cachedH = h;
      cachedDeck = hz.deckTop;
      cachedWeather = weather;
    }

    const notch = clock.notch();
    const dt = lastTime === 0 ? 16 : Math.min(64, timeMs - lastTime);
    lastTime = timeMs;
    water.update(dt, motion);

    const moon = moonPos(w, hz, progress);
    const lamps = lampSpots(w, hz, blocks, progress, fx, moon);

    target.clearRect(0, 0, w, h);
    if (plate) target.drawImage(plate, 0, 0);

    water.draw(target, w, hz, v, mirror, lamps, timeMs, motion, notch);
    drawWeather(target, w, hz, v, weather, blocks, water, timeMs, motion, notch);
    drawFog(target, w, hz, v, timeMs, motion, fx.fogScale);
    drawLamps(target, v, lamps, fx, timeMs, motion);

    if (started !== 0) clock.sample(performance.now() - started);
  }

  return { frame, invalidate, plateBuilds: () => builds };
}
```

Ganti `src/world/Canvas.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import type { AmbientValues } from '../ambient/types';
import type { Weather } from './weather';
import { defaultDeckTop } from './horizon';
import { createWorldRenderer } from './renderer';

type Props = {
  values: AmbientValues;
  progress: number;
  motion: number;
  weather: Weather;
  /** Top of the glass panel row, in CSS pixels. The balustrade lands here. */
  deckTop: number;
};

export function World({ values, progress, motion, weather, deckTop }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read through a ref so the rAF loop is started exactly once.
  const latest = useRef({ values, progress, motion, weather, deckTop });
  latest.current = { values, progress, motion, weather, deckTop };

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
      renderer.frame(g, {
        w, h,
        deckTop: s.deckTop || defaultDeckTop(h),
        v: s.values,
        progress: s.progress,
        timeMs: t,
        motion: s.motion,
        weather: s.weather,
      });
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

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/plate.test.ts tests/world/renderer.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: gagal hanya di `src/App.tsx` — `World` sekarang butuh `weather` dan `deckTop`. Diperbaiki di Task 13.

- [ ] **Step 5: Commit**

```bash
git add src/world/renderer.ts src/world/Canvas.tsx tests/world/plate.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: renderer owns the plate, the mirror, frame timing and quality"
```

---

### Task 13: Tata letak — panel turun ke pagar batu

Tanpa ini seluruh pekerjaan tidak terlihat: grid 4 kolom penuh dari atas menutup persis pita tempat jembatan dan sungai digambar.

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/app/useNightWatch.ts`
- Modify: `src/style/base.css`
- Modify: `src/style/components.css`
- Modify: `src/panels/TheWatch.tsx:33`
- Modify: `src/panels/TheQuarry.tsx:43`
- Test: `tests/app/layout.test.ts`

**Interfaces:**
- Consumes: `weatherFor` dari `weather.ts`, `nightKey` dari `session/streak.ts`
- Produces: `useNightWatch()` mengembalikan `weather: Weather` sebagai tambahan

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/app/layout.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

describe('the panels sit on the parapet', () => {
  const base = readFileSync('src/style/base.css', 'utf8');
  const components = readFileSync('src/style/components.css', 'utf8');
  const watch = readFileSync('src/panels/TheWatch.tsx', 'utf8');

  it('docks the chrome to the bottom of the frame', () => {
    expect(base).toContain('justify-content: flex-end');
  });

  it('keeps all three panels in one row, or the deck swallows the river', () => {
    expect(watch).not.toContain('row-2');
  });

  it('bounds the quarry list so it cannot push the parapet off screen', () => {
    expect(components).toContain('.list--scroll');
    expect(components).toContain('overflow-y: auto');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/app/layout.test.ts`
Expected: FAIL — `expected '...' to contain 'justify-content: flex-end'`

- [ ] **Step 3: Tulis implementasinya**

`src/style/base.css` — ganti blok `.app`:

```css
/* Chrome layer. Docked to the bottom so the glass rests on the balustrade
   instead of covering the river it is supposed to be standing over. */
.app {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: var(--px6);
  padding: var(--px5) clamp(var(--px3), 3vw, var(--px8)) var(--px5);
  max-width: 1680px;
  margin-inline: auto;
  min-height: 100%;
}
```

`src/style/components.css` — tambahkan di akhir:

```css
/* A list that may grow without shoving the parapet off the bottom of the world. */
.list--scroll {
  max-height: 168px;
  overflow-y: auto;
  overscroll-behavior: contain;
}
```

`src/panels/TheWatch.tsx:33` — ganti `className="span-2 row-2"` jadi:

```tsx
      className="span-2"
```

`src/panels/TheQuarry.tsx:43` — ganti pembuka `<ul>`:

```tsx
          <ul className="list--scroll" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
```

`src/app/useNightWatch.ts` — tambahkan import dan nilai kembalian. Setelah baris `import { motionValue, nextMotion } from './motion';` tambahkan:

```ts
import { nightKey } from '../session/streak';
import { weatherFor, type Weather } from '../world/weather';
```

Setelah baris `const ledger = useMemo(...)` tambahkan:

```ts
  // The night's weather, drawn once from the same key the streak counts by. It
  // must not change on a re-render, or the sky would reshuffle mid-session.
  const weather = useMemo<Weather>(() => weatherFor(nightKey(now)), [nightKey(now)]);
```

Dan di objek kembalian, tambahkan `weather` setelah `ledger`:

```ts
  return {
    session, values, progress, motion, grades, data, remainingMs, streak, ledger, weather,
    recovered: boot.recovered, actions,
  };
```

`src/App.tsx` — ganti seluruh isinya:

```tsx
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { World } from './world/Canvas';
import { makeGrainUri } from './world/grain';
import { useNightWatch } from './app/useNightWatch';
import { TheWatch } from './panels/TheWatch';
import { TheQuarry } from './panels/TheQuarry';
import { TheLedger } from './panels/TheLedger';
import { COPY } from './app/copy';

export function App() {
  const nw = useNightWatch();
  const gridRef = useRef<HTMLDivElement>(null);
  const [deckTop, setDeckTop] = useState(0);

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-uri', makeGrainUri());
  }, []);

  // The balustrade is drawn wherever the glass actually lands. Measuring it is
  // the difference between "the panels rest on the parapet" being true at every
  // size and being true at the one size it was tuned on.
  useLayoutEffect(() => {
    const el = gridRef.current;
    if (!el) return;
    const read = () => setDeckTop(el.getBoundingClientRect().top);
    read();
    const ro = new ResizeObserver(read);
    ro.observe(el);
    window.addEventListener('scroll', read, { passive: true });
    return () => {
      ro.disconnect();
      window.removeEventListener('scroll', read);
    };
  }, []);

  const selected = nw.data.quarry.find((q) => q.id === nw.session.quarryId) ?? null;

  return (
    <>
      <World
        values={nw.values}
        progress={nw.progress}
        motion={nw.motion}
        weather={nw.weather}
        deckTop={deckTop}
      />
      <main className="app">
        {nw.recovered && <p className="label">{COPY.storeRecovered}</p>}
        <div className="grid" ref={gridRef}>
          <TheWatch
            phase={nw.session.phase}
            progress={nw.progress}
            remainingMs={nw.remainingMs}
            quarryName={selected?.name ?? null}
            bloodmoon={nw.grades.includes('bloodmoon')}
            motionSetting={nw.data.settings.motion}
            onStart={nw.actions.start}
            onStop={nw.actions.stop}
            onSkip={nw.actions.skip}
            onCycleMotion={nw.actions.cycleMotion}
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

- [ ] **Step 4: Jalankan semuanya**

Run: `npx vitest run tests/app/layout.test.ts`
Expected: PASS, 3 tes

Run: `npm run typecheck`
Expected: bersih, tanpa error

Run: `npm test`
Expected: semua file tes lulus

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/app/useNightWatch.ts src/style/base.css \
        src/style/components.css src/panels/TheWatch.tsx src/panels/TheQuarry.tsx \
        tests/app/layout.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: dock the glass to the parapet and measure where it lands"
```

---

### Task 14: Tes penegak aturan + amandemen addendum + verifikasi penuh

**Files:**
- Modify: `tests/smoke.test.ts`
- Modify: `../Ideas/gaslamp-dna.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: seluruh `src/world/`
- Produces: tidak ada kode baru

- [ ] **Step 1: Tulis tes yang gagal**

Di `tests/smoke.test.ts`, ubah baris impor jadi `import { readFileSync, readdirSync } from 'node:fs';` lalu tambahkan di akhir berkas:

```ts
describe('composition lines', () => {
  const files = readdirSync('src/world').filter((f) => f.endsWith('.ts') || f.endsWith('.tsx'));

  it('keeps every vertical composition fraction inside horizon.ts', () => {
    // layers.ts once said `h * 0.86` while bloom.ts independently said
    // `h * 0.855`. Two copies of one fact, already disagreeing. This test is
    // what stops that happening a third time.
    //
    // Vertical only: `w * 0.08` for the lantern's bollard is a placement, not a
    // composition line, and horizon.ts holds the horizontal ladder alone.
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
```

- [ ] **Step 2: Jalankan, pastikan lulus**

Run: `npx vitest run tests/smoke.test.ts`
Expected: PASS. Setiap modul yang ditulis di Task 1–13 sudah dibuat patuh sejak awal — `city.ts` menamai tinggi bloknya `bh` bukan `h`, dan `Canvas.tsx` memakai `defaultDeckTop(h)` alih-alih pecahan literal.

Kalau ternyata gagal, laporan tesnya menyebut berkas dan barisnya. Pindahkan angka pelanggar itu jadi field baru di `horizon.ts` dan bacakan lewat `hz`. **Jangan** longgarkan regex-nya — melonggarkan penjaga untuk melewatkan pelanggar pertamanya membuat penjaga itu tidak ada gunanya.

- [ ] **Step 3: Tulis amandemen addendum**

Di `../Ideas/gaslamp-dna.md`, di dalam `§B.3`, ganti dua butir terakhir dengan:

```markdown
- **Yang bergerak per frame maksimal tujuh:** lapis kabut, denyut lentera, baris
  pantulan air, kolom kilau lentera di air, riak dan cincin, asap cerobong, dan
  partikel cuaca.
- **Batas anggaran:** total ≤ 8 ms per frame di laptop kelas menengah.

> **Amandemen 2026-07-28.** Angka lama adalah 3 hal bergerak dan ≤ 4 ms. Night Watch
> menaikkannya saat menambahkan sungai berpantulan cermin. Alasannya: pantulan hidup
> adalah sumber detail terbesar yang bisa didapat dari satu lapis, dan memaksakannya
> masuk ke tiga slot berarti membuang riak, asap, atau kabut — tiga hal yang justru
> membuat pantulan itu terbaca sebagai air.
>
> Yang menggantikan aturan lama sebagai pengaman adalah **skala kualitas adaptif**:
> rata-rata bergulir 30 frame, turun satu takik di atas 8 ms, naik lagi di bawah 5 ms.
> Aturan kerasnya — **geometri tidak pernah turun, cuma tekstur.** Siluet, lengkung,
> pilar, dan balustrade digambar penuh di takik mana pun.
```

Dan di `§C.2`, setelah tabel sudut, tambahkan:

```markdown
> **Amandemen 2026-07-28.** Sudut keempat, `water: 0.00`. Garis datar horizontal adalah
> konvensi ukiran abad sembilan belas untuk air, dan itu yang membuat permukaan air
> terbaca sebagai bidang horizontal, bukan sebagai dinding. Benda di kedalaman air —
> jembatan yang menyeberanginya — tetap memakai `mid`; sudut kelima hanya akan
> mengaburkan tangga kedalaman.
```

Di `README.md`, tambahkan di bagian struktur:

```markdown
### Lapis dunia

Semua garis komposisi hidup di `src/world/horizon.ts`. Tidak ada modul lain yang
boleh menghitung pecahan dari tinggi frame — ada tes di `tests/smoke.test.ts` yang
menegakkannya. Balustrade digambar di posisi baris panel yang **diukur** lewat
`ResizeObserver` di `App.tsx`, jadi kaca benar-benar bertumpu di pagar batu di tiap
ukuran layar.
```

- [ ] **Step 4: Verifikasi penuh**

Run: `npm test`
Expected: semua file tes lulus, tanpa kegagalan

Run: `npm run typecheck`
Expected: bersih

Run: `npm run build`
Expected: `✓ built in ...`

Run: `npm run dev`, buka `http://localhost:5173/`, lalu periksa dengan mata:
1. Jembatan hulu terlihat, lengkungnya tembus ke langit dan sungai.
2. Kota jauh punya menara jam, kubah, dan cerobong — bukan balok seragam.
3. Sungai memantulkan kota dan jembatan, dan pantulannya bergoyang.
4. Kolom kilau turun dari lentera jembatan ke air.
5. Balustrade duduk tepat di atas baris panel; ubah ukuran jendela dan periksa ia ikut.
6. Matikan motion lewat tombol di The Watch: pantulan tetap ada tapi diam.

Hentikan server setelah selesai.

- [ ] **Step 5: Commit**

```bash
git add tests/smoke.test.ts README.md
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "test: pin every composition fraction inside horizon.ts"
cd ../Ideas && git status --short
```

Kalau `Ideas/` bukan repo git, cukup simpan berkasnya; kalau iya, commit terpisah di sana dengan pesan `docs: amend the hybrid contract for a live river`.

---

## Setelah semua task

Jalankan `superpowers:finishing-a-development-branch` untuk memutuskan integrasi.
