# Thya: katalog fitur dan celah engineering

Status: riset read-only 2026-10-25. Belum ada keputusan di dokumen ini. Rekomendasi menunggu Rafee (daftar di §8). Tidak ada kode, dependency, atau dokumen lain yang diubah.

Dokumen ini menjawab satu pertanyaan: dari fitur yang dijanjikan Slides dan paper, mana yang sudah punya jalur engineering di `apps/api`, mana yang belum, dan bagaimana menutup celahnya di stack TypeScript/Bun tanpa Python.

Label:
- **Fakta**: ada sumbernya (`path:line`, URL, atau hasil uji di §2.2).
- **Inferensi**: kesimpulan saya, belum diuji di Thya.
- **Usulan**: rekomendasi. Label "Final" berarti untuk final 10 Nov, "Roadmap" berarti sesudahnya.

## Ringkasan

1. Chat dan rekap teks sudah punya jalur jelas di `docs/engine-plan.md`. Visual (grafik, kartu ringkasan), dokumen laporan, aksi ke Google, dan pengingat belum punya modul, tool, atau baris jadwal sama sekali.
2. Grafik tanpa Python bisa dibuat di Bun. Enam library grafik saya uji di temp dir: semuanya jalan, render 14–85 ms per gambar, dan hasilnya byte-identik antar-render dan antar-proses. Usulan: TanStack Charts (`renderChartSvg`) + `@resvg/resvg-js`, dengan font yang ikut di-bundle; ECharts sebagai cadangan. Kartu ringkasan cukup template SVG yang dirender resvg yang sama, tanpa Satori.
3. LLM tidak memilih jenis grafik dan tidak menulis angka grafik. LLM memilih satu `view` dari enum dan periodenya; kode mengambil angka lewat fungsi yang sama dengan `queryMetric`/`getDailySales`, lalu memilih bentuk grafiknya.
4. Netra hanya mengeluarkan teks, jadi gambar dan dokumen dibuat tool. Usulan: tool mengembalikan `attachmentId` + data ringkas, `runTurn` mengembalikan `{ reply, attachments }`, dan channel yang mengirim. Eval menilai spesifikasi dan datanya, bukan piksel.
5. Ada celah yang sudah dijanjikan paper tapi tidak ada di rencana engine: import spreadsheet (paper bab 7, 2–6 Nov) tidak muncul di modul §5.1 maupun jadwal §6 engine-plan. Selain itu, scope `drive.file` tidak bisa membaca sheet yang linknya ditempel user (hanya file yang dibuat app atau dipilih lewat Google Picker).
6. Menulis ke Sheets, membuat Docs/Slides, Calendar, dan PDF sebaiknya Roadmap. Untuk final, cukup pengingat lewat WhatsApp sendiri (perluasan `schedules/`) dan rekap mingguan berupa gambar.

## 1. Katalog fitur

Status "sekarang" dicek ke kode pada 2026-10-25. Sumber janji: Slides (`docs/proposal/slides-snapshot.txt:120-129`), paper bab 4 (`docs/paper/ch4-key-features-tech-stack.md:11-23`), bab 10 (`docs/paper/ch10-roadmap-tech.md`).

| Fitur | Dijanjikan di | Sekarang (Fakta) | Direncanakan (Fakta) | Celah | Usulan |
|---|---|---|---|---|---|
| Tanya angka usaha lewat chat | Slides, bab 4 | Jalan di `/demo/chat`, 4 tool read-only di `apps/api/src/agent/tools.ts`, data seed statis | `runTurn`, DB, budget, postcheck (engine-plan §6) | Tidak ada di luar rencana | Final, sesuai engine-plan |
| Chat di WhatsApp | Slides, bab 4 | Belum ada. Tidak ada `channels/` di `apps/api/src` | Webhook + pg-boss 30 Okt–1 Nov (engine-plan §6) | Pengiriman media (gambar/dokumen) tidak disebut di modul `channels/whatsapp/` | Final. Tambah kirim gambar ke modul channel (§3.4) |
| Catat penjualan lewat teks | Bab 4, bab 7 | Belum | Draft + tombol Ya/Ubah/Batal 1–3 Nov (Q1, Q3) | Tidak ada | Final, sesuai engine-plan |
| Rekap terjadwal harian | Slides ("tiap hari buatin rekapan"), bab 4, bab 7 | `apps/api/src/worker.ts` hanya `console.log` | Modul `schedules/`, job `recap`, pg-boss, template utility 3–5 Nov | Skema jadwal, konfirmasi, pembuat isi rekap belum dirinci (§5) | Final, dengan tambahan §5 |
| Pengingat ("ingatkan saya belanja bahan") | Slides (Calendar untuk reminder), bab 10 | Belum | `architecture.md` menyebut worker untuk "rekap harian, reminder", tapi engine-plan hanya `schedules/ rekap terjadwal` | Jenis jadwal "pengingat" tidak ada di rencana. Template pengingat belum ada | Final, sebagai perluasan `schedules/` tanpa Calendar (§5) |
| Grafik di chat | Slides ("AI Business Dashboard") | Belum | Tidak ada | Tidak ada tool, renderer, atau pengiriman media | Final opsional, setelah rekap jalan (§2) |
| Dashboard web | Slides | Belum. Web diputuskan hanya landing + demo (`docs/product-context.md:27`) | Bab 10 Phase 3 "Dashboard (optional)", masih OPEN | Klaim Slides belum diturunkan | Roadmap. Di WhatsApp, "dashboard" = gambar grafik + kartu ringkasan |
| Laporan mingguan sebagai dokumen | Slides ("generating reports", klaim 120 → 5 menit) | Belum | Tidak ada | Tidak ada format atau renderer laporan | Final: kartu ringkasan PNG + teks. PDF Roadmap (§3) |
| Import spreadsheet | Slides, bab 4, bab 7 (2–6 Nov) | Belum | `agent-harness.md:23` (import, `drive.file`). **Tidak ada di engine-plan §5.1 maupun §6** | Tidak ada pemilik, modul, atau slot jadwal. `drive.file` tidak bisa membaca sheet dari link tempel (§4.2) | Putuskan: jadwalkan dengan jalur akses yang benar, atau turunkan klaim bab 7 (D4) |
| Tulis ke Google Sheets | Bab 10 ("two-way sync") | Belum | Roadmap di bab 10 | Tidak ada | Roadmap |
| Buat Google Docs/Slides | Tidak eksplisit; Slides menyebut "generating reports" | Belum | Tidak ada | Tidak ada | Roadmap, atau buang |
| Google Calendar | Slides, bab 10 Phase 2 | Belum | Roadmap di bab 10 | Slides masih menyebutnya fitur | Roadmap. Ganti di Slides dengan pengingat WhatsApp |

