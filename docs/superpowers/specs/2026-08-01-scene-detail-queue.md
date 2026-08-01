# Night Watch — Antrean Detail Adegan, v2

**Tanggal:** 2026-08-01
**Menggantikan:** `2026-07-29-scene-detail-backlog.md`
**Status:** ronde 1–3 selesai; dokumen ini mengatur ronde 4–8
**Sumber:** audit ulang `src/world/` terhadap kode di `58c0a99`

---

## 0. Kenapa ditulis ulang

Antrean lama ditulis pada 2026-07-29 dan sejak itu tiga ronde selesai, tiga
eksperimen di luar antrean dikerjakan (dua di-revert), dan seluruh vokabulari
gambar pindah dari garis ke blok pixel. Sebagian klaimnya sudah tidak benar lagi
terhadap kode yang ada. Antrean yang salah lebih berbahaya daripada tidak ada
antrean, karena ia dikerjakan.

Perbedaan kedua, dan ini yang lebih penting. Antrean lama menulis tiap item
sebagai **apa yang kurang**. Itu cukup untuk memutuskan urutan, tapi tidak cukup
untuk dikerjakan: "parapetnya slab polos" bisa dijawab dengan sepuluh gambar
berbeda, sembilan di antaranya merusak. Maka tiap item di sini punya empat
bagian, dan bagian ketiga yang paling menentukan hasil:

1. **Bukti** — `file:baris`, bukan ingatan.
2. **Yang digambar** — bentuk konkret, bukan kata sifat.
3. **Mode gagal** — bagaimana persisnya perbaikan ini bisa merusak gambar. Tiap
   satu ditulis karena sudah pernah terjadi di projek ini atau di projek induk.
4. **Cara memeriksa** — satu kalimat yang bisa dijawab ya/tidak dari screenshot.

## 0.1 Empat aturan yang berlaku untuk seluruh antrean

Ditulis di depan karena tiga dari empat sudah pernah dilanggar dan tiap kali
biayanya satu revert.

**A. Tidak ada dua modul yang menghitung satu angka yang sama.** Kalau modul
kedua butuh sebuah garis, garis itu diekspor sebagai fungsi. Sudah empat kali:
`horizon()`, `lanternAnchor()`, `setbackOf()`, `eaveOf()` — dan pagi ini yang
kelima, `archCrown()`. Pola kegagalannya selalu sama dan selalu tak terlihat di
satu ukuran layar.

**B. Nilai selalu dari `ladder.ts`, dan arahnya selalu ke kabut.** Makin jauh
makin dekat ke `sky[2]`. Pelanggaran terbaru: `hazeBot` dikasih rung `deck`
(0.88, paling dekat) untuk benda terjauh di gambar, dan tiap lengkung jadi lubang
ke ruang bawah tanah. Kalau sebuah perbaikan butuh nilai baru, ia butuh rung
baru di tangga, bukan campuran lokal.

**C. Tiap benda digambar sebagai blok terisi, tidak pernah sebagai garis.**
Sejak `cc7dcd6` seluruh gambar adalah pixel art. Satu stroke 1 px di antara blok
terbaca sebagai goresan. Crocket sudah pernah dihapus sekali karena ini, lalu
kembali sebagai blok 2×2 dan berhasil.

**D. Jangan menggambar apa pun yang tertutup.** Sebelum menambah benda, cek
apakah pita yang ditempatinya terlihat. Pagi ini bollard tanggul ternyata digambar
di `top - 3` yang berada di balik dek jalan — tidak pernah terlihat oleh siapa
pun, di ukuran layar mana pun. Sungai live juga menimpa `waterTop` ke bawah
setiap frame.

---

## Ronde 4 — Jembatan hulu

Pita jembatan sekarang adalah benda paling besar dan paling kosong di gambar,
dan setelah tanggul naik ke crown, ia juga jadi pembatas utama antara kota dan
sungai. Semua di pelat statis, ongkos per frame nol.

### 4.1 Lampu jembatan melayang — item 9

