import { useState } from 'react';
import { Button } from '../components/Button';
import { Panel } from '../components/Panel';
import { COPY } from '../app/copy';
import type { Quarry } from '../store/schema';

export function TheQuarry({
  quarry, selectedId, onAdd, onSelect, onToggleDone,
}: {
  quarry: readonly Quarry[];
  selectedId: string | null;
  onAdd: (name: string) => void;
  onSelect: (id: string | null) => void;
  onToggleDone: (id: string) => void;
}) {
  const [draft, setDraft] = useState('');

  // NOT floating: you cannot hit a moving target. DNA §8.5.
  return (
    <Panel title="The Quarry" index={1}>
      <form
        onSubmit={(e) => { e.preventDefault(); onAdd(draft); setDraft(''); }}
        style={{ display: 'flex', gap: 'var(--px2)' }}
      >
        <input
          className="well"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          aria-label="nama buruan"
          style={{
            flex: 1, border: 0, color: 'var(--amb-ink)', padding: 'var(--px2)',
            fontFamily: 'var(--font-body)', fontSize: 'var(--fs-small)',
          }}
        />
        <Button onClick={() => { onAdd(draft); setDraft(''); }}>{COPY.labels.add}</Button>
      </form>

      <hr className="divider" />

      {quarry.length === 0
        ? <p className="label">{COPY.quarryEmpty}</p>
        : (
          <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {quarry.map((q) => (
              <li key={q.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--px2)', padding: 'var(--px) 0' }}>
                <Button
                  onClick={() => onSelect(selectedId === q.id ? null : q.id)}
                  pressed={selectedId === q.id}
                >
                  <span style={{ textDecoration: q.done ? 'line-through' : 'none' }}>{q.name}</span>
                </Button>
                <span className="label" style={{ marginLeft: 'auto' }}>{q.minutes}m</span>
                <input
                  type="checkbox"
                  checked={q.done}
                  onChange={() => onToggleDone(q.id)}
                  aria-label={`selesai: ${q.name}`}
                />
              </li>
            ))}
          </ul>
        )}
    </Panel>
  );
}
