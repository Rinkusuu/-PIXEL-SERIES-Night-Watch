# Night Watch — Yharnam Pass

**Tanggal:** 2026-07-28
**Gaya:** `../../../../Ideas/gaslamp-dna.md` (addendum) di atas `../../../../Useless Dashboard/DNA.md` (induk)
**Membangun di atas:** `2026-07-28-river-scene-design.md`
**Status:** disetujui, siap dibuat rencana implementasi

---

## 1. Kenapa ini ada

Adegan sungai selesai dan berfungsi, tapi tidak terlihat seperti referensinya
(Bloodborne / Yharnam). Diagnosis awalnya — "palet kita hangat" — tidak lengkap, dan
melengkapinya mengubah seluruh arah pekerjaan ini.

### 1.1 Temuan pertama: yang terlihat itu senja

`NIGHT_KEYS` sudah pergi ke dingin dan gelap sendiri:

```
at 0.00  sky #2b2233 → #4a3450 → #8a5a4e   lum 0.46   ← senja, hangat, disengaja
at 0.85  sky #080b11 → #0e1218 → #161e26   lum 0.08
```

Tapi aplikasi ini duduk di `0.00` sepanjang waktu saat idle. Malamnya praktis tidak
pernah terlihat.

### 1.2 Temuan kedua: Bloodborne bukan gelap, tapi kontras tinggi

Ini yang menentukan, dan ini yang membuat `at: 0.85` pun tidak akan cukup. Massa kabut
Yharnam justru **terang** — abu kehijauan sekitar `#4a6b6b` — dan siluetnya nyaris hitam
pekat di depannya. Malam NightWatch seragam gelap: langit gelap, gedung gelap, dek gelap.
Itu hal yang berbeda, dan **menggelapkannya lagi justru menjauhkan**.

### 1.3 Temuan ketiga: tidak ada apa pun di tepi frame

Referensinya membingkai shot dengan vertikal hitam dekat — tiang gas besi berlengan
ornamen, pagar berujung tombak, tiang gerbang batu, gerobak. Itu yang membuat penonton
merasa **berdiri di suatu tempat**, bukan menonton latar belakang. Adegan NightWatch murni
tumpukan pita horizontal; tidak satu pun benda dekat memotong tepi frame.

Kebetulan yang menguntungkan: panel kaca duduk di tengah-bawah, jadi **margin kiri dan
kanan kosong** — persis tempat pembingkai bisa berdiri tanpa pernah tertutup.

---

## 2. Keputusan

| Keputusan | Pilihan |
|---|---|
| Busur palet | **Malam dimulai dari malam.** Senja dibuang |
| Pembingkai tepi | Tiang gas, finial tombak, ranting mati, **dan** tiang gerbang — keempatnya |
| Konflik gerbang vs lengkung | Daun gerbang **terbuka** — vertikal, bukan melengkung |
| Cakupan | **Seluruh keluarga Gaslamp** jadi dingin; addendum §D ditulis ulang |

---

## 3. Palet

### 3.1 `NIGHT_KEYS` baru

Senja dibuang. Jam kerja dimulai saat gelap — kamu penjaga **malam**, bukan penjaga senja.
Yharnam jadi tampilan default yang terlihat saat idle.

Busurnya tetap ada dan tetap memenuhi DNA §3: malam bening → kabut tebal terang → jam
sihir → fajar. Yang hilang cuma cokelat hangatnya.

| at | sky (zenith → mid → horizon) | glow | accent | lum | catatan |
|---|---|---|---|---|---|
| 0.00 | `#16232a` `#2c4348` `#4a6b6b` | `#ffb347` | `#4a6b6b` | 0.30 | malam bening, kabut tipis |
| 0.35 | `#131f26` `#2a4247` `#587a78` | `#ffb347` | `#587a78` | 0.22 | kabut naik |
| 0.62 | `#101a20` `#2f4a4c` `#6d8f89` | `#ffc46b` | `#6d8f89` | 0.16 | **kabut paling terang** |
| 0.85 | `#0b1216` `#1e3034` `#40595c` | `#ffb347` | `#40595c` | 0.10 | jam sihir, **kabut paling tebal** |
| 1.00 | `#1b2733` `#33465a` `#7d8a92` | `#cfd8dc` | `#b08d57` | 0.52 | fajar — tidak berubah |

