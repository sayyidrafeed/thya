# Rencana demo statis di landing

Status: usulan, 2026-10-25. Belum dikerjakan. Keputusan terbuka ada di bagian terakhir.

## Tujuan

Juri dan pemilik usaha bisa mencoba Thya sendiri di landing tanpa API, tanpa login, dan tanpa
nomor WhatsApp. Pengunjung memegang HP mockup yang sudah ada (frame iPhone + Dynamic Island), memilih
pertanyaan, lalu Thya menjawab dengan alur yang sudah ditulis (hardcoded). Karena semua jawabannya
tetap, demo tidak pernah gagal di depan juri dan tidak butuh server.

## Letak

Usulan: section baru `#coba` ("Try Thya") di antara How it works dan Testimonials. Tombol
DeveloperDay di navbar tetap mengarah ke `#developerday`, dan section CTA mendapat tombol kedua,
"Try the demo", yang menuju `#coba`.

Alternatif: kartu kaca di section DeveloperDay diganti HP demo. Akibatnya CTA kehilangan fokusnya,
jadi aku tidak menyarankan ini.

## Alur emas (golden flows)

Pengunjung memilih lewat chip balasan cepat di bawah chat, seperti quick reply WhatsApp. Kolom
ketik terlihat tapi nonaktif, dengan placeholder "Pilih pertanyaan di bawah". Tanpa input bebas,
tidak ada pertanyaan yang tidak bisa dijawab.

| Alur | Langkah pengunjung | Jawaban Thya | Sumber isi |
|---|---|---|---|
| Omzet | "Omzet kemarin berapa?" | Angka 24 Okt + perbandingan + arti omzet | `mockup-conversations.ts` (jawaban asli API) |
| Menu laris | "Menu apa yang paling laku minggu ini?" | Top menu + saran | sama |
| Menu sepi | Lanjutan dari menu laris: "Yang kurang laku?" | Croissant Butter + margin tipis | sama |
| Sheets | Tempel link sheet → "Tambahin omzet dua hari terakhir" | Kartu "Sheet updated" | `showcase-scenes.ts` |
| Email promo | "Kirim promo bundling ke pelanggan" → konfirmasi "Kirim" | Draft → kartu terkirim | sama |

Setiap jawaban ditutup 2–3 chip lanjutan, misalnya "Bandingkan dengan minggu lalu" atau "Apa itu
margin?", sehingga satu sesi bisa berjalan 4–6 giliran tanpa buntu. Chip "Mulai ulang" selalu
tersedia.

## Bentuk kode (pakai yang sudah ada)

- **Data**: `lib/landing/demo-flows.ts` berisi graf langkah `{ id, steps: ChatStep[], next: chipId[] }`.
  Tipe `ChatStep` dipakai ulang dari `showcase-scenes.ts`, jadi kartu sheet dan email langsung jalan.
- **State**: `hooks/use-demo-flow.ts` menyimpan riwayat, langkah aktif, dan status mengetik. Waktu
  bubble memakai `scene-timeline.ts` supaya iramanya sama dengan hero.
- **UI**: `DeviceFrame` dan `StepBubble`/`TypingBubble` dipakai ulang, ditambah komponen baru
  `QuickReplies`. Tinggi thread tetap `h-chat` dan auto-scroll ke bawah tanpa menggeser halaman
  (pelajaran dari bug Safari).
- **Hapus**: `hooks/use-demo-chat.ts`, yang memanggil `/demo/chat` dan tidak dipakai di mana pun,
  bisa dibuang atau disimpan untuk mode live setelah API naik.
- Tidak ada dependency baru dan halaman tetap static export.

## Kejujuran klaim

- Tampilkan label kecil di atas HP: "Demo with sample data from Kopi Senja".
- Alur Omzet dan Menu memakai jawaban asli API. Alur Sheets dan Email mengikuti keputusan
  2026-10-25 (ditampilkan tanpa label, dibangun sebelum final).
- FAQ "Can I use it on WhatsApp today?" tetap jujur: belum.

## Aksesibilitas dan mobile

- Chip adalah `<button>` dengan tinggi minimal 44px. Thread memakai `role="log"` dan
  `aria-live="polite"`.
- Dengan reduced motion, jawaban muncul langsung tanpa animasi mengetik.
- Di layar 360px, HP diskalakan agar muat dan chip dibungkus 2 baris tanpa scroll horizontal.

## Perkiraan kerja

Kira-kira 1 hari: data alur ½ hari, hook dan UI ½ hari, ditambah cek 360/768/desktop dan Safari iOS.

## Keputusan untuk Rafee

1. Letak: section `#coba` baru (usulan) atau mengganti kartu CTA DeveloperDay?
2. Pilihan saja (usulan), atau juga input bebas yang dicocokkan ke alur terdekat?
3. Apakah alur Sheets dan Email ikut di demo interaktif, atau hanya alur yang sudah jalan di API?
