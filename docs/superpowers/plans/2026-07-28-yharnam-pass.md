# Yharnam Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bawa lapis dunia NightWatch ke referensi Yharnam: palet teal dingin nyaris monokrom, rentang nilai penuh yang ditegakkan tes, dan empat benda pembingkai hitam pekat di tepi frame.

**Architecture:** Tangga nilai jadi satu fungsi murni di modul sendiri (`ladder.ts`) yang diminum `layers.ts` dan `foreground.ts`, jadi tidak ada modul yang menghitung nilainya sendiri — pola yang sama dengan `horizon.ts` untuk garis dan `lampSpots()` untuk lampu. Tinta pembingkai adalah konstanta tetap yang **tidak pernah** menyentuh `AmbientValues`; itu jangkar nilai seluruh gambar.

**Tech Stack:** Vite 6, React 19, TypeScript 5.7, Vitest 3, Canvas 2D. Tanpa dependensi runtime di luar React.

## Global Constraints

- **Spek acuan:** `docs/superpowers/specs/2026-07-28-yharnam-pass-design.md`. Dibangun di atas `2026-07-28-river-scene-design.md`. Addendum: `../Ideas/gaslamp-dna.md`. Induk: `../Useless Dashboard/DNA.md`.
- **Tidak ada pecahan vertikal (`h * 0.x`) di `src/world/*.ts` selain `horizon.ts`.** Sudah ditegakkan `tests/smoke.test.ts`. Semua batas vertikal vignette adalah field `Horizon` yang sudah ada.
- **Tidak ada literal warna palet di luar `src/style/tokens.css` dan `src/ambient/keyframes.ts`** — kecuali satu: `VIGNETTE_INK` di `src/world/ladder.ts`, yang memang harus tetap dan tidak boleh diturunkan dari ambient.
- **`glow` adalah satu-satunya warna hangat.** Jangan tambahkan warna hangat kedua di mana pun.
- **`motion: 0` membekukan, tidak mengosongkan.**
- **Semua generator deterministik.** Tidak ada `Math.random()` di `src/`.
- **Commit tanpa trailer co-author.** Semua commit memakai:
  `git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" commit -m "..."`
- **Branch:** `feat/yharnam-pass`. Sudah dibuat, spek sudah di-commit di sana.
- **Perintah verifikasi:** `npm test`, `npm run typecheck`, `npm run build`.
- Setiap task berakhir hijau di `npm test` **dan** `npm run typecheck` sebelum commit.
- **Baseline:** 24 file tes, 196 tes, semuanya hijau sebelum task 1.

## Peta File

**Dibuat:**

| file | tanggung jawab |
|---|---|
| `src/world/ladder.ts` | tangga nilai + `VIGNETTE_INK`; satu-satunya tempat nilai kedalaman dihitung |
| `src/world/foreground.ts` | vignette dekat: tiang gerbang, daun gerbang, tiang gas, finial, ranting |

**Diubah:**

| file | perubahan |
|---|---|
| `src/ambient/keyframes.ts` | `NIGHT_KEYS` baru — senja dibuang, malam dimulai dari malam |
| `src/world/layers.ts` | meminum `valueLadder()`; memanggil `drawForeground()` |
| `src/world/bloom.ts` | jangkar lentera dari `foreground.ts`; bulan dibesarkan |
| `src/world/city.ts` | menara lebih tinggi dan kurus; pita kedua di belakang; pengelompokan |
| `src/world/fog.ts` | genangan yang memakan kaki bangunan di `cityBot` |
| `../Ideas/gaslamp-dna.md` | §D ditulis ulang |
| `README.md` | catatan tangga nilai |

---

### Task 1: `ladder.ts` — tangga nilai

Sekarang tiap modul mencampur warnanya sendiri: `layers.ts` memakai `mix(skyMid, deep, 0.55)` untuk kota dan `mix(deep, [2,3,6], 0.35)` untuk dek — dua rumus berbeda dengan dua jangkar berbeda, jadi urutan gelapnya tidak dijamin apa pun. Ini memusatkannya jadi satu tangga yang bisa dites.

**Files:**
- Create: `src/world/ladder.ts`
- Test: `tests/world/ladder.test.ts`

**Interfaces:**
- Consumes: `AmbientValues` dari `src/ambient/types`, `hexToRgb`/`mixRgb`/`rgbToHex` dari `src/ambient/interpolate`
- Produces: `VIGNETTE_INK: '#05080a'`, `LADDER_STOPS`, type `Ladder`, `valueLadder(v: AmbientValues, wet?: number): Ladder`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/ladder.test.ts
import { describe, expect, it } from 'vitest';
import { VIGNETTE_INK, valueLadder } from '../../src/world/ladder';
import { NIGHT_KEYS } from '../../src/ambient/keyframes';
import { gradesFor } from '../../src/ambient/grade';
import { hexToRgb, luminance, resolve } from '../../src/ambient/interpolate';
import type { GradeName } from '../../src/ambient/types';

const COMBOS: readonly (readonly GradeName[])[] = [
  ['calm'], ['pressed'], ['bloodmoon'], ['pressed', 'bloodmoon'],
];

