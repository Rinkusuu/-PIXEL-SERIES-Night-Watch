# Night Watch — Desain

**Tanggal:** 2026-07-27
**Gaya:** `../../../../Ideas/gaslamp-dna.md` (addendum) di atas `../../../../Useless Dashboard/DNA.md` (induk)
**Status:** disetujui, siap dibuat rencana implementasi

---

## 1. Apa ini

Timer kerja fokus yang menampilkan dirinya sebagai satu malam berjaga di London abad
sembilan belas. Satu sesi kerja = perjalanan dari senja ke fajar. Seluruh palet aplikasi
bergeser mengikuti progres sesi, bukan mengikuti jam dinding.

Tiga bagian: **The Watch** (timer), **The Quarry** (daftar tugas), **The Ledger** (riwayat
dan streak).

**Bukan:** manajer proyek, aplikasi kolaborasi, atau pelacak waktu untuk penagihan. Satu
pengguna, satu perangkat, tanpa akun, tanpa server.

## 2. Kenapa ketiganya, bukan timer saja

Timer sendirian tidak bisa membenarkan `bloodmoon`. State ambient paling dramatis di aplikasi
ini dipicu streak — dan streak tidak punya arti tanpa riwayat yang tercatat. The Ledger ada
supaya The Watch punya taruhan.

The Quarry ada karena sesi tanpa sasaran tidak menghasilkan data yang layak dicatat. Menit
yang menempel ke satu buruan bisa dibaca kembali; menit yang mengambang tidak.

---

## 3. Kontrak hybrid

Aturan lengkap ada di `Ideas/gaslamp-dna.md` §B. Ringkasnya untuk projek ini:

| | Lapis Dunia | Lapis Chrome |
|---|---|---|
| Medium | satu `<canvas>` full-viewport, `position: fixed`, `z-index: 0` | DOM, `z-index: 1` |
| Bahasa | ukiran — arsiran garis, resolusi penuh | pixel-glass DNA, grid 4px |
| Isi | atap London, cerobong, asap, kabut, lentera, bulan | tiga panel kaca |
| Larangan | tidak pernah ada teks | tidak pernah ada arsiran |

Batas antar-lapis adalah `backdrop-filter: blur(18px)` pada panel. Tidak ada border tambahan
untuk "memisahkan panel dari latar".

---

## 4. Skalar ambient

### 4.1 Sumber

```
nightProgress = elapsed / duration    // 0..1, hanya saat state 'hunt'
```

Saat `idle`, `nightProgress` bertahan di 0 (senja abadi, menunggu). Saat `respite`, ia
**membeku** di nilai terakhir — istirahat tidak memajukan malam, tapi juga tidak memundurkan
langit yang sudah gelap.

Kalau `duration` diubah pengguna di tengah sesi, `nightProgress` dihitung ulang dari
`elapsed / durationBaru` dan langsung di-ease ke nilai barunya lewat transisi warna biasa —
tidak ada penanganan khusus.

### 4.2 Keyframe

Lima keyframe, jarak sengaja tidak seragam (DNA §3.3 — rapat di tempat perubahan cepat).

| `at` | Nama | Langit (zenith → tengah → horizon) | glow | lum | Rasa |
|---|---|---|---|---|---|
| 0.00 | senja | `#2b2233` `#4a3450` `#8a5a4e` | `#ffb347` | 0.46 | ungu jelaga, horizon masih hangat |
| 0.35 | lampu menyala | `#161c2a` `#26303f` `#4a4a52` | `#ffb347` | 0.30 | gas lamp hidup satu per satu |
| 0.62 | kabut tebal | `#0f141c` `#1a2430` `#2b3740` | `#ffc46b` | 0.18 | kontras jatuh, lentera satu-satunya warna |
| 0.85 | witching hour | `#080b11` `#0e1218` `#161e26` | `#ffb347` | 0.08 | paling gelap, bulan tinggi |
| 1.00 | fajar | `#1b2733` `#33465a` `#7d8a92` | `#cfd8dc` | 0.52 | dingin, pucat, kabut naik |

Catatan yang penting: **glow di 0.62 justru lebih terang** (`#ffc46b`). Saat kabut paling
tebal, lampu gas tampak lebih kuning karena hamburan. Ini dilukis, bukan dihitung
(DNA §3.3).

