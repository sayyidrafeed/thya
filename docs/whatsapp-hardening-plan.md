# Rencana hardening dan fitur kanal WhatsApp

Draft 26 Okt 2026, untuk Rafee. Status: **Proposed**, belum ada yang diputuskan. Ukurannya satu: demo live final 10–11 Nov tidak boleh gagal, dan setiap klaim di paper harus bisa dibuktikan.

Dokumen ini disusun read-only dan tanpa memanggil Netra LLM. Sumbernya:

- kode `apps/api/src` di `main` 4f9a9ca,
- dua run eval yang tersimpan di `apps/api/eval/runs/` (25 Okt),
- server produksi (log `thya-api` 48 jam terakhir, tabel `pgboss.job`, `messages` dan `agent_turns`, semuanya dibaca lewat `thya-ops`),
- dokumen Meta yang diambil 26 Okt (tautannya di bagian Sumber).

## Temuan yang mengubah urutan kerja

1. **Belum ada trace WhatsApp asli.** (Confirmed) Tabel `messages` di produksi berisi 0 baris, dan log menulis "WhatsApp nonaktif". Kanal ini baru diuji dengan Graph API tiruan. Akibatnya, error analysis untuk rencana ini memakai transkrip eval. Analisis kegagalan di kanal nyata baru bisa dilakukan setelah nomor test bicara dengan Meta.
2. **Tidak ada proses yang menjalankan queue di produksi.** (Confirmed) Log produksi menulis "job di worker", padahal service `thya-worker` tidak ada. Begitu kredensial WhatsApp diisi dalam keadaan ini, webhook akan membalas 200 tapi tidak ada balasan yang terkirim. Koreksi atas draft pertama: 363 `schedule-tick` yang berstatus `created` bukan bukti tidak adanya worker. Tick memang tidak dikerjakan selama WhatsApp mati, siapa pun yang menjalankan queue.
3. **Inti webhook sudah kuat.** (Confirmed dari kode dan test) Bagian yang sudah aman:
   - verifikasi signature dari raw body,
   - dedupe dengan `wamid` sebagai primary key,
   - urutan per nomor lewat `key_strict_fifo`,
   - kunci balasan `reply:<wamid>`,
   - retry kirim dengan backoff,
   - pengecekan jendela 24 jam di jadwal.

   Risiko yang tersisa lebih banyak di sisi operasional dan di jalur yang belum diuji.
4. **Aturan Meta yang berubah baru-baru ini** (Confirmed dari dokumen Meta, perlu dikutip ulang dari halaman aslinya sebelum masuk paper):
   - Meta bisa mengirim ulang webhook sampai 7 hari, jadi duplikat dan pesan basi itu normal.
   - Mulai 1 Okt 2026, pesan utility di dalam jendela dan pesan service di atas 1.000 per bulan dikenai biaya.
   - Tanpa metode pembayaran, hanya kuota gratis yang terkirim.
   - URL media berlaku 5 menit, dan media id 7 hari.

## Backlog berperingkat

Peringkatnya mengikuti risiko demo yang dikurangi. P0 harus beres sebelum gladi. P1 menutup failure mode yang mungkin muncul saat demo. P2 berisi fitur yang muncul dari kegagalan nyata.

### P0: tanpa ini demo tidak jalan

| # | Masalah | Bukti | Usulan | Bukti selesai |
|---|---|---|---|---|
| 1 | Queue tidak dijalankan siapa pun | Log `thya-api`: "job di worker". Tidak ada service worker | Rafee mengisi `JOBS_IN_SERVER=1` (opsi cepat dari morning-handoff). Di kode, tambahkan peringatan saat boot kalau WhatsApp aktif tapi tidak ada yang menjalankan queue | Setelah WhatsApp aktif, `/health` menampilkan `jobs: "ok"` dan log menulis "job di server" (peringatan di kode: selesai 26 Okt) |
| 2 | Kanal belum pernah bicara dengan Meta | Handoff §Engine, `messages`=0 | Rafee mengisi kredensial dan webhook, lalu mendaftarkan nomor penguji. Setelah itu jalankan checklist E2E di bagian Verifikasi | Semua skenario E2E lulus di nomor test |
| 3 | `/health` selalu `{ok:true}` (selesai 26 Okt di kode, belum ter-deploy) | `server.ts:59` | Tambahkan pengecekan DB, status pg-boss, umur tick terakhir, dan flag WhatsApp aktif. Konfigurasi WhatsApp yang setengah terisi harus memunculkan error yang jelas, bukan diam-diam "nonaktif" (`env.ts`) | `curl /health` menampilkan keempatnya. Mematikan worker membuat health berubah merah dalam 2 menit |
| 4 | Template rekap dan pengingat belum ada | Env opsional, belum dicek di Meta | Ajukan dua template utility berbahasa Indonesia. Hanya wajib kalau demo menampilkan rekap terjadwal di luar jendela 24 jam | Template berstatus Approved di Meta, dan satu rekap di luar jendela sampai ke nomor test |

