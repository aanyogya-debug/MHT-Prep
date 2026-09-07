import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth } from "@/lib/auth/guard";
import { startSessionSchema } from "@/lib/validations/session";
import { difficultyRange } from "@/lib/validations/question";
import { shuffle } from "@/lib/tryout-generator";
import { computeUnlockedStepIds } from "@/lib/learning-path";
import { finalizeSession, isSessionExpired } from "@/lib/session-grading";
import { sanitizeItemForActiveSession } from "@/lib/session-serializer";

// Durasi practice step / tryout lama: formula sederhana 1.5 menit/soal,
// minimum 10 menit — dipertahankan apa adanya utk pathStep (section lama,
// vestigial, tidak lagi dipakai siswa tapi API-nya dibiarkan jalan).
function practiceDuration(questionCount: number): number {
  return Math.max(10, Math.round(questionCount * 1.5));
}

// Menit per soal per tingkat kesulitan (section "latihan bertingkat") —
// makin sulit, makin banyak waktu berpikir yang wajar dialokasikan per soal.
// Angka awal, mudah dikalibrasi ulang nanti kalau ada data pemakaian nyata.
const MINUTES_PER_QUESTION: Record<"EASY" | "MEDIUM" | "HARD", number> = {
  EASY: 1.5,
  MEDIUM: 2,
  HARD: 2.5,
};

function tieredPracticeDuration(questionCount: number, difficulty: "EASY" | "MEDIUM" | "HARD"): number {
  return Math.max(10, Math.round(questionCount * MINUTES_PER_QUESTION[difficulty]));
}

export async function POST(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = startSessionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const studentId = auth.payload.sub;
  const input = parsed.data;

  try {
    // Cari session IN_PROGRESS yang sama persis (mis. reload halaman
    // di tengah timer) supaya tidak bikin timer baru / sesi ganda.
    const dedupeWhere =
      input.source === "pathStep"
        ? { pathStepId: input.pathStepId }
        : input.source === "tryout"
          ? { tryoutId: input.tryoutId }
          : { topicId: input.topicId, difficulty: input.difficulty, pathStepId: null, tryoutId: null };

    const existing = await db.exerciseSession.findFirst({
      where: { studentId, status: "IN_PROGRESS", ...dedupeWhere },
    });
    if (existing) {
      if (!isSessionExpired(existing)) {
        return NextResponse.json({ session: existing }, { status: 200 });
      }
      await db.$transaction((tx) => finalizeSession(tx, existing.id, "EXPIRED"));
    }

    let questionIds: string[];
    let topicId: string | null = null;
    let difficulty: "EASY" | "MEDIUM" | "HARD" | null = null;
    let pathStepId: string | null = null;
    let tryoutId: string | null = null;
    let durationMinutes: number;
    let mode: "PRACTICE" | "SIMULATION";

    if (input.source === "topic") {
      // Sesi latihan bertingkat: SELALU seluruh pool soal level ini, bukan
      // jumlah yang diminta klien — supaya siswa benar-benar menuntaskan
      // satu tingkat kesulitan sampai habis, bukan sampel sebagian.
      const pool = await db.question.findMany({
        where: { topicId: input.topicId, difficulty: input.difficulty },
        select: { id: true },
      });
      if (pool.length === 0) {
        return NextResponse.json(
          { error: `Belum ada soal level ${input.difficulty} untuk topik ini` },
          { status: 409 },
        );
      }
      questionIds = shuffle(pool, Math.random).map((q) => q.id);
      topicId = input.topicId;
      difficulty = input.difficulty;
      durationMinutes = tieredPracticeDuration(questionIds.length, input.difficulty);
      mode = "PRACTICE";
    } else if (input.source === "pathStep") {
      const pathStep = await db.pathStep.findUnique({ where: { id: input.pathStepId } });
      if (!pathStep) {
        return NextResponse.json({ error: "Path step tidak ditemukan" }, { status: 404 });
      }
      if (pathStep.stepType !== "PRACTICE") {
        return NextResponse.json(
          { error: "Path step ini bertipe materi, bukan latihan" },
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
      if (!unlockedIds.has(pathStep.id)) {
        return NextResponse.json(
          { error: "Step ini masih terkunci — selesaikan step sebelumnya dulu" },
          { status: 403 },
        );
      }

      const eligibleDifficulties = difficultyRange(
        pathStep.difficultyMin ?? "EASY",
        pathStep.difficultyMax ?? "HARD",
      );
      const questionCount = pathStep.questionCount ?? 10;
      const pool = await db.question.findMany({
        where: { topicId: pathStep.topicId, difficulty: { in: eligibleDifficulties } },
        select: { id: true },
      });
      if (pool.length < questionCount) {
        return NextResponse.json(
          { error: `Soal tidak cukup utk step ini: butuh ${questionCount}, tersedia ${pool.length}` },
          { status: 409 },
        );
      }
      questionIds = shuffle(pool, Math.random).slice(0, questionCount).map((q) => q.id);
      topicId = pathStep.topicId;
      pathStepId = pathStep.id;
      durationMinutes = practiceDuration(questionCount);
      mode = "PRACTICE";
    } else {
      const tryout = await db.tryout.findUnique({ where: { id: input.tryoutId } });
      if (!tryout || tryout.status !== "PUBLISHED") {
        return NextResponse.json({ error: "Tryout tidak ditemukan" }, { status: 404 });
      }
      const tryoutQuestions = await db.tryoutQuestion.findMany({
        where: { tryoutId: tryout.id },
        orderBy: { orderIndex: "asc" },
      });
      if (tryoutQuestions.length === 0) {
        return NextResponse.json({ error: "Tryout ini belum punya soal" }, { status: 409 });
      }
      questionIds = tryoutQuestions.map((tq) => tq.questionId);
      tryoutId = tryout.id;
      // Durasi tryout tetap 200 menit (format resmi ujian, section 4) berapa
      // pun jumlah soal aktualnya (bisa < 100 kalau ada shortfall saat generate).
      durationMinutes = 200;
      mode = "SIMULATION";
    }

    const session = await db.exerciseSession.create({
      data: {
        studentId,
        mode,
        topicId,
        difficulty,
        pathStepId,
        tryoutId,
        totalQuestions: questionIds.length,
        durationMinutes,
        items: {
          create: questionIds.map((questionId, index) => ({ questionId, orderIndex: index })),
        },
      },
      include: {
        items: { include: { question: { include: { options: true, passage: true } } }, orderBy: { orderIndex: "asc" } },
      },
    });

    return NextResponse.json(
      { session: { ...session, items: session.items.map(sanitizeItemForActiveSession) } },
      { status: 201 },
    );
  } catch (err) {
    console.error("POST /api/sessions failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
