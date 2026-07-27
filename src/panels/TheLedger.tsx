import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';

export function TheLedger({
  rows, streak,
}: {
  rows: readonly { key: string; minutes: number }[];
  streak: number;
}) {
  const peak = Math.max(60, ...rows.map((r) => r.minutes));
  const total = rows.reduce((sum, r) => sum + r.minutes, 0);
  const empty = total === 0;

  return (
    <Panel title="The Ledger" index={2} float>
      {empty
        ? <p className="label">{COPY.ledgerEmpty}</p>
        : (
          <>
            {rows.map((r, i) => (
              <div key={r.key} style={{ display: 'flex', alignItems: 'center', gap: 'var(--px2)', padding: 'var(--px) 0' }}>
                <span className="label" style={{ width: '5.5em' }}>{r.key.slice(5)}</span>
                <div style={{ flex: 1 }}>
                  <Meter value={r.minutes / peak} label={`${r.key}: ${r.minutes} menit`} />
                </div>
                {i === rows.length - 1 && <span className="panel__spark" />}
              </div>
            ))}
            <hr className="divider" />
            <p className="label">streak {streak} malam · {total}m minggu ini</p>
          </>
        )}
    </Panel>
  );
}