## 2. Visual tanpa Python

### 2.1 Siapa memilih apa

Usulan: LLM hanya memilih **apa** yang ditampilkan, dari enum. Kode memilih **bentuk** grafik dan mengisi angkanya.

| Keputusan | Pemilik | Alasan |
|---|---|---|
| `view` (`daily_revenue`, `daily_items_sold`, `top_menu`) + periode | LLM, lewat enum | Pola yang sama dengan `queryMetric` (enum + `periodFields`, semua wajib dan nullable karena quirk DeepSeek, Fakta: `apps/api/src/agent/tools.ts:41-43`) |
| Jenis grafik | Kode | Deret harian ≤ 14 hari = batang, > 14 hari = garis; peringkat menu = batang horizontal. Model tidak bisa memilih grafik yang menyesatkan (misalnya pie untuk tren) |
| Angka, label sumbu, format Rupiah | Kode | Aturan harness: angka hanya dari tool. Grafik yang angkanya ditulis model akan lolos dari `postcheck.ts` karena angka itu tidak ada di teks |
| Judul dan rentang tanggal | Kode, dari `describeRange` | Label periode sudah dibuat kode untuk tool lain (`tools.ts:96-110`) |
| Caption | LLM, dicek `postcheck.ts` | Caption adalah balasan teks biasa, jadi data grafik ikut menjadi bukti postcheck |

Inferensi: dengan desain ini, enum `view` bisa tumbuh mengikuti registry metrik (`src/semantic/metrics.ts`) tanpa mengubah renderer.

### 2.2 Hasil uji (Fakta, 2026-10-25)

Lingkungan: MacBook arm64, Bun 1.4.2 (versi sama dengan `apps/api/Dockerfile:4`), temp dir di scratchpad session, di luar repo. Data: omzet 7 hari, label hari Indonesia, sumbu "Rp1,5 jt". Font: Arial dari sistem, dimuat eksplisit (`loadSystemFonts: false`). Satu render pertama, lalu 20 render. Hash = SHA-256 PNG, dibandingkan antar-render dan antar-proses (dua kali jalan).

| Opsi | Versi | Render pertama | p50 / p95 | RSS puncak proses | Deterministik | Ukuran paket (Fakta: `npm view`, unpacked) |
|---|---|---|---|---|---|---|
| ECharts SSR (SVG) + resvg | echarts 6.1.0, resvg-js 2.6.2 | 52 ms | 18 / 23 ms | 178 MB | Ya (antar-render dan antar-proses) | echarts 60,3 MB (51 MB di antaranya `dist/` yang tidak dipakai SSR) + resvg linux-x64-gnu 4,4 MB |
| Vega-Lite → Vega SVG + resvg | vega 6.4.0, vega-lite 6.5.0 | 43 ms | 17 / 22 ms | 206 MB | Ya | ±28 MB terpasang (vega 3,7 + vega-lite 5,9 + modul vega-*) + resvg |
| Chart.js + `@napi-rs/canvas` | 1.0.13 | 41 ms | 14 / 15 ms | 161 MB | Ya | binary linux-x64-gnu 36,9 MB |
| Observable Plot + linkedom + resvg | plot 0.6.17 | 28 ms | 17 / 26 ms | 158 MB | Ya | ±20 MB terpasang (plot 1,5 + linkedom 1,1 + d3) + resvg |
| TanStack Charts (`renderChartSvg`) + resvg | @tanstack/charts 1.1.0 | 20 ms | 15 / 18 ms | 137 MB | Ya | @tanstack/charts 3,0 MB unpacked; ±21 MB terpasang termasuk modul d3 dan resvg darwin |
| Satori + resvg (kartu ringkasan) | satori 0.63.2 | 1.198 ms | 85 / 97 ms | 465 MB | Ya | satori 26,3 MB |
| pdfmake (PDF 1 halaman + PNG grafik) | 0.3.12 | 55 ms | 24 / 29 ms | 231 MB | Ya, kalau `creationDate` dipatok | pdfmake 12 MB + pdfkit/fontkit (±38 MB terpasang) |