Di `at: 1.00` glow berubah dingin — fajar mematikan lampu gas. Itu hadiah visual untuk sesi
yang selesai, dan satu-satunya momen di seluruh aplikasi dengan key light dingin.

Interpolasi `smoothstep`, tulis 4 Hz, tujuh custom property (DNA §3.1, §3.4).

### 4.3 Grade — dimensi kedua

Menggradasi hasil interpolasi, tidak menukar palet (DNA §3.4).

```js
const GRADE = {
  calm:      { desat: 0,    dark: 1,    tint: null,      tintAmt: 0    },
  pressed:   { desat: 0.18, dark: 0.92, tint: null,      tintAmt: 0    },
  bloodmoon: { desat: 0.10, dark: 0.88, tint: '#8c2f3a', tintAmt: 0.16 },
};
```

- `calm` — default.
- `pressed` — lima menit terakhir sesi. Perubahannya kecil dan sengaja nyaris tak disadari:
  saturasi turun sedikit, kabut merapat. Pengguna merasa waktu menipis tanpa diberi tahu.
- `bloodmoon` — streak ≥ 5 malam. Tint darah tumpul masuk ke glow dan ke bulan. `tintAmt`
  0.16 sudah cukup; di atas 0.3 seluruhnya berubah jadi merah dan berhenti terbaca sebagai
  London.

`bloodmoon` dan `pressed` bisa aktif bersamaan; efeknya ditumpuk, bukan saling menggantikan.

Peringatan `Ideas/gaslamp-dna.md` §D.1 berlaku penuh: kombinasi paling gelap yang mungkin
adalah `witching hour + bloodmoon`. Tune di sana, dan pastikan lentera tetap menyala penuh.

---

## 5. Lapis dunia

### 5.1 Isi

Empat lapis kedalaman, sudut arsiran tetap per lapis (`gaslamp-dna.md` §C.2):

1. **Langit** — gradien tiga stop dari keyframe. Satu-satunya bagian yang **tidak** diarsir;
   langit adalah kertas kosong. Bulan sebagai cakram `--amb-glow` redup dengan halo lebar,
   posisinya naik mengikuti `nightProgress`.
2. **Kota jauh** (`angle: -0.42`) — siluet menara dan cerobong, arsiran renggang, nilai
   0.3–0.45. Hampir hilang saat kabut tebal.
3. **Atap tengah** (`angle: -0.95`) — deretan atap dan jendela. **Jendela adalah lubang di
   arsiran**, diisi `--amb-glow` lalu diberi bloom. Jumlah jendela menyala naik dari 2 di
   `at 0.0` ke ~14 di `at 0.62`, lalu turun lagi menuju fajar.
4. **Depan** (`angle: +0.30`) — pagar besi dan satu tiang lentera di kiri bawah. Arsiran
   paling pekat, nilai 0.7–0.85 (masuk wilayah cross-hatch).

**Kabut** — dua-tiga lapis gradien horizontal semi-transparan berwarna `--amb-accent` yang
hanyut pelan ke arah berlawanan dengan kecepatan berbeda. Opasitasnya diikat ke
`1 - --amb-lum`. Ini satu-satunya elemen dunia yang bergerak besar.

**Asap cerobong** — beberapa partikel lambat naik dari cerobong tengah. Dimatikan penuh saat
`--motion: 0`.

### 5.2 Anggaran render

Lapis 1–4 statis untuk `nightProgress` tertentu. Digambar ke `OffscreenCanvas` dan
di-`drawImage` per frame. Digambar ulang hanya saat:

- resize (di-debounce 150 ms), atau
- salah satu kanal `--amb-mid` bergeser > 6/255 sejak gambar terakhir.

Per frame yang benar-benar dihitung ulang: kabut, denyut lentera, partikel asap. Target
≤ 4 ms per frame.

### 5.3 Reduced motion

`--motion: 0` menjangkau ke canvas juga (DNA §8.1 — ini eksplisit disebut sebagai jebakan).
Saat 0: kabut berhenti hanyut, partikel mati, denyut lentera berhenti. **Palet tetap
bergeser** — dunia masih bernapas lewat warna. Diam bukan berarti mati.

---

## 6. Panel

### 6.1 The Watch

Panel utama, hero. Berisi:

- Angka hero `MM:SS`, muka display, `clamp(28px, 5.2vw, 54px)`, dua bayangan teks (DNA §7.2).
  Digit-flip hanya pada digit yang benar-benar berubah (DNA §8.6).
