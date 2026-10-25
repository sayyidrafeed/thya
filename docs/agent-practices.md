# Thya: praktik harness dan eval agent di startup produksi

Status: riset read-only, 2026-10-25. Dokumen ini tidak mengubah keputusan di `docs/decisions.md` atau `docs/engine-plan.md`. Usulan di §5 masih usulan sampai Rafee memutuskan.

Pertanyaan: bagaimana startup dan tim produk yang menjalankan agent untuk pengguna nyata merancang harness dan eval suite, menurut tulisan mereka sendiri? Lalu, apa artinya untuk Thya (1 builder, VPS 4 GB, final 10 Nov 2026)?

Cara membaca label:
- **Fakta**: isi tulisan sumber, dengan URL dan tanggal terbit. Angka adalah angka yang dilaporkan penulis. Sebagian besar sumber adalah blog perusahaan tentang produknya sendiri, jadi angka itu klaim perusahaan dan tidak diaudit pihak ketiga.
- **Inferensi**: kesimpulan saya dari fakta, belum diuji di Thya.
- **Usulan**: rekomendasi, berlabel **untuk final** atau **Roadmap**.

Semua sumber dibaca dari halaman aslinya pada 2026-10-25 lewat WebFetch. Ringkasan pihak ketiga (ZenML, ByteByteGo, dan sejenisnya) hanya dipakai untuk menemukan tulisan asli dan tidak dikutip sebagai bukti.

## Ringkasan

1. Pola yang paling sering muncul: kegagalan nyata yang sudah dianotasi manusia dijadikan kasus regression. Sierra (2024), Decagon (2025), Intercom (2026), dan Notion (Braintrust) menulis alur yang sama. Thya sudah merencanakannya untuk uji coba 7–9 Nov, tapi belum punya alat untuk mengubah satu trace menjadi satu kasus.
2. Judge LLM yang belum dikalibrasi hampir tidak berguna. Kappa judge Shopify mulai di 0,02 dan baru naik ke 0,61 (batas atas manusia 0,69). Fin dan Hex sama-sama menulis bahwa judge mereka terlalu keras. Keputusan Thya untuk tidak memakai judge sebagai gate (Q5, Q10) sejalan dengan ini.
3. Semua tim yang punya trafik besar menganggap eval offline belum cukup dan memakai A/B atau rollout bertahap. Thya belum punya trafik, jadi bagian ini Roadmap. Yang bisa diambil sekarang adalah disiplin di sekitarnya: versi yang terkunci per rilis, perbandingan kandidat vs baseline dengan input yang sama, dan aturan rilis tetap.
4. Harness yang dijelaskan para penulis tetap sederhana: satu loop, sedikit tool, prefix prompt stabil, instruksi situasional disisipkan di akhir konteks atau di hasil tool. Cognition, yang dulu menulis "jangan bangun multi-agent", di 2026 hanya menerima pola dengan satu penulis dan agent lain sebagai pemberi masukan.
5. Celah Thya yang paling murah untuk ditutup sebelum final: run eval belum mencatat model, commit, dan hash prompt; belum ada perbandingan run kandidat vs baseline per kasus; format WhatsApp masih dijaga lewat aturan prompt, padahal bisa dibetulkan kode.

## 1. Sumber

Dua puluh satu tulisan primer. Kolom "Jenis" membedakan blog engineering, tulisan produk, dan tulisan praktisi.

