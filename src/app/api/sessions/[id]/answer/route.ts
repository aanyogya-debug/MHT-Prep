import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { submitAnswerSchema } from "@/lib/validations/session";
import { finalizeSession, isSessionExpired } from "@/lib/session-grading";

// Autosave satu jawaban — dipanggil tiap kali siswa klik opsi. Tidak
// menggrading di sini (grading cuma terjadi sekali, saat submit/expired),
// cuma menyimpan selectedOptionId + timestamp.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = submitAnswerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const session = await db.exerciseSession.findUnique({ where: { id } });
    if (!session || session.studentId !== auth.payload.sub) {
      return NextResponse.json({ error: "Sesi tidak ditemukan" }, { status: 404 });
    }

    if (session.status === "IN_PROGRESS" && isSessionExpired(session)) {
      await db.$transaction((tx) => finalizeSession(tx, id, "EXPIRED"));
      return NextResponse.json(
        { error: "Waktu sudah habis — jawaban ini tidak tersimpan, hasil sudah di-submit otomatis" },
        { status: 409 },
      );
    }
    if (session.status !== "IN_PROGRESS") {
      return NextResponse.json({ error: "Sesi ini sudah selesai" }, { status: 409 });
    }

    // selectedOptionId null diperbolehkan (mis. siswa batal pilih) — tetap
    // dianggap "dijawab" dari sisi autosave (answeredAt terisi); status
    // dihitung ulang benar sbg unanswered nanti kalau tetap null saat submit.
    if (parsed.data.selectedOptionId) {
      const option = await db.questionOption.findUnique({
        where: { id: parsed.data.selectedOptionId },
      });
      if (!option || option.questionId !== parsed.data.questionId) {
        return NextResponse.json({ error: "Opsi jawaban tidak valid" }, { status: 400 });
      }
    }

    const item = await db.exerciseSessionItem.update({
      where: { sessionId_questionId: { sessionId: id, questionId: parsed.data.questionId } },
      data: { selectedOptionId: parsed.data.selectedOptionId, answeredAt: new Date() },
    });

    return NextResponse.json({ item });
  } catch (err) {
    console.error("POST /api/sessions/[id]/answer failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
