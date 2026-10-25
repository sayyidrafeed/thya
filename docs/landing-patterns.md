# Landing: pola kode `apps/web`

Status: disetujui Rafee 2026-10-25 untuk direproduksi dan diperbaiki dari repo referensinya. `apps/web` sudah di-scaffold mengikuti dokumen ini (token masih placeholder). Aturan styling ada di [landing-styling.md](landing-styling.md); dokumen ini mengatur struktur, lapisan, React, static export, dan deploy.

## Referensi

Urutan dari Rafee: Siera paling kuat, lalu FIKES, lalu nalarx-docs. Semua di-pull fast-forward pada 2026-10-25.

| Repo | Commit | Yang diambil |
|---|---|---|
| Siera `frontend` | `9f800fe1` (2026-10-24) | Lapisan dan kepemilikan (AGENTS.md rule 5–8), aturan hook, larangan memo spekulatif, batas 200 baris, gerbang self-review, susunan landing satu section per file (`src/components/landing-page/`) |
| FIKES | `de357d55` (2026-10-25) | Token sebagai satu sumber dan `@shadcn/lint` (`packages/design-tokens/`), tsconfig paling ketat, `import/no-cycle` |
| nalarx-docs | `ebfbf5d` (2026-10-22) | Next `output: "export"`, `images.unoptimized`, `typedRoutes`, env divalidasi Zod, Dockerfile Bun → nginx-unprivileged, `nginx.conf` dengan header keamanan dan cache |

## Struktur folder

```
apps/web/
  src/
    app/                  satu route: layout.tsx, page.tsx (landing), globals.css
    components/
      landing/            satu file per section (hero.tsx, phone-mockup.tsx, demo-chat.tsx, ...); page.tsx hanya menyusun
      motion/             MotionProvider (LazyMotion + MotionConfig reducedMotion="user")
      ui/                 primitive kecil yang dipakai ulang (button, badge); boleh mengatur tampilannya sendiri
    hooks/                perilaku: use-demo-chat.ts, dan hook lain saat section-nya dibuat
    lib/<domain>/         fungsi murni dan data: lib/whatsapp/format.ts (parser *tebal* dan daftar -), lib/env.ts
  next.config.ts, tsconfig.json, Dockerfile (+ Dockerfile.dockerignore), nginx.conf
  AGENTS.md           blok dari `next dev` (arahkan ke docs Next lokal) + pointer ke dokumen ini
```

- `src/app/**` hanya menyusun dan memasang metadata. Tidak ada markup section di file route.
- `components`, `hooks`, dan `lib` tidak pernah meng-import dari `src/app/**` (Siera rule 5a).
- Nama file kebab-case. File hook bernama sama dengan export-nya: `use-demo-chat.ts` meng-export `useDemoChat`.

## Lapisan (dari Siera rule 5–8)

| Lapisan | Boleh | Tidak boleh |
|---|---|---|
| Komponen | JSX, render bersyarat, memanggil hook, state presentasi lokal (hover, buka/tutup tooltip), handler satu baris yang mendelegasikan ke hook | `useEffect` berisi logika, `useState` untuk perilaku atau async, `useRef` untuk DOM atau timing, `setTimeout`/`setInterval`/`requestAnimationFrame`, observer, `window.*`/`document.*`/`navigator.*`, `async`/`await` |
| Hook | Perilaku, efek, state kompleks. Satu hook satu urusan | Mengembalikan JSX, memuat class Tailwind |
| `lib/` | Fungsi murni, konstanta, mapper, schema Zod | Import React |

State bersama: section chat demo memakai `useChat` dari `@ai-sdk/react`; selain itu `useState` di dalam hook. Tidak ada store global.

## Satu route

