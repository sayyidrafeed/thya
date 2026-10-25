# Thya: semantic layer + edukasi

Status: riset 2026-10-25. Keputusan D1–D9 di §7 diterima Rafee pada 2026-10-25 (lihat `docs/decisions.md`). Dokumen ini melanjutkan `docs/agent-harness.md` §3 (registry metrik) dan entri "Istilah ambigu" di `docs/decisions.md`.

Masalahnya: pemilik warung bertanya "untung berapa?" atau "modalnya balik nggak?". Semantic layer menjawab *metrik mana yang dimaksud*. Edukasi menjawab *apakah pemilik paham angka yang dikembalikan*. Dokumen ini mengusulkan agar keduanya disimpan di registry yang sama, supaya definisi teknis, kata sehari-hari, dan penjelasan tidak bisa saling menyimpang.

## Ringkasan rekomendasi

1. Data nasional tentang pemahaman pemilik UMKM terhadap omzet, HPP, laba, dan margin **tidak ditemukan**. Yang ada hanya literasi keuangan umum (OJK/BPS SNLIK) dan studi lokal kecil. Studi lokal itu konsisten menunjukkan bahwa usaha kuliner menghitung HPP sebagian atau menebak harga jual. Asumsi kerja Thya: user belum tentu tahu bedanya omzet dan laba.
2. Bukti terkuat untuk cara mengajar datang dari riset pelatihan usaha mikro: aturan praktis yang sederhana mengalahkan pelatihan akuntansi formal, dan efeknya paling besar pada pemilik yang paling lemah (Drexler, Fischer & Schoar 2014). Pelatihan lewat pesan singkat berhasil tapi memudar saat interaksi berhenti. Jadi edukasi Thya sebaiknya **menempel pada jawaban yang memang diminta user**, memakai angka milik user sendiri, satu kalimat dulu, detail hanya kalau diminta.
3. Registry metrik ditambah blok `explain` (definisi sehari-hari, rumus dalam kata, kenapa penting, jebakan umum, template contoh berbasis angka user) dan tabel istilah terpisah (sinonim, istilah daerah, aturan default dan tanya balik).
4. Kapan menjelaskan diputuskan **oleh kode**, bukan oleh model: tool mengembalikan teks penjelasan yang sudah terisi angka, berdasarkan tabel paparan konsep per usaha. Ini menjaga prinsip "angka hanya dari tool".
5. Onboarding HPP menjadi momen edukasi pertama: begitu user menyebut modal per porsi, Thya langsung menunjukkan sisa per porsi dengan angka user sendiri.
6. Untuk final 10 Nov: blok `explain` untuk sekitar 8 metrik, tabel istilah, tabel paparan konsep, alur onboarding HPP tiga jalur, dan 14 kasus eval baru. Teach-back, istilah daerah yang luas, dan arus kas masuk Roadmap.

## 1. Seberapa paham pemilik UMKM terhadap konsep keuangan usaha

### Fakta yang ditemukan

| Temuan | Sumber | Batasan |
|---|---|---|
| Indeks literasi keuangan nasional 66,46% (SNLIK 2025), naik ke 69,57% (SNLIK 2026). Inklusi 80,51% → 93,61%. | OJK/BPS 2025, BPS 2026 | Mengukur pengetahuan dan keyakinan terhadap **produk jasa keuangan** (bank, asuransi, dsb.), bukan konsep akuntansi usaha seperti HPP atau margin. |
| Kelompok pengusaha/wiraswasta termasuk tiga kelompok literasi tertinggi: 73,60% (2025), 76,51% (2026). | OJK 2025, BPS 2026 | Sama seperti di atas. Angka ini tidak bisa dibaca sebagai "76% pemilik usaha paham laba". |
| Literasi naik tajam dengan pendidikan: tidak tamat SD 45,23%, tamat SD 59,67%, SMP 67,72%, SMA 79,17%, perguruan tinggi 93,46%. Perdesaan 64,42% vs perkotaan 72,54%. | BPS 2026 | Relevan untuk persona warung dengan pendidikan SD/SMP, tapi tetap literasi produk keuangan. |
| 77% UMKM yang disurvei masih mencatat keuangan secara manual. | OCBC × NielsenIQ, Business Fitness Index 2024 (via Viva) | Ukuran sampel tidak disebut di artikel. Manual ≠ tidak paham. |
| UMKM kuliner di Batam menetapkan harga jual dari perkiraan, tanpa menghitung HPP. | Studi pengabdian, Universitas Islam Raden Rahmat Malang | Studi kecil, lokal, berupa kegiatan pelatihan. |
| Es Teh Jumbo (Medan) hanya menghitung sebagian biaya. Dengan full costing, HPP Rp3.530 dari harga Rp5.000. | Jurnal GVES (FKPT) | Studi kasus satu usaha. |
| Pecel Ayam Akew hanya mencatat biaya yang kasat mata. Kelana Bakery menghitung HPP hanya dari bahan dan tenaga kerja. Warung Pingkal menentukan harga dari perkiraan. | IPB, Poltek Indonusa, Untar | Studi kasus satu usaha masing-masing. |
| Mencampur uang pribadi dan usaha disebut sebagai masalah umum di beberapa studi pengabdian (Surakarta, Indramayu, Babakan Anyar). | Jurnal pengabdian UMS, Unigal, dll. | Kualitatif, tanpa angka nasional. |
| Survei 399 UMKM di Jawa Timur: literasi pembukuan dan penganggaran memprediksi pertumbuhan penjualan dan laba. | Inderscience, IJEDED 2018 | Korelasional. |

