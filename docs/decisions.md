# Log keputusan

Format: tanggal, keputusan, alasan, pemilik. Keputusan yang berubah tidak dihapus; tambahkan entri baru yang menggantikannya.

## 2026-10-25 (grilling Rafee)

- **Segmen:** positioning UMKM luas dengan adopsi digital rendah; F&B sebagai beachhead untuk demo, data, dan validasi. Alasan: demo lebih konkret dan diferensiasi lebih jelas. Pemilik: tim.
- **Channel:** WhatsApp adalah produk utama. Web hanya landing page + `/demo`. Pemilik: Rafee.
- **Domain:** subdomain `veterantech.id`, rencana `thya.veterantech.id`. Pemilik: Rafee.
- **Submit hari ini:** landing page + `/demo` chat bergaya WhatsApp yang memanggil agent sungguhan. Status di paper: Prototype. Pemilik: Rafee.
- **Repo:** Turborepo + Bun workspaces, `apps/web` + `apps/api`, tanpa `packages/*` dulu. Pemilik: Rafee.
- **Agent:** Vercel AI SDK (tool calling multi-langkah), bukan LangGraph. Alasan: agent pertama, waktu sempit, alur belum bercabang. Bab 4 paper perlu disesuaikan. Pemilik: Rafee.
- **DB:** satu Postgres + pgvector, bukan vector DB terpisah. Pemilik: Rafee.
- **LLM:** DeepSeek V4.1 Flash lewat NetraRuntime (infra Indonesia). Pemilik: Rafee.
- **Hosting:** API + DB di VPS Rafee (spek dinilai feasible). Web di Vercel, masih usulan.
- **Pembagian peran:** Indy = Team Lead & Business, Nawra = Product & Research Lead, Rafee = Tech Lead / Engineer.
- **Kategori lomba:** diputuskan tim, belum final.
- **Landing page:** yang diambil dari nalarx.com hanya pola mockup WhatsApp (HP di tengah, tab fitur yang mengganti isi chat). Tema visual belum diputuskan; Rafee akan membawa referensi sendiri. Bukan tema gelap Nalar.
- **Bahasa landing:** English first.
- **Aset brand:** logo dan maskot resolusi tinggi sudah ada, akan dikirim Rafee.
- **Scope session ini:** hanya konteks project. Susunan section landing dan acceptance test landing dibahas di session terpisah.
- **Dependency:** disetujui: turbo, next, react, tailwindcss v4, motion, lucide-react, @ai-sdk/react, elysia, ai, @ai-sdk/openai-compatible, zod, drizzle-orm, postgres, drizzle-kit, pg-boss. **Playwright tidak disetujui.** Aturan pakainya ada di `docs/architecture.md`.
- **Lint guardrail:** oxlint, oxfmt, @oxlint/plugins (anti-slop vendored), dan tsgo disetujui dan masuk scaffold. Pemilik: Rafee.
- **Web dibuat statis:** Next.js `output: "export"`, karena landing tidak butuh server. Masih usulan.
- **Jadwal hari ini disetujui:** s.d. 10.00 scaffold + landing; s.d. 13.00 agent + `/demo` + tes tool calling Netra; s.d. 15.00 deploy + DNS; sore screenshot/video; malam buffer. Jam kebutuhan screenshot dari Nawra belum diketahui.

## 2026-10-25 (scaffold backend, dikerjakan agent untuk Rafee, belum direview)

