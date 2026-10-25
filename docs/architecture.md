# Thya: arsitektur (usulan)

Status: usulan 2026-10-25, boleh diubah Rafee. Fondasi `apps/api` sudah ada; lihat "Status implementasi".

## Struktur repo

```
thya/
  apps/
    web/            Next.js: landing page + /demo (chat bergaya WhatsApp)
    api/            Bun + Elysia, satu codebase dengan dua entrypoint
      src/
        server.ts   HTTP: endpoint chat untuk /demo (webhook WhatsApp menyusul)
        worker.ts   stub; nanti scheduler + runner job (rekap harian, reminder)
        agent/      loop agent, tools, system prompt
        sales/      hitung omzet/HPP/margin + data seed demo (nanti diganti DB)
        channels/   (belum) whatsapp.ts (kirim/terima), demo.ts
        db/         (belum) schema Drizzle + migrasi
        llm.ts      satu-satunya tempat yang tahu provider LLM
      scripts/
        verify-netra-tools.ts   cek tool calling NetraRuntime (bun run verify:netra)
  docs/
  scripts/
  turbo.json, package.json (Bun workspaces), tsconfig.base.json, .env.example
```

## Status implementasi (2026-10-25)

Sudah ada di `apps/api`:
- `POST /demo/chat`: body `{ messages: UIMessage[] }` dari `useChat` (`DefaultChatTransport`), balasan berupa UI message stream AI SDK v7. Sejak 2026-10-25 (Q2) giliran diselesaikan dan dicek angkanya dulu, lalu dikirim sekaligus: bagian tool (output berstatus `ok`/`error`) diikuti satu teks, tanpa streaming per token. Hanya 20 pesan terakhir yang dikirim ke LLM. Pesan `system` dari client ditolak. Ukuran body maksimal 256 KB.
- `GET /health`.
- CORS manual (tanpa `@elysiajs/cors`): origin diambil dari env `WEB_ORIGINS` (dipisah koma), method `GET, POST, OPTIONS`, header `content-type`.
- Agent: `runTurn` (`src/agent/run-turn.ts`, `generateText`) + 4 tool + `stopWhen: isStepCount(5)`, budget `queryMetric` 4 putaran, timeout 40 detik per giliran, dan cek angka pasca-output (`postcheck.ts`, perilaku gagal Q2). Rincian di `docs/engine-plan.md` §6.1. Tool: `queryMetric` (satu angka: omzet, modal bahan, laba kotor, margin, jumlah terjual, atau "untung"; plus perbandingan periode sebelumnya, tafsiran istilah, dan penjelasan dari `src/semantic/`), `explainConcept` (penjelasan istilah dengan contoh angka user), `getTopMenuItems` (menu terlaris atau paling sepi), `getDailySales` (rincian harian, maksimal 31 hari). Input tool divalidasi Zod. Aturan periode ada di `src/sales/report.ts`: custom tanpa `endDate` atau yang melewati hari ini dipotong sampai hari ini, sedangkan custom yang mulai di masa depan atau sebelum data tersedia ditolak. Penolakan memakai `SalesQueryError`, yang diubah tool menjadi hasil `{ status: "error", message }` supaya model bisa menjelaskan atau memperbaiki panggilannya. Error lain ke UI disamarkan.
- Jawaban agent memakai format WhatsApp (`*tebal*`, daftar pakai `-`). Web perlu merender format itu atau menampilkannya apa adanya.
- Env dibaca dari `.env` di root repo (`bun --env-file=../../.env`). Server menolak start kalau `NETRA_API_KEY` kosong.

- **Postgres + Drizzle (2026-10-25).** Schema di `src/db/schema.ts`, migrasi di `apps/api/drizzle/`, dijalankan saat server start (`src/db/migrate.ts`, advisory lock). Server butuh `DATABASE_URL`. Demo "Kopi Senja" (11 menu, kedai kopi di Yogyakarta) di-seed ke Postgres per jam dari 120 hari lalu sampai 30 hari ke depan (`src/sales/repository.ts`, generator tetap `src/sales/demo-shop.ts`); loader hanya menghitung jam yang sudah lewat, jadi "hari ini" bergerak tanpa cron. Setiap giliran demo tercatat di `agent_turns` + `agent_steps`, dengan header `x-trace-id`. Rincian di `docs/engine-plan.md` §6.1.
- **Syarat deploy:** service Postgres di Dokploy dan env `DATABASE_URL` di `thya-api` (sudah ada sejak 2026-10-25). Tanpa itu API gagal start.

