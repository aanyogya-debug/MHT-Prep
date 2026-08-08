import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { generateTryoutSchema, sectionQuotasSchema } from "@/lib/validations/tryout";
import { generateTryoutQuestionSet, type CandidateQuestion } from "@/lib/tryout-generator";

// Section 4: admin input kuota (sudah tersimpan di Tryout.sectionQuotas) +
// band kesulitan (dipilih tiap generate, body request ini) -> sistem narik
// ulang soal random dari bank soal. Generate ulang MENGGANTI TOTAL set soal
// sebelumnya (bukan menambah) — kalau admin cuma mau tukar satu-dua soal,
// pakai endpoint /questions (add) & /questions/[id] (remove) instead.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = generateTryoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const tryout = await db.tryout.findUnique({ where: { id } });
    if (!tryout) {
      return NextResponse.json({ error: "Tryout tidak ditemukan" }, { status: 404 });
    }

    const quotasResult = sectionQuotasSchema.safeParse(tryout.sectionQuotas);
    if (!quotasResult.success) {
      return NextResponse.json(
        { error: "sectionQuotas tryout ini rusak/tidak valid" },
        { status: 500 },
      );
    }

    const questions = await db.question.findMany({
      select: {
        id: true,
        difficulty: true,
        topic: { select: { subject: { select: { slug: true } } } },
      },
    });
    const candidates: CandidateQuestion[] = questions.map((q) => ({
      id: q.id,
      subjectSlug: q.topic.subject.slug,
      difficulty: q.difficulty,
    }));

    const result = generateTryoutQuestionSet(
      candidates,
      quotasResult.data,
      parsed.data.allowedDifficulties,
    );

    await db.$transaction([
      db.tryoutQuestion.deleteMany({ where: { tryoutId: id } }),
      ...(result.selectedQuestionIds.length > 0
        ? [
            db.tryoutQuestion.createMany({
              data: result.selectedQuestionIds.map((questionId, index) => ({
                tryoutId: id,
                questionId,
                orderIndex: index,
              })),
            }),
          ]
        : []),
    ]);

    return NextResponse.json({
      selectedCount: result.selectedQuestionIds.length,
      shortfalls: result.shortfalls,
    });
  } catch (err) {
    console.error("POST /api/tryouts/[id]/generate failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