### Yang tidak ditemukan

- Survei nasional yang mengukur apakah pemilik UMKM bisa membedakan omzet, laba kotor, dan laba bersih, atau tahu HPP per porsi menu sendiri.
- Data dari BukuWarung atau majoo tentang pemahaman user. Yang ada hanya artikel edukasi mereka (misalnya cara menghitung HPP di blog majoo) dan studi pengabdian yang memakai BukuWarung sebagai alat.
- Data Bank Indonesia yang spesifik soal konsep akuntansi usaha.

### Inferensi untuk desain Thya

- Kata "untung" kemungkinan besar dipakai untuk "uang yang tersisa" tanpa definisi tetap. Sebagian user bisa memaksudkan omzet, sebagian laba kotor, sebagian uang di laci. Ini inferensi dari pola studi kasus, belum diuji wawancara.
- HPP yang diberikan user kemungkinan **terlalu rendah** (biaya kemasan, gas, minyak, susut sering terlewat). Thya perlu menanyakan komponen yang sering lupa, bukan hanya angka total.
- "Arus kas" hampir pasti bukan istilah yang dipakai user. Yang dipakai kemungkinan "uang di laci", "duit pegangan", atau "uang buat belanja besok". Thya MVP tidak mencatat kas masuk/keluar, jadi pertanyaan arus kas harus dijawab jujur sebagai belum tersedia.
- Literasi keuangan rendah tidak berarti user lambat. Pemilik warung menghitung kembalian dan belanja harian setiap hari. Yang kurang adalah kosakata dan kerangka, bukan kemampuan berhitung. Penjelasan Thya sebaiknya menempel pada kegiatan yang sudah mereka lakukan (belanja bahan, jual per gelas, bayar sewa).

## 2. Pola edukasi di dalam alur

### Bukti dari riset

| Pola | Bukti | Implikasi untuk Thya |
|---|---|---|
| Aturan praktis lebih efektif daripada konsep akuntansi lengkap | RCT di Republik Dominika (1.193 nasabah mikro): pelatihan akuntansi standar tidak berdampak signifikan, pelatihan aturan praktis menaikkan kualitas pencatatan dan pendapatan. Dampak terbesar pada pemilik yang paling lemah. Peserta 6–12 poin persen lebih mungkin mencatat dan memisahkan uang usaha dan pribadi. (Drexler, Fischer & Schoar, AEJ Applied 2014) | Jelaskan dengan satu aturan yang bisa langsung dipakai ("modal per porsi idealnya dicatat dulu sebelum hitung untung"), bukan definisi buku teks. |
| Edukasi tepat waktu, terikat pada keputusan | Meta-analisis 201 studi: efek edukasi keuangan kecil dan memudar dalam ~20 bulan, lebih lemah pada sampel berpendapatan rendah. Penulis mengusulkan edukasi "just in time" yang terikat pada perilaku tertentu. (Fernandes, Lynch & Netemeyer, Management Science 2014). Meta-analisis lebih baru (Kaiser, Lusardi dkk.) menemukan efek lebih besar dan tidak bisa mengonfirmasi peluruhan; yang saya temukan baru slide konferensi. | Penjelasan muncul saat user sedang melihat angkanya, bukan sebagai kursus terpisah. |
| Pesan singkat berhasil selama ada interaksi | RCT SMS di Kenya (~13.000 pedagang mikro): pelatihan otomatis via SMS menaikkan adopsi pencatatan dan profitabilitas (Fuchs dkk.). RCT lain di Kenya (4.700 pengusaha mikro): efek hilang 12 bulan kemudian setelah interaksi berhenti dalam 5 bulan (Mehmood, IGC 2024). Pelatihan via Zoom di Meksiko dan aplikasi di Kolombia menunjukkan pola serupa: efek jangka pendek, engagement rendah. | Keunggulan Thya adalah interaksi yang berulang karena user butuh jawaban harian. Edukasi menumpang di interaksi itu, bukan diberi jadwal sendiri. |
| Contoh dengan konteks milik pelajar sendiri | Personalisasi konteks soal aljabar ke minat siswa menaikkan keberhasilan, terutama pada siswa berprestasi rendah (Walkington; laporan pers, angka belum dicek ke paper asli). | Contoh penjelasan memakai menu dan angka user ("Es Kopi Susu kamu Rp18.000, modalnya Rp7.500"), bukan contoh generik. |
| Antarmuka teks sulit bagi user literasi rendah | Riset Microsoft Research India (Medhi dkk., ACM TOCHI 2011): antarmuka berbasis teks (formulir, SMS, USSD) tidak bisa dipakai user literasi rendah yang baru pertama kali, operator manusia jauh lebih akurat, suara lebih cepat bagi yang nyaman bicara. | Kalimat pendek, satu konsep per pesan, tombol balasan untuk pilihan, dan voice note (agent-harness §10) penting untuk segmen ini. |
| Progressive disclosure | Pola UX umum: tampilkan yang utama dulu, detail saat diminta (Nielsen Norman Group, dikutip sekunder). | Jawaban → satu kalimat penjelasan → detail hanya jika user bertanya "maksudnya?" atau menekan tombol. |

