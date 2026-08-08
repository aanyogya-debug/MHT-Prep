import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { finalizeSession, isSessionExpired } from "@/lib/session-grading";

// Dipicu tombol "Hentikan Tes" (submit manual sebelum waktu habis) — pakai
// finalizeSession yang sama dengan auto-submit saat expired, cuma beda
// status akhir (SUBMITTED vs EXPIRED).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const session = await db.exerciseSession.findUnique({ where: { id } });
    if (!session || session.studentId !== auth.payload.sub) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }
    if (session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Sesi ini sudah selesai" }, { status: 409 });
    }

    const reason = isSessionExpired(session) ? "EXPIRED" : "SUBMITTED";
    await db.$transaction((tx) => finalizeSession(tx, id, reason));

    const updated = await db.exerciseSession.findUniqueOrThrow({ where: { id } });
    return NextResponse.json({ session: updated });
  } catch (err) {
    console.error("POST /api/sessions/[id]/submit failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
