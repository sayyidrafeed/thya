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
