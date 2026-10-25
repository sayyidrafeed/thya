# Storyboard: video perkenalan Thya (versi lomba)

Status: **draft, menunggu persetujuan Rafee.** Render dan produksi belum dimulai. Revisi ketiga, 2026-10-25 malam.

## Dasar

- Brief tim business di Google Docs: "Create a cinematic product introduction video storyboard for Thya" (dibaca 2026-10-25). Isinya 60–75 detik, 70–80% demo situs asli, cerita satu pemilik usaha F&B, tagline "Thya. Business Made Simpler.", palet `#03432F` dan `#8ECF52`, dan larangan menampilkan fitur yang belum jalan.
- Keputusan Rafee (2026-10-25), yang mengubah brief:
  - Tanpa TTS dan tanpa VO. Pesan dibawa teks layar, musik, dan SFX.
  - Dibangun dengan HyperFrames. Maskot dihidupkan dengan `rossark-motion-skill` (Rafee menyebutnya "rosetta"; saya artikan skill ini).
  - Source of truth demo adalah demo web yang sedang dibuat Rafee. Isi chat di video mengikuti apa yang demo itu tampilkan saat direkam.
  - Revisi 2026-10-25 malam (Rafee: "kenapa gak lu aja yang bikin mock rekaman demonya"): scene 3–6 tidak menunggu rekaman. Chat demo dibangun ulang di HyperFrames dengan gaya chat landing, header "Thya · Web prototype" tanpa WhatsApp. Isinya pertanyaan dan jawaban asli dari `mockup-conversations.ts`, kata per kata. Rekaman demo web Rafee tetap bisa menggantikannya nanti.
  - Revisi pace (Rafee, 2026-10-25 malam: "percepat pacenya dan kasi kaya smooth fast zoom gitu kaya product marketing"): durasi jadi 60,6 detik (hook 0–4,5, meet 4,5–11, demo 11–54,6, penutup 54,6–60,6). Setiap jawaban mendapat punch-in kamera cepat ke baris yang disorot; terjemahan tampil sebagai kartu di kanan bawah saat kamera masuk. Waktu per adegan di bawah ini masih versi 70 detik; sumber kebenaran waktu adalah proyek HyperFrames.
  - Revisi intro dan label (Rafee, 2026-10-25 malam): intro dipercepat (hook 3,4 dtk, meet 5 dtk, total 58 dtk). Pill "Sample data" dan label "Web prototype" dihapus dari video atas permintaan Rafee; keterangan data contoh tetap ada di deskripsi YouTube.
  - Revisi fitur (Rafee, 2026-10-25 malam: "buat yang fitur grafik file dan sheets ya anggep aja udah ada feature tersebut, dan gak usah ada yang next on 10 november"): demo ditambah grafik omzet 7 hari (data seed 18–24 Okt dari `apps/web/src/lib/playground/flows.ts`) dan isi Google Sheets dari link (baris 23–24 Okt dari `showcase-scenes.ts`), keduanya tampil sebagai fitur yang sudah ada. Kartu "Next, for the final on 10 November" dihapus. Total 68,6 detik. Catatan: per 2026-10-25 kedua fitur belum jalan (S2 dan S5 di `business-features-plan.md`), jadi ini bertentangan dengan aturan "jangan klaim kemampuan yang belum jalan" di `AGENTS.md`; keputusan diambil Rafee. Kedua fitur harus jalan sebelum final, atau video diganti.
  - Revisi rasa startup (Rafee, 2026-10-25 malam): cold open 1,8 detik (close-up jawaban omzet asli, lalu kamera mundur), jendela chat miring 3D dengan latar gradien, caption 2–4 kata ("Ask in plain Indonesian.", "Numbers you can trust.", "Know what sells.", "Every term, explained.", "Charts. Sheets. Done.", "Less admin. More shop."), terjemahan satu baris, dan tombol kirim yang membesar menjadi latar penutup. Total 70,4 detik. Rafee menolak label "coming before the final".
  - Animasi yang sudah ada di landing dipakai ulang.
- Video referensi "Introducing Claude Duet" tidak dibuka, karena tautannya tautan share Google.

## Aturan isi