- Satu kalimat status ambient di bawahnya, huruf kecil (§7 di bawah).
- Meter progres malam (DNA §9.4) — sumur gelap, isian gradien accent→glow, kilau berjalan.
- Tombol: `MULAI` / `HENTI` / `LEWATI`. Semua notched, turun saat ditekan (DNA §5.4).
- Nama buruan aktif, kecil, di atas angka. Kosong kalau tidak ada yang dipilih.

Panel ini **mengambang** (DNA §8.5) — tombolnya besar, aman.

### 6.2 The Quarry

Daftar buruan. Berisi:

- Input tambah buruan.
- Daftar: nama + total menit terkumpul + tombol pilih/selesai.
- Yang selesai dicoret, tetap terlihat sampai dibersihkan manual.
- Satu buruan bisa dipilih sebagai sasaran sesi berikutnya.

Panel ini **tidak mengambang** (DNA §8.5 — ada kontrol halus di dalamnya).

### 6.3 The Ledger

Riwayat. Berisi:

- Tujuh hari terakhir sebagai baris meter horizontal, panjang = total menit hari itu.
- Streak berjalan, ditulis sebagai `streak 6 malam`.
- Total menit minggu ini.

Bar hari ini berdenyut pelan (spark DNA §6.4) supaya terbaca sebagai baris yang masih hidup.

### 6.4 Tata letak

Grid DNA §6.3. Di ≥900px: The Watch `span-2 row-2`, Quarry dan Ledger menumpuk di kanan.
Di bawah 900px: tiga panel bertumpuk, The Watch di atas.

---

## 7. Nada tulisan

`Ideas/gaslamp-dna.md` §E.2. Setiap state punya kalimatnya sendiri, ditulis tangan.

| State | Kalimat |
|---|---|
| idle, ada buruan | `the lamps are unlit.` |
| idle, tanpa buruan | `no quarry named. the street is quiet.` |
| hunt, 0–0.35 | `the lamps are lit.` |
| hunt, 0.35–0.62 | `the fog comes up off the river.` |
| hunt, 0.62–0.85 | `nothing moves but the fog.` |
| hunt, 0.85–1.0 | `the hour holds.` |
| selesai | `dawn. the watch is kept.` |
| respite | `the watch rests. the fog does not.` |
| bloodmoon aktif | `the moon has turned.` |
| Quarry kosong | `no quarry named.` |
| Ledger kosong | `the ledger is blank. nothing kept yet.` |
| store rusak | `the ledger was water-damaged. starting a clean page.` |

Label kontrol tetap jelas: `MULAI`, `HENTI`, `LEWATI`, `TAMBAH`. Tidak dipuisikan
(`gaslamp-dna.md` §E.2, rem).

---

## 8. Struktur kode

```
NightWatch/
  index.html
  src/
    main.tsx
    style/
      tokens.css          satu-satunya file berisi nilai literal (DNA §4 + addendum §D)
      base.css            reset, body, scanline, vignette, grain
      components.css      panel, meter, button, digit, ico
    ambient/
      keyframes.ts        tabel §4.2
      grade.ts            tabel §4.3
      interpolate.ts      smoothstep, mixRgb, resolve(progress, grade) → 8 nilai
      driver.ts           timer 4 Hz, tulis custom property ke :root
    world/
      canvas.tsx          komponen React tipis: mount, resize, rAF
      hatch.ts            fungsi arsiran (addendum §C.1)
      layers.ts           langit, kota jauh, atap, depan → OffscreenCanvas
      fog.ts              lapis kabut hanyut
      bloom.ts            buffer glow (DNA §9.2 cara penuh)
      grain.ts            generator noise 128×128 → data URI, sekali saat boot
    session/
      machine.ts          mesin state timer, murni, tanpa React
      streak.ts           hitung streak melewati tengah malam
      aggregate.ts        total per hari, per buruan
    store/
      schema.ts           tipe + versi
      persist.ts          baca/tulis localStorage, migrasi, pemulihan
    components/
      Panel.tsx  Meter.tsx  Button.tsx  Digit.tsx  Ico.tsx
    panels/
      TheWatch.tsx  TheQuarry.tsx  TheLedger.tsx
```

### 8.1 Batas antar-modul

- `ambient/` tidak tahu apa pun tentang sesi. Antarmukanya:
  `resolve(progress: number, grade: Grade) → AmbientValues`. Bisa diuji tanpa DOM.
