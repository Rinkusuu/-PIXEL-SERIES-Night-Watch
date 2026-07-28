# Night Watch — Adegan Sungai & Jembatan

**Tanggal:** 2026-07-28
**Gaya:** `../../../../Ideas/gaslamp-dna.md` (addendum) di atas `../../../../Useless Dashboard/DNA.md` (induk)
**Menggantikan bagian dunia dari:** `2026-07-27-night-watch-design.md` §5
**Status:** disetujui, siap dibuat rencana implementasi

---

## 1. Kenapa ini ada

Keluhannya tiga, dan semuanya benar:

1. Visualnya belum sedekat itu ke Useless Dashboard.
2. Latarnya kurang detail.
3. Lantainya harus jadi jembatan batu Victorian, dengan sungai di tengah.

Pemetaan yang diminta, mengikuti Useless Dashboard:

```
ladang bunga (MeadowLayer)  →  dek jembatan batu
danau (WaterLayer)          →  sungai / kanal
```

Akar masalah nomor 2 terukur, bukan selera. Useless Dashboard punya 13 modul layer dan satu
`horizon.js` sebagai sumber tunggal garis komposisi. NightWatch punya satu `drawStatic()`
103 baris dengan pecahan tertanam, dan siluet kotanya adalah 26 balok selebar sama dengan
tinggi acak — mata membacanya sebagai diagram batang, bukan kota.

Bug yang dicegah `horizon.js` **sudah terjadi** di NightWatch:

```
src/world/layers.ts:94   const nearTop = h * 0.86;
src/world/bloom.ts:81    const streetY = h * 0.855;
```

Dua salinan satu fakta, sudah tidak sepakat 0.005. Menambah sungai dan jembatan tanpa
memusatkan ini akan menggandakan bug itu ke lima file.

---

## 2. Keputusan yang mengunci sisanya

| Keputusan | Pilihan |
|---|---|
| Posisi kamera | Berdiri **di atas** jembatan; jembatan kedua berlengkung terlihat di hulu |
| Teknik air | **Pantulan cermin hidup** — dunia di atas garis air dibalik, dipendekkan, digeser per baris |
| Penghuni | Tongkang, asap cerobong, burung, gerimis — keempatnya |
| Sumber variasi | **Cuaca diundi per malam**, deterministik dari `nightKey()` |
| Tata letak panel | Panel turun ke bawah, **bertumpu di pagar batu** |
| Arsitektur kode | `horizon()` + satu modul per pita; fungsi murni kecuali air dan cuaca |

Komposisi akhir:

```
┌─────────────────────────────┐
│ ░░ langit · bulan · kabut   │
│ ▂▄▟█▙▄▂ kota jauh ▄▟█▙▄▂    │
│ ═╤══╤══╤══╤══╤══╤══╤══╤══╤═ │  jembatan hulu + lentera
│   ◟‿◞   ◟‿◞   ◟‿◞   ◟‿◞     │  lengkung segmental + pilar
│ ≈≈≈ sungai + pantulan ≈≈≈≈≈ │
│ ╔╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╤╗ │  pagar batu (balustrade)
│ ┌────────┐┌────┐┌───────┐   │
│ │  WATCH ││QUAR││ LEDGER│   │  panel duduk di atas pagar
│ └────────┘└────┘└───────┘   │
└─────────────────────────────┘
```

---

## 3. Arsitektur

### 3.1 `horizon.ts` — sumber tunggal

Satu fungsi. Semua modul dunia bertanya ke sini dan tidak pernah menghitung pecahan
sendiri.

```ts
export type Horizon = {
  skyBot: number;      // dasar langit bersih
  cityTop: number;     // puncak tertinggi kota jauh
  cityBot: number;     // kaki kota jauh
  bridgeTop: number;   // rel atas jembatan hulu
  bridgeBot: number;   // dasar pilar, tenggelam ke air
  waterTop: number;    // garis air
  waterBot: number;    // sama dengan railTop
  railTop: number;     // puncak balustrade
  railBot: number;     // plinth balustrade
  deckTop: number;     // permukaan dek batu
};

export function horizon(h: number, deckTop: number): Horizon;
```