- **DB/Drizzle dan pg-boss ditunda.** Demo submit hari ini memakai data seed statis deterministik (`apps/api/src/sales/demo-shop.ts`). Alasan: cukup untuk `/demo`, dan fungsi hitungnya sudah menerima data sebagai argumen sehingga mudah dipindah ke Postgres. Pemilik: Rafee.
- **CORS ditulis manual**, tanpa `@elysiajs/cors`. Alasan: paket itu tidak ada di daftar dependency yang disetujui. Pemilik: Rafee.
- **`typescript` 7 dan `@types/bun` dipasang sebagai devDependency `apps/api`.** Alasan: script `typecheck` diminta, dan dua paket ini tidak ada di daftar yang disetujui. Perlu konfirmasi Rafee.
- **Format jawaban agent mengikuti WhatsApp** (`*tebal*`, daftar `-`, tanpa tabel atau heading). Alasan: channel utama adalah WhatsApp; `/demo` meniru tampilannya. Pemilik: Rafee.
- **Lint guardrail terpasang; `tsgo` diganti `typescript` 7.** oxlint 1.89.0, @oxlint/plugins 1.89.0, dan oxfmt 0.74.0 dipasang persis di root. Anti-slop di-vendor dari upstream commit `13909c9`. Gate `lint` dan `fmt:check` sudah dibuktikan gagal lewat pelanggaran yang ditanam. `@typescript/native-preview` (paket `tsgo`) tidak dipasang, karena `typescript` 7.0.2 yang sudah terpasang adalah compiler native yang sama dalam versi stabil, sedangkan paket preview-nya lebih tua (build Juli 2026). Pemilik: Rafee.

## 2026-10-25 (grilling harness agent, Rafee)

- **Angka hanya dari tool deterministik.** LLM tidak boleh berhitung atau mengarang angka. Pemilik: Rafee.
- **Konfirmasi sebelum write.** Setiap pencatatan transaksi ditampilkan ringkasannya dulu, lalu disimpan setelah user menjawab "ya". Write harus idempoten. Pemilik: Rafee.
- **Identitas:** satu nomor WhatsApp = satu usaha. Onboarding lewat chat. Pemilik: Rafee.
- **Satu agent** dengan sedikit tool, bukan multi-agent per departemen. Dipecah hanya kalau eval menunjukkan akurasi pemilihan tool turun. Pemilik: Rafee (mengikuti rekomendasi agent).
- **Memory:** profil usaha terstruktur di DB. Dari sisi user, percakapan terasa sebagai satu thread panjang. Mekanisme di belakangnya (compaction, caching) sedang diriset.
- **Tracing:** tabel Postgres sendiri atau Langfuse self-host. Keduanya boleh, asalkan data tetap di infra sendiri.
- **Tanpa model fallback dan tanpa circuit breaker.** Fokusnya mengoptimalkan reliability satu model.
- **Sedang diriset (2026-10-25):** strategi input data dan connector (Composio vs alternatif), semantic layer, pola webhook WhatsApp, pg-boss vs BullMQ, provider STT, kemampuan NetraRuntime, guardrail per kasus, rencana eval suite. Hasilnya akan masuk `docs/agent-harness.md`.
- **Tool calling NetraRuntime terverifikasi; input tool wajib + nullable.** Verifikasi live lulus pada 2026-10-25. DeepSeek V4.1 Flash hanya mengisi satu dari beberapa field opsional, jadi semua field input tool dibuat wajib, dengan `null` untuk field yang tidak relevan. Ditambah periode `last_14_days` dan aturan custom: tanpa `endDate` atau melewati hari ini = sampai hari ini. Pemilik: Rafee.

## 2026-10-25 (grilling harness ronde 2, Rafee)

- **HPP:** onboarding lewat chat menanyakan modal per porsi untuk 3–5 menu utama. Selama datanya belum ada, laba dan food cost dijawab "belum bisa dihitung", bukan 0. Pemilik: Rafee.
- **Istilah ambigu:** sementara memakai default + sebut definisi. Rafee menilai ini masalah semantic layer sekaligus edukasi pemilik warung, jadi dibuka riset terpisah (semantic + edukasi). Keputusan final menunggu hasil riset itu.
- **Buffer pesan beruntun:** 3 detik. Referensi pengalaman: Instinct (instinct.com), yang dipakai Rafee sebagai benchmark UX WhatsApp.
- **Cache bersama Netra:** tidak opt-out selama hackathon. Dievaluasi ulang sebelum ada data user sungguhan. Pemilik: Rafee (diserahkan ke rekomendasi agent).
- **Tracing:** tabel Postgres sendiri, bukan Langfuse self-host.
- **Biaya template WhatsApp** (berbayar sejak 1 Okt 2026, termasuk di dalam jendela 24 jam) diteruskan ke Indy untuk business model.