- **Angka dan teks chat diambil dari rekaman demo web, bukan ditulis tangan.** Kutipan jawaban di storyboard ini berasal dari Playground sekarang (`apps/web/src/lib/playground/flows.ts`, jawaban asli `POST /demo/chat` 25 Okt 2026 sekitar 11.32 WIB) dan berfungsi sebagai placeholder. Kalau demo baru memanggil agent secara live, data Kopi Senja dihitung relatif terhadap hari ini, jadi angkanya akan berbeda. Terjemahan dan sorotan di video ditulis ulang dari rekaman final.
- **Kata "live" dan "real time" hanya dipakai kalau demo yang direkam memang memanggil agent.** Kalau yang direkam masih Playground (pilih tombol, jawaban diputar ulang), teks layar tidak menyebut keduanya.
- Terjemahan Inggris menerjemahkan atau meringkas jawaban, tanpa angka baru.
- WhatsApp, pencatatan transaksi, dan rekap hanya muncul di kartu berlabel `In progress`.

### Jangan direkam, atau crop keluar frame

| Bagian | Alasan |
|---|---|
| Baris hero "Get the answer on WhatsApp." dan ikon WhatsApp di hero | WhatsApp belum live |
| Teks header HP "Your agent on WhatsApp" | Sama. Crop dengan zoom ke badan chat, kecuali demo baru tidak memakainya lagi |
| Pertanyaan atau scene grafik (`Weekly chart`) | Agent belum mengirim grafik (S2, paling cepat 6 Nov) |
| Kutipan hero "Tambahin omzet..." dan "Kirim promo...", How it works 03 dan 04, tab `Update a sheet` / `Email customers` | Sheets dan email belum jalan (paling cepat 4 dan 7 Nov) |
| Kartu "Works with your apps" (WhatsApp, Sheets, Gmail, QRIS), label "Auto-sync" di diagram masalah | Belum jalan |
| Baris engine "Checked before sending" / "Numbers checked · Sources shown" | Cek angka ada di kode lokal, belum tentu sudah di-deploy |
| Section "Owner stories" | Nama dan kutipan fiktif (`testimonials.ts`), tidak ditandai fiktif di halaman |
| Footer "with no data kept" | Zero data retention belum dikonfirmasi (`landing-content.md`) |

## Bahan animasi yang dipakai ulang

| Bahan | Asal | Dipakai di | Cara masuk ke HyperFrames |
|---|---|---|---|
| Seni serat "Untangle" (benang kusut yang terurai) | `components/landing/footer-art.tsx`, `lib/footer-art/fibres.ts` | Scene 1 dan 7 | Fungsi `untangle` di-port ke komposisi dan digerakkan oleh waktu timeline (aturan HyperFrames: tanpa timer atau random tanpa seed). Cadangan: rekam layar footer, lalu crop area seni saja |
| Maskot Thya | `public/brand/thya-mascot.png` (749×928) | Scene 2 dan 7 | `rossark-motion-skill`: kedip, napas pelan, sedikit memiringkan kepala, satu lambaian saat muncul. Gerak dibuat di timeline GSAP |
| Animasi kata headline "Ask how your shop did today." | `components/landing/hero-heading.tsx` | Scene 2 | Dibangun ulang di HyperFrames (kata per kata, ease `[0.22, 1, 0.36, 1]` yang sama), tanpa baris WhatsApp dan tanpa kutipan sheets/email |
| Garis putus-putus dengan denyut | `components/landing/flow-connector.tsx` | Scene 3 (kartu "calculated by code") | Dibangun ulang sebagai SVG di HyperFrames |
| Indikator mengetik dan munculnya bubble | Demo web | Scene 3–5 | Dari rekaman layar demo |

## Spesifikasi

| Hal | Nilai |
|---|---|
| Durasi | 1:10 (70 detik) |
| Format | 1920×1080, 30 fps, MP4 H.264, stereo AAC |
| Warna overlay | Deep green `#03432F`, lime `#8ECF52` (sorot, transisi). Situs memakai `#1c6b47`; overlay tidak menimpa warna situs |
| Tipografi | Geist (sama dengan situs), Geist Mono untuk label kecil |
| Teks layar | Maksimal sekitar 10 kata per kartu, tampil minimal 2,5 detik + 0,3 detik per kata |
| Label tetap | `Prototype · sample data (Kopi Senja)` di pojok kanan bawah selama scene 3–5 |
| Audio | Musik instrumental hangat, mulai pelan, naik di scene 3–5, selesai bersih di scene 7. SFX klik, ketik, pop pesan, whoosh lembut |