Dua nilai lama yang **tetap** dan tetap disengaja: `glow` menguning di 0.62 (kabut tebal
menghamburkan gas lebih kuning), dan `glow` berubah dingin di 1.00 (fajar memadamkan gas —
satu-satunya key light dingin di aplikasi, dan itu hadiah karena menyelesaikan).

### 3.1.1 Kabut paling terang dan kabut paling tebal bukan momen yang sama

`fog.ts` menghitung `thickness = (1 - v.lum) * fogScale` — **`lum` berbanding terbalik
dengan ketebalan kabut.** Jadi menaikkan `lum` untuk "kabut lebih tebal" justru
menipiskannya, dan `lum` tetap turun monoton seperti sebelumnya.

Yang membuat kabut **terang** bukan `lum`, melainkan `accent` (warna gumpalannya). Kedua hal
itu dipisah dengan sengaja:

- **0.62 — kabut paling terang.** `accent` mencapai `#6d8f89`, nilai paling pucat sepanjang
  malam. Kabutnya belum paling tebal, tapi paling bercahaya. Ini momen Yharnam.
- **0.85 — kabut paling tebal.** `lum` turun ke 0.10 jadi kabut paling padat, tapi `accent`
  sudah gelap ke `#40595c`. Kabut yang menelan, bukan yang bercahaya. Ini jam sihir.

Dua puncak berbeda di dua momen berbeda memberi malam ini dua babak, bukan satu ramp.

### 3.2 Pembalikan peran `accent`

Sekarang `--amb-accent` (`#6f8f9c`) adalah warna kabut, dan kabut dipakai sebagai lapisan
**gelap** yang menutupi. Di skema baru **kabut adalah massa paling terang di gambar**.

Jadi `accent` naik jadi warna terang, disetel sama dengan `sky[2]` di tiap keyframe. Modul
yang meminum `accent` — `fog.ts`, asap, kilau riak — ikut benar tanpa diubah.

Ini harus disebut eksplisit atau akan salah dipakai: `accent` bukan lagi "warna kabut yang
agak gelap", melainkan "nilai paling terang yang tersedia".

### 3.3 `glow` tetap satu-satunya yang hangat

`#ffb347` tidak berubah. Ia jadi satu-satunya warna hangat di seluruh aplikasi, dan itulah
yang membuatnya bekerja: di gambar yang seluruhnya teal, satu titik amber terbaca sebagai
api sungguhan.

---

## 4. Tangga nilai

Inti dari "kontras, bukan gelap". Dibuat jadi aturan yang **bisa dites**, bukan catatan.

```
kabut / langit      paling terang                massa yang semuanya dipotong ke dalamnya
kota jauh           mix(kabut, #05080a, 0.45)    terselubung jarak
jembatan hulu       mix(kabut, #05080a, 0.70)
dek batu            mix(kabut, #05080a, 0.88)
pembingkai tepi     #05080a  TETAP               tidak ikut ambient sama sekali
```

`kabut` di sini adalah `sky[2]` keyframe yang sedang berlaku, bukan `--amb-deep`.

### 4.1 Kenapa pembingkai tidak ikut ambient

Baris terakhir itu yang menentukan seluruh gambar. Pembingkai tepi hitam mutlak di keadaan
apa pun.

Ia jangkar nilai: selama tepi frame hitam pekat, mata membaca sisanya sebagai punya rentang
penuh. Kalau ia ikut ambient, ia akan ikut **terang** bersama kabut — dan seluruh kontras
runtuh justru pada saat kabut paling tebal, yaitu saat gambar paling seharusnya dramatis.

