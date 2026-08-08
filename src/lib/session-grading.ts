import type { Prisma } from "@prisma/client";
import { gradeAnswer, summarizeSession, scoreToPercentage, type GradedAnswer } from "./scoring";
import { hasPassedThreshold } from "./learning-path";
import { markStepCompletedAndUnlockNext } from "./path-progress-service";

// Dipakai baik oleh submit manual (tombol "Hentikan Tes") maupun auto-submit
// saat timer habis (dicek lazy di GET/answer, bukan cron/background job —
// cukup utk skala "1 admin banyak student", lihat section 7). Idempotent:
// no-op kalau sesi sudah final (SUBMITTED/EXPIRED), supaya request ganda tidak
// menggrading ulang dan mengacaukan skor.
export async function finalizeSession(
  tx: Prisma.TransactionClient,
  sessionId: string,
  reason: "SUBMITTED" | "EXPIRED",
): Promise<void> {
  const session = await tx.exerciseSession.findUniqueOrThrow({
    where: { id: sessionId },
    include: {
      items: { include: { question: { include: { options: true } } } },
    },
  });

  if (session.status !== "IN_PROGRESS") return;

  const gradedItems: { itemId: string; topicId: string; graded: GradedAnswer }[] = [];
  for (const item of session.items) {
    const correctOption = item.question.options.find((o) => o.isCorrect);
    const graded = gradeAnswer(item.selectedOptionId, correctOption?.id ?? "");
    gradedItems.push({ itemId: item.id, topicId: item.question.topicId, graded });
  }

  const summary = summarizeSession(gradedItems.map((g) => g.graded));

  await Promise.all(
    gradedItems.map(({ itemId, graded }) =>
      tx.exerciseSessionItem.update({
        where: { id: itemId },
        data: { isCorrect: graded.isCorrect, pointsEarned: graded.pointsEarned },
      }),
    ),
  );

  await tx.exerciseSession.update({
    where: { id: sessionId },
    data: {
      status: reason,
      submittedAt: new Date(),
      score: summary.score,
      correctCount: summary.correctCount,
      incorrectCount: summary.incorrectCount,
      unansweredCount: summary.unansweredCount,
    },
  });

  await updateMasteryRecords(tx, session.studentId, gradedItems);

  if (session.pathStepId) {
    await updatePathProgress(
      tx,
      session.studentId,
      session.pathStepId,
      session.id,
      summary.score,
      session.totalQuestions,
    );
  }
}

async function updateMasteryRecords(
  tx: Prisma.TransactionClient,
  studentId: string,
  gradedItems: { topicId: string; graded: GradedAnswer }[],
): Promise<void> {
  const byTopic = new Map<string, { attempted: number; correct: number }>();
  for (const { topicId, graded } of gradedItems) {
    if (graded.isCorrect === null) continue; // tidak dijawab -> bukan "attempted"
    const entry = byTopic.get(topicId) ?? { attempted: 0, correct: 0 };
    entry.attempted += 1;
    if (graded.isCorrect) entry.correct += 1;
    byTopic.set(topicId, entry);
  }

  for (const [topicId, delta] of byTopic) {
    const existing = await tx.masteryRecord.findUnique({
      where: { studentId_topicId: { studentId, topicId } },
    });
    const questionsAttempted = (existing?.questionsAttempted ?? 0) + delta.attempted;
    const questionsCorrect = (existing?.questionsCorrect ?? 0) + delta.correct;
    // Formula sengaja sederhana (tidak dispesifikkan di brief): akurasi
    // kumulatif seluruh soal topik ini yang pernah dikerjakan siswa.
    const masteryScore = (questionsCorrect / questionsAttempted) * 100;

    await tx.masteryRecord.upsert({
      where: { studentId_topicId: { studentId, topicId } },
      create: { studentId, topicId, questionsAttempted, questionsCorrect, masteryScore },
      update: { questionsAttempted, questionsCorrect, masteryScore },
    });
  }
}

async function updatePathProgress(
  tx: Prisma.TransactionClient,
  studentId: string,
  pathStepId: string,
  sessionId: string,
  score: number,
  totalQuestions: number,
): Promise<void> {
  const pathStep = await tx.pathStep.findUniqueOrThrow({ where: { id: pathStepId } });
  const percentage = scoreToPercentage(score, totalQuestions);
  const passed = hasPassedThreshold(percentage, pathStep.unlockThreshold);

  if (passed) {
    await markStepCompletedAndUnlockNext(tx, studentId, pathStepId, sessionId);
    return;
  }

  // Belum lulus threshold — tetap UNLOCKED (bukan dikunci ulang), siswa
  // boleh retry: sesi baru dibuat, nyambung ke pathStepId yang sama.
  await tx.studentPathProgress.upsert({
    where: { studentId_pathStepId: { studentId, pathStepId } },
    create: { studentId, pathStepId, status: "UNLOCKED", sessionId },
    update: { status: "UNLOCKED", sessionId },
  });
}

export function isSessionExpired(session: {
  startedAt: Date;
  durationMinutes: number;
}): boolean {
  const deadline = session.startedAt.getTime() + session.durationMinutes * 60_000;
  return Date.now() > deadline;
}