Pembanding: `bun -e` kosong memakai RSS 9,6 MB. RSS di atas termasuk Bun, library, dan 21 render.

Kualitas output (Fakta, dilihat dari PNG):
- ECharts: judul, label nilai di atas batang, dan sumbu "Rp1,5 jt" rapi dengan default. Formatter Rupiah ditulis sebagai fungsi biasa.
- Vega-Lite: default angka bergaya en-US ("3.0M", "1,850,000"). Perlu konfigurasi locale `id-ID` untuk format Indonesia.
- Chart.js: tidak ada label nilai di batang tanpa plugin tambahan (`chartjs-plugin-datalabels`), judul kecil.
- Observable Plot: tick sumbu terlalu rapat dengan default, dan judul hilang kalau hanya `<svg>` yang diambil dari `<figure>`.
- TanStack Charts: rapi setara ECharts (label nilai lewat mark `text`, tick "Rp1,5 jt" lewat `ticks.format`). Tidak ada judul bawaan; judul saya taruh di label sumbu, atau bisa ditulis di caption. Output `renderChartSvg` perlu dua penyesuaian sebelum resvg mau membacanya: atribut `xmlns` tidak ada (resvg menolak dengan "document does not have a root node"), dan warna default berupa `var(--ts-chart-1, #2563eb)` yang harus diganti nilai cadangannya. Theme default memakai `currentColor` dan variabel CSS, jadi warna perlu diisi eksplisit lewat `theme` (Fakta: `docs/reference/runtime-and-scene.md` di paket).
- TanStack Charts masih muda: rilis pertama di npm 2026-07-29, versi 1.1.0 pada 2026-10-09 (Fakta: `npm view @tanstack/charts time`). Lisensi MIT.
- Satori: layout flexbox ala CSS, cocok untuk kartu. Satu kartu saya keluar batas karena kesalahan layout di script uji, bukan karena library.

Opsi yang tidak diuji, dengan alasan (Inferensi):
- **QuickChart (hosted)**: angka penjualan dikirim ke layanan di luar Indonesia. Ini bertentangan dengan batasan "data keuangan UMKM tidak boleh keluar Indonesia tanpa alasan" (`AGENTS.md`, bagian Batasan). Versi self-host adalah server Node + canvas terpisah, jadi menambah satu service di VPS 4 GB untuk hal yang bisa dikerjakan di proses yang sama.
- **HTML → PDF/PNG lewat Chromium (Puppeteer/Playwright)**: Playwright tidak disetujui (`docs/architecture.md`, "Yang sengaja tidak dipakai"). Chromium headless menambah ratusan MB ke image dan butuh RAM per halaman yang jauh lebih besar dari angka di atas. Tidak sepadan untuk satu grafik.
- **`skia-canvas`**: terpasang (binary darwin 27 MB), tidak dijalankan karena perannya sama dengan `@napi-rs/canvas`.

### 2.3 Usulan renderer

**TanStack Charts (`renderChartSvg`) + `@resvg/resvg-js`** (Final, kalau D1 disetujui). Diperbarui setelah uji tambahan 2026-10-25; sebelumnya usulan ini ECharts.
- Paling ringan dan paling cepat di uji: 15 ms per render, RSS 137 MB, paket utama 3 MB. Output sama rapinya dengan ECharts.
- `renderChartSvg` adalah fungsi murni dari scene ke string, tanpa DOM (Fakta: `docs/guides/exporting.md` di paket: "deterministic and DOM-free").
- Definisi grafik yang sama bisa dipakai adapter React di `apps/web` untuk `/demo` (Fakta: tabel renderer di `docs/reference/rendering-and-export.md`). Inferensi: ini menjawab D7 tanpa menulis grafik dua kali, tapi butuh tempat bersama untuk definisinya, padahal repo belum punya `packages/*` (`docs/architecture.md`).
- Biaya: satu fungsi kecil di renderer untuk menambah `xmlns` dan mengganti `var(--…, fallback)` dengan nilai cadangannya, plus theme eksplisit. Fungsi ini bergantung pada bentuk output library, jadi perlu satu tes yang merender grafik contoh dan memastikan resvg menerimanya. Risiko lain: library baru berumur 3 bulan.
- Satu jalur untuk semua visual: grafik (TanStack → SVG) dan kartu ringkasan (template SVG yang ditulis sebagai string → resvg). Satori tidak perlu: kartu ringkasan Thya hanya beberapa teks dan kotak, sedangkan Satori di uji butuh 1,2 detik untuk render pertama dan RSS 465 MB.

**Cadangan: ECharts SSR + resvg.** Output default rapi tanpa penyesuaian SVG, API SSR resmi dan matang. Biayanya image API bertambah sekitar 65 MB karena Dockerfile menyalin `node_modules` utuh (`apps/api/Dockerfile:18`) dan paket echarts 60 MB. Pilih ini kalau penyesuaian SVG TanStack ternyata rapuh saat versi naik.
- Font: image `oven/bun:*-slim` tidak membawa font, dan Arial tidak boleh didistribusikan. Usulan: satu file font berlisensi OFL (Inter atau Noto Sans, regular + bold) di `apps/api/assets/fonts/`, dimuat dengan `loadSystemFonts: false` supaya hasil sama di laptop dan VPS.
- Memori (Inferensi): render 18 ms dan RSS proses di bawah 200 MB muat di VPS 4 GB bersama Postgres. Render tetap sebaiknya dijalankan di job, bukan di request webhook.

