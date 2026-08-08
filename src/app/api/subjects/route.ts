import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

// Hanya GET — 4 subject bersifat tetap (mengikuti format ujian MHT, lihat
// section 2 brief), di-seed sekali lewat prisma/seed.ts, tidak dikelola admin.
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const subjects = await db.subject.findMany({ orderBy: { name: "asc" } });
    return NextResponse.json({ subjects });
  } catch (err) {
    console.error("GET /api/subjects failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