### Contoh produk nyata

Bukti produk yang secara terbuka mendokumentasikan edukasi di dalam chat untuk pemilik usaha mikro ternyata tipis. Yang ditemukan:

- **BukuWarung**: menghitung untung/rugi otomatis dari catatan penjualan dan pembelian. Studi pengabdian memakai aplikasi ini sebagai alat pelatihan, tapi cara aplikasi menjelaskan istilah tidak terdokumentasi.
- **majoo, Jurnal.id, Accurate**: edukasi lewat artikel blog (cara menghitung HPP, food cost), terpisah dari alur aplikasi. Ini pola "edukasi di luar alur" yang menurut riset di atas paling lemah efeknya.
- **QuickBooks (Intuit Intelligence)**: asisten bahasa alami yang menjawab pertanyaan bisnis dan menautkan ke data aslinya. Glossary P&L dipisah di situs. Detail cara menjelaskan belum terverifikasi dari sumber resmi.
- **Cleo** (AI keuangan pribadi via chat): nada santai dan humor ("Roast Mode", "Hype Mode") untuk membuat umpan balik pengeluaran terasa ringan. Reviewer independen menilainya kuat untuk kesadaran, lemah untuk perencanaan. Relevan sebagai contoh nada, bukan sebagai bukti hasil belajar.

Inferensi: pola "jawab dulu, jelaskan dengan angka user sendiri, detail jika diminta" di WhatsApp belum punya pembanding produk yang terbukti di Indonesia. Ini bisa menjadi pembeda Thya di paper, dengan syarat tidak diklaim "terbukti".

### Batasan WhatsApp yang memengaruhi desain

- Reply button maksimal 3, judul maksimal 20 karakter. List message maksimal 10 baris. Interactive message hanya bisa dikirim di dalam jendela 24 jam. (Dokumentasi pihak ketiga yang mengutip Meta; perlu dicek ke docs resmi Meta sebelum implementasi.)
- Artinya tombol seperti `[Maksudnya?]` `[Oke, paham]` muat, tapi harus dirancang untuk 3 pilihan. `/demo` web bisa meniru tombol ini.

## 3. Menggabungkan edukasi dengan semantic layer

### 3.1 Skema registry

Usulan ini memperluas tipe `Metric` di `docs/agent-harness.md` §3. Tahap 1 (2026-10-25) sudah dipasang di `apps/api/src/semantic/` dengan bentuk yang lebih kecil: definisi konsep di `concepts.ts`, tabel istilah di `terms.ts`, hitungan di `metrics.ts`, pemilihan penjelasan di `explain.ts`, dan paparan konsep di `exposure.ts`. Tool `queryMetric` menggantikan `getSalesSummary`, dan `explainConcept` ditambahkan. Skema di bawah tetap menjadi arah untuk tahap 2.

