# Thya: product context

Dokumen ini berisi konteks produk yang relatif stabil. Bukan PRD. Sumber utama: draft proposal di Google Slides (snapshot di `docs/proposal/slides-snapshot.txt`) dan grilling 2026-10-25 bersama Rafee.

## Masalah

UMKM adalah sekitar 99% unit usaha di Indonesia. Pembayaran digital dan aplikasi chat sudah banyak dipakai, tapi pengadaan, stok, dan pembukuan masih sering manual. Pemilik usaha merangkap banyak peran, catatannya tercecer (buku, nota, spreadsheet), dan sulit mengubah data itu jadi keputusan. Contohnya, omzet tinggi belum tentu berarti margin sehat.

Pertanyaan inti dari Slides: bagaimana pemilik UMKM dengan adopsi digital rendah bisa memahami performa usahanya dan mengambil keputusan operasional tanpa menghabiskan banyak waktu menganalisis data?

## Target user

- Positioning: pemilik UMKM lintas sektor dengan adopsi digital rendah, 1–5 karyawan, merangkap pengambil keputusan.
- **Beachhead: F&B** (kedai, warung makan, kafe kecil). Dipakai untuk demo, data contoh, dan validasi awal. Ekspansi ke retail dan jasa masuk Roadmap.
- Alasan memilih beachhead: bentuk data F&B seragam (penjualan per menu, bahan baku, biaya operasional), persona demo lebih konkret, dan menghindari kesan generik dibanding BukuWarung, Majoo, Qasir, atau bot WhatsApp lain.

## Solusi

Thya adalah AI agent yang diajak bicara lewat WhatsApp. Kemampuan yang dijanjikan di Slides:

1. **AI Business Assistant:** menjawab pertanyaan bisnis, menghitung, menganalisis data, memberi rekomendasi.
2. **Smart Data Management:** merapikan catatan dan terhubung ke spreadsheet.
3. **AI Task Automation:** ringkasan dan laporan rutin, misalnya "tiap hari buatin rekapan ya".
4. **Integrasi:** WhatsApp untuk interaksi dan notifikasi, Google Calendar untuk jadwal dan reminder.
5. **Dashboard web:** disebut di Slides. Keputusan 2026-10-25: web hanya landing page + demo. Dashboard ditunda (OPEN: hapus dari paper atau pindah ke Roadmap).

Klaim dampak di Slides: laporan mingguan manual sekitar 120 menit, dengan Thya sekitar 5 menit. Hematnya sekitar 7 jam 40 menit per bulan untuk 4 laporan. Angka ini belum divalidasi ke user.

## Status saat ini (2026-10-25)

- Belum ada kode. Repo baru di-init hari ini.
- Target submit hari ini: landing page di subdomain .id + halaman `/demo` (chat bergaya WhatsApp yang memanggil agent sungguhan) sebagai tautan prototype. Status di paper: **Prototype**.
- Menuju final 10 Nov: nomor test WhatsApp Cloud API, rekap terjadwal, integrasi spreadsheet.

## Keputusan terbuka

| Topik | Pemilik | Catatan |
|---|---|---|
| Kategori dan subkategori lomba | Indy + tim | Wajib dipilih saat daftar; bisa diubah di dasbor sampai karya dikirim. Kandidat: Business Services → Finance & Accounting/Fintech, atau Inclusions & Community Services |
| Dashboard web masuk scope atau tidak | Tim | Slides masih menyebutnya fitur utama |
| Validasi klaim 120 → 5 menit | Nawra | Belum ada data user |
| Business model | Indy | Bab 8 masih kosong. Masukkan biaya template WhatsApp: utility template berbayar sejak 1 Okt 2026, termasuk di dalam jendela 24 jam (tarif Indonesia dari rate card Meta) |

## Masalah di draft Slides (per 2026-10-25)

Ditemukan saat membaca Slides. Pemilik perbaikan: Indy dan Nawra.

- Bab 6–10 masih kosong. Title, Team Profile & Contact, dan Reference belum ada. Paper maksimal 15 halaman; draft sudah 12 halaman.
- Ada dua versi Bab 1: UMKM umum dan UMKM kuliner. Usulan: versi umum menjadi konteks pasar, versi kuliner menjadi fokus beachhead.
- Angka bertentangan: total UMKM 64,2 juta vs 56,14 juta (OECD, 2024); porsi 99% vs 99,9%; waktu dengan Thya "~10 menit" di teks vs "5 min" di hitungan.
- Diagram arsitektur di Bab 4 berasal dari project lain (Tauri, Express, Supabase, Midtrans, load cell). Harus diganti dengan diagram dari `docs/architecture.md`.
- Label "LangGraph Agent: Auth - Validation - Routing" salah salin, dan stack agent sudah diputuskan pindah ke Vercel AI SDK.
- Poin "Business insights for smarter decisions" muncul dua kali di Bab 5.
