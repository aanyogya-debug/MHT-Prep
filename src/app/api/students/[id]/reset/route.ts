import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";

// Reset progres siswa (bukan hapus akun) — dipakai admin (orang tua) utk
// memberi siswa "mulai dari nol" tanpa perlu membuat akun baru. Menghapus
// seluruh riwayat sesi (latihan & tryout, item ikut ter-cascade lewat FK),
// mastery record, dan progress learning-path lama (vestigial tapi tetap
// dibersihkan demi konsistensi "reset total"). Nama/email/password TIDAK
// disentuh.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const student = await db.user.findUnique({ where: { id, role: "STUDENT" } });
    if (!student) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    await db.$transaction([
      db.exerciseSession.deleteMany({ where: { studentId: id } }),
      db.masteryRecord.deleteMany({ where: { studentId: id } }),
      db.studentPathProgress.deleteMany({ where: { studentId: id } }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/students/[id]/reset failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