```ts
type ConceptId = MetricId | "menu_cost" | "operating_expense" | "cash";

type Metric = {
  id: MetricId;                    // "revenue" | "cogs" | "gross_profit" | ...
  label: string;                   // "Omzet"
  definition: string;              // definisi teknis, untuk tim dan eval
  requires: DataNeed[];            // ["transactions", "menu_cost"]
  compute(ctx: MetricContext): Promise<MetricResult>;
  explain: MetricExplain;
};

type MetricExplain = {
  plain: string;          // "Semua uang yang masuk dari jualan, sebelum dipotong apa pun."
  formulaWords: string;   // "harga jual × jumlah terjual"
  whyItMatters: string;   // satu kalimat yang terikat keputusan
  pitfall: string | null; // "Omzet naik belum tentu untung naik."
  ruleOfThumb: string | null;
  // Template deterministik. Angka hanya dari MetricResult, jadi lolos cek angka pasca-output.
  example(result: MetricResult, profile: BusinessProfile): string;
  detail(result: MetricResult, profile: BusinessProfile): string; // 2–4 kalimat
  missingData: Partial<Record<DataNeed, string>>; // kenapa data X dibutuhkan
  related: ConceptId[];   // untuk "terus bedanya sama ...?"
};

// Terpisah dari Metric, karena satu kata bisa menunjuk beberapa metrik.
type Term = {
  phrase: string;                 // "untung", "bathi" (Jawa), "hasil", "dapet berapa"
  locale: "id" | "jv" | "su" | "other";
  candidates: MetricId[];         // urut dari default
  resolve: TermRule;              // aturan pilih default
  clarifyWhen: string | null;     // kapan tanya balik
  source: "team" | "interview" | "observed";
};

// Per usaha, per konsep. Diisi kode, bukan model.
type ConceptExposure = {
  businessId: string;
  concept: ConceptId;
  timesExplained: number;
  lastExplainedAt: Date | null;
  confusionSignals: number;      // "maksudnya?", "kok beda?"
  correctUseSignals: number;     // user memakai istilah tepat tanpa diminta
  level: "new" | "seen" | "familiar";
};
```

Contoh isi untuk laba kotor:

| Field | Isi |
|---|---|
| `plain` | Uang jualan dikurangi modal bahan. Belum dipotong sewa, gaji, listrik. |
| `formulaWords` | omzet − modal bahan semua porsi yang terjual |
| `whyItMatters` | Ini yang dipakai buat bayar sewa, gaji, dan sisanya baru jadi untung bersih Kakak. |
| `pitfall` | Kalau laba kotor kecil, ramai pun belum tentu cukup buat nutup biaya bulanan. |
| `example` | "Minggu ini jualan *Rp4.200.000*, modal bahannya *Rp1.650.000*, jadi laba kotornya *Rp2.550.000*." |
| `missingData.menu_cost` | "Biar bisa hitung laba, Thya perlu tahu modal per porsi. Boleh mulai dari 3 menu paling laku dulu." |

Tabel istilah awal. Kolom "default" sama dengan `docs/agent-harness.md` §3; yang baru adalah kolom tanya balik dan sumber. Semua baris berstatus inferensi tim sampai diuji wawancara.

| Istilah user | Kandidat | Default | Tanya balik kalau |
|---|---|---|---|
| omzet, pemasukan, jualan, hasil jualan, "dapet berapa" | revenue | revenue | tidak pernah |
| untung, laba, bathi | gross_profit, net_profit, revenue | net_profit kalau biaya operasional sudah tercatat, gross_profit kalau belum | angka omzet dan laba berbeda jauh *dan* user tampak membandingkan dengan uang di laci |
| untung bersih, bersihnya | net_profit | net_profit | biaya operasional belum dicatat → jelaskan komponen yang hilang, jangan hitung |
| untung kotor, laba kotor | gross_profit | gross_profit | tidak pernah |
| modal (harian/mingguan) | cogs | cogs | konteks "balik modal", "modal awal", "pinjam modal" |
| HPP, modal per porsi, modal bahan | menu_cost, cogs | menu_cost kalau menyebut menu, cogs kalau menyebut periode | tidak pernah |
| margin, "persen untungnya" | gross_margin_pct | gross_margin_pct | tidak pernah |
| laku, "apa yang laku" | top_items by qty | qty | user bertanya "paling menghasilkan" → by revenue/gross profit |
| rame, sepi | peak_hours, revenue vs average | sesuai kata waktu | tidak pernah |
| uang di laci, duit pegangan, kas, arus kas | cash | belum tersedia | selalu jelaskan bahwa Thya belum mencatat kas masuk/keluar |

### 3.2 Kapan menjelaskan vs langsung menjawab

Prinsip: angka yang diminta selalu muncul di baris pertama. Penjelasan adalah tambahan, maksimal satu kalimat kecuali diminta.

| Kondisi | Perilaku | Diputuskan oleh |
|---|---|---|
| Konsep muncul pertama kali untuk usaha ini (`level = new`) | Jawaban + `plain` + `example` | Kode, dari `ConceptExposure` |
| User memakai istilah ambigu, default dipilih | Jawaban + satu kalimat "Thya hitung X ya, yaitu ..." | Kode, dari `Term.resolve` |
| Hasil berlawanan intuisi (omzet naik, laba kotor turun; menu terlaris bukan yang paling menghasilkan) | Jawaban + `pitfall` diisi angka | Kode, aturan per metrik |
| Data kurang untuk metrik yang diminta | Tidak ada angka palsu. `missingData` + ajakan mengisi | Kode |
| User bertanya "maksudnya?", "kok bisa?", "apa itu X" | `detail` + `related` | Model memilih tool `explainConcept` |
| Konsep `familiar` | Jawaban saja | Kode |
| Rekap terjadwal | Angka saja, ditambah paling banyak satu "tahukah Kakak" untuk konsep berstatus `seen` | Kode |
| Pertanyaan pajak, hukum, investasi | Mengikuti guardrail §8 harness | Model + guardrail |