Pembulatan terjadi **sekali**, di sini. Dua modul yang membulatkan pecahan yang sama
sendiri-sendiri adalah cara mendapat jahitan 1px langit menyala di antara air dan dek.

`deckTop` bukan pecahan tetap — diukur dari DOM (§3.2), lalu dijepit di dalam `horizon()`.
Nilai `deckTop` yang **dikembalikan** adalah yang sudah dijepit; pemanggil memakai itu, bukan
nilai mentahnya. Argumen `h` tetap dibutuhkan untuk pita di atasnya.

Fraksi acuan pada `deckTop = 0.66h`:

| pita | dari | sampai | tinggi |
|---|---|---|---|
| langit | 0.00 | 0.22 | 0.22h |
| kota jauh | 0.16 | 0.34 | 0.18h |
| jembatan hulu | 0.30 | 0.40 | 0.10h |
| sungai | 0.40 | `railTop` | **0.20h** |
| balustrade | `deckTop` − 0.06h | `deckTop` | 0.06h |
| dek | `deckTop` | 1.00 | 0.34h |

Kota dan jembatan sengaja tumpang tindih pitanya — jembatan berdiri **di depan** kaki kota,
dan itu yang memberi kedalaman.

**Air punya lantai minimum.** Pita di atas air proporsional dan boleh terkompresi; air
tidak. `waterTop = min(0.40h, railTop − 0.14h)`. Kalau `deckTop` terukur tinggi, langit dan
kota yang menyusut, bukan sungainya. Sungai yang tergencet jadi strip tipis membunuh
pantulan, dan pantulan adalah satu-satunya sumber detail terbesar di adegan ini.

### 3.2 `deckTop` diukur, bukan ditebak

`ResizeObserver` pada `.grid` — dipasang di `App.tsx`, hasilnya diteruskan sebagai prop ke
`World` — menulis posisi atas baris panel. Balustrade digambar tepat di situ. Janji "panel
bertumpu di pagar batu" jadi ditepati di **tiap** ukuran layar, bukan kebetulan cocok di
satu resolusi.

- Nilai dijepit ke `[0.54h, 0.80h]` supaya dek tidak pernah menelan setengah frame di layar
  tinggi, dan tidak pernah tipis sampai panel menggantung di udara di layar pendek. Lantai
  minimum air (§3.1) yang menjaga sungainya, bukan jepitan ini.
- Pelat statis dibangun ulang hanya kalau `deckTop` bergeser **>4px**, mengikuti pola ambang
  yang sudah dipakai `channelDrift` untuk palet.

### 3.3 Modul

| file | isi | punya state? |
|---|---|---|
| `horizon.ts` | garis komposisi | tidak |
| `city.ts` | kosakata siluet + generator cakrawala | tidak |
| `bridge.ts` | jembatan hulu: lengkung, pilar, lentera | tidak |
| `water.ts` | badan air, pantulan, kilau, riak, cincin | **ya** |
| `deck.ts` | batu setts, balustrade, perabot | tidak |
| `weather.ts` | undian cuaca, hujan, asap, burung, tongkang | **ya** (cincin hujan) |
| `layers.ts` | orkestrator, ~60 baris | tidak |
| `hatch.ts` | tak berubah, kecuali satu sudut baru | tidak |
| `bloom.ts` | lentera + jendela; berhenti menghitung pecahan | tidak |

Tidak ada base class `Layer`. Useless Dashboard butuh itu karena 13 layer punya siklus
hidup; di sini cuma dua modul yang punya state, jadi kelas untuk enam modul murni adalah
upacara kosong.

---

## 4. Kosakata siluet — `city.ts`

Kursor-x berjalan dengan lebar bervariasi 18–90px, memilih bentuk dari perbendaharaan
berbenih. Lebar tidak lagi `w / 26`; irama lebar itulah beda antara "kota" dan "diagram
batang".

