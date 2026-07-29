# Night Watch — Langit

**Tanggal:** 2026-07-29
**Gaya:** `../../../../Ideas/gaslamp-dna.md` (addendum) di atas `../../../../Useless Dashboard/DNA.md` (induk)
**Membangun di atas:** `2026-07-29-background-detail-design.md`
**Sumber:** `2026-07-29-scene-detail-backlog.md` ronde 1, item 1–3
**Status:** disetujui, dieksekusi langsung

Spec dan rencana digabung. Tiga item, isinya sudah disetujui di antrean; dua dokumen
terpisah untuk pekerjaan sebesar ini cuma birokrasi.

---

## 1. Kenapa ini ada

Langit adalah bidang terbesar di frame — dari puncak sampai `waterTop`, sekitar 40%
tinggi gambar — dan isinya nol. Satu gradien tiga stop vertikal, tidak ada apa pun di
dalamnya. Tidak ada awan, tidak ada bintang, dan tidak ada variasi horizontal sama
sekali: `createLinearGradient(0, 0, 0, waterTop)` menghasilkan angka yang persis sama di
setiap `x`.

Sekarang kotanya sudah punya isi, kekosongan itu jadi hal paling menonjol yang tersisa.

---

## 2. Awan

Awan Yharnam bukan gumpalan empuk. Ia robek, memanjang, dan tersorot dari bawah.

**Statis, di pelat.** Bukan karena murah — meski memang gratis — tapi karena benar.
DNA §8.1 melarang gerakan area luas, dan pita kabut sudah memegang satu-satunya jatah
gerak di langit. Awan yang menyeberang layar selama sesi 50 menit terbaca sebagai cuaca
bergerak; awan diam terbaca sebagai langit yang dilukis, dan itulah yang dilakukan
sebuah pelat ukiran.

**Bentuk.** Tiga pita mendatar, masing-masing deretan lobus elips yang saling tindih di
sepanjang satu tulang punggung. Yang membuatnya robek adalah **jarak antar-lobus**:
sebagian besar tumpang tindih, sebagian membuka celah.

Pita yang lebih dekat **cakrawala** yang lebih tipis — itu arah perspektif yang
sebenarnya. Awan rendah di frame lebih jauh dan tertekan menuju garis hilang; awan di
atas kepala dekat dan mempertahankan ketebalannya. (Kalimat pertama draf ini menulis
kebalikannya.)

Kepala tiap pita selalu mulai di luar frame. Jitter yang bisa membawanya masuk ke dalam
tepi kiri meninggalkan langit kosong di sana dan pitanya menggantung di udara.

**Nada.** Awan tidak memakai tangga nilai. Tangga itu mengukur kedalaman dari kabut ke
tinta, dan awan berada di langit, di atas kabut. Badannya dicampur dari langit setempat
ke arah `sky[0]` — stop tergelap langit — jadi ia tetap berada di skala langit sendiri.

**Tepi.** Satu busur di sisi yang menghadap bulan, distroke dengan warna `glow`. Itu
saja yang dibutuhkan untuk membaca sebagai tersorot dari belakang, dan ongkosnya satu
`stroke` per lobus. Bulan adalah lampu utama gambar ini sejak ronde Yharnam; tepi awan
harus menyetujuinya.

---

## 3. Bintang

Sedikit, samar, dan **dimakan kabut**. Malam berkabut tidak punya bintang, dan itu bukan
detail opsional — itu yang membuat empat cuaca terasa berbeda dari langit saja.

- Menumpuk ke atas (`y = u^1.9 · skyBot`); yang dekat cakrawala hilang lebih dulu.
- Pudar di dekat bulan. Bulan mencuci bintang di sekitarnya.
- Alpha dikali `max(0, 1 − fogScale · 0.55)`. Di malam berkabut (`fogScale 2`) hasilnya
  nol. Di malam hujan (`0.55`) justru paling banyak — dan itu konsisten dengan komentar
  yang sudah ada di `weather.ts`: malam London yang basah adalah yang paling bening.

---

## 4. Kubah cahaya kota

