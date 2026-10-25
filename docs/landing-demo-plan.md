# Rencana Playground di landing

Status: usulan, diperbarui 2026-10-25. Belum dikerjakan. Keputusan yang masih terbuka ada di §7.

## 1. Tujuan

Playground adalah section di landing tempat juri dan pemilik usaha mencoba Thya sendiri, tanpa API,
login, atau nomor WhatsApp. Pengunjung memegang HP mockup yang sudah ada (frame iPhone + Dynamic
Island), memilih pesan lewat chip, lalu Thya membalas dengan alur yang sudah ditulis di kode
(hardcoded). Karena jawabannya tetap, demo tidak bisa gagal di depan juri.

Yang membedakannya dari hero dan How it works: di Playground pengunjung yang menggerakkan alurnya,
tidak ada yang berjalan sendiri.

## 2. Golden workflow: satu cerita, tiga babak

Ceritanya "Malam setelah Kopi Senja tutup". Babaknya diambil dari tiga kata kerja Thya. Rail di
samping HP menampilkan babak dan beat yang sedang aktif. Pengunjung boleh melompat ke babak mana saja.

| Babak | Isi | Pesan untuk juri |
|---|---|---|
| 1. Tanya | Omzet → menu laris → menu sepi → grafik | Angka bisnis cukup ditanya lewat chat, dan istilahnya dijelaskan |
| 2. Kerjakan | Catat pesanan → catat QRIS → isi sheet → kirim promo | Thya mengerjakan, dan setiap aksi menunggu "Ya" dari pemilik |
| 3. Otomatis | Atur rekap harian → rekap datang sendiri → pengingat | Thya datang sendiri tanpa ditanya |

### Beat per babak

Status: **Jalan** artinya sudah dijawab API hari ini. **Final** artinya slice di
`docs/business-features-plan.md` atau `docs/engine-plan.md` yang dijadwalkan sebelum 10 Nov.

| # | Pengunjung (chip) | Thya | Status | Pemilik |
|---|---|---|---|---|
| 1 | "Omzet kemarin berapa?" | Rp4.100.000, naik 25,8%, ditambah arti omzet | Jalan | `mockup-conversations.ts` |
| 2 | "Menu apa yang paling laku minggu ini?" | Es Kopi Susu Gula Aren, 290 terjual | Jalan | sama |
| 3 | "Yang kurang laku bulan ini?" | Croissant Butter, terjual paling sedikit dan margin paling tipis | Jalan | sama |
| 3b | (cabang) "Margin bulan lalu gimana?" | Margin kotor + artinya | Jalan | sama |
| 4 | "Kasih grafik omzet 7 hari terakhir" | Kartu grafik batang + caption | Final, S2 (3–5 Nov) | business-features S2 |
| 5 | "Tadi ada pesanan 20 es kopi susu buat kantor" | Draft transaksi dengan tombol Ya/Ubah/Batal → tercatat | Final, draft engine Q1 (1–3 Nov) | engine-plan |
| 6 | Kirim screenshot GoPay Merchant | Draft beberapa transaksi QRIS → Ya → tercatat | Final, S9 (wajib) | business-features S9 |
| 7 | Tempel link sheet + "Tambahin omzet dua hari terakhir" | Kartu "Sheet updated" | Final, S5 | business-features S5 |
| 8 | "Kirim promo bundling ke pelanggan" → "Kirim" | Draft email → terkirim | Final, S7 | business-features S7 |
| 9 | "Tiap jam 9 malam kirimin rekap ya" | Draft jadwal → Ya → "Rekap harian aktif" | Final, S4 | business-features S4 |
| 10 | Chip "Lompat ke 21.00" | Jam di status bar maju, notifikasi turun dari Dynamic Island, lalu kartu rekap harian | Final, S3 + kartu S1 | business-features S3 |
| 11 | "Ingetin belanja bahan tiap Senin jam 7" | Pengingat aktif → lompat ke Senin 07.00 → notifikasi | Final, pengingat S4 | business-features S4 |

Aturan isi:
- Setiap angka diambil dari seed `demo-shop` lewat API saat data Playground disusun, tidak dikarang.
  Grafik 7 hari dan kartu rekap memakai angka harian Kopi Senja yang sama dengan jawaban asli.
- Beat 1–3b memakai teks jawaban API apa adanya. Beat 4–11 ditulis mengikuti bentuk keluaran yang
  ada di AC slicenya, misalnya caption grafik maksimal 3 baris, tombol draft Ya/Ubah/Batal, dan isi
  rekap yang disusun kode.
- Babak 1 memakai chip lanjutan. Babak 2 dan 3 linear dengan konfirmasi "Ya", karena pesan
  utamanya adalah "aksi menunggu persetujuan pemilik".

## 3. Alert/sinyal dan dashboard

**Alert/sinyal** (misalnya "Omzet hari ini 30% di bawah Selasa biasanya") belum ada di plan mana pun.
Usulanku, alert dijadikan satu baris "Sorotan" di dalam rekap harian beat 10. Isinya dihitung kode
dari `trend` yang sudah dikembalikan `computeMetric` (engine-plan, kontrak recaps). Ini perluasan
kecil S3, bukan fitur baru. Alert real-time di luar jadwal rekap tetap Roadmap. Keputusan: D2.

