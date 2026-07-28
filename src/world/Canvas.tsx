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
        w,
        h,
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
