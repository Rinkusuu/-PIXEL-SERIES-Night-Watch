import { Button } from '../components/Button';
import { Digits } from '../components/Digit';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { Ico } from '../components/Ico';
import { COPY, ambientLine, formatClock } from '../app/copy';
import { motionLabel } from '../app/motion';
import type { Phase } from '../session/machine';
import type { Settings } from '../store/schema';

export function TheWatch({
  phase, progress, remainingMs, quarryName, bloodmoon, motionSetting,
  onStart, onStop, onSkip, onCycleMotion,
}: {
  phase: Phase;
  progress: number;
  remainingMs: number;
  quarryName: string | null;
  bloodmoon: boolean;
  motionSetting: Settings['motion'];
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
          onClick={onCycleMotion}
          title={motionLabel(motionSetting)}
          aria-label={motionLabel(motionSetting)}
        >
          <Ico name="motion" />
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
    </Panel>
  );
}