Ditunda:
- pg-boss, webhook WhatsApp, riwayat chat WhatsApp yang dipakai agent, rekap terjadwal (`worker.ts` masih stub).
- Rate limit untuk `/demo/chat`. Endpoint ini publik dan setiap request memakai kuota LLM, jadi perlu dipasang sebelum tautan prototype disebar luas.

Tidak ada `packages/*` dulu.
- `packages/ui` dan `packages/config` tidak dibutuhkan karena hanya satu app yang punya UI.
- `packages/agent` juga belum dibutuhkan. Rekap terjadwal memang butuh agent di dua proses (server dan worker), tapi keduanya ada di `apps/api` dan mengimpor `src/agent` yang sama.
- Pecah jadi `packages/agent` hanya kalau ada app lain yang perlu menjalankan agent langsung. Contohnya kalau worker dipindah ke app terpisah, atau `apps/web` menjalankan agent di server action. Selama web memanggil API lewat HTTP, ini tidak perlu.

## Dependency dan aturan supaya app ringan

Diperiksa dengan skill `siera-best-practices` pada 2026-10-25, sebelum ada kode. Daftar dependency disetujui Rafee, kecuali Playwright.

| Area | Pilihan | Aturan pakai |
|---|---|---|
| Web | `next` dengan `output: "export"` | Landing di-pre-render jadi HTML statis, tanpa server Next. Disajikan nginx dalam image yang dipublikasikan ke GHCR. `/demo` hanya memanggil API lewat HTTP |
| Styling | `tailwindcss` v4 | Token di `@theme`, tanpa `style={{}}` kecuali nilai yang baru ada saat runtime |
| Animasi | `motion` | Pakai `LazyMotion` + `m` dengan `domAnimation`, bukan `motion.*` penuh. Transisi sederhana cukup dengan CSS |
| Ikon | `lucide-react` | Import per ikon |
| Chat demo | `@ai-sdk/react` (`useChat`) | API mengembalikan UI message stream dari AI SDK |
| API | `elysia` | Validasi pakai Zod (Elysia 1.4 mendukung Standard Schema). Jangan campur TypeBox dan Zod |
| Agent | `ai`, `@ai-sdk/openai-compatible` | Provider hanya di `src/llm.ts` |
| Validasi | `zod` | Parse di setiap boundary: webhook WhatsApp, body request, input tool, output LLM, baris spreadsheet |
| DB | `drizzle-orm`, `postgres`, `drizzle-kit` (dev) | |
| Jadwal | `pg-boss` | Baru dipasang saat fitur rekap dikerjakan |
| Monorepo | `turbo` | |

Yang sengaja tidak dipakai:
- **TanStack Query**: web tidak punya server state selain chat demo, yang sudah diurus `useChat`.
- **Generated API client (OpenAPI/Eden)**: hanya ada satu endpoint yang dipanggil web. Pertimbangkan lagi kalau dashboard masuk scope.
- **Playwright**: tidak disetujui. Tes perilaku pakai `bun test` bawaan, tanpa dependency: parsing webhook, logika tool, perhitungan rekap.
- **`@elysiajs/cors`**: tidak ada di daftar yang disetujui. CORS cukup ditulis manual di `server.ts`.

Tooling dev yang ditambahkan saat scaffold, karena script `typecheck` diminta: `typescript` 7 (compiler native) dan `@types/bun`, keduanya devDependency `apps/api`. Belum dikonfirmasi Rafee.

Lint guardrail (disetujui 2026-10-25, terpasang di root):
- `bun run lint` = `oxlint --max-warnings=0` untuk seluruh repo, termasuk `apps/*`. Plugin anti-slop di-vendor di `tools/oxlint/anti-slop/` (provenance di `UPSTREAM.md`). Ke-18 rule generiknya plus `oxc/no-accumulating-spread` di-set error. Rule Effect tidak didaftarkan. Aturan styling `apps/web/**` (`@shadcn/lint` dan plugin lokal `tools/oxlint/thya/`) dijelaskan di `docs/landing-styling.md`; pola kode web di `docs/landing-patterns.md`. Konfigurasi ada di `.oxlintrc.json`.
- `bun run fmt` / `bun run fmt:check` = Oxfmt (`.oxfmtrc.json`). `docs/` dan semua `*.md` dikecualikan supaya dokumen tim tidak ikut diformat ulang.
- `oxlint`, `oxfmt`, dan `@oxlint/plugins` di-pin persis (1.89.0 / 0.74.0 / 1.89.0). Upgrade `oxlint` harus bersama `@oxlint/plugins`.
- Typecheck tetap memakai `tsc` dari `typescript` 7. Ini compiler native yang dulu dirilis sebagai preview `tsgo` (`@typescript/native-preview`), jadi tidak perlu paket terpisah.