**Dashboard web** adalah non-goal sampai final (`business-features-plan.md` §1, Non-goals;
`feature-catalog.md`: Roadmap). Di WhatsApp, "dashboard" berarti grafik (S2) + kartu ringkasan (S3).
Usulanku, Playground menampilkan dashboard versi chat ini di beat 4 dan 10 tanpa layar dashboard
web. Kalau tim ingin menyebut dashboard web, taruh di strip "What's next" di luar Playground dengan
label roadmap. Keputusan: D3.

## 4. Interaksi

- Chip balasan cepat di bawah thread berbentuk `<button>` dengan tinggi minimal 44px. Kolom ketik
  terlihat tapi nonaktif, dengan placeholder "Pilih pesan di bawah".
- Tombol draft (Ya/Ubah/Batal) ada di dalam bubble, seperti tombol interaktif WhatsApp. Hanya "Ya"
  yang melanjutkan alur. "Ubah" dan "Batal" menampilkan satu balasan singkat, lalu chip "Ya" muncul
  lagi.
- Lompatan waktu (beat 10, 11): jam di status bar berganti, banner notifikasi turun dari Dynamic
  Island, dan tap pada banner membuka rekap.
- Istilah yang di-bold (omzet, margin, HPP) bisa di-tap untuk membuka penjelasan singkat. Isinya
  dari glossary yang dihapus di commit `55686f0` (masih ada di git).
- Kalau pengunjung diam 5 detik, chip berikutnya berdenyut pelan. Tidak ada autoplay.
- Thread punya tinggi tetap `h-chat` dan scroll di dalam HP, jadi tidak menggeser halaman (pelajaran
  dari bug Safari). Thread memakai `role="log"` dan `aria-live="polite"`. Dengan reduced motion,
  jawaban muncul langsung.
- Di layar 360px, rail babak berubah jadi tab di atas HP.

## 5. Bentuk kode

- `lib/playground/flows.ts`: daftar babak → beat → `steps: ChatStep[]` + `chips`. Setiap beat punya
  `requires?: "S2" | "S4-reminder" | "S5" | "S7" | …`.
- `lib/playground/dropped.ts`: satu set slice yang dibuang. Mengikuti urutan buang di
  `business-features-plan.md` §7 (S7, S2, pengingat S4, S6, S5): kalau slice dibuang, beat-nya ikut
  hilang dari Playground di hari yang sama lewat satu baris ini.
- `ChatStep` di `showcase-scenes.ts` ditambah jenis `chart`, `draft` (dengan tombol), `image`
  (screenshot), `recap`, dan `notification`. `StepBubble` dipakai ulang dan diperluas.
- `hooks/use-playground.ts` menyimpan babak, beat, riwayat, status mengetik, dan jam tampilan.
  Iramanya mengikuti `scene-timeline.ts`.
- UI: section `playground.tsx`, `device-frame.tsx` yang dipakai ulang (jam status bar jadi prop),
  `quick-replies.tsx`, dan `act-rail.tsx`.
- `hooks/use-demo-chat.ts` (memanggil `/demo/chat`, tidak dipakai di mana pun) dihapus, atau disimpan
  kalau nanti Playground punya mode live.
- Tidak ada dependency baru, dan halaman tetap static export.

## 6. Urutan kerja

| Langkah | Isi | Kira-kira |
|---|---|---|
| 1 | Data babak 1 + UI dasar (HP, chip, rail, thread) | ½ hari |
| 2 | Babak 2: draft dengan tombol, kartu screenshot, sheet, email | ½ hari |
| 3 | Babak 3: lompatan waktu, notifikasi, kartu rekap + sorotan | ½ hari |
| 4 | Grafik di bubble, istilah yang bisa di-tap, mobile 360/768, Safari iOS | ½ hari |

Total sekitar 2 hari. Setelah langkah 1, Playground sudah bisa dirilis dengan babak 1 saja (semuanya
Jalan), lalu babak 2 dan 3 menyusul.

Bonus: rekaman satu kali Playground dari babak 1 sampai 3 bisa langsung dipakai sebagai video demo.

## 7. Keputusan untuk Rafee

| # | Pertanyaan | Usulan |
|---|---|---|
| D1 | Chat yang sama muncul di hero, How it works, dan Playground | A: panel chat How it works dibuat statis; chat yang hidup hanya di hero dan Playground |
| D2 | Alert/sinyal | Baris "Sorotan" di rekap harian, dihitung kode (perluasan kecil S3) |
| D3 | Dashboard | Versi chat (grafik + kartu rekap), tanpa layar dashboard web |
| D4 | Input | Chip saja, tanpa input bebas |
| D5 | Letak dan nama | Section `#playground` setelah How it works, dengan item "Playground" di navbar |
| D6 | Beat yang statusnya Final, bukan Jalan | Tampil tanpa label (konsisten dengan keputusan 2026-10-25), dan dibuang lewat `dropped.ts` kalau slicenya dibuang |