Aturan naik level (angka perlu dikalibrasi dengan data):
- `new → seen`: sudah dijelaskan sekali. Peringatan (pitfall) tidak dihitung sebagai penjelasan karena tidak memuat definisi.
- `seen → familiar`: dua sinyal pemakaian benar, atau dua kali dijelaskan tanpa sinyal bingung. Pemakaian istilah formal baru dihitung setelah konsepnya pernah dijelaskan. Jendela 14 hari belum diterapkan di tahap 1.
- Turun ke `seen` kalau ada sinyal bingung baru.
- Kalau konsep masih `new` dan ada pitfall, definisi dan peringatan dikirim bersama.

Kenapa kode yang memutuskan, bukan model: (1) teks penjelasan berisi angka, dan prinsip harness mewajibkan angka berasal dari hasil tool; (2) perilakunya bisa dites deterministik di lapis a/b eval; (3) model DeepSeek V4.1 Flash cenderung mengabaikan field opsional (harness §11), jadi keputusan yang bergantung pada inisiatif model kurang stabil. Model tetap boleh merangkai kalimat di sekitar teks dari tool, asal tidak menambah angka.

Bentuk keluaran `queryMetric` (tahap 1):

```ts
type QueryMetricOutput = {
  metric: MetricId;                 // sudah di-resolve: "profit" → "gross_profit"
  label: string;                    // "laba kotor"
  value: string | null;             // "Rp2.550.000"; null kalau datanya belum ada
  range: RangeLabel;
  previousPeriod: { label: string; value: string | null; change: string | null } | null;
  interpretedAs: string | null;     // kalimat "\"untung\" Thya hitung sebagai laba kotor ..."
  explanation: { level: "none" | "intro" | "pitfall" | "missing"; text: string | null };
};
```

### 3.3 Mengukur apakah user jadi paham

Sinyal di chat (semuanya proksi, bukan bukti pemahaman):

| Sinyal | Arah | Cara deteksi |
|---|---|---|
| User memakai istilah yang tepat tanpa diminta ("laba kotor minggu ini?") | Positif | `Term` yang cocok tanpa ambiguitas, setelah konsep pernah dijelaskan |
| User mengajukan pertanyaan lanjutan yang butuh konsep ("menu mana yang marginnya paling kecil?") | Positif | Tool call dengan metrik turunan setelah konsep dasar |
| User bertindak berdasarkan konsep (memperbarui modal per porsi, bertanya soal harga jual) | Positif kuat | Write `setMenuCost`, pertanyaan harga |
| "maksudnya?", "kok beda?", "lho kok kecil padahal rame" | Negatif | Daftar frasa + klasifikasi ringan oleh model, disimpan sebagai event |
| Pertanyaan "apa itu X" berulang untuk konsep yang sama | Negatif | `explainConcept` dipanggil ≥2× per konsep |
| User mengoreksi tafsiran Thya ("bukan, maksudku uang di laci") | Negatif untuk pemetaan istilah, bukan untuk user | Event `term_corrected`, masuk antrean revisi `Term` |

Metrik agregat yang bisa dilaporkan: rasio istilah tepat terhadap istilah ambigu per user dari minggu ke minggu, tingkat sinyal bingung per konsep, dan jumlah koreksi per istilah. Koreksi istilah adalah data paling berharga untuk memperbaiki tabel `Term`.

Batasannya: sinyal ini tidak membuktikan pemahaman. Pemakaian istilah bisa meniru Thya tanpa paham. Validasi sesungguhnya perlu wawancara atau teach-back (§6 dan Roadmap).

## 4. Onboarding: mengumpulkan HPP sambil mengedukasi

Keputusan yang sudah ada (decisions.md, ronde 2): onboarding menanyakan modal per porsi untuk 3–5 menu utama. Usulan alurnya:

1. **Mulai dari menu, bukan istilah.** "Menu apa yang paling sering dibeli orang?" Thya mencatat 3–5 menu dan harga jualnya (dikonfirmasi, seperti semua write).
2. **Tanya modal dengan kata user.** "Kalau bikin satu gelas Es Kopi Susu, modal bahannya kira-kira berapa?" Kata "HPP" baru dikenalkan setelah ada angka.
3. **Tiga jalur jawaban:**
   - *Langsung tahu angka* → simpan dengan `costSource: "owner"`.
   - *Tidak tahu per porsi, tapi tahu belanja* → "Beli gula aren 1 kg berapa, jadi berapa gelas?" Tool menghitung per porsi dari belanja dan hasil, bukan model. `costSource: "recipe"`.
   - *Tidak tahu sama sekali* → minta perkiraan ("kira-kira separuh harga jual? sepertiga?"), simpan `costSource: "estimate"`. Semua angka laba yang dihitung dari perkiraan diberi label "perkiraan" di jawaban.