## Alur pesan

```
WhatsApp user ──▶ Meta Cloud API ──webhook──▶ api/server.ts
                                                 │ simpan pesan masuk
                                                 ▼
                                            agent.run(userId, text)
                                                 │ generateText + tools (stopWhen)
                                                 │   tools: queryRecords, addTransaction,
                                                 │          readSpreadsheet, summarize,
                                                 │          createSchedule, ...
                                                 ▼
                                            balasan ──▶ WhatsApp send API
/demo (web) ──HTTP──▶ api/server.ts ──▶ agent.run(...) yang sama
```

Agent = loop LLM + tools. Vercel AI SDK `generateText` dengan `tools` dan `stopWhen` menjalankan tool call multi-langkah. Riwayat percakapan disimpan di tabel `messages` dan dimuat ulang tiap giliran. LangGraph baru dipertimbangkan kalau muncul alur bercabang yang butuh persetujuan user, misalnya "konfirmasi sebelum kirim PO ke supplier".

## Rekap terjadwal ("tiap hari buatin rekapan ya")

1. User meminta lewat chat. Agent memanggil tool `createSchedule({ cron, task, timezone: "Asia/Jakarta" })`, lalu barisnya disimpan di tabel `schedules`.
2. `worker.ts` mengecek jadwal yang jatuh tempo dan membuat job.
3. Job menjalankan `agent.run(userId, task)` dengan konteks data user, lalu menghasilkan teks rekap.
4. Pengiriman ke WhatsApp mengikuti dua kasus:
   - Di dalam jendela 24 jam sejak pesan terakhir user: boleh pesan bebas.
   - Di luar jendela 24 jam: **wajib template message** yang sudah disetujui Meta, kategori utility, berbayar per pesan. Contoh: `Rekap harian {{1}} sudah siap: {{2}}`. Template didaftarkan sebelum final.

Pilihan mesin jadwal (OPEN, butuh persetujuan dependency):
- **pg-boss** (rekomendasi): queue dan cron berbasis Postgres yang sudah ada, dengan retry dan tanpa Redis.
- Alternatif tanpa dependency: tabel `schedules` + loop `setInterval` tiap menit di worker. Cukup untuk demo, tapi retry dan locking harus dibuat sendiri.

Server dan worker memakai image Docker yang sama dengan command berbeda.

## LLM

- Default: **DeepSeek V4.1 Flash lewat NetraRuntime**, endpoint OpenAI-compatible (`https://api.netraruntime.com/v1`, model `deepseek/deepseek-v4.1-flash`). Infra di Indonesia, zero data retention secara default. Ini juga jawaban untuk pertanyaan UU PDP dari juri.
  - Catatan 2026-10-25: klaim infra Indonesia dan zero data retention berasal dari homepage Netra. API reference resmi tidak menyebut keduanya, tapi menyebut setting "organization recording" yang bisa merekam request. Cek setting itu di dashboard Netra sebelum klaim ini dikutip di paper.