```
gable       atap pelana gudang, punggung miring
flat        blok teras + parapet + deret pot cerobong
spire       menara gereja, jarum tipis
dome        kubah katedral
clockTower  tepat satu per adegan — penanda tempat
factory     cerobong tinggi kurus; ini satu-satunya sumber asap
crane       derek dermaga, hanya di sepertiga dekat sungai
```

Aturan yang diuji: tepat satu `clockTower`, minimal satu `factory`, jumlah lebar menutup
penuh `w`.

Pita kota jauh dan pita jembatan memakai kosakata yang sama dengan skala dan kerapatan
arsir berbeda, jadi tidak ada dua generator yang harus dijaga sinkron.

---

## 5. Arsiran — satu sudut baru

`§C.2` addendum mengunci tiga sudut kedalaman. Air mendapat yang keempat:

```ts
export const HATCH_ANGLES = {
  far:   -0.42,
  mid:   -0.95,
  near:   0.30,
  water:  0.00,   // datar horizontal
} as const;
```

`0.00` bukan angka bebas. Garis datar adalah konvensi ukiran abad sembilan belas untuk air,
dan itu yang membuat sungai terbaca sebagai permukaan horizontal, bukan sebagai dinding.

Jembatan hulu ikut sudut `mid` — kedalamannya memang di situ, dan sudut kelima cuma akan
mengaburkan hierarki kedalaman yang sudah bekerja.

---

## 6. Jembatan hulu — `bridge.ts`

- **Lengkung segmental**, bukan setengah lingkaran. Itu yang membedakan jembatan Thames
  Victorian dari akuaduk Romawi, dan bentuknya yang lebih rendah dan lebar itulah yang
  bikin siluetnya terbaca sebagai jembatan batu.
- Lengkung **tidak** diarsir mengikuti kurva — mahal, dan tidak perlu. Yang terbaca adalah
  **rongganya**: langit dan sungai tembus lewat situ.
- Pilar melebar ke bawah, berujung **cutwater** lancip yang membelah arus.
- Rel atas + string course: dua garis tipis sejajar sepanjang dek jembatan.
- Lentera gas tiga-lengan berdiri di tiap pilar. Ini masuk ke daftar lentera `bloom.ts`,
  jadi menyala dan padam mengikuti kurva `lampCount()` yang sudah ada.

---

## 7. Dek — `deck.ts`

- **Batu setts dalam perspektif.** Garis nat horizontal yang jaraknya memendek ke arah
  pagar; nat vertikal berselang-seling tiap baris. Cross-hatch di sudut `near`.
- **Balustrade sungguhan**, bukan pagar kotak. Siluet baluster bentuk vas ~8px lebar, jarak
  6px, dengan rel atas dan plinth bawah. Ini permukaan tempat panel kaca duduk, jadi
  bentuknya harus tegas — blur `backdrop-filter: 18px` akan memakan setengah detailnya, dan
  yang tersisa harus tetap terbaca sebagai batu.
- **Perabot:** cincin tambat, satu bollard di kiri tempat lentera-yang-tidak-pernah-padam
  (addendum `§D.1`) sudah berdiri.

---

## 8. Air — `water.ts`

Mirror diisi dari **pelat cache**, bukan dari canvas hidup. Sumber pantulan jadi gratis:
cuma diisi ulang saat pelat dibangun ulang. Ini juga menghindari membaca tekstur yang
sedang ditulis.

Lima lapis, berurutan:

1. **Badan air** — gradien vertikal, makin dekat makin gelap.
2. **Pantulan** — baris ditarik dari mirror, langkah 3px. Jalan **naik** di mirror sambil
   jalan **turun** di sungai; itu inversinya, dan `SQUASH` menentukan berapa banyak dunia
   muat di berapa banyak air. Alpha `(1 − d)^1.35 × 0.55`. Geser-x = jumlah dua sinus
   detuned, dikali kedalaman.
3. **Kolom kilau lentera** — tiap lentera menyala menjatuhkan kolom garis putus di bawahnya,
   melebar dan makin renggang ke arah kita, bergulir. Digambar per frame karena lenteranya
   juga per frame. Pantulan lampu gas di air adalah gambar paling London yang ada; ini
   bagian yang paling tidak boleh dihemat.