### 4.2 Tes

`luminance(kota) > luminance(jembatan) > luminance(dek) > luminance(pembingkai)`

Diperiksa di kelima keyframe dikali semua kombinasi grade, termasuk `pressed + bloodmoon`
yang menggelapkan paling jauh. Kalau tangga ini pernah terbalik di kombinasi mana pun,
gambar akan kehilangan kedalaman di keadaan itu.

---

## 5. Vignette dekat — `foreground.ts`

Modul baru. Lapis paling dekat, digambar setelah `drawDeck`. Semua tinta `#05080a`, tidak
pernah diturunkan dari `AmbientValues`.

Penempatan **horizontal** memakai pecahan lebar, dan modul ini yang memilikinya —
`horizon.ts` hanya memegang tangga vertikal, dan menaruh pecahan horizontal di sana akan
mengaburkan tanggung jawabnya.

Penempatan **vertikal** tidak boleh memakai pecahan sama sekali: tes penegak di
`tests/smoke.test.ts` menolak `h * 0.x` di luar `horizon.ts`. Setiap batas atas dan bawah di
bawah ini adalah field `Horizon` yang sudah ada, bukan angka baru.

### 5.1 Isi

| benda | x | y | bentuk |
|---|---|---|---|
| tiang gerbang | `< 0.045w` dan `> 0.955w` | dasar frame → `waterTop` | batu, tutup bola, plinth |
| daun gerbang | tegak menempel di dalam tiap tiang | `deckTop` → `railTop` | jeruji besi berujung tombak |
| tiang gas | `≈ 0.10w` | `deckTop` → `bridgeTop` | batang beralur, mahkota akantus, lengan bracket melengkung ke dalam, lentera kaca menggantung |
| finial tombak | sepanjang lebar, berselang beberapa ruas | `railTop` ke atas | lebih tinggi dari baluster |
| ranting mati | sudut kiri dan kanan | atas → `cityTop` | goresan tipis, gundul |

Tiang gerbang sengaja naik sampai `waterTop` — jauh lebih tinggi dari pagar. Vignette hanya
bekerja kalau ia benar-benar memotong ke dalam frame; tiang setinggi pagar akan hilang ke
dalam pagar itu sendiri.

### 5.2 Bobot

Empat pembingkai sekaligus akan berebut kalau ditumpuk sembarangan. Masing-masing dapat
kedalaman dan bobotnya sendiri:

```
tiang gerbang   alpha 1.00    paling tepi, paling hitam
tiang gas       alpha 1.00    tepat di dalamnya
finial          alpha 0.92    di garis pagar
ranting         alpha 0.45    paling tipis, paling pudar
```

Itu vignette berlapis — persis yang dilakukan referensinya.

### 5.3 Daun gerbang terbuka

Bentuk lengkung gerbang akan bersaing langsung dengan lengkung jembatan, dan dua pembingkai
melengkung dalam satu gambar saling melemahkan.

Diselesaikan lewat bentuk, bukan dengan membuang gerbangnya: **daunnya terbuka**, menempel
rata di dalam tiap tiang. Yang berdiri di tepi jadi dua tiang batu dan dua panel besi
tegak. Vertikal, bukan melengkung.

### 5.4 Lentera adalah `LampSpot` yang sudah ada

Addendum §D.1 sudah mewajibkan satu lentera dekat yang tidak pernah padam. Sekarang ia
digambar sebagai persegi 4px di atas bollard.

Ia naik pangkat jadi lentera kaca yang menggantung di lengan bracket tiang gas.
`bloom.ts` **berhenti** menggambar persegi sendiri dan membaca posisi jangkarnya dari
`foreground.ts`, jadi apinya jatuh tepat di dalam rumah lentera.

Prinsip yang sama dengan `lampSpots()`: satu sumber, bukan dua yang bisa meleset.

---

## 6. Verticality kota — `city.ts`

- **Menara jauh lebih tinggi dan kurus.** Lebar `spire` dan `clockTower` dibatasi; rentang
  tingginya didorong naik.
