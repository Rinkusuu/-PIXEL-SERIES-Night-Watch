import { useEffect } from 'react';
import { World } from './world/Canvas';
import { makeGrainUri } from './world/grain';
import { useNightWatch } from './app/useNightWatch';
import { TheWatch } from './panels/TheWatch';
import { TheQuarry } from './panels/TheQuarry';
import { TheLedger } from './panels/TheLedger';
import { COPY } from './app/copy';

export function App() {
  const nw = useNightWatch();

  useEffect(() => {
    document.documentElement.style.setProperty('--grain-uri', makeGrainUri());
  }, []);

  const selected = nw.data.quarry.find((q) => q.id === nw.session.quarryId) ?? null;

  return (
    <>
      <World values={nw.values} progress={nw.progress} motion={nw.motion} />
      <main className="app">
        {nw.recovered && <p className="label">{COPY.storeRecovered}</p>}
        <div className="grid">
          <TheWatch
            phase={nw.session.phase}
            progress={nw.progress}
            remainingMs={nw.remainingMs}
            quarryName={selected?.name ?? null}
            bloodmoon={nw.grades.includes('bloodmoon')}
            onStart={nw.actions.start}
            onStop={nw.actions.stop}
            onSkip={nw.actions.skip}
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