4. **Riak** — garis datar pendek hanyut ikut arus, berkedip lewat sinus per-riak.
5. **Buih garis air** — fbm sepanjang x di tepi seberang. Tanpa ini pantulan mulai dari
   garis penggaris dan terbaca sebagai tangkapan layar yang ditempel terbalik.

**Cincin dipakai bersama.** Hujan, gelombang haluan tongkang, dan riak semua memanggil
`ring(x, y, strength)` yang sama. Satu implementasi, bukan tiga yang mengembang dengan laju
sedikit berbeda di sungai yang sama.

Langkah 3px pada pita air 0.20h memberi ~60 `drawImage` per frame pada viewport 900px.

---

## 9. Cuaca & penghuni — `weather.ts`

### 9.1 Undian

`weatherFor(nightKey)` — benihnya `nightKey()` yang sudah dipakai streak. Deterministik:
malam yang sama selalu cuaca yang sama, jadi tidak berubah saat resize atau reload.

| cuaca | bobot | efek |
|---|---|---|
| `clear` | 0.40 | bintang lebih banyak, kabut tipis, burung terbang |
| `fog` | 0.30 | pita kabut dobel, kota jauh nyaris terhapus, halo lentera membesar |
| `rain` | 0.20 | garis hujan miring, cincin di sungai, kabut **menipis**, halo lentera mengecil dan mengeras |
| `fullmoon` | 0.10 | bulan 2×, kolom pantulan bulan kuat, `lum` terangkat |

Kabut menipis saat hujan bukan salah ketik — hujan mencuci kabut, dan malam hujan di London
justru malam yang paling jauh jarak pandangnya.

### 9.2 Tongkang

Digerakkan **jam dinding**, bukan progres sesi. Sungai tidak peduli timer-mu, dan tongkang
yang cuma lewat saat kamu bekerja akan terasa seperti hadiah, bukan seperti sungai.

Periode 15 menit, tampak 90 detik, posisi murni fungsi dari `Date.now()`. Tanpa state, tanpa
random. Haluannya membawa satu titik lampu; gelombang haluannya memanggil `ring()` dan
menggeser baris pantulan di sekitarnya.

### 9.3 Asap

Hanya dari cerobong `factory`, dan posisinya datang dari `city.ts`. Asap selalu keluar dari
cerobong sungguhan, tidak melayang di udara kosong. Maksimum 4 kolom, condong searah angin,
larut ke kabut.

### 9.4 Burung

Cuma di malam `clear` dan `fullmoon`. 0–3 sekaligus, jauh, kecil, menyeberang ~20 detik.
Fungsi dari waktu, tanpa state.

---

## 10. Anggaran & degradasi

### 10.1 Amandemen addendum `§B.3`

Ditulis balik ke `Ideas/gaslamp-dna.md`, dengan alasannya, supaya Gaslamp Ledger dan
Whitechapel Case Board mewarisi angka yang jujur:

| | lama | baru |
|---|---|---|
| Budget frame | ≤ 4 ms | **≤ 8 ms** |
| Benda bergerak per frame | 3 | **7** |

Yang bergerak: kabut, denyut lentera, baris pantulan, kilau lentera di air, riak/cincin,
asap, dan partikel cuaca.

### 10.2 Skala kualitas adaptif

Pengukuran dan pemilihan takik hidup di `renderer.ts` — satu-satunya modul yang sudah
melihat setiap frame. Takik diteruskan ke bawah sebagai argumen; tidak ada modul yang
mengukur waktunya sendiri.

Rata-rata bergulir 30 frame. Lewat 8 ms turun satu takik; di bawah 5 ms naik lagi. Ambang
naik dan turun sengaja berjauhan — histeresis, supaya tidak bergetar bolak-balik di beban
yang kebetulan pas di garis.

| takik | langkah pantulan | riak | asap | hujan |
|---|---|---|---|---|
| 0 | 3px | ×1.00 | 4 kolom | penuh |
| 1 | 4px | ×0.60 | 3 kolom | ×0.6 |
| 2 | 6px | ×0.35 | 2 kolom | ×0.35 |