## 2026-10-25 (semantic layer + edukasi, Rafee menerima D1–D9 dari `docs/semantic-education.md` §7)

- **D1 Teks penjelasan:** template deterministik di tool. Model hanya merangkai kalimat di sekitarnya.
- **D2 Default "untung":** laba kotor kalau biaya operasional kosong, laba bersih kalau ada. Selalu disertai `interpretedFrom` (tafsiran yang dipakai). Menggantikan aturan sementara "default + sebut definisi".
- **D3 Cakupan HPP:** bahan + kemasan + es per porsi. Gas, listrik, sewa, dan gaji masuk biaya operasional.
- **D4 HPP perkiraan:** boleh, dengan label "perkiraan" di setiap angka turunannya.
- **D5 `ConceptExposure`:** satu tabel kecil di Postgres untuk mencatat konsep yang sudah dijelaskan per usaha.
- **D6 Pemicu penjelasan:** field `explain` di `queryMetric` untuk penjelasan otomatis, plus tool `explainConcept` untuk pertanyaan "maksudnya?".
- **D7 Benchmark food cost:** tidak ditampilkan untuk final.
- **D8 Penyetuju copy penjelasan:** Nawra untuk isi, Rafee untuk konsistensi dengan metrik.
- **D9 Klaim di paper:** "Thya explains each metric in plain language using the owner's own numbers". Tanpa klaim peningkatan literasi.

## 2026-10-25 (landing: styling dan deploy web, Rafee)

- **Lint styling web terpasang.** `@shadcn/lint` 0.2.0 (devDependency root) plus plugin lokal `tools/oxlint/thya/` (`no-css-properties`, `no-dynamic-class-fragments`) untuk `apps/web/**`. `shadcn/no-inline-styles` menggantikan `react/forbid-dom-props`. Aturannya ada di `docs/landing-styling.md`. Alasan: Rafee ingin pola styling minimal setara PWN, Siera, FIKES, dan Dignition, tanpa `style={{}}` atau `CSSProperties`. Pemilik: Rafee.
- **Deploy web: static export → image nginx → GHCR**, mengikuti Siera dan nalarx-docs. Menggantikan usulan Vercel. Tempat container berjalan belum diputuskan. Pemilik: Rafee.
- **Pola kode `apps/web` mengikuti Siera, lalu FIKES, lalu nalarx-docs** (urutan dari Rafee). Dirangkum dan diperbaiki di `docs/landing-patterns.md`. `tsconfig.base.json` ditambah `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noImplicitOverride`. `exactOptionalPropertyTypes` hanya untuk `apps/web`, karena tipe `streamText` di `apps/api` gagal dengan flag itu. Rule lint baru: `complexity` (12 di web, 20 di repo), `max-lines` 200 di web, rule React dan import dari Siera/FIKES. `no-console` dan `no-non-null-assertion` hanya di web karena `apps/api` masih melanggar. Pemilik: Rafee.

## 2026-10-25 (infra)

- **VPS:** Sumopod, 2 core / RAM 4 GB, Rp90.000/bulan, aktif s.d. 25/11/2026 dengan auto-renewal. Disk, OS, dan region belum dicatat. Pemilik: Rafee.
- **Deploy lewat Dokploy** (Traefik bawaan), menggantikan rencana Docker Compose + Caddy manual. Setup dan hardening dikerjakan di session terpisah. Pemilik: Rafee.

## 2026-10-25 (semantic + edukasi tahap 1, dikerjakan agent untuk Rafee)