| # | Organisasi | Judul | Tanggal | Jenis | URL |
|---|---|---|---|---|---|
| S1 | Sierra (support) | The Agent Development Life Cycle | 2024-06-03 | Produk | https://sierra.ai/blog/agent-development-life-cycle |
| S2 | Sierra | τ-bench is shaping the development and evaluation of agents | 2025-03-18 | Riset | https://sierra.ai/blog/tau-bench-shaping-development-evaluation-agents |
| S3 | Hamel Husain (praktisi, kasus Rechat) | Your AI Product Needs Evals | 2024-03-29 | Praktisi | https://hamel.dev/blog/posts/evals/ |
| S4 | Hamel Husain | A Field Guide to Rapidly Improving AI Products | 2025-03-24 | Praktisi | https://hamel.dev/blog/posts/field-guide/ |
| S5 | Eugene Yan | An LLM-as-Judge Won't Save The Product, Fixing Your Process Will | 2025-04 | Praktisi | https://eugeneyan.com/writing/eval-process/ |
| S6 | Amp (Sourcegraph) | How to Build an Agent | 2025-04-15 | Engineering | https://ampcode.com/notes/how-to-build-an-agent |
| S7 | Cognition (Devin) | Don't Build Multi-Agents | 2025-06-12 | Engineering | https://cognition.com/blog/dont-build-multi-agents |
| S8 | Manus | Context Engineering for AI Agents: Lessons from Building Manus | 2025-07-18 | Engineering | https://manus.im/blog/Context-Engineering-for-AI-Agents-Lessons-from-Building-Manus |
| S9 | Decagon (support) | The future of AI agents is test-driven | 2025-07-23 | Produk | https://decagon.ai/blog/the-future-of-ai-agents-is-test-driven |
| S10 | Shopify (Sidekick, asisten merchant) | Building production-ready agentic systems: Lessons from Shopify Sidekick | 2025-08-26 | Engineering | https://shopify.engineering/building-production-ready-agentic-systems |
| S11 | Cursor | Improving Cursor Tab with online RL | 2025-09-12 | Engineering | https://cursor.com/blog/tab-rl |
| S12 | Decagon | Decagon Simulations | 2025-09-23 | Produk | https://decagon.ai/blog/decagon-simulations |
| S13 | Cursor | Improving agent with semantic search | 2025-11-06 | Engineering | https://cursor.com/blog/semsearch |
| S14 | Vercel (v0) | How we made v0 an effective coding agent | 2026-01-07 | Engineering | https://vercel.com/blog/how-we-made-v0-an-effective-coding-agent |
| S15 | Replit | Decision-Time Guidance: Keeping Replit Agent Reliable | 2026-01-20 | Engineering | https://replit.com/blog/decision-time-guidance |
| S16 | Cognition | Multi-Agents: What's Actually Working | 2026-04-22 | Engineering | https://cognition.com/blog/multi-agents-working |
| S17 | Hex (agent data) | How we built a lab to evaluate data agents | 2026-05-22 | Engineering | https://hex.tech/blog/evaluate-data-agents/ |
| S18 | Kunal Ganglani (praktisi WhatsApp) | WhatsApp AI Agent: 5 Production Walls Beyond the Tutorial | 2026-07-01, diperbarui 2026-10-17 | Praktisi | https://kunalganglani.com/blog/whatsapp-ai-agent-production-guide |
| S19 | Intercom (Fin) | Announcing Evals and Releases | 2026-08-13 | Produk | https://www.intercom.com/blog/announcing-evals-and-releases/ |
| S20 | Fin (Intercom) | Why not just ship it? | 2026-08-28 | Engineering | https://ideas.fin.ai/p/why-not-just-ship-it |
| S21 | Notion, ditulis Braintrust | Notion customer story | Tanpa tanggal (halaman © 2026) | Cerita pelanggan vendor | https://braintrust.dev/blog/notion |

Yang dicari tapi tidak dipakai:
- DoorDash, "Path to high-quality LLM-based Dasher support automation" (2024-09-17). Halaman asli membalas HTTP 403 di dua domain. Angka "halusinasi turun 90%" hanya ada di ringkasan pihak ketiga, jadi tidak dikutip.
- Ramp Policy Agent. Tidak ditemukan tulisan engineering asli; yang ada ringkasan ZenML dan halaman dukungan Ramp yang berisi klaim pemasaran.
- Agent WhatsApp dari startup dengan tulisan eval yang serius tidak ditemukan. S18 adalah satu-satunya tulisan praktisi WhatsApp yang cukup konkret, dan penulisnya tidak menjelaskan agent spesifik yang ia bangun sendiri. Bagian WhatsApp di dokumen ini lemah karena itu.

## 2. Catatan per tulisan

Setiap catatan berisi masalah, praktik konkret, angka, dan pelajaran pahit. Semua isi adalah Fakta dari sumber, kecuali yang ditandai Inferensi.

### Agent support pelanggan

**S1 Sierra, ADLC (2024-06-03).** Masalahnya: perilaku LLM tidak deterministik, sementara agent memproses retur dan perubahan paket berlangganan. Praktiknya: tujuan dan "deterministic guardrails that the agent cannot cross" dideklarasikan di SDK; setiap rilis adalah snapshot yang tidak bisa diubah (kode, prompt, versi model, snapshot knowledge base), jadi bisa rollback dan A/B; tim CX meninjau sampel percakapan setiap hari dan menganotasi keputusan, nada, dan pengetahuan; setiap percakapan yang dianotasi menjadi tes regression yang disimulasikan terhadap API tiruan, ribuan tes jalan paralel sebelum setiap rilis. Angka: jutaan konsumen per bulan. Pelajaran: kegagalan yang dianotasi diubah jadi tes supaya kesalahan yang sama tidak terulang; aksi berisiko tinggi dijaga aturan deterministik, bukan prompt.

**S2 Sierra, τ-bench (2025-03-18).** Masalahnya: eval satu kali tidak menangkap inkonsistensi. Praktiknya: `pass^k`, dan reward dari state database akhir. Angka: agent berbasis GPT-4 awalnya < 50% tugas berhasil dan sekitar 25% kalau tugas yang sama diulang 8 kali; model terbaik kini > 80% `pass^1` di domain retail. Pelajaran: kegagalan yang sering muncul adalah mengikuti kebijakan tertulis secara ketat, input user yang ambigu, dan pemulihan dari error di tengah tugas. Tulisan ini tidak menjelaskan alur internal Sierra.

**S9 Decagon, test-driven (2025-07-23).** Masalahnya: perubahan kecil di logika, prompt, atau knowledge diam-diam mengubah jawaban, dan tim baru tahu setelah pelanggan kena. Praktiknya berlapis: preview percakapan saat membangun, unit test (sesuai merek dan kebijakan, tidak mengarang atau menghilangkan info), integration test (tool yang benar, data yang benar, eskalasi), simulasi terjadwal untuk menangkap regresi dan drift, trace eksekusi per langkah. Tidak ada angka.

