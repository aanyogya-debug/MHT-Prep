# Technical Document — MHT Prep (v0.3.0 Design Brief)

**Status:** Belum ada kode. Dokumen ini adalah brief lengkap untuk memulai development dari nol di Claude Code.
**Konteks:** Aplikasi persiapan ujian masuk MHT untuk 1 anak (admin: orang tua, student: anak). Berpotensi dibuka untuk siswa lain di masa depan, tapi model saat ini tetap **1 admin, banyak student** — bukan multi-tenant.

---

## 1. Perubahan dari Dokumen Awal (v0.2.0)

Dokumen awal (`TECHNICAL_DOCUMENT.md`, v0.2.0) adalah *starting point* arsitektur yang solid, tapi ditulis seolah-olah untuk SaaS multi-tenant generik. Beberapa penyesuaian:

| Item | v0.2.0 | v0.3.0 |
|---|---|---|
| Database | SQLite | **Postgres via Supabase** (akun sudah ada dari project Plantygo) — dipilih sekarang karena belum ada data, migrasi nanti akan lebih mahal |
| Image storage | Tidak dibahas | **Cloudinary** (free tier tanpa kartu kredit, punya built-in URL-based crop) |
| Model konten | Hanya bank soal + sesi latihan | **+ Lessons (materi) & Learning Path** berjenjang per topik |
| Ujian | Hanya sesi latihan biasa | **+ Tryout berkala** (simulasi full MHT, 100 soal, 200 menit) |
| Admin registration | Terbuka | **Harus ditutup** — admin di-seed manual, bukan self-register |

Struktur dasar lain (auth JWT, scoring +4/-1/0, mastery per topik, Excel import) **tetap dipakai apa adanya** dari dokumen awal — sudah dirancang dengan baik untuk kebutuhan ini.

---

## 2. Struktur Subject Mengikuti Format MHT

Berdasarkan komposisi ujian asli (100 soal, 200 menit gabungan, skor +4/-1/0):

| Subject | Jumlah soal di ujian asli | Karakter topik | Gating materi→latihan |
|---|---|---|---|
| Tes Potensial Skolastik | 40 | Skill-based (penalaran umum, kuantitatif, analitis) | Longgar |
| Penalaran Matematika | 20 | Concept-based, berjenjang | Ketat |
| Penalaran IPA | 20 | Fisika (concept-based, ketat) + Biologi (lebih longgar) | Campuran per topik |
| Literasi Bahasa Inggris | 20 | Grammar (concept-based) + Reading (skill-based) | Campuran per topik |

4 Subject ini jadi top-level di tabel `subjects`. Semua topik granular (Gaya, Ekosistem, Simple Present, Main Idea, dst) nempel di bawah salah satu dari 4 ini via `topic.subject_id` yang sudah ada di schema.

---

## 3. Learning Path — Materi Berjenjang per Topik

**Alur:** Materi 1 → Latihan 1 (easy-medium) → Materi 2 → Latihan 2 (hard) → ... → (setelah beberapa topik selesai) → Sesi Campuran/Review.

**Keputusan:**
- Progres **dikunci** — step berikutnya baru terbuka kalau skor latihan sebelumnya lulus `unlock_threshold`.
- Granularitas materi: **per Topik** (bukan per Subtopik) — lebih ringkas untuk dikelola admin.
- `unlock_threshold` **nullable per step** — kosong berarti auto-unlock tanpa syarat skor. Dipakai untuk topik yang enggak punya prasyarat kuat secara pedagogis (Biologi, Reading).
- Gagal lulus threshold → siswa bisa **retry** practice step yang sama (sesi baru dibuat, nyambung ke `path_step_id` yang sama). Tidak ada "sekali gagal, mati".
- `order_index` di tabel `topics` bersifat **per-subject**, bukan urutan global — siswa bisa jalan paralel di beberapa mata pelajaran sekaligus.
- Threshold default disarankan mulai dari **60** untuk latihan awal, dinaikkan bertahap oleh admin seiring waktu.

### Schema tambahan (Prisma, ilustratif)

