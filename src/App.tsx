import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { World } from './world/Canvas';
import { makeGrainUri } from './world/grain';
import { useNightWatch } from './app/useNightWatch';
import { TheWatch } from './panels/TheWatch';
import { TheQuarry } from './panels/TheQuarry';
import { TheLedger } from './panels/TheLedger';
import { COPY, ambientLine } from './app/copy';
import { Header } from './components/Header';
import { useKeys } from './app/useKeys';
import { Palette } from './components/Palette';
import { buildCommands } from './app/commands';
import { downloadPostcard, drawPostcard } from './world/postcard';

export function App() {
  const nw = useNightWatch();
  const gridRef = useRef<HTMLDivElement>(null);
  /** The world canvas, for the postcard. Owned here because the action needs it
      and the component that draws it does not know the night's facts. */
  const worldRef = useRef<HTMLCanvasElement | null>(null);
  const [deckTop, setDeckTop] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [ledgerWide, setLedgerWide] = useState(false);
  /**
   * Zen: the last feature of a focus timer is hiding the timer.
   *
   * It is a class on the root rather than a branch in the tree — unmounting the
   * panels would throw away the quarry input's draft text and the ledger's view,
   * and leaving zen would hand you back a different app than the one you left.
   */
  const [zen, setZen] = useState(false);
  /**
   * A file input, kept off screen and clicked from the palette.
   *
   * A browser will not open a file picker from anything but a real click on a
   * real `<input type=file>`, so the command cannot do it directly — it has to
   * reach one that already exists in the tree.
   */
  const fileRef = useRef<HTMLInputElement>(null);

  // Space is the one shortcut that has to exist: starting and stopping is what
  // the app is for. `useKeys` ignores keys typed into a field, which is what
  // keeps the quarry input usable with Space bound at the window.
  const keys = useMemo(() => ({
    ' ': () => (nw.session.phase === 'idle' ? nw.actions.start() : nw.actions.stop()),
    s: () => { if (nw.session.phase !== 'idle') nw.actions.skip(); },
    // `h` for hold. Not Space, which already starts and stops: the whole point
    // of holding is that it is NOT stopping, and a key that sometimes means one
    // and sometimes the other is worse than no key at all.
    h: () => { if (nw.session.phase !== 'idle') nw.actions.toggleHold(); },
    ',': () => setSettingsOpen((o) => !o),
    z: () => setZen((o) => !o),
    'mod+k': () => setPaletteOpen((o) => !o),
    // Escape unwinds one layer at a time, outermost first — the palette sits
    // over zen, and zen sits over the settings fold.
    escape: () => {
      if (paletteOpen) setPaletteOpen(false);
      else if (zen) setZen(false);
      else setSettingsOpen(false);
    },
  }), [nw.session.phase, nw.actions, paletteOpen, zen]);
  useKeys(keys);

  useEffect(() => {
    document.documentElement.dataset.zen = zen ? 'on' : 'off';
    if (zen) nw.actions.note('dark');
  }, [zen, nw.actions]);

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

  const held = nw.session.pausedAt !== null && nw.session.phase !== 'idle';

  /**
   * A plate of tonight's view.
   *
   * Lives here rather than in the hook: the hook owns the facts and the App
   * owns the canvas, and handing a live DOM node into a store hook so it can
   * hand it straight back out would be the wrong way round.
   */
  const postcard = useCallback(() => {
    const cv = worldRef.current;
    if (!cv) return;
    downloadPostcard(drawPostcard(cv, {
      night: nw.tonight.key,
      weather: nw.weather,
      minutes: nw.tonight.minutes,
      sessions: nw.tonight.count,
      streak: nw.streak,
    }), nw.tonight.key);
  }, [nw.tonight, nw.weather, nw.streak]);

  const commands = useMemo(() => buildCommands({
    phase: nw.session.phase,
    held,
    settings: nw.data.settings,
    quarry: nw.data.quarry,
    selectedId: nw.session.quarryId,
    ledgerWide,
    zen,
    actions: nw.actions,
    ui: {
      toggleSettings: () => setSettingsOpen((o) => !o),
      toggleLedger: () => setLedgerWide((o) => !o),
      toggleZen: () => setZen((o) => !o),
      exportLedger: nw.actions.exportLedger,
      importLedger: () => fileRef.current?.click(),
      postcard,
    },
  }), [nw.session.phase, held, nw.session.quarryId, nw.data.settings, nw.data.quarry, nw.actions, ledgerWide, zen, postcard]);

  return (
    <>
      <World
        values={nw.values}
        progress={nw.progress}
        motion={nw.motion}
        weather={nw.weather}
        deckTop={deckTop}
        zen={zen}
        onSkip={(bounces) => { if (bounces >= 5) nw.actions.note('stone'); }}
        onCanvas={(el) => { worldRef.current = el; }}
      />
      <main className="app">
        {/* The page had three h2 panels and nothing above them, so a screen
            reader's heading list started at level two with no subject. It is
            visually hidden rather than drawn: the title belongs in the header
            bar below, and two of them would be one too many. */}
        <h1 className="sr-only">{COPY.title}</h1>
        <Header
          streak={nw.streak}
          line={nw.recovered ? COPY.storeRecovered : ambientLine({
            phase: nw.session.phase,
            progress: nw.progress,
            hasQuarry: selected !== null,
            bloodmoon: nw.grades.includes('bloodmoon'),
          })}
        />
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
            onExport={nw.actions.exportLedger}
            onImport={() => fileRef.current?.click()}
            onStart={nw.actions.start}
            onStop={nw.actions.stop}
            onSkip={nw.actions.skip}
            held={held}
            onToggleHold={nw.actions.toggleHold}
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
            huntMinutes={nw.data.settings.huntMinutes}
            onEstimate={nw.actions.estimateQuarry}
          />
          <TheLedger
            rows={nw.ledger}
            grid={nw.nightsGrid}
            hours={nw.hours}
            peakHour={nw.peakHour}
            quarryTotals={nw.quarryTotals}
            streak={nw.streak}
            best={nw.best}
            totals={nw.totals}
            days={nw.retentionDays}
            notes={nw.data.notes}
            view={ledgerWide ? 'window' : 'week'}
            onToggleView={() => setLedgerWide((o) => !o)}
          />
        </div>
      </main>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="sr-only"
        aria-label={COPY.cmd.importLedger}
        onChange={async (e) => {
          const f = e.target.files?.[0];
          // Cleared either way, so choosing the SAME file twice still fires a
          // change event the second time.
          e.target.value = '';
          if (f) nw.actions.importLedger(await f.text());
        }}
      />
      <Palette open={paletteOpen} commands={commands} onClose={() => setPaletteOpen(false)} />
      <div className="grain" />
      <div className="scanlines" />
      <div className="vignette" />
    </>
  );
}