**S12 Decagon, Simulations (2025-09-23).** Praktiknya: percakapan dengan user tiruan per persona; persona dan intent bisa dibuat otomatis dari transkrip kegagalan AI atau agen manusia; tim bisa mengatur metadata, keluaran tool, dan panjang percakapan, lalu mengulang simulasi untuk mengecek konsistensi; hasil per simulasi biner pass/fail dengan trace. Dijalankan sebelum go-live, setelah peluncuran, dan sebelum perubahan besar pada prosedur atau knowledge. Pelajaran: tes statis tetap berguna untuk memastikan perbaikan tertentu, tapi cepat basi saat agent berubah; voice butuh tes sendiri karena salah transkripsi dan jeda antar-giliran. Tidak ada angka akurasi atau biaya simulasi.

**S19 Intercom, Evals and Releases (2026-08-13).** Praktiknya: Eval mengelompokkan simulasi per tema (refund, aturan eskalasi, nada); setiap simulasi berisi pelanggan tiruan, data yang boleh diakses Fin, dan kriteria; penilaian gabungan cek deterministik dan judge LLM; satu kriteria gagal = simulasi gagal. Release membungkus perubahan konten dan prosedur, dites dengan Eval, lalu dipublikasikan sekaligus, dinaikkan bertahap, atau di-A/B; bisa dijeda dan di-rollback. Monitor memeriksa setiap percakapan langsung, dan percakapan yang gagal bisa diubah jadi simulasi baru. Angka: pada skala besar, regresi 1% bisa mengenai ribuan percakapan per hari. Pelajaran: keberhasilan bukan hanya jawaban akhir, tapi juga mengikuti prosedur, memakai data yang benar, menyerahkan ke manusia di saat yang tepat, dan nada.

**S20 Fin, "Why not just ship it?" (2026-08-28).** Alurnya: baca data sendiri, backtest offline dengan memutar ulang beberapa ribu percakapan nyata ke produksi dan kandidat dengan input identik, nilai dengan cek deterministik dan judge (grounding, mengikuti panduan, eskalasi), A/B dengan resolution rate sebagai metrik utama, rollout dari 0% ke 1% lalu naik, monitoring pasca-rilis dengan judge dan review manusia, kegagalan baru masuk ke backtest. Angka: sekitar 200 deploy produksi per hari; resolution rate sekitar 30% saat peluncuran awal 2023 menjadi 76%; CSAT 57% menjadi 75%; A/B dijalankan dalam minggu penuh dengan ukuran sampel dari power analysis; satu blok karena halusinasi menambah sekitar dua bulan kerja. Pelajaran pahit:
- Memberi Fin riwayat chat penuh memperbaiki konteks tapi menaikkan halusinasi, dan rilisnya diblok.
- Perubahan yang menang di resolution rate pernah ditahan karena panel judge menemukan masalah di percakapan sekitarnya, misalnya serah terima ke manusia yang lebih buruk.
- Judge terlalu keras soal mengikuti panduan; label manusia menunjukkan Fin mengikuti maksud aturan lebih baik dari yang dinilai judge.
- Pakai ensemble judge dari keluarga model berbeda, anggap ketidaksepakatan sebagai sinyal, kalibrasi berkala dengan label manusia. "Any figure that looks interesting or different is usually wrong."
- Satu metrik utama ditetapkan sebelum tes. Dua aturan tetap: jangan pernah sengaja merilis regresi resolution, jangan pernah sengaja menaikkan halusinasi.

### Agent bisnis dan data

**S10 Shopify Sidekick (2025-08-26).** Masalahnya: jumlah tool tumbuh dari beberapa ke puluhan, dan system prompt menjadi "Death by a Thousand Instructions". Praktiknya:
- Pita jumlah tool: 0–20 batasnya jelas, 20–50 batas mulai kabur, 50+ ada banyak cara untuk tugas yang sama.
- Instruksi just-in-time: panduan dikembalikan bersama data tool, tidak ditumpuk di system prompt. Alasan yang ditulis: panduan lokal, cache prompt tidak rusak, varian per flag atau model.
- Dataset eval "Ground Truth Sets" dari sampel percakapan merchant nyata, lebih disukai daripada golden set kurasi yang mencoba menebak semua interaksi.
- Minimal tiga ahli produk melabeli percakapan; kesepakatan diukur dengan Cohen's kappa, Kendall tau, Pearson; kesepakatan antar-manusia dianggap batas atas judge. Validasi: manusia ditukar dengan judge secara acak; kalau orang tidak bisa membedakan, judge dianggap layak.
- Simulator merchant berbasis LLM memutar ulang tujuan dari percakapan nyata ke sistem kandidat sebelum rilis.

Angka: kappa judge 0,02 menjadi 0,61 (manusia 0,69); akurasi validasi sintaks sekitar 93% menjadi 99%; korelasi judge 0,66 menjadi 0,75. Pelajaran: judge "Rate this 0-10" memberi rasa aman palsu; reward hacking saat RL berupa model menjelaskan kenapa tidak bisa membantu alih-alih mencoba, filter tag sebagai jalan pintas, dan ID atau enum karangan.

