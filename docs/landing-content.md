# Landing: isi dan susunan

Status: susunan, headline, section status, dan pemotongan mockup disetujui Rafee 2026-10-25. Landing statis saja: chat demo live yang memanggil API ditunda (Rafee, 2026-10-25). Tema visual menunggu referensi Rafee. Aturan styling ada di [landing-styling.md](landing-styling.md), pola kode di [landing-patterns.md](landing-patterns.md).

Copy landing dalam bahasa Inggris. Isi chat dalam Bahasa Indonesia santai.

## Susunan section

1. **Header:** logo di kiri. Tanpa link navigasi dulu (halamannya pendek).
2. **Hero**
   - Eyebrow: `Prototype · .id DeveloperDay 2026`
   - Headline: **Ask how your shop did today. Get the answer in a chat.**
   - Sub: "Thya reads your sales records and replies in plain Indonesian: what came in yesterday, what sells, what sits, and what to try next. Made for owners who would rather chat than open a spreadsheet."
   - CTA: "See example answers", scroll ke mockup HP. Tidak ada CTA kedua. (Default agent; "Try the demo" tidak dipakai karena demo live ditunda.)
3. **Mockup HP + tab fitur:** HP di tengah, tab mengganti isi chat, tinggi HP tetap. Isinya ada di bawah.
4. **How it works**, dua poin:
   - "Ask the way you'd ask a friend." Ketik pertanyaan biasa, misalnya "omzet kemarin berapa?"
   - "Numbers come from your records, not from the AI." Thya menghitung lewat fungsi tetap di atas data penjualan, dan model bahasa hanya menyusun kalimat. Kalau datanya belum ada, Thya bilang belum ada.
   - Catatan: "Thya also explains the terms it uses, like the difference between revenue and gross margin."
5. **Live demo:** ditunda. Section ini kembali setelah Rafee memutuskan API dipakai di landing.
6. **Status:** "What works today, and what's next"
   - Sudah jalan di prototype (data contoh Kopi Senja): menjawab omzet, menu terlaris dan tersepi, serta margin kotor. Percakapan di mockup adalah jawaban asli prototype itu.
   - Sedang dikerjakan: nomor WhatsApp, demo yang bisa dicoba langsung di web, mencatat penjualan lewat chat dengan konfirmasi sebelum disimpan, dan rekap harian terjadwal.
7. **Footer:** tim (Indy, Team Lead & Business; Nawra, Product & Research Lead; Rafee, Tech Lead / Engineer), ".id DeveloperDay 2026", dan "The language model runs on servers in Indonesia." Klaim zero data retention belum dipakai sampai ada konfirmasi.

Tidak dipakai: angka "120 menit → 5 menit" (belum divalidasi), testimoni, logo mitra, dan statistik pasar UMKM. Statistik itu milik Indy dan Nawra, dan angkanya masih bertentangan di Slides.

## Mockup chat

Isi mockup adalah jawaban asli `POST /demo/chat` yang diambil 2026-10-25 sekitar 11.32 WIB, lalu dipendekkan supaya muat di HP yang tingginya tetap. Data Kopi Senja dihitung relatif terhadap hari ini, jadi angka di demo live bergeser setiap hari dan tidak akan sama dengan mockup. Sumber di kode: `apps/web/src/lib/landing/mockup-conversations.ts`.

| Tab | Pertanyaan | Yang dibuang dari jawaban asli |
|---|---|---|
| Revenue | Omzet kemarin berapa? | Saran "catat menu apa yang paling laku kemarin" |
| Best sellers | Menu apa yang paling laku minggu ini? | Cappuccino, Matcha Latte, kalimat porsi omzet 27% |
| Slow movers | Menu apa yang kurang laku bulan ini? | Omzet per item, Teh Tarik, Kopi Tubruk |
| Margin | Margin bulan lalu gimana? | Definisi panjang margin kotor, saran cek harga bahan |

Pertanyaan "hari paling ramai" tidak dipakai di mockup. Jawaban aslinya berjudul "Rata-rata" tapi berisi total per hari, dan menyebut "Selasa, rata-rata sekitar Rp2.500.000". Angka itu kemungkinan dihitung model, bukan tool, sehingga melanggar keputusan "angka hanya dari tool deterministik".
