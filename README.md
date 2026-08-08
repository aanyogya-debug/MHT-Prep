# MHT Prep

Aplikasi persiapan ujian masuk MHT — 1 admin (orang tua), banyak student (anak). Bukan multi-tenant. Lihat [`TECHNICAL_DOCUMENT_v0.3_DESIGN_BRIEF.md`](./TECHNICAL_DOCUMENT_v0.3_DESIGN_BRIEF.md) untuk brief lengkap.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 6 · Postgres (Supabase) · Cloudinary · Zustand · Tailwind 4 + shadcn/ui · JWT + bcrypt.

## Setup

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Buat project Supabase** (atau pakai yang sudah ada dari Plantygo — buat project baru, jangan share database). Dari Project Settings > Database, ambil dua connection string:
   - **Transaction pooler** (port 6543) → `DATABASE_URL`
   - **Direct connection** (port 5432) → `DIRECT_URL` (dipakai khusus migrasi)

3. **Salin `.env.example` ke `.env`** dan isi:
   - `DATABASE_URL`, `DIRECT_URL` — dari Supabase
   - `JWT_SECRET` — wajib string acak kuat, generate dengan:
     ```bash
     node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
     ```
   - `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME` — dipakai sekali oleh seed script untuk membuat akun admin. Registrasi admin terbuka **sengaja tidak dibuat**; ini satu-satunya cara membuat admin (section 7 brief).
   - `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — dari dashboard Cloudinary (free tier).

   Aplikasi akan **gagal start** kalau `DATABASE_URL`/`JWT_SECRET` kosong (lihat `src/instrumentation.ts`) — ini sengaja, bukan bug.

4. **Push schema ke database** (belum ada data produksi, jadi `db push` cukup untuk tahap awal; pindah ke `prisma migrate dev` begitu sudah ada histori migrasi yang perlu dijaga):

   ```bash
   npm run db:push
   ```

5. **Seed admin + 4 subject dasar**:

   ```bash
   npm run db:seed
   ```

6. **Jalankan dev server**:

   ```bash
   npm run dev
   ```

## Script yang tersedia

| Script | Fungsi |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Build & run production |
| `npm run lint` | ESLint |
| `npm run db:push` | Sinkronkan schema Prisma ke DB tanpa file migrasi (cocok utk tahap awal) |
| `npm run db:migrate` | Buat & jalankan migration file (`prisma migrate dev`) |
| `npm run db:seed` | Seed admin (dari env) + 4 subject dasar |
| `npm run db:studio` | Buka Prisma Studio |

## Struktur data

Schema lengkap ada di [`prisma/schema.prisma`](./prisma/schema.prisma), mengikuti section 3 (Learning Path: `Lesson`, `PathStep`, `StudentPathProgress`), section 4 (Tryout: `Tryout`, `ExerciseSession.tryoutId`), dan section 5 (pipeline Cloudinary: `Question.imageUrl` / `Question.sourceImageUrl`) dari design brief. Komentar di dalam file schema menjelaskan penyesuaian tipe dari snippet ilustratif brief (mis. enum Postgres asli menggantikan string enum-like, `Json` menggantikan string JSON manual).

## Belum dikerjakan (di luar scope setup ini)

- Endpoint API (auth, CRUD soal/lesson, generate tryout, import Excel, scoring).
- UI admin & siswa.
- Integrasi Cloudinary upload route + tab "Crop Diagram".
- Rate limiting, security headers, test suite, CI — sengaja ditunda per section 7 brief (baru relevan kalau sudah ada traffic dari luar).
