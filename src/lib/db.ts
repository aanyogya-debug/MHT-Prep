import { PrismaClient } from "@prisma/client";

// Singleton PrismaClient — mencegah exhaust koneksi Postgres akibat hot-reload
// Next.js dev server membuat instance baru tiap kali modul di-reload.
// Referensi: https://pris.ly/d/help/next-js-best-practices

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// Section 7 (security, wajib sebelum deploy publik): query logging HARUS mati di
// production — sebelumnya `log: ['query']` selalu aktif termasuk production, yang
// berisiko membocorkan data sensitif (jawaban siswa, dsb) ke log/stdout.
const isProduction = process.env.NODE_ENV === "production";

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ["error", "warn"] : ["query", "error", "warn"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = db;
}
