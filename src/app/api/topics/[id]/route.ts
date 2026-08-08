import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { updateTopicSchema } from "@/lib/validations/topic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const topic = await db.topic.findUnique({ where: { id } });
    if (!topic) {
      return NextResponse.json({ error: "Topik tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ topic });
  } catch (err) {
    console.error("GET /api/topics/[id] failed:", err);
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
  const parsed = updateTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const topic = await db.topic.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ topic });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Topik tidak ditemukan" }, { status: 404 });
    }
    console.error("PATCH /api/topics/[id] failed:", err);
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
    await db.topic.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === "P2025") {
        return NextResponse.json({ error: "Topik tidak ditemukan" }, { status: 404 });
      }
      // FK constraint (Question/Lesson/PathStep masih menunjuk ke topik ini)
      if (err.code === "P2003" || err.code === "P2014") {
        return NextResponse.json(
          { error: "Topik masih punya soal/materi terkait, tidak bisa dihapus" },
          { status: 409 },
        );
      }
    }
    console.error("DELETE /api/topics/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
