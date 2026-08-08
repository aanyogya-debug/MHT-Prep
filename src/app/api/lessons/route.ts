import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { createLessonSchema } from "@/lib/validations/lesson";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const topicId = request.nextUrl.searchParams.get("topicId");
  if (!topicId) {
    return NextResponse.json({ error: "Parameter topicId wajib diisi" }, { status: 400 });
  }

  try {
    const lessons = await db.lesson.findMany({
      where: { topicId },
      orderBy: { orderIndex: "asc" },
    });
    return NextResponse.json({ lessons });
  } catch (err) {
    console.error("GET /api/lessons failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createLessonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const lesson = await db.lesson.create({
      data: { ...parsed.data, createdById: auth.payload.sub },
    });
    return NextResponse.json({ lesson }, { status: 201 });
  } catch (err) {
    console.error("POST /api/lessons failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