```prisma
model Lesson {
  id          String   @id @default(cuid())
  topicId     String
  topic       Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  orderIndex  Int
  title       String
  content     String   // markdown + LaTeX, konsisten dengan renderLatex() yang sudah ada
  createdBy   String
  createdAt   DateTime @default(now())

  pathSteps PathStep[]

  @@map("lessons")
}

model PathStep {
  id              String   @id @default(cuid())
  topicId         String
  topic           Topic    @relation(fields: [topicId], references: [id], onDelete: Cascade)
  orderIndex      Int
  stepType        String   // 'lesson' | 'practice'
  lessonId        String?
  lesson          Lesson?  @relation(fields: [lessonId], references: [id])
  difficultyMin   String?  // untuk step bertipe 'practice'
  difficultyMax   String?
  questionCount   Int?
  unlockThreshold Int?     // nullable = auto-unlock tanpa syarat skor

  progress StudentPathProgress[]

  @@map("path_steps")
}

model StudentPathProgress {
  id          String    @id @default(cuid())
  studentId   String
  student     User      @relation(fields: [studentId], references: [id], onDelete: Cascade)
  pathStepId  String
  pathStep    PathStep  @relation(fields: [pathStepId], references: [id], onDelete: Cascade)
  status      String    @default("locked") // locked | unlocked | completed
  sessionId   String?   // FK opsional ke ExerciseSession, terisi begitu practice step dikerjakan
  completedAt DateTime?

  @@unique([studentId, pathStepId])
  @@map("student_path_progress")
}
```

Modifikasi ke model existing:
- `Topic` tambah kolom `orderIndex Int @default(0)`
- `ExerciseSession` tambah kolom opsional `pathStepId String?` (nullable FK) — dipakai untuk menandai sesi ini bagian dari path, bukan latihan bebas atau tryout

**Yang tetap dipakai tanpa perubahan:** mesin `exercise_sessions` (timer, autosave, transactional submit), `mastery_records` per topik, endpoint scoring yang sudah ada. Practice step di path cuma "pemicu" pembuatan sesi baru dengan filter topik+difficulty tertentu.

---

## 4. Tryout Berkala — Simulasi Full MHT

**Format:** 100 soal gabungan (40 TPS + 20 Matematika + 20 IPA + 20 Bahasa Inggris), 1 timer 200 menit, skor +4/-1/0 (identik dengan formula existing).

