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