- Diakses lewat provider OpenAI-compatible di AI SDK, hanya di `src/llm.ts`.
- **Perlu diverifikasi saat scaffold:** dukungan tool calling di NetraRuntime belum disebut di halaman mereka. Sumber pihak ketiga menyebut DeepSeek V4.1 Flash tidak memaksakan strict JSON schema, jadi input tool dan output terstruktur selalu divalidasi Zod dengan retry.
- **Terverifikasi 2026-10-25: tool calling jalan.** `bun run verify:netra` lulus: model memanggil tool, menerima hasilnya, lalu menjawab di langkah kedua. Lewat `/demo/chat`, model juga melakukan panggilan paralel dan multi-langkah, memakai riwayat chat, dan angka di jawabannya cocok dengan output tool. Waktu jawab sekitar 2 detik.
- **Quirk model yang wajib diikuti saat menambah tool:** kalau schema punya beberapa field opsional, DeepSeek V4.1 Flash di NetraRuntime hanya mengisi salah satunya (contoh: `startDate` dikirim, `endDate` hilang, berulang walau sudah diberi pesan error). Ini sudah dicek di argumen mentah dari API, bukan bug parsing. Solusinya: semua field input tool dibuat **wajib**, dan field yang tidak relevan diisi `null` (`.nullable()`, bukan `.optional()` atau `.default()`).
- Tanpa instruksi eksplisit, model kadang menulis kalimat pembuka berbahasa Inggris sebelum memanggil tool. System prompt sekarang melarangnya; dalam 6 percobaan berulang kalimat itu tidak muncul lagi.
- Hasil probe 2026-10-25 (`deepseek/deepseek-v4.1-flash`):
  - **Thinking mode mati secara default** di Netra; respons tidak memuat `reasoning_content`. Kalau dinyalakan lewat `providerOptions: { netra: { thinking: { type: "enabled" } } }`, `reasoning_content` muncul, AI SDK mengirimnya balik di giliran berikutnya, dan multi-step tetap jalan (tidak ada error 400 seperti di API resmi DeepSeek). `type: "disabled"` diterima tapi hasilnya sama dengan default.
  - **Bertentangan dengan docs:** docs menulis bahwa request dengan tools tanpa kontrol reasoning default ke effort `high`. Hasil uji ulang tidak begitu: request dengan tools tanpa kontrol menghasilkan 44 token output tanpa field reasoning apa pun (`reasoning`, `reasoning_content`, `reasoning_details`), persis sama dengan `thinking: disabled`. `reasoning: { effort: "high" }` juga tidak menghasilkan reasoning dalam 1 percobaan; hanya `thinking: { type: "enabled" }` yang menghasilkannya. Karena perilaku default bisa berubah mengikuti docs (lebih lambat dan lebih mahal), `src/llm.ts` sekarang memasang `thinking: { type: "disabled" }` secara eksplisit lewat `transformRequestBody` di provider. Ini satu tempat yang berlaku untuk semua pemanggil. Pemanggil yang mengisi `providerOptions.netra.thinking` tetap bisa menimpanya. Setelah dipasang (2026-10-25): `verify:netra` lulus; setiap panggilan provider dari agent membawa `thinking: {"type":"disabled"}`; stream mentah dari Netra tidak memuat field reasoning; dan `/demo/chat` tetap memanggil tool tanpa reasoning part.
  - **Cache prompt aktif.** Infonya ada di `usage.prompt_tokens_details.cached_tokens` (128–256 token untuk prefix yang berulang), bukan di `prompt_cache_hit_tokens`. `usage` juga memuat `latency_s`, `ttft_s` (sekitar 0,1–0,2 detik), dan `tpot_s`.
  - **Input gambar jalan** untuk gambar sederhana: PNG merah dan biru 32×32 dijawab "Merah" dan "Biru". Kemampuan membaca teks atau nota belum diuji.
  - **Base URL:** `https://api.netraruntime.com/v1` dipakai dan sudah terverifikasi dengan key. Docs resmi juga menyebut base ini (plus alternatif `https://api.netraruntime.com/api/v1`). `https://api.netra.sh/v1` tidak disebut di docs; host itu memberi respons identik tanpa key (katalog model, format error 401, dan origin Caddy sama), tapi lewat BunnyCDN dengan nama host "canary". Key sengaja tidak dikirim ke host kedua.
  - `repairToolCall` (tanpa prefix `experimental_`) tersedia di `ai` 7.0.153 untuk tool call yang gagal parse. Belum dipakai, karena setelah schema dibuat wajib + nullable tidak ada lagi input tool yang tidak valid.