**S17 Hex, lab eval agent data (2026-05-22).** Masalahnya: "Easy questions look hard. Hard questions look easy." Bug analitik diam, tidak ada linter atau test suite, dan untuk setiap jawaban benar ada banyak jawaban masuk akal yang salah tipis. Performa agent lebih ditentukan konteks yang bisa diakses daripada prompt atau model. Praktiknya:
- Alat internal yang awalnya hanya penampil trace, lalu berkembang menjadi bangku eval dengan run terjadwal dan perbandingan berpasangan kandidat vs baseline harian.
- Rubrik deterministik, judge, atau campuran (contoh `ToolEfficiency`, `SemanticLayerUsage`).
- Set eval kecil buatan tangan yang diperluas dengan menambah rubrik.
- Usaha sintetis "Shorelane Commerce" dengan utang data realistis (ID pelanggan hilang, akuisisi belum digabung, lima kolom "revenue").

Angka: sekitar 30.000 baris generator dan model dbt, enam tahun data; judge menerima selisih 2,03% vs 2,04% di 35% kasus; 10 orang menjalankan 25 eksperimen terhadap satu baseline. Pelajaran: judge "biased towards being overly harsh"; eval yang terlalu pintar (jawaban hampir benar untuk menjebak metode salah) kadang diterima judge, jadi sebagian ditarik; kode khusus eval bocor ke kode produk (`DANGEROUS_rawModelConfigOverride`).

**S21 Notion lewat Braintrust (tanpa tanggal, cerita pelanggan vendor).** Praktiknya: sekitar 80% kerja tim AI adalah menilai feedback dan trace; kasus ketika model tidak menjawab dalam bahasa yang diharapkan dikumpulkan lewat pencarian lalu dijadikan dataset; data specialist melabeli contoh langsung di layar eval; eval regression (apa yang rusak dibanding model lama) dipisah dari eval frontier (apa yang berubah dengan model baru). Angka: 70 engineer; model frontier baru di-deploy dalam < 24 jam. Pelajaran: cari kegagalan "jarum di tumpukan jerami" yang mengenai sedikit pelanggan penting, karena metrik umum tidak melihatnya; rencanakan membangun ulang sistem kira-kira tiap enam bulan.

### Agent coding

**S6 Amp, "How to Build an Agent" (2025-04-15).** Klaim: agent adalah "an LLM, a loop, and enough tokens", kurang dari 400 baris. Error tool tidak fatal; error dikembalikan ke model sebagai hasil tool bertanda error, termasuk "tool not found", supaya model bisa mencoba cara lain.

**S7 Cognition, "Don't Build Multi-Agents" (2025-06-12).** Dua prinsip: bagikan konteks dan trace penuh, bukan pesan per pesan; aksi membawa keputusan implisit, dan keputusan yang bertabrakan menghasilkan hasil buruk. Contoh: sub-agent yang membangun latar dan burung Flappy Bird membuat aset yang tidak cocok. Cognition melatih model kecil khusus untuk memadatkan riwayat. Pelajaran: kompresi riwayat berguna tapi sulit dibuat benar.

**S16 Cognition, "Multi-Agents: What's Actually Working" (2026-04-22).** Yang bekerja: penulisan tetap satu jalur, agent tambahan hanya menyumbang penilaian. Reviewer dengan konteks bersih menangkap rata-rata 2 bug per PR, sekitar 58% berat; berbagi konteks dengan reviewer justru merugikan. Model kecil yang memanggil model besar saat sulit mempersempit selisih kualitas. Pelajaran: model utama yang lemah tidak tahu kapan harus eskalasi; jaringan agent tanpa struktur "mostly a distraction".

**S11 Cursor Tab, online RL (2025-09-12).** Sinyal produksi (diterima/ditolak) dipakai langsung sebagai reward; checkpoint baru dirilis beberapa kali sehari, satu siklus 1,5–2 jam. Angka: > 400 juta request per hari; saran 21% lebih sedikit dengan accept rate 28% lebih tinggi. Pelajaran: tahu kapan diam sama pentingnya dengan kualitas saran.

**S13 Cursor, semantic search (2025-11-06).** Eval offline (Cursor Context Bench) dan A/B online dengan model yang sama. Angka: offline rata-rata +12,5% akurasi (6,5%–23,5% per model); online retensi kode +0,3% secara umum, +2,6% di codebase ≥ 1.000 file; tanpa semantic search, permintaan lanjutan bernada tidak puas 2,2% lebih tinggi. Pelajaran: efek offline jauh lebih besar dari efek online karena tidak semua request butuh fitur yang diuji.

**S14 Vercel v0 (2026-01-07).** Masalahnya: kode LLM bisa salah sampai sekitar 10% generasi. Metrik utama: persentase generasi yang merender situs yang jalan. Praktiknya: prompt dinamis yang menyuntik versi SDK terkini dengan teks yang konsisten supaya cache kena; "LLM Suspense" yang mengganti teks saat streaming (import, URL panjang jadi placeholder, ikon yang tidak ada dipetakan ke yang terdekat dalam < 100 ms tanpa panggilan model); autofixer deterministik (AST) dan autofixer model kecil, < 250 ms. Angka: perbaikan real-time menaikkan tingkat sukses "double-digit". Pelajaran: sebagian error lebih murah dibetulkan kode setelah output daripada dicegah lewat prompt.

