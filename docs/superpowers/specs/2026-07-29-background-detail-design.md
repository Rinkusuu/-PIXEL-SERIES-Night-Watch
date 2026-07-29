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

| lapis | berkas | `value` | `maxGap` | gap nyata |
|---|---|---|---|---|
| kota jauh | `layers.ts` | 0.18 | 17 | **12.6 px** |
| kota dekat | `layers.ts` | 0.34 | 13 | **7.9 px** |
| sungai | `water.ts` | 0.34 | 12 | **7.4 px** |
| jembatan hulu | `bridge.ts` | 0.52 | 10 | 5.0 px |
| dek kaki | `deck.ts` | 0.74 | 9 | 3.4 px |

Lima pemanggil, empat berkas. Sungai adalah bidang terbesar kedua di gambar dan ia
mengidap penyakit yang sama persis.

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

### 1.3 Air diarsir tegak, bukan datar

Ini bukan soal kurang detail — ini salah gambar, dan tempatnya persis di wilayah yang
dikeluhkan.

`hatch()` menggambar segmen `moveTo(o, -diag) → lineTo(o, diag)`: tegak di ruang lokal,
lalu diputar sebesar `angle`. Jadi `angle` diukur **dari tegak**, bukan dari datar.
`HATCH_ANGLES.water = 0.00` berarti tanpa putaran sama sekali — garis tegak lurus
melintasi sungai. Komentar di atas konstanta itu menyatakan maksud yang berlawanan:
garis datar, supaya sungai terbaca sebagai bidang mendatar dan bukan sebagai dinding.
Yang digambar justru dindingnya.

Tiga sudut lain tidak salah, cuma komentarnya menyesatkan: `far -0.42` adalah 24° dari
tegak, `mid -0.95` adalah 54°, `near +0.30` adalah 17° ke arah sebaliknya. Semuanya
diagonal, dan itu memang yang terlihat.

### 1.4 Yang BUKAN penyebabnya

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

/** Lebar tinta yang diinginkan, px. Basis dan kemiringan — lihat §3.4. */
export const WEIGHT_BASE = -0.035;
export const WEIGHT_SLOPE = 0.72;

/** Canvas tidak menggambar garis di bawah setengah piksel dengan andal. */
export const MIN_STROKE = 0.5;

/** Jarak antar-garis. Rumus sama, rentang yang jauh lebih sempit. */
export function gapFor(value: number, minGap?: number, maxGap?: number): number;

/** Lebar tinta yang DIINGINKAN, px. Boleh di bawah MIN_STROKE. */
export function weightFor(value: number): number;