Landing hanya satu halaman, `/` (keputusan Rafee 2026-10-25), dan untuk sekarang statis penuh: tidak memanggil API (Rafee 2026-10-25). Chat demo live ditunda; `use-demo-chat.ts` dan `lib/env.ts` dibiarkan tanpa pemakai sampai section itu kembali. Aturan chat demo di bawah berlaku saat itu.

- `page.tsx` adalah Server Component yang menyusun section. Section statis tidak menambah JS.
- Bagian interaktif (tab mockup, chat demo) dibuat sebagai island `"use client"` sekecil mungkin.
- Chat demo dimuat lazy dengan `next/dynamic` saat section-nya terlihat atau diklik, supaya AI SDK tidak masuk muatan awal.
- Animasi sederhana pakai CSS; `motion` hanya untuk yang tidak bisa dilakukan CSS. Build 2026-10-25 (sebelum section dihapus): runtime Next + React sekitar 150 KB gzip, `motion` 44 KB.

## React dan Next

- Server Component secara default. `"use client"` hanya di daun yang interaktif (tab fitur mockup, chat demo), bukan di `landing-page.tsx` atau layout.
- Jangan menambah `useMemo`, `useCallback`, atau `memo()` secara spekulatif (Siera rule 11–12). React Compiler belum diaktifkan; memoisasi manual hanya untuk kebutuhan yang terukur.
- `key` dari data yang stabil, bukan index array.
- Tidak ada `dangerouslySetInnerHTML`. Format WhatsApp di jawaban agent (`*tebal*`, daftar `-`) di-parse di `lib/whatsapp/format.ts` menjadi token, lalu dirender sebagai elemen React.

## Static export

- `next.config.ts`: `output: "export"`, `reactStrictMode: true`, `typedRoutes: true`, `images: { unoptimized: true }` (pola nalarx-docs). Gambar tetap lewat `next/image` dengan `width` dan `height`.
- Tidak ada route handler, server action, middleware, atau `cookies()`/`headers()`. Semua yang butuh server ada di `apps/api`.
- Env dibaca sekali di `src/lib/env.ts` dan diparse Zod saat build, misalnya `NEXT_PUBLIC_API_URL: z.url()`. Komponen tidak membaca `process.env` langsung.
- Redirect URL lama diurus di `nginx.conf`, bukan di Next.

## TypeScript

