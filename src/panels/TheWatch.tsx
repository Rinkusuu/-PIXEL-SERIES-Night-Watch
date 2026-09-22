import { Button } from '../components/Button';
import { Digits } from '../components/Digit';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { Ico } from '../components/Ico';
import { COPY, ambientLine, formatClock } from '../app/copy';
import { Settings as SettingsForm } from './Settings';
import { Stat } from '../components/Stat';
import type { Phase } from '../session/machine';
import type { Alerts, Settings } from '../store/schema';
import type { Weather } from '../world/weather';

/** Only the running phase is worth an accent; idle is the absence of one. */
function phaseTone(phase: Phase): 'glow' | 'dusk' | undefined {
  if (phase === 'hunt') return 'glow';
  if (phase === 'respite') return 'dusk';
  return undefined;
}

export function TheWatch({
  phase, progress, remainingMs, quarryName, bloodmoon, settings, tonight, weather,
  settingsOpen, onToggleSettings, onDurations, onToggleAlert,
  onStart, onStop, onSkip, onCycleMotion, onExport, onImport,
}: {
  phase: Phase;
  progress: number;
  remainingMs: number;
  quarryName: string | null;
  bloodmoon: boolean;
  settings: Settings;
  tonight: { key: string; count: number; minutes: number; startedAt: number | null };
  weather: Weather;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onDurations: (hunt: number, respite: number) => void;
  onToggleAlert: (key: keyof Alerts) => void;
  onStart: () => void;
  onStop: () => void;
  onSkip: () => void;
  onCycleMotion: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const line = ambientLine({ phase, progress, hasQuarry: quarryName !== null, bloodmoon });

  return (
    <Panel
      title="The Watch"
      index={0}
      float
      className="span-2"
      tools={
        <button
          type="button"
          className="btn"
          onClick={onToggleSettings}
          aria-expanded={settingsOpen}
          title={COPY.keys}
          aria-label="pengaturan"
        >
          <Ico name="dial" />
        </button>
      }
    >
      <div className="watch">
        <div className="watch__main">
          {/* One block, so `space-between` pushes the CONTROLS to the foot of a
              tall card rather than airing out the clock's own parts. */}
          <div className="watch__clock">
            {quarryName && <p className="label">{quarryName}</p>}
            <Digits text={formatClock(remainingMs)} />
            <p className="label">{line}</p>
            <Meter value={progress} label="night progress" />
          </div>
          <div style={{ display: 'flex', gap: 'var(--px2)' }}>
            {phase === 'idle'
              ? <Button onClick={onStart}>{COPY.labels.start}</Button>
              : <Button onClick={onStop}>{COPY.labels.stop}</Button>}
            <Button onClick={onSkip} disabled={phase === 'idle'}>{COPY.labels.skip}</Button>
          </div>
        </div>

        {/* The facts the store already held and nothing ever displayed. The
            phase is the only one that gets an accent, because it is the only
            one that changes on its own while you are looking at it. */}
        <div className="watch__side">
          <Stat label={COPY.watch.phase} value={COPY.phaseName[phase]} tone={phaseTone(phase)} />
          <Stat label={COPY.watch.weather} value={COPY.weatherName[weather]} tone="dusk" />
          <Stat label={COPY.watch.night} value={tonight.key.slice(5)} />
          <Stat label={COPY.watch.since} value={COPY.watch.clockAt(tonight.startedAt)} />
          <Stat label={COPY.watch.sessions} value={tonight.count} />
          <Stat label={COPY.watch.kept} value={`${tonight.minutes}m`} tone="brass" />
        </div>
      </div>
      <SettingsForm
        settings={settings}
        open={settingsOpen}
        onDurations={onDurations}
        onToggleAlert={onToggleAlert}
        onCycleMotion={onCycleMotion}
        onExport={onExport}
        onImport={onImport}
      />
    </Panel>
  );
}