Item 2 dari antrean. Langit gas punya kubah jingga di atas kota, dan itu satu-satunya
alasan sah untuk variasi horizontal di sana.

Satu gradien radial lebar yang naik dari `hz.cityBot`, berwarna `glow`, alpha rendah.
Pusatnya **bukan** tengah frame — ia dihitung dari `blocks`, rata-rata tertimbang `x`
dengan bobot `tinggi² × lebar`. Kota memang tidak simetris, dan kubah cahayanya harus
menemukan bagian terpadatnya sendiri. Satu sumber, seperti `horizon()` dan `openings()`.

---

## 5. Korona bulan

Item 3. Sekarang bulan cuma punya satu halo ketat (`rad × 3.6`, alpha 0.30).

Ditambah cincin kedua yang jauh lebih lebar dan jauh lebih samar, digambar **sebelum**
halo dan cakramnya supaya keduanya duduk di atasnya. Ukurannya ikut `fogScale`: korona
adalah uap air, bukan cahaya. Ia membengkak saat berkabut dan nyaris hilang di malam
paling bening. Itu mengikat cuaca ke bulan tanpa tombol baru.

---

## 6. Urutan gambar

Di `drawStatic`, tepat setelah gradien langit dan sebelum pita kota terjauh:

1. gradien langit
2. **bintang** — paling belakang
3. **kubah cahaya kota** — di depan bintang, di belakang awan
4. **awan**
5. pita kota terjauh
6. …sisanya tidak berubah

Korona bulan tetap di `drawLamps`, di lapis hidup, karena bulan memang di sana.

---

## 7. Tugas

1. `src/world/sky.ts` — `starField`, `cloudBanks`, `cityGlowAnchor`, `drawSky`. Tes
   geometri: semuanya di atas `waterTop`, deterministik, bintang mati saat kabut tebal,
   jangkar kubah mengikuti massa kota bukan tengah frame.
2. `src/world/layers.ts` — panggil `drawSky` di urutan §6. Tes urutan sumber.
3. `src/world/bloom.ts` — korona bulan. Tes: lebih besar dan lebih samar dari halo, dan
   tumbuh dengan `fogScale`.
4. Budget pelat dinaikkan ulang setelah diukur, bukan ditebak. Verifikasi mata.

---

## 7b. Dua perbaikan setelah dilihat mata

**Awan harus diarsir.** Draf ini melewatkannya. Seluruh bahasa gambar ini ukiran; langit
sendiri sengaja polos karena ia kertas kosongnya, tapi awan adalah objek yang **dipahat
ke** kertas itu. Isian vektor rata di pelat yang seluruhnya garis adalah satu-satunya
benda di gambar yang tidak ikut bahasanya. Kerapatan `0.13` — lebih ringan dari kota
terjauh (`0.18`), karena awan lebih jauh dari apa pun yang berdiri di tanah. Sudut
`far`, karena sudut menandai kedalaman (§C.2).

**Siluetnya harus bergerigi.** Lobus dengan jari-jari yang seragam tersusun bersinggungan
satu sama lain, dan gumpalannya keluar sebagai deretan lozenge mulus. Jari-jarinya
sekarang condong ke kecil (`r()^1.7`) — banyak lobus kecil dengan sesekali yang besar —
dan jitter vertikalnya tiga kali `ry`. Tanpa ini, arsiran sebanyak apa pun tidak akan
membuatnya terbaca sebagai awan.

**Pita jauh juga tidak boleh dapat detail stroke.** §7 sudah menyatakannya, tapi
implementasinya cuma memasang gerbang untuk bukaan; loop detail di `drawSkyline` jalan
tanpa syarat. Hasilnya crocket, dormer, pot cerobong dan jarum jam tergambar di skala
0.55 dan tercecer di langit seperti serpihan. `SkylineStyle` sekarang punya `details`
terpisah dari `openings`.

---

## 8. Yang tidak dikerjakan

- Awan bergerak. §2.
- Awan di depan bulan. Bulan adalah lampu utama; menutupinya melemahkan seluruh gambar.
- Rasi bintang. Bintang di sini tekstur, bukan peta.
- Petir, atau cuaca kelima. Antrean punya tujuh ronde lagi.