- **`queryMetric` menggantikan `getSalesSummary`.** Satu tool untuk satu angka (omzet, modal bahan, laba kotor, margin, laba bersih, jumlah terjual, plus `profit` untuk "untung"), dengan field `interpretedAs` dan `explanation`. `getTopMenuItems` dan `getDailySales` tetap. Kode ada di `apps/api/src/semantic/`. Pemilik: Rafee.
- **"untung" selalu dihitung sebagai laba kotor** sampai ada pencatatan biaya operasional. Laba bersih dikembalikan sebagai data belum tersedia, tanpa angka. Ini penerapan D2 untuk kondisi data sekarang.
- **Paparan konsep di `/demo` dihitung ulang dari history yang dikirim client.** History ini tidak tepercaya. Bagian tool yang rusak dilewati, dan bagian palsu hanya bisa membuat Thya menjelaskan lebih banyak atau lebih sedikit, tidak mengubah angka. Tabel Postgres menyusul di tahap 2 bersama WhatsApp.
- **Belum dikerjakan di tahap 1:** jendela 14 hari untuk naik level, cakupan parsial modal per menu (E10), onboarding HPP, dan event `term_corrected`.
- **`apps/web` di-scaffold** (Next 16.4.3, React 19.3, Tailwind 4.3.3, motion 14.6, `@ai-sdk/react` 4 + `ai` 7, zod 4, lucide-react). Paket pendamping yang tidak ada di daftar tapi wajib: `react-dom`, `@tailwindcss/postcss`, `@types/react`, `@types/react-dom`, `@types/node` (diminta Next untuk typecheck), `@types/bun`, dan `typescript` 7.0.2 (sama dengan `apps/api`; terbukti jalan dengan `next build`). Token warna dan copy masih placeholder sampai referensi visual dari Rafee. Pemilik: Rafee.
- **Landing satu route (`/`); `/demo` dilebur jadi section chat di landing.** Section dan UI placeholder hasil scaffold dihapus; yang tersisa fondasi (config, token, parser format WhatsApp, `use-demo-chat`, `MotionProvider`, Docker/nginx). Endpoint API `POST /demo/chat` tidak berubah. Strategi: page Server Component, island client sekecil mungkin, chat dimuat lazy. Tautan prototype di paper menjadi URL landing. Pemilik: Rafee.

## 2026-10-25 (grilling engine plan, Rafee; rincian di `docs/engine-plan.md` §7)

