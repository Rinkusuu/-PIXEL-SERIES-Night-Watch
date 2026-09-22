import { useEffect, useRef } from 'react';
import { Button } from '../components/Button';
import { COPY } from '../app/copy';
import { motionLabel } from '../app/motion';
import { HUNT_RANGE, RESPITE_RANGE, type Alerts, type Settings as S } from '../store/schema';

/**
 * Settings, folded into The Watch rather than given a fourth card.
 *
 * The grid is four columns and The Watch spans two, so three cards fill the row
 * exactly. A fourth would wrap to a second row, which moves `.grid`'s top edge
 * — and `App.tsx` measures that edge to place the balustrade. A settings panel
 * would therefore have redrawn the world's whole composition to hold six
 * controls. It belongs inside the card whose subject it is.
 */
export function Settings({
  settings, open, onDurations, onToggleAlert, onCycleMotion, onExport, onImport,
}: {
  settings: S;
  open: boolean;
  onDurations: (hunt: number, respite: number) => void;
  onToggleAlert: (key: keyof Alerts) => void;
  onCycleMotion: () => void;
  onExport: () => void;
  onImport: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // The card is a fixed grid row, so opening this pushes it past the body's
  // edge and the whole fold lands below the fold — pressing the button looked
  // like it did nothing at all. The body is the scroll container; this brings
  // the fold into it.
  useEffect(() => {
    if (!open) return;
    ref.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [open]);

  if (!open) return null;
  const { huntMinutes: hunt, respiteMinutes: respite, alerts } = settings;

  return (
    <div className="settings" ref={ref}>
      <hr className="divider" />

      <label className="settings__row">
        <span className="label">{COPY.settings.hunt}</span>
        <input
          className="well settings__num"
          type="number"
          value={hunt}
          min={HUNT_RANGE.min}
          max={HUNT_RANGE.max}
          // Committed on change, then clamped by the action — typing "5" on the
          // way to "50" must not be rejected mid-keystroke, and the store is
          // the wrong place to enforce a range the user is still typing into.
          onChange={(e) => onDurations(Number(e.target.value), respite)}
        />
      </label>

      <label className="settings__row">
        <span className="label">{COPY.settings.respite}</span>
        <input
          className="well settings__num"
          type="number"
          value={respite}
          min={RESPITE_RANGE.min}
          max={RESPITE_RANGE.max}
          onChange={(e) => onDurations(hunt, Number(e.target.value))}
        />
      </label>

      <hr className="divider" />

      <div className="settings__row">
        <span className="label">{COPY.settings.alerts}</span>
        <div className="settings__opts">
          {(['title', 'chime', 'notify'] as const).map((k) => (
            <Button key={k} onClick={() => onToggleAlert(k)} pressed={alerts[k]}>
              {COPY.settings.alertNames[k]}
            </Button>
          ))}
        </div>
      </div>

      <div className="settings__row">
        <span className="label">{COPY.settings.data}</span>
        <div className="settings__opts">
          <Button onClick={onExport}>{COPY.settings.save}</Button>
          <Button onClick={onImport}>{COPY.settings.load}</Button>
        </div>
      </div>

      <div className="settings__row">
        <span className="label">{COPY.settings.motion}</span>
        <div className="settings__opts">
          <Button onClick={onCycleMotion}>{motionLabel(settings.motion)}</Button>
        </div>
      </div>
    </div>
  );
}
