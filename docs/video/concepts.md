# Video demo Thya: konsep

Status: untuk video lomba, Rafee memilih mengikuti brief tim business ("cinematic product introduction", Google Docs): 60–75 detik, rekaman Playground asli, scene aksi diganti karena Sheets dan email belum jalan, VO Inggris TTS, footage opsional (2026-10-25 malam). Ini menggantikan pilihan sebelumnya (Konsep A, 2:30, tanpa narasi). Storyboard: `docs/video/storyboard.md`, menunggu persetujuan. Konsep B–D tetap usulan untuk final dan marketing.

## Hal yang menentukan semua konsep

**Video lomba kemungkinan harus jadi malam ini.** Pendaftaran dan paper ditutup 25 Okt 2026 sekitar 23.59 WIB, video demo masuk daftar berkas, dan juri menilai video di seleksi paper (`docs/developerday-2026-requirements.md`). YouTube tidak bisa mengganti file video di URL yang sama. Jadi video yang ikut dinilai di tahap 1 hanya boleh memuat apa yang jalan hari ini. Yang belum diketahui: apakah tautan video di formulir masih bisa diganti setelah karya dikirim. Pemegang akun pendaftaran adalah Indy; dia yang bisa mengeceknya.

Konsekuensinya ada dua jenis video:

1. **Video lomba tahap 1** (malam ini): hanya fitur yang jalan sekarang.
2. **Video final dan marketing** (direkam 7–9 Nov): WhatsApp asli, pencatatan, rekap. Dipakai sebagai cadangan demo live di final, materi pitch, dan konten sosial.

**Yang jalan hari ini dan aman ditampilkan sebagai jalan:**

- Landing di https://thya.veterantech.id (domain .id), status 200 saat dicek 17.27 WIB.
- API produksi `thya-api.sayyidrafee.com/health` 200. Agent menjawab omzet, HPP, laba kotor, margin kotor, menu terlaris dan tersepi, tren harian, dan menjelaskan istilah dengan angka si pemilik. Data contoh: Kopi Senja, Yogyakarta.
- Angka dihitung kode, bukan model; cek angka di runtime; eval 17 kasus PASS `pass^k` 1,00 (`docs/engine-plan.md` §6.1).
- LLM lewat NetraRuntime (infra Indonesia).

**Yang tidak boleh tampil sebagai jalan di video lomba:** WhatsApp, pencatatan transaksi lewat chat, rekap terjadwal, pengingat, grafik dan kartu ringkasan, isi Google Sheets, import sheet, email promo, dashboard web. Semua itu boleh muncul hanya dengan label "sedang dikerjakan" atau "menuju final".

Catatan untuk Rafee: hero landing menampilkan scene `sheets` dan `email` tanpa label (`showcase-scenes.ts:3-5`). Video lomba tidak boleh menyorot dua scene itu tanpa label, walaupun keduanya ada di halaman. Saat merekam landing, hindari tab itu atau beri teks layar "coming before the final".

Catatan lain: mockup chat di landing adalah jawaban asli yang dipendekkan dan diputar ulang, bukan chat live. Video tidak boleh menyebutnya "live". Paper bab 7 masih menulis "It calls the real agent, not scripted replies" untuk section chat di landing, padahal landing sekarang statis (`docs/decisions.md`, landing 2026-10-25). Itu urusan session paper, tapi video harus mengikuti kondisi nyata.

## Jadwal fitur dan tanggal paling cepat bisa direkam

Dari `docs/engine-plan.md` §6 dan `docs/business-features-plan.md` §7. Tanggal = hari slot itu selesai menurut plan, ditambah satu hari untuk perbaikan. Belum ada jaminan; cek status session engine dan fitur sebelum merekam.