**Bukti.** `bloom.ts:105` menaruh titik `kind: 'bridge'` di `hz.bridgeTop - 9`.
Tidak ada modul yang menggambar tiang di bawahnya: `drawBridge` menggambar
roadway, lengkung, intrados, cutwater, string course — tidak ada standard gas.
Jadi sembilan pixel di atas pagar ada nyala api tanpa benda yang menyalakannya.
Kesalahan yang sama sudah diperbaiki untuk lentera dekat (`7b5296b`, "the flame
sits in its housing"); ini kambuhnya satu lapis lebih jauh.

**Yang digambar.** Di tiap pilar, di `bridgeTop`: tiang 2 px naik 9 px, kepala
lentera blok 4×4 di puncaknya, dalam nilai `ink`. Posisi x dari `piers()`, bukan
hitungan kedua — aturan A.

**Mode gagal.** Tiang setebal 3 px atau lebih di jarak ini terbaca sebagai
cerobong. Kepala lentera lebih besar dari 4×4 terbaca sebagai kotak pos.

**Cara memeriksa.** Zoom pita jembatan: tiap halo duduk di atas siluet gelap yang
menyentuh pagar?

### 4.2 Parapet slab polos — item 10

**Bukti.** `bridge.ts:153` — dua stroke horizontal di `deckTop + 2` dan
`deckTop + deckH - 2`, dan itu seluruh isi roadway.

**Yang digambar.** Coping terang selebar frame di `deckTop` (aturan C: `fillRect`
1 px dalam nilai `lit`, bukan stroke), lalu panel parapet: blok gelap selang-seling
sepanjang dek dengan pitch yang dikunci ke pilar, jadi tiap bentang punya jumlah
panel yang sama.

**Mode gagal.** Pitch panel yang tidak dikunci ke pilar bikin panel terpotong
setengah di tiap pilar dan seluruh jembatan terbaca miring. Panel yang kontras
penuh mengubah dek jadi papan catur — separasinya harus lebih kecil dari separasi
kota, karena jembatan lebih dekat dan detail dekat butuh nilai lebih rapat, bukan
lebih renggang.

**Cara memeriksa.** Panel di bentang paling kiri dan paling kanan sama utuhnya?

### 4.3 Voussoir hilang — item 11

**Bukti.** `bridge.ts:120-133` — lengkung cuma dapat satu stroke intrados pucat
dengan `globalAlpha = 0.45`.

**Yang digambar.** Sepuluh sampai empat belas baji di sepanjang tiap lengkung,
tiap satu blok 3–4 px yang mengikuti kurva, selang-seling antara `fill` dan
`lit`. Baji dihitung dari `archCurve()` yang sudah ada — aturan A, kurva ini
sudah punya tiga pemakai dan tidak boleh dapat pemakai keempat yang menghitung
sendiri.

**Mode gagal.** Voussoir dengan kontras penuh mengubah tiap lengkung jadi roda
gerigi. Jumlah baji yang tidak ganjil bikin tidak ada keystone di puncak, dan
mata mencari keystone.

**Cara memeriksa.** Ada satu baji di titik tertinggi tiap lengkung?

### 4.4 Cutwater tidak menyentuh air — item 12

**Bukti.** `bridge.ts:137-146` menggambar hidung pilar sampai `hz.bridgeBot`,
yang berada **di bawah** `waterTop` — jadi ujungnya memang sudah tenggelam. Tapi
tidak ada satu pun riak di kakinya; `water.ts` tidak tahu pilar itu ada.

**Yang digambar.** Riak V statis di pelat, di `waterTop`, di tiap pilar: dua
lengan blok yang melebar ke hilir. Statis, bukan animasi — sungai punya tujuh
benda bergerak per frame dan anggarannya sudah penuh.

**Mode gagal.** Riak digambar di pelat lalu ditimpa sungai live. `waterTop` ke
bawah adalah milik `water.ts` (aturan D) — jadi riak ini harus masuk ke
`water.ts`, bukan ke `bridge.ts`, dan posisinya dari `piers()`.

**Cara memeriksa.** Tiap kaki pilar punya V di garis air, dan V-nya tidak
berkedip?

### 4.5 Tidak ada teluk pejalan kaki — item 13

**Bukti.** `piers()` mengembalikan persegi panjang lurus; siluet dek adalah satu
garis datar selebar frame.

**Yang digambar.** Di atas tiap pilar, tonjolan setengah lingkaran di `bridgeTop`
yang menaikkan siluet 4 px. Ini satu-satunya hal di ronde ini yang mengubah
**siluet** jembatan, dan siluet yang terpotong-potong itulah yang membedakan
jembatan Victorian dari balok.

**Mode gagal.** Tonjolan lebih dari 4 px mengubah jembatan jadi bergerigi. Halo
lampu di 4.1 duduk di `bridgeTop`; kalau teluk menaikkan dek, tiang lampu ikut
naik atau ia tenggelam ke dalam teluknya.

**Cara memeriksa.** Siluet atas jembatan bergerigi halus di atas tiap pilar, dan
lampunya masih duduk di atas dek?

---

## Ronde 5 — Sungai

### 5.1 Tongkang tanpa pantulan — item 15

**Bukti.** `drawWeather` jalan setelah `water.draw` di `renderer.ts`. Satu-satunya
benda bergerak di sungai adalah satu-satunya benda tanpa bayangan.

**Yang digambar.** Tongkang digambar dua kali: lambungnya, lalu salinan
vertikal-flip di bawah garis lambungnya dengan alpha rendah dan geser-x
mengikuti `motion`. **Ini item dengan rasio nilai/ongkos tertinggi di ronde 5.**

**Mode gagal.** `motion: 0` harus membekukan, bukan mengosongkan — pantulan tetap
digambar dengan geser nol.

### 5.2 Tongkang hampir kosong — item 16

Lambung, tunggul tiang, satu lampu haluan. Tambah: kabin belakang, cerobong
pendek, asap yang tertinggal, jejak buritan di air.

**Mode gagal.** Asap tongkang mewarisi bug item 8.3 — pucat saat keluar. Kerjakan
setelah 8.3, bukan sebelum.

### 5.3 Sungai kosong selain tongkang — item 17

Perahu tertambat, pelampung, lighter yang diikat. Semua statis, semua di pelat,
semua **di atas** `waterTop`… yang tidak mungkin, karena `waterTop` adalah garis
air. Aturan D: benda-benda ini harus digambar oleh `water.ts` di pass live, atau
tidak sama sekali. Antrean lama menulis "semuanya gratis" dan itu salah.

### 5.4 Garis air satu baris sinus — item 18

**Bukti.** Satu sinus 1 px. Ganti dengan tepi blok bergerigi setinggi 2 px yang
mengikuti profil sinus — aturan C.

### 5.5 Tidak dikerjakan: item 14

"Sungai tidak punya tepi." Sekarang punya: tanggul di seberang naik sampai crown
lengkung (`58c0a99`), dan di sisi dekat pemain berdiri di dek jembatan, bukan di
pantai. Pantai di tepi frame akan berada di belakang vignette. Item ini dicoret.

---

## Ronde 6 — Batu dekat

### 6.1 Hujan tidak pernah sampai ke kaki — item 20

**Bukti.** `weather.ts:191` — `y = (rand(i + 7) * hz.railBot + t * speed) % hz.railBot`.
Modulo `railBot`, jadi hujan berhenti di parapet dan lantai tempat pemain berdiri
tetap kering di malam hujan. **Ini cacat, bukan kurang detail, dan 20% malam
adalah malam hujan.** Kerjakan lebih dulu dari apa pun di ronde 6.

**Perbaikan.** Modulo `hz.h`.

**Mode gagal.** Hujan yang menembus dek juga menembus panel kaca kalau digambar
setelahnya. Cek urutan di `renderer.ts`.

### 6.2 Tidak ada genangan — item 21

**Bukti.** `wet = 0.18` di `layers.ts:69` cuma menggelapkan isian secara rata.

**Yang digambar.** Tiga sampai lima genangan di dek, deterministik dari
`nightKey()`, masing-masing menangkap satu halo lampu gas terdekat sebagai kolom
pantulan pendek. Gambar paling atmosferik yang tersedia di seluruh antrean.

**Mode gagal.** Genangan di pelat statis lalu ditimpa vignette. Vignette digambar
terakhir (`4501d85`) — genangan harus ikut pass live.

### 6.3 Sett kertas grafik — item 19

**Bukti.** `deck.ts:89-91` — `pitch` seragam per baris, `offset` selang-seling
rapi. Jitter lebar per sett dari `stream()`.

**Mode gagal.** Jitter lebih dari ±20% dan permukaannya terbaca sebagai puing.

### 6.4 Tidak ada kerb — item 22, dan baluster identik — item 24

Kerb: satu blok terang setinggi 3 px di kaki parapet, sepanjang frame. Baluster:
newel yang lebih tebal tiap enam baluster, dan satu jeda di tempat gerbang
berdiri — posisi gerbang dari `foreground.ts`, aturan A.

### 6.5 Dua perabot total — item 23

**Bukti.** `deck.ts:101-106` — satu bollard, satu busur cincin tambat. Tambah:
kisi drainase, tumpukan peti di tepi frame, papan nama jalan di tiang gas.

---

## Ronde 7 — Bingkai depan

Benda terdekat dan terkeras di gambar memikul beban paling besar dan punya
detail paling sedikit.

- **7.1 Tiang gerbang** — item 25. Persegi panjang polos plus bola. Tambah cap,
  plinth, dan panel cekung di badannya.
- **7.2 Daun gerbang satu rel** — item 26. `foreground.ts:72` menggambar satu rel
  di `top + 6`. Gerbang besi selalu dua: rel atas dan rel bawah.
- **7.3 Palang sandaran tangga** — item 27. Perkakas penyala lampu di tiang gas;
  itu yang membuat bendanya terasa dipakai orang.
- **7.4 Ranting tetap** — item 28. `foreground.ts` menaruh tiga dahan per sisi di
  ketinggian tetap, dua ranting per dahan di `t` tetap 0.4 dan 0.72. Benih dari
  ukuran layar.

**Mode gagal untuk seluruh ronde 7.** Semua benda ini digambar dalam
`VIGNETTE_INK` — konstanta, tidak pernah menyentuh ambient (`ladder.ts:12`).
Detail apa pun yang ditambahkan di sini harus tetap siluet hitam pekat. Kalau
sebuah panel butuh nilai kedua untuk terlihat, panel itu salah tempat: yang
membedakan bentuk di lapis ini adalah **tepinya**, bukan isinya.

---

## Ronde 8 — Kabut dan udara

### 8.1 Tidak ada berkas cahaya — item 29

**Bukti.** `fog.ts` menerima halo secara aditif tapi tidak pernah dibentuk
olehnya. Kerucut cahaya yang turun dari lentera gas menembus kabut adalah gambar
khas gaslamp, dan ia sama sekali tidak ada. **Item dengan dampak tertinggi yang
tersisa di seluruh antrean.**

**Yang digambar.** Dari tiap lampu yang menyala: kerucut aditif melebar ke bawah,
alpha turun dengan jarak, dipotong di `deckTop` untuk lampu dekat.

**Mode gagal.** Kerucut dengan tepi tajam terbaca sebagai lampu sorot panggung.
Kerucut dari lampu jembatan di kejauhan tidak boleh sama tebalnya dengan dari
lentera dekat — sudah ada `ladder.ts`, pakai.

### 8.2 Gumpalan kabut terlalu sedikit dan terlalu besar — item 30

**Bukti.** 5/4/6 gumpalan per pita; di layar 1440 itu lobus selebar 288 px, dan
terbaca sebagai noda. Naikkan cacahnya, kecilkan radiusnya, jaga total alpha
tetap sama.

### 8.3 Asap keluar pucat dari cerobong gelap — item 31

**Bukti.** `weather.ts:114` — `g.fillStyle = v.accent`, dan `accent` adalah warna
kabut. Asap seharusnya **gelap saat keluar lalu memucat saat menyebar**; sekarang
persis terbalik. Ini pelanggaran aturan B di tempat lain, dan sama dengan bug
`hazeBot` yang diperbaiki pagi ini.

---

## Urutan, dan alasannya

```
6.1  hujan tidak sampai ke kaki      cacat, satu baris, 20% malam
8.3  arah nilai asap terbalik        cacat, satu baris
4.1  lampu jembatan melayang         cacat, sepuluh baris
─────────────────────────────────── di atas ini bug, di bawah ini detail
8.1  berkas cahaya                   dampak tertinggi yang tersisa
6.2  genangan
5.1  pantulan tongkang
4.2  4.3  4.5  parapet, voussoir, teluk
4.4  riak cutwater
6.3  6.4  6.5  sett, kerb, baluster, perabot
5.2  5.3  5.4  tongkang, lalu lintas sungai, garis air
8.2  gumpalan kabut
7.1  7.2  7.3  7.4  bingkai depan
```

Tiga cacat lebih dulu, karena memperbaiki yang rusak selalu lebih murah daripada
menambah yang kurang, dan ketiganya masing-masing di bawah sepuluh baris. Sesudah
itu menurun berdasarkan nilai per ongkos.

**Satu ronde bukan satu commit.** Tiap item di atas diverifikasi dengan
screenshot sebelum item berikutnya dimulai. Antrean lama menulis alasannya dengan
benar — "satu ronde berisi tiga puluh satu perubahan visual tidak bisa
diverifikasi dengan jujur" — lalu dilanggar tiga kali, dan dua dari tiga
pelanggaran itu berakhir sebagai `git revert`.
