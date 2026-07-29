# Night Watch — Antrean Detail Adegan

**Tanggal:** 2026-07-29
**Status:** disetujui seluruhnya, dikerjakan **setelah** `2026-07-29-background-detail-design.md` selesai
**Asal:** audit menyeluruh `src/world/` atas permintaan pengguna

Semua item di sini sudah disetujui untuk dikerjakan. Dokumen ini bukan daftar usul —
ini antrean. Tiap kelompok akan mendapat spec dan rencananya sendiri saat gilirannya
tiba, karena satu ronde berisi tiga puluh satu perubahan visual tidak bisa diverifikasi
dengan jujur.

Dua temuan dari audit yang sama **tidak** ada di sini karena sudah dipindahkan ke spec
detail latar: arsiran `water.ts` yang bergap 7.4 px, dan sudut arsiran air yang tegak
padahal seharusnya datar.

---

## Ronde 1 — Langit

Bidang terbesar di frame, isinya nol. Semuanya masuk pelat statis, jadi ongkos per
frame nol.

1. **Tidak ada apa pun di langit.** Cuma gradien tiga stop. Tidak ada awan, tidak ada
   bintang. Awan robek yang tersorot dari bawah oleh bulan adalah setengah dari kesan
   referensi. *Dampak tertinggi di seluruh antrean.*
2. **Gradien langit murni vertikal** — `createLinearGradient(0, 0, 0, waterTop)`, tanpa
   variasi horizontal. Polusi cahaya gas seharusnya menggenang di atas bagian kota
   terpadat dan di sisi bulan.
3. **Bulan tanpa korona.** Cincin kedua yang sangat lebar dan sangat samar adalah cara
   udara lembap dibaca.

## Ronde 2 — Figur dan cerita

4. **Tidak ada satu pun figur manusia di seluruh adegan.** Satu siluet di jembatan
   hulu, atau satu sosok di ujung jauh jembatan tempat pemain berdiri. Memberi skala,
   memberi cerita, ongkosnya sepuluh baris.

## Ronde 3 — Kota

5. **Tidak pernah ada celah antar bangunan.** Kursor `skyline()` jalan rapat,
   `x += width`, selalu; langit tidak pernah terlihat di sela menara. Satu jenis `gap`
   sesekali membuka kabut di belakangnya.
6. **Semua bangunan berhenti di garis lurus yang sama** (`cityBot`). Kolam kabut
   menyembunyikannya; menyembunyikan bukan menyelesaikan. Tepi dermaga bervariasi —
   gudang, tangga air, tembok tanggul dengan string course.
7. **Tidak ada tanggul di seberang.** Sungai bertemu kota tanpa dinding.
8. **Satu blok = satu siluet.** Tidak ada setback atau undakan atap di dalam satu massa.

## Ronde 4 — Jembatan hulu

9. **Lampunya melayang.** `lampSpots` menaruh titik `bridge` di `bridgeTop - 9` tanpa
   tiang yang digambar di bawahnya — kesalahan yang sudah diperbaiki untuk lentera
   dekat, kambuh satu lapis lebih jauh.
10. **Parapetnya slab polos**, cuma dua garis string course.
11. **Voussoir hilang.** Lengkung cuma dapat satu garis intrados pucat.
12. **Cutwater tidak menyentuh air.** Pilar berdiri di sungai tanpa riak V di kakinya.
13. **Tidak ada teluk pejalan kaki** di atas tiap pilar.

## Ronde 5 — Sungai

14. **Sungai tidak punya tepi.** `fillRect(0, top, w, depth)` dari tepi frame ke tepi
    frame; tidak ada pantai di mana pun.
15. **Tongkang tidak punya pantulan.** `drawWeather` jalan setelah `water.draw`, jadi
    satu-satunya benda bergerak di sungai adalah satu-satunya benda tanpa bayangan.
16. **Tongkang hampir kosong** — lambung, tunggul tiang, satu lampu haluan. Tidak ada
    kabin, asap, maupun jejak buritan.
17. **Sungai kosong selain tongkang berkala.** Perahu tertambat, pelampung, lighter
    yang diikat — semuanya statis, semuanya gratis.
18. **Garis air cuma satu baris sinus 1 px.**

## Ronde 6 — Batu dekat

19. **Sett-nya kertas grafik.** `pitch` seragam per baris, offset selang-seling rapi.
    Jitter lebar per sett dari `stream()` membunuh keteraturan itu.
20. **Hujan tidak pernah sampai ke kaki.** `weather.ts:191` — `y` di-modulo
    `hz.railBot`, jadi hujan berhenti di parapet dan lantai tempat pemain berdiri tetap
    kering di malam hujan. Ini cacat, bukan sekadar kurang detail.
21. **Tidak ada genangan.** Malam hujan cuma menggelapkan isian secara rata
    (`wet = 0.18`). Genangan yang menangkap pantulan lampu gas adalah gambar paling
    atmosferik yang tersedia, dan 20% malam adalah malam hujan.
22. **Tidak ada kerb.** Dari parapet ke dasar frame satu bidang tak terdiferensiasi.
23. **Dua perabot total** — satu bollard, satu busur cincin tambat.
24. **Baluster semuanya identik**, tanpa newel, tanpa jeda di tempat gerbang berdiri.

## Ronde 7 — Bingkai depan

25. **Tiang gerbang adalah persegi panjang polos** plus bola. Benda terdekat dan
    terkeras di gambar, memikul beban paling besar, punya detail paling sedikit.
26. **Daun gerbang cuma punya satu rel** (`top + 6`). Gerbang besi selalu dua.
27. **Tiang gas tidak punya palang sandaran tangga** — perkakas penyala lampu, dan itu
    yang membuat bendanya terasa dipakai orang.
28. **Ranting tetap.** Tiga dahan per sisi di ketinggian tetap, dua ranting per dahan
    di `t` tetap 0.4 dan 0.72.

## Ronde 8 — Kabut dan udara

29. **Tidak ada berkas cahaya.** Kabut menerima halo secara aditif tapi tidak pernah
    dibentuk olehnya. Kerucut cahaya yang turun dari lentera gas menembus kabut adalah
    gambar khas gaslamp, dan ia sama sekali tidak ada.
30. **Gumpalan kabut terlalu sedikit dan terlalu besar.** 5/4/6 per pita; di layar 1440
    itu lobus selebar 288 px — terbaca sebagai noda.
31. **Asap keluar pucat dari cerobong gelap.** `v.accent` adalah warna kabut. Asap
    seharusnya gelap saat keluar lalu memucat saat menyebar; sekarang terbalik.

---

## Urutan

Ronde 1 sampai 8 dikerjakan berurutan, masing-masing dengan spec, rencana, dan
verifikasi sendiri. Urutannya disusun menurun berdasarkan nilai per ongkos, bukan
berdasarkan wilayah gambar — langit dan figur lebih dulu karena keduanya mengubah kesan
keseluruhan dengan kode paling sedikit.
