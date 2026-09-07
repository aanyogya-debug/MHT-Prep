import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  const { id } = await params;

  try {
    const student = await db.user.findUnique({
      where: { id, role: "STUDENT" },
      select: { id: true, name: true, email: true },
    });
    if (!student) {
      return NextResponse.json({ error: "Siswa tidak ditemukan" }, { status: 404 });
    }

    const [masteryRecords, sessions] = await Promise.all([
      db.masteryRecord.findMany({
        where: { studentId: id },
        include: { topic: { include: { subject: true } } },
      }),
      db.exerciseSession.findMany({
        where: { studentId: id },
        include: { topic: true, tryout: true },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const mastery = masteryRecords
      .map((m) => ({
        topicId: m.topicId,
        topicName: m.topic.name,
        subjectName: m.topic.subject.name,
        difficulty: m.difficulty,
        masteryScore: m.masteryScore,
        questionsAttempted: m.questionsAttempted,
        questionsCorrect: m.questionsCorrect,
      }))
      .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.topicName.localeCompare(b.topicName));

    const sessionSummaries = sessions.map((s) => ({
      id: s.id,
      mode: s.mode,
      status: s.status,
      label: s.tryout?.title ?? s.topic?.name ?? "Campuran",
      score: s.score,
      correctCount: s.correctCount,
      incorrectCount: s.incorrectCount,
      unansweredCount: s.unansweredCount,
      totalQuestions: s.totalQuestions,
      startedAt: s.startedAt,
      submittedAt: s.submittedAt,
    }));

    return NextResponse.json({ student, mastery, sessions: sessionSummaries });
  } catch (err) {
    console.error("GET /api/students/[id]/progress failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
