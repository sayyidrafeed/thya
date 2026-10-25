# Konten teknis paper (bagian Rafee)

Draft 25 Okt 2026. Teks paper berbahasa Inggris; catatan ini Bahasa Indonesia. Penomoran bab mengikuti Slides (Bab 4 = Key Features & Tech Stack), bukan nomor 13 bagian di template resmi.

| File | Untuk |
|---|---|
| `ch4-key-features-tech-stack.md` | Bab 4: fitur dengan kolom status, arsitektur, tech stack, perlindungan data |
| `thya-architecture.png` / `.excalidraw` | Pengganti diagram Bab 4. Kotak putus-putus = belum dibangun. Sumber bisa diedit di excalidraw.com |
| `ch7-current-status-dev-plan.md` | Bab 7: status Prototype dan rencana sampai final 10 Nov |
| `ch10-roadmap-tech.md` | Bab 10 bagian teknis: nomor production, template rekap, voice note, foto nota, ekspansi sektor |

## Perbaikan Slides untuk Indy dan Nawra

Diambil dari `docs/product-context.md`. Agent tidak mengubah klaim bisnis atau angka pasar; ini usulan.

1. **Bab 4: ganti diagram arsitektur.** Diagram sekarang dari project lain (Tauri, Express, Supabase, Midtrans, load cell). Pakai `thya-architecture.png`.
2. **Bab 4: label salah salin.** "LangGraph Agent: Auth - Validation - Routing" diganti "AI Agent (Vercel AI SDK): tool calling". Agent tidak lagi memakai LangGraph. Label "Next.js Landing Page: Info - Monitoring - Analytics" juga tidak sesuai: web hanya landing + demo chat.
3. **Bab 3: AI Business Dashboard.** Masih disebut fitur utama, padahal web hanya landing + demo. Putuskan: hapus, atau pindah ke Roadmap (draft Bab 10 sudah menaruhnya di Phase 2 sebagai opsional).
4. **Bab 3: Google Calendar dan "connects with spreadsheets"** ditulis seolah sudah ada. Di Bab 4 dan 7 keduanya berstatus planned/Roadmap. Samakan kata kerjanya ("will connect").
5. **Bab 1: dua versi.** Usulan: versi umum jadi konteks pasar, versi kuliner jadi fokus beachhead F&B.
6. **Angka bertentangan.** Total UMKM 64,2 juta vs 56,14 juta (OECD, 2024); porsi 99% vs 99,9%; waktu dengan Thya "~10 menit" di teks vs "5 min" di hitungan Bab 5.
7. **Klaim 120 → 5 menit** belum divalidasi ke user. Tandai sebagai estimasi atau sertakan sumbernya.
8. **Bab 5: "Business insights for smarter decisions" muncul dua kali.**
9. **Bagian yang belum ada:** Title, Team Profile & Contact, Reference, dan Bab 6, 8, 9 masih kosong. Batas 15 halaman; draft sudah 12 halaman, jadi Bab 4/7/10 di sini perlu dipadatkan saat masuk Slides.

## Masih butuh input tim

- **Nawra:** apakah sudah ada wawancara atau uji coba dengan pemilik F&B? Mengisi baris "Testing with real F&B owners" (Bab 7) dan rencana uji coba 7–9 Nov (jumlah pemilik, cara rekrut).
- **Indy:** jadwal Phase 1–3 di Bab 10 masih usulan Rafee; selaraskan dengan business model (Bab 8) dan rencana dampak. Bagian bisnis/pasar Bab 10 milik Indy dan Nawra.
- **Tim:** keputusan dashboard (poin 3 di atas).

## Yang harus Rafee cek sebelum export PDF

- Kolom Status di Bab 4 dan daftar "What runs today" di Bab 7 cocok dengan yang benar-benar tayang. Per 25 Okt, `https://thya.veterantech.id` (200) dan `https://thya-api.sayyidrafee.com/health` sudah live; cek ulang di hari export.
- Jangan klaim data dijamin tetap di Indonesia. Kebijakan data-handling NetraRuntime (https://netraruntime.com/policies/data-handling) menyebut ZDR tidak menjamin pemrosesan tetap di Indonesia, ada external inference route, dan ada fallback processing. Teks sekarang hanya menulis "zero data retention by default, primary GPU infrastructure in Indonesia".
- Cache Netra dibagi antar-customer, dengan opsi opt-out per workspace. Keputusan Rafee (`docs/decisions.md`): tidak opt-out selama hackathon. Jadi paper tidak boleh mengklaim apa pun soal cache.
- VPS ada di Jakarta (Sumopod/Tencent, Dokploy). Postgres belum dibuat, jadi paper tidak boleh mengklaim database atau backup sudah jalan.
- Hasil `verify:netra` (tool calling di NetraRuntime) sudah lulus.
- Harga template message WhatsApp hanya dikutip dari halaman resmi Meta.
- Pencatatan transaksi lewat teks (Ya / Ubah / Batal) sekarang ditulis "planned for the final" di Bab 4, 7, dan 10. Sumbernya keputusan Rafee yang diteruskan session engine. Per 25 Okt, `docs/engine-plan.md` masih mencatat Q3 sebagai OPEN dan `docs/decisions.md` belum punya entrinya. Jangan ubah jadi "working" sebelum fiturnya jalan.
- Hapus blok komentar `<!-- Open items -->` di tiap file sebelum teks masuk paper.
