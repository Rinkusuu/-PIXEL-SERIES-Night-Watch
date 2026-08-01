import type { AmbientValues } from '../ambient/types';
import type { Horizon } from './horizon';
import type { LampSpot } from './water';

/**
 * The cone of light falling out of a gas lantern into the fog.
 *
 * The fog has been receiving the lamps additively since the scene was built —
 * it brightens where a halo lands on it — but it was never SHAPED by them. A
 * lamp in fog does not merely make the fog near it brighter; it carves a solid
 * wedge of lit air with an edge you can see. That wedge is the single most
 * recognisable image the whole gaslamp vocabulary has, and the picture did not
 * have one anywhere.
 *
 * Its own module for the same reason `ladder.ts` and `horizon.ts` are: `fog.ts`
 * draws fog and `bloom.ts` draws halos, and neither one wants a third job.
 *
 * ## Why it is drawn as steps
 *
 * A cone filled with one smooth gradient has a hard edge down each side, and a
 * hard-edged cone is a theatre spotlight, not weather. The usual fix is to blur
 * or mask the edges — but the entire picture is pixel art with flat values, and
 * a blurred wedge in the middle of it would be the only soft thing on screen.
 *
 * So the falloff is quantised instead: three nested cones, each wider and
 * fainter than the last. The banding is not a compromise, it is the same
 * language the dithered water and the stepped roofs already speak.
 */

/** How many nested cones make up one shaft. */
const STEPS = 3;

/**
 * Half-width of the beam at its foot, as a fraction of its length, and how much
 * light it carries. Only the two NEAR families get one.
 *
 * The bridge standards are deliberately excluded. Their flame sits nine pixels
 * above a roadway that runs the full width of the frame, so a cone from one has
 * nowhere to fall that is not solid stone — it would light the masonry through
 * itself. Distance is also against it: at that depth the whole shaft is a dozen
 * pixels tall and reads as a smudge over the parapet.
 */
const KIND: Partial<Record<LampSpot['kind'], { spread: number; alpha: number }>> = {
  // The near lantern is the picture's one guaranteed light (addendum §D.1) and
  // the closest, so it carries the strongest beam.
  lantern: { spread: 0.46, alpha: 0.17 },
  // The standards along the near rail. Weaker, or five of them together drown
  // the one lantern that is supposed to anchor the foreground.
  street: { spread: 0.38, alpha: 0.085 },
};

/**
 * Drawn AFTER the fog and BEFORE the halos.
 *
 * After the fog because a beam is fog that has been lit — painted under it, the
 * fog's own puffs would sit on top of the beam and flatten it back out. Before
 * the halos because the halo is the source and must stay the brightest point:
 * a shaft laid over its own lamp puts the lamp behind its own light.
 */
export function drawShafts(
  g: CanvasRenderingContext2D,
  hz: Horizon,
  v: AmbientValues,
  lamps: readonly LampSpot[],
  fogScale: number,
): void {
  // No fog, no beam. A shaft is not a property of the lamp, it is a property of
  // the air between the lamp and the eye — on a clear night there is nothing
  // for the light to catch and the cone must vanish completely. Same quantity
  // `drawFog` thickens itself by, so the two can never disagree about how much
  // air there is.
  const thickness = (1 - v.lum) * fogScale;
  if (thickness <= 0.01) return;

  g.save();
  g.globalCompositeOperation = 'lighter';

  for (const s of lamps) {
    if (!s.lit) continue;
    const k = KIND[s.kind];
    if (!k) continue;

    // The beam stops at the stone it lands on. Anything past that is light
    // falling through the deck.
    const bottom = s.kind === 'lantern' ? hz.h : hz.deckTop;
    const len = bottom - s.y;
    if (len <= 8) continue;

    for (let i = STEPS; i >= 1; i--) {
      const t = i / STEPS;
      // Widest step first and faintest, so the narrow bright core lands on top
      // of it. Painted the other way round the core is buried.
      const halfW = len * k.spread * t;
      // The outer steps are much fainter than a linear ramp would make them:
      // squaring keeps the light concentrated in the core, which is what stops
      // the whole thing reading as a flat triangle of paint.
      const a = k.alpha * thickness * (1 - t + 1 / STEPS) ** 2;

      // Vertical falloff on top of the lateral steps. A beam that is as bright
      // where it lands as where it leaves the glass is a solid object.
      const grad = g.createLinearGradient(0, s.y, 0, bottom);
      grad.addColorStop(0, v.glow);
      grad.addColorStop(1, 'transparent');

      g.globalAlpha = a;
      g.fillStyle = grad;
      g.beginPath();
      // Apex at the flame, not at the lamp's centre: the light leaves from a
      // point, and starting the cone at full radius gives it a flat top edge
      // that reads as a lampshade.
      g.moveTo(s.x, s.y);
      g.lineTo(s.x + halfW, bottom);
      g.lineTo(s.x - halfW, bottom);
      g.closePath();
      g.fill();
    }
  }

  g.restore();
}
