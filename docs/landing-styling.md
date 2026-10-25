# Landing: aturan styling

Status: usulan 2026-10-25. Penegakan lint disetujui dan terpasang 2026-10-25. Berlaku untuk `apps/web/**`.

Diambil dari pola yang sudah jalan di FIKES (`packages/design-tokens/AGENTS.md`, `@shadcn/lint`), Dignition (`frontend/AGENTS.md`), Siera (`frontend/AGENTS.md` rule 9–10, `.gemini/styleguide.md`), dan PWN (`frontend/AGENTS.md`, bagian animasi dan aksesibilitas). Nilai tema (warna, font, radius) belum diisi; itu menunggu referensi visual dan aset brand dari Rafee. Dokumen ini hanya mengatur *cara* styling ditulis.

## 1. Satu sumber token

- Semua warna, ukuran teks, radius, bayangan, dan durasi animasi didefinisikan sekali di blok `@theme` dalam `apps/web/src/app/globals.css`. Komponen tidak pernah mendeklarasikan nilai visualnya sendiri.
- Nama token menyebut peran, bukan rupa: `--color-brand`, `--color-surface`, `--color-ink`, `--color-ink-muted`, `--color-bubble-in`, `--color-bubble-out`. Bukan `--color-green-500`.
- Warna ditulis `#rrggbb` supaya kontrasnya bisa dicek. Pasangan teks dan latar wajib minimal 4.5:1 (teks kecil) atau 3:1 (teks besar, ikon, ring fokus).
- Token baru = keputusan desain. Tambahkan di `globals.css` dengan komentar singkat soal kegunaannya, jangan di file komponen.
- Satu file CSS saja. Tidak ada CSS Modules, `styled-jsx`, tag `<style>` di JSX, atau file `.css` per komponen.

## 2. Class Tailwind

- **Tidak ada warna palet bawaan.** `bg-emerald-500`, `text-gray-600`, `border-slate-200` dilarang. Pakai token: `bg-brand`, `text-ink-muted`, `border-line`.
- **Tidak ada nilai arbitrer untuk ukuran visual.** `text-[28px]`, `py-[18px]`, `rounded-[11px]`, `bg-[#25d366]` dilarang. Pakai skala bawaan Tailwind (`py-4`, `gap-6`) atau token bernama (`text-display`, `rounded-bubble`). Pengecualian: nilai layout yang memang tidak punya padanan, misalnya `grid-cols-[1fr_auto]` atau `max-w-[68ch]`.
- **Class harus statis.** Tailwind hanya menemukan class yang tertulis utuh di source. Dilarang: `` `bg-${tone}` ``, `` `w-[${size}px]` ``. Varian dipilih dari map statis:

  ```tsx
  const toneClass = {
    brand: "bg-brand text-on-brand",
    quiet: "bg-surface text-ink",
  } satisfies Record<Tone, string>;
  ```

- **State lewat atribut, bukan string kondisional.** Tab aktif, bubble masuk/keluar, menu terbuka: taruh di `data-*` atau `aria-*`, lalu tulis variannya di class (`data-[active=true]:bg-brand`, `aria-selected:text-ink`, `group-data-[side=out]:justify-end`). Ini menggantikan sebagian besar kebutuhan `cn()`.
- Tidak ada `!` (important) dan tidak ada `@apply` di komponen. `@apply` hanya boleh di `globals.css` untuk style dasar elemen (`body`, `::selection`).

## 3. Inline style dan `CSSProperties`

- `style={{...}}` dilarang, baik di elemen DOM maupun komponen (`shadcn/no-inline-styles`).
- Tipe `CSSProperties` / `React.CSSProperties` tidak dipakai di `apps/web`. Kalau sebuah komponen terasa butuh tipe itu, berarti nilai visualnya belum masuk token atau state-nya belum dipindah ke `data-*`.
- Animasi yang nilainya berubah tiap frame ditulis lewat props `motion` (`initial`, `animate`, `whileInView`, `transition`), bukan `style`.
- Satu-satunya pengecualian: nilai yang baru ada saat runtime dan tidak bisa jadi class atau props motion (misalnya ukuran hasil ukur). Wajib pakai komentar `// oxlint-disable-next-line shadcn/no-inline-styles -- <alasan runtime>`. Pengecualian ini harus disebut saat review.

## 4. Komponen

- Komponen memiliki tampilannya sendiri. Halaman hanya menempatkan komponen (margin, lebar, posisi grid), bukan mengubah warna, ukuran teks, atau radiusnya. Kalau butuh tampilan lain, tambahkan varian di komponennya.
- Varian diberi nama generik (`brand`, `quiet`, `compact`), bukan nama section (`heroButton`).
- Komponen tidak menerima prop `className` bebas untuk restyling. Kalau perlu penempatan, terima `className` dan dokumentasikan bahwa isinya hanya layout.
- Satu file komponen maksimal sekitar 200 baris; pecah per bagian (mockup HP, bubble, tab fitur) kalau lewat.