- **Q1 Konfirmasi write:** setiap write membuat draft di Postgres (argumen dibekukan, `expires_at`, sekali pakai). Pemilik mengonfirmasi lewat kartu WhatsApp dengan tombol `Ya` / `Ubah` / `Batal`; tap `Ya` diproses kode tanpa model dan mengeksekusi argumen tersimpan. Teks "ya" yang diketik menjadi jalur cadangan: model memanggil `confirmDraft()`, kode hanya mengeksekusi satu-satunya draft terbuka. `toolApproval` AI SDK tidak dipakai, karena uji 2026-10-25 menunjukkan riwayat yang diputar ulang mengeksekusi write lagi. Pemilik: Rafee.
- **Q2 Cek angka gagal:** pemilik warung tidak pernah melihat error teknis. Angka karangan di kalimat tambahan: kalimat itu dibuang. Di jawaban utama: regenerate sekali secara diam-diam, lalu jawaban template dari hasil tool. Angka tanpa tool sama sekali: regenerate dengan tool wajib, lalu pesan singkat yang meminta periode. Semua dicatat sebagai insiden. Pemilik: Rafee.
- **Q3 Pencatatan transaksi lewat chat teks masuk final 10 Nov** (draft → kartu `Ya` / `Ubah` / `Batal`). Foto nota dan voice note tetap Roadmap. Menyelesaikan kontradiksi harness §2 vs paper bab 7; session paper sudah menyesuaikan bab 4, 7, dan 10. Pemilik: Rafee (keputusan), Indy (isi paper).
- **Q4 Eval LLM dijalankan on demand**, tidak nightly. Pemilik: Rafee.
- **Q5 Target eval:** `pass^5` = 100% untuk kategori angka pasti dan lintas usaha (satu kegagalan = blocker), `pass^3` ≥ 90% untuk regression lain, capability tanpa target, judge nada advisory. Pemilik: Rafee.
- **Q6 Satu pesan WhatsApp per balasan** (keputusan produk untuk sekarang). Reply plan multi-bubble tetap diimplementasikan sebagai basis eksperimen, dipilih lewat konstanta di kode, bukan env atau konfigurasi runtime. Default: satu pesan. Kartu konfirmasi selalu pesan terpisah. Pemilik: Rafee.
- **Q7 Batas langkah:** tetap `isStepCount(5)`, plus budget per tool (`queryMetric` maksimal 4 putaran, lalu tool membalas "susun jawaban sekarang"). Pesan batas langkah hanya menyebut penyebab yang teramati. Pemilik: Rafee.
- **Q8 Riwayat di DB:** `result.responseMessages` disimpan sebagai `ModelMessage` per baris + metadata. Trace id terpusat: satu UUIDv7 (`Bun.randomUUIDv7()`) per giliran, dibawa pesan masuk/keluar, `messages`, `agent_steps`, draft, job pg-boss, dan log, lewat satu modul `trace.ts` dengan `AsyncLocalStorage`. `/demo/chat` mengembalikan header `x-trace-id`. Pemilik: Rafee.
- **Q10 Judge eval:** DeepSeek hanya menjalankan Thya. Judge nada (E13) dan analisis kegagalan dikerjakan Claude di Claude Code atas transkrip run, on demand, tanpa dependency atau key baru. Data seed sintetis boleh dikirim ke Claude. Transkrip uji coba nyata hanya dikirim ke Claude setelah dianonimkan secara natural (nama dan angka diganti pengganti yang realistis). Data sintetis boleh diperkaya dengan usaha seed tambahan. Pemilik: Rafee.
- **Q9 Arsitektur `apps/api`:** modular monolith ringan ala Siera, bukan DDD. Folder per konsep bisnis (bukan per peran), fungsi bukan class, repository hanya untuk transaksi atau query yang dipakai ulang, satu `DomainError` + satu pemetaan error, job per modul dirangkai di satu file worker. Modul: `business`, `menu`, `sales`, `semantic`, `drafts`, `conversation`, `schedules`, `traces`; antarmuka `agent/`, `channels/whatsapp/`, `http/`. Tool agent memanggil service modul, tidak memakai Drizzle langsung; transisi draft dengan guard `UPDATE … WHERE status='pending'`. Boundary ditegakkan `no-restricted-imports` oxlint (import lintas modul hanya lewat `index.ts`; `agent/` dan `channels/` tidak mengimpor `db/`). Tes integrasi memakai Postgres container (`pgvector/pgvector:0.8.7-pg17`, CI service + lokal) di balik `RUN_INTEGRATION_TESTS=1`, tanpa PGlite. Session engine memegang seluruh `apps/api`; `apps/web`, `docs/paper`, dan `docs/ops` tetap di session lain. Alasan: benchmark Dignition ("DDD") tidak memakai aggregate/VO/event dan aturan isolasinya dilanggar 35 file; aturan import Siera hanya di prosa dan bocor 31–33 kali. Pemilik: Rafee.

## 2026-10-25 (landing: isi dan susunan, Rafee)

- **Susunan landing disetujui:** header, hero, mockup HP 4 tab, how it works (2 poin), live demo Kopi Senja, section status (jalan hari ini vs sedang dikerjakan), footer. Rincian dan copy di `docs/landing-content.md`. Tema visual masih menunggu referensi Rafee. Pemilik: Rafee.
- **Headline:** "Ask how your shop did today. Get the answer in a chat." Pemilik: Rafee.
- **Section status dipakai**, karena WhatsApp belum live; landing tidak boleh terbaca seolah Thya sudah bisa dipakai lewat WhatsApp. Pemilik: Rafee.
- **Isi mockup chat = jawaban asli `/demo/chat` yang dipendekkan** (snapshot 2026-10-25). Tidak ada angka yang ditulis tangan. Pemilik: Rafee.
- **Landing statis penuh; chat demo live yang memanggil API ditunda.** Landing tidak memanggil `/demo/chat` dulu. Mockup HP tetap memakai jawaban asli prototype. `use-demo-chat.ts` dan `lib/env.ts` dibiarkan tanpa pemakai. Section status menyebut demo web yang bisa dicoba sebagai "sedang dikerjakan". Tautan prototype di paper tetap URL landing; session paper perlu memastikan teksnya tidak menjanjikan chat live. Pemilik: Rafee.

