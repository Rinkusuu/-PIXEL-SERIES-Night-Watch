import { Button } from '../components/Button';
import { Digits } from '../components/Digit';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { COPY, ambientLine, formatClock } from '../app/copy';
import type { Phase } from '../session/machine';

export function TheWatch({
  phase, progress, remainingMs, quarryName, bloodmoon, onStart, onStop, onSkip,
}: {
  phase: Phase;
  progress: number;
  remainingMs: number;
  quarryName: string | null;
  bloodmoon: boolean;
  onStart: () => void;
  onStop: () => void;
  onSkip: () => void;
}) {
  const line = ambientLine({ phase, progress, hasQuarry: quarryName !== null, bloodmoon });

  return (
    <Panel title="The Watch" index={0} float className="span-2 row-2">
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