**S15 Replit, decision-time guidance (2026-01-20).** Masalahnya: kegagalan bertumpuk di trajektori panjang, aturan statis di system prompt tidak menggeneralisasi, dan aturan di tengah konteks kehilangan pengaruh. Praktiknya: classifier murah per iterasi memilih instruksi mikro dari bank yang disaring dari kegagalan produksi; instruksi disisipkan di akhir trace sebelum generasi berikutnya dan tidak disimpan di riwayat; core prompt tidak berubah. Angka: cache tetap utuh, dan penulis menyebut biaya 90% lebih rendah dibanding mengubah system prompt; nudge di akhir trace menghasilkan 15% lebih banyak eksekusi tool paralel dibanding di system prompt; manfaat turun setelah 3–4 pengingat sekaligus dan kadang negatif. Pelajaran: menumpuk semua pengingat di akhir konteks mengulang masalah prompt gemuk; konsultasi ke model lain mengurangi bias memilih jalannya sendiri.

### Praktisi eval

**S3 Hamel, "Your AI Product Needs Evals" (2024-03-29), kasus Rechat.** Masalahnya: asisten Lucy mandek setelah perbaikan prompt awal; memperbaiki satu kegagalan memunculkan yang lain. Praktiknya: tiga level (assertion murah di setiap perubahan, review manusia dan judge yang diselaraskan, A/B untuk produk matang); trace dicatat dulu; penampil data khusus. Angka: ratusan unit test; penyelarasan judge dengan 25–50 contoh per putaran. Pelajaran: "Remove ALL friction from looking at data"; "Your pass rate is a product decision".

**S4 Hamel, Field Guide (2025-03-24).** Error analysis disebut aktivitas dengan imbal hasil tertinggi. Angka kasus Nurture Boss: penanganan tanggal gagal 66% dan sukses naik dari 33% ke 95% setelah diperbaiki; tiga masalah menyebabkan > 60% kegagalan. Kritik tertulis dipakai sebagai contoh few-shot menaikkan kesepakatan judge-manusia sekitar 15–20%. Pelajaran: metrik generik seperti "helpfulness score" menyesatkan; kriteria eval berubah setelah orang membaca output, jadi tidak bisa ditetapkan penuh di awal.

**S5 Eugene Yan (2025-04).** Eval adalah proses ilmiah: amati data, anotasi, hipotesis, eksperimen terhadap baseline, ukur, ulangi. Dataset anotasi sebaiknya seimbang sekitar 50:50 lulus dan gagal. Pelajaran: kalau tim tidak meninjau output dan feedback pelanggan, "automated evaluators won't save our product".

### WhatsApp

**S18 Kunal Ganglani (2026-07-01, diperbarui 2026-10-17).** Lima hambatan: batas messaging per tier (tier 1 = 250 user unik per 24 jam, pesan di atas batas gagal tanpa error), biaya, state percakapan, risiko banned karena quality rating, dan larangan memakai API tidak resmi. Praktik yang disarankan: webhook dipisah dari pemrosesan LLM lewat antrean; batas 3–5 balasan per user per menit; jalur eskalasi ke manusia; pantau quality rating. Catatan: S18 menulis bahwa service message gratis. Itu bertentangan dengan Fakta di `docs/engine-plan.md` §2 (sejak 2026-10-01 gratis hanya 1.000 per nomor per bulan, dari halaman pricing Meta). Halaman Meta adalah pemilik fakta ini; S18 tidak dipakai untuk soal biaya. Batas tier 250 juga belum dicek ke dokumentasi Meta.

## 3. Sintesis

### 3.1 Pola yang berulang

| Pola | Sumber | Bukti terkuat |
|---|---|---|
| Kegagalan nyata yang dianotasi menjadi tes regression | S1, S12, S19, S20, S21, S4 | Sierra dan Intercom menulis alur trace → anotasi → simulasi → tes rilis berikutnya |
| Manusia membaca data sebelum menulis evaluator | S3, S4, S5, S20, S21 | Fin menaruh "Look at the data!" sebagai langkah pertama; Notion 80% waktu tim di trace |
| Judge dikalibrasi terhadap label manusia, dan batas atasnya kesepakatan antar-manusia | S10, S20, S17, S4, S5 | Shopify kappa 0,02 → 0,61 vs manusia 0,69 |
| Penilaian biner per kriteria, bukan skala | S3, S4, S12, S19, S10 | Intercom: satu kriteria gagal = simulasi gagal; Shopify menolak "0-10" |
| Perbandingan kandidat vs baseline dengan input identik | S17, S20, S13 | Fin memutar ulang ribuan percakapan ke produksi dan kandidat; Hex baseline harian |
| Rilis sebagai paket versi yang terkunci dan bisa di-rollback | S1, S19, S20 | Sierra: kode, prompt, versi model, snapshot knowledge |
| Konsistensi diukur dengan pengulangan | S2, S12 | τ-bench `pass^k`; Decagon mengulang simulasi untuk cek konsistensi |
| Prefix prompt stabil, instruksi situasional disisipkan di akhir atau lewat hasil tool | S8, S10, S14, S15 | Replit: biaya 90% lebih rendah; Manus: input:output sekitar 100:1, cache 10× lebih murah |
| Satu loop, satu penulis | S6, S7, S16, S10 | Cognition 2026 masih menolak swarm penulis paralel |
| Error tool dikembalikan ke model sebagai hasil, tidak disembunyikan | S6, S8 | Manus: jejak gagal di konteks membuat model tidak mengulang kesalahan |
| Sebagian kesalahan dibetulkan kode setelah output | S14, S10 | v0 autofixer < 250 ms; Shopify cek sintaks prosedural sebelum skor judge |