| Adegan bergantung pada | Slot di plan | Paling cepat direkam | Risiko |
|---|---|---|---|
| Tanya angka lewat WhatsApp asli | Webhook WhatsApp 30 Okt–1 Nov | 2 Nov | Nomor test hanya untuk 5 nomor terdaftar; HP perekam harus terdaftar |
| Catat penjualan lewat teks + tombol Ya / Ubah / Batal | Write + draft 1–3 Nov | 4 Nov | |
| Onboarding HPP lewat chat | 1–3 Nov | 4 Nov | |
| Rekap harian terjadwal (teks) | S3 + S4, 3–5 Nov | 6 Nov | Di luar jendela 24 jam butuh template utility yang disetujui Meta |
| Pengingat ("ingatkan belanja tiap Senin") | S4, 3–5 Nov | 6 Nov | Urutan buang ke-3 |
| Grafik / kartu ringkasan mingguan (gambar) | S2, 3–5 Nov | 6 Nov | Urutan buang ke-2 |
| Isi Google Sheets dari link | S5 eksekutor 1–3 Nov | 4 Nov | Butuh service account; urutan buang ke-5 |
| Import penjualan dari sheet | S6, 1–3 Nov | 4 Nov | Urutan buang ke-4 |
| Email promo ke pelanggan | S7, 5–6 Nov | 7 Nov | Urutan buang pertama; butuh domain SES terverifikasi |
| Semua fitur stabil (freeze) | 7–9 Nov | **8–9 Nov** | Hari yang disarankan untuk rekaman final |

## Skill dan tool

| Skill | Dipakai untuk | Konsep |
|---|---|---|
| `hyperframes` (+ `hyperframes-cli`) | Mesin render HTML ke MP4. Semua konsep lewat sini | Semua |
| `product-launch-video` | Video promo dari URL produk: capture landing, design system, storyboard, render | A, B |
| `faceless-explainer` | Explainer tanpa footage; visual dibuat per adegan | C |
| `motion-graphics` | Potongan pendek < 30 detik: judul, hitung angka, lower-third | D, kartu di A |
| `media-use` | Musik latar, SFX, voiceover TTS, transkrip | Semua |
| `embedded-captions` | Subtitle di atas rekaman orang bicara | B, D kalau ada wajah |
| `talking-head-recut` | Kartu grafis di atas rekaman orang bicara | B, kalau Indy atau pemilik kedai tampil |
| `general-video` | Gabungan rekaman layar + kartu + footage, kalau workflow di atas terlalu kaku | A sebagai cadangan |

Rekaman layar sendiri memakai QuickTime (Mac) dan perekam layar bawaan HP. Tidak perlu tool baru.

Disk Mac Rafee saat dicek 17.27 WIB: **3,4 GB kosong** (bukan 5,9 GB). Perkiraan: rekaman layar QuickTime 1080p sekitar 0,5–1 GB per 5 menit (bisa dikompres ulang dengan ffmpeg), hasil render HyperFrames 3 menit 1080p sekitar 50–150 MB, ditambah cache render. Sebelum render apa pun, ukuran disk dicek ulang dan `npx hyperframes clean --dry-run` dijalankan.

## Konsep A · "Tanya, langsung dijawab" (video lomba malam ini)

**Tujuan:** penilaian juri tahap 1. Bisa diproduksi malam ini, hanya memakai fitur yang jalan.

**Durasi:** 2:30–3:00. Batas 5 menit, tapi juri menonton banyak video; lebih pendek lebih aman.

**Struktur:**

| # | Bagian | Isi | Syarat wajib yang dipenuhi |
|---|---|---|---|
| 1 | Masalah (0:00–0:25) | Pemilik kedai sibuk, catatan tercecer, omzet tinggi belum tentu untung. Teks layar + ilustrasi atau B-roll kedai | Gambaran solusi (konteks) |
| 2 | Thya dalam satu kalimat (0:25–0:40) | "Tanya lewat chat, jawab dengan angka usaha sendiri." Landing .id tampil | Gambaran solusi |
| 3 | Demo (0:40–2:00) | 4–5 pertanyaan asli ke prototype: omzet kemarin, menu terlaris, menu tersepi, margin bulan lalu, "HPP itu apa?". Jawaban ditampilkan di bingkai HP | Demonstrasi penggunaan sistem, fitur utama |
| 4 | Kenapa angkanya bisa dipercaya (2:00–2:30) | Angka dihitung kode; satu bukti mentah: rekaman terminal 10 detik memanggil API sungguhan, atau ringkasan hasil eval 17/17. Model di server Indonesia | Fitur utama, kualitas teknis |
| 5 | Menuju final (2:30–2:50) | Daftar berlabel jelas "in progress": WhatsApp, catat penjualan lewat chat, rekap harian | Kejujuran status |
| 6 | Penutup (2:50–3:00) | thya.veterantech.id, nama tim, .id DeveloperDay 2026 | |