4. **Cek komponen yang sering lupa.** Satu pertanyaan dengan tombol: "Sudah termasuk gelas/plastik dan es?" `[Sudah]` `[Belum]` `[Nggak tahu]`. Kemasan dan es masuk HPP. Gas, listrik, sewa, dan gaji masuk biaya operasional (lihat keputusan D3).
5. **Momen edukasi pertama, dengan angka user.** Begitu satu menu lengkap: "Berarti tiap Es Kopi Susu Rp18.000, sisa *Rp10.500* buat bayar sewa, gaji, dan untung Kakak. Sisa ini namanya *laba kotor*." Teks ini dari template `example`, angkanya dari tool.
6. **Jangan memaksa lengkap.** Setelah 3 menu, Thya menawarkan lanjut atau berhenti. Menu tanpa modal tetap dihitung omzetnya, dan laba ditampilkan sebagai "untuk 3 menu yang modalnya sudah dicatat" dengan porsi omzet yang tercakup.
7. **Perbarui modal tanpa onboarding ulang.** Kalau user bilang "gula naik", Thya menawarkan memperbarui modal menu terkait. Modal punya tanggal berlaku, jadi laba bulan lalu tidak berubah.

Tambahan skema data (usulan): `menu_cost(menu_id, amount, source: owner|recipe|estimate, includes_packaging: bool|null, valid_from, created_via_message_id)`.

## 5. Rencana teknis

### 5.1 Untuk final 10 Nov

Urutan dari yang paling berdampak pada demo:

| # | Pekerjaan | Catatan |
|---|---|---|
| 1 | Registry metrik dengan blok `explain` untuk revenue, cogs, gross_profit, gross_margin_pct, net_profit (sederhana), top_items, avg_ticket, period_compare | Bisa dibangun bersamaan dengan `queryMetric` dari harness §3. Copy dicek Nawra. |
| 2 | Tabel `Term` sebagai data (bukan prompt) + `interpretedFrom` di hasil tool | Prompt sistem tetap pendek; istilah tidak ditulis di prompt. |
| 3 | `ConceptExposure` di Postgres + aturan level deterministik | Untuk `/demo` publik tanpa nomor WA, simpan per sesi browser. |
| 4 | Tool `explainConcept({ concept, depth: "short" \| "detail" })` | Mengembalikan template terisi angka periode terakhir milik user. Kalau datanya tidak ada, pakai contoh menu user tanpa angka penjualan. |
| 5 | Alur onboarding HPP tiga jalur + `setMenuCost` dengan konfirmasi | Jalur `recipe` dihitung tool. |
| 6 | Label "perkiraan" dan cakupan parsial di hasil metrik | Di level `MetricResult`, bukan teks model. |
| 7 | Tombol `[Maksudnya?]` di WA dan `/demo` | Bergantung verifikasi batas interactive message di docs Meta. |
| 8 | Kasus eval baru (§5.3) | Lapis a/b jalan di CI. |

Yang sengaja tidak masuk final: benchmark food cost (sumber kisaran 25–35% hanya artikel vendor dan tidak berlaku umum), teach-back, istilah daerah selain beberapa contoh Jawa, arus kas.

### 5.2 Roadmap

- **Teach-back opsional**: setelah konsep berstatus `seen`, sesekali tanya "kalau minggu depan jualan sama tapi gula naik, laba kotornya naik atau turun?" Hanya kalau user setuju diajak latihan; risiko menjengkelkan tinggi.
- **Tabel istilah dari data nyata**: koreksi `term_corrected` dan transkrip wawancara menjadi sumber `Term` dengan `source: "observed"`. Tambah bahasa daerah per kota pilot.
- **Arus kas sederhana**: catat uang masuk/keluar harian, lalu kenalkan "uang di laci" vs "untung". Ini butuh data yang belum dikumpulkan.
- **Aturan praktis mingguan di rekap**: satu aturan per minggu yang terikat angka minggu itu (pola Drexler dkk.), misalnya memisahkan uang belanja bahan dari uang pribadi.
- **Penjelasan suara**: voice note balasan untuk user yang lebih nyaman mendengar (Medhi dkk.). Butuh TTS, belum dievaluasi.
- **Benchmark per kategori usaha**: hanya kalau ada data agregat user Thya sendiri, bukan angka blog.

### 5.3 Kasus eval tambahan untuk `docs/agent-harness.md` §9

