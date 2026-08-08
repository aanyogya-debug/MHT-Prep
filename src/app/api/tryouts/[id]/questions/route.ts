import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { addTryoutQuestionSchema } from "@/lib/validations/tryout";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const tryoutQuestions = await db.tryoutQuestion.findMany({
      where: { tryoutId: id },
      include: { question: { include: { options: true } } },
      orderBy: { orderIndex: "asc" },
    });
    return NextResponse.json({ tryoutQuestions });
  } catch (err) {
    console.error("GET /api/tryouts/[id]/questions failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

// Tambah satu soal spesifik — dipakai admin utk "menukar" (hapus salah satu
// lewat DELETE /questions/[tryoutQuestionId], lalu tambah penggantinya di sini).
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = addTryoutQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const [tryout, question, currentCount, alreadyIncluded] = await Promise.all([
      db.tryout.findUnique({ where: { id } }),
      db.question.findUnique({ where: { id: parsed.data.questionId } }),
      db.tryoutQuestion.count({ where: { tryoutId: id } }),
      db.tryoutQuestion.findUnique({
        where: { tryoutId_questionId: { tryoutId: id, questionId: parsed.data.questionId } },
      }),
    ]);

    if (!tryout) {
      return NextResponse.json({ error: "Tryout tidak ditemukan" }, { status: 404 });
    }
    if (!question) {
      return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }
    if (alreadyIncluded) {
      return NextResponse.json({ error: "Soal ini sudah ada di tryout" }, { status: 409 });
    }

    const tryoutQuestion = await db.tryoutQuestion.create({
      data: { tryoutId: id, questionId: parsed.data.questionId, orderIndex: currentCount },
      include: { question: { include: { options: true } } },
    });
    return NextResponse.json({ tryoutQuestion }, { status: 201 });
  } catch (err) {
    console.error("POST /api/tryouts/[id]/questions failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