- `world/` tidak tahu apa pun tentang React atau state aplikasi. Ia menerima
  `AmbientValues` + ukuran, mengembalikan gambar.
- `session/` murni fungsi. Tidak menyentuh `Date.now()` secara langsung — waktu masuk sebagai
  argumen, supaya bisa diuji deterministik.
- `store/` satu-satunya yang menyentuh `localStorage`.

### 8.2 Stack

**Vite + React 19 + TypeScript. Tanpa Tailwind.**

- Aplikasi 100% klien: canvas, timer, localStorage. Next.js tidak memberi apa pun di sini
  selain berat build dan konsep server yang tidak dipakai.
- Tailwind dilewati karena melawan DNA secara langsung: frame ter-notch butuh empat
  `box-shadow` kustom, dan seluruh sistem warnanya adalah custom property yang ditulis ulang
  saat runtime — dua hal yang justru paling tidak nyaman diungkapkan lewat utility class.
- CSS ditulis tangan, satu file token, komponen memakai class biasa.

Ini menyimpang dari stack `Portofolio/` (Next + Tailwind). Disengaja, dan alasannya di atas.

---

## 9. Data

```ts
type Schema = {
  version: 1;
  quarry: { id: string; name: string; minutes: number; done: boolean; createdAt: number }[];
  sessions: { startedAt: number; minutes: number; quarryId: string | null }[];
  settings: { huntMinutes: number; respiteMinutes: number; motion: 'auto' | 'on' | 'off' };
};
```

Satu kunci localStorage: `nightwatch:v1`.

**Pemulihan:** kalau parse gagal atau `version` tidak dikenal, mulai dari state kosong dan
tampilkan kalimat store-rusak (§7). Tidak melempar, tidak menghapus data lama — data lama
dipindahkan ke `nightwatch:corrupt:<timestamp>` supaya bisa diselamatkan manual.

**Retensi:** `sessions` dipangkas ke 90 hari terakhir saat tulis. The Ledger cuma butuh 7,
streak butuh rantai berjalan; 90 memberi ruang tanpa membuat localStorage membengkak.

---

## 10. Waktu dan kegagalan

- Timer dihitung dari `startedAt` + `Date.now()`, **bukan** dari akumulasi `setInterval`.
  Tab yang di-background, laptop yang tidur, atau frame yang dilewati tidak menggeser waktu.
- Kembali ke tab setelah lama: hitung ulang, dan kalau `elapsed > duration`, sesi langsung
  masuk state selesai — bukan menyala lewat batas.
- Tidak ada banner error (DNA §11). Kegagalan store didegradasikan lewat kalimat di panel,
  bukan lewat pita merah.
- Batas malam untuk streak: pukul 04:00 lokal, bukan tengah malam. Sesi yang selesai pukul
  01:30 masih dihitung sebagai malam kemarin — itu yang cocok dengan cara orang bekerja
  malam, dan cocok dengan temanya.

---

## 11. Pengujian

Vitest, hanya untuk yang murni. Visual tidak di-unit-test.

| Modul | Yang diuji |
|---|---|
| `ambient/interpolate` | smoothstep di batas keyframe, di antara keyframe, di luar rentang; grade menumpuk (`pressed` + `bloodmoon`); permukaan tetap gelap di setiap state |
| `session/machine` | transisi `idle→hunt→respite→idle`; lewati; ubah durasi di tengah sesi; elapsed melewati durasi |
| `session/streak` | rantai berjalan; putus; batas 04:00; dua sesi di malam yang sama tidak menghitung dua kali; zona waktu bergeser |
| `store/persist` | tulis-baca pulang-pergi; JSON rusak; versi tak dikenal; pemangkasan 90 hari |
| `world/hatch` | kerapatan naik monoton terhadap value; cross-hatch hanya di atas 0.66 |

Visual diverifikasi manual lewat checklist DNA §14 plus `Ideas/gaslamp-dna.md` §G.

---

## 12. Di luar lingkup

Ditulis eksplisit supaya tidak merayap masuk:

- Akun, sinkronisasi, server, multi-perangkat
- Suara dan musik
- Notifikasi browser
- Ekspor data, integrasi kalender
- Tema terang
- Tugas bersarang, tenggat, prioritas, tag
- Statistik di luar 7 hari + streak
