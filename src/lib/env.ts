/**
 * Section 7 (security, wajib sebelum deploy publik):
 * JWT_SECRET wajib di-set via env var kuat, aplikasi harus gagal start kalau
 * env var kosong — jangan ada fallback hardcoded di source code.
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(
      `Environment variable "${name}" wajib di-set dan tidak boleh kosong. ` +
        `Cek file .env (lihat .env.example untuk daftar lengkap).`,
    );
  }
  return value;
}