## 5. Tipografi

- Ukuran teks lewat token bernama yang membawa line-height dan tracking-nya sendiri, misalnya `--text-display`, `--text-title`, `--text-body`, `--text-caption` (Tailwind v4: `--text-display--line-height`, `--text-display--letter-spacing`). Jangan memasangkan `text-5xl` dengan `leading-*` dan `tracking-*` manual di tiap tempat.
- Font dimuat lewat `next/font` dan diekspos sebagai `--font-sans` / `--font-display` di `@theme`.
- Angka yang dibandingkan (harga, omzet di mockup chat) pakai `tabular-nums`.
- Judul pakai `text-balance`, paragraf pakai `text-pretty`.

## 6. Layout dan responsif

- Mobile first. Target minimum lebar 360px tanpa scroll horizontal.
- Tinggi layar pakai `min-h-dvh`, bukan `h-screen`.
- Lebar konten dari satu token container (misalnya `--container-page`), bukan `max-w-*` acak per section.
- Jarak antar-section dari satu skala (misalnya `py-section` lewat `--spacing-section`), supaya ritme halaman konsisten.
- Cegah layout shift dari sumbernya: gambar dan maskot punya `width`/`height`, mockup HP punya `aspect-*` tetap, dan isi chat yang berganti antar-tab tidak mengubah tinggi HP.

## 7. Motion

- `motion` lewat `LazyMotion` + `m` dengan `domAnimation`, bukan `motion.*` penuh. Hover, fokus, dan transisi warna cukup dengan CSS (`transition-colors`, `duration-*` dari token).
- Animasikan hanya `transform` dan `opacity`. Jangan animasikan `width`, `height`, `top`, `left`.
- Hormati `prefers-reduced-motion`: `motion-safe:` di CSS, `useReducedMotion()` di komponen motion.
- Keyframe didefinisikan sebagai token `--animate-*` di `@theme`, bukan `@keyframes` lepas di komponen.
- Animasi menjelaskan sebab-akibat (bubble muncul setelah tab diklik, indikator "Thya lagi cek data…"). Tidak ada animasi dekoratif yang autoplay terus-menerus.

## 8. Aksesibilitas visual

- Fokus terlihat: `focus-visible:ring-*` memakai token `--color-ring`, bukan `outline-none` tanpa pengganti.
- Target sentuh minimal 44×44px.
- Input chat demo minimal 16px supaya iOS tidak zoom.
- Status tidak hanya disampaikan lewat warna (centang biru WhatsApp tetap punya label untuk screen reader).
- Satu tema dulu. Kalau temanya terang, set `color-scheme: light` dan `<meta name="theme-color">` sesuai latar.

## Penegakan

Terpasang di root `.oxlintrc.json`, override `apps/web/**` (disetujui Rafee 2026-10-25). Diuji dengan fixture Tailwind v4 tanpa shadcn di scratchpad: setiap pelanggaran contoh tertangkap dan contoh yang benar lolos. Warning dari `jsx-a11y` dan `nextjs` tetap menggagalkan `bun run lint` karena `--max-warnings=0`.

| Rule | Menegakkan | Sumber |
|---|---|---|
| `shadcn/no-inline-styles` | Bagian 3: `style={{}}` di elemen apa pun, termasuk komponen, dan tag `<style>`. Menggantikan `react/forbid-dom-props` | `@shadcn/lint` 0.2.0 |
| `shadcn/no-raw-colors` | Bagian 2: warna palet bawaan (`bg-emerald-500`) | `@shadcn/lint` |
| `shadcn/no-arbitrary-values` (izinkan `layout`) | Bagian 2: `text-[28px]`, `bg-[#25d366]`; nilai layout seperti `grid-cols-[1fr_auto]` tetap boleh | `@shadcn/lint` |
| `shadcn/no-unknown-classes` | Class yang tidak dihasilkan Tailwind (salah ketik, token yang belum ada) | `@shadcn/lint` |
| `shadcn/no-restyle` (izinkan `layout`) | Bagian 4: halaman tidak mengubah tampilan komponen dari `@/components/**`. Mati di `src/components/ui/**`, karena primitive mengatur tampilannya sendiri | `@shadcn/lint` |
| `shadcn/require-static-classes` | Bagian 2: class komponen yang tidak bisa dibaca linter | `@shadcn/lint` |
| `thya/no-css-properties` | Bagian 3: `import { CSSProperties }` dan `React.CSSProperties` | `tools/oxlint/thya/` |
| `thya/no-dynamic-class-fragments` | Bagian 2: `` `bg-${tone}` ``, `` `md:${x}` `` di `className` elemen DOM, yang tidak dicek `require-static-classes` | `tools/oxlint/thya/` |
| `no-restricted-imports` | Bagian 7: `motion` dari `motion/react` atau `motion/react-client`, dan paket `framer-motion`. Pakai `m` di dalam `LazyMotion` | oxlint bawaan |
| Plugin `jsx-a11y` (rule default) | Bagian 8: `alt` gambar, elemen statis yang bisa diklik tanpa keyboard dan role, dan seterusnya | oxlint bawaan |
| Plugin `nextjs` (rule default) | `<img>` mentah (pakai `next/image` dengan `images.unoptimized: true` karena static export), `<a>` untuk link internal (pakai `next/link`) | oxlint bawaan |
| `sortTailwindcss` di `.oxfmtrc.json` | Urutan class Tailwind konsisten, membaca token dari `apps/web/src/app/globals.css`. Dicek `fmt:check` | oxfmt 0.74.0 |

