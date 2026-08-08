import { NextResponse, type NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { updateTryoutSchema } from "@/lib/validations/tryout";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const tryout = await db.tryout.findUnique({ where: { id } });
    if (!tryout) {
      return NextResponse.json({ error: "Tryout tidak ditemukan" }, { status: 404 });
    }
    if (tryout.status !== "PUBLISHED" && auth.payload.role !== "ADMIN") {
      return NextResponse.json({ error: "Tryout tidak ditemukan" }, { status: 404 });
    }
    return NextResponse.json({ tryout });
  } catch (err) {
    console.error("GET /api/tryouts/[id] failed:", err);
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
  const parsed = updateTryoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    if (parsed.data.status === "PUBLISHED") {
      const questionCount = await db.tryoutQuestion.count({ where: { tryoutId: id } });
      if (questionCount === 0) {
        return NextResponse.json(
          { error: "Belum ada soal ter-generate — tidak bisa publish tryout kosong" },
          { status: 409 },
        );
      }
    }

    const tryout = await db.tryout.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ tryout });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Tryout tidak ditemukan" }, { status: 404 });
    }
    console.error("PATCH /api/tryouts/[id] failed:", err);
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
    // TryoutQuestion pakai onDelete: Cascade, ExerciseSession.tryout pakai
    // SetNull (histori sesi siswa tetap ada meski tryout-nya dihapus).
    await db.tryout.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ error: "Tryout tidak ditemukan" }, { status: 404 });
    }
    console.error("DELETE /api/tryouts/[id] failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