## 2026-10-25 (fitur bisnis, Rafee menyetujui default `docs/business-features-plan.md`)

- **Gate 0 disetujui sesuai default (G1–G9).** Renderer `@tanstack/charts` + `@resvg/resvg-js` + satu font OFL di `apps/api/assets/fonts/` (cadangan `echarts`). Grafik masuk final setelah rekap jalan. Isi rekap disusun kode, bukan agent; langkah 3 rekap terjadwal di `docs/architecture.md` diganti. Google Sheets lewat service account (pemilik membagikan sheet sebagai Editor), klien `fetch` + JWT tanpa `googleapis`. Email lewat Amazon SES `ap-southeast-3` dengan SigV4 ditulis sendiri, penerima final hanya seed demo yang setuju (allowlist sandbox). Nomor test tetap jalan; nomor asli tanpa verifikasi dicoba di samping. Tiga template utility (rekap harian, rekap mingguan dengan header IMAGE, pengingat). Pemilik: Rafee.
- **Perubahan keputusan engine yang disetujui:** Q1 diperluas dengan status draft `executing`/`failed` dan `Ubah` = batalkan draft lalu buat draft baru; Q6 balasan bergambar memakai caption, dua pesan hanya kalau balasan > 1.024 karakter; Q7 budget `showChart` ≤ 1 dan `draftPromoEmail` ≤ 2 per giliran; Q9b ditambah modul `visuals`, `attachments`, `recaps`, `sheets`, `customers`, `campaigns`; Q9e thread fitur boleh memegang folder modul barunya sendiri, file bersama tetap di session engine (§8 plan). Pemilik: Rafee.
- **Scene landing `sheets` dan `email` wajib bisa didemokan 10 Nov**, atau diturunkan di hari yang sama dengan keputusan membuang slice-nya. Urutan buang: S7, S2, pengingat, S6, S5. Pemilik: Rafee.

## 2026-10-25 (sumber data GoPay/QRIS, Rafee)

- **Tidak ada penarikan otomatis dari GoBiz atau bank untuk final.** Rafee memutuskan memakai ekstraksi dari gambar dan berkas yang dikirim pemilik (screenshot riwayat/settlement GoPay Merchant atau m-banking, ekspor laporan) lewat input gambar DeepSeek V4.1 Flash di NetraRuntime. Use case ini wajib dibuka untuk final, dengan syarat akurasinya terbukti pada sampel asli. Ringkasan riset ada di `docs/agent-harness.md` §2. Pemilik: Rafee.

## 2026-10-25 (praktik agent dari startup, Rafee menyetujui rekomendasi session engine atas `docs/agent-practices.md`)