**Aturan keras: geometri tidak pernah turun, cuma tekstur.** Siluet, lengkung, pilar, dan
balustrade selalu digambar penuh di takik mana pun. Gambarnya tetap utuh; yang hilang cuma
kelipnya.

### 10.3 `motion: 0`

Membekukan semua, tapi **tidak mengosongkan**. Pantulan tetap ada, cuma tidak bergoyang —
digambar dengan geser-x nol. Riak, asap, burung, dan tongkang diam atau absen.

Malam hujan dengan motion mati tidak menampilkan hujan yang menggantung di udara. Diganti
**batu basah**: dek lebih gelap, pantulan lebih kuat, genangan di nat. Hujan yang tidak
turun itu salah; genangan yang diam itu benar.

---

## 11. Perubahan tata letak

Tanpa ini seluruh pekerjaan sia-sia: `.grid` sekarang `repeat(4, 1fr)` penuh dari atas
dengan `TheWatch` `span-2 row-2`, jadi pita 0.34–1.00 — persis tempat jembatan, sungai, dan
pantulan digambar — tertutup kaca buram.

- `.app` jadi bottom-docked (`justify-content: flex-end`).
- `TheWatch` kehilangan `row-2`. Tiga panel duduk dalam **satu baris**: `span-2`, `1`, `1`.
- `TheQuarry` dapat `max-height` + scroll internal, karena daftarnya bisa tumbuh dan tidak
  boleh mendorong pagar batu turun tanpa batas.
- Di bawah 900px panel menumpuk dan adegan menyusut jadi pita atas. Diterima — itu
  konsekuensi layar sempit, dan `deckTop` yang dijepit menjaga sungai tetap ada.

Panel tidak mendapat border tambahan untuk "memisahkan dari latar". Addendum `§B.2`: kalau
terasa butuh itu, blur-nya yang kurang.

---

## 12. Tes

Semua yang menentukan bentuk adalah fungsi murni dan diuji tanpa canvas.

```
horizon()      pita berurutan, tanpa celah; deckTop dijepit ke [0.54h, 0.80h];
               tinggi air >= 0.14h di seluruh rentang deckTop dan h yang masuk akal
weatherFor()   deterministik untuk kunci sama;
               sebaran 1000 kunci dalam toleransi bobot
skyline()      lebar menjumlah menutup w; tepat satu clockTower; factory ≥ 1
bargeAt()      deterministik; di luar layar sebagian besar periode;
               x monoton selama menyeberang
qualityStep()  histeresis — tidak berosilasi antar takik
HATCH_ANGLES   4 entri; water === 0
ring()         satu implementasi; cincin kedaluwarsa dan tidak tumbuh tak terbatas
```

Dua tes penegak aturan:

- **Tidak ada pecahan literal tersisa** di `src/world/*.ts` selain `horizon.ts`. Cermin dari
  tes literal warna yang sudah ada di `tests/smoke.test.ts`. Ini yang mencegah `0.86` vs
  `0.855` terjadi lagi.
- **Hitungan rebuild pelat tetap 1** selama 60 frame kalau palet dan `deckTop` tidak
  berubah.

Seluruh 105 tes yang sudah ada harus tetap hijau. `bloom.ts` sekarang membaca `horizon()`,
jadi tes lentera yang ada akan menyentuh jalur baru itu.

---

## 13. Yang sengaja tidak dikerjakan

- **Interaksi pointer dengan dunia** (jejak kursor di air ala Useless Dashboard). Dunia di
  sini ada di balik kaca; menambahkan pointer events ke canvas akan menabrak kontrak hibrida
  `§B` yang menyatakan dua lapis itu tidak pernah bercampur.
- **Musim.** Useless Dashboard punya salju yang membekukan danaunya. Di sini satu sesi =
  satu malam; musim tidak punya tempat untuk muncul.
- **Suara.** Di luar cakupan.
- **Font.** `public/fonts/` masih kosong dan itu masalah terpisah yang sudah tercatat di
  README; tidak diselesaikan oleh spek ini.
