import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { createTopicSchema } from "@/lib/validations/topic";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const subjectId = request.nextUrl.searchParams.get("subjectId") ?? undefined;

  try {
    const topics = await db.topic.findMany({
      where: subjectId ? { subjectId } : undefined,
      orderBy: [{ subjectId: "asc" }, { orderIndex: "asc" }],
      include: { _count: { select: { questions: true } } },
    });
    return NextResponse.json({ topics });
  } catch (err) {
    console.error("GET /api/topics failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const parsed = createTopicSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Input tidak valid", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  try {
    const topic = await db.topic.create({ data: parsed.data });
    return NextResponse.json({ topic }, { status: 201 });
  } catch (err) {
    console.error("POST /api/topics failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