## Ringkasan adegan

| # | Judul | Waktu | Durasi | Bahan utama |
|---|---|---|---|---|
| 1 | Opening hook | 0:00–0:06 | 6 dtk | Seni serat kusut + teks (footage opsional) |
| 2 | Meet Thya | 0:06–0:14 | 8 dtk | Maskot + headline animasi → demo web |
| 3 | Understand business performance | 0:14–0:29 | 15 dtk | Demo: omzet kemarin + kartu "calculated by code" |
| 4 | Discover business insights | 0:29–0:43 | 14 dtk | Demo: menu terlaris, menu sepi |
| 5 | From numbers to a next step | 0:43–0:56 | 13 dtk | Demo: margin + saran bundling, kartu `In progress` |
| 6 | Return to the business | 0:56–1:02 | 6 dtk | Footage opsional atau zoom-out demo |
| 7 | Brand closing | 1:02–1:10 | 8 dtk | Serat terurai menjadi brand card |

Porsi demo web: scene 2 (separuh) sampai 6, sekitar 50 dari 70 detik (71%).

## Adegan

### Scene 1 · Opening hook (0:00–0:06, 6 dtk)

- **Tujuan naratif:** menjalankan usaha itu banyak urusan, dan catatannya tercecer.
- **Visual:** latar `#03432F`. Serat "Untangle" dalam keadaan kusut bergerak pelan memenuhi layar. Teks muncul di tengah. Kalau ada footage, 2 potongan 1,5 detik (tangan mencatat di buku, tumpukan nota) di detik 0–3 sebelum serat masuk.
- **Kamera dan editing:** serat bergerak lambat; di detik 5 serat mulai merapat ke tengah dan mengecil, mengantar ke scene 2.
- **Teks layar:**
  1. `You run the business.` (0:00–0:03)
  2. `But who helps you make sense of it?` (0:03–0:06)
- **Audio:** room tone atau ambien kedai pelan; musik masuk sangat pelan di detik 2.
- **Catatan produksi:** kalimat dari usulan VO brief, dipendekkan. Footage hanya kalau Indy atau Nawra bisa merekam malam ini di kedai yang memberi izin; horizontal, 1080p atau 4K, 30 fps, tanpa wajah pelanggan.

### Scene 2 · Meet Thya (0:06–0:14, 8 dtk)

- **Tujuan naratif:** Thya adalah asisten usaha yang diajak bicara lewat chat, dalam bahasa sehari-hari.
- **Visual:** serat dari scene 1 merapat menjadi maskot Thya, yang mendarat dengan pantulan kecil lalu melambai sekali. Di sampingnya headline muncul kata per kata. Lalu frame menggeser ke rekaman demo web.
- **Interaksi situs:** rekaman demo web dalam keadaan awal (sapaan pembuka, belum ada pertanyaan).
- **Kamera dan editing:** maskot dan headline 0:06–0:10; transisi geser horizontal 600 ms ke demo web 0:10–0:14, rekaman dibingkai di atas latar terang dengan sudut membulat.
- **Teks layar:**
  1. `Meet Thya.` (0:06–0:08)
  2. `Ask how your shop did today.` (animasi kata per kata, 0:08–0:11)
  3. `A business assistant you talk to in a chat, in everyday Indonesian.` (0:11–0:14, di atas rekaman demo)
- **Audio:** musik naik satu lapis saat maskot mendarat; whoosh lembut di transisi.
- **Catatan produksi:** gerak maskot mengikuti `rossark-motion-skill`: tidak ada gerak yang "teleport", kedip dan napas tetap jalan sampai maskot keluar frame.

### Scene 3 · Understand business performance (0:14–0:29, 15 dtk)

- **Tujuan naratif:** tanya dengan bahasa biasa, dapat angka dari catatan penjualan beserta artinya.
- **Visual:** rekaman demo memenuhi sekitar 60% frame; di 0:25–0:29 kartu kecil "calculated by code" muncul di sisi kanan.
- **Interaksi situs:** pertanyaan "Omzet kemarin berapa?" (diketik kalau demo menyediakan kolom input, dipilih dari tombol kalau masih Playground), indikator mengetik, lalu jawaban. Placeholder dari Playground:
  > Omzet kemarin (*24 Okt 2026*) *Rp4.100.000*, naik *+25,8%* dibanding sehari sebelumnya (Rp3.260.000). Omzet itu semua uang masuk dari jualan, belum dipotong modal bahan Rp1.621.500.
