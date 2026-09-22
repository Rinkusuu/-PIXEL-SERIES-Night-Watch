import { useEffect, useRef } from 'react';
import type { AmbientValues } from '../ambient/types';
import type { Weather } from './weather';
import { defaultDeckTop, zenDeckTop } from './horizon';
import { createWorldRenderer } from './renderer';

type Props = {
  values: AmbientValues;
  progress: number;
  motion: number;
  weather: Weather;
  /** Top of the glass panel row, in CSS pixels. The balustrade lands here. */
  deckTop: number;
  /** With the glass hidden there is nothing for the parapet to carry. */
  zen: boolean;
  /** Told how many times it bounced, or 0 for a throw that missed the water. */
  onSkip?: (bounces: number) => void;
  /** A lit window was pressed. Given its position, which is its identity. */
  onWindow?: (at: { x: number; y: number }) => void;
  /**
   * Handed the canvas once it is mounted, so a postcard can be taken of it.
   *
   * The element rather than the CSS-resolution buffer: what is on screen has
   * already been blown up to the device with nearest neighbour, which is the
   * version the viewer is actually looking at and the one worth keeping.
   */
  onCanvas?: (canvas: HTMLCanvasElement | null) => void;
};

export function World({ values, progress, motion, weather, deckTop, zen, onSkip, onWindow, onCanvas }: Props) {
  const ref = useRef<HTMLCanvasElement>(null);
  // Read through a ref so the rAF loop is started exactly once.
  const latest = useRef({ values, progress, motion, weather, deckTop, zen, onSkip, onWindow });
  latest.current = { values, progress, motion, weather, deckTop, zen, onSkip, onWindow };

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const g = cv.getContext('2d');
    if (!g) return;

    const buffer = document.createElement('canvas');
    const bg = buffer.getContext('2d');
    if (!bg) return;

    const renderer = createWorldRenderer();
    let raf = 0;
    let w = 0;
    let h = 0;

    // The world is drawn at CSS resolution into a buffer and blown up to the
    // device with nearest neighbour. On a retina screen that is a clean 2x, so
    // every edge lands on a hard pixel boundary instead of an antialiased ramp.
    //
    // The buffer is deliberately the SAME size the scene was always designed
    // at: one CSS pixel per drawn pixel. A smaller buffer was tried and it
    // destroyed four rounds of work — a 4x7 window became 1x2 and the figures
    // became five pixels tall. Crispness is free; resolution is not.
    const resize = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      w = Math.ceil(window.innerWidth);
      h = Math.ceil(window.innerHeight);
      cv.width = Math.ceil(w * dpr);
      cv.height = Math.ceil(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      buffer.width = w;
      buffer.height = h;
      bg.setTransform(1, 0, 0, 1, 0, 0);
      bg.imageSmoothingEnabled = false;
      g.setTransform(1, 0, 0, 1, 0, 0);
      g.imageSmoothingEnabled = false;
      renderer.invalidate();
    };

    let resizeTimer = 0;
    const onResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(resize, 150);
    };

    const loop = (t: number) => {
      const s = latest.current;
      renderer.frame(bg, {
        w,
        h,
        // Zen ignores the measured row: there is no glass to rest on. See
        // `zenDeckTop`.
        deckTop: s.zen ? zenDeckTop(h) : (s.deckTop || defaultDeckTop(h)),
        v: s.values,
        progress: s.progress,
        timeMs: t,
        motion: s.motion,
        weather: s.weather,
      });
      g.clearRect(0, 0, cv.width, cv.height);
      g.drawImage(buffer, 0, 0, buffer.width, buffer.height, 0, 0, cv.width, cv.height);
      raf = requestAnimationFrame(loop);
    };

    /**
     * A throw at the river.
     *
     * Bound to the WINDOW, not to the canvas, and then filtered — because the
     * canvas is behind everything and a click on a button never reaches it, so
     * a canvas listener would miss nothing but would also never fire for the
     * large parts of the world that the panels cover. Filtering by target is
     * the same guard the reference project uses, and for the same reason: with
     * it absent, dragging a slider throws a stone into the water behind it.
     */
    const onPointerDown = (e: PointerEvent) => {
      const t = e.target as Element | null;
      if (t?.closest?.('.app, .cmd, .topbar')) return;
      const s = latest.current;
      // A window first: it is the smaller target and it sits above the water,
      // so nothing is taken away from the throw. A press that finds neither is
      // still a throw that missed, which is a real outcome and not a bug.
      const win = renderer.windowAt(e.clientX, e.clientY);
      if (win) { s.onWindow?.({ x: win.x, y: win.y }); return; }
      const deck = s.zen ? zenDeckTop(h) : (s.deckTop || defaultDeckTop(h));
      s.onSkip?.(renderer.skip(e.clientX, e.clientY, h, deck));
    };

    resize();
    raf = requestAnimationFrame(loop);
    window.addEventListener('resize', onResize);
    window.addEventListener('pointerdown', onPointerDown);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(resizeTimer);
      window.removeEventListener('resize', onResize);
      window.removeEventListener('pointerdown', onPointerDown);
    };
  }, []);

  return (
    <canvas
      ref={(el) => { ref.current = el; onCanvas?.(el); }}
      className="world"
      aria-hidden="true"
    />
  );
}