/** weightFor / gapFor. Satu-satunya angka yang boleh dipakai menilai kegelapan. */
export function inkRatio(value: number): number;
```

`globalAlpha` berhenti jadi ramp nada dan berubah fungsi sepenuhnya. Ia sekarang
**pengganti sub-piksel**, tidak lebih:

```ts
const want = weightFor(value);            // bisa 0.17 px
const lw = Math.max(MIN_STROKE, want);
g.lineWidth = lw;
g.globalAlpha = want / lw;                // selalu ≤ 1
```

Tinta total tetap `lw × (want / lw) = want`, persis yang diminta, sementara `lineWidth`
tidak pernah turun di bawah setengah piksel. Satu tombol membawa nada, bukan dua yang
saling menghitung ulang. Ramp lama `0.55 + 0.45t` dihapus, bukan diratakan.

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
| sungai | 0.34 | 7.4 px | **2.73 px** |
| jembatan hulu | 0.52 | 5.0 px | 2.39 px |
| dek kaki | 0.74 | 3.4 px | 2.01 px |

### 3.3 Pemanggil membuang override-nya

Kelima `maxGap` (17, 13, 12, 10, 9) di `layers.ts`, `water.ts`, `bridge.ts`, dan
`deck.ts` dihapus. Itu penyakitnya, bukan penyetelan yang perlu dipertahankan. Nilai
`density` tiap pemanggil tidak berubah — 0.18 / 0.34 / 0.34 / 0.52 / 0.74 tetap, karena
itu yang menyatakan kedalaman dan tangga nilai sudah dibangun di sekitarnya.

Satu peringatan ongkos khusus untuk sungai: arsiran air digambar **hidup tiap frame**
di dalam `water.draw`, bukan di pelat statis seperti empat pemanggil lainnya. Gap turun
dari 7.4 px ke 2.73 px berarti sekitar 2.7× lebih banyak segmen per frame di bidang
terbesar kedua. Semuanya masih satu `beginPath` dan satu `stroke`, jadi seharusnya
aman — tapi ini satu-satunya bagian dokumen ini yang menyentuh jalur per-frame, dan
budget 60 fps harus diukur ulang setelahnya, bukan diasumsikan.

### 3.3b Sudut air diperbaiki, dan `diag` dipecah dua

`HATCH_ANGLES.water` berubah dari `0.00` ke `Math.PI / 2`, supaya garisnya benar-benar
datar seperti yang selalu dimaksudkan §C.2.

Mengganti sudutnya saja tidak cukup. `diag` sekarang dipakai untuk dua besaran yang
berbeda:

```js
const diag = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
for (let o = -diag; o <= diag; o += gap) { g.moveTo(o, -diag); g.lineTo(o, diag); }
```

Yang pertama (`o`) adalah **rentang offset** antar-garis; rumus di atas benar untuk itu.
Yang kedua (`±diag` sebagai ujung segmen) adalah **panjang garis**, dan rumusnya
seharusnya `w·|sin θ| + h·|cos θ|` — tertukar. Di `θ = 0` keduanya kebetulan selamat
karena `w > h` membuat angka yang salah tetap kebesaran. Di `θ = π/2` garisnya jadi
jauh terlalu pendek untuk menyeberangi sungai, dan arsirannya akan muncul sebagai pita
sempit di tengah.

```ts
const spread = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle));
const reach  = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle));
for (let o = -spread; o <= spread; o += gap) { g.moveTo(o, -reach); g.lineTo(o, reach); }
```

**Tes:** untuk `θ` di `{0, ±0.42, ±0.95, ±0.30, π/2}` dan kotak yang lebar maupun yang
tinggi, setiap sudut kotak harus tercakup — dinyatakan sebagai `spread ≥ setengah
diagonal terproyeksi` dan `reach ≥ setengah diagonal terproyeksi` pada sumbu
masing-masing. Ini tes murni aritmetika, tidak butuh canvas.

### 3.4 Kalibrasi — langkah wajib, bukan opsional

Arsiran halus menaruh **jauh lebih banyak** tinta per satuan luas daripada arsiran
kasar. Kalau konstantanya ditebak, pita jauh jadi berkali lipat lebih pekat dan
meruntuhkan tangga nilai yang baru selesai dibangun di ronde sebelumnya.

Untungnya ini tidak perlu ditebak dan tidak perlu diukur di browser. Total tinta di
dalam kotak berarsir punya bentuk tertutup:

```
tinta = (luas / gap) × lineWidth × alpha
```

Jumlah panjang tali busur satu keluarga garis sejajar yang melintasi sebuah bidang sama
dengan luas dibagi jarak antar-garis, dan itu **tidak bergantung sudut**. Jadi cakupan
tinta per satuan luas adalah `weightFor(v) / gapFor(v)` — persis `inkRatio`. Kalibrasi
berubah dari menyetel dengan tangan jadi mencocokkan empat angka, dan hasilnya bisa
dikunci di unit test tanpa canvas sama sekali.

**Cakupan lama** (`lineWidth` 1, `alpha = 0.55 + 0.45t`):

| lapis | `value` | gap lama | alpha lama | cakupan |
|---|---|---|---|---|
| kota jauh | 0.18 | 12.637 | 0.681 | 0.05388 |
| kota dekat | 0.34 | 7.941 | 0.757 | 0.09532 |
| sungai | 0.34 | 7.401 | 0.757 | 0.10228 |
| jembatan | 0.52 | 5.004 | 0.831 | 0.16607 |
| dek, utama | 0.74 | 3.364 | 0.912 | 0.27116 |
| dek, silang | 0.235 | 6.883 | 0.709 | 0.10297 |
| **dek, total** | | | | **0.37413** |

Rasio kota jauh : dek adalah **1 : 6.9**. Rentang gap yang baru cuma menyediakan
1 : 1.54, jadi lebar garis harus memasok sisanya. Garis lurus yang mencocokkan keempat
titik itu melewati sumbu nol di bawah `value` terkecil yang pernah dipakai — karena itu
konstantanya dinyatakan sebagai basis dan kemiringan, bukan minimum dan maksimum:

```ts
weightFor(v) = max(0.02, WEIGHT_BASE + WEIGHT_SLOPE · v^0.72)
             = max(0.02, −0.035 + 0.72 · v^0.72)