- **Kamera dan editing:** kursor pelan ke tombol atau kolom input, lalu zoom 1,3× ke bubble jawaban. Sorot lime di bawah angka omzet dan persentase (0:19–0:21), lalu di bawah kalimat penjelasan istilah (0:21–0:25). Kartu kanan: tiga kotak kecil `Your sales records` → `Calculated by code` → `Plain answer`, dihubungkan garis putus-putus dengan denyut lime.
- **Teks layar:**
  - Terjemahan: `Yesterday's revenue: Rp4,100,000, up 25.8% on the day before. Revenue is all the money in from sales, before ingredient costs.` (sesuaikan dengan rekaman final)
  - Kartu: `Numbers come from your records, not from the AI.`
- **Audio:** klik atau ketik halus, pop saat jawaban muncul, musik naik.
- **Catatan produksi:** kalimat kartu diambil dari How it works (`landing-content.md`) dan FAQ. Header HP "Your agent on WhatsApp" harus di luar frame.

### Scene 4 · Discover business insights (0:29–0:43, 14 dtk)

- **Tujuan naratif:** tahu menu yang laku dan yang diam, beserta marginnya.
- **Visual:** demo yang sama, dua pertanyaan berurutan dalam satu percakapan.
- **Interaksi situs:**
  1. "Menu apa yang paling laku minggu ini?" → tiga menu teratas (placeholder: Es Kopi Susu Gula Aren 290 terjual, margin 58,3%).
  2. "Menu apa yang kurang laku bulan ini?" → tiga menu tersepi (placeholder: "Croissant Butter paling sedikit terjual sekaligus marginnya paling tipis.").
- **Kamera dan editing:** sorot lime pada baris menu teratas (0:31–0:35), jump cut melewati waktu tunggu, sorot baris kesimpulan menu sepi (0:38–0:42). Daftar lengkap tidak perlu terbaca.
- **Teks layar:**
  - `See what sells, what sits, and the margin on each.` (0:29–0:32)
  - Terjemahan 1: `Best seller this week: Es Kopi Susu Gula Aren, 290 sold.`
  - Terjemahan 2: `Croissant Butter sells the least and has the thinnest margin.`
- **Audio:** dua klik atau ketik + pop, musik di puncak energi.

### Scene 5 · From numbers to a next step (0:43–0:56, 13 dtk)

Pengganti scene "Turn insights into action" di brief, karena Sheets dan email belum jalan.

- **Tujuan naratif:** Thya menjelaskan istilah dengan bahasa warung dan memberi satu hal untuk dicoba.
- **Interaksi situs:** "Margin bulan lalu gimana?" → jawaban margin (placeholder: "dari tiap Rp100.000 jualan, sekitar Rp60.500 tersisa setelah modal bahan"). Lalu scroll thread ke baris saran di jawaban menu terlaris ("Saran: coba paket bundling Es Kopi Susu + Pisang Goreng biar nilai transaksi naik.").
- **Kamera dan editing:**
  - 0:43–0:48: zoom ke kalimat Rp100.000 → Rp60.500, sorot lime.
  - 0:48–0:52: cut ke baris saran bundling, sorot lime.
  - 0:52–0:56: kartu penuh `#03432F`.
- **Teks layar:**
  - `Every term explained in plain words.` (0:43–0:46)
  - Terjemahan margin: `From every Rp100,000 in sales, about Rp60,500 is left after ingredient costs.`
  - `And one thing to try tomorrow.` (0:48–0:52), dengan terjemahan saran `Tip: bundle Es Kopi Susu with Pisang Goreng.`
  - Kartu: `Next, for the final on 10 November` · `On WhatsApp` · `Record sales by chat, saved after you confirm` · `A daily recap, sent automatically`, masing-masing dengan chip `In progress`.