`@shadcn/lint` menemukan tema dengan memindai file `.css` yang meng-import Tailwind, jadi tidak butuh `components.json`. Komponen dikenali lewat `settings.shadcn.componentImports` (`^@/components`). Rule ini baru benar-benar bekerja setelah `apps/web` punya `tailwindcss` dan `globals.css`.

Pengecualian runtime di bagian 3 sekarang ditulis `// oxlint-disable-next-line shadcn/no-inline-styles -- <alasan runtime>`.

## Assessment: rule statis vs rule untuk agent

Patokannya: aturan masuk linter/formatter kalau bisa diputuskan dari teks source saja, tanpa merender halaman dan tanpa menilai maksud desain. Sisanya tetap jadi aturan tertulis untuk coding agent dan dicek saat review atau lewat render.

### Sudah statis (terpasang)

Semua baris di tabel Penegakan di atas.

### Bisa dijadikan statis, belum dipasang

| Aturan | Cara | Biaya |
|---|---|---|
| Animasi properti layout (`width`, `height`, `top`, `left`) | Rule kecil di `tools/oxlint/thya/`: key objek literal di `initial`/`animate`/`exit`/`while*` hanya boleh `x`, `y`, `scale`, `rotate`, `opacity` | Satu rule |
| `!important` (`!p-4`, `p-4!`) dan class terlarang (`h-screen`, `outline-none` tanpa `focus-visible:ring-*` di string yang sama) | Rule kecil di `tools/oxlint/thya/` yang membaca string `className` | Satu rule |
| File komponen lebih dari sekitar 200 baris | `max-lines` bawaan oxlint, level warning | Satu entri config |
| Hanya satu file CSS, tanpa `@apply` di luar `globals.css`, `@keyframes` hanya di `@theme`, tanpa import `*.module.css` | Oxlint tidak membaca CSS. Pakai skrip `bun` kecil (`scripts/check-web-css.ts`) di `lint`, plus `no-restricted-imports` untuk `*.module.css` | Skrip tanpa dependency |
| Token warna `#rrggbb`, nama token berdasarkan peran (tolak akhiran `-50`…`-950` dan nama warna), kontras pasangan teks/latar | `bun test` yang mem-parse `@theme` di `globals.css` dan menghitung rasio kontras pasangan yang dideklarasikan, seperti test `@fikes/design-tokens` | Satu file test |

### Tetap aturan agent (tidak bisa diputuskan dari source)

- Varian diberi nama generik, token diberi nama berdasarkan peran (sebagian bisa dicek regex, tapi pilihan namanya tetap keputusan desain).
- `tabular-nums` untuk angka yang dibandingkan, `text-balance` di judul, `text-pretty` di paragraf. Linter tidak tahu teks mana yang berisi angka atau berfungsi sebagai judul.
- Target sentuh 44px, input 16px, lebar minimum 360px tanpa scroll horizontal, layout shift saat ganti tab. Hasilnya bergantung pada layout yang dirender; dicek di render per breakpoint.
- Motion menjelaskan sebab-akibat dan tidak autoplay dekoratif. Ini soal maksud.
- `prefers-reduced-motion`: pasang sekali sebagai `<MotionConfig reducedMotion="user">` di provider motion, lalu cek saat review. Lebih murah daripada rule per file.
- Status tidak hanya lewat warna, `color-scheme` dan `theme-color` sesuai tema. Sekali pasang, dicek saat review.

`sortTailwindcss`, `jsx-a11y`, `nextjs`, dan larangan `motion.*` sudah dipasang 2026-10-25. Rule `tools/oxlint/thya/` tambahan, skrip CSS, dan test token menyusul saat `apps/web` sudah ada.

## Keputusan terbuka

| Topik | Catatan |
|---|---|
| `clsx` + `tailwind-merge` (`cn()`) dan `class-variance-authority` | Keempat repo referensi memakai `cn()`, Siera juga CVA. Belum ada di daftar dependency yang disetujui. Usulan: tanpa ketiganya dulu; landing kecil, varian cukup map statis + `data-*`. Tambah kalau ternyata merepotkan |
| Tema (warna, font, radius) | Menunggu referensi visual dan aset logo/maskot dari Rafee |
| Dark mode | Usulan: tidak dulu, satu tema |