describe('valueLadder', () => {
  it('steps strictly darker from the far city to the frame edge', () => {
    // This is the whole point: Bloodborne is CONTRAST, not darkness. If any two
    // rungs ever swap, the picture loses its depth at that moment.
    for (const key of NIGHT_KEYS) {
      for (const grades of COMBOS) {
        const v = resolve(NIGHT_KEYS, key.at, gradesFor(grades));
        const l = valueLadder(v);
        const lum = (hex: string) => luminance(hexToRgb(hex));
        const where = `at=${key.at} grades=${grades.join('+')}`;
        expect(lum(l.cityFar), where).toBeGreaterThan(lum(l.city));
        expect(lum(l.city), where).toBeGreaterThan(lum(l.bridge));
        expect(lum(l.bridge), where).toBeGreaterThan(lum(l.deck));
        expect(lum(l.deck), where).toBeGreaterThan(lum(l.rail));
        expect(lum(l.rail), where).toBeGreaterThan(lum(l.vignette));
      }
    }
  });

  it('anchors the frame edge to a fixed ink, never to the ambient palette', () => {
    // If the vignette followed ambient it would brighten along WITH the fog,
    // and the contrast would collapse exactly when the picture should be at its
    // most dramatic.
    const seen = new Set<string>();
    for (const key of NIGHT_KEYS) {
      for (const grades of COMBOS) {
        seen.add(valueLadder(resolve(NIGHT_KEYS, key.at, gradesFor(grades))).vignette);
      }
    }
    expect([...seen]).toEqual([VIGNETTE_INK]);
  });

  it('measures every rung against the fog, not against the deep', () => {
    // sky[2] is the brightest thing on screen and the mass everything is cut
    // into, so it is the only sensible anchor for the ladder.
    const bright = resolve(NIGHT_KEYS, 0.62, gradesFor(['calm']));
    const dark = resolve(NIGHT_KEYS, 0.85, gradesFor(['calm']));
    const lum = (hex: string) => luminance(hexToRgb(hex));
    expect(lum(valueLadder(bright).city)).toBeGreaterThan(lum(valueLadder(dark).city));
  });

  it('darkens the stone when it rains, without breaking the ladder', () => {
    const v = resolve(NIGHT_KEYS, 0.35, gradesFor(['calm']));
    const lum = (hex: string) => luminance(hexToRgb(hex));
    expect(lum(valueLadder(v, 0.18).deck)).toBeLessThan(lum(valueLadder(v, 0).deck));
    expect(lum(valueLadder(v, 0.18).deck)).toBeGreaterThan(lum(valueLadder(v, 0.18).rail));
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/ladder.test.ts`
Expected: FAIL — `Cannot find module '../../src/world/ladder'`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/ladder.ts
import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';

/**
 * The frame edge. Fixed, and deliberately NOT derived from the ambient palette.
 *
 * This is the picture's value anchor: as long as the edge of the frame is dead
 * black, the eye reads everything else as having full range. Let it follow
 * ambient and it brightens along WITH the fog — so the contrast collapses at
 * exactly the moment the picture should be at its most dramatic.
 */
export const VIGNETTE_INK = '#05080a';

/**
 * How far each depth is dragged from the fog toward the ink.
 *
 * Every rung measures against `sky[2]`, the fog — the brightest thing on screen
 * and the mass everything else is cut into. Modules used to mix their own way
 * from their own anchors, which guaranteed nothing about the order.
 */
export const LADDER_STOPS = {
  /** The band standing BEHIND the main skyline. Barely pulled from the fog at
   *  all — atmospheric perspective is what tells the eye it is further away. */
  cityFar: 0.24,
  city: 0.45,
  bridge: 0.70,
  deck: 0.88,
  rail: 0.93,
} as const;

export type Ladder = {
  cityFar: string;
  city: string;
  bridge: string;
  deck: string;
  rail: string;
  vignette: string;
};

/** `wet` darkens the near stone on a rainy night. Spec §7 of the river scene. */
export function valueLadder(v: AmbientValues, wet = 0): Ladder {
  const fog = hexToRgb(v.sky[2]);
  const ink = hexToRgb(VIGNETTE_INK);
  const at = (t: number) => rgbToHex(mixRgb(fog, ink, Math.min(0.97, t)));

  return {
    cityFar: at(LADDER_STOPS.cityFar),
    city: at(LADDER_STOPS.city),
    bridge: at(LADDER_STOPS.bridge),
    deck: at(LADDER_STOPS.deck + wet * 0.25),
    rail: at(LADDER_STOPS.rail + wet * 0.2),
    vignette: VIGNETTE_INK,
  };
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/ladder.test.ts`
Expected: PASS, 4 tes

- [ ] **Step 5: Commit**

```bash
git add src/world/ladder.ts tests/world/ladder.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: one value ladder anchored to the fog and a fixed frame ink"
```

---

### Task 2: `keyframes.ts` — malam dimulai dari malam

**Files:**
- Modify: `src/ambient/keyframes.ts` (ganti seluruh `NIGHT_KEYS`)
- Test: `tests/ambient/keyframes.test.ts` (tambah, jangan hapus yang ada)

**Interfaces:**
- Consumes: type `Keyframe`
- Produces: `NIGHT_KEYS` dengan lima keyframe di `at` yang sama seperti sebelumnya

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `tests/ambient/keyframes.test.ts`:

```ts
describe('the night starts at night', () => {
  const key = (at: number) => NIGHT_KEYS.find((k) => k.at === at)!;
  const lum = (hex: string) => luminance(hexToRgb(hex));

  it('has no warm sky anywhere before dawn', () => {
    // Dusk is gone. The app sits at 0.00 whenever it is idle, so the first
    // keyframe is the one people actually look at — it has to be the night.
    for (const k of NIGHT_KEYS.slice(0, -1)) {
      for (const hex of k.sky) {
        const [r, , b] = hexToRgb(hex);
        expect(b, `sky ${hex} at ${k.at}`).toBeGreaterThanOrEqual(r);
      }
    }
  });

  it('ties the fog colour to the horizon, every night key', () => {
    // accent IS the fog now, and the fog is the brightest mass on screen.
    // Dawn keeps its own brass accent.
    for (const k of NIGHT_KEYS.slice(0, -1)) {
      expect(k.accent, `at ${k.at}`).toBe(k.sky[2]);
    }
  });

  it('makes the fog palest at 0.62 — the Yharnam moment', () => {
    for (const at of [0.00, 0.35, 0.85]) {
      expect(lum(key(0.62).accent), `vs at ${at}`).toBeGreaterThan(lum(key(at).accent));
    }
  });

  it('makes the fog thickest at 0.85, which is a different moment', () => {
    // fog.ts computes thickness as (1 - lum), so thickest fog means LOWEST lum.
    // Palest fog and thickest fog are deliberately two separate beats.
    for (const at of [0.00, 0.35, 0.62]) {
      expect(key(0.85).lum).toBeLessThan(key(at).lum);
    }
  });

  it('falls monotonically through the night, then jumps at dawn', () => {
    const night = NIGHT_KEYS.slice(0, -1);
    for (let i = 1; i < night.length; i++) {
      expect(night[i]!.lum).toBeLessThan(night[i - 1]!.lum);
    }
    expect(NIGHT_KEYS[NIGHT_KEYS.length - 1]!.lum)
      .toBeGreaterThan(NIGHT_KEYS[NIGHT_KEYS.length - 2]!.lum);
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/ambient/keyframes.test.ts`
Expected: FAIL pada tes baru. Yang **harus tetap lulus** adalah ketujuh tes lama di berkas ini — mereka tidak pernah mengunci arah `lum` atau kehangatan langit, jadi palet baru tidak melanggarnya. Kalau salah satu tes lama ikut gagal, berhenti dan laporkan: berarti perhitungan di spek §10 keliru dan asumsinya perlu diperiksa ulang sebelum lanjut.

- [ ] **Step 3: Tulis implementasinya**

Ganti seluruh isi `src/ambient/keyframes.ts`:

```ts
import type { Keyframe } from './types';

/**
 * Spec §3.1. Spacing is deliberately uneven — dense between 0.62 and 0.85
 * where the change matters most (DNA §3.3).
 *
 * DUSK IS GONE. The watch begins at night: you are a night watchman, not a
 * sunset watchman. The app sits at 0.00 whenever it is idle, so the first
 * keyframe is the one people actually look at, and it has to be the night.
 *
 * Values that look like mistakes and are not:
 *  - glow BRIGHTENS at 0.62. Thick fog scatters gaslight yellower, not dimmer.
 *  - glow turns COLD at 1.00. Dawn puts the gas out. It is the only cold key
 *    light in the app, and it is the reward for finishing.
 *  - `accent` equals `sky[2]` at every night key. The fog is no longer a dark
 *    veil laid over the world; it is the BRIGHTEST mass in the picture, and the
 *    thing everything else is cut into.
 *  - PALEST fog and THICKEST fog are different moments. `fog.ts` computes
 *    thickness as (1 - lum), so lum still falls monotonically; what peaks at
 *    0.62 is `accent`. 0.62 is the glowing fog, 0.85 is the swallowing fog.
 */
export const NIGHT_KEYS: readonly Keyframe[] = [
  { at: 0.00, sky: ['#16232a', '#2c4348', '#4a6b6b'],
    glow: '#ffb347', accent: '#4a6b6b', lum: 0.30,
    ink: '#ece4d8', inkSoft: '#b3a79c' },
  { at: 0.35, sky: ['#131f26', '#2a4247', '#587a78'],
    glow: '#ffb347', accent: '#587a78', lum: 0.22,
    ink: '#ece4d8', inkSoft: '#a2a5a3' },
  { at: 0.62, sky: ['#101a20', '#2f4a4c', '#6d8f89'],
    glow: '#ffc46b', accent: '#6d8f89', lum: 0.16,
    ink: '#ece4d8', inkSoft: '#9aa5a8' },
  { at: 0.85, sky: ['#0b1216', '#1e3034', '#40595c'],
    glow: '#ffb347', accent: '#40595c', lum: 0.10,
    ink: '#e6ded2', inkSoft: '#95a0a4' },
  { at: 1.00, sky: ['#1b2733', '#33465a', '#7d8a92'],
    glow: '#cfd8dc', accent: '#b08d57', lum: 0.52,
    ink: '#f2ece2', inkSoft: '#aab4b8' },
];
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/ambient/keyframes.test.ts`
Expected: PASS, 12 tes (7 lama + 5 baru)

Run: `npm test`
Expected: seluruh berkas lulus

- [ ] **Step 5: Commit**

```bash
git add src/ambient/keyframes.ts tests/ambient/keyframes.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: the night starts at night — cold keys, fog as the brightest mass"
```

---

### Task 3: `layers.ts` meminum tangga nilai

**Files:**
- Modify: `src/world/layers.ts`
- Test: `tests/world/ladder.test.ts` (tambah)

**Interfaces:**
- Consumes: `valueLadder`, `VIGNETTE_INK` dari `ladder.ts`
- Produces: `drawStatic` tanda tangannya tidak berubah

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `tests/world/ladder.test.ts`:

```ts
import { readFileSync } from 'node:fs';

describe('layers.ts stops mixing its own values', () => {
  const src = readFileSync('src/world/layers.ts', 'utf8');

  it('asks the ladder instead of reaching for deep and sky[1]', () => {
    expect(src).toContain('valueLadder');
  });

  it('leaves no hand-rolled depth mix behind', () => {
    // Two modules mixing their own way from their own anchors is what made the
    // depth order an accident rather than a guarantee.
    expect(src).not.toContain('mixRgb(skyMid');
    expect(src).not.toContain('[2, 3, 6]');
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/ladder.test.ts`
Expected: FAIL — `expected '...' to contain 'valueLadder'`

- [ ] **Step 3: Tulis implementasinya**

Ganti seluruh isi `src/world/layers.ts`:

```ts
import type { AmbientValues } from '../ambient/types';
import { hexToRgb, mixRgb, rgbToHex } from '../ambient/interpolate';
import type { Block } from './city';
import type { Horizon } from './horizon';
import type { Weather } from './weather';
import { HATCH_ANGLES } from './hatch';
import { drawSkyline, skyline } from './city';
import { drawBridge } from './bridge';
import { drawDeck } from './deck';
import { drawForeground } from './foreground';
import { valueLadder } from './ladder';

/**
 * Engraving ink. Pushed most of the way to black so the hatching still reads
 * against the fog, which is now the brightest thing in the picture rather than
 * a dark veil over it.
 */
export function inkFor(v: AmbientValues): string {
  return rgbToHex(mixRgb(hexToRgb(v.sky[2]), [4, 6, 8], 0.82));
}

/**
 * The static plate: everything that only changes when the palette, the size, or
 * the weather does.
 *
 * Not one composition number is computed here — they all come from `hz`. Not one
 * depth value either — they all come from `valueLadder`.
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
  const wet = weather === 'rain' ? 0.18 : 0;
  const ladder = valueLadder(v, wet);

  // 2 — the band BEHIND the skyline. Its own seed, so its towers land between
  //     the near ones rather than behind them, and a much paler fill: the whole
  //     signal of "further away" is that it is closer to the fog's own value.
  //     Generated here rather than in the renderer because nothing outside the
  //     plate ever needs it — only the near band feeds smoke its chimneys.
  const far = skyline(w, hz.cityTop, hz.cityBot, Math.round(w * 17 + hz.h));
  drawSkyline(g, far, hz.cityBot, {
    angle: HATCH_ANGLES.far,
    fill: ladder.cityFar,
    ink,
    density: 0.18,
    maxGap: 17,
  });

  // 3 — far city, veiled by distance.
  drawSkyline(g, blocks, hz.cityBot, {
    angle: HATCH_ANGLES.far,
    fill: ladder.city,
    ink,
    density: 0.34,
    maxGap: 13,
  });

  // 4 — upstream bridge, standing in front of the city's feet. That overlap is
  //     what gives the picture its depth.
  drawBridge(g, w, hz, {
    fill: ladder.bridge,
    ink,
    density: 0.52,
    // Pulled well down toward the stone. At full horizon brightness the voids
    // stop reading as openings and start reading as lamps.
    hazeTop: rgbToHex(mixRgb(hexToRgb(v.sky[2]), hexToRgb(v.mid), 0.58)),
    hazeBot: v.deep,
  });

  // 5 — the stone you are standing on.
  drawDeck(g, w, hz, { fill: ladder.deck, ink, rail: ladder.rail });

  // 6 — the near vignette. Last, nearest, and dead black at every state.
  drawForeground(g, w, hz, ladder.vignette);

  void progress;
}
```

- [ ] **Step 4: Jalankan tipe dan tes**

Run: `npm run typecheck`
Expected: gagal — `Cannot find module './foreground'`. Itu Task 4; jangan perbaiki di sini.

- [ ] **Step 5: Commit**

Task ini tidak bisa berdiri sendiri hijau karena `foreground.ts` belum ada. Jangan commit sekarang — lanjut ke Task 4 dan commit keduanya bersama di Step 5 Task 4.

---

### Task 4: `foreground.ts` — vignette dekat

**Files:**
- Create: `src/world/foreground.ts`
- Test: `tests/world/foreground.test.ts`

**Interfaces:**
- Consumes: `Horizon` dari `horizon.ts`
- Produces: `GATE_X`, `STANDARD_X`, `lanternAnchor(w: number, hz: Horizon): { x: number; y: number }`, `drawForeground(g, w, hz, ink): void`

- [ ] **Step 1: Tulis tes yang gagal**

```ts
// tests/world/foreground.test.ts
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { horizon } from '../../src/world/horizon';
import { GATE_X, STANDARD_X, lanternAnchor } from '../../src/world/foreground';

const hz = horizon(900, 900 * 0.66);

describe('placement', () => {
  it('hugs both edges without leaving the frame', () => {
    expect(GATE_X.left).toBeGreaterThan(0);
    expect(GATE_X.left).toBeLessThan(0.06);
    expect(GATE_X.right).toBeGreaterThan(0.94);
    expect(GATE_X.right).toBeLessThan(1);
  });

  it('stands the gas standard inside the left gate pier, not on top of it', () => {
    expect(STANDARD_X).toBeGreaterThan(GATE_X.left);
    expect(STANDARD_X).toBeLessThan(0.2);
  });

  it('hangs the lantern above the deck and below the bridge', () => {
    const a = lanternAnchor(1440, hz);
    expect(a.y).toBeLessThan(hz.deckTop);
    expect(a.y).toBeGreaterThan(hz.bridgeTop);
  });

  it('reaches the bracket arm inward, so the flame clears the shaft', () => {
    const a = lanternAnchor(1440, hz);
    expect(a.x).toBeGreaterThan(STANDARD_X * 1440);
  });

  it('is deterministic', () => {
    expect(lanternAnchor(1440, hz)).toEqual(lanternAnchor(1440, hz));
  });
});

describe('the vignette never touches the ambient palette', () => {
  const src = readFileSync('src/world/foreground.ts', 'utf8');

  it('takes its ink as an argument and derives nothing', () => {
    expect(src).not.toContain('AmbientValues');
    expect(src).not.toContain('v.sky');
    expect(src).not.toContain('v.deep');
  });

  it('reads every vertical bound off the Horizon, inventing no fractions', () => {
    // tests/smoke.test.ts already forbids `h * 0.x` outside horizon.ts; this
    // states the intent so a reader knows the omission is deliberate.
    for (const line of src.split('\n')) {
      expect(/\bh\s*\*\s*0\.\d/.test(line), line.trim()).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/foreground.test.ts`
Expected: FAIL — `Cannot find module '../../src/world/foreground'`

- [ ] **Step 3: Tulis implementasinya**

```ts
// src/world/foreground.ts
import type { Horizon } from './horizon';

/**
 * The near vignette — the thing the scene was missing.
 *
 * The reference frames its shot with near-black verticals: an ornate iron gas
 * standard, spear-topped railings, stone gate piers. That is what makes a
 * viewer feel they are STANDING somewhere rather than looking at a backdrop.
 * A stack of horizontal bands, however well drawn, never will.
 *
 * Everything here takes its ink as an argument and derives nothing from the
 * ambient palette. See `ladder.ts` for why the frame edge must stay fixed.
 *
 * Horizontal placement is expressed as fractions of WIDTH and owned here.
 * Vertical bounds are always fields of `Horizon` — never a new fraction, which
 * `tests/smoke.test.ts` enforces.
 */
export const GATE_X = { left: 0.038, right: 0.962 } as const;
export const STANDARD_X = 0.105;

/** How far the bracket arm reaches inward from the shaft, in shaft widths. */
const BRACKET_REACH = 3.2;
const SHAFT_W = 9;

/**
 * Where the flame hangs. `bloom.ts` reads this so the never-extinguished lamp
 * (addendum §D.1) lands inside its own glass housing instead of floating beside
 * it — the same one-source rule as `lampSpots()`.
 */
export function lanternAnchor(w: number, hz: Horizon): { x: number; y: number } {
  return {
    x: Math.round(w * STANDARD_X + SHAFT_W * BRACKET_REACH),
    y: Math.round(hz.bridgeTop + (hz.deckTop - hz.bridgeTop) * 0.22),
  };
}

function gatePier(
  g: CanvasRenderingContext2D, cx: number, hz: Horizon,
): void {
  const pw = 26;
  const x = cx - pw / 2;
  // Shaft, from the bottom of the frame to well above the parapet. A pier only
  // as tall as the railing disappears into the railing.
  g.fillRect(x, hz.waterTop, pw, hz.h - hz.waterTop);
  // Plinth, wider at the foot.
  g.fillRect(x - 5, hz.railBot, pw + 10, hz.deckTop - hz.railBot + 6);
  // Cornice and ball cap.
  g.fillRect(x - 4, hz.waterTop + 8, pw + 8, 7);
  g.beginPath();
  g.arc(cx, hz.waterTop + 2, 9, 0, Math.PI * 2);
  g.fill();
}

function gateLeaf(
  g: CanvasRenderingContext2D, fromX: number, dir: 1 | -1, hz: Horizon,
): void {
  // Swung OPEN, flat against the pier. An arched gate would fight the bridge's
  // arches, and two curved framings in one picture weaken each other.
  const bars = 7;
  const pitch = 11;
  const top = hz.railTop;
  const bot = hz.deckTop;
  for (let i = 0; i < bars; i++) {
    const x = fromX + dir * i * pitch;
    g.fillRect(x - 1.5, top, 3, bot - top);
    // Spear head.
    g.beginPath();
    g.moveTo(x - 4, top);
    g.lineTo(x, top - 11);
    g.lineTo(x + 4, top);
    g.closePath();
    g.fill();
  }
  g.fillRect(fromX + Math.min(0, dir * bars * pitch), top + 6, bars * pitch, 3);
}

function gasStandard(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  const cx = w * STANDARD_X;
  const top = hz.bridgeTop;

  // Fluted shaft, tapering.
  g.beginPath();
  g.moveTo(cx - SHAFT_W / 2, top);
  g.lineTo(cx + SHAFT_W / 2, top);
  g.lineTo(cx + SHAFT_W, hz.deckTop);
  g.lineTo(cx - SHAFT_W, hz.deckTop);
  g.closePath();
  g.fill();

  // Base: stepped plinth.
  g.fillRect(cx - SHAFT_W * 1.9, hz.deckTop - 14, SHAFT_W * 3.8, 14);
  g.fillRect(cx - SHAFT_W * 2.4, hz.deckTop - 5, SHAFT_W * 4.8, 9);

  // Acanthus crown — three leaves curling outward under the arm.
  const crownY = top + 16;
  for (const s of [-1, 1]) {
    g.beginPath();
    g.moveTo(cx, crownY - 12);
    g.quadraticCurveTo(cx + s * 16, crownY - 8, cx + s * 11, crownY + 7);
    g.quadraticCurveTo(cx + s * 6, crownY - 1, cx, crownY - 12);
    g.fill();
  }

  // Bracket arm, curving inward to carry the lantern.
  const anchor = lanternAnchor(w, hz);
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx, top + 6);
  g.quadraticCurveTo(cx + (anchor.x - cx) * 0.55, top - 6, anchor.x, anchor.y - 18);
  g.stroke();

  // Lantern housing: a tapered glass box under the arm. The flame itself is
  // drawn by bloom.ts, which reads `lanternAnchor` for exactly this reason.
  g.beginPath();
  g.moveTo(anchor.x - 9, anchor.y - 16);
  g.lineTo(anchor.x + 9, anchor.y - 16);
  g.lineTo(anchor.x + 7, anchor.y + 12);
  g.lineTo(anchor.x - 7, anchor.y + 12);
  g.closePath();
  g.fill();
  g.beginPath();
  g.moveTo(anchor.x - 11, anchor.y - 16);
  g.lineTo(anchor.x, anchor.y - 27);
  g.lineTo(anchor.x + 11, anchor.y - 16);
  g.closePath();
  g.fill();
}

function railFinials(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  // The parapet runs smooth from edge to edge; this puts a vertical rhythm back
  // into the one line in the picture that has none. It sits exactly where the
  // glass panels rest, so it is always visible.
  const pitch = 84;
  for (let x = pitch / 2; x < w; x += pitch) {
    g.fillRect(x - 2, hz.railTop - 15, 4, 17);
    g.beginPath();
    g.moveTo(x - 5, hz.railTop - 14);
    g.lineTo(x, hz.railTop - 27);
    g.lineTo(x + 5, hz.railTop - 14);
    g.closePath();
    g.fill();
  }
}

function branches(g: CanvasRenderingContext2D, w: number, hz: Horizon): void {
  g.lineWidth = 2;
  for (const side of [0, 1]) {
    const rootX = side === 0 ? -6 : w + 6;
    const dir = side === 0 ? 1 : -1;
    for (let b = 0; b < 3; b++) {
      const dropY = 4 + b * 26;
      const reach = 130 - b * 34;
      g.beginPath();
      g.moveTo(rootX, dropY);
      g.quadraticCurveTo(
        rootX + dir * reach * 0.5, dropY + hz.cityTop * 0.22,
        rootX + dir * reach, dropY + hz.cityTop * 0.55,
      );
      g.stroke();
      // Two twigs off each limb.
      for (const t of [0.4, 0.72]) {
        const tx = rootX + dir * reach * t;
        const ty = dropY + hz.cityTop * 0.55 * t * t;
        g.beginPath();
        g.moveTo(tx, ty);
        g.lineTo(tx + dir * 16, ty - 13);
        g.stroke();
      }
    }
  }
}

export function drawForeground(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  ink: string,
): void {
  g.save();
  g.fillStyle = ink;
  g.strokeStyle = ink;

  // Four framing objects would fight if they were stacked flat. Each gets its
  // own weight, nearest and hardest first — that layering IS the vignette.
  g.globalAlpha = 1;
  gatePier(g, w * GATE_X.left, hz);
  gatePier(g, w * GATE_X.right, hz);
  gateLeaf(g, w * GATE_X.left + 20, 1, hz);
  gateLeaf(g, w * GATE_X.right - 20, -1, hz);
  gasStandard(g, w, hz);

  g.globalAlpha = 0.92;
  railFinials(g, w, hz);

  g.globalAlpha = 0.45;
  branches(g, w, hz);

  g.restore();
}
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/foreground.test.ts tests/world/ladder.test.ts`
Expected: PASS

Run: `npm run typecheck`
Expected: bersih

Run: `npm test`
Expected: seluruh berkas lulus

- [ ] **Step 5: Commit — Task 3 dan 4 bersama**

```bash
git add src/world/foreground.ts src/world/layers.ts \
        tests/world/foreground.test.ts tests/world/ladder.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: near vignette at the frame edges, and layers drinks the ladder"
```

---

### Task 5: `bloom.ts` — lentera di rumahnya, bulan dibesarkan

**Files:**
- Modify: `src/world/bloom.ts`
- Test: `tests/world/bloom.test.ts` (tambah)

**Interfaces:**
- Consumes: `lanternAnchor` dari `foreground.ts`
- Produces: `lampSpots` dan `moonPos` tanda tangannya tidak berubah

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `tests/world/bloom.test.ts`:

```ts
import { lanternAnchor } from '../../src/world/foreground';

describe('the lantern sits in its own housing', () => {
  it('takes its position from foreground.ts, not from a second guess', () => {
    // Two modules computing the same position separately is how the flame ends
    // up floating beside the lamp instead of inside it.
    const spots = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const lantern = spots.find((s) => s.kind === 'lantern')!;
    const anchor = lanternAnchor(1440, hz);
    expect({ x: lantern.x, y: lantern.y }).toEqual(anchor);
  });

  it('still never goes out', () => {
    for (const p of [0, 0.5, 1]) {
      const spots = lampSpots(1440, hz, blocks, p, effectsFor('fog'), moonPos(1440, hz, p));
      expect(spots.find((s) => s.kind === 'lantern')!.lit).toBe(true);
    }
  });
});

describe('the moon carries the picture', () => {
  it('is far bigger than any gas lamp', () => {
    const spots = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const moon = spots.find((s) => s.kind === 'moon')!;
    const lamp = spots.find((s) => s.kind === 'bridge')!;
    expect(moon.r).toBeGreaterThan(lamp.r * 7);
  });

  it('grows again on a full moon', () => {
    const plain = lampSpots(1440, hz, blocks, 0.5, effectsFor('clear'), moonPos(1440, hz, 0.5));
    const full = lampSpots(1440, hz, blocks, 0.5, effectsFor('fullmoon'), moonPos(1440, hz, 0.5));
    const r = (s: typeof plain) => s.find((v) => v.kind === 'moon')!.r;
    expect(r(full)).toBeGreaterThan(r(plain));
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/bloom.test.ts`
Expected: FAIL — posisi lentera tidak sama dengan `lanternAnchor`, dan `moon.r` masih 16

- [ ] **Step 3: Tulis implementasinya**

Di `src/world/bloom.ts`, tambahkan impor:

```ts
import { lanternAnchor } from './foreground';
```

Ganti baris lentera di `lampSpots`:

```ts
  // The near lantern never goes out, at any state. Addendum §D.1. Its position
  // comes from foreground.ts so the flame lands inside the glass housing that
  // module draws — one source, not two that can drift apart.
  const lantern = lanternAnchor(w, hz);
  out.push({ x: lantern.x, y: lantern.y, r: 5, lit: true, kind: 'lantern' });
```

Ganti baris bulan:

```ts
  out.push({
    // The moon is the picture's key light, not a decoration in the corner. At
    // r16 it read as a sticker; this is the size it has to be to justify the
    // reflection column it drops down the whole river.
    x: Math.round(moon.x), y: Math.round(moon.y), r: 30 * fx.moonScale,
    lit: true, kind: 'moon',
  });
```

Ganti kedua tabel halo/alpha, dan tambahkan `MOON_DISC` tepat di atasnya:

```ts
/**
 * The moon's disc. Fixed, like `VIGNETTE_INK` in ladder.ts and for the same
 * reason: it is the TOP of the value range, and a top that drifts with the
 * ambient palette is not a top.
 */
const MOON_DISC = '#f4f7f4';

const HALO: Record<LampSpot['kind'], number> = {
  window: 8, bridge: 12, street: 15, lantern: 20, moon: 3.6,
};
const ALPHA: Record<LampSpot['kind'], number> = {
  window: 0.34, bridge: 0.34, street: 0.30, lantern: 0.55, moon: 0.30,
};
```

Lalu ganti cabang bulan di `drawLamps`:

```ts
    if (s.kind === 'moon') {
      glowBlob(g, s.x, s.y, rad * HALO.moon, v.glow, ALPHA.moon + v.lum * 0.1 + fx.lumLift);
      // A hard, near-white disc. A soft dim one reads as a smudge, and the
      // reference's moon is the brightest thing on screen by a wide margin.
      g.globalAlpha = Math.min(1, 0.62 + v.lum * 0.3 + fx.lumLift);
      g.fillStyle = MOON_DISC;
      g.beginPath();
      g.arc(s.x, s.y, rad, 0, Math.PI * 2);
      g.fill();
      continue;
    }
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/bloom.test.ts`
Expected: PASS, 11 tes

Run: `npm test && npm run typecheck`
Expected: semuanya hijau, typecheck bersih

- [ ] **Step 5: Commit**

```bash
git add src/world/bloom.ts tests/world/bloom.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: the flame sits in its housing, and the moon becomes a key light"
```

---

### Task 6: `city.ts` — verticality gotik

**Files:**
- Modify: `src/world/city.ts`
- Test: `tests/world/city.test.ts` (tambah)

**Interfaces:**
- Consumes: `stream` dari `rng.ts`
- Produces: `skyline(w, top, bot, seed)` tanda tangannya tidak berubah; `MIN_SPIRE_ASPECT` baru diekspor

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `tests/world/city.test.ts`:

```ts
import { MIN_SPIRE_ASPECT, SPIRE_MAX_W, skyline as gen } from '../../src/world/city';

describe('gothic verticality', () => {
  const blocks = gen(1400, 100, 460, 17);

  it('makes every spire taller than it is wide, well past square', () => {
    // A spire as wide as it is tall is a tent. The reference's towers are needles.
    // Measured against the SHAFT, not the slot: the massing caps a tower's shaft
    // at SPIRE_MAX_W however wide a slot the cursor happened to draw for it.
    for (const b of blocks.filter((v) => v.kind === 'spire' || v.kind === 'clockTower')) {
      const shaft = Math.min(b.w, SPIRE_MAX_W);
      expect((460 - b.top) / shaft, `${b.kind} at x=${b.x}`)
        .toBeGreaterThanOrEqual(MIN_SPIRE_ASPECT);
    }
  });

  it('clusters towers into districts instead of sprinkling them evenly', () => {
    const idx = blocks
      .map((b, i) => ({ b, i }))
      .filter(({ b }) => b.kind === 'spire')
      .map(({ i }) => i);
    // At least one adjacent pair — a city has tower districts, not one tower
    // every other block.
    const adjacent = idx.some((v, k) => k > 0 && v - idx[k - 1]! === 1);
    expect(adjacent).toBe(true);
  });

  it('is still deterministic after the change', () => {
    expect(gen(1400, 100, 460, 17)).toEqual(gen(1400, 100, 460, 17));
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/city.test.ts`
Expected: FAIL — `No "MIN_SPIRE_ASPECT" export is defined on the module`

- [ ] **Step 3: Tulis implementasinya**

Di `src/world/city.ts`, tambahkan konstanta di bawah `MAX_W`:

```ts
/**
 * A spire must be at least this many times taller than it is wide. Below about
 * 3 the shape reads as a tent; the reference's towers are needles.
 */
export const MIN_SPIRE_ASPECT = 3.4;

/**
 * Spires and towers are capped narrow no matter what width the cursor drew.
 * Exported so the test can measure the shaft that is actually drawn rather than
 * the slot it stands in.
 */
export const SPIRE_MAX_W = 34;
```

Ganti **seluruh** fungsi `pickKind` dan `skyline` dengan versi di bawah. Ini pengganti utuh, bukan potongan — `span` tetap satu deklarasi di atas loop dan dipakai di dalamnya.

```ts
/** `heightF`: 0 is a low shed, 1 is the tallest thing on the block. */
function pickKind(r: number, heightF: number): ShapeKind {
  // Cranes and sheds crowd the waterfront; spires and stacks stand behind them.
  if (heightF < 0.30) return r < 0.35 ? 'crane' : r < 0.75 ? 'gable' : 'flat';
  if (heightF > 0.66) return r < 0.58 ? 'spire' : r < 0.80 ? 'factory' : 'dome';
  return r < 0.48 ? 'flat' : r < 0.80 ? 'gable' : 'dome';
}

export function skyline(w: number, top: number, bot: number, seed: number): Block[] {
  const r = stream(seed);
  const span = bot - top;
  const out: Block[] = [];

  let x = 0;
  // `run` biases the next block toward the same kind as the last, so towers
  // arrive in districts. A city with one spire every other block reads as
  // wallpaper, not as a place.
  let run = 0;
  let lastKind: ShapeKind | null = null;

  while (x < w) {
    const bw = Math.max(MIN_W, Math.round(MIN_W + r() * (MAX_W - MIN_W)));
    const heightF = Math.pow(r(), 0.62);
    const roll = r();

    const kind = run > 0 && lastKind !== null && roll < 0.62
      ? lastKind
      : pickKind(roll, heightF);

    // Towers are needles. Capping the width here rather than inside the massing
    // keeps the cursor's coverage of `w` exact.
    const narrow = kind === 'spire' || kind === 'clockTower';
    const width = narrow ? Math.min(bw, SPIRE_MAX_W) : bw;

    // Guarantee the aspect ratio instead of hoping a random height clears it.
    // `floor`, not `round`: rounding down the top means rounding UP the height,
    // so the ratio can only ever land above the minimum, never a hair below it.
    let blockTop = Math.round(bot - span * (0.18 + heightF * 0.82));
    if (narrow) {
      blockTop = Math.min(blockTop, Math.floor(bot - width * MIN_SPIRE_ASPECT));
      if (blockTop < top) blockTop = top;
    }

    out.push({ kind, x, w: width, top: blockTop });

    run = kind === lastKind ? run - 1 : (narrow ? 2 : 0);
    lastKind = kind;
    x += width;
  }

  // The landmark goes on the widest block, so it always has room for its shaft.
  // Deterministic, and it reads as deliberate rather than as an accident.
  let widest = 0;
  for (let i = 1; i < out.length; i++) if (out[i]!.w > out[widest]!.w) widest = i;
  // Its slot width is left alone on purpose: the existing coverage test asserts
  // every block's `x` equals the running sum of the widths before it, so
  // shrinking one after the fact would put every later block out of step. The
  // massing already draws the tower's shaft narrow inside a wide slot.
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
```


- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/city.test.ts`
Expected: PASS, 10 tes

Run: `npm test && npm run typecheck`
Expected: semuanya hijau

- [ ] **Step 5: Commit**

```bash
git add src/world/city.ts tests/world/city.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: needle spires clustered into tower districts"
```

---

### Task 7: `fog.ts` — kabut yang memakan kaki bangunan

**Files:**
- Modify: `src/world/fog.ts`
- Test: `tests/world/renderer.test.ts` (tambah)

**Interfaces:**
- Consumes: `Horizon`
- Produces: `drawFog` tanda tangannya tidak berubah

- [ ] **Step 1: Tulis tes yang gagal**

Tambahkan di akhir `tests/world/renderer.test.ts`:

```ts
describe('fog pools at the city\'s feet', () => {
  const v = resolve(NIGHT_KEYS, 0.62, gradesFor(['calm']));
  const hz = horizon(900, 594);

  it('does more work than the three drifting bands alone', () => {
    // A pool at cityBot is what makes buildings emerge FROM fog rather than
    // stand ON a ruled line. Without it the best silhouette in the world still
    // reads as a sticker.
    const { g, calls } = countingCtx();
    drawFog(g, 800, hz, v, 0, 1, 1);
    expect(calls()).toBeGreaterThan(120);
  });

  it('still draws nothing when the night has no fog to give', () => {
    const { g, calls } = countingCtx();
    drawFog(g, 800, hz, v, 0, 1, 0);
    expect(calls()).toBe(0);
  });

  it('scales the pool with the weather like everything else', () => {
    const thin = countingCtx();
    const thick = countingCtx();
    drawFog(thin.g, 800, hz, v, 0, 1, 0.55);
    drawFog(thick.g, 800, hz, v, 0, 1, 2);
    expect(thick.calls()).toBeGreaterThanOrEqual(thin.calls());
  });
});
```

- [ ] **Step 2: Jalankan, pastikan gagal**

Run: `npx vitest run tests/world/renderer.test.ts`
Expected: FAIL — jumlah panggilan masih di bawah 120, karena hanya tiga pita yang digambar

- [ ] **Step 3: Tulis implementasinya**

Di `src/world/fog.ts`, tambahkan fungsi ini di atas `drawFog`:

```ts
/** How many soft lobes make up the pool at the city's feet. */
const POOL_LOBES = 22;

/**
 * The pool. Buildings must come OUT of the fog, not stand on top of it — as
 * long as their feet are cut off at a ruled line, the best silhouette in the
 * world still reads as a sticker pasted on the sky.
 *
 * Drawn as overlapping lobes with an uneven top edge rather than as a gradient
 * band, for the same reason the drifting bands are puffs: a strip that is
 * uniform along x has no shape for the eye to catch.
 */
function drawPool(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  v: AmbientValues,
  thickness: number,
): void {
  const baseY = hz.cityBot;
  const lobeW = w / POOL_LOBES;

  g.save();
  for (let i = 0; i < POOL_LOBES; i++) {
    const x = (i + 0.5) * lobeW;
    // Two detuned sines give the top edge a ragged line without any randomness,
    // so the pool is identical between plate rebuilds.
    const lift = 0.55 + Math.sin(i * 1.7) * 0.22 + Math.sin(i * 0.6) * 0.16;
    const ry = (hz.cityBot - hz.bridgeTop) * lift;

    g.globalAlpha = Math.min(0.7, 0.30 * thickness);
    const grad = g.createRadialGradient(x, baseY, 0, x, baseY, lobeW * 1.35);
    grad.addColorStop(0, v.accent);
    grad.addColorStop(1, 'transparent');
    g.fillStyle = grad;
    g.save();
    g.translate(x, baseY);
    g.scale(1, ry / (lobeW * 1.35));
    g.beginPath();
    g.arc(0, 0, lobeW * 1.35, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  g.restore();
}
```

Lalu panggil dari `drawFog`, tepat setelah pemeriksaan `thickness`:

```ts
  // Thicker fog as the world darkens, and thicker again on a foggy night.
  const thickness = (1 - v.lum) * fogScale;
  if (thickness <= 0.01) return;

  // The pool goes first: the drifting bands belong to the river and must ride
  // over it, not under it.
  drawPool(g, w, hz, v, thickness);
```

- [ ] **Step 4: Jalankan, pastikan lulus**

Run: `npx vitest run tests/world/renderer.test.ts`
Expected: PASS

Run: `npm test && npm run typecheck`
Expected: semuanya hijau

- [ ] **Step 5: Commit**

```bash
git add src/world/fog.ts tests/world/renderer.test.ts
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "feat: fog pools at the city's feet so the buildings emerge from it"
```

---

### Task 8: Addendum §D, README, verifikasi mata

**Files:**
- Modify: `../Ideas/gaslamp-dna.md` (§D)
- Modify: `README.md`

**Interfaces:**
- Consumes: seluruh `src/world/`
- Produces: tidak ada kode baru

- [ ] **Step 1: Tulis ulang §D addendum**

Buka `../Ideas/gaslamp-dna.md`, temukan bagian `## §D`. Ganti tabel paletnya dengan:

```markdown
### D.1 Palet dasar — teal dingin

Yharnam, bukan senja. Seluruh dunia nyaris monokrom dingin; **`--amb-glow` adalah
satu-satunya warna hangat di seluruh aplikasi**, dan justru itu yang membuatnya bekerja:
di gambar yang semuanya teal, satu titik amber terbaca sebagai api sungguhan.

| peran | nilai malam | catatan |
|---|---|---|
| `--amb-deep` | `#101a20` | diturunkan, bukan disetel tangan |
| `--amb-mid` | `#2f4a4c` | |
| `--amb-lift` | `#6d8f89` | |
| `--amb-glow` | `#ffb347` | gas amber — SATU-SATUNYA yang hangat |
| `--amb-accent` | `= sky[2]` | **kabut**, dan kabut adalah massa paling terang |
| `--amb-ink` | `#ece4d8` | |
| `--amb-ink-soft` | `#9aa5a8` | |

**Pembalikan peran `accent`.** Sebelumnya `accent` adalah warna kabut yang agak gelap,
dipakai sebagai lapisan yang menutupi. Sekarang kabut adalah **massa paling terang di
gambar**, jadi `accent` disetel sama dengan `sky[2]` di tiap keyframe malam. Modul yang
meminumnya ikut benar tanpa diubah.

**Terang dan tebal adalah dua momen berbeda.** Ketebalan kabut dihitung `(1 - lum)`, jadi
`lum` tetap turun monoton sepanjang malam. Yang memuncak di tengah malam adalah `accent`.
Kabut paling *bercahaya* dan kabut paling *menelan* sengaja dipisah jadi dua babak.

### D.2 Tangga nilai

Aturan baru, dan yang paling menentukan tampilan: **referensinya bukan gelap, melainkan
kontras tinggi.** Massa kabutnya justru terang dan siluetnya nyaris hitam pekat di
depannya. Dunia yang seragam gelap adalah hal yang berbeda, dan menggelapkannya lagi
justru menjauhkan.

Setiap kedalaman diukur dari **kabut** (`sky[2]`), bukan dari `--amb-deep`:

```
kabut / langit      paling terang
kota jauh           mix(kabut, #05080a, 0.45)
jembatan / tengah   mix(kabut, #05080a, 0.70)
lantai dekat        mix(kabut, #05080a, 0.88)
pagar / perabot     mix(kabut, #05080a, 0.93)
pembingkai tepi     #05080a  TETAP
```

Baris terakhir wajib. **Pembingkai tepi tidak pernah diturunkan dari palet ambient.** Ia
jangkar nilai gambar: selama tepi frame hitam pekat, mata membaca sisanya sebagai punya
rentang penuh. Kalau ia ikut ambient, ia ikut *terang* bersama kabut, dan kontras runtuh
justru saat kabut paling tebal — saat gambar paling seharusnya dramatis.

Urutan ini harus dites, bukan diperiksa mata: `luminance` tiap anak tangga wajib turun
monoton, di setiap keyframe dikali setiap kombinasi grade.

### D.3 Vignette dekat wajib

Tumpukan pita horizontal, sebagus apa pun digambar, terbaca sebagai latar belakang.
Vertikal hitam dekat yang memotong tepi frame adalah yang membuat penonton merasa
**berdiri di suatu tempat**.

Tiap projek keluarga ini wajib punya minimal satu, digambar dengan `#05080a` tetap. Kalau
lebih dari satu, masing-masing dapat bobot berbeda supaya tidak berebut — paling tepi
paling pekat, paling jauh paling pudar.

### D.4 Lentera yang tidak pernah padam

Tidak berubah: satu lentera dekat menyala penuh di keadaan apa pun. Posisinya berasal dari
modul vignette, bukan dihitung kedua kali di modul cahaya — dua modul yang menghitung
posisi yang sama secara terpisah adalah cara api berakhir melayang di samping lampunya.

### D.5 Aksen langka

Tidak berubah: `#8c2f3a` `#ffb347` `#6f8f9c` `#b08d57` `#7d6b8a`, dipakai sangat jarang.

> **Amandemen 2026-07-28.** §D sepenuhnya ditulis ulang dari palet ungu hangat sebelumnya.
> Alasannya ada di `NightWatch/docs/superpowers/specs/2026-07-28-yharnam-pass-design.md`:
> palet lama tidak pernah terlihat karena aplikasi duduk di keyframe senja saat idle, dan
> bahkan malamnya pun tidak akan mencapai referensi karena masalahnya rentang nilai, bukan
> kegelapan.
```

- [ ] **Step 2: Perbarui README**

Di `README.md`, di bawah bagian `### The world layer`, tambahkan:

```markdown
Depth values come from `src/world/ladder.ts`, never from a module's own mix. The
frame-edge ink is a fixed constant that never touches the ambient palette — it
is the picture's value anchor, and letting it follow ambient would collapse the
contrast at exactly the moment the fog is thickest. `tests/world/ladder.test.ts`
checks the rungs stay in order across every keyframe and grade combination.

The near vignette (`src/world/foreground.ts`) is what makes the scene read as a
place you are standing in rather than a backdrop.
```

- [ ] **Step 3: Verifikasi penuh**

Run: `npm test`
Expected: seluruh berkas lulus, tanpa kegagalan

Run: `npm run typecheck`
Expected: bersih

Run: `npm run build`
Expected: `✓ built in ...`

- [ ] **Step 4: Verifikasi mata**

Run: `npm run dev`, buka `http://localhost:5173/`, periksa:

1. Saat idle, yang terlihat adalah **malam teal dingin** — bukan ungu senja.
2. Tiang gas besi berdiri di kiri, tinggi, hitam pekat, dengan lentera menyala di lengannya.
3. Tiang gerbang batu di kedua tepi, jauh lebih tinggi dari pagar.
4. Finial tombak memberi ritme vertikal di garis pagar.
5. Ranting menjuntai dari dua sudut atas, tipis dan pudar.
6. Kaki bangunan tenggelam ke dalam kabut, tidak terpotong di garis lurus.
7. Menara kurus dan berkelompok, bukan berbaris merata.
8. Bulan besar dan nyaris putih, jauh lebih terang dari lentera mana pun.
9. Tekan MULAI dan tunggu: kabut jadi paling *terang* di pertengahan, lalu paling *tebal*
   dan gelap menjelang akhir, lalu fajar dingin.

Hentikan server setelah selesai.

- [ ] **Step 5: Commit**

```bash
git add README.md
git -c user.name="rinkusu" -c user.email="linggom070905@gmail.com" \
  commit -m "docs: record the value ladder and the near vignette"
```

`Ideas/` bukan repo git, jadi perubahan addendum tersimpan sebagai berkas saja.

---

## Setelah semua task

Jalankan `superpowers:finishing-a-development-branch` untuk memutuskan integrasi.