- **Audio:** musik mulai turun di kartu; swell lembut ke kartu.
- **Catatan produksi:** "Every term explained" diambil dari `meet-thya.ts` ("Every answer names the term and says what it means"). Sheets dan email tidak ada di kartu karena urutan buang pertama (`business-features-plan.md` §7).

### Scene 6 · Return to the business (0:56–1:02, 6 dtk)

- **Tujuan naratif:** tujuan akhirnya adalah waktu untuk usaha, tanpa klaim hasil yang belum diukur.
- **Visual:** dengan footage, pemilik menyajikan kopi (4 detik) diselingi 1 shot demo (2 detik). Tanpa footage, zoom out pelan dari demo ke seluruh halaman, lalu serat "Untangle" mulai masuk dari tepi.
- **Teks layar:** `Less time figuring it out. More time for the shop.`
- **Audio:** musik menuju resolusi.
- **Catatan produksi:** dari usulan VO brief, dipendekkan. Tidak menyebut jam yang dihemat atau kenaikan omzet.

### Scene 7 · Brand closing (1:02–1:10, 8 dtk)

- **Tujuan naratif:** nama dan tempat untuk mencoba Thya.
- **Visual:** latar `#03432F`. Serat "Untangle" yang tadi kusut sekarang terurai menjadi garis rapi (pasangan visual dengan scene 1: "messy notes in, clear answers out"). Maskot di tengah, kedip sekali, lalu wordmark dan tagline.
- **Kamera dan editing:** serat terurai 1:02–1:05, elemen teks masuk berurutan 150 ms, 3 detik terakhir diam kecuali napas maskot.
- **Teks layar:** `Thya. Business Made Simpler.` · `thya.veterantech.id` · wordmark `.id DeveloperDay 2026`.
- **Audio:** akor penutup, tanpa SFX.
- **Catatan produksi:** wordmark DeveloperDay dari `public/brand/developerday-wordmark.webp`. Tagline dari brief business (pemilik Indy); di situs belum ada.

## A. Naskah teks layar (urut)

1. You run the business.
2. But who helps you make sense of it?
3. Meet Thya.
4. Ask how your shop did today.
5. A business assistant you talk to in a chat, in everyday Indonesian.
6. Numbers come from your records, not from the AI.
7. See what sells, what sits, and the margin on each.
8. Every term explained in plain words.
9. And one thing to try tomorrow.
10. Next, for the final on 10 November: On WhatsApp · Record sales by chat, saved after you confirm · A daily recap, sent automatically (In progress)
11. Less time figuring it out. More time for the shop.
12. Thya. Business Made Simpler. · thya.veterantech.id

Ditambah terjemahan jawaban di scene 3–5, ditulis dari rekaman final.

## B. Checklist rekaman demo web

Persiapan: Chrome profil bersih, bookmark bar disembunyikan, jendela 1440×900, zoom halaman 110%, mode terang. QuickTime "Record Selected Portion" di area demo saja. Muat ulang sebelum setiap take.

1. Demo dalam keadaan awal, diam 3 detik.
2. Omzet kemarin: tanya, tunggu jawaban lengkap, diam 3 detik.
3. Menu paling laku minggu ini: sama.
4. Menu kurang laku bulan ini: sama.
5. Margin bulan lalu: sama. (Di Playground sekarang, setelah langkah 4 hanya `Weekly chart` dan `Last month's margin` yang aktif; pilih margin.)
6. Scroll thread pelan ke baris saran bundling, diam 3 detik.
7. Jangan tanya atau pilih grafik, Sheets, atau email.

Rekam 2–3 take. Kalau demo memanggil agent live, catat jam rekam: angka di video berlaku untuk data contoh pada jam itu, dan jawaban bisa berbeda antar-take. Pakai satu take utuh supaya angka antar-scene konsisten.

## C. Checklist aset

| Aset | Sumber | Pemilik | Status |
|---|---|---|---|
| Demo web (source of truth) | Sedang dibuat | Rafee | Belum |
| Rekaman demo (checklist B) | QuickTime | Rafee | Belum |
| Footage kedai, 3–4 shot × 5 dtk (opsional) | Kamera HP horizontal | Indy atau Nawra | Belum pasti |
| Maskot | `apps/web/public/brand/thya-mascot.png` | Ada | Siap |
| Seni serat "Untangle" | `apps/web/src/lib/footer-art/fibres.ts` | Port oleh agent | Siap dipakai |
| Wordmark DeveloperDay | `apps/web/public/brand/developerday-wordmark.webp` | Ada | Siap |
| Font Geist, Geist Mono | Google Fonts (OFL) | Agent | Siap |
| Musik latar 70 dtk | `media-use` (katalog bebas lisensi) | Agent | Belum |
| SFX klik, ketik, pop, whoosh | `media-use` (paket offline bawaan) | Agent | Belum |