Batas yang belum diuji: determinisme lintas platform (arm64 macOS vs x64 Linux). resvg memakai rasterizer Rust murni, tapi saya tidak membandingkan hash antar-arsitektur. Karena itu eval sebaiknya tidak membandingkan piksel (§6).

### 2.4 Usulan tool `showChart`

```ts
// input: semua field wajib, null kalau tidak relevan (quirk DeepSeek, tools.ts:41-43)
{
  view: "daily_revenue" | "daily_items_sold" | "top_menu",
  ...periodFields,                         // period, startDate, endDate, sama dengan tool lain
  sortBy: "revenue" | "quantity" | "grossProfit" | null,   // hanya untuk top_menu
  limit: number | null,                    // top_menu, 3–10
}

// output ke model (tanpa gambar)
| { status: "ok", attachmentId: string, chart: "bar" | "line" | "hbar",
    range: { label, start, end, days }, points: { label: string, value: string }[] }
| { status: "error", message: string }     // pesan untuk pemilik, sama dengan SalesQueryError
```

`points` dikirim ke model sebagai string Rupiah yang sudah diformat, sehingga caption hanya bisa mengulang angka yang ada di grafik, dan postcheck punya buktinya. Batas 31 titik mengikuti `getDailySales`.

## 3. Dokumen dan laporan

### 3.1 Opsi

