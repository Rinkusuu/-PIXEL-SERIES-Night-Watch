import type { Horizon } from './horizon';

/**
 * The canal walls — terraces standing in the water down both edges of the frame,
 * leaving a channel between them instead of an estuary.
 *
 * The first attempt drew three flat rectangles a side with a notched top edge
 * and a FLAT base, and that base is what made it read as a slab rather than a
 * wall running away from you. A receding waterline RISES toward the far end.
 * Getting that one line wrong cost more than every other detail here put
 * together.
 *
 * Drawn in the LIVE pass, after the river: the river fills its band opaquely
 * over the plate every frame, so a wall on the plate would be washed out below
 * the waterline, and painting over the water is what narrows it.
 */

/** Width of each wall, as a fraction of the frame. */
export const QUAY_W = 0.13;

/**
 * Where the wall starts, inboard of the frame edge. The gate piers of the near
 * vignette stand at 0.038w; running the terrace under them put two dark masses
 * in the same column and both stopped reading.
 */
export const QUAY_INSET = 0.052;

/** Houses per side. Four is enough for the run to read as receding. */
const HOUSES = 4;

const WIN_W = 4;
const WIN_H = 6;
const STOREY = 13;
const COL_PITCH = 11;

export type QuayHouse = {
  x: number;
  w: number;
  /** Roofline. Nearer houses are taller on screen. */
  top: number;
  /** Its own waterline. Rises toward the channel — this IS the perspective. */
  base: number;
};

export type QuayWindow = { x: number; y: number; w: number; h: number };

/**
 * One side's run of houses, from the frame edge inward.
 *
 * Two lines do all the work: the roofline drops and the waterline rises as the
 * run recedes, so each house is shorter than the one before it and stands in
 * water that is further away. A flat base with a stepped top is a fence.
 */
export function quayHouses(
  w: number, hz: Horizon, side: 'left' | 'right',
): QuayHouse[] {
  const wall = Math.round(w * QUAY_W);
  const houseW = Math.round(wall / HOUSES);
  const inset = Math.round(w * QUAY_INSET);
  const waterRun = hz.waterBot - hz.waterTop;
  const out: QuayHouse[] = [];

  for (let i = 0; i < HOUSES; i++) {
    const t = i / (HOUSES - 1);
    // Roof drops away; waterline climbs toward it. Never all the way to
    // `waterTop` — the far end of the run is still this side of the bridge.
    const top = Math.round(hz.cityTop * (0.34 + t * 0.78));
    const base = Math.round(hz.waterBot - waterRun * t * 0.72);
    const x = side === 'left'
      ? inset + i * houseW
      : w - inset - (i + 1) * houseW;
    out.push({ x, w: houseW, top, base });
  }
  return out;
}

/** Both sides at once, for callers that do not care which is which. */
export function allQuayHouses(w: number, hz: Horizon): QuayHouse[] {
  return [
    ...quayHouses(w, hz, 'left'),
    ...quayHouses(w, hz, 'right'),
  ];
}

/**
 * Every window on both walls. Exported so `bloom.ts` lights a few from the same
 * list the wall cuts dark — the one-source rule `openings()` already follows.
 *
 * The ground floor is left out on purpose: at the waterline the openings are
 * the arcade, and an arcade with a sash window in it is neither.
 */
export function quayWindows(w: number, hz: Horizon): QuayWindow[] {
  const out: QuayWindow[] = [];
  for (const h of allQuayHouses(w, hz)) {
    const cols = Math.floor((h.w - 10 + (COL_PITCH - WIN_W)) / COL_PITCH);
    if (cols < 1) continue;
    const gridW = cols * COL_PITCH - (COL_PITCH - WIN_W);
    const sx = Math.round(h.x + (h.w - gridW) / 2);
    // Stops one storey short of the water: that band belongs to the arcade.
    const lowest = h.base - ARCADE_H - STOREY;
    for (let y = h.top + 9; y + WIN_H <= lowest; y += STOREY) {
      for (let c = 0; c < cols; c++) {
        out.push({ x: sx + c * COL_PITCH, y: Math.round(y), w: WIN_W, h: WIN_H });
      }
    }
  }
  return out;
}

/** Height of the arcade at the water's edge. */
const ARCADE_H = 14;

export type QuayStyle = {
  wall: string;
  /** Cornices, window reveals, and the arcade's shadowed openings. */
  dark: string;
  /** Wet stone at the waterline, and the arcade's own piers. */
  plinth: string;
};

export function drawQuay(
  g: CanvasRenderingContext2D, w: number, hz: Horizon, s: QuayStyle,
): void {
  g.save();

  for (const h of allQuayHouses(w, hz)) {
    // 1 — the shaft.
    g.fillStyle = s.wall;
    g.fillRect(h.x, h.top, h.w, h.base - h.top);

    // 2 — a cornice that PROJECTS past the shaft. Without the overhang the
    //     houses merge into one mass and the run stops reading as separate
    //     buildings at all.
    g.fillStyle = s.dark;
    g.fillRect(h.x - 2, h.top, h.w + 4, 3);
    g.fillStyle = s.wall;
    g.fillRect(h.x - 2, h.top + 3, h.w + 4, 2);

    // 3 — chimney stacks on the roof, so the skyline of the run is not ruled.
    g.fillStyle = s.dark;
    g.fillRect(h.x + Math.round(h.w * 0.22), h.top - 8, 4, 8);
    g.fillRect(h.x + Math.round(h.w * 0.62), h.top - 11, 5, 11);

    // 4 — storey bands. The grid of windows is only legible if the floors
    //     they sit on are.
    g.fillStyle = s.dark;
    for (let y = h.top + 6 + STOREY; y < h.base - ARCADE_H; y += STOREY) {
      g.fillRect(h.x, Math.round(y), h.w, 1);
    }

    // 5 — the arcade at the water's edge. This is the single most Venetian
    //     thing in the reference and the cheapest: a row of round-headed
    //     openings with the water running straight into them.
    const archTop = h.base - ARCADE_H;
    const bays = Math.max(2, Math.floor(h.w / 13));
    const bayW = h.w / bays;
    g.fillStyle = s.plinth;
    g.fillRect(h.x, archTop - 2, h.w, 2);
    for (let k = 0; k < bays; k++) {
      const cx = h.x + bayW * (k + 0.5);
      const r = Math.max(2, Math.round(bayW * 0.30));
      g.fillStyle = s.dark;
      g.beginPath();
      g.moveTo(cx - r, h.base);
      g.lineTo(cx - r, archTop + r);
      g.arc(cx, archTop + r, r, Math.PI, 0);
      g.lineTo(cx + r, h.base);
      g.closePath();
      g.fill();
    }
  }

  // 6 — windows, cut dark. `bloom.ts` lights a handful from this same list.
  g.fillStyle = s.dark;
  for (const win of quayWindows(w, hz)) {
    g.fillRect(win.x, win.y, win.w, win.h);
  }

  g.restore();
}
