import type { Phase } from '../session/machine';
import type { Quarry, Settings } from '../store/schema';
import { COPY } from './copy';

/**
 * Every action in the app, as one list.
 *
 * The rule that makes a palette worth having rather than merely present: each
 * `run` calls the SAME function the button calls. Nothing here reimplements
 * anything, so there is no second copy to drift out of step with the first —
 * which is the failure mode that turns a palette into a museum of commands
 * that used to work.
 *
 * It is a function of the current state rather than a constant, because half
 * these labels are a reading of that state. "Henti" is not a different command
 * from "Mulai"; it is the same button, and the palette should say what it will
 * actually do if you press it now.
 */
export type Command = {
  /** Stable across renders, so React can key the list. */
  id: string;
  label: string;
  hint: string;
  run: () => void;
};

export type CommandInput = {
  phase: Phase;
  /** Whether the watch is currently held. Changes this list, not just a label. */
  held: boolean;
  settings: Settings;
  quarry: readonly Quarry[];
  selectedId: string | null;
  ledgerWide: boolean;
  zen: boolean;
  actions: {
    start: () => void;
    stop: () => void;
    skip: () => void;
    selectQuarry: (id: string | null) => void;
    setDurations: (hunt: number, respite: number) => void;
    toggleAlert: (key: 'title' | 'chime' | 'notify') => void;
    cycleMotion: () => void;
    toggleHold: () => void;
  };
  ui: {
    toggleSettings: () => void;
    toggleLedger: () => void;
    toggleZen: () => void;
    exportLedger: () => void;
    importLedger: () => void;
    postcard: () => void;
  };
};

/** Minutes offered as one-press presets. Anything else is typed in settings. */
const PRESETS: readonly [number, number][] = [[25, 5], [50, 10], [90, 15]];

export function buildCommands(i: CommandInput): Command[] {
  const c: Command[] = [];

  c.push(i.phase === 'idle'
    ? { id: 'start', label: COPY.cmd.start, hint: COPY.cmd.startHint, run: i.actions.start }
    : { id: 'stop', label: COPY.cmd.stop, hint: COPY.cmd.stopHint, run: i.actions.stop });

  if (i.phase !== 'idle') {
    // Above `skip`, because holding is the thing you reach for when you have to
    // step away, and skipping is the thing you reach for when you have given up.
    c.push(i.held
      ? { id: 'unhold', label: COPY.cmd.unhold, hint: COPY.cmd.unholdHint, run: i.actions.toggleHold }
      : { id: 'hold', label: COPY.cmd.hold, hint: COPY.cmd.holdHint, run: i.actions.toggleHold });
    c.push({ id: 'skip', label: COPY.cmd.skip, hint: COPY.cmd.skipHint, run: i.actions.skip });
  }

  c.push({
    id: 'postcard',
    label: COPY.cmd.postcard,
    hint: COPY.cmd.postcardHint,
    run: i.ui.postcard,
  });

  c.push({
    id: 'zen',
    label: i.zen ? COPY.cmd.zenOff : COPY.cmd.zenOn,
    hint: COPY.cmd.zenHint,
    run: i.ui.toggleZen,
  });

  // Quarry. The selected one offers to be put down rather than picked up
  // again — a command that does nothing is worse than one that is missing.
  for (const q of i.quarry) {
    const on = q.id === i.selectedId;
    c.push({
      id: `q:${q.id}`,
      label: on ? COPY.cmd.dropQuarry(q.name) : COPY.cmd.takeQuarry(q.name),
      hint: on ? COPY.cmd.dropQuarryHint : COPY.cmd.takeQuarryHint,
      run: () => i.actions.selectQuarry(on ? null : q.id),
    });
  }

  for (const [hunt, respite] of PRESETS) {
    if (hunt === i.settings.huntMinutes && respite === i.settings.respiteMinutes) continue;
    c.push({
      id: `dur:${hunt}`,
      label: COPY.cmd.durations(hunt),
      hint: COPY.cmd.durationsHint(respite),
      run: () => i.actions.setDurations(hunt, respite),
    });
  }

  for (const key of ['title', 'chime', 'notify'] as const) {
    c.push({
      id: `alert:${key}`,
      label: COPY.cmd.alert(i.settings.alerts[key], COPY.settings.alertNames[key]),
      hint: COPY.cmd.alertHint,
      run: () => i.actions.toggleAlert(key),
    });
  }

  c.push({
    id: 'ledger',
    label: i.ledgerWide ? COPY.cmd.ledgerWeek : COPY.cmd.ledgerWindow,
    hint: COPY.cmd.ledgerHint,
    run: i.ui.toggleLedger,
  });
  c.push({
    id: 'motion',
    label: COPY.cmd.motion(i.settings.motion),
    hint: COPY.cmd.motionHint,
    run: i.actions.cycleMotion,
  });
  c.push({
    id: 'export',
    label: COPY.cmd.exportLedger,
    hint: COPY.cmd.exportHint,
    run: i.ui.exportLedger,
  });
  c.push({
    id: 'import',
    label: COPY.cmd.importLedger,
    hint: COPY.cmd.importHint,
    run: i.ui.importLedger,
  });
  c.push({
    id: 'settings',
    label: COPY.cmd.settings,
    hint: COPY.cmd.settingsHint,
    run: i.ui.toggleSettings,
  });

  return c;
}
