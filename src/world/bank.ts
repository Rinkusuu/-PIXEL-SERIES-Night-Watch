import type { Horizon } from './horizon';
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
 * What can be seen is the arch voids, 309 to 371, with the waterline at 345
 * falling squarely in the middle of them. So this band is drawn AFTER the city
 * and BEFORE the bridge, and the bridge covers it everywhere except through its
 * own openings. No clipping: that is how compositing works, and it is less code
 * than drawing it arch by arch.
 *
 * The point is not the wall. It is that each arch stops being a hole with a
 * gradient in it and becomes a window onto somewhere.
 */

/** How far above the waterline the quay stands. */
const WALL_H = 11;
const STAIR_COUNT = 3;
const BOLLARD_COUNT = 7;

export type BankStyle = {
  /** The quay's stone. One rung nearer than the city behind it. */
  wall: string;
  ink: string;
  /** Stair treads and bollards, cut against the quay. */
  dark: string;
};

export function drawBank(
  g: CanvasRenderingContext2D,
  w: number,
  hz: Horizon,
  s: BankStyle,
  seed: number,
): void {
  const water = hz.cityBot;
  const top = water - WALL_H;
  const r = stream(seed);

  g.save();

  // 1 — the quay itself, running the full width behind the bridge.
  g.fillStyle = s.wall;
  g.fillRect(0, top, w, WALL_H);

  // 2 — string course and coping. Two lines are what tell the eye this is
  //     dressed stone and not a bar of colour.
  g.strokeStyle = s.ink;
  g.lineWidth = 1;
  g.globalAlpha = 0.7;
  for (const y of [top + 1, water - 3]) {
    g.beginPath();
    g.moveTo(0, y);
    g.lineTo(w, y);
    g.stroke();
  }
  g.globalAlpha = 1;

  // 3 — water stairs. The most characteristic thing on the Thames and the
  //     cheapest: four steps and a shadow.
  g.fillStyle = s.dark;
  for (let i = 0; i < STAIR_COUNT; i++) {
    const sx = Math.round(w * (0.12 + r() * 0.76));
    const dir = r() < 0.5 ? 1 : -1;
    const stepW = 5;
    // `floor`, and the last tread has to END on the waterline rather than
    // start there. Rounding up put it three pixels under, where the live river
    // paints straight over it.
    const treadH = Math.max(1, Math.floor(WALL_H / 4));
    for (let k = 0; k < 4; k++) {
      const y = top + (k + 1) * treadH;
      if (y + treadH > water) break;
      g.fillRect(sx + dir * k * stepW, y, stepW, treadH);
    }
  }

  // 4 — mooring rings and bollards along the coping. Nothing goes BELOW the
  //     waterline: the live river fills that band opaquely over this plate
  //     every frame, and anything moored there would be washed straight out.
  //     Same trap the vignette fell into before it was moved to the last pass.
  for (let i = 0; i < BOLLARD_COUNT; i++) {
    const bx = Math.round(w * (0.06 + r() * 0.88));
    g.fillRect(bx, top - 3, 2, 3);
  }

  g.restore();
}
