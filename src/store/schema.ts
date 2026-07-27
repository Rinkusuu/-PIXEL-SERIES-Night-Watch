export const STORAGE_KEY = 'nightwatch:v1';
export const CORRUPT_PREFIX = 'nightwatch:corrupt:';
/** The Ledger needs 7 days, the streak needs the running chain. 90 gives room
    without letting localStorage grow forever. Spec §9. */
export const RETENTION_DAYS = 90;

export type Quarry = {
  id: string;
  name: string;
  minutes: number;
  done: boolean;
  createdAt: number;
};

export type SessionRecord = {
  startedAt: number;
  minutes: number;
  quarryId: string | null;
};

export type Settings = {
  huntMinutes: number;
  respiteMinutes: number;
  motion: 'auto' | 'on' | 'off';
};

export type Schema = {
  version: 1;
  quarry: Quarry[];
  sessions: SessionRecord[];
  settings: Settings;
};

export function emptySchema(): Schema {
  return {
    version: 1,
    quarry: [],
    sessions: [],
    settings: { huntMinutes: 50, respiteMinutes: 10, motion: 'auto' },
  };
}