### 3.2 Pola yang saling bertentangan

| Isu | Posisi A | Posisi B | Bacaan untuk Thya (Inferensi) |
|---|---|---|---|
| Sumber dataset eval | Sampel percakapan nyata lebih baik dari golden set kurasi (S10) | Set kecil buatan tangan di atas usaha sintetis (S17) | Thya belum punya percakapan nyata, jadi posisinya seperti Hex sampai uji coba 7–9 Nov. Setelah itu, kasus dari trace nyata didahulukan (sudah di ritual §5.3 engine-plan) |
| Tool yang tidak tersedia | Jangan ubah daftar tool di tengah tugas; masker logit (S8) | Hapus dari skema supaya model tidak menjanjikannya (ai-engine, engine-plan A7) | Konflik nyata. Lihat U10 |
| Judge sebagai alat utama | Judge khusus per aspek, bahkan sebagai reward RL (S10), panel judge memblok rilis (S20) | Judge tidak menyelamatkan produk tanpa proses (S5); judge terlalu keras dan angkanya belum bisa dipercaya (S17, S20) | Sejalan dengan Q5/Q10: angka dinilai kode, judge hanya nada dan advisory |
| Kompresi riwayat | Model khusus pemadat riwayat (S7) | Kompresi harus bisa dipulihkan, simpan path/URL (S8); riwayat penuh malah menaikkan halusinasi (S20) | B1 engine-plan (ringkasan tanpa angka, fakta dari tabel) memenuhi kedua sisi. Temuan S20 mendukung window pendek |
| Multi-agent | Jangan (S7) | Reviewer konteks bersih dan "smart friend" bekerja (S16); konsultasi model lain saat buntu (S15) | Tidak relevan untuk final. Keputusan tanpa model kedua tetap |
| Offline vs online | Backtest offline + judge cukup cepat untuk memblok rilis (S20) | Efek offline 12,5% menyusut jadi 0,3% di online (S13); A/B tidak tergantikan (S20) | Thya hanya bisa offline. Angka eval di paper harus ditulis sebagai offline dan sintetis |
| Target lulus | "Pass rate is a product decision" (S3) | Fin: tidak pernah sengaja menaikkan halusinasi (S20) | Q5 (`pass^5` = 100% untuk angka) adalah keputusan produk yang sah menurut kedua sisi |

## 4. Dibandingkan dengan `docs/engine-plan.md`

### 4.1 Sudah dilakukan

| Praktik | Sumber luar | Di Thya |
|---|---|---|
| Satu loop, sedikit tool, batas langkah | S6, S7, S10 | Satu agent, `isStepCount(5)`, budget `queryMetric` 4 (engine-plan §6.1, 27 Okt) |
| Prefix stabil, waktu disisipkan di pesan terakhir | S8, S15 | `agent/prompt.ts` `withTurnContext` (A1). Cache 96–99% di eval |
| `pass^k` dengan k berbeda per risiko | S2 | k = 5 untuk angka, 3 sisanya; status PASS/BLOCKED/REVIEW |
| Grader kode untuk hal objektif, judge hanya untuk nada | S5, S17, S20 | G1–G5 kode, G6 judge advisory (Q5, Q10) |
| Cek deterministik setelah output | S14, S10 | `postcheck.ts` + perilaku Q2 di runtime |
| Error tool sebagai hasil berstatus | S6, S8 | Union `status` (A4); prompt melarang mengulang argumen yang sama |
| Baca transkrip sebelum percaya skor | S3, S4, S20 | Grader "uang di laci" dan "10.50" diperbaiki setelah transkrip dibaca (§5.4, §6.1) |
| Fixture injeksi | S12 (guardrail), SuperNalar | `prompt-injection-figure` |
| Eval regression vs capability dipisah | S21 (regression vs frontier) | `suite: "regression" | "capability"` |
| Trace per giliran di Postgres | S9, S1 | `agent_turns` + `agent_steps`, `x-trace-id` |
| Antrean antara webhook dan LLM, rate limit per nomor | S18 | pg-boss `key_strict_fifo`, A9 (rencana 30 Okt–1 Nov) |

### 4.2 Yang kurang

