import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { updateLessonSchema } from "@/lib/validations/lesson";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const parsed = updateLessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const lesson = await db.lesson.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ lesson });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404 });
    }
    console.error("PATCH /api/lessons/[id] failed:", err);
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
    // PathStep.lessonId pakai onDelete: SetNull, jadi tidak ada FK violation
    // di sini — path step yang menunjuk ke materi ini otomatis di-null-kan.
    await db.lesson.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Materi tidak ditemukan" }, { status: 404 });
    }
    console.error("DELETE /api/lessons/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