- Menurut docs resmi (`https://api.netraruntime.com/docs`, yaitu `openapi.yaml`, plus panduan `responses-api.md` dan `errors.md` di `app.netraruntime.com/docs`, dibaca 2026-10-25):
  - **Kapasitas `deepseek/deepseek-v4.1-flash`:** context 1.048.576 token, output maksimal 131.072 token. Reasoning ikut memakai jatah output. Input berupa teks dan gambar; output hanya teks.
  - **Harga:** input USD 0,30, output USD 1,20, dan input dari cache USD 0,05 per 1 juta token. Sistemnya prepaid; saldo habis = error `402`.
  - **Tool calling:** didukung (`tools`, `tool_choice`). Parallel tool calls hanya didokumentasikan untuk Responses API (`parallel_tool_calls`), tidak untuk Chat Completions, walau di Chat Completions terbukti jalan. Opsi `strict` untuk argumen tool ada, tapi kata docs penegakannya "depends on the selected model's capabilities". Belum diuji sebagai alternatif aturan wajib + nullable.
  - **Structured output/JSON mode:** `response_format` tidak termasuk parameter yang didukung v4.1-flash di Chat Completions (hanya model 0731). Untuk v4.1-flash, JSON terstruktur lewat Responses API (`text.format` dengan `json_schema` atau `json_object`), atau lewat tool call seperti yang dipakai sekarang.
  - **Rate limit:** docs tidak memberi angka ("There is no universal requests-per-minute or tokens-per-minute allowance in these docs"). Limit ditentukan per key, organisasi, dan model; kalau terlampaui, `429` dengan `Retry-After`. Body request maksimal 64 MiB.
  - **Gambar:** gambar dikirim sebagai base64 atau URL HTTPS, dengan opsi `detail` `auto`/`low`/`high`, dan token gambar dihitung sebagai input.
  - **Audio, STT, OCR:** audio dan video input secara eksplisit tidak didukung ("File IDs, uploaded files, audio, and video input are not supported"). Tidak ada endpoint transkripsi atau OCR khusus; membaca nota hanya bisa lewat input gambar ke model, dan kualitasnya belum diuji.
  - **Embeddings:** endpoint `/v1/embeddings` ada, tapi katalog model saat ini hanya berisi 2 model chat. Jadi belum ada model embedding untuk rencana RAG + pgvector.

## Data

Satu Postgres dengan pgvector, diakses lewat Drizzle (`drizzle-orm` 0.45.4, `postgres` 3.4.9, `drizzle-kit` 0.31.11). Tabel (2026-10-25, `src/db/schema.ts`): `businesses` (nomor WhatsApp di sini), `menu_items`, `menu_costs` (bertanggal), `transactions`, `inbound_messages`, `messages`, `conversation_summaries`, `concept_events`, `drafts`, `agent_turns`, `agent_steps`, `outbound_messages`, `schedules`, `attachments`, `sheet_connections`, `customers`, `campaigns`, `campaign_recipients`. Tabel `documents` + embedding belum dibuat; baru kalau RAG dibutuhkan.

## Hosting

| Komponen | Tempat | Catatan |
|---|---|---|
| `apps/web` | Image nginx `ghcr.io/sayyidrafeed/thya-web` (pola Siera / nalarx-docs), dijalankan Dokploy di VPS yang sama, domain `thya.veterantech.id` | Next `output: "export"` → `out/`, di-gzip saat build, disajikan `nginx-unprivileged`. URL API ditanam saat build lewat `NEXT_PUBLIC_API_URL` |
| `apps/api` server + worker | VPS Sumopod (Tencent, Jakarta), dikelola Dokploy | Domain `thya-api.sayyidrafee.com` (juga URL webhook WhatsApp). Image dibangun GitHub Actions ke `ghcr.io/sayyidrafeed/thya-api`, lalu Dokploy menarik image itu. Env diisi di Dokploy. HTTPS lewat Traefik bawaan Dokploy + Let's Encrypt |
| Postgres + pgvector | Service database Dokploy di VPS yang sama | Rencana: image `pgvector/pgvector:0.8.7-pg17`, tanpa port publik, backup harian 02.00 WIB ke Cloudflare R2. Belum dibuat (ditunda 2026-10-25, `apps/api` belum memakai DB) |
| Dashboard Dokploy | `deploy.sayyidrafee.com` | Port 3000 tidak di-publish; akses hanya lewat HTTPS |

VPS: 2 vCPU / 4 GB / 60 GB SSD, Ubuntu 24.04, IP `43.173.20.60`. Dokploy menggantikan rencana awal Docker Compose + Caddy manual (keputusan Rafee, 2026-10-25): deploy, domain, sertifikat, dan backup database diurus dari satu dashboard. Hardening, akses, DNS, dan cara restore ada di [docs/ops/vps-runbook.md](ops/vps-runbook.md). Batas egress Tencent bersifat keras (VPS mati kalau kuota habis), jadi VPS ini tidak dipakai untuk menyajikan file besar.

## WhatsApp

- Hari ini: belum. `/demo` di web memakai agent yang sama.
- Sebelum final: nomor test WhatsApp Cloud API. Tidak butuh verifikasi bisnis, tapi hanya bisa mengirim ke maksimal 5 nomor terdaftar. Cukup untuk video dan demo final.
- Nomor production butuh verifikasi bisnis Meta; ini masuk Roadmap.
- Biaya: per pesan template, di luar 1.000 service message gratis per nomor per bulan. Sumber: ringkasan respond.io soal perubahan harga Oktober 2026. Cek dokumentasi resmi Meta sebelum mengutip angka di paper.