### P1: failure mode yang bisa muncul saat demo

Status 26 Okt: #5 sampai #11 sudah dikerjakan di kode dan diuji, tapi belum ter-deploy (lihat `docs/decisions.md`). Untuk #8, pesan yang telat lebih dari 6 jam dibalas satu kalimat tetap yang meminta kirim ulang.

| # | Masalah | Bukti | Usulan | Bukti selesai |
|---|---|---|---|---|
| 5 | Satu nomor bisa terkunci permanen | (Inferred) Di pg-boss 12.37.1, index unik `key_strict_fifo` mencakup state `failed`. Kalau percobaan terakhir kena `expireInSeconds: 180`, job jadi `failed`, padahal kode hanya menelan error yang dilempar (`jobs/index.ts:102`) | Pasang batas waktu total per job di bawah 180 detik, dan bersihkan atau laporkan job `failed` di queue ini | Test yang mensimulasikan expire di percobaan terakhir: pesan berikutnya dari nomor itu tetap dibalas |
| 6 | Deploy membunuh giliran yang sedang jalan | `server.ts` tidak punya handler SIGTERM, berbeda dengan `worker.ts:14` | Pasang `boss.stop()` dengan graceful shutdown di server ketika `JOBS_IN_SERVER=1` | Redeploy saat sedang mengetik: balasan tetap terkirim tepat sekali |
| 7 | Status callback dibuang | `inbound.ts:49-55` | Simpan `sent/delivered/read/failed` dan kodenya ke `outbound_messages`. Petakan tindakannya: 131047 → template, 131026 → catat dan berhenti, 131052 → minta kirim ulang media, 130429/131056 → mundur dulu | Replay fixture status `failed`: kodenya tersimpan dan ada log yang membawa trace id |
| 8 | Pesan basi diproses seperti pesan baru | `inbound.ts:60`, tidak ada pengecekan umur. Meta mengirim ulang sampai 7 hari | OPEN DECISION: abaikan pesan yang lebih tua dari X jam, atau jawab tanpa tool tulis | Replay fixture berumur 2 hari: perilakunya sesuai keputusan, dan tidak ada penjualan tercatat ganda |
| 9 | Log tidak membawa trace id | `trace.ts` hanya tersimpan di DB | Satu baris log terstruktur per giliran (traceId, hash wamid, latensi, hasil, kode error) tanpa isi pesan dan tanpa nomor HP | Satu wamid bisa dilacak dari webhook sampai kirim lewat `docker service logs` |
| 10 | Ekor latensi panjang, sedangkan typing indicator berhenti di 25 detik | Eval: p50 1,4 detik, p99 17 detik, maksimum 20,6 detik (`worst-revenue-last-month`) | Kirim pesan "sebentar ya, lagi Thya hitung" kalau giliran melewati sekitar 15 detik. Ini sudah dijanjikan harness §7, tapi belum ada | Test dengan LLM tiruan yang lambat: pesan interim muncul satu kali, lalu jawabannya |
| 11 | `/demo/chat` publik tanpa rate limit | Harness §8, tidak ditemukan di `demo.ts` dan `server.ts` | Batasi per IP. Endpoint ini menghabiskan kuota Netra | Request ke-N dalam satu menit ditolak dengan pesan yang ramah |

Risiko yang diterima: kalau proses mati tepat setelah Meta menerima pesan tapi sebelum baris ditandai terkirim, pesan bisa terkirim dua kali. Meta tidak menyediakan idempotency key, dan yang terduplikasi hanya balasan, bukan catatan penjualan. Enqueue di luar transaksi insert juga diterima, karena pengiriman ulang dari Meta akan memulihkannya.

### P2: fitur yang muncul dari kegagalan

Status 26 Okt: #12, #14, dan #15 sudah dikerjakan di kode dan diuji dengan model tiruan. #13 (STT) masih menunggu keputusan apakah voice note masuk demo. #12 dan #16 baru terbukti untuk model sungguhan setelah eval dijalankan dengan Netra.

