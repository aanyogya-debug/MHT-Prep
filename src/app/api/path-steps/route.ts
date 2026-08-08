import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { createPathStepSchema } from "@/lib/validations/path-step";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const topicId = request.nextUrl.searchParams.get("topicId");
  if (!topicId) {
    return NextResponse.json({ error: "Parameter topicId wajib diisi" }, { status: 400 });
  }

  try {
    const pathSteps = await db.pathStep.findMany({
      where: { topicId },
      include: { lesson: true },
      orderBy: { orderIndex: "asc" },
    });
    return NextResponse.json({ pathSteps });
  } catch (err) {
    console.error("GET /api/path-steps failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createPathStepSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const data = parsed.data;

  try {
    // Materi yang dipilih harus benar-benar milik topik yang sama — tidak
    // bisa divalidasi Zod murni, perlu cek silang ke DB.
    if (data.stepType === "LESSON") {
      const lesson = await db.lesson.findUnique({ where: { id: data.lessonId } });
      if (!lesson || lesson.topicId !== data.topicId) {
        return NextResponse.json(
          { error: "Materi tidak ditemukan di topik ini" },
          { status: 400 },
        );
      }
    }

    const pathStep = await db.pathStep.create({ data, include: { lesson: true } });
    return NextResponse.json({ pathStep }, { status: 201 });
  } catch (err) {
    console.error("POST /api/path-steps failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
