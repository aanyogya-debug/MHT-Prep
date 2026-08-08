import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

// Section 7 (security): admin registration harus tertutup — admin di-seed manual
// sekali di awal lewat script ini, endpoint register-admin tidak pernah dibuat/aktif.
function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Seed dibatalkan: environment variable "${name}" kosong. Set dulu di .env.`,
    );
  }
  return value;
}

// Section 2 — 4 subject top-level tetap, mengikuti komposisi ujian asli MHT
// (100 soal, 200 menit gabungan). Topik granular ditambahkan admin belakangan
// lewat panel admin, bukan lewat seed ini.
const SUBJECTS = [
  { slug: "tps", name: "Tes Potensial Skolastik" },
  { slug: "matematika", name: "Penalaran Matematika" },
  { slug: "ipa", name: "Penalaran IPA" },
  { slug: "bahasa_inggris", name: "Literasi Bahasa Inggris" },
] as const;

async function main() {
  const adminName = process.env.ADMIN_NAME?.trim() || "Admin";
  const adminEmail = requireEnv("ADMIN_EMAIL");
  const adminPassword = requireEnv("ADMIN_PASSWORD");

  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {}, // sengaja tidak menimpa password/role admin yang sudah ada
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash,
      role: Role.ADMIN,
    },
  });
  console.log(`Admin siap: ${admin.email} (${admin.id})`);

  for (const subject of SUBJECTS) {
    const row = await db.subject.upsert({
      where: { slug: subject.slug },
      update: { name: subject.name },
      create: subject,
    });
    console.log(`Subject siap: ${row.slug} — ${row.name}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