- **U1 Versi di setiap run dan giliran:** `summary.json` eval dan setiap baris `agent_turns` mencatat id model, commit git (plus tanda kalau ada perubahan yang belum di-commit), dan hash SHA-256 dari system prompt + skema tool. Pemilik: Rafee.
- **U2 + U3 Perbandingan run dan laporan gagal:** `bun run eval:compare <runA> <runB>` mencetak lulus/total per kasus; kasus regression yang turun membuat status BLOCKED. Setiap run menulis `report.md` yang hanya berisi percobaan gagal (pesan user, tool + argumen, hasil tool, balasan, cek yang gagal). Pemilik: Rafee.
- **U4 Formatter WhatsApp di kode:** `**x**` → `*x*`, heading dan tabel Markdown dibuang atau diratakan, berlaku untuk WhatsApp dan demo; grader format (G5) memeriksa keluaran setelah formatter. Alasan: aturan prompt bocor (`**Rp4.100.000**`). Pemilik: Rafee.
- **U5 Aturan kerja prompt:** aturan baru yang terkait tool ditaruh di hasil tool, bukan ditambah ke system prompt. Setiap aturan di `agent/prompt.ts` diberi komentar id kasus eval asalnya. Pemilik: Rafee.
- **U6 Uji coba 7–9 Nov:** semua percakapan dibaca, bukan sampel, dengan label biner + kritik satu kalimat. Transkrip nyata hanya dibaca Claude setelah dianonimkan dan dengan izin peserta (Q10). Pembaca dan pemberi label: Rafee; query harian dan alat dari session engine. Pemilik: Rafee.
- **U7 Dari trace ke kasus:** `bun run eval:from-trace <traceId>` membuat kerangka `EvalCase` dengan anonimisasi Q10, setelah WhatsApp hidup. Pemilik: Rafee.
- **U8 Intervensi cek angka sebagai REVIEW:** kalau jumlah intervensi Q2 (kalimat dibuang, regenerate, template, maaf) naik dibanding baseline, status run menjadi REVIEW, bukan BLOCKED. Alasan: di eval sintetis jumlahnya mendekati nol (0 dari 66 giliran), jadi BLOCKED akan memblokir rilis karena noise. Pemilik: Rafee.
- **U9 Kasus pemulihan + perubahan Q7:** 3–4 kasus eval pemulihan dari error tool (periode tidak valid, budget habis, data kosong). **Q7 diubah: budget `queryMetric` turun dari 4 ke 3 putaran per giliran**, batas langkah tetap `isStepCount(5)`, supaya pesan "budget habis" jatuh sebelum langkah terakhir dan benar-benar dibaca model. Menggantikan angka 4 di entri Q7. Pemilik: Rafee.
- **U10 Daftar tool:** tool yang tidak dikonfigurasi di deployment (misalnya Sheets tanpa kredensial) tidak didaftarkan; tool yang bergantung pada keadaan data usaha tetap didaftarkan dan membalas status `not_ready` dengan panduan; daftar tool tidak berubah di tengah thread. Menyempurnakan A7 di `docs/engine-plan.md`. Dampak ke cache belum diukur. Pemilik: Rafee.
- **U11–U15 Roadmap:** simulasi persona, judge kedua dari keluarga model lain, sinyal implisit, rilis snapshot dengan rollback, pemantauan quality rating nomor WhatsApp.
- **Klaim paper:** angka eval ditulis sebagai hasil offline di data sintetis satu toko. Pemilik isi paper: Indy dan Nawra.

## 2026-10-25 · Landing: revisi tim (marketing dan bisnis)

- **Pilihan A/B final:** Meet Thya memakai varian Character (A). Kata-kata yang melayang diganti tile aplikasi UMKM: GoFood, GrabFood, ShopeeFood, WhatsApp, Google Sheets, Gmail. Glyph-nya dari Simple Icons (CC0), di-inline tanpa dependency. Latar ASCII DeveloperDay memakai Flow (A), dan footer memakai Untangle (C). Semua switcher dihapus. Pemilik: Rafee.
- **Role tim di footer:** Indy (Product Owner), Nawra (Business Analyst), Rafee (AI Engineer).
- **Diagram Problem:** meniru layout "Inside the intelligence layer" dari nalarx.com dengan palet Thya: sumber data → engine Thya → toko pemilik.
- **Testimonial:** section carousel ditambahkan di atas FAQ, berisi cerita ilustratif dengan nama fiktif. Catatan "fictional" di halaman dihapus atas keputusan Rafee (2026-10-25), walau FAQ menyatakan Thya belum dipakai di WhatsApp. Ganti dengan kutipan pilot asli begitu ada.
- **Terbuka:** sekarang landing mengklaim "Works with your apps" (GoFood, GrabFood, ShopeeFood, WhatsApp, Sheets), padahal belum ada konektor yang jalan. Rafee perlu memutuskan apakah ini dibangun sebelum final atau copy-nya dilunakkan.
- **Demo statis:** rencananya ada di `docs/landing-demo-plan.md` dan masih menunggu 3 keputusan Rafee.
