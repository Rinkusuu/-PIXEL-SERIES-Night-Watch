# Night Watch — Detail Latar

**Tanggal:** 2026-07-29
**Gaya:** `../../../../Ideas/gaslamp-dna.md` (addendum) di atas `../../../../Useless Dashboard/DNA.md` (induk)
**Membangun di atas:** `2026-07-28-yharnam-pass-design.md`
**Status:** disetujui, siap dibuat rencana implementasi

---

## 1. Kenapa ini ada

Keluhannya satu kalimat: latar terbaca sebagai arsiran diagonal, bukan sebagai kota.

Itu bukan kecelakaan penyetelan. Sistem yang ada sekarang **dijamin** menghasilkan
gejala itu, dan jaminannya datang dari dua tempat yang keduanya sengaja dibangun
begitu.

### 1.1 Nilai pucat diterjemahkan jadi garis renggang

Addendum §C.1 menetapkan: gelap = garis rapat, terang = garis renggang. `gapFor()`
menjalankannya harfiah:

```
gap = maxGap − (maxGap − minGap) · value^0.72
```

Empat pemanggil, dengan `minGap` default 2:

| lapis | `value` | `maxGap` | gap nyata |
|---|---|---|---|
| kota jauh | 0.18 | 17 | **12.6 px** |
| kota dekat | 0.34 | 13 | **7.9 px** |
| jembatan hulu | 0.52 | 10 | 5.0 px |
| dek kaki | 0.74 | 9 | 3.4 px |

3.4 px terbaca sebagai nada. 12.6 px terbaca sebagai garis yang bisa dihitung satu per
satu. Tangga nilai dari `ladder.ts` menetapkan kota jauh harus paling pucat; `gapFor`
menerjemahkan pucat jadi renggang; hasilnya benda paling jauh di gambar otomatis
mendapat arsiran paling mencolok.

Itu kebalikan dari cara ukiran sungguhan bekerja. Di pelat tembaga, yang jauh justru
paling halus — garis tipis dan rapat. Yang renggang cuma sorotan paling terang, dan
itu pun area kecil, tidak pernah seluruh cakrawala.

### 1.2 Latar tidak punya arsitektur sama sekali

`drawSkyline()` menggambar dua detail untuk seluruh kota: tiga pot cerobong di `flat`,
satu jib di `crane`. `spire`, `dome`, `clockTower`, `factory`, `gable` tidak dapat
apa-apa. Tidak ada jendela di mana pun — dan titik cahaya jendela dari `lampSpots()`
mengarang koordinatnya sendiri, jadi cahaya mengambang di tembok polos.

Dengan begitu arsiran adalah satu-satunya tekstur di pita terbesar gambar. Tekstur
tanpa saingan naik pangkat jadi subjek.

### 1.3 Yang BUKAN penyebabnya

Fase garis antar-blok sudah beda: `hatch()` mem-`translate` ke pusat tiap blok sebelum
memutar, jadi dua blok bertetangga tidak pernah sefase. Efek "satu lembar bergaris"
murni datang dari sudut sama + fill sama + gap yang cukup lebar untuk dihitung mata.
Tidak ada fitur penggeser fase di pekerjaan ini.

---

## 2. Yang dibangun

Enam bagian. Semuanya hidup di pelat statis yang sudah di-cache, jadi ongkos per frame
nol; yang perlu dijaga cuma waktu bangun pelat saat resize atau ganti cuaca.

---

## 3. `hatch.ts` — rasio tinta menggantikan jarak

### 3.1 Amandemen §C.1

§C.1 tidak dibuang, ia diukur ulang. Yang membawa nada tetap **kerapatan tinta**, cuma
sekarang dinyatakan sebagai rasio tinta terhadap kertas, bukan sebagai jarak antar-garis:

```
rasio tinta = lineWidth / gap
```

Gap dijepit sempit di seluruh rentang. Nada dibawa oleh lebar garis pecahan. Ini yang
dilakukan pengukir sungguhan — jauh berarti garis halus rapat, gelap berarti garis
tebal rapat, dan tidak ada yang pernah renggang.

