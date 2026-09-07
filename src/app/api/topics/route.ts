import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireAuth, requireRole } from "@/lib/auth/guard";
import { createTopicSchema } from "@/lib/validations/topic";

export async function GET(request: NextRequest) {
  const auth = requireAuth(request);
  if (!auth.ok) return auth.response;

  const subjectId = request.nextUrl.searchParams.get("subjectId") ?? undefined;

  try {
    const [topics, difficultyCounts] = await Promise.all([
      db.topic.findMany({
        where: subjectId ? { subjectId } : undefined,
        orderBy: [{ subjectId: "asc" }, { orderIndex: "asc" }],
        include: { _count: { select: { questions: true } } },
      }),
      // Dipakai daftar subbab siswa (section "latihan bertingkat") utk
      // menampilkan jumlah soal per level Mudah/Sedang/Sulit, bukan cuma
      // total gabungan — satu query groupBy utk semua topik sekaligus.
      db.question.groupBy({
        by: ["topicId", "difficulty"],
        where: subjectId ? { topic: { subjectId } } : undefined,
        _count: true,
      }),
    ]);

    const countsByTopic = new Map<string, { EASY: number; MEDIUM: number; HARD: number }>();
    for (const row of difficultyCounts) {
      const entry = countsByTopic.get(row.topicId) ?? { EASY: 0, MEDIUM: 0, HARD: 0 };
      entry[row.difficulty] = row._count;
      countsByTopic.set(row.topicId, entry);
    }

    const topicsWithCounts = topics.map((t) => ({
      ...t,
      questionCounts: countsByTopic.get(t.id) ?? { EASY: 0, MEDIUM: 0, HARD: 0 },
    }));

    return NextResponse.json({ topics: topicsWithCounts });
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
