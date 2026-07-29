# Night Watch — Kedalaman Kota

**Tanggal:** 2026-07-29
**Sumber:** `2026-07-29-scene-detail-backlog.md` ronde 3, item 5–8
**Membangun di atas:** `2026-07-29-sky-design.md`
**Status:** disetujui, dieksekusi langsung

---

## 1. Dua item berdiri di atas asumsi yang salah

Antrean menulis item 6 sebagai "semua bangunan berhenti di garis lurus yang sama" dan
item 7 sebagai "tidak ada tanggul di seberang", keduanya mengandaikan tepi dermaga yang
terlihat. Komposisinya tidak punya itu.

```
cityBot   = 345
bridgeTop = 297      bridgeBot = 371
```

`cityBot` berada **di dalam** pita jembatan. Jembatan hulu adalah pita padat selebar
frame dari 297 sampai 371, jadi kaki kota tersembunyi di belakangnya di mana-mana.
Tembok tanggul yang digambar di `cityBot` tidak akan pernah terlihat oleh siapa pun.

Yang **bisa** dilihat cuma lewat lubang lengkung — y 309 sampai 371 — dan garis air 345
jatuh persis di tengahnya. Jadi kedua item itu dibalik: bukan tepi dermaga di depan,
tapi **tepi seberang yang terlihat menembus lengkung**. Itu juga yang mengubah tiap
lengkung dari lubang bergradien jadi jendela ke tempat sungguhan, dan gradien haze yang
sekarang ada di sana memang cuma pengisi.

---

## 2. Celah antar bangunan — item 5

Kursor `skyline()` berjalan rapat, `x += width`, selalu. Langit tidak pernah terlihat di
sela menara, dan itu yang membuat pita kota terbaca sebagai satu massa buntu alih-alih
sebagai bangunan-bangunan yang berdiri terpisah.

Jenis bentuk baru, `gap`: punya lebar seperti blok lain — jadi tes cakupan (`b.x` sama
dengan jumlah lebar sebelumnya) tetap berlaku — tapi tidak menggambar apa pun. Di pita
dekat, celah menunjukkan pita jauh di belakangnya; itu kedalaman yang selama ini
dibayar tapi tidak pernah ditagih.

Aturannya:

- Sempit. `MIN_W` sampai sekitar 1.4× — celah selebar gedung adalah lapangan, bukan gang.
- **Tidak pernah berdampingan.** Dua celah berurutan adalah satu lubang besar, dan pita
  kota berubah jadi pagar kayu.
- Tidak pernah di posisi menara jam, dan tidak boleh menggantikan satu-satunya pabrik —
  asap butuh cerobong.

## 3. Setback — item 8

Satu blok satu siluet: `flat` adalah balok, dari atap sampai kaki dengan lebar yang
sama. Blok yang cukup lebar mendapat **setback** — massa atasnya menjorok masuk di kedua
sisi.

Geometrinya diekspor sebagai satu fungsi yang dibaca **massing maupun `openings()`**.
Kalau keduanya menghitung sendiri-sendiri, jendela akan tumpah keluar bahu — pola
kesalahan yang sama dengan `horizon()` dan `lanternAnchor()`, dan sudah dua kali
kejadian di projek ini.

## 4. Tepi seberang — item 6 dan 7, dibalik

Satu pita yang digambar **setelah kota dan sebelum jembatan**, jadi jembatan menutupinya
dan ia muncul lewat lengkung dengan sendirinya. Tidak ada kliping khusus: itu cara
compositing sungguhan bekerja, dan lebih sedikit kode daripada menggambar per-lengkung.

Isinya:

- **Tembok tanggul.** Pita batu rendah tepat di atas garis air, dengan string course.
- **Tangga air.** Baji bertingkat turun dari tembok ke sungai, di beberapa posisi.
  Tangga air adalah detail Thames yang paling khas dan paling murah.
- **Lighter tertambat.** Dua atau tiga siluet perahu gelap di garis air.

Semua deterministik dari seed, semua di pelat.

---

## 5. Yang tidak dikerjakan

- Tembok tanggul di depan jembatan. §1 — tidak terlihat.
- Celah di pita jauh. Di lebar 10 px celah dan bangunan tidak terbedakan.
- Setback pada bentuk selain `flat`. Menara jarum yang menjorok adalah kesalahan
  konstruksi, bukan variasi.