```

`WEIGHT_BASE` negatif bukan kesalahan. Garisnya memotong nol di `v ≈ 0.011`, dan `hatch`
sudah keluar lebih awal di `value ≤ 0.02`, jadi tidak ada lapis nyata yang pernah
menyentuh daerah itu. Jepitan `0.02` ada supaya pemanggil baru tidak bisa menembusnya.

**Cakupan baru** (`gap = 3.7 − 2.1t`, tinta = `weightFor`):

| lapis | gap baru | tinta | cakupan | selisih |
|---|---|---|---|---|
| kota jauh | 3.089 | 0.174 | 0.05647 | +4.8% |
| kota dekat | 2.734 | 0.296 | 0.10831 | +13.6% |
| sungai | 2.734 | 0.296 | 0.10831 | +5.9% |
| jembatan | 2.389 | 0.415 | 0.17360 | +4.5% |
| **dek, total** | | | **0.34046** | −9.0% |

Kota dekat dan sungai bertemu di angka yang sama karena `value` keduanya 0.34; kode
lama memberi mereka `maxGap` berbeda tanpa alasan, dan menyatukannya justru yang benar.

**Kriteria lulus:** setiap lapis berada dalam **±15%** dari cakupan lamanya. Simpangan
terbesar adalah +13.6%, dan itu lolos. Yang berubah teksturnya, bukan nadanya.

Tes kalibrasi menghitung kedua kolom dari konstanta di `hatch.ts` dan membandingkannya
dengan tabel lama yang ditulis sebagai angka tetap. Kalau seseorang menggeser `GAP_MAX`
atau salah satu konstanta berat, tes itu yang jatuh lebih dulu.

**Verifikasi mata tetap wajib.** Bentuk tertutup di atas menjamin jumlah tintanya,
bukan bahwa hasilnya terlihat benar. Setelah kalibrasi lolos, adegan tetap dilihat di
browser pada keempat cuaca sebelum ronde ditutup.

### 3.5 Tes

- `gapFor(v) ≤ GAP_MAX` untuk seluruh `v` di `[0, 1]`, **dan** `GAP_MAX ≤ 3.7`. Dua
  pernyataan, karena yang pertama saja akan tetap lulus kalau seseorang menaikkan
  konstantanya. Ini yang mencegah call site mana pun memasukkan garis terhitung lagi.
- `inkRatio` naik monoton di keempat nilai pemanggil (0.18, 0.34, 0.52, 0.74).
- `weightFor` naik monoton dan tidak pernah keluar dari `[WEIGHT_MIN, WEIGHT_MAX]`.
- Tes sumber: `layers.ts`, `water.ts`, `bridge.ts`, `deck.ts` tidak lagi menyebut
  `maxGap`.
- `HATCH_ANGLES.water` sama dengan `Math.PI / 2`, dan ia satu-satunya sudut yang datar.
- Cakupan `spread`/`reach` di seluruh sudut yang dipakai — §3.3b.

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
- **§C.2, amandemen air 2026-07-28** — sudut diukur **dari tegak**, bukan dari datar.
  Amandemen itu menulis `water: 0.00 rad` sambil memaksudkan garis datar; nilai yang
  benar adalah `π/2`. Konvensinya harus ditulis eksplisit supaya tiga sudut lain tidak
  ikut salah baca di kemudian hari.

`Ideas/` belum berupa repo git, jadi amandemen ini tidak akan punya riwayat sampai
folder itu di-`git init`. Dicatat di sini supaya tidak hilang.
