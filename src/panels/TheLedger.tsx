import { useState } from 'react';
import { Button } from '../components/Button';
import { Meter } from '../components/Meter';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';

/**
 * Five bands of ink, zero included.
 *
 * A continuous opacity ramp would be the obvious thing and it is the wrong one:
 * the world layer is flat stepped values everywhere — the value ladder, the
 * dithered river, the stepped roofs — and a smooth gradient in the chrome would
 * be the only continuous tone on screen. Five is also as many steps as anyone
 * can actually rank by eye at this cell size.
 */
const BANDS = 4;

function band(minutes: number, peak: number): number {
  if (minutes <= 0) return 0;
  // `ceil` so ANY kept night lights at least the first band. A night with ten
  // minutes on it rounding down to the same empty cell as a night with none is
  // the one thing a grid like this must never do.
  return Math.min(BANDS, Math.ceil((minutes / peak) * BANDS));
}

export function TheLedger({
  rows, grid, quarryTotals, streak, best, totals, days,
}: {
  rows: readonly { key: string; minutes: number }[];
  grid: readonly { key: string; minutes: number }[];
  quarryTotals: readonly { name: string; minutes: number }[];
  streak: number;
  best: number;
  totals: { minutes: number; nights: number };
  days: number;
}) {
  const [view, setView] = useState<'week' | 'window'>('week');
  const empty = totals.minutes === 0;
  const peak = Math.max(60, ...rows.map((r) => r.minutes));
  const gridPeak = Math.max(60, ...grid.map((r) => r.minutes));

  return (
    <Panel
      title="The Ledger"
      index={2}
      float
      tools={!empty && (
        <Button onClick={() => setView((v) => (v === 'week' ? 'window' : 'week'))}>
          {view === 'week' ? COPY.ledger.toWindow : COPY.ledger.toWeek}
        </Button>
      )}
    >
      {empty ? <p className="label">{COPY.ledgerEmpty}</p> : view === 'week' ? (
        <>
          {rows.map((r) => (
            <div key={r.key} className="ledger__row">
              <span className="label ledger__day">{r.key.slice(5)}</span>
              <div style={{ flex: 1 }}>
                <Meter value={r.minutes / peak} label={`${r.key}: ${r.minutes} menit`} />
              </div>
            </div>
          ))}
          <hr className="divider" />
          <p className="label">
            {COPY.ledger.streak(streak)} · {COPY.ledger.week(rows.reduce((s, r) => s + r.minutes, 0))}
          </p>
        </>
      ) : (
        <>
          {/* One cell per retained night. The column count is left to CSS — the
              panel's width is the only thing entitled to decide it. */}
          <div className="heat" role="img" aria-label={COPY.ledger.heatLabel(days, totals.nights)}>
            {grid.map((n) => (
              <i key={n.key} className="heat__cell" data-band={band(n.minutes, gridPeak)} title={`${n.key} · ${n.minutes}m`} />
            ))}
          </div>
          <hr className="divider" />
          {quarryTotals.slice(0, 4).map((q) => (
            <div key={q.name} className="ledger__row">
              <span className="label ledger__quarry">{q.name}</span>
              <span className="label">{q.minutes}m</span>
            </div>
          ))}
          {quarryTotals.length > 0 && <hr className="divider" />}
          <p className="label">
            {COPY.ledger.best(best)} · {COPY.ledger.window(totals.minutes, totals.nights, days)}
          </p>
        </>
      )}
    </Panel>
  );
}