**Cara demo tetap jujur:** jawaban diambil malam ini dari API produksi dengan script kecil di scratchpad (bukan di repo), lalu diputar di bingkai HP HyperFrames dengan label "Web prototype · sample data (Kopi Senja) · real answers, 25 Oct 2026". Satu adegan rekaman mentah tanpa edit (terminal atau HTTP client) membuktikan bahwa jawabannya dari sistem sungguhan. Bingkai HP sengaja tidak meniru tampilan WhatsApp persis, supaya tidak terbaca sebagai WhatsApp yang sudah live.

**Aset:**

- Rekaman layar landing .id (QuickTime, Rafee).
- Transkrip JSON 5 jawaban asli dari `/demo/chat` produksi (script, Rafee + agent).
- Rekaman terminal 10–15 detik (Rafee).
- Voiceover 2:30 (lihat keputusan bahasa di bawah). Pilihan: suara Indy atau Rafee direkam dengan mic Mac/HP di ruangan sepi, atau TTS lewat `media-use`.
- Musik latar tenang (`media-use`, katalog bebas lisensi).
- Opsional: foto atau B-roll kedai untuk bagian masalah. Tanpa foto, bagian ini dibuat motion-graphics.

**Siapa mengerjakan apa:**

- Rafee: rekaman layar, ambil jawaban API, rekaman terminal, setujui storyboard, upload YouTube unlisted.
- Indy: setujui naskah (pemilik pitch), rekam voiceover kalau suara manusia dipilih, cek apakah tautan video bisa diganti setelah submit, tempel tautan di formulir.
- Nawra: cek kalimat masalah agar sesuai paper bab 2 tanpa angka pasar yang belum valid.
- Agent: storyboard, naskah, build HyperFrames, render.

**Skill:** `product-launch-video` (capture landing + storyboard) dengan adegan demo dibangun di `hyperframes`, kartu bukti teknis lewat `motion-graphics`, audio lewat `media-use`.

**Risiko:** waktu. Dari persetujuan storyboard ke render final butuh sekitar 3–4 jam termasuk voiceover. Kalau storyboard belum disetujui sebelum sekitar 20.00 WIB, pakai cadangan: rekaman layar landing + terminal dengan voiceover langsung, diedit seadanya (QuickTime/iMovie), 90 detik.

## Konsep B · "Sehari di Kopi Senja" (video final + marketing utama)

**Tujuan:** marketing dan cadangan demo di final 10–11 Nov. Juri final juga bisa menontonnya kalau demo live gagal.

**Durasi:** 1:30–2:00.

**Struktur:** satu hari pemilik kedai, dari buka toko sampai tutup (arah yang sama dengan storyboard landing 02 di catatan bersama). Setiap jam ada satu interaksi WhatsApp asli:

| Jam | Adegan | Bergantung pada | Paling cepat direkam |
|---|---|---|---|
| 06.30 | Buka toko, rekap harian kemarin sudah masuk otomatis | Rekap terjadwal | 6 Nov |
| 12.30 | Sela antrean: "menu apa yang paling laku minggu ini?" | WhatsApp | 2 Nov |
| 15.00 | "Tadi laku 20 kopi susu" → kartu Ya / Ubah / Batal → tersimpan | Pencatatan + tombol | 4 Nov |
| 17.00 | "Untung bulan ini berapa?" + penjelasan istilah dengan angka sendiri | WhatsApp | 2 Nov |
| 21.30 | Tutup toko: kartu ringkasan mingguan bergambar | S2/S3 grafik | 6 Nov (buang kalau S2 dibuang) |

**Aset:**

- Rekaman layar WhatsApp asli dari HP yang nomornya terdaftar di nomor test (perekam layar iOS/Android).
- Footage kedai sungguhan: pemilik kedai yang ikut uji coba 7–9 Nov (dengan izin tertulis) atau anggota tim berperan di kedai kopi. Kamera HP cukup, horizontal 1080p.
- Voiceover pendek atau tanpa voiceover (teks layar + suara ambien kedai).
- Musik + SFX notifikasi WhatsApp (pakai SFX generik, bukan suara milik Meta).