**Keputusan:**
- Progresi kesulitan antar-tryout diatur **manual oleh admin** (Tryout #1-2 easy/medium, #3-4 medium/hard, #5+ mendekati soal asli) — bukan algoritma adaptif otomatis.
- Satu tryout = satu `exercise_session` biasa (`mode: 'simulation'`, `total_questions: 100`, `duration_minutes: 200`) — reuse 100% mesin yang sudah ada.
- Perlu endpoint baru **"Generate Tryout"**: admin input quota per section + band kesulitan → sistem narik soal random sesuai kuota dari bank soal → admin review/tukar soal sebelum publish ke siswa.

### Schema tambahan (Prisma, ilustratif)

```prisma
model Tryout {
  id             String   @id @default(cuid())
  title          String
  difficultyTier String
  sectionQuotas  String   // JSON string, mis: {"tps":40,"matematika":20,"ipa":20,"bahasa_inggris":20}
  createdAt      DateTime @default(now())

  sessions ExerciseSession[]

  @@map("tryouts")
}
```

Modifikasi ke model existing:
- `ExerciseSession` tambah kolom opsional `tryoutId String?` (nullable FK ke `Tryout`) — dipakai untuk grouping histori, membedakan dari latihan per-topik biasa.

**History hasil tes:** query semua `exercise_sessions` dengan `tryoutId` terisi, urut `created_at`, plot `score` jadi grafik tren. Tidak perlu tabel tambahan — data yang dibutuhkan sudah ada di kolom existing.

---

## 5. Image Pipeline — Cloudinary

**Alasan pemilihan:** free tier tanpa kartu kredit (blocker praktis di Indonesia), dan punya transformasi crop via URL parameter yang menggantikan kebutuhan bikin crop-tool custom di server.

**Alur:**
1. Admin upload gambar/foto halaman via API route server-side (`cloudinary.uploader.upload()`) — API Secret **hanya di server**, tidak pernah ke client.
2. URL hasil upload (`secure_url`) disimpan ke kolom `gambar_url` (soal) atau kolom bantu terpisah (halaman asli, sebelum di-crop).
3. Untuk diagram yang perlu di-crop dari halaman utuh: gunakan parameter transformasi `c_crop,x_{X},y_{Y},w_{W},h_{H}` di URL — UI admin cukup kasih kotak crop yang bisa digeser, ambil koordinatnya, generate URL.

**Kredensial:** `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` — env var, tidak pernah hardcode atau muncul di client-side code.

---

## 6. AI-Assisted Question Extraction

**Tujuan:** mempercepat pengisian bank soal dari foto halaman buku, tanpa mengetik manual satu-satu.

**Alur (script terpisah, jalan dari command line, bukan bagian dari web app):**
1. Kumpulkan foto/scan halaman soal ke satu folder.
2. Script baca tiap halaman → AI vision extract teks soal + pilihan + LaTeX + deteksi ada-gambar-atau-tidak → tulis satu baris per soal ke file Excel, kolom persis sesuai template `import-excel` yang sudah ada di dokumen v0.2.0.
3. Kalau halaman ada gambar: script juga upload foto halaman asli (utuh) ke Cloudinary, taruh URL-nya di kolom bantu terpisah (bukan `gambar_url`) untuk referensi crop nanti.
4. Admin review Excel manual — **wajib cek kunci jawaban satu-satu** (AI bisa salah baca opsi mirip), isi kolom yang kosong, fill-down topik/subject berulang.
5. Untuk baris berlabel "ada gambar": admin buka tab "Crop Diagram" di admin panel, drag kotak crop di atas halaman asli, URL ter-crop otomatis terisi ke `gambar_url`.
6. Upload Excel final ke endpoint import yang sudah ada — preview (`PUT`) dulu, baru commit (`POST`).
7. Verifikasi acak beberapa soal (terutama yang ada LaTeX + gambar) di tampilan siswa sebelum dipakai untuk latihan sungguhan.

---

## 7. Security — Wajib Sebelum Deploy Publik

Diwarisi dari audit v0.2.0, tetap berlaku dan **prioritas dikerjakan sebelum fitur baru**, karena murah diperbaiki sekarang dan mahal kalau lupa setelah live:

1. **Tutup open admin registration** — admin di-seed manual sekali di awal, endpoint register-admin dinonaktifkan atau di-gate invite code.
2. **JWT_SECRET** — wajib di-set via env var kuat, aplikasi harus gagal start kalau env var kosong (jangan ada fallback hardcoded di source code).
3. **Matikan query logging di production** (`log: ['query']` di `src/lib/db.ts`) — saat ini selalu aktif termasuk production, berisiko membocorkan data sensitif ke log/stdout.

Item lain dari tabel "Known Limitations" v0.2.0 (rate limiting, security headers, test suite, CI) **ditunda** — baru relevan kalau sudah ada traffic dari orang yang tidak dikenal, bukan prioritas untuk tahap 1-2 pengguna yang dikontrol penuh oleh admin.

---

## 8. Keputusan yang Masih Perlu Diisi Admin (Bukan Teknis)

Ini bukan hal yang perlu diputuskan sekarang — cukup diketahui bahwa ini keputusan konten/kurikulum yang akan diminta saat pengisian data, bukan keputusan arsitektur:

- Urutan topik per subject (`order_index` di tabel `topics`)
- `unlock_threshold` per path step — mana yang ketat (Fisika, Matematika, Grammar), mana yang longgar (Biologi, Reading, TPS)
- Isi materi (`Lesson.content`) tiap topik
- Section quota & band kesulitan tiap Tryout

---

## 9. Stack (Diperbarui)

| Layer | v0.2.0 | v0.3.0 |
|---|---|---|
| Framework | Next.js 16, React 19, TypeScript 5 | Tidak berubah |
| Database | SQLite | **Postgres (Supabase)** |
| ORM | Prisma 6 | Tidak berubah — provider diganti ke `postgresql` |
| Image storage | — | **Cloudinary** |
| State | Zustand | Tidak berubah |
| Auth | JWT + bcrypt (localStorage) | Tidak berubah, hanya JWT_SECRET wajib di-set |
| UI | Tailwind 4, shadcn/ui | Tidak berubah |

---

## 10. Cara Memulai di Claude Code

1. Buat folder baru khusus project ini (terpisah total dari folder Plantygo) — misal `mht-prep/`.
2. Taruh file ini (`TECHNICAL_DOCUMENT_v0.3_DESIGN_BRIEF.md`) di root folder tersebut.
3. Buka folder itu sebagai project baru di Claude Code (bukan lanjutan session Plantygo).
4. Prompt awal yang disarankan: *"Baca TECHNICAL_DOCUMENT_v0.3_DESIGN_BRIEF.md di folder ini. Ini adalah brief lengkap untuk project baru dari nol. Mulai dengan setup project (Next.js + Prisma + Postgres/Supabase) sesuai stack di section 9, lalu buat schema Prisma lengkap berdasarkan section 3, 4, dan 5 dari dokumen ini."*