`apps/web/tsconfig.json` meng-extend `tsconfig.base.json` dan menambah `exactOptionalPropertyTypes: true` (pola FIKES). Flag ini tidak dipasang di base karena tipe `streamText` dari AI SDK di `apps/api` gagal dengan flag ini. Base sudah memuat `strict`, `noUncheckedIndexedAccess`, `noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, dan `noImplicitOverride`.

## Deploy

Static export → image nginx → GHCR, mengikuti `nalarx-docs/Dockerfile` dan `nginx.conf`:

1. Stage builder `oven/bun:1.4.2`: `bun install --frozen-lockfile`, `bun run build`, lalu gzip `-k -9` file teks di `out/`.
2. Stage runner `nginxinc/nginx-unprivileged` (alpine-slim, tag di-pin): `gzip_static on`, cache `immutable` untuk `/_next/static/`, `must-revalidate` untuk HTML, port 3000.
3. Header: `X-Content-Type-Options`, `X-Frame-Options DENY`, `Referrer-Policy`, `Permissions-Policy`, dan CSP. **`connect-src` wajib memuat origin API**, kalau tidak section chat demo tidak bisa memanggil agent.

Image di-build dari root repo supaya lockfile workspace ikut: `docker build -f apps/web/Dockerfile --build-arg NEXT_PUBLIC_API_URL=<url API> .`. Origin API diambil dari build arg dan disisipkan ke CSP. `style-src` tetap `'unsafe-inline'` karena `motion` merender state awal sebagai atribut `style`.

Tempat container dijalankan belum diputuskan.

## File contoh

Baca file ini sebelum menulis pola yang sama.

| Pola | File | Catatan |
|---|---|---|
| Landing satu section per file, page hanya menyusun | `Siera/frontend/src/components/landing-page/landing-page.tsx` dan section di sebelahnya | Ambil susunannya, bukan class-nya (lihat tabel di bawah) |
| Hook kecil satu urusan | `Siera/frontend/src/hooks/use-scroll-to-section.ts`, `use-debounce.ts` | |
| Token tema satu sumber | `FIKES/packages/design-tokens/theme.css` dan `AGENTS.md` di folder yang sama | Komentar per token menjelaskan kegunaannya |
| Komponen pola yang dipakai ulang | `FIKES/apps/web/src/components/patterns/` (`empty-state.tsx`, `choice-card.tsx`) | |
| Next static export | `nalarx-docs/next.config.mjs`, `src/env.ts` | |
| Docker + nginx | `nalarx-docs/Dockerfile`, `nalarx-docs/nginx.conf` | |

### Jangan ditiru

Repo referensi juga punya bagian yang melanggar aturan Thya:

| Di mana | Masalah | Di Thya |
|---|---|---|
| `Siera/.../landing-page/landing-page.tsx` | Background grid ditulis sebagai nilai arbitrer panjang (`md:bg-[linear-gradient(...)]`) | Jadikan `@utility` atau token di `globals.css` |
| `Siera/.../landing-page/tutorial-step.tsx` | `window.matchMedia("(prefers-reduced-motion...)")` di komponen, melanggar Siera rule 6 sendiri | `motion-safe:` di CSS atau `useReducedMotion()` di hook |
| `Siera/.../landing-page/*` | `cva` + `cn()` | Belum disetujui; pakai map statis + `data-*` (landing-styling.md bagian 2) |
| `Siera/.../shared/animated-tab-bar.tsx` | `CSSProperties` untuk indikator tab | Props `motion` (`layoutId` atau `animate={{ x }}`) |

## Penegakan

Terpasang di root `.oxlintrc.json` (2026-10-25). Selain rule styling:

| Rule | Cakupan |
|---|---|
| `eslint/complexity` maks 12 | `apps/web/**` (maks 20 untuk sisa repo) |
| `max-lines` 200, tanpa baris kosong dan komentar | `apps/web/**` |
| `react/jsx-key`, `no-array-index-key`, `self-closing-comp`, `no-danger`, `jsx-boolean-value` | `apps/web/**` |
| `no-console`, `typescript/no-non-null-assertion` | `apps/web/**` (`apps/api` masih melanggar keduanya) |
| `import/no-cycle`, `import/no-duplicates`, `typescript/consistent-type-imports`, `no-explicit-any`, `ban-ts-comment`, `unicorn/prefer-string-slice`, `unicorn/no-array-for-each` | seluruh repo |

Semua rule berstatus error karena `bun run lint` memakai `--max-warnings=0`.

Belum statis, dicek saat review: larangan efek, timer, dan `window.*` di komponen; hook tanpa JSX dan class; `"use client"` hanya di daun; tanpa memo spekulatif. Larangan di komponen bisa dijadikan rule `tools/oxlint/thya/` (cek `useEffect`, `setTimeout`, `window`, `document` di `src/components/**`) setelah `apps/web` ada.

## Gerbang self-review

Sebelum menyerahkan pekerjaan `apps/web`:

```
[ ] bun run lint, bun run fmt:check, bun run typecheck hijau
[ ] Lapisan: tidak ada logika di komponen, tidak ada JSX atau class di hook
[ ] "use client" hanya di komponen interaktif
[ ] Styling: hanya token, tanpa nilai arbitrer untuk ukuran visual, tanpa style={{}}
[ ] Tidak ada file komponen di atas 200 baris
[ ] Render dicek di 360px, 768px, dan desktop; tinggi mockup HP tidak berubah saat ganti tab
[ ] Copy dicek dengan antislop-copywriting; klaim sesuai yang bisa didemokan
```
