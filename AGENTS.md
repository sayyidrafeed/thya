# Thya

Thya adalah AI business assistant untuk UMKM dengan adopsi digital rendah. Channel utamanya WhatsApp: pemilik usaha bertanya, mencatat, dan menerima rekap lewat chat. Web hanya untuk landing page dan halaman demo.

Project ini dibuat untuk lomba .id DeveloperDay 2026 (PANDI, Road to APICTA). Konsumen utama file ini adalah coding agent; anggota tim juga boleh membacanya.

## Baca dulu

| File | Isi |
|---|---|
| [docs/developerday-2026-requirements.md](docs/developerday-2026-requirements.md) | Aturan lomba, berkas wajib, timeline, rubrik penilaian |
| [docs/product-context.md](docs/product-context.md) | Masalah, target user, solusi, status, keputusan yang masih terbuka |
| [docs/architecture.md](docs/architecture.md) | Struktur repo, alur agent, rekap terjadwal, WhatsApp, hosting |
| [docs/agent-harness.md](docs/agent-harness.md) | Desain harness agent: data masuk, registry metrik, webhook + queue, memory, guardrail, eval, STT |
| [docs/semantic-education.md](docs/semantic-education.md) | Registry metrik + edukasi istilah bisnis untuk pemilik warung, onboarding HPP (D1–D9 diterima 2026-10-25) |
| [docs/engine-plan.md](docs/engine-plan.md) | Tech plan engine (harness + eval suite) dari perbandingan SuperNalar, NalarX, dan praktik luar. Q1–Q10 diputuskan 2026-10-25 |
| [docs/feature-catalog.md](docs/feature-catalog.md) | Riset katalog fitur: grafik tanpa Python, rekap/pengingat, dokumen, aksi Google |
| [docs/business-features-plan.md](docs/business-features-plan.md) | Tech plan fitur bisnis (visual, jadwal, Sheets, email), disetujui 2026-10-25. Dikerjakan session fitur; kontrak dengan engine ada di engine-plan §5.1 dan §6 |
| [docs/ops/vps-runbook.md](docs/ops/vps-runbook.md) | VPS + Dokploy: akses (ssh thya / thya-ops), hardening, DNS, CI/CD GHCR, restore, batasan untuk agent |
| [docs/decisions.md](docs/decisions.md) | Log keputusan beserta tanggal dan alasannya |
| [docs/landing-styling.md](docs/landing-styling.md) | Aturan styling `apps/web`: token, Tailwind, larangan inline style, lint yang menegakkannya |
| [docs/landing-patterns.md](docs/landing-patterns.md) | Pola kode `apps/web` dari Siera/FIKES/nalarx-docs: lapisan, static export, deploy nginx, file contoh |
| [docs/proposal/slides-snapshot.txt](docs/proposal/slides-snapshot.txt) | Snapshot teks draft proposal (Google Slides) |

## Tim

| Orang | Peran | Pemilik keputusan |
|---|---|---|
| Indy | Team Lead & Business, pemegang akun pendaftaran | Kategori lomba, business model, pitch |
| Nawra | Product & Research Lead | Problem definition, riset user, data pasar, isi paper |
| Rafee | Tech Lead / Engineer | Arsitektur, implementasi, landing page, demo |

Agent bekerja untuk Rafee. Isi paper dan Slides milik Indy dan Nawra: agent boleh menemukan masalah dan mengusulkan teks, tapi tidak mengubah klaim bisnis atau angka pasar sendiri.

## Batasan yang tidak boleh dilanggar

- **Domain .id wajib.** Landing page tayang di subdomain `veterantech.id` (rencana: `thya.veterantech.id`). Tanpa domain .id, karya tidak sah.
- **Paper berbahasa Inggris.** Copy landing page boleh Indonesia; teks yang masuk paper harus Inggris.
- **Data keuangan UMKM tidak boleh keluar Indonesia tanpa alasan.** LLM default lewat NetraRuntime (infra di Indonesia, zero data retention). Provider dibungkus di satu modul supaya bisa diganti.
- **Jangan klaim kemampuan yang belum jalan.** Status di paper dan landing harus sesuai apa yang benar-benar bisa didemokan.

## Tanggal penting

- 25 Okt 2026, ±23.59 WIB: batas pendaftaran + submit paper (paper PDF, tautan prototype, video demo disarankan)
- 10–11 Nov 2026: final, presentasi dan demo langsung
- 7 Des 2026: APICTA Award

## Stack (lihat docs/architecture.md)

Bun workspaces + Turborepo. `apps/web` Next.js, `apps/api` Elysia di Bun, Vercel AI SDK untuk agent, Postgres + pgvector dengan Drizzle, WhatsApp Cloud API, LLM DeepSeek V4.1 Flash lewat NetraRuntime. Deploy ke satu VPS Jakarta lewat Dokploy (Traefik + HTTPS); image dibangun GitHub Actions ke GHCR. Lihat `docs/ops/vps-runbook.md`. Postgres dan backup belum berjalan.

## Cara kerja

- Pakai `bun`, bukan npm/pnpm/yarn.
- Bahasa kode dan identifier: Inggris. Copy landing: English first. Copy di dalam chat Thya untuk user UMKM: Bahasa Indonesia santai dan sederhana.
- Ikuti aturan dependency di `docs/architecture.md` (web statis, Zod di setiap boundary, `LazyMotion`, tanpa Playwright).
- Jangan menambah dependency, menyimpan secret ke file yang di-commit, atau commit/push tanpa diminta.
- Setiap keputusan baru dicatat di `docs/decisions.md` dengan tanggal, lalu update dokumen pemiliknya saja.
- Saat Slides berubah, jalankan `scripts/sync-slides.sh`, lalu cek `git diff docs/proposal/` dan sesuaikan `docs/product-context.md` bila perlu.
