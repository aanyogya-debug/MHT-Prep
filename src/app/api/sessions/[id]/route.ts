import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { finalizeSession, isSessionExpired } from "@/lib/session-grading";
import { sanitizeItemForActiveSession } from "@/lib/session-serializer";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    let session = await db.exerciseSession.findUnique({
      where: { id },
      include: {
        items: {
          include: { question: { include: { options: true, passage: true } } },
          orderBy: { orderIndex: "asc" },
        },
      },
    });
    if (!session) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }
    // Admin diberi akses baca (mis. utk debugging) — tapi kepemilikan tetap
    // dicek utk student, tidak boleh lihat sesi siswa lain.
    if (session.studentId !== auth.payload.sub && auth.payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    // Timer dicek "malas" (lazy) di sini, bukan cron — kalau sudah lewat
    // waktu tapi status masih IN_PROGRESS, auto-submit dulu sebelum dibalas.
    if (session.status === "IN_PROGRESS" && isSessionExpired(session)) {
      await db.$transaction((tx) => finalizeSession(tx, id, "EXPIRED"));
      session = await db.exerciseSession.findUniqueOrThrow({
        where: { id },
        include: {
          items: {
            include: { question: { include: { options: true, passage: true } } },
            orderBy: { orderIndex: "asc" },
          },
        },
      });
    }

    const isActive = session.status === "IN_PROGRESS";
    return NextResponse.json({
      session: {
        ...session,
        items: isActive ? session.items.map(sanitizeItemForActiveSession) : session.items,
      },
    });
  } catch (err) {
    console.error("GET /api/sessions/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
