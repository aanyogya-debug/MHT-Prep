import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";

// Versi ringan dari /api/students/[id]/progress (admin-only) tapi utk
// siswa melihat mastery-nya sendiri — dipakai badge status di daftar
// subbab (section: rombak navigasi jadi flat per-subject list).
export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  try {
    const records = await db.masteryRecord.findMany({
      where: { studentId: auth.payload.sub },
      select: { topicId: true, difficulty: true, masteryScore: true, questionsAttempted: true },
    });
    return NextResponse.json({ mastery: records });
  } catch (err) {
    console.error("GET /api/me/mastery failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
