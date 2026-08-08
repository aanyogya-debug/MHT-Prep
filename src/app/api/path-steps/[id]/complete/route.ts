import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { computeUnlockedStepIds } from "@/lib/learning-path";
import { markStepCompletedAndUnlockNext } from "@/lib/path-progress-service";

// Dipanggil siswa setelah membuka/membaca materi (step bertipe LESSON) —
// tidak ada skor yang bisa dites disini (beda dari practice step, yg
// "selesai"-nya lewat submit sesi), jadi cukup tandai selesai lalu buka
// step berikutnya (section 3: "Materi 1 -> Latihan 1 -> ...").
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const studentId = auth.payload.sub;

  try {
    const pathStep = await db.pathStep.findUnique({ where: { id } });
    if (!pathStep) {
      return NextResponse.json({ error: "Path step tidak ditemukan" }, { status: 404 });
    }
    if (pathStep.stepType !== "LESSON") {
      return NextResponse.json(
        { error: "Endpoint ini hanya utk step bertipe materi" },
        { status: 400 },
      );
    }

    const siblingSteps = await db.pathStep.findMany({ where: { topicId: pathStep.topicId } });
    const progress = await db.studentPathProgress.findMany({
      where: { studentId, pathStepId: { in: siblingSteps.map((s) => s.id) } },
    });
    const completedIds = new Set(
      progress.filter((p) => p.status === "COMPLETED").map((p) => p.pathStepId),
    );
    const unlockedIds = computeUnlockedStepIds(siblingSteps, completedIds);
    if (!unlockedIds.has(id)) {
      return NextResponse.json(
        { error: "Step ini masih terkunci — selesaikan step sebelumnya dulu" },
        { status: 403 },
      );
    }

    await db.$transaction((tx) => markStepCompletedAndUnlockNext(tx, studentId, id));

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/path-steps/[id]/complete failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
