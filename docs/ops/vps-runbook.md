# Runbook VPS Thya

Satu VPS menjalankan Dokploy, yang mengelola `apps/api`, Postgres, dan Traefik (HTTPS). Dokumen ini berisi cara masuk, apa saja yang sudah dipasang, operasi rutin, dan cara restore backup. Dokumen ini tidak memuat secret. Password, key, dan token disimpan di password manager Rafee.

Disiapkan 2026-10-25. Pemilik: Rafee.

## Ringkasan

| | |
|---|---|
| Penyedia | Sumopod, provider Tencent, region Jakarta |
| Paket | 2 vCPU, RAM 4 GB (terbaca 3,6 GiB), SSD 60 GB, Rp90.000/bulan, aktif sampai 25/11/2026, auto-renewal |
| OS | Ubuntu 24.04 LTS, timezone Asia/Jakarta |
| IP publik | `43.173.20.60` (IPv4 saja). IP privat VPC `10.11.18.206` |
| Dokploy | v0.30.10 (Docker Swarm satu node, Traefik v3.6) |
| Dashboard | https://deploy.sayyidrafee.com |
| API + webhook WhatsApp | https://thya-api.sayyidrafee.com |
| Landing + `/demo` | https://thya.veterantech.id |

**Batas egress Tencent bersifat keras.** Kalau kuota bandwidth bulanan habis, VPS dimatikan otomatis sampai bulan berikutnya ([docs Sumopod](https://docs.sumopod.com/guides/vps/monitor-bandwidth)). Cek tab **Usage** di panel sebelum demo, dan jangan memakai VPS ini untuk menyajikan file besar.

## Akses

### SSH

Login hanya dengan key. Login password dan root sudah dimatikan. Alias ada di `~/.ssh/config` Mac Rafee:

| Alias | User | Key (di Mac) | Sudo | Untuk |
|---|---|---|---|---|
| `ssh thya` | `rafee` | `~/.ssh/thya_vps` | pakai password | Rafee |
| `ssh thya-ops` | `ubuntu` | `~/.ssh/thya_ops` | tanpa password | coding agent / otomasi |

Kedua private key memakai passphrase yang tersimpan di Keychain macOS (`ssh-add --apple-use-keychain`). Agent tidak pernah melihat passphrase maupun password sudo.

Untuk mencabut akses agent tanpa mengganggu akses Rafee, hapus baris `ops-agent@thya-vps` dari `/home/ubuntu/.ssh/authorized_keys`.

Menambah laptop baru: buat key di laptop itu (`ssh-keygen -t ed25519`), lalu dari sesi yang sudah masuk tambahkan isi `.pub`-nya ke `~/.ssh/authorized_keys` user yang bersangkutan. Jangan menyalin private key antar mesin.

### Untuk coding agent

Session agent baru yang mengurus infra cukup membaca dokumen ini, lalu memakai alias `thya-ops`:

- Akses: `ssh thya-ops '<perintah>'`. Ini user `ubuntu` dengan sudo tanpa password; jalankan perintah admin dengan `sudo -n`. Key `~/.ssh/thya_ops` sudah ada di ssh-agent macOS, jadi pakai `-o BatchMode=yes`. Kalau login minta passphrase, berhenti dan minta Rafee menjalankan `ssh-add --apple-use-keychain ~/.ssh/thya_ops`.
- Banyak perintah beruntun: buka satu koneksi master (`ssh -M -S ~/.ssh/cm/thya-ops -o ControlPersist=2h -fN thya-ops`, lalu `ssh -S ~/.ssh/cm/thya-ops thya-ops ...`), supaya tidak kena `ufw limit` (6 koneksi/30 detik). Path socket harus pendek.
- Dashboard Dokploy (`deploy.sayyidrafee.com`) milik Rafee. Agent tidak login ke sana; perubahan di UI (aplikasi, env, domain, backup) dipandu ke Rafee, lalu diverifikasi agent dari server (`docker service ls/ps/logs`, `/etc/dokploy/traefik/dynamic/`) dan dari luar (`curl`, `openssl s_client`).
- Repo: GitHub `sayyidrafeed/thya` lewat `gh` yang sudah login. Variable repo boleh diubah agent; secret (`DOKPLOY_*_WEBHOOK_URL`) diisi Rafee dengan `gh secret set`.
- Batasan: agent tidak mengetik, mencetak, atau menyimpan password, token, private key, atau isi env. Cek env cukup dengan nama variabel atau panjangnya. Konfirmasi dulu ke Rafee sebelum mengubah sshd, firewall, atau Swarm, menghapus volume/data, atau reinstall. Sebelum menutup akses lama, pastikan sesi SSH baru bisa masuk. Jangan sentuh agent Tencent, dan jangan scan host selain VPS ini.

### Web Console (jalur darurat)

Tombol **Web Console** di panel Sumopod membuka konsol VNC (`tty1`). Jalurnya tidak lewat SSH, jadi tetap bisa dipakai saat SSH terkunci atau sshd rusak. Login dengan user `ubuntu` dan password di tab **Access** panel, atau user `rafee` dengan password sudo-nya. **Reset Password** di panel mengganti password `ubuntu`.

Pesan `atkbd serio0: Unknown key pressed` di konsol tidak berbahaya. Itu kode tombol dari VNC; tetap ketik seperti biasa.

### Dashboard Dokploy

https://deploy.sayyidrafee.com, akun admin milik Rafee dengan 2FA. Port 3000 sudah tidak di-publish. Kalau domain atau sertifikat rusak sehingga dashboard tidak bisa dibuka, lihat [Memulihkan akses dashboard](#memulihkan-akses-dashboard).

## Lapisan keamanan

| Lapisan | Konfigurasi |
|---|---|
| Firewall panel Sumopod (Tencent) | Masuk hanya TCP 22, 80, 443 dan ICMP, source `0.0.0.0/0`. Rule bawaan "Allow All Request" sudah dihapus. Ini lapisan utama, karena Docker mem-publish port lewat iptables sehingga **melewati ufw** |
| ufw | `deny incoming`, `allow outgoing`; `22/tcp` LIMIT, `80/tcp`, `443/tcp` |
| sshd | `/etc/ssh/sshd_config.d/00-thya-hardening.conf`: `PermitRootLogin no`, `PasswordAuthentication no`, `KbdInteractiveAuthentication no`, `AuthenticationMethods publickey`, `AllowUsers rafee ubuntu`, `MaxAuthTries 3`, `LoginGraceTime 30`, `X11Forwarding no`. Awalan `00` membuatnya dibaca sebelum `50-cloud-init.conf` (yang masih berisi `PasswordAuthentication yes`); di sshd nilai pertama yang menang |
| fail2ban | `/etc/fail2ban/jail.d/thya.local`: jail `sshd` (5 gagal dalam 10 menit → ban 1 jam) dan `recidive` (ban 1 minggu) |
| Update keamanan | unattended-upgrades aktif. Image Tencent mengomentari origin `-security`, jadi origin itu diaktifkan lewat `/etc/apt/apt.conf.d/52thya-unattended-upgrades`. Tidak ada reboot otomatis |
| Swap | `/swap.img` 1,9 GB bawaan image, `vm.swappiness=10` (`/etc/sysctl.d/90-thya-swap.conf`) |
| Jaringan Docker | Swarm di-init dengan `--default-addr-pool 10.200.0.0/16` supaya tidak bertabrakan dengan subnet VPC `10.11.16.0/22` |

Hasil cek port dari luar (2026-10-25): 22, 80, 443 terbuka; 3000, 5432, 2377, 7946, 8080, 9000 tertutup.

`ufw limit 22/tcp` menolak IP yang membuka lebih dari 6 koneksi SSH dalam 30 detik. Skrip yang menjalankan banyak perintah SSH beruntun sebaiknya memakai satu koneksi (`ControlMaster`).

**Jangan dihapus:** `tat_agent`, `/usr/local/qcloud` (termasuk YunJing), dan user `lighthouse`. Semuanya agent milik Tencent. Fitur panel (Reset Password, Web Console) bergantung padanya, dan menghapusnya bisa dianggap mengakali kontrol platform ([Tencent Cloud AUP](https://www.tencentcloud.com/document/product/301/9245)).

**Kepatuhan:** pengujian keamanan hanya boleh ke VPS ini sendiri ([Customer Security Assessment Policy](https://www.tencentcloud.com/document/product/301/41938)). Jangan scan host lain, jangan mining, proxy publik, atau email massal.

## DNS

Semua record **DNS only** (awan abu-abu di Cloudflare). Traefik mengambil sertifikat Let's Encrypt lewat HTTP challenge di port 80, dan webhook Meta langsung sampai ke VPS.

| Zona | Type | Name | Content | Status |
|---|---|---|---|---|
| `sayyidrafee.com` | A | `deploy` | `43.173.20.60` | aktif |
| `sayyidrafee.com` | A | `thya-api` | `43.173.20.60` | aktif |
| `veterantech.id` | A | `thya` | `43.173.20.60` | aktif |

## Postgres

- Service Dokploy `thya-db` di project `thya`, image `pgvector/pgvector:0.8.7-pg17`. Versi di-pin; pg18 tidak dipakai karena image pg18 memindahkan direktori data dan berbenturan dengan mount `/var/lib/postgresql/data` bawaan Dokploy.
- Database `thya`, user `thya`. Password di-generate Dokploy dan hanya terlihat di tab database itu.
- **Tidak ada External Port.** Aplikasi memakai *Internal Connection URL* dari tab database (`postgresql://thya:…@<app-name>:5432/thya`) dan menyimpannya sebagai env `DATABASE_URL` di aplikasi.
- Extension `vector` dibuat dengan `CREATE EXTENSION IF NOT EXISTS vector;` (nanti lewat migrasi Drizzle).

### Backup

- Tujuan: Cloudflare R2, bucket `thya-backups`. Token R2 hanya berhak Object Read & Write di bucket itu, dan dimasukkan Rafee langsung ke Dokploy (Settings → S3 Destinations).
- Jadwal: `0 19 * * *`. Container Dokploy berjalan dalam UTC, jadi ini = **02.00 WIB** setiap hari. Prefix `postgres`, simpan 14 terakhir.
- Dokploy tidak mengenkripsi arsip backup. Bucket R2 terenkripsi at rest secara default.

### Restore

Lewat dashboard: `thya-db` → **Backups → Restore**, pilih destination R2, cari file di prefix `postgres/`, isi nama database, lalu klik **Restore** ([docs Dokploy](https://docs.dokploy.com/docs/core/databases/restore)). Restore menimpa isi database tujuan. Untuk latihan, restore dulu ke database lain.

Lewat SSH, kalau dashboard tidak bisa dibuka:

```bash
# 1. Unduh file backup dari R2 (dashboard Cloudflare → R2 → thya-backups) ke Mac, lalu salin ke VPS
scp thya-backup.sql.gz thya:/tmp/

# 2. Di VPS: cari container Postgres, lalu restore
ssh thya
CID=$(sudo docker ps -q -f name=thya-db)
gunzip -c /tmp/thya-backup.sql.gz | sudo docker exec -i "$CID" pg_restore -U thya -d thya --clean --if-exists --no-owner
rm /tmp/thya-backup.sql.gz
```

Format arsip dan perintah di atas diverifikasi lewat uji restore; lihat [Status](#status-dan-yang-masih-menunggu).

## Aplikasi dan CI/CD

Image dibangun di GitHub Actions, bukan di VPS. Dengan begitu RAM VPS tidak terpakai untuk build, dan yang masuk ke VPS hanya hasil pull image (ingress, tidak memakan kuota egress).

```
push ke main → CI (fmt, lint, typecheck, test)
             → Publish images: build apps/api dan apps/web → ghcr.io/sayyidrafeed/thya-{api,web}:main + :sha-<commit>
             → POST ke webhook Auto Deploy Dokploy → Dokploy pull :main dan restart service
```

- Workflow: `.github/workflows/ci.yml` dan `.github/workflows/publish-images.yml`. Publish hanya berjalan setelah CI sukses pada push ke `main`; pull request tidak pernah sampai ke tahap publish.
- Dockerfile: `apps/api/Dockerfile` (Bun 1.4.2, user non-root `bun`, `HEALTHCHECK` ke `/health`) dan `apps/web/Dockerfile` (static export → nginx). Keduanya di-build dari root repo.
- Pengaturan repo GitHub (Settings → Secrets and variables → Actions):

| Nama | Jenis | Isi |
|---|---|---|
| `API_PUBLIC_URL` | variable | `https://thya-api.sayyidrafee.com` (build arg `NEXT_PUBLIC_API_URL` untuk web) |
| `DOKPLOY_API_WEBHOOK_URL` | **secret** | Webhook URL aplikasi `thya-api` (tab General → Auto Deploy on, lalu tab Deployments → Webhook URL). Diisi Rafee sendiri; token di URL itu cukup untuk memicu deploy |
| `DOKPLOY_WEB_WEBHOOK_URL` | **secret** | Sama, untuk aplikasi `web` |

  Kalau secret webhook belum diisi, workflow tetap mem-publish image dan melewati langkah deploy. Webhook dipilih daripada API key Dokploy karena API key setara akses admin, sedangkan webhook hanya bisa memicu deploy satu aplikasi. Kalau URL bocor, buat ulang token di Dokploy (Deployments → Refresh Token).

### Aplikasi `thya-api` di Dokploy

- Project `thya` → Application `thya-api`, Provider **Docker**: image `ghcr.io/sayyidrafeed/thya-api:main`, Registry URL `ghcr.io`. Kalau package GHCR dibuat public, username dan password dikosongkan. Kalau private, isi username GitHub dan PAT (classic) dengan scope `read:packages` saja.
- Env (tab Environment, tidak ada di repo maupun image): `NETRA_API_KEY`, `NETRA_BASE_URL=https://api.netraruntime.com/v1`, `NETRA_MODEL=deepseek/deepseek-v4.1-flash`, `PORT=3001`, `WEB_ORIGINS=https://thya.veterantech.id`, lalu `DATABASE_URL` begitu kode DB masuk.
- Domain: `thya-api.sayyidrafee.com`, path `/`, container port `3001`, HTTPS Let's Encrypt.
- Health check: `GET /health` → `{"ok":true}`.
- Rollback: ubah image ke `ghcr.io/sayyidrafeed/thya-api:sha-<commit-sebelumnya>`, lalu Deploy. Kembalikan ke `:main` setelah perbaikan di-push.

### Aplikasi `web` (landing + `/demo`) di Dokploy

- Project `thya` → Application `web`, Provider **Docker**: image `ghcr.io/sayyidrafeed/thya-web:main`, Registry URL `ghcr.io`, tanpa kredensial. Tidak ada env; URL API sudah tertanam saat build (variable repo `API_PUBLIC_URL`, termasuk di `connect-src` CSP).
- Domain: `thya.veterantech.id`, path `/`, container port `3000` (nginx-unprivileged), HTTPS Let's Encrypt.
- Mengganti URL API berarti ubah `API_PUBLIC_URL` di GitHub, lalu build ulang. Env di Dokploy tidak berpengaruh untuk web.

Diverifikasi 2026-10-25: `/` dan `/demo` → 200; header CSP, `X-Frame-Options: DENY`, dan `nosniff` aktif; preflight CORS dari origin landing → 204; satu pesan `/demo/chat` lewat jalur publik dijawab sampai `finishReason: stop`.

## Operasi rutin

| Kapan | Apa |
|---|---|
| Mingguan, dan H-1 demo | Panel → tab **Usage**: sisa bandwidth. Dokploy → `thya-db` → Backups: backup terakhir sukses |
| Setelah unattended-upgrades memasang kernel | `ssh thya 'test -f /var/run/reboot-required && echo PERLU_REBOOT'`, lalu `ssh thya sudo reboot` di luar jam demo |
| Update Dokploy | Dashboard → Settings → **Updates**. Jangan update menjelang 10–11 Nov 2026 |
| Docker | Paket `docker-ce` di-*hold* oleh installer Dokploy; jangan di-upgrade manual tanpa cek kompatibilitas Dokploy |
| Bulanan: disk | `ssh thya 'df -h / && sudo docker system df'`. Setiap deploy memindahkan tag `:main` dan meninggalkan image lama `<none>`, tapi layer-nya dipakai bersama, jadi pertambahannya kecil (2026-10-25: yang bisa dihapus 253 MB, disk kosong 45 GB). Kalau sisa disk di bawah 10 GB: `ssh thya 'sudo docker image prune -f && sudo apt-get clean'` |
| Cek ban fail2ban | `ssh thya sudo fail2ban-client status sshd`. Membuka ban: `sudo fail2ban-client set sshd unbanip <IP>` |

### Memulihkan akses dashboard

Kalau https://deploy.sayyidrafee.com tidak bisa dibuka (DNS berubah, sertifikat gagal), buka sementara port 3000 hanya ke localhost VPS lalu masuk lewat tunnel:

```bash
ssh thya 'sudo docker service update --publish-add "published=3000,target=3000,mode=host" dokploy'
ssh -N -L 3000:localhost:3000 thya     # biarkan terbuka, lalu buka http://localhost:3000
```

Firewall panel tetap menutup 3000 dari internet. Setelah domain beres, tutup lagi:

```bash
ssh thya 'sudo docker service update --publish-rm "published=3000,target=3000,mode=host" dokploy'
```

### Kalau SSH terkunci

1. Buka Web Console di panel, lalu login `ubuntu` atau `rafee`.
2. Cek `sudo sshd -t`, `sudo ufw status`, dan `sudo fail2ban-client status sshd`.
3. Kalau sshd tidak mau start karena konfigurasi: pindahkan `/etc/ssh/sshd_config.d/00-thya-hardening.conf` ke `/root/`, lalu `sudo systemctl restart ssh`. Setelah masalahnya ketemu, kembalikan file itu.

## Setup dari nol (ringkas)

Urutan yang dipakai 2026-10-25, untuk mengulang di VPS baru:

1. Panel: firewall TCP 22/80/443 + ICMP, hapus "Allow All Request".
2. Pasang key `thya_ops` ke user `ubuntu` (`ssh-copy-id`). Root di image Tencent tidak menerima login password lewat SSH; user awalnya `ubuntu`.
3. `apt full-upgrade`, pasang `fail2ban ufw unattended-upgrades`, timezone Asia/Jakarta, drop-in unattended-upgrades dan swappiness, user `rafee` + key `thya_vps`, reboot.
4. Rafee: `ssh -t thya-ops sudo passwd rafee`.
5. Drop-in sshd, `sshd -t`, reload. Tes dari sesi baru: key masuk, password dan root ditolak. Sesi lama tetap terbuka sampai tes lolos.
6. ufw 22 (limit)/80/443, enable. fail2ban `thya.local`.
7. Baca skrip https://dokploy.com/install.sh, lalu jalankan dengan `DOCKER_SWARM_INIT_ARGS="--default-addr-pool 10.200.0.0/16 --default-addr-pool-mask-length 24"`.
8. Buat admin lewat tunnel `ssh -N -L 3000:localhost:3000 thya`, aktifkan 2FA, set Server Domain + Let's Encrypt, lalu `--publish-rm` port 3000.
9. Postgres pgvector, destination R2, jadwal backup, uji restore.
10. Variable dan secret repo GitHub, aplikasi Dokploy dari image GHCR, lalu domain.

## Status dan yang masih menunggu

Per 2026-10-25:

- [x] Hardening, firewall, fail2ban, update keamanan otomatis
- [x] Dokploy + dashboard HTTPS, port 3000 ditutup
- [ ] Postgres `thya-db` (ditunda oleh Rafee, 2026-10-25; `apps/api` belum memakai DB)
- [ ] Destination R2 + jadwal backup (ditunda oleh Rafee untuk menghemat egress, 2026-10-25). Wajib aktif sebelum ada data UMKM sungguhan di DB
- [ ] Uji backup manual dan uji restore
- [x] Repo `sayyidrafeed/thya` (public) di GitHub
- [x] CI/CD GitHub Actions → GHCR → webhook Dokploy, diuji ujung ke ujung; `https://thya-api.sayyidrafee.com/health` → `{"ok":true}`
- [ ] Aktifkan 2FA Dokploy (belum dikonfirmasi)
- [x] Landing `thya.veterantech.id` di Dokploy VPS ini, redeploy otomatis lewat webhook
- [ ] Catat batas bandwidth paket dari tab Usage