Fakta dari kode yang dibaca 2026-10-25:
- `apps/api/eval/run.ts` menulis ringkasan dengan `status`, `passK`, latensi, cache, dan `actions`, tapi tidak mencatat id model, commit git, atau hash prompt dan skema tool. Dua run tidak bisa dipastikan berbeda di bagian mana.
- Belum ada perintah yang membandingkan dua run per kasus. Engine-plan §5.3 sudah menulis aturannya (proporsi lulus per kasus), tapi belum ada script-nya.
- `agent_turns` tidak punya kolom versi prompt atau model. Trace uji coba tidak bisa dikaitkan ke versi yang menjawab.
- Belum ada jalur dari `traceId` uji coba ke kasus di `eval/cases.ts`.
- 17 kasus semuanya satu giliran atau dua giliran tanpa write. Kasus pemulihan dari error tool belum ada. Engine-plan §6.1 juga mencatat bahwa pesan "budget habis" tidak pernah dibaca model karena jatuh di langkah terakhir.
- Format WhatsApp dijaga aturan prompt (`prompt.ts` baris 26). Temuan `**Rp4.100.000**` (§6.1) menunjukkan aturan itu bocor, dan G5 belum memeriksanya.
- System prompt sekarang punya 15 aturan, dan beberapa ditambahkan setelah baseline 25 Okt. Belum ada catatan aturan mana yang lahir dari kasus mana.

### 4.3 Tidak relevan untuk skala Thya sekarang

| Praktik | Sumber | Alasan |
|---|---|---|
| A/B, rollout bertahap, power analysis | S13, S19, S20 | Tidak ada trafik sebelum final. Uji coba hanya beberapa pemilik warung |
| RL dari sinyal produksi, GRPO, fine-tune autofixer | S10, S11, S14 | Butuh volume dan infrastruktur training; model tetap DeepSeek via Netra |
| Multi-agent, reviewer, "smart friend" | S16, S15 | Bertentangan dengan keputusan satu agent tanpa model kedua |
| Usaha sintetis besar (30.000 baris generator) | S17 | Kopi Senja + 2–3 usaha seed (Q10) sudah cukup untuk 60 kasus |
| Classifier untuk memilih instruksi mikro | S15 | Satu panggilan model tambahan per giliran. Bentuk murahnya (instruksi lewat hasil tool) tetap bisa dipakai, lihat U5 |
| Masker logit per state | S8 | Butuh kontrol decoding yang tidak tersedia lewat Netra |
| Platform eval vendor (Braintrust, Langfuse) | S21 | Keputusan tanpa dependency baru dan VPS 4 GB (engine-plan §4.3) |

## 5. Usulan

Urutan = prioritas. Biaya adalah perkiraan saya (Inferensi). Usulan untuk final dipilih karena kecil dan tidak mengubah keputusan Q1–Q10.

