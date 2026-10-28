# Thya: desain harness agent

Status: draft 2026-10-25, hasil grilling Rafee ditambah empat riset paralel. Bagian bertanda **OPEN** belum diputuskan. Bagian bertanda **VERIFY** bergantung pada hasil uji NetraRuntime yang belum dijalankan.

Harness adalah semua hal di sekitar loop agent (`generateText` + tools) yang membuat Thya bisa dipakai pemilik warung lewat WhatsApp: cara data masuk, definisi angka, alur webhook, antrean, memory, reliability, guardrail, dan eval.

## 1. Prinsip

1. **Angka hanya dari tool deterministik.** LLM memilih metrik dan periode, kode yang menghitung. Angka di balasan yang tidak ada di hasil tool giliran itu dianggap bug.
2. **Write selalu lewat konfirmasi.** Ringkasan ditampilkan, user menjawab "ya", baru disimpan. Write idempoten.
3. **Model diperlakukan sebagai user yang tidak dipercaya.** `businessId` diambil dari sesi (nomor WhatsApp), tidak pernah dari argumen model.
4. **Satu agent, sedikit tool.** Tool tidak tumpang tindih, parameternya sedikit, dan pilihan dibatasi enum.
5. **Satu thread panjang dari sisi user**, dengan pengelolaan konteks di belakangnya.
6. **Tanpa model fallback dan tanpa circuit breaker.** Reliability dicapai dengan validasi, repair, timeout, dan pesan yang jujur.

## 2. Data masuk

| Jalur | MVP (final 10 Nov) | Catatan |
|---|---|---|
| Chat teks ("tadi laku 20 kopi susu") | Ya | Diparse ke draf transaksi, lalu dikonfirmasi |
| Foto nota atau struk | Ya, **VERIFY** vision di Netra | Netra tidak mendokumentasikan input gambar. Kalau tidak didukung, perlu jalur OCR terpisah (Netra menyebut alat OCR gratis, belum dicek) |
| Voice note | Kandidat, lihat §10 | Netra tidak menyediakan STT |
| Google Sheets | Import, bukan dibaca live | Google Sheets API langsung dengan scope `drive.file` (non-sensitive, tanpa verifikasi app). Kolom dipetakan dan dikonfirmasi user |
| POS (majoo, GoBiz, Moka, Qasir, Pawoon) | Tidak | majoo Open API butuh Prime + Rp25 juta tahun pertama. GoBiz butuh verifikasi partner. Sisanya tidak punya jalur publik yang terkonfirmasi |
| Platform connector (Composio, Nango, Pipedream, Arcade) | Tidak | Tidak ada konektor POS Indonesia yang ditemukan, lokasi data tidak dijamin, dan kebutuhan Thya hanya satu (Sheets). Evaluasi ulang kalau user meminta lebih dari ~3 SaaS global |

