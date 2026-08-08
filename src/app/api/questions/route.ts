import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { createQuestionSchema, OPTION_LABELS } from "@/lib/validations/question";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const topicId = request.nextUrl.searchParams.get("topicId");
  if (!topicId) {
    return NextResponse.json({ error: "Parameter topicId wajib diisi" }, { status: 400 });
  }

  try {
    const questions = await db.question.findMany({
      where: { topicId },
      include: { options: true },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ questions });
  } catch (err) {
    console.error("GET /api/questions failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { options, imageUrl, sourceImageUrl, ...rest } = parsed.data;

  try {
    const question = await db.question.create({
      data: {
        ...rest,
        imageUrl: imageUrl || undefined,
        sourceImageUrl: sourceImageUrl || undefined,
        createdById: auth.payload.sub,
        options: {
          create: options.map((option, index) => ({
            label: OPTION_LABELS[index],
            text: option.text,
            isCorrect: option.isCorrect,
          })),
        },
      },
      include: { options: true },
    });
    return NextResponse.json({ question }, { status: 201 });
  } catch (err) {
    console.error("POST /api/questions failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