| # | Kasus | Lapis | Grader |
|---|---|---|---|
| E1 | `Term` "untung" tanpa biaya operasional → gross_profit, `interpretedFrom` terisi | a | Deterministik |
| E2 | "untung bersih" tanpa biaya operasional → tidak ada angka net_profit, `missing` terisi | a | Deterministik |
| E3 | "modal" dalam kalimat "kapan balik modal?" → tanya balik, tidak memanggil cogs | c | Pemilihan tool |
| E4 | Konsep `new` → jawaban memuat `plain`; konsep `familiar` → tidak memuat | a + c | Deterministik di tool, cek string di balasan |
| E5 | Omzet naik, laba kotor turun → `pitfall` muncul dengan angka dari tool | a + c | Deterministik |
| E6 | Penjelasan yang ditulis model tidak menambah angka di luar hasil tool | b | Cek angka pasca-output yang sudah ada |
| E7 | "maksudnya?" setelah jawaban laba → `explainConcept(detail)` untuk konsep yang benar | c | Pemilihan tool + argumen |
| E8 | Onboarding jalur recipe: "gula aren 1 kg 40 ribu buat 50 gelas" → modal per porsi dihitung tool, bukan model | c | Argumen tool + angka |
| E9 | Onboarding jalur estimate → jawaban laba berikutnya memuat kata "perkiraan" | c | Cek string |
| E10 | Cakupan parsial: 3 dari 11 menu punya modal → jawaban menyebut cakupan, bukan laba seluruh usaha | c | Cek string + angka |
| E11 | "uang di laci berapa?" → jujur belum tersedia, tidak menjawab dengan omzet | c | Negatif |
| E12 | User mengoreksi tafsiran ("bukan, maksudku omzet") → metrik diganti, event `term_corrected` tersimpan | c | Pemilihan tool + DB |
| E13 | Penjelasan untuk konsep tidak memakai istilah Inggris (margin boleh, "gross profit" tidak) dan tidak lebih dari ~3 kalimat | d | LLM-as-judge, rubrik nada |
| E14 | Rekap terjadwal memuat paling banyak satu penjelasan | a | Deterministik |

Ini menambah sekitar 14 kasus ke target 40–60 di harness §9.

## 6. Pertanyaan untuk wawancara user (untuk Nawra)

1. Kalau ditanya "minggu ini untung berapa?", angka apa yang Bapak/Ibu sebut, dan dari mana angka itu?
2. Apa bedanya "omzet", "untung", dan "uang di laci" menurut Bapak/Ibu? Kata apa yang biasa dipakai sehari-hari (termasuk bahasa daerah)?
3. Tahu modal per porsi untuk menu yang paling laku? Kalau tahu, apa saja yang dihitung (bahan, gelas/plastik, es, gas)?
4. Kalau tidak tahu, cara paling gampang memperkirakannya apa: dari belanja harian, dari resep, atau tebakan?
5. Uang usaha dan uang rumah tangga dipisah atau satu laci/dompet?
6. Kapan terakhir mengubah harga jual, dan apa alasannya?
7. Lebih suka dijelaskan lewat contoh angka sendiri, perumpamaan, atau langsung angka saja? Merasa digurui kalau dijelaskan?
8. Lebih nyaman membaca pesan atau mendengar voice note?
9. Kalau Thya bertanya balik "maksudnya untung kotor atau bersih?", apakah itu membantu atau membingungkan?
10. Keputusan apa yang ingin diambil dari angka harian (belanja bahan, harga, menu yang dihapus, jam buka)?

Wawancara juga sebaiknya mencatat kata persis yang dipakai user, karena itu bahan langsung untuk tabel `Term`.

## 7. Keputusan untuk Rafee

| # | Keputusan | Rekomendasi | Alasan |
|---|---|---|---|
| D1 | Teks penjelasan dari template deterministik atau ditulis bebas oleh model | Template di tool, model boleh merangkai di sekitarnya | Menjaga "angka hanya dari tool" dan bisa dites |
| D2 | Default "untung" | gross_profit kalau biaya operasional kosong, net_profit kalau ada, selalu disertai `interpretedFrom` | Sama dengan harness §3; sekarang punya mekanisme penjelasan |
| D3 | Cakupan HPP | Bahan + kemasan + es per porsi. Gas, listrik, sewa, gaji masuk biaya operasional | Sederhana untuk ditanyakan per porsi; komponen lain lebih mudah dicatat bulanan |
| D4 | HPP perkiraan boleh dipakai | Boleh, dengan label "perkiraan" di setiap angka turunannya | Tanpa ini, banyak user tidak pernah melihat laba sama sekali |
| D5 | Tabel `ConceptExposure` di Postgres | Ya, satu tabel kecil | Satu-satunya cara agar Thya berhenti menjelaskan hal yang sudah dipahami |
| D6 | `explainConcept` tool terpisah atau field di `queryMetric` | Keduanya: field `explain` untuk penjelasan otomatis, tool untuk "maksudnya?" | Pertanyaan "apa itu X" tidak selalu butuh query metrik |
| D7 | Benchmark food cost ditampilkan | Tidak untuk final | Sumbernya artikel vendor dan tidak berlaku umum; melanggar "jangan klaim yang belum terbukti" |
| D8 | Siapa menyetujui copy penjelasan | Nawra (riset user), Rafee (konsistensi dengan metrik) | Teks ini menjadi klaim produk di demo |
| D9 | Klaim edukasi di paper | "Thya explains each metric in plain language using the owner's own numbers", tanpa klaim peningkatan literasi | Belum ada data pemahaman user |

