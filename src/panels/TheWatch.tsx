import { Button } from '../components/Button';
import { Digits } from '../components/Digit';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { Ico } from '../components/Ico';
import { COPY, ambientLine, formatClock } from '../app/copy';
import { Settings as SettingsForm } from './Settings';
import type { Phase } from '../session/machine';
import type { Alerts, Settings } from '../store/schema';

export function TheWatch({
  phase, progress, remainingMs, quarryName, bloodmoon, settings,
  settingsOpen, onToggleSettings, onDurations, onToggleAlert,
  onStart, onStop, onSkip, onCycleMotion,
}: {
  phase: Phase;
  progress: number;
  remainingMs: number;
  quarryName: string | null;
  bloodmoon: boolean;
  settings: Settings;
  settingsOpen: boolean;
  onToggleSettings: () => void;
  onDurations: (hunt: number, respite: number) => void;
  onToggleAlert: (key: keyof Alerts) => void;
  onStart: () => void;
  onStop: () => void;
  onSkip: () => void;
  onCycleMotion: () => void;
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
          <Ico name="clock" />
        </button>
      }
    >
      {quarryName && <p className="label">{quarryName}</p>}
      <Digits text={formatClock(remainingMs)} />
      <p className="label">{line}</p>
      <Meter value={progress} label="night progress" />
      <div style={{ display: 'flex', gap: 'var(--px2)', marginTop: 'var(--px3)' }}>
        {phase === 'idle'
          ? <Button onClick={onStart}>{COPY.labels.start}</Button>
          : <Button onClick={onStop}>{COPY.labels.stop}</Button>}
        <Button onClick={onSkip} disabled={phase === 'idle'}>{COPY.labels.skip}</Button>
      </div>
      <SettingsForm
        settings={settings}
        open={settingsOpen}
        onDurations={onDurations}
        onToggleAlert={onToggleAlert}
        onCycleMotion={onCycleMotion}
      />
    </Panel>
  );
}