| # | Kegagalan nyata | Usulan fitur | Bukti selesai |
|---|---|---|---|
| 12 | `schedule-ambiguous-hour` 0/3: "jam 6" langsung dijadwalkan jam 06.00 | Tanyakan balik dengan **reply button** Pagi/Sore/Malam. Ini pas dengan batas Meta (maksimal 3 tombol, 20 karakter), dan tool menolak jam yang ambigu (U5). Perbaikan di 8be86a7 belum terbukti di run eval | Kasus eval lulus 3/3 dan payload tombol tervalidasi oleh test |
| 13 | Voice note dibalas "baru bisa membaca pesan teks" | STT (harness §10 OPEN). OPEN DECISION apakah voice note masuk skenario demo. Kalau tidak, jangan tampilkan dan jangan klaim | Kalau dibangun: 10 rekaman OGG/Opus asli ditranskrip, lalu dicatat dengan benar |
| 14 | Postcheck membuang kalimat bantuan yang memuat angka contoh (`screenshot-qris-by-text`: dibuang 2 kali, diregenerasi 1 kali) | Angka di dalam contoh yang dikutip tidak dianggap klaim | Kasus itu lulus tanpa `dropped` |
| 15 | Reaksi atau stiker dibalas permintaan maaf | Abaikan reaksi tanpa membalas. Stiker dan lokasi dijawab singkat | Replay fixture reaksi: tidak ada pesan keluar |
| 16 | `items-sold-last-week` 2/5 dan `balik-modal-asks-back` 1/3 | Sudah ditangani 8be86a7 (`formatCount`, pertanyaan balik). Tinggal dibuktikan | Run eval berikutnya tidak menunjukkan regresi dibanding baseline |

Yang sengaja tidak masuk: list message, WhatsApp Flows, dan kampanye lewat WhatsApp. Tidak ada kegagalan yang menuntut fitur-fitur itu, dan Flows butuh endpoint terenkripsi, jadi biayanya tidak sebanding sebelum final.

## Verifikasi (penilai di luar kita)

1. **Replay fixture tanpa LLM.** Tambahkan ke `db/whatsapp-flow.test.ts` dengan model tiruan:
   - duplikat,
   - urutan terbalik,
   - pesan berumur 2 hari,
   - status `failed`,
   - expire di percobaan terakhir,
   - reaksi.

   Lulus kalau setiap wamid menghasilkan tepat satu catatan dan paling banyak satu balasan, 100%. Satu catatan ganda saja berarti gagal.
2. **Eval terhadap baseline.** Ditunda selama Netra belum boleh dipakai. Begitu boleh: `bun eval/run.ts`, lalu `bun eval/compare.ts`. Lulus kalau tidak ada kasus regression yang turun dan kasus 12 serta 16 naik. Satu kasus yang turun satu percobaan di k=3 berarti transkripnya dibaca dulu sebelum disebut regresi (noise k=3, menurut morning-handoff).
3. **E2E di nomor test Meta.** Kirim ke nomor test:
   - teks penjualan, lalu "Ya",
   - pertanyaan omzet,
   - permintaan grafik,
   - jam ambigu,
   - voice note,
   - dua pesan dalam 1 detik,
   - satu pesan setelah redeploy.

   Lulus kalau semua dibalas sesuai skenario dan status callback-nya `delivered`.
4. **Pilot 3–5 pemilik UMKM.** Ambang sukses ditentukan bersama Nawra (OPEN). Batas 5 penerima untuk nomor test belum terkonfirmasi dari halaman Meta yang berhasil diambil, jadi perlu dicek di dashboard.
5. **Sinyal produksi.**
   - Jumlah `schedule-tick` berstatus `created` sekitar 0.
   - `/health` hijau.
   - Quality rating nomor di Meta hijau.
   - Tidak ada 131047 yang tidak terduga di status callback.

## Keputusan terbuka

- Cara menjalankan worker di produksi: `JOBS_IN_SERVER=1` atau service terpisah. Pemilik: Rafee (sudah tercatat di morning-handoff).
- Perlakuan untuk pesan basi (#8). Pemilik: Rafee.
- Apakah voice note masuk skenario demo (#13). Pemilik: Rafee bersama Indy (pitch).
- Ambang sukses pilot. Pemilik: Nawra.
- Klaim biaya di paper harus memakai harga setelah perubahan 1 Okt 2026. Tarif IDR resmi belum terkonfirmasi. Pemilik: Indy.

## Sumber

- Webhook: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview.md
- Harga: https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing.md
- Kode error: https://developers.facebook.com/documentation/business-messaging/whatsapp/support/error-codes.md
- Throughput dan limit: https://developers.facebook.com/documentation/business-messaging/whatsapp/throughput.md, https://developers.facebook.com/documentation/business-messaging/whatsapp/messaging-limits.md
- Pesan interaktif: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/interactive-reply-buttons-messages
- Typing indicator: https://developers.facebook.com/documentation/business-messaging/whatsapp/typing-indicators.md
- Media: https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media
- pg-boss 12.37.1 `dist/plans.js` (index `job_i8`)
