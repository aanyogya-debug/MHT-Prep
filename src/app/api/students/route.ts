import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { hashPassword } from "@/lib/auth/password";
import { createStudentSchema } from "@/lib/validations/student";

// Registrasi self-service ditutup (section 7) — ini satu-satunya cara akun
// siswa dibuat: admin (orang tua) yang membuatkannya, bukan anak mendaftar sendiri.
export async function GET(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const students = await db.user.findMany({
      where: { role: "STUDENT" },
      select: { id: true, name: true, email: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ students });
  } catch (err) {
    console.error("GET /api/students failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createStudentSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const existing = await db.user.findUnique({ where: { email: parsed.data.email } });
    if (existing) {
      return NextResponse.json({ error: "Email sudah dipakai" }, { status: 409 });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const student = await db.user.create({
      data: { name: parsed.data.name, email: parsed.data.email, passwordHash, role: "STUDENT" },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    return NextResponse.json({ student }, { status: 201 });
  } catch (err) {
    console.error("POST /api/students failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