§C.2 sudah mengizinkan antialias khusus di arsiran ("justru harus, supaya kerapatan
tinggi tidak jadi moiré"), jadi `lineWidth` pecahan sah tanpa amandemen tambahan.

### 3.2 Bentuk baru

```ts
export const GAP_MIN = 1.6;
export const GAP_MAX = 3.7;
export const WEIGHT_MIN: number;   // ditentukan oleh kalibrasi §3.4
export const WEIGHT_MAX: number;   // ditentukan oleh kalibrasi §3.4

/** Jarak antar-garis. Rumus sama, rentang yang jauh lebih sempit. */
export function gapFor(value: number, minGap?: number, maxGap?: number): number;

/** Lebar garis. Inilah yang sekarang membawa nada. */
export function weightFor(value: number): number;

/** lineWidth / gap. Satu-satunya angka yang boleh dipakai menilai kegelapan. */
export function inkRatio(value: number): number;
```

`globalAlpha` diratakan dari `0.55 + 0.45t` jadi `0.72 + 0.28t`. Berat garis sudah
membawa nada; membiarkan alpha ikut membawanya berarti menghitung dua kali, dan ujung
pucat akan hilang total di atas kabut yang pucat.

Cross-hatch tetap mulai di `value > 0.66`. `minGap` lintasan kedua berubah dari
`minGap + 1` jadi `minGap × 1.35` — penambahan tetap sebesar 1 px terlalu besar di
rentang yang sekarang cuma selebar 2.1 px.

`GAP_MAX` adalah 3.7, bukan 4.5 seperti di tabel contoh saat pembahasan. 4.5 membuat
invarian §3.5 mustahil: `gapFor(0)` mengembalikan `GAP_MAX` apa adanya, jadi ambang tes
4.5 dan ambang "tidak terhitung mata" 3.7 tidak bisa keduanya benar. Yang diturunkan
adalah konstantanya, supaya invariannya berlaku di seluruh rentang dan bukan cuma di
nilai yang kebetulan dipakai hari ini. Gap yang dihasilkan:

| lapis | `value` | gap lama | gap baru |
|---|---|---|---|
| kota jauh | 0.18 | 12.6 px | **3.09 px** |
| kota dekat | 0.34 | 7.9 px | **2.73 px** |
| jembatan hulu | 0.52 | 5.0 px | 2.39 px |
| dek kaki | 0.74 | 3.4 px | 2.01 px |

### 3.3 Pemanggil membuang override-nya

Keempat `maxGap` (17, 13, 10, 9) di `layers.ts`, `bridge.ts`, dan `deck.ts` dihapus.
Itu penyakitnya, bukan penyetelan yang perlu dipertahankan. Nilai `density` tiap
pemanggil tidak berubah — 0.18 / 0.34 / 0.52 / 0.74 tetap, karena itu yang menyatakan
kedalaman dan tangga nilai sudah dibangun di sekitarnya.

### 3.4 Kalibrasi — langkah wajib, bukan opsional

Arsiran halus menaruh **jauh lebih banyak** tinta per satuan luas daripada arsiran
kasar. Kalau `WEIGHT_MIN`/`WEIGHT_MAX` ditebak, pita jauh bisa jadi dua sampai tiga
kali lebih pekat dan meruntuhkan tangga nilai yang baru selesai dibangun di ronde
sebelumnya.

Hitungan di atas kertas tidak bisa dipakai untuk menyetelnya. Garis 0.3 px di canvas
tidak dirender sebagai 30% garis 1 px — ia dirender sebagai garis abu-abu ter-antialias
yang lebarnya tetap satu piksel, dan hubungannya dengan `lineWidth` tidak linear.
Angkanya harus diukur di canvas sungguhan.

**Metode:** jalankan dev server, ambil piksel lewat Playwright, hitung luminans
rata-rata satu kotak sampel di dalam tiap lapis (kota jauh, kota dekat, jembatan, dek),
sebelum dan sesudah perubahan, pada palet dan ukuran yang sama.

**Kriteria lulus:** luminans rata-rata tiap lapis berada dalam **±15%** dari nilai
sebelum perubahan. Yang berubah teksturnya, bukan nadanya.

Angka awal untuk memulai iterasi: `WEIGHT_MIN 0.30`, `WEIGHT_MAX 1.00`. Itu titik
berangkat, bukan hasil.

### 3.5 Tes

- `gapFor(v) ≤ GAP_MAX` untuk seluruh `v` di `[0, 1]`, **dan** `GAP_MAX ≤ 3.7`. Dua
  pernyataan, karena yang pertama saja akan tetap lulus kalau seseorang menaikkan
  konstantanya. Ini yang mencegah call site mana pun memasukkan garis terhitung lagi.
- `inkRatio` naik monoton di keempat nilai pemanggil (0.18, 0.34, 0.52, 0.74).
- `weightFor` naik monoton dan tidak pernah keluar dari `[WEIGHT_MIN, WEIGHT_MAX]`.
- Tes sumber: `layers.ts`, `bridge.ts`, `deck.ts` tidak lagi menyebut `maxGap`.

---

## 4. `city.ts` — bukaan jadi fakta kelas satu

### 4.1 Bentuk

```ts
export type OpeningKind = 'window' | 'clock' | 'louvre';
export type Opening = {
  kind: OpeningKind;
  x: number; y: number; w: number; h: number;
};

/** Deterministik dari geometri blok. Dipanggil oleh drawSkyline DAN oleh bloom.ts. */
export function openings(b: Block, bot: number): Opening[];
```

Deterministik penuh: diseed dari `b.x` lewat `stream()`, jadi dua pemanggil selalu
mendapat daftar yang identik tanpa perlu menyimpan apa pun.

### 4.2 Kosakata per bentuk

| bentuk | bukaan |
|---|---|
| `flat` | kisi jendela, baris per lantai ±11 px, kolom pitch ±9 px |
| `gable` | sama seperti `flat`, berhenti di garis atap `top + bh·0.34` |
| `spire` | dua celah lancet tinggi di batang; puncak bersih |
| `dome` | satu cincin arkade tepat di bawah pangkal kubah |
| `clockTower` | satu `clock` di batang atas, deret `louvre` di menara lonceng |
| `factory` | dua baris di badan; cerobong bersih |
| `crane` | tidak ada |

### 4.3 Penjepitan

Setiap bukaan dijepit supaya seluruhnya berada di dalam massing. Ini bukan kehati-hatian
berlebih: jaminan `MIN_SPIRE_ASPECT = 3.4` membuat menara kurus, dan kisi jendela dengan
pitch tetap akan tumpah keluar batang menara di lebar mana pun di bawah ±30 px. Blok
yang terlalu sempit atau terlalu pendek untuk memuat satu baris utuh mengembalikan
daftar kosong, bukan baris terpotong.

### 4.4 Tes

- Untuk tiap `kind`, di banyak seed dan banyak ukuran pita: setiap bukaan seluruhnya
  berada di dalam kotak batas blok, dan di bawah `b.top`.
- `openings()` deterministik: dua panggilan pada blok yang sama menghasilkan daftar sama.
- Blok yang terlalu kecil mengembalikan daftar kosong, tidak pernah bukaan berukuran
  nol atau negatif.
- `crane` selalu kosong; `clockTower` selalu punya tepat satu `clock`.

---

## 5. `bloom.ts` — cahaya membaca bukaan

Cabang `window` di `lampSpots()` berhenti mengarang `x`/`y`. Ia mengumpulkan
`openings()` dari blok-blok pita dekat, memilih subset yang menyala sebanyak
`lampCount(progress)`, dan menaruh titik di pusat bukaan. Radius ikut ukuran bukaan,
tidak lagi konstan.

Ini pola yang sama dengan `horizon()`, `lanternAnchor()`, dan `valueLadder()`: dua modul
yang menghitung satu fakta secara terpisah adalah cara fakta itu berpisah jalan.

Konsekuensi yang diinginkan: §C.2 akhirnya berlaku harfiah. Aturannya bilang benda
menyala adalah **lubang** di arsiran, dan sampai sekarang tidak ada lubang untuk
ditempati — cuma titik yang ditumpuk di atas tembok yang diarsir penuh.

### 5.1 Tes

- Tes lama "setiap jendela ada di dalam bangunan" naik kelas: setiap titik `window`
  harus **sama persis** dengan pusat salah satu `Opening` milik salah satu blok.
- `lampCount` masih mengatur jumlah yang menyala; puncaknya masih di kabut tertebal.
- Blok tanpa bukaan tidak pernah menghasilkan titik jendela.
- Tes lentera dan bulan yang sudah ada tetap hijau tanpa diubah.

---

## 6. `drawSkyline` — urutan baru dan kosakata detail

### 6.1 Urutan per blok

1. isi massing dengan `fill`
2. clip ke siluet massing
3. arsir
4. **coreng bukaan sebagai lubang gelap** — `ink` dengan alpha tinggi
5. lepas clip, stroke detail

Langkah 4 adalah yang baru dan yang paling menentukan. Bukaan digambar gelap di pelat
statis; `bloom.ts` kemudian melukis subset yang menyala di atasnya saat runtime. Jendela
yang tidak menyala tetap terbaca sebagai jendela — kota di malam hari sebagian besar
gelap, dan itu justru yang membuat yang menyala berarti.

### 6.2 Detail stroke

Naik dari dua jadi tujuh:

| bentuk | detail |
|---|---|
| `flat` | pot cerobong (tetap) + garis cornice |
| `gable` | bubungan + papan tepi + satu dormer |
| `spire` | crocket di sepanjang puncak + finial |
| `dome` | tiga rusuk + lentera puncak |
| `clockTower` | pita cornice + jarum jam |
| `factory` | dua sabuk besi di cerobong + cincin penutup |
| `crane` | jib (tetap) + kait + tali penambat |

Semua distroke dengan `ink`, lebar 1 px, setelah clip dilepas — beberapa di antaranya
(pot, finial, lentera, kait) memang berada di luar siluet massing.

### 6.3 Tes

- Setiap `kind` menghasilkan gambar yang lebih banyak dari sebelumnya, diukur lewat
  `countingCtx()` — ambangnya diukur dulu dari kode lama, bukan ditebak, supaya tesnya
  bisa gagal. `countingCtx()` sekarang fungsi lokal di `tests/world/renderer.test.ts`;
  ia dipindah ke helper bersama karena dua berkas tes akan memakainya.
- Bukaan digambar sebelum stroke detail, dan sesudah arsiran. Tes urutan sumber, sepola
  dengan tes urutan vignette dari ronde sebelumnya.

---

## 7. Perspektif udara — pita jauh punya skala sendiri

```ts
export function skyline(
  w: number, top: number, bot: number, seed: number, scale?: number,
): Block[];
```

`scale` (default 1) mengalikan `MIN_W` dan `MAX_W`. Pita jauh di `layers.ts` memakai
**0.55**, jadi menghasilkan sekitar dua kali lipat bangunan yang lebih kurus. Itu yang
jarak lakukan sungguhan, dan kerapatan siluet itu sendiri yang jadi detail di sana.

Pita jauh **tidak** menggambar bukaan maupun detail stroke — pada lebar ±12 px keduanya
berubah jadi bubur. Ia tetap diarsir, dengan `weightFor(0.18)` yang sekarang halus.

`MIN_W × 0.55` = 9.9 px. Itu di bawah `SPIRE_MAX_W` dan tetap memenuhi
`MIN_SPIRE_ASPECT` selama tinggi pita di atas ±34 px, yang selalu benar di semua ukuran
frame yang didukung.

### 7.1 Tes

- Tes cakupan yang sudah ada (`b.x` sama dengan jumlah lebar sebelumnya) tetap hijau di
  kedua skala.
- Pada lebar yang sama, `scale: 0.55` menghasilkan lebih banyak blok daripada `scale: 1`.
- Jaminan aspek menara tetap berlaku di skala kecil.
- Determinisme tetap: seed sama + skala sama = kota sama.

---

## 8. Anggaran

Semua yang ada di dokumen ini digambar ke pelat statis, yang cuma dibangun ulang saat
palet, ukuran, atau cuaca berubah. Ongkos per frame nol.

Yang perlu dijaga adalah waktu bangun pelat, karena itulah yang terasa sebagai
sendatan saat resize. Batasnya **25 ms**, diukur di 1440×900 pada kualitas penuh.
Kalau terlampaui, yang dipotong lebih dulu adalah detail stroke pita dekat — bukan
bukaan, karena bukaanlah yang membawa sebagian besar perbaikan.

---

## 9. Yang tidak dikerjakan

- Fase arsiran per blok — §1.3, sudah beda dengan sendirinya.
- Sudut arsiran kelima. §C.2 melarangnya, dan tidak ada kedalaman baru di sini.
- Jendela di pita jauh. Terlalu kecil untuk terbaca; §7.
- Animasi apa pun pada jendela. Cahaya yang berkedip di gedung jauh terbaca sebagai
  kedipan render, bukan sebagai kehidupan.
- Tipografi bitmap. `public/fonts/` masih kosong dan tetap begitu; tidak berhubungan.

---

## 10. Amandemen addendum yang perlu ditulis

`Ideas/gaslamp-dna.md` §C.1 dan §C.2 perlu addendum bertanggal 2026-07-29:

- **§C.1** — nada dibawa rasio tinta (`lineWidth / gap`), bukan jarak. Gap dijepit di
  `[1.6, 4.5]` px di seluruh kedalaman; gap di atas ±4 px berhenti terbaca sebagai
  nada dan mulai terbaca sebagai motif.
- **§C.2** — poin "benda menyala tidak diarsir" diperkuat: lubang itu harus **ada**
  sebagai bukaan yang digambar, dan koordinatnya harus datang dari satu sumber yang
  sama dengan yang dipakai lapis cahaya.

`Ideas/` belum berupa repo git, jadi amandemen ini tidak akan punya riwayat sampai
folder itu di-`git init`. Dicatat di sini supaya tidak hilang.
