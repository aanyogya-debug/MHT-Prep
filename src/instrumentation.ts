/**
 * Next.js instrumentation hook — jalan sekali saat server boot (dev & production).
 * Dipakai untuk fail-fast validasi env var kritikal (section 7), supaya aplikasi
 * tidak diam-diam jalan dengan JWT_SECRET kosong/fallback hardcoded.
 * https://nextjs.org/docs/app/guides/instrumentation
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { requireEnv } = await import("@/lib/env");

    requireEnv("DATABASE_URL");
    requireEnv("JWT_SECRET");
  }
}