## Sumber

Literasi keuangan dan praktik UMKM:
- OJK, siaran pers SNLIK 2025: https://ojk.go.id/id/berita-dan-kegiatan/siaran-pers/Pages/OJK-dan-BPS-Umumkan-Hasil-Survei-Nasional-Literasi-Dan-Inklusi-Keuangan-SNLIK-Tahun-2025.aspx
- BPS, hasil SNLIK 2026: https://www.bps.go.id/id/news/2026/08/22/936/indeks-literasi-dan-inklusi-keuangan-masyarakat-meningkat--ojk--lps--dan-bps-umumkan--hasil-survei-nasional-literasi-dan-inklusi-keuangan--snlik--tahun-2026.html
- Kontan, ringkasan SNLIK 2025: https://keuangan.kontan.co.id/news/hasil-snlik-2025-indeks-literasi-keuangan-6646-dan-inklusi-keuangan-8051
- Viva, OCBC Business Fitness Index (77% manual): https://www.viva.co.id/bisnis/1862480-survei-77-persen-umkm-masih-pakai-catatan-keuangan-manual-apa-dampaknya-bagi-bisnis-nbsp
- UMKM kuliner Batam, HPP dan harga jual: https://ejournal.uniramalang.ac.id/i-com/id/article/view/4115
- Es Teh Jumbo, full costing: https://journal.fkpt.org/index.php/gves/article/view/2836
- Pecel Ayam Akew (IPB): https://repository.ipb.ac.id/handle/123456789/155424
- Kelana Bakery: https://www.bengawan.poltekindonusa.ac.id/index.php/jurnal_bengawan/article/download/183/100/1062
- Warung Pingkal: https://journal.untar.ac.id/index.php/JSA/article/view/22679/13789
- Pemisahan uang pribadi dan usaha (Surakarta): https://journals2.ums.ac.id/index.php/abdipsikonomi/article/download/3469/1713/23110
- Indramayu: https://jurnal.unigal.ac.id/abdimasgaluh/article/download/16398/9338
- Literasi pembukuan dan kinerja UMKM Jawa Timur: https://ideas.repec.org/a/ids/ijeded/v9y2018i4p303-323.html

Pola edukasi:
- Drexler, Fischer & Schoar, "Keeping It Simple": https://dspace.mit.edu/handle/1721.1/88086 · ringkasan IPA: https://poverty-action.org/node/6951/pdf
- Fernandes, Lynch & Netemeyer 2014: https://papers.ssrn.com/abstract=2333898
- Kaiser, Lusardi dkk. (slide meta-analisis baru): https://gflec.org/wp-content/uploads/2022/12/Meta_analysis_LusardiUrban-NEFE-final.pdf
- Fuchs dkk., SMS training Kenya: https://faculty.haas.berkeley.edu/giyer/index_files/sms_training.pdf
- Mehmood, "Short messages fall short" (IGC 2024): https://www.theigc.org/sites/default/files/2025-03/Mehmood-Working-Paper-September-2024.pdf
- Zoom training Meksiko: https://www.sciencedirect.com/science/article/abs/pii/S0304387823002006
- Expertienda, Kolombia: https://link.springer.com/article/10.1007/s40821-025-00293-y
- Walkington, personalisasi konteks (laporan pers): https://www.smu.edu/News/2012/candace-a-walkington-EducationWeek-04oct2012
- Medhi dkk., antarmuka untuk user literasi rendah: https://www.microsoft.com/en-us/research/wp-content/uploads/2016/02/ToCHI2711_Medhi.pdf
- Progressive disclosure: https://en.wikipedia.org/wiki/Progressive_disclosure

Produk dan platform:
- majoo, cara menghitung HPP: https://majoo.id/solusi/detail/cara-menghitung-hpp-produk-umkm-agar-bisnis-selalu-untung
- Jurnal.id, food cost: https://www.jurnal.id/id/blog/contoh-cara-menghitung-hpp-makanan-juga-food-cost-adalah-berikut
- QuickBooks Intuit Intelligence (pihak ketiga): https://theretailexec.com/partner-spotlight/intuit-quickbooks-online_133411/quickbooks-online-intuit-intelligence-feature-deep-dive-how-it-works/
- Cleo: https://www.thepennyhoarder.com/budgeting/cleo-app-review/ · https://thenextweb.com/news/cleo-launches-ai-money-coach-fix-spending-habits
- Batas interactive message WhatsApp (pihak ketiga): https://developer.exotel.com/docs/whatsapp-support/interactive-messages · https://elevenlabs.io/docs/eleven-agents/whatsapp/interactive-messages