**Siapa:** Nawra mencari kedai dan pemilik untuk syuting (sejalan dengan rekrutmen uji coba). Indy mengarahkan cerita dan pesan bisnis. Rafee menyiapkan data usaha di Thya, merekam layar WhatsApp. Agent: storyboard, build, render.

**Skill:** `product-launch-video` atau `general-video` untuk gabungan footage + rekaman layar, `embedded-captions` kalau pemilik kedai bicara ke kamera, `media-use` untuk audio.

**Risiko:** semua adegan bergantung pada fitur yang belum jalan. Rekam 8–9 Nov setelah freeze; adegan yang fiturnya dibuang ikut dibuang, bukan diakali dengan mockup.

## Konsep C · Explainer motion-graphics "Kenapa angkanya bisa dipercaya"

**Tujuan:** campuran. Untuk juri teknis (bobot Quality di Business Services 30%) dan untuk pitch final. Tidak bergantung pada fitur yang belum jalan, jadi bisa dibuat kapan saja.

**Durasi:** 60–90 detik.

**Struktur:** pertanyaan "untung minggu ini berapa?" → kata "untung" dipetakan ke metrik di registry → kode menghitung dari catatan penjualan → model hanya menyusun kalimat → cek angka: angka yang tidak ada di hasil hitungan dibuang → jawaban + penjelasan istilah. Ditutup dengan "data diproses di server Indonesia".

**Aset:** tidak perlu footage. Diagram dari `docs/paper/thya-architecture.png` dan `docs/semantic-education-flow.png` jadi acuan, digambar ulang sebagai animasi. Voiceover + musik.

**Siapa:** Rafee memeriksa kebenaran teknis. Indy memastikan bahasanya bisa dipahami juri bisnis. Agent: naskah, build, render.

**Skill:** `faceless-explainer`, `media-use`.

**Catatan:** versi 25–30 detiknya bisa jadi bagian 4 di Konsep A malam ini.

## Konsep D · Klip pendek vertikal 30–45 detik (sosial)

**Tujuan:** marketing (Instagram Reels, TikTok, status WhatsApp, LinkedIn).

**Durasi:** 30–45 detik, 9:16.

**Struktur:** hook 3 detik ("Omzet kemarin berapa? Tanya aja.") → satu pertanyaan, satu jawaban → satu kalimat alasan percaya → ajakan ke thya.veterantech.id.

**Versi:** D1 bisa dibuat sekarang dari bahan Konsep A (label "prototype"). D2 dipotong dari Konsep B setelah 9 Nov dengan WhatsApp asli.

**Aset:** turunan dari A atau B, subtitle wajib (banyak penonton sosial menonton tanpa suara).

**Siapa:** Indy memilih kanal dan jadwal posting. Agent: potong ulang dan render 9:16.

**Skill:** `motion-graphics` atau `product-launch-video` dengan aspek 9:16, `embedded-captions` kalau ada wajah.

## Rekomendasi

1. **Malam ini: Konsep A**, dengan bagian 4 memakai versi pendek Konsep C. Ini satu-satunya yang memenuhi tiga syarat wajib tanpa mengklaim fitur yang belum jalan, dan bisa jadi sebelum 23.59.
2. **8–9 Nov: Konsep B** untuk final dan marketing, lalu **D2** dipotong dari B.
3. Konsep C penuh dibuat kalau ada waktu sebelum final, untuk slide pitch.

## Keputusan yang dibutuhkan dari Rafee

1. Konsep mana untuk malam ini (rekomendasi: A).
2. Bahasa narasi. Pilihan: (a) narasi Indonesia + subtitle Inggris, (b) narasi Inggris dengan chat tetap Indonesia + terjemahan di layar, (c) narasi Indonesia saja. Paper berbahasa Inggris dan lomba ini jalur ke APICTA, tapi juri tahap 1 orang Indonesia dan isi chat berbahasa Indonesia. Rekomendasi: (b) narasi Inggris, chat Indonesia dengan terjemahan kecil di bawah bubble.
3. Suara narasi: manusia (Indy atau Rafee) atau TTS. Rekomendasi: suara manusia kalau ada 20 menit untuk merekam; TTS sebagai cadangan.
4. Indy perlu mengecek malam ini apakah tautan video bisa diubah setelah karya dikirim. Kalau bisa, video lomba boleh diganti dengan versi B setelah 9 Nov.