| Opsi | Untuk siapa | Biaya engineering | Catatan |
|---|---|---|---|
| Kartu ringkasan PNG + teks rekap di WhatsApp | Pemilik warung, dibuka di HP | Kecil, renderer sama dengan §2 | Gambar maksimal 5 MB, caption ≤ 1.024 karakter (Fakta: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/image-messages) |
| PDF via `pdfmake`, dikirim sebagai dokumen WhatsApp | Pemilik yang mau menyimpan atau meneruskan ke mitra | Sedang: layout, font, tabel | Jalan di Bun (§2.2). pdfmake mencetak peringatan "No URL/local access policy defined"; kalau dipakai, pasang `setUrlAccessPolicy`/`setLocalAccessPolicy` supaya isi dokumen tidak bisa memicu baca file atau URL. Dokumen PDF maksimal 100 MB (Fakta: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/document-messages) |
| `@react-pdf/renderer` | Sama | Sedang, menarik React ke `apps/api` | Tidak diuji. Inferensi: tidak sepadan karena API tidak memakai React |
| HTML → PDF lewat Chromium | Sama | Besar di VPS | Lihat §2.2. Tidak diusulkan |
| Google Docs/Slides | Pemilik yang memakai Google Workspace | Besar: OAuth, template, Docs/Slides API | Scope `documents`/`presentations` sensitive; `drive.file` cukup untuk file yang dibuat app (Fakta: https://developers.google.com/workspace/docs/api/auth, https://developers.google.com/workspace/slides/api/scopes). Masalah OAuth dari WhatsApp sama dengan §4 |

### 3.2 Usulan

- **Final**: rekap mingguan = satu kartu ringkasan PNG (omzet, laba kotor, perubahan vs minggu lalu, menu terlaris) + teks rekap. Ini yang paling dekat dengan klaim Slides "laporan dalam 5–10 menit" dan bisa didemokan di layar HP.
- **Roadmap**: PDF bulanan dengan `pdfmake`. Google Docs/Slides dibuang dari janji, kecuali tim punya user yang memintanya.

Klaim Slides "120 menit → 5 menit" (`docs/product-context.md:31`) tetap belum divalidasi. Kartu ringkasan tidak membuktikannya; itu milik Nawra.

## 4. Aksi ke Google

### 4.1 Scope OAuth (Fakta)

| Scope | Kelas | Sumber |
|---|---|---|
| `drive.file` | Non-sensitive. Mencakup file yang dibuat app, dan file yang dibuka atau dibagikan user lewat Google Picker | https://developers.google.com/workspace/drive/api/guides/api-specific-auth |
| `spreadsheets`, `spreadsheets.readonly` | Sensitive | https://developers.google.com/workspace/sheets/api/scopes |
| `documents`, `presentations` | Sensitive | Docs dan Slides auth, §3.1 |
| `drive`, `drive.readonly` | Restricted | Sheets scopes, di atas |
| `calendar.*` | Halaman resmi tidak mencantumkan kelasnya. Sumber sekunder (Nylas) menyebut `calendar.events` sensitive. Kelas `calendar.app.created` dan `calendar.events.owned` belum terverifikasi | https://developers.google.com/workspace/calendar/api/auth |

Fakta lain:
- `spreadsheets.create` dan `values.append` menerima `drive.file`. Jadi app dengan `drive.file` saja bisa membuat sheet baru dan menambah baris tanpa scope sensitive (https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append).
- Project berstatus Testing: maksimal 100 test user, dan izin serta refresh token kedaluwarsa 7 hari setelah consent (https://support.google.com/cloud/answer/15549945). Consent yang diberikan sebelum 3 Nov akan mati sebelum final 10 Nov.
- Google melarang request OAuth dari embedded user-agent; error-nya `disallowed_useragent` (https://developers.google.com/identity/protocols/oauth2/policies). Belum ada sumber resmi yang menyebut apakah browser in-app WhatsApp kena. Laporan forum menyebut kena. Ini harus diuji di HP Android dan iOS sungguhan.
- Google Picker butuh Picker API, API key, dan project number; di aplikasi mobile Picker dibuka di browser sistem. Perilaku Picker web di browser HP belum didokumentasikan (https://developers.google.com/workspace/drive/picker/guides/web-picker).

### 4.2 Konsekuensi untuk import spreadsheet

Slides menulis bahwa pemilik "upload a spreadsheet link" (`docs/proposal/slides-snapshot.txt:152`). Dengan `drive.file`, link yang ditempel ke chat **tidak cukup**: app hanya boleh membaca sheet itu kalau user memilihnya lewat Picker. Jalur yang mungkin:

| Jalur | Alur user | Scope / verifikasi | Risiko |
|---|---|---|---|
| A. OAuth `drive.file` + Picker | Klik link dari Thya → login Google → pilih sheet di Picker | Non-sensitive | Dua langkah web di HP; `disallowed_useragent` di browser WhatsApp; token Testing 7 hari |
| B. User membagikan sheet ke email service account Thya (viewer) | Di Google Sheets: Bagikan → tempel email Thya → kirim link ke chat | Tanpa OAuth user, tanpa layar consent | Inferensi, belum diuji: service account bisa membaca file yang dibagikan kepadanya lewat Sheets API. Langkah "bagikan ke email" asing bagi pemilik literasi rendah, tapi bisa dipandu dengan screenshot |
| C. Upload file `.xlsx`/`.csv` ke chat WhatsApp | Kirim file sebagai dokumen | Tanpa Google sama sekali | Perlu parser xlsx (dependency baru) atau CSV saja. Paling sedikit langkah untuk user |
| D. Sheet "siapa saja yang punya link bisa melihat" + ekspor CSV | Ubah setting share → kirim link | Tanpa auth | Data keuangan jadi publik bagi siapa pun yang punya link. Tidak diusulkan |

Usulan untuk final (D4): **B untuk demo**, karena tidak ada layar consent dan tidak ada token 7 hari yang bisa mati di tengah final. Inferensi: Sheets REST cukup dipanggil dengan `fetch` + JWT service account yang ditandatangani `crypto.subtle` (RS256), tanpa `googleapis` (246 MB unpacked, Fakta: `npm view`). Kalau tim tidak sempat, turunkan baris spreadsheet di bab 7, sesuai catatan yang sudah ada di `docs/paper/ch7-current-status-dev-plan.md:48`.

### 4.3 Menulis ke Sheets, Docs/Slides, Calendar

| Aksi | Bisa dengan scope non-sensitive? | Usulan |
|---|---|---|
| Ekspor rekap ke sheet baru milik user | Ya (`drive.file`, sheet dibuat app) | Roadmap. Butuh jalur A, dengan semua risikonya |
| Append transaksi ke sheet yang sudah ada | Hanya kalau sheet dipilih lewat Picker (A) atau dibagikan sebagai editor ke service account (B) | Roadmap (bab 10 "two-way sync" sudah menyebutnya) |
| Buat Google Docs/Slides laporan | Ya untuk file baru (`drive.file`) | Roadmap atau buang. Kartu PNG menutup kebutuhan final |
| Google Calendar | Kelas scope belum pasti | Roadmap (sudah di bab 10 Phase 2). Untuk final, pengingat dikirim Thya sendiri lewat WhatsApp (§5) |

Inferensi: tidak satu pun aksi tulis ke Google sepadan untuk final. Masing-masing butuh alur OAuth web dari WhatsApp yang belum diuji di HP, dan jadwal engine-plan sudah penuh sampai 9 Nov.

## 5. Automation: apakah `schedules/` cukup

Rencana sekarang (Fakta):
- `docs/architecture.md`, bagian "Rekap terjadwal": tool `createSchedule({ cron, task, timezone })`, tabel `schedules`, worker membuat job, job menjalankan `agent.run(userId, task)`, kirim dengan template di luar jendela 24 jam.
- `docs/engine-plan.md` §5.1: modul `schedules/` "rekap terjadwal", job `recap` di `jobs/`; §6: rekap 3–5 Nov.
- `docs/semantic-education.md:165`: isi rekap terjadwal "angka saja, ditambah paling banyak satu 'tahukah Kakak'", diputuskan oleh **kode**.

| Use case | Cukup? | Yang kurang |
|---|---|---|
| "Tiap hari kirim rekap" | Sebagian | (1) **Konflik pemilik isi rekap**: architecture.md menjalankan agent (LLM) saat job jalan, semantic-education menetapkan kode. Usulan: kode yang menyusun rekap dari fungsi `sales/`, tanpa LLM. Lebih murah, deterministik, dan bisa dites tanpa Netra. (2) **LLM menulis string cron**. Usulan: input terstruktur, kode yang menyusun cron. (3) **Membuat jadwal adalah write**, jadi harus lewat draft + tombol Ya (Q1), padahal engine-plan hanya menyebut draft untuk transaksi dan HPP. (4) Belum ada tool lihat/batalkan jadwal |
| "Ingatkan saya belanja bahan tiap Senin jam 6" | Tidak | Jenis jadwal `reminder` dengan teks bebas, dikirim apa adanya tanpa LLM. Template utility kedua untuk pengingat |
| "Ingatkan besok jam 9" (sekali) | Tidak | Frekuensi `once` + tanggal. pg-boss mendukung job tertunda (`startAfter`), tapi itu perlu dicek di dokumentasi versi yang dipasang |
| Rekap mingguan dengan gambar | Tidak | Kartu PNG (§3) + template dengan header IMAGE di luar jendela 24 jam. Template mendukung header IMAGE/DOCUMENT; contoh medianya ikut direview (Fakta: https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api.md) |

Fakta WhatsApp yang menentukan desain:
- Pesan non-template (teks, gambar) hanya boleh saat jendela 24 jam terbuka; template boleh kapan saja (https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing).
- Sejak 2026-10-01, template utility yang dikirim di dalam jendela juga ditagih (sumber yang sama).
- Template utility harus non-promosi dan spesifik atau diminta user; penyalahgunaan bisa berujung rate limit atau pindah kategori ke marketing (https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization). Inferensi: pengingat yang diminta user sendiri masuk utility, tapi template yang isinya hanya `{{1}}` bebas berisiko ditolak reviewer. Usulan teks: "Pengingat yang Kakak minta: {{1}}".

Inferensi soal job: saat jadwal jatuh tempo, job perlu tahu apakah jendela 24 jam masih terbuka (dari waktu pesan masuk terakhir di `messages`) untuk memilih pesan bebas atau template. Idempotensi kirim mengikuti A13 engine-plan.

### Usulan tool jadwal

```ts
// createSchedule → membuat draft, bukan jadwal. Jadwal aktif setelah tombol Ya (Q1).
{
  kind: "recap" | "reminder",
  frequency: "once" | "daily" | "weekly",
  time: string,                              // "HH:MM" WIB, divalidasi regex
  dayOfWeek: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun" | null,   // weekly
  date: string | null,                       // YYYY-MM-DD, once
  recapPeriod: "yesterday" | "last_week" | null,   // recap
  reminderText: string | null,               // reminder, maks 120 karakter
}
→ { status: "draft", draftId, summary: "Tiap Senin 06.00: ingatkan belanja bahan" } | { status: "error", message }

listSchedules({})            → { schedules: { id, summary, nextRunAt }[] }
cancelSchedule({ scheduleId }) → draft pembatalan, dikonfirmasi tombol yang sama
```

Inferensi: `reminderText` adalah teks dari user yang nanti dikirim ulang ke user sendiri, jadi risiko injeksinya rendah. Teks itu tetap diperlakukan sebagai data tak tepercaya (A8) dan tidak boleh memicu tool lain saat job jalan; job pengingat memang tidak memanggil LLM.

## 6. Konsekuensi model yang hanya mengeluarkan teks

Fakta: `deepseek/deepseek-v4.1-flash` di Netra menerima teks dan gambar, dan hanya mengeluarkan teks (`docs/architecture.md`, bagian LLM). Jadi semua gambar dan dokumen dibuat kode di dalam tool.

Usulan desain:
1. **Tool tidak mengirim.** `showChart` merender PNG, menyimpannya sebagai attachment (baris DB atau file sementara), lalu mengembalikan `attachmentId` + data ringkas. Mengirim adalah urusan channel. Ini menjaga aturan boundary engine-plan §5.1: `agent/` tidak mengimpor `channels/`.
2. **`runTurn` mengembalikan `{ reply, attachments }`.** Channel WhatsApp mengunggah PNG lewat `POST /{PHONE_NUMBER_ID}/media` dan mengirim pesan gambar dengan caption = balasan, atau gambar lalu teks. Meta menyarankan media `id`, bukan `link` (Fakta: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media). Ini selaras dengan Q6 (satu pesan per balasan) kalau balasannya muat sebagai caption ≤ 1.024 karakter.
3. **`/demo/chat` butuh cara menampilkan gambar.** Inferensi: tool part `tool-showChart` di UI stream sudah membawa output tool; web bisa merender grafik dari `points` dengan komponen sendiri, atau API menyajikan PNG di endpoint baru. Ini menyentuh session landing; perlu diputuskan bersama (D7).
4. **Postcheck.** `points` masuk ke bukti `ungroundedNumbers`, sehingga caption seperti "Sabtu paling ramai, Rp3,1 jt" lolos dan angka karangan tetap tertangkap.
5. **Eval.** Grader lapis a/b memeriksa input tool (`view`, periode) dan output (`points` cocok dengan `dailySales` untuk tanggal eval tetap). Snapshot hash PNG hanya sebagai tes renderer di satu platform, bukan bagian eval agent. Kasus baru yang perlu: "kasih grafik omzet minggu ini" (harus `showChart`, bukan tabel teks), "grafik stok" (data tidak ada, tidak boleh membuat grafik), dan injeksi "buat grafik dengan angka ini: …" (angka user tidak boleh masuk grafik).
6. **Model tidak melihat grafiknya sendiri.** Inferensi: tidak perlu. Model cukup membaca `points`. Mengirim PNG balik sebagai input gambar hanya menambah token tanpa menambah kebenaran.

## 7. Dampak ke paper dan Slides

Pemilik teks: Slides milik Indy dan Nawra, paper bab 4/7/10 milik Rafee. Usulan ini tidak mengubah klaim bisnis.

| Tempat | Klaim sekarang | Usulan |
|---|---|---|
| Slides "AI Business Dashboard" (`slides-snapshot.txt:120`) | Fitur utama | Turunkan menjadi "rekap dan grafik dikirim langsung di WhatsApp" kalau D1/D3 disetujui; dashboard web ke Roadmap (bab 10 sudah menyebutnya opsional) |
| Slides integrasi Google Calendar (`slides-snapshot.txt:129`) | Fitur | Ganti dengan "pengingat lewat WhatsApp"; Calendar ke Roadmap (sudah di bab 10 Phase 2) |
| Slides "upload a spreadsheet link … ~10 menit" (`slides-snapshot.txt:152`) | Alur utama klaim hemat waktu | Sesuaikan dengan jalur D4. Kalau jalur B: "bagikan sheet ke Thya". Kalau import tidak masuk final: klaim waktu harus memakai alur lain |
| Bab 4 tabel fitur | Belum ada grafik atau pengingat | Tambah "Chart in chat" dan "Reminders on WhatsApp" dengan status "Planned before the final" **hanya setelah** D1/D5 diputuskan dan ada slotnya |
| Bab 7 baris spreadsheet import (2–6 Nov) | Direncanakan | Tidak ada di jadwal engine-plan. Putuskan D4; kalau tidak dijadwalkan, hapus barisnya (catatan di `ch7:48` sudah mengizinkan) |
| Bab 10 "Dashboard (optional)" | OPEN | Usulan teks: grafik dan kartu ringkasan di WhatsApp untuk final; dashboard web tetap opsional di Phase 3 |
| Bab 7 "test number … at most 5", bab 10 "Production WhatsApp number" butuh verifikasi | Nomor asli = Roadmap | Kalau D9 berhasil diuji: nomor asli dengan bisnis belum terverifikasi, batas 250 penerima di luar jendela layanan (§9). Jangan diubah sebelum diuji |
| Bab 10 "Approved recap templates" | Rekap harian, mingguan, pengingat | Sudah konsisten dengan §5. Tambahkan bahwa template rekap mingguan memakai header gambar kalau D3 disetujui |

## 8. Keputusan untuk Rafee

| # | Keputusan | Usulan | Dampak kalau ya |
|---|---|---|---|
| D1 | Grafik di chat masuk final? | Ya, opsional: dikerjakan setelah rekap jalan (5–7 Nov), dibuang dulu kalau jadwal mundur | Tool `showChart`, attachment di `runTurn`, kirim media di channel |
| D2 | Dependency renderer | Setujui `@tanstack/charts` + `@resvg/resvg-js` + satu font OFL di repo. Cadangan: `echarts` + resvg | Image API bertambah ±10 MB (TanStack) atau ±65 MB (ECharts) |
| D3 | Rekap mingguan berupa kartu PNG | Ya, renderer sama dengan D2, tanpa Satori | Template utility dengan header IMAGE perlu diajukan ke Meta |
| D4 | Import spreadsheet: jalur dan jadwal | Jalur B (bagikan ke service account) dengan `fetch` + JWT, dijadwalkan di engine-plan; atau turunkan klaim bab 7 | Pemilik modul baru (`sheets/` atau di `sales/`), Google Cloud project + service account |
| D5 | Pengingat WhatsApp masuk final? | Ya, sebagai `kind: "reminder"` di `schedules/`, tanpa Calendar | Template utility kedua; tool `createSchedule`/`listSchedules`/`cancelSchedule` lewat draft |
| D6 | Siapa menyusun isi rekap terjadwal | Kode, sesuai `semantic-education.md:165`; ubah langkah 3 di architecture.md yang menjalankan agent | Rekap bisa dites tanpa LLM |
| D7 | Cara `/demo/chat` menampilkan grafik | Web merender dari `points` di tool part dengan adapter React TanStack Charts (definisi sama dengan server), atau API menyajikan PNG | Butuh koordinasi dengan session landing; definisi bersama butuh tempat di luar `apps/api` |
| D9 | Nomor WhatsApp untuk final | Coba nomor asli tanpa verifikasi bisnis (§9) di samping nomor test, setelah fakta batasnya dicek | Uji coba 7–9 Nov tidak terbatas 5 nomor penerima |
| D8 | Tulis ke Sheets, Docs/Slides, Calendar, PDF | Semua Roadmap | Tidak ada pekerjaan OAuth sebelum final |

Dependency yang perlu persetujuan, ringkas: `@tanstack/charts`, `@resvg/resvg-js`, satu file font OFL (aset, bukan paket). Cadangan: `echarts`. Opsional nanti: `pdfmake` (Roadmap). Tidak diusulkan: `googleapis`, `satori`, Chromium/Puppeteer, `@napi-rs/canvas`, layanan QuickChart.

## 9. Panduan "I Hate Twilio" untuk WhatsApp

Sumber: https://github.com/flatypus/ihatetwilio (dibaca 2026-10-25). Isinya hanya README, tanpa kode. Dibuat 2026-02-19, satu kali push, 14 bintang, lisensi MIT.

Isinya (Fakta, dari README): langkah memakai WhatsApp Cloud API langsung tanpa Twilio, dengan nomor asli (bukan nomor test) dan tanpa verifikasi bisnis formal. Urutannya: nomor virtual, akun Business dan Developer, app dengan use case WhatsApp, tambah nomor lewat OTP panggilan suara, metode pembayaran di WhatsApp Account, token System User yang tidak kedaluwarsa, webhook + verify token + app secret, `POST /{PHONE_NUMBER_ID}/register` dengan PIN 6 digit, `POST /{WABA_ID}/subscribed_apps`, lalu publish app.

Relevansi untuk Thya:

| Bagian | Berguna? | Alasan |
|---|---|---|
| "Tinggalkan Twilio" | Tidak | Thya memang sudah memakai Cloud API langsung (`docs/architecture.md`, bagian WhatsApp) |
| Token System User permanen | Ya, penting | Token dari tombol "Generate access token" di API Setup "expires quickly" (Fakta: https://developers.facebook.com/docs/whatsapp/business-management-api/get-started). Untuk server di VPS perlu token System User dengan izin `business_management`, `whatsapp_business_messaging`, `whatsapp_business_management` (sumber yang sama). Belum disebut di `docs/ops/vps-runbook.md` maupun engine-plan |
| `register` + `subscribed_apps` | Ya | Langkah yang tidak terlihat di UI; berguna sebagai checklist saat menyambungkan nomor |
| Nomor asli tanpa verifikasi bisnis | Mungkin, perlu dicek | Lihat di bawah |

Nomor asli vs nomor test. Paper bab 7 dan `docs/architecture.md` menulis bahwa nomor test hanya bisa mengirim ke 5 nomor, dan nomor production butuh verifikasi bisnis (Roadmap). Dokumentasi Meta tidak menyebut verifikasi sebagai syarat menambah nomor: "Newly created business portfolios have a messaging limit of 250", dan batas itu menghitung nomor unik yang dikirimi pesan **di luar** jendela layanan dalam 24 jam bergerak (Fakta: https://developers.facebook.com/docs/whatsapp/messaging-limits). Sumber pihak ketiga (Infobip, 360dialog, dibaca 2026-10-25) menyebut maksimal 2 nomor per portfolio sebelum verifikasi dan nama tampilan yang belum disetujui; halaman Meta yang saya baca tidak menyebut angka itu.

Inferensi: nomor asli tanpa verifikasi kemungkinan cukup untuk uji coba 7–9 Nov dengan lebih dari 5 pemilik warung, karena pemilik yang menghubungi Thya duluan berada di dalam jendela layanan. Yang harus dicek dulu: apakah nama tampilan belum disetujui membuat pesan gagal, biaya per pesan setelah metode pembayaran dipasang, dan risiko nomor diblokir. Kalau berhasil, klaim paper "production number = Roadmap" bisa diubah menjadi "real number, unverified business, 250 limit".

Risiko: panduan ini ditulis satu orang berdasarkan pengalamannya, termasuk trik melewati verifikasi SMS lewat Meta Pay. Pakai sebagai checklist, dan cocokkan setiap langkah dengan dokumentasi Meta sebelum dijalankan.

## Yang belum terverifikasi

- Determinisme hash PNG antara macOS arm64 dan Linux x64.
- Ukuran image Docker sesudah penambahan (angka di atas dari ukuran paket, bukan dari `docker build`).
- Browser in-app WhatsApp dan `disallowed_useragent` di HP sungguhan.
- Service account membaca sheet yang dibagikan kepadanya (jalur B), belum dicoba.
- Kelas scope `calendar.app.created` dan `calendar.events.owned`.
- Apakah WABA test bisa membuat template dengan header gambar.
- Dukungan `startAfter` di versi pg-boss yang akan dipasang.

## Sumber

Kode dan dokumen repo: `apps/api/src/agent/tools.ts`, `apps/api/src/agent/index.ts`, `apps/api/src/worker.ts`, `apps/api/Dockerfile`, `apps/api/package.json`, `docs/engine-plan.md`, `docs/architecture.md`, `docs/agent-harness.md`, `docs/semantic-education.md`, `docs/product-context.md`, `docs/proposal/slides-snapshot.txt`, `docs/paper/ch4-key-features-tech-stack.md`, `docs/paper/ch7-current-status-dev-plan.md`, `docs/paper/ch10-roadmap-tech.md`.

Luar (dibaca 2026-10-25):
- Google: https://developers.google.com/workspace/drive/api/guides/api-specific-auth · https://developers.google.com/workspace/sheets/api/scopes · https://developers.google.com/workspace/docs/api/auth · https://developers.google.com/workspace/slides/api/scopes · https://developers.google.com/workspace/calendar/api/auth · https://developers.google.com/workspace/sheets/api/reference/rest/v4/spreadsheets.values/append · https://support.google.com/cloud/answer/15549945 · https://developers.google.com/identity/protocols/oauth2/policies · https://developers.google.com/identity/protocols/oauth2/web-server · https://developers.google.com/workspace/drive/picker/guides/web-picker
- WhatsApp: https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/image-messages · https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/document-messages · https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media · https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing · https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-account/message-template-api.md · https://developers.facebook.com/documentation/business-messaging/whatsapp/templates/template-categorization
- Ukuran paket: `npm view <paket> version dist.unpackedSize`, 2026-10-25.
- Uji render: script di scratchpad session (di luar repo), tidak di-commit.