**GoPay Merchant / QRIS (riset 2026-10-25):**
- Tidak ditemukan API resmi untuk menarik transaksi atau settlement GoBiz. Portal developer hanya mendokumentasikan Food dan Payment (buat QRIS, status per order). SDK komunitas yang menarik mutasi lewat login portal diperingatkan penulisnya sendiri berisiko melanggar ToS. Sumber: https://developer.gobiz.com, https://jsr.io/@xirf/gobiz-merchant-sdk
- SNAP BI (Transaction History, Bank Statement) butuh sertifikasi dan kemitraan bank. Tidak realistis untuk tim kecil. Sumber: https://apidevportal.aspi-indonesia.or.id/api-services/riwayat-transaksi
- Jalur yang feasible untuk final: pemilik meneruskan screenshot riwayat/settlement ke WhatsApp (dibaca vision), atau ekspor/email laporan (GoPay: menu Keuangan → Download, hanya QRIS; Livin' Merchant: .xls). Butuh 2–3 sampel asli dari warung untuk menguji akurasi ekstraksi.
- Roadmap: QRIS dinamis Thya lewat gateway (Midtrans/Xendit, webhook langsung, tapi Thya jadi jalur pembayaran dan butuh KYC), GoBiz Partner API (konfirmasi cakupan laporan ke GoBiz dulu), OCR e-statement agregator (Brick).
- Tidak dianjurkan: scraping portal GoBiz atau menyimpan kredensial bank pemilik.

Risiko yang lebih besar dari pilihan alat: **warung kecil mungkin tidak punya POS, dan data HPP (biaya bahan per porsi) sering tidak ada.** Onboarding harus mengumpulkan HPP menu utama lewat chat.

## 3. Semantic layer: registry metrik di TypeScript

Cube, dbt MetricFlow, Boring Semantic Layer, dan Malloy tidak dipakai. Semuanya menambah proses atau bahasa (Python) di VPS 4 GB, padahal skemanya hanya sekitar 5 tabel.

Bentuk registry (usulan):

```ts
type Metric = {
  id: MetricId;              // enum: "revenue" | "cogs" | "food_cost_pct" | ...
  label: string;             // "Omzet"
  definition: string;        // satu kalimat yang dikutip ke user
  synonyms: string[];        // "pemasukan", "jualan", ...
  requires: DataNeed[];      // ["transactions", "menu_cost"]
  compute(ctx: { businessId; period; groupBy? }): Promise<MetricResult>;
};
```

Diekspos sebagai satu tool `queryMetric({ metric, period, groupBy })` dengan enum, bukan text-to-SQL bebas. Text-to-SQL punya risiko injeksi SQL lewat prompt (P2SQL, CVE-2024-5565 di Vanna). Benchmark dbt Labs 2026 (vendor, dataset kecil) juga menunjukkan bahwa saat salah, text-to-SQL memberi angka yang meyakinkan, sedangkan semantic layer menolak.

Metrik inti F&B:

| Metrik | Definisi | Data minimum |
|---|---|---|
| Omzet | Σ qty × harga jual | transaksi |
| HPP | Σ qty × biaya per porsi | biaya per menu. Kalau kosong, kembalikan "HPP belum tersedia", jangan 0 |
| Food cost % | HPP / omzet | idem |
| Laba kotor, margin kotor % | omzet − HPP; laba kotor / omzet | idem |
| Laba bersih sederhana | laba kotor − biaya operasional | pengeluaran (sewa, gaji, listrik). Tampilkan komponen yang belum diisi |
| Menu terlaris / paling sepi | per qty, dan terpisah per omzet | transaksi |
| Rata-rata transaksi | omzet / jumlah transaksi | ID struk atau timestamp |
| Jam ramai | transaksi per jam | timestamp |
| Perbandingan periode | metrik vs periode sebelumnya | transaksi |

Desain lengkap registry (blok `explain`, tabel istilah, `ConceptExposure`, onboarding HPP) ada di `docs/semantic-education.md`, dengan keputusan D1–D9 diterima 2026-10-25. Ringkasan pemetaan istilah (inferensi, belum diuji ke pemilik warung):
- **"untung"**: laba kotor kalau biaya operasional belum dicatat, laba bersih kalau sudah. Definisinya selalu disebut dalam satu kalimat.
- **"modal"**: HPP untuk pertanyaan harian atau mingguan. Tanya balik hanya kalau konteksnya "balik modal" atau investasi.
- **"laku"**: "apa yang laku" = menu terlaris per qty. "Laku berapa" = jumlah porsi.
- **"rame/sepi"**: dengan kata waktu → jam ramai. "Hari ini sepi?" → dibandingkan dengan rata-rata hari yang sama.
- **Aturan ambiguitas:** pakai default lalu sebut definisinya. Tanya balik hanya kalau dua tafsiran memberi angka yang jauh berbeda. Periode default juga disebut eksplisit.

## 4. Alur webhook WhatsApp

```
POST /webhook/whatsapp
  1. Verifikasi X-Hub-Signature-256 (HMAC-SHA256, raw body sebelum JSON.parse, compare waktu-konstan)
  2. Satu transaksi DB:
       INSERT inbound_messages (wamid UNIQUE, phone, type, payload) ON CONFLICT DO NOTHING
       pg-boss send("agent-turn", { phone }, { singletonKey: phone })   -- enqueue transaksional
  3. Balas 200

worker "agent-turn" (policy key_strict_fifo, satu job aktif per nomor)
  1. Tunggu buffer 3 detik (diputuskan 2026-10-25), lalu ambil SEMUA pesan belum diproses milik nomor itu
  2. Kirim read receipt + typing indicator (hilang saat balasan terkirim atau setelah 25 detik)
  3. Unduh media di sini (URL media hanya hidup 5 menit; media ID 7 hari), lalu STT/vision
  4. agent.run(businessId, batch)
  5. Kirim balasan:
       di dalam jendela 24 jam → pesan bebas
       di luar jendela (error 131047) → template utility yang sudah disetujui
  6. Tandai pesan sebagai diproses
```

Fakta yang mendasari desain ini:
- Meta mengirim ulang webhook kalau tidak dibalas 200, jadi duplikat mungkin terjadi. Window retry tertulis 7 hari di docs WhatsApp dan 36 jam di docs Graph API. Karena tidak pasti, dedupe wajib.
- Event tidak dijamin berurutan.
- Pesan beruntun digabung lewat tabel pesan + batch di job, bukan `sendDebounced` milik pg-boss (slotnya tetap, tidak me-reset timer). Pola serupa ada di Vercel chat-sdk (debounce 1,5 detik) dan Kapso (buffer default 5 detik).
- **Biaya:** template utility di dalam jendela 24 jam mulai berbayar sejak 1 Okt 2026. Tarif Indonesia ada di rate card Meta. Pemilik angka: Indy (business model).

## 5. Queue: pg-boss

pg-boss 12.x dipilih dibanding BullMQ, Graphile Worker, Inngest, dan Trigger.dev:

| | pg-boss | BullMQ | Graphile | Inngest / Trigger.dev |
|---|---|---|---|---|
| Enqueue satu transaksi dengan write DB | ya | tidak (Redis) | ya | tidak |
| Serialisasi per nomor | `key_strict_fifo` (open source) | Groups hanya di Pro ($139/bulan) | `queueName` per nomor | key concurrency, FIFO tidak dijamin |
| Infra tambahan | tidak | Redis | tidak | layanan luar atau self-host |
| Bun | didokumentasikan | adapter ada | tidak terbukti | lewat HTTP |
| Cron, DLQ, dashboard | ada | ada | cron ada, dashboard tidak | ada |

Siera memakai BullMQ, dan itu masuk akal untuk beban dan kebutuhan Siera. Untuk Thya, keunggulan pg-boss bukan soal skala. Ada dua hal: (1) pesan masuk dan job tersimpan atomik dalam satu transaksi, jadi tidak ada pesan yang tercatat tanpa job atau sebaliknya; (2) urutan per nomor tersedia gratis tanpa Redis. Catatan: job yang gagal permanen memblokir key nomor itu sampai di-retry atau dihapus, jadi butuh alert DLQ.

## 6. Memory dan konteks ("satu thread panjang")

Dari sisi user, chat dengan Thya tidak pernah reset. Di belakangnya ada urutan prompt yang dijaga stabil supaya cache prefix kena:

```
[system prompt statis]
[definisi tool, urutan dan key tetap]
[profil usaha + fakta terstruktur]       ← dari tabel, berubah jarang
[ringkasan bergulir]                     ← berubah hanya saat compaction
[N giliran terakhir, append-only]
[pesan baru + waktu sekarang]            ← timestamp di sini, bukan di system prompt
```

- **Compaction** berbasis ambang (misalnya riwayat melewati 6–8 ribu token), bukan setiap giliran. Hasil tool lama dipangkas lebih dulu. Tiap compaction menyebabkan satu kali cache miss.
- **Fakta stabil** (nama usaha, menu, harga, HPP, supplier, preferensi) diekstrak ke tabel dengan sumber dan tanggal. Angka keuangan tidak pernah diambil dari memory teks.
- **pgvector** belum dipakai. Riwayat terbaru + blok fakta kemungkinan cukup untuk final.
- **Cache:** Netra menagih cached input $0,05 dibanding $0,30 per 1 juta token, dan cache-nya bertahan hingga 7 hari. **Cache ini dibagi antar-customer** dan bisa di-opt-out per workspace. Keputusan: tidak opt-out selama hackathon. Rasio cache hit dipantau dari `usage.prompt_tokens_details.cached_tokens` (terverifikasi, lihat §11).

## 7. Reliability tanpa fallback

- Validasi Zod di setiap input tool. Kalau gagal, `repairToolCall` (AI SDK 7, tanpa prefix experimental) melakukan re-ask maksimal satu kali, lalu tool mengembalikan pesan error yang bisa ditindaklanjuti model.
- `stopWhen` dibatasi (sekarang 5 langkah). `AbortSignal.timeout` per run.
- Typing indicator saat job mulai. Pesan "sedang diproses" hanya kalau lewat sekitar 10–15 detik. Setelah timeout, kirim satu pesan maaf, tanpa retry tanpa batas.
- Idempotency key di setiap tool write.
- Konkurensi dibatasi di sisi aplikasi karena rate limit Netra tidak terdokumentasi.
- Thinking mode: mati secara default di Netra, jadi masalah `reasoning_content` di API resmi DeepSeek tidak terjadi (lihat §11).
- Field input tool selalu wajib + nullable (quirk model, lihat §11).
- Strict JSON schema dianggap tidak ada. JSON mode DeepSeek kadang mengembalikan konten kosong.

## 8. Guardrail (dipetakan ke OWASP LLM Top 10 2025)

| Kasus | Teknik | Cara dites |
|---|---|---|
| Di luar topik | Aturan scope di system prompt: tolak dalam satu kalimat tanpa membuat atau menawarkan isi yang diminta, lalu arahkan kembali ke urusan usaha | Eval negatif: `off-topic-poem` dan `off-topic-code` memeriksa penolakan, bahwa puisi atau kode tidak ada di balasan, dan balasan paling banyak 3 baris |
| Pajak, hukum | Beri informasi umum, sebut batasnya, sarankan konsultan | Eval + cek kata kunci |
| Investasi | Tanpa membandingkan, menilai, atau menyarankan instrumen (saham, emas, deposito, dan sejenisnya), termasuk gambaran umum. Rujuk ke perencana keuangan, boleh tawarkan cek angka usaha | Eval: `investment-question` menolak balasan yang menggambarkan instrumen ("saham fluktuatif", "emas lebih stabil") |
| Klaim simpan palsu ("sudah aku catat" padahal tidak ada yang tersimpan) | Cek pasca-output deterministik di `runTurn` (`saveClaims` di `agent/postcheck.ts`, diperiksa per klausa): balasan hanya boleh menyatakan sesuatu sudah dicatat atau tersimpan kalau di giliran itu `confirmDraft` melaporkan draft baru tersimpan (`done`) atau sudah tersimpan sebelumnya (`already_done`). `already_done` tidak berlaku kalau giliran itu juga membuat draft baru atau gagal membuatnya (`recordSales` dan tool draft lain); klaim di giliran seperti itu butuh `done`. Hasil `cancelDraft` tidak dihitung, dan status simpan tidak dibaca dari teks riwayat. Status `already_done` ditentukan pemilik draft (`actions`): "ya" yang diketik tanpa draft terbuka, padahal draft terakhir dalam jendela 6 jam sudah tersimpan, dijawab "Yang tadi sudah tersimpan, Kak."; tap Ya kedua memakai status yang sama. Kalau klaim tidak didukung, regenerate sekali dengan catatan untuk model saja dan tanpa memaksa tool: panggil `confirmDraft` hanya kalau Kakak menjawab setuju, selain itu tulis ulang tanpa klaim. Lalu teks dari kode. Kode sendiri tidak pernah mengonfirmasi draft | Tes unit `runTurn` dan detektor; tes integrasi `actions`; grader global untuk setiap kasus eval `saved: 0` |
| Injeksi lewat spreadsheet, nota, atau OCR (LLM01) | Konten diberi label sebagai data tak tepercaya. Tool write tidak bisa dipicu oleh isi dokumen. Konfirmasi user (LLM06) | Eval dengan nota atau sheet berisi instruksi |
| Data usaha lain (LLM06) | `businessId` dari sesi di dalam tool, bukan argumen | Tes lintas-tenant wajib |
| Angka tanpa dukungan tool (LLM05/LLM09) | Cek pasca-output: setiap angka di balasan harus ada di hasil tool giliran itu | Eval deterministik |
| Penyalahgunaan biaya (LLM10) | Rate limit per nomor, batas panjang input. `/demo/chat` publik juga perlu rate limit | Tes beban kecil |

Guardrail memang sangat bergantung kasus. Setiap kegagalan nyata ditambahkan sebagai kasus eval baru.

## 9. Eval suite

Rujukan: Anthropic, "Demystifying evals for AI agents" (Jan 2026). Mulai dari 20–50 tugas, grader deterministik sebisa mungkin, dan sertakan kasus "tidak boleh terjadi".

| Lapis | Isi | Jalan di |
|---|---|---|
| a. Tool murni | Hitung metrik atas seed "Kopi Senja", tanpa LLM | `bun test`, CI setiap commit |
| b. Guardrail deterministik | Lintas-tenant, cek angka pasca-output | `bun test`, CI |
| c. Eval LLM | ~40–60 kasus: 12–15 angka pasti, 8–10 pemilihan tool dan argumen, 6–8 multi-turn konfirmasi write, 10–12 guardrail, 5–6 nada. Dijalankan 3× dan dicatat `pass^3` | Manual atau nightly (memakai kuota Netra) |
| d. LLM-as-judge | Hanya untuk nada Bahasa Indonesia santai, rubrik tetap, 10–15 sampel dicek manual | Manual |

Tracing: tabel Postgres sendiri (prompt, tool call, latensi, token, cache hit). Langfuse self-host butuh Postgres + ClickHouse + Redis + S3, terlalu berat untuk VPS 4 GB yang dipakai bersama. Hasil eval (`pass^3`, akurasi angka) bisa dikutip di paper atau saat final sebagai bukti Quality.

## 10. Voice note (STT)

- NetraRuntime **tidak** menyediakan STT.
- Tidak ada penyedia yang terbukti memproses di Indonesia, kecuali Whisper self-host (lambat di VPS tanpa GPU) atau Prosa on-premise (harga tidak publik).
- Tidak ada WER netral untuk voice note Indonesia yang berisik dan bercampur slang. Angka FLEURS dari vendor (ElevenLabs Scribe 2,4–3,1%, Whisper large-v3 7,7%) diukur pada ucapan baca yang bersih.

| Kandidat | Harga/menit (kira-kira) | Catatan |
|---|---|---|
| Groq whisper-large-v3-turbo | $0,0007 | Paling murah. WER yang tercantum bukan untuk Indonesia. Lokasi tidak tertulis |
| ElevenLabs Scribe v2 | $0,0037 | Klaim WER Indonesia terbaik (dari vendor) |
| Deepgram Nova-3 | $0,0043 | Mendukung Indonesia, tapi tidak untuk code-switching |
| OpenAI gpt-transcribe | $0,0045 | Keluarga 4o-transcribe deprecated 26 Feb 2027 |
| AssemblyAI Universal-2 | $0,0025 | Indonesia masuk grup ≤10% WER (klaim vendor) |

Rencana: STT dibungkus di satu modul tipis. OGG/Opus dari WhatsApp dikonversi lewat ffmpeg. Lakukan bake-off 2–3 kandidat pada 30–50 voice note nyata sebelum memilih (OPEN).

## 11. Hasil verifikasi NetraRuntime (2026-10-25)

Detail lengkap ada di `docs/architecture.md` bagian LLM. Ringkasan:
1. **Tool calling multi-step: lulus**, termasuk panggilan paralel. Waktu jawab sekitar 2 detik. **Thinking mati secara default** di Netra. Kalau dinyalakan, multi-step tetap jalan tanpa error 400. Kode memakai default.
2. **Base URL:** `api.netraruntime.com/v1` terverifikasi dengan key. `api.netra.sh/v1` adalah host canary dan tidak dipakai.
3. **Cache hit terlihat** di `usage.prompt_tokens_details.cached_tokens`.
4. **Vision: lulus untuk gambar sederhana.** Membaca nota atau teks belum diuji. Ini uji berikutnya sebelum foto nota dijanjikan.
5. Context window efektif dan rate limit: **belum diuji**.

**Aturan desain tool dari quirk model:** DeepSeek V4.1 Flash di Netra hanya mengisi salah satu dari beberapa field opsional. Karena itu semua field input tool dibuat **wajib**, dan field yang tidak relevan diisi `null` (`.nullable()`, bukan `.optional()`).

Dicocokkan dengan docs resmi (`https://api.netraruntime.com/docs`, 2026-10-25). Rinciannya ada di `docs/architecture.md`:
- **Thinking:** docs menyebut request dengan tools default ke reasoning effort `high`, tapi hasil uji tidak menunjukkan reasoning sama sekali. Karena default bisa berubah, `thinking: { type: "disabled" }` sekarang dipasang eksplisit di `apps/api/src/llm.ts` (2026-10-25). verify:netra dan tes lulus setelah perubahan.
- **Context** 1.048.576 token, output maksimal 131.072. Input teks + gambar, output hanya teks.
- **Audio tidak didukung**, dan tidak ada endpoint STT atau OCR. Ini mengonfirmasi bahwa STT butuh provider lain (§10), dan foto nota hanya bisa lewat input gambar ke model.
- **Belum ada model embedding** di katalog Netra. Kalau RAG + pgvector dipakai, embedding butuh provider lain.
- **Structured output:** `response_format` tidak didukung v4.1-flash di Chat Completions. JSON terstruktur lewat Responses API atau tool call. Opsi `strict` untuk tool ada, tapi penegakannya bergantung pada model; belum diuji.
- **Rate limit** tidak diangkakan. Saat terlampaui keluar `429` + `Retry-After`, jadi worker harus menghormati header ini. Saldo habis menghasilkan `402`.
- **Klaim zero data retention** hanya ada di homepage. API reference menyebut setting "organization recording" yang bisa merekam request. Cek setting ini di dashboard Netra sebelum klaim dikutip di paper.

## 12. Klaim untuk paper

- Lokasi data: tulis "zero data retention by default, primary GPU infrastructure in Indonesia". **Jangan** klaim "data never leaves Indonesia". Kebijakan Netra sendiri menyebut bahwa ZDR tidak menjamin pemrosesan tetap di Indonesia (ada external routes dan fallback).
- Jangan klaim "terbukti" untuk alur WA-bot pembukuan. Tidak ada data adopsi produk sejenis di Indonesia.

## Sumber utama

- NetraRuntime: https://netraruntime.com/ · https://netraruntime.com/policies/data-handling · https://netraruntime.com/learn/prompt-caching · https://netraruntime.com/learn/use-netra-runtime-with-vercel-ai-sdk
- DeepSeek: https://api-docs.deepseek.com/guides/thinking_mode · https://api-docs.deepseek.com/guides/kv_cache · https://api-docs.deepseek.com/guides/tool_calls
- WhatsApp: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview.md · https://developers.facebook.com/docs/whatsapp/cloud-api/typing-indicators · https://developers.facebook.com/documentation/business-messaging/whatsapp/business-phone-numbers/media.md · https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md
- Queue: https://github.com/timgit/pg-boss · https://docs.bullmq.io/bullmq-pro/groups · https://worker.graphile.org/docs/job-key · https://www.inngest.com/docs/guides/concurrency
- Debounce: https://chat-sdk.dev/docs/concurrency · https://docs.kapso.ai/docs/platform/webhooks/advanced
- Semantic layer: https://docs.getdbt.com/blog/semantic-layer-vs-text-to-sql-2026 · https://docs.cube.dev/cube-core/architecture · https://arxiv.org/pdf/2308.01990
- Data masuk: https://majoo.id/majoo-api · https://developer.gobiz.com · https://developers.google.com/workspace/sheets/api/scopes
- STT: https://console.groq.com/docs/speech-to-text · https://elevenlabs.io/speech-to-text/indonesian · https://deepgram.com/pricing · https://www.assemblyai.com/pricing
- Guardrail dan eval: https://genai.owasp.org/llm-top-10/ · https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents · https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents
