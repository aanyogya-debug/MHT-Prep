import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { loginSchema } from "@/lib/validations/auth";
import { verifyPassword } from "@/lib/auth/password";
import { signAuthToken } from "@/lib/auth/jwt";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { email, password } = parsed.data;

  try {
    const user = await db.user.findUnique({ where: { email } });

    // Pesan error sama utk email tidak ditemukan & password salah — mencegah
    // enumerasi akun (project hanya punya 1 admin + sedikit student).
    const invalidCredentials = () =>
      NextResponse.json({ error: "Email atau password salah" }, { status: 401 });

    if (!user) return invalidCredentials();

    const passwordValid = await verifyPassword(password, user.passwordHash);
    if (!passwordValid) return invalidCredentials();

    const token = signAuthToken({ sub: user.id, email: user.email, role: user.role });

    return NextResponse.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (err) {
    console.error("POST /api/auth/login failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
