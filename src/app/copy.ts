import type { Phase } from '../session/machine';

/**
 * Spec §7. Every state has a hand-written sentence; none are defaults.
 * The voice is a night watchman: it observes, it never encourages.
 *
 * ## Which language, and why there are two
 *
 * The original file was English throughout except for four button labels, and
 * that was not an oversight — it is the line this app is built on:
 *
 *   **The watch speaks English. The controls speak Indonesian.**
 *
 * The watchman is a Londoner in 1880 and the river is the Thames; his sentences
 * are his. The buttons are not his — they are yours, on your machine, in your
 * language. So every line that is the WATCH speaking is English (the ambient
 * sentences, the empty states, the ledger, the notes), and every label on a
 * thing you press is Indonesian (the four hard controls, the settings, the
 * palette's labels, hints and prompts).
 *
 * The rule went unwritten for most of this project's life and was quietly
 * broken twice: the night notes and the tagline were written in Indonesian,
 * and both are the watch speaking. `tests/app/copy.test.ts` enforces it now.
 */
export const COPY = {
  title: 'Night Watch',
  tagline: 'one night kept over the river.',
  idleWithQuarry: 'the lamps are unlit.',
  idleNoQuarry: 'no quarry named. the street is quiet.',
  dusk: 'the lamps are lit.',
  fog: 'the fog comes up off the river.',
  deep: 'nothing moves but the fog.',
  late: 'the hour holds.',
  done: 'dawn. the watch is kept.',
  respite: 'the watch rests. the fog does not.',
  respiteOver: 'the rest is over. the street waits.',
  bloodmoon: 'the moon has turned.',
  quarryEmpty: 'no quarry named.',
  ledgerEmpty: 'the ledger is blank. nothing kept yet.',
  storeRecovered: 'the ledger was water-damaged. starting a clean page.',
  settings: {
    hunt: 'panjang jaga (menit)',
    respite: 'panjang jeda (menit)',
    alerts: 'penanda',
    motion: 'gerak',
    data: 'ledger',
    save: 'SIMPAN',
    load: 'MUAT',
    alertNames: { title: 'JUDUL', chime: 'LONCENG', notify: 'NOTIF' },
  },
  /**
   * Palette labels. Lower case and observational like every other sentence
   * here — a command list is still the watchman speaking, not a control panel
   * shouting. The only upper case in this app is on the four hard controls.
   */
  cmd: {
    placeholder: 'apa yang dikerjakan malam ini…',
    empty: 'tidak ada yang cocok.',
    foot: '↑↓ pilih · ⏎ jalankan · esc tutup',
    start: 'mulai jaga', startHint: 'nyalakan lampu dan mulai hitung',
    stop: 'hentikan jaga', stopHint: 'catat yang sudah terkumpul',
    skip: 'lewati fase ini', skipHint: 'tanpa mencatat apa pun',
    hold: 'tahan jaga', holdHint: 'jam berhenti, menit yang sudah ada tetap',
    unhold: 'lanjutkan jaga', unholdHint: 'jam jalan lagi dari tempat ia ditahan',
    zenOn: 'masuk zen', zenOff: 'keluar dari zen',
    zenHint: 'sembunyikan semuanya; tinggal malamnya',
    takeQuarry: (n: string) => `ambil buruan: ${n.toLowerCase()}`,
    takeQuarryHint: 'waktu jaga ini dicatat atasnya',
    dropQuarry: (n: string) => `lepas buruan: ${n.toLowerCase()}`,
    dropQuarryHint: 'jaga tanpa nama',
    // Short label, detail in the hint. A row that wraps to two lines makes the
    // whole list ragged and costs more to scan than the words are worth.
    durations: (h: number) => `atur jaga ${h} menit`,
    durationsHint: (r: number) => `jeda ${r} menit · berlaku untuk jaga berikutnya`,
    alert: (on: boolean, name: string) =>
      `${on ? 'matikan' : 'nyalakan'} penanda ${name.toLowerCase()}`,
    alertHint: 'bagaimana akhir fase memberi tahu',
    ledgerWeek: 'ledger: tujuh malam terakhir',
    ledgerWindow: 'ledger: sembilan puluh malam',
    ledgerHint: 'ganti tampilan catatan',
    motion: (m: string) => `gerak: ${m === 'auto' ? 'ikuti sistem' : m === 'on' ? 'matikan' : 'nyalakan'}`,
    motionHint: 'dunia tetap digambar penuh; hanya gerakannya',
    settings: 'buka pengaturan', settingsHint: 'durasi, penanda, gerak',
    exportLedger: 'simpan ledger ke berkas',
    exportHint: 'seluruh riwayat sebagai json',
    importLedger: 'muat ledger dari berkas',
    importHint: 'digabung, tidak menimpa',
  },
  watch: {
    phase: 'fase',
    weather: 'langit',
    night: 'malam',
    since: 'mulai',
    sessions: 'sesi',
    kept: 'terkumpul',
    clockAt: (ts: number | null) => {
      if (ts === null) return '—';
      const d = new Date(ts);
      return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    },
  },
  phaseName: { idle: 'diam', hunt: 'berjaga', respite: 'jeda' } as const,
  /** Shown in place of the phase while the watch is held. */
  phaseHeld: 'tertahan',
  weatherName: { clear: 'cerah', fog: 'berkabut', rain: 'hujan', fullmoon: 'purnama' } as const,
  quarry: {
    rename: 'ubah nama',
    remove: 'hapus dari daftar (riwayat tetap)',
  },
  ledger: {
    noQuarry: 'belum ada buruan yang tercatat waktunya.',
    toWindow: '90 MALAM',
    toWeek: 'PEKAN',
    streak: (n: number) => `streak ${n} malam`,
    best: (n: number) => `rentetan terbaik ${n} malam`,
    week: (m: number) => `${m}m minggu ini`,
    window: (m: number, nights: number, days: number) =>
      `${Math.round(m / 60)} jam · ${nights} dari ${days} malam`,
    heatLabel: (days: number, nights: number) =>
      `${nights} malam berjaga dari ${days} malam terakhir`,
    hours: 'jam terkuat',
    hoursLabel: 'menit berjaga menurut jam, sepanjang malam',
    /** `04` reads as an hour; `4` reads as a count. */
    hourName: (h: number) => `${String(h).padStart(2, '0')}:00`,
    bestHour: (h: number, m: number) =>
      `paling kuat pukul ${String(h).padStart(2, '0')}:00 · ${m}m terkumpul di sana`,
    noHours: 'belum cukup jaga untuk tahu jam terkuatmu.',
  },
  keys: 'spasi: mulai/henti · h: tahan · s: lewati · ,: pengaturan',
  labels: {
    start: 'MULAI',
    stop: 'HENTI',
    skip: 'LEWATI',
    hold: 'TAHAN',
    unhold: 'LANJUT',
    add: 'TAMBAH',
  },
} as const;

export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ambientLine(input: {
  phase: Phase;
  progress: number;
  hasQuarry: boolean;
  bloodmoon: boolean;
}): string {
  if (input.phase === 'idle') {
    return input.hasQuarry ? COPY.idleWithQuarry : COPY.idleNoQuarry;
  }
  if (input.phase === 'respite') return COPY.respite;
  if (input.bloodmoon) return COPY.bloodmoon;
  if (input.progress >= 1) return COPY.done;
  if (input.progress >= 0.85) return COPY.late;
  if (input.progress >= 0.62) return COPY.deep;
  if (input.progress >= 0.35) return COPY.fog;
  return COPY.dusk;
}
