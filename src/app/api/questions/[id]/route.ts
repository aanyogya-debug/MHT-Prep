import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { updateQuestionSchema, OPTION_LABELS } from "@/lib/validations/question";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const question = await db.question.findUnique({
      where: { id },
      include: { options: true },
    });
    if (!question) {
      return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ question });
  } catch (err) {
    console.error("GET /api/questions/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateQuestionSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { options, imageUrl, sourceImageUrl, ...rest } = parsed.data;

  try {
    const question = await db.question.update({
      where: { id },
      data: {
        ...rest,
        imageUrl: imageUrl || undefined,
        sourceImageUrl: sourceImageUrl || undefined,
        // Form edit selalu kirim semua opsi sekaligus — replace total lebih
        // sederhana & aman daripada mencocokkan id opsi lama satu-satu.
        ...(options
          ? {
              options: {
                deleteMany: {},
                create: options.map((option, index) => ({
                  label: OPTION_LABELS[index],
                  text: option.text,
                  isCorrect: option.isCorrect,
                })),
              },
            }
          : {}),
      },
      include: { options: true },
    });
    return NextResponse.json({ question });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
    }
    console.error("PATCH /api/questions/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    await db.question.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json({ error: "Soal tidak ditemukan" }, { status: 404 });
      }
      // ExerciseSessionItem.question pakai onDelete: Restrict — soal yang
      // sudah pernah dipakai di sesi latihan tidak boleh dihapus begitu saja.
      if (err.code === "P2003" || err.code === "P2014") {
        return NextResponse.json(
          { error: "Soal sudah pernah dipakai di sesi latihan, tidak bisa dihapus" },
          { status: 409 },
        );
      }
    }
    console.error("DELETE /api/questions/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
