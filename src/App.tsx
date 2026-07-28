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