## D. Panduan editing

- **Tempo:** waktu tunggu indikator mengetik maksimal 0,7 detik di layar. Scroll panjang diganti cut.
- **Transisi:** geser horizontal sekali (scene 2), serat sebagai benang merah pembuka dan penutup. Tidak ada efek dekoratif lain.
- **Rekaman:** dibingkai di atas latar `#F4F6F2`, sudut 16 px, bayangan halus. Zoom maksimal 1,4× (rekaman Retina 2×). Gerak zoom ease-in-out 600–800 ms.
- **Teks:** kalimat utama di sepertiga atas atau samping rekaman, Geist Semibold 56 px. Terjemahan di sepertiga bawah, Geist 34 px, maksimal 2 baris, putih di atas pita `#03432F` 90%. Label prototype di kanan bawah, Geist Mono 20 px.
- **Audio:** tanpa VO, musik jadi lapisan utama di sekitar -16 LUFS; SFX 6–8 dB di bawah musik. Ekspor -14 LUFS terintegrasi.

## E. Catatan verifikasi produk

| Bagian brief | Status | Pengganti |
|---|---|---|
| VO Inggris | Dihapus atas keputusan Rafee | Teks layar (naskah A) |
| User mengetik pertanyaan | Bergantung demo web baru. Playground sekarang memakai tombol | Ikuti demo saat direkam |
| Scene 5: Google Sheets, email promo | Belum jalan; paling cepat bisa direkam 4 Nov (Sheets) dan 7 Nov (email) | Penjelasan istilah, saran bundling, kartu `In progress` |
| Grafik omzet mingguan | Agent belum mengirim grafik | Tidak dipakai |
| Footage pemilik UMKM | Bergantung ada yang syuting malam ini | Seni serat dan zoom-out demo |
| Target pasar Jabodetabek, kelontong dan retail | Dokumen produk memakai beachhead F&B, data contoh kedai kopi Yogyakarta | Hanya F&B yang tampil; perbedaan diteruskan ke Indy dan Nawra |
| Palet `#03432F` / `#8ECF52`, tagline "Business Made Simpler" | Berbeda dari situs (`#1c6b47`, "Messy notes in. Clear answers out.") | Dipakai di overlay dan brand card saja |

## Produksi (setelah disetujui dan demo web siap)

1. Cek disk (`df -h /`; sore ini 3,4 GB kosong). Rekaman dikompres ulang dengan ffmpeg ke sekitar 20–40 MB. Proyek HyperFrames di scratchpad. Render 70 detik `delivery` diperkirakan 20–50 MB.
2. Agent menyiapkan bagian yang tidak bergantung pada demo lebih dulu: scene 1, 2 (maskot, headline), kartu scene 3 dan 5, scene 7. Ini bisa mulai sebelum rekaman masuk.
3. Rafee merekam checklist B setelah demo siap.
4. Agent memasang rekaman, menulis terjemahan dari rekaman, render `draft` untuk dicek Rafee, lalu `delivery`.
5. Cek akhir: angka di terjemahan cocok dengan rekaman; "WhatsApp" hanya di kartu `In progress`; tidak ada testimoni, Sheets, email, grafik, "Auto-sync", atau "no data kept".
6. Upload YouTube unlisted; Indy menempelkan tautan di formulir sebelum 23.59 WIB.

## Usulan judul dan deskripsi YouTube

- Judul: `Introducing Thya (prototype) · .id DeveloperDay 2026`
- Deskripsi: `Thya is an AI business assistant for small Indonesian food and beverage shops. Owners ask about their sales in everyday Indonesian and get the answer from their own records, with the terms explained. This video shows the prototype at thya.veterantech.id with sample data from a fictional coffee shop, Kopi Senja. WhatsApp, recording sales by chat, and daily recaps are in progress for the final.`
