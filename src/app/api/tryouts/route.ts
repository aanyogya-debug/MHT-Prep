import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { createTryoutSchema } from "@/lib/validations/tryout";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    // Student cuma boleh lihat tryout yang sudah PUBLISHED — draft masih
    // direview admin, belum layak dikerjakan siswa (section 4).
    const tryouts = await db.tryout.findMany({
      where: auth.payload.role === "ADMIN" ? undefined : { status: "PUBLISHED" },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ tryouts });
  } catch (err) {
    console.error("GET /api/tryouts failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createTryoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const tryout = await db.tryout.create({ data: parsed.data });
    return NextResponse.json({ tryout }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tryouts failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