| # | Usulan | Label | Sumber | Alasan |
|---|---|---|---|---|
| U1 | Setiap run eval mencatat id model, commit git (plus tanda kalau ada perubahan belum di-commit), dan hash SHA-256 dari system prompt + skema tool di `summary.json`. Kolom yang sama (`model`, `promptHash`) ditambahkan ke `agent_turns` | untuk final | S1, S19, S20 | Tanpa ini, klaim "eval naik setelah perubahan X" di paper tidak bisa dibuktikan, dan trace uji coba tidak bisa dikaitkan ke versi yang menjawab. Perkiraan < 1 jam |
| U2 | Script `bun run eval:compare <runA> <runB>` yang mencetak per kasus: lulus/total di A dan B, kasus yang turun, dan kasus yang naik. Kasus regression yang turun membuat status BLOCKED | untuk final | S17, S20, engine-plan §5.3 | Aturan perbandingan sudah diputuskan di §5.3, tapi belum ada alatnya. Setiap perubahan prompt sampai 9 Nov butuh jawaban "apa yang turun" |
| U3 | `report.md` per run yang hanya berisi percobaan gagal: pesan user, panggilan tool + argumen, hasil tool, balasan, cek yang gagal. Dibaca Rafee dan Claude, bukan dashboard | untuk final | S3, S4, S17 | Ritual "baca 10 transkrip gagal" dan 20–30 label untuk kalibrasi judge (B9) lebih cepat kalau tidak perlu membuka JSONL mentah. Hex dan Rechat sama-sama mulai dari penampil trace |
| U4 | Format WhatsApp dibetulkan kode di `channels/whatsapp`: `**x**` → `*x*`, heading dan tabel Markdown dibuang atau diratakan, lalu G5 memeriksa keluaran setelah formatter | untuk final | S14 | Kesalahan format bersifat mekanis. Kode memperbaikinya setiap kali; aturan prompt tidak (temuan `**Rp4.100.000**`). Formatter memang sudah direncanakan di slot 30 Okt–1 Nov, jadi ini memperluas pemilik yang sama |
| U5 | Aturan baru dari kegagalan ditaruh di hasil tool yang relevan kalau aturannya terkait tool (contoh: status `not_recorded` untuk kas/stok membawa kalimat panduan), bukan ditambah ke system prompt. Setiap aturan di `prompt.ts` diberi komentar satu baris berisi id kasus eval asalnya | untuk final (aturan kerja, bukan refactor) | S10, S15 | Shopify dan Replit sama-sama menulis bahwa prompt yang terus ditambah aturan kehilangan kepatuhan. Replit mengukur manfaat turun setelah 3–4 pengingat sekaligus (itu pengingat yang disisipkan, bukan aturan system prompt, jadi penerapannya ke Thya masih Inferensi). Komentar id kasus membuat aturan bisa dihapus dengan aman |
| U6 | Selama uji coba 7–9 Nov, semua percakapan dibaca, bukan sampel. Query harian atas `agent_turns` diurutkan dari `action` ≠ `ok`, `ungrounded` tidak kosong, dan `error`. Setiap kegagalan diberi satu label biner + kritik satu kalimat | untuk final | S1, S4, S20 | Sierra meninjau sampel tiap hari pada jutaan percakapan; Thya dengan beberapa pemilik bisa membaca 100%. Ini sumber kasus regression paling berharga sebelum final |
| U7 | Satu langkah dari trace ke kasus: script `eval:from-trace <traceId>` yang membuat kerangka `EvalCase` (pesan user, tool yang dipanggil, `now` giliran itu) untuk dilengkapi manual, dengan anonimisasi sesuai Q10 | untuk final | S1, S12, S19 | Tanpa alat, kegagalan uji coba 7–9 Nov tidak akan sempat jadi kasus sebelum freeze |
| U8 | Tambahan status rilis: run kandidat BLOCKED kalau jumlah intervensi Q2 (kalimat dibuang, regenerate, template) naik dibanding baseline, walau semua kasus lulus | untuk final | S20 | Versi Thya dari aturan Fin "jangan pernah sengaja menaikkan halusinasi". Intervensi Q2 adalah angka karangan yang tertangkap; kenaikan berarti model makin sering mengarang walau jawaban akhirnya bersih. Data sudah ada di `totals.actions` |
| U9 | 3–4 kasus pemulihan: tool membalas error (periode tidak valid, budget habis, data kosong) dan grader memeriksa jawabannya jujur tanpa angka. Sekalian betulkan urutan budget vs batas langkah supaya pesan "budget habis" benar-benar terbaca model | untuk final | S2, S6, S8 | τ-bench menyebut pemulihan dari error sebagai mode gagal umum. Engine-plan §6.1 sudah mencatat bahwa jalur budget belum pernah teruji di model sungguhan |
| U10 | Putuskan konflik A7 (hapus tool dari skema) vs Manus (daftar tool tetap). Usulan uji: dua varian di eval, ukur `cachedShare` dan kasus "janji kemampuan yang tidak ada" | OPEN, Roadmap kalau tidak sempat | S8, engine-plan A7 | Dengan 4–6 tool, efek cache kemungkinan kecil (Inferensi), tapi bukti dari kedua arah belum diukur di Thya. Saran sementara: daftar tool tetap per usaha, dan tool yang belum bisa jalan membalas status `not_ready` dengan panduan (sejalan dengan U5) |
| U11 | Simulasi user dengan persona dari kegagalan nyata (pemilik yang menjawab "iya deh", mengoreksi angka, mengirim dua pesan beruntun), dijalankan k kali | Roadmap | S10, S12, S19 | Ini cara semua vendor support menguji alur multi-giliran seperti konfirmasi write. Butuh kegagalan nyata dulu dan menambah biaya per run; engine-plan §4.3 sudah menundanya |
| U12 | Judge kedua dari keluarga model lain, dan ketidaksepakatan antar-judge dilaporkan sebagai sinyal | Roadmap | S20 | Q10 sekarang hanya memakai Claude. Ensemble baru bernilai kalau judge sudah dipakai lebih luas dari nada |
| U13 | Sinyal implisit dari produksi: pemilik bertanya ulang hal yang sama, menulis "salah"/"kok beda", atau membatalkan draft setelah `Ya`. Dicatat per giliran sebagai kandidat kegagalan | Roadmap | S11, S13 | Cursor memakai permintaan lanjutan yang tidak puas sebagai metrik online. Untuk Thya ini cara murah menemukan kegagalan tanpa membaca semua percakapan saat pengguna sudah banyak |
| U14 | Rilis sebagai snapshot (prompt, skema tool, model, versi registry metrik) dengan rollback satu langkah, lalu rollout bertahap per usaha | Roadmap | S1, S19, S20 | Baru berguna saat ada lebih dari segelintir usaha. U1 adalah bagian murahnya untuk final |
| U15 | Pantau quality rating dan tier messaging nomor WhatsApp sebelum rekap terjadwal dikirim ke banyak usaha | Roadmap, perlu verifikasi | S18 | Rekap terjadwal (S4 business-features-plan) adalah pesan yang dimulai bisnis. Batas tier dan dampak blokir dari S18 belum dicek ke dokumentasi Meta |

## 6. Yang belum terverifikasi

- Semua angka di §2 adalah laporan perusahaan tentang produknya sendiri. Tidak ada yang diaudit pihak ketiga.
- Tanggal S5 hanya bulan (April 2025), dari blok sitasi di halaman. S21 tidak bertanggal.
- Apakah `activeTools` AI SDK 7 dengan provider Netra mengubah prefix yang di-cache belum dites (relevan untuk U10).
- Batas tier 250 user per 24 jam dan klaim "service message gratis" di S18 belum dicek ke dokumentasi Meta; klaim biaya bertentangan dengan engine-plan §2.
- Tulisan asli DoorDash dan Ramp tidak bisa dibaca (403 atau tidak ditemukan), jadi tidak dipakai.
