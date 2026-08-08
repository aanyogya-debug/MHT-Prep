import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { updatePathStepSchema } from "@/lib/validations/path-step";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updatePathStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const existing = await db.pathStep.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ error: "Path step tidak ditemukan" }, { status: 404 });
    }

    if (parsed.data.lessonId) {
      if (existing.stepType !== "LESSON") {
        return NextResponse.json(
          { error: "lessonId hanya berlaku utk step bertipe LESSON" },
          { status: 400 },
        );
      }
      const lesson = await db.lesson.findUnique({ where: { id: parsed.data.lessonId } });
      if (!lesson || lesson.topicId !== existing.topicId) {
        return NextResponse.json(
          { error: "Materi tidak ditemukan di topik ini" },
          { status: 400 },
        );
      }
    }

    const pathStep = await db.pathStep.update({
      where: { id },
      data: parsed.data,
      include: { lesson: true },
    });
    return NextResponse.json({ pathStep });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Path step tidak ditemukan" }, { status: 404 });
    }
    console.error("PATCH /api/path-steps/[id] failed:", err);
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
    // StudentPathProgress.pathStep pakai Cascade (progres ikut terhapus),
    // ExerciseSession.pathStep pakai SetNull (histori sesi tetap ada,
    // cuma dilepas dari step yg dihapus) — tidak ada FK violation di sini.
    await db.pathStep.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Path step tidak ditemukan" }, { status: 404 });
    }
    console.error("DELETE /api/path-steps/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
