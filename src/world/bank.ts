import type { Horizon } from './horizon';
import { archCrown, piers } from './bridge';
import { stream } from './rng';

/**
 * The far bank, seen through the arches.
 *
 * The backlog asked for an embankment along the city's waterfront and for the
 * ruled line at `cityBot` to be broken up. Neither is visible: `cityBot` sits
 * INSIDE the upstream bridge's band — 345 against a band running 297 to 371 —
 * so the city's feet are behind the bridge across the whole frame. A wall drawn
 * there would never be seen by anybody.
 *
 * What can be seen is the arch voids, and the waterline falls squarely inside
 * them. So this band is drawn AFTER the city and BEFORE the bridge, and the
 * bridge covers it everywhere except through its own openings. No clipping:
 * that is how compositing works, and it is less code than drawing it arch by
 * arch.
 *
 * ## Why the wall reaches the crown
 *
 * It began as a token eleven-pixel course, and that was the whole problem with
 * the picture. The visible part of an arch void runs from the crown down to the
 * waterline; eleven pixels of quay left the rest of it showing the city's lower
 * storeys — at the SAME window scale as the towers standing above the roadway.
 * The eye reads the solid roadway band as a ground line, so identical windows
 * reappearing beneath it read as a city standing IN the river.
 *
 * A real embankment is six to ten metres of dressed stone and, seen from across
 * the water, it hides the ground floors of everything behind it completely. So
 * the wall runs from the waterline up to `archCrown` and the arches show quay,
 * waterline, river — a window onto somewhere, and nothing that contradicts
 * where the ground is.
 */

/** Never thinner than this, however cramped the viewport gets. */
const WALL_MIN = 10;
const STAIR_COUNT = 3;
const RING_COUNT = 7;
/** Tread of the water stairs. Shallow: these are steps, not a staircase. */
const TREAD_H = 3;
const TREAD_W = 5;
const TREAD_COUNT = 4;
/** The wet course at the foot of the wall — tide line, weed, and river silt. */
const FOOT_H = 4;

export type BankStyle = {
  /** The quay's stone. One rung nearer than the city behind it. */
  wall: string;
  ink: string;
  /** Stair treads, bollards and the wet foot, cut against the quay. */
  dark: string;
};

/**
 * Top of the quay wall. Exported so a test can assert it clears the arch crown
 * rather than trusting the constant it was written from.
 */
export function quayTop(hz: Horizon): number {
  return Math.min(archCrown(hz), hz.cityBot - WALL_MIN);
}

export function drawBank(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  s: BankStyle,
  seed: number,
): void {
  const water = hz.cityBot;
  const top = quayTop(hz);
  const r = stream(seed);

  g.save();

  // 1 — the quay itself, running the full width behind the bridge.
  g.fillStyle = s.wall;
  g.fillRect(0, top, w, water - top);

  // 2 — the wet foot. Stone standing in a tidal river is dark for the bottom
  //     few pixels, always, and that band is what stops the wall from ending in
  //     a bare seam where the live water starts painting over it.
  g.fillStyle = s.dark;
  g.fillRect(0, water - FOOT_H, w, FOOT_H);

  // 3 — two string courses. They are what tell the eye this is dressed stone
  //     and not a bar of colour. Both sit INSIDE the band the arches actually
  //     open onto: the upper one a few pixels below the coping so it does not
  //     fuse with the intrados stroke drawn along the same curve, the lower one
  //     just above the wet foot. The wall then has a top, a face and a base.
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  g.globalAlpha = 0.7;
  for (const y of [top + 4, water - FOOT_H - 2]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.globalAlpha = 1;

  // 4 — the windows this band is actually seen through. Placing furniture at
  //     `w * random` scattered it across the whole frame, and the frame is
  //     mostly roadway and pier: better than half of every stair and bollard
  //     landed behind solid stone and was never drawn to anybody. So the same
  //     `piers()` the bridge is built from decides where the openings are, and
  //     the furniture goes in the middle of them where it can be seen.
  const p = piers(w, hz);
  const mids: number[] = [];
  for (let i = 0; i < p.length - 1; i++) {
    const x0 = p[i]!.x + p[i]!.w;
    const x1 = p[i + 1]!.x;
    if (x1 - x0 > 2) mids.push(Math.round((x0 + x1) / 2));
  }
  const pick = () => mids[Math.floor(r() * mids.length)] ?? Math.round(w / 2);

  // 5 — water stairs. The most characteristic thing on the Thames and the
  //     cheapest: four treads and a shadow. They hang off the BOTTOM of the
  //     wall, not off its top — a flight measured from the coping would run the
  //     whole height of the quay and read as a ramp.
  g.fillStyle = s.dark;
  const flight = TREAD_H * TREAD_COUNT;
  for (let i = 0; i < STAIR_COUNT; i++) {
    const sx = pick();
    const dir = r() < 0.5 ? 1 : -1;
    for (let k = 0; k < TREAD_COUNT; k++) {
      // The last tread has to END on the waterline rather than start there;
      // anything below it is painted over by the live river every frame.
      const y = water - flight + k * TREAD_H;
      if (y < top) break;
      // Stepping AWAY from the arch's centre, so a flight never walks out
      // behind the pier it started next to.
      g.fillRect(sx - (dir < 0 ? TREAD_W : 0) + dir * k * TREAD_W, y, TREAD_W, TREAD_H);
    }
  }

  // 6 — mooring rings, set into the FACE of the wall.
  //
  //     They were bollards standing on the coping, and once the wall grew to
  //     meet the arch crown the coping went behind the roadway — so every one
  //     of them was drawn to nobody, every frame, at every viewport. A ring in
  //     the wall is the same prop where it can actually be seen, and it is what
  //     a river wall has anyway; bollards belong on a quay you can walk on.
  //
  //     Nothing goes BELOW the waterline: the live river fills that band
  //     opaquely over this plate every frame and would wash it straight out.
  //     Same trap the vignette fell into before it moved to the last pass.
  const ringY = Math.round((top + water) / 2);
  for (let i = 0; i < RING_COUNT; i++) {
    g.fillRect(pick() + Math.round((r() - 0.5) * 44), ringY, 2, 2);
  }

  g.restore();
}
