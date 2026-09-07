import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { updateStudentPasswordSchema } from "@/lib/validations/student";

// Ganti password siswa (mis. siswa lupa password) — bukan "lihat password
// lama", karena password lama tersimpan sbg hash bcrypt satu-arah dan tidak
// bisa dibalikkan oleh siapa pun. Admin set password baru lalu memberitahu
// siswa secara langsung, sama seperti alur pembuatan akun awal.
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  const body = await request.json().catch(() => null);
  const parsed = updateStudentPasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const student = await db.user.findUnique({ where: { id, role: "STUDENT" } });
    if (!student) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    await db.user.update({ where: { id }, data: { passwordHash } });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("PATCH /api/students/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