- **Pita kedua di belakang**, digambar lebih pudar dan lebih tercampur ke warna kabut
  (perspektif atmosfer). Menara jadi bertumpuk di **dua kedalaman**, bukan berbaris di satu
  garis.
- **Menara dikelompokkan dalam rentetan**, bukan disebar merata. Kota gotik punya distrik
  menara, bukan menara tiap dua blok.

---

## 7. Kabut menggenang — `fog.ts`

Sekarang tiga baris gumpalan hanyut di area sungai. Ditambah **genangan yang memakan kaki
bangunan** di `cityBot`, tepi atasnya lembut dan tidak rata.

Itu yang membuat gedung muncul **dari** kabut, bukan berdiri **di atas** garis. Selama
kakinya terpotong rata, siluet seberapa bagus pun akan terbaca sebagai stiker yang
ditempel.

Genangan ini juga yang membuat pita kedua kota (§6) terbaca sebagai lebih jauh, bukan
sekadar lebih pucat.

---

## 8. Bulan

Sekarang `r: 16`, alpha `0.3` — terlalu sopan untuk sesuatu yang seharusnya jadi sumber
cahaya utama di gambar.

Dibesarkan, dengan inti nyaris putih pada alpha tinggi dan halo yang jauh lebih kuat. Di
malam `fullmoon` ia sudah dikalikan `moonScale: 2`; angka dasarnya yang perlu naik.

---

## 9. Addendum

`Ideas/gaslamp-dna.md` §D ditulis ulang membawa:

- palet dasar teal dingin (§3.1),
- `glow` sebagai satu-satunya warna hangat (§3.3),
- pembalikan peran `accent` (§3.2),
- **aturan tangga nilai** (§4) sebagai aturan baru, lengkap dengan alasan kenapa pembingkai
  tepi tidak ikut ambient.

Gaslamp Ledger dan Whitechapel Case Board mewarisi identitas yang sama, jadi ketiganya
benar-benar satu keluarga — dan itu memang alasan addendum itu dibuat.

Amandemen 2026-07-28 pada §B.3 dan §C.2 (dari spek adegan sungai) tetap berlaku.

---

## 10. Tes

```
NIGHT_KEYS      lima keyframe; accent === sky[2] di setiap keyframe kecuali fajar;
                glow hangat di 0.00-0.85 dan dingin di 1.00;
                lum turun monoton dari 0.00 sampai 0.85, lalu melompat naik di fajar;
                accent paling pucat di 0.62 — terang dan tebal adalah dua puncak berbeda
tangga nilai    luminance kota > jembatan > dek > pembingkai,
                di 5 keyframe x semua kombinasi grade
VIGNETTE_INK    konstanta tetap; tidak ada jalur dari AmbientValues ke sana
foreground      penempatan deterministik; tiang gerbang di dalam frame;
                setiap batas vertikal berasal dari field Horizon, tanpa pecahan baru;
                jangkar lentera identik dengan LampSpot bertipe 'lantern' di bloom.ts
city            menara lebih tinggi daripada lebarnya melewati rasio minimum;
                pita belakang selalu lebih pucat daripada pita depan
```

Seluruh 196 tes yang ada harus tetap hijau. Tes `keyframes.test.ts` yang menegakkan busur
lama akan gagal dan **harus diperbarui, bukan dihapus** — busurnya berubah arah, tapi tetap
ada busur untuk ditegakkan.

---

## 11. Yang sengaja tidak dikerjakan

- **Gerobak, batu nisan, pagar makam.** Referensinya punya; kita tidak. Itu perabot
  kuburan, dan adegan ini berdiri di jembatan atas sungai.
- **Hunter / figur manusia.** NightWatch tidak punya karakter, dan menambahkannya akan
  mengubah aplikasi ini jadi hal yang berbeda.
- **Font.** `public/fonts/` masih kosong; tercatat di README, tidak diselesaikan di sini.
