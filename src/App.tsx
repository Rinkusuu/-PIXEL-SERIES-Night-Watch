import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { World } from './world/Canvas';
import { makeGrainUri } from './world/grain';
import { useNightWatch } from './app/useNightWatch';
import { TheWatch } from './panels/TheWatch';
import { TheQuarry } from './panels/TheQuarry';
import { TheLedger } from './panels/TheLedger';
import { COPY } from './app/copy';
import { useKeys } from './app/useKeys';

export function App() {
  const nw = useNightWatch();
  const gridRef = useRef<HTMLDivElement>(null);
  const [deckTop, setDeckTop] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Space is the one shortcut that has to exist: starting and stopping is what
  // the app is for. `useKeys` ignores keys typed into a field, which is what
  // keeps the quarry input usable with Space bound at the window.
  const keys = useMemo(() => ({
    ' ': () => (nw.session.phase === 'idle' ? nw.actions.start() : nw.actions.stop()),
    s: () => { if (nw.session.phase !== 'idle') nw.actions.skip(); },
    ',': () => setSettingsOpen((o) => !o),
    escape: () => setSettingsOpen(false),
  }), [nw.session.phase, nw.actions]);
  useKeys(keys);

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
            tonight={nw.tonight}
            weather={nw.weather}
            settings={nw.data.settings}
            settingsOpen={settingsOpen}
            onToggleSettings={() => setSettingsOpen((o) => !o)}
            onDurations={nw.actions.setDurations}
            onToggleAlert={nw.actions.toggleAlert}
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
            onRemove={nw.actions.removeQuarry}
            onRename={nw.actions.renameQuarry}
          />
          <TheLedger
            rows={nw.ledger}
            grid={nw.nightsGrid}
            quarryTotals={nw.quarryTotals}
            streak={nw.streak}
            best={nw.best}
            totals={nw.totals}
            days={nw.retentionDays}
          />
        </div>
      </main>
      <div className="grain" />
      <div className="scanlines" />
      <div className="vignette" />
    </>
  );
}
