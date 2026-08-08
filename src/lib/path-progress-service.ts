import type { Prisma } from "@prisma/client";
import { computeUnlockedStepIds } from "./learning-path";

// Menandai satu path step selesai utk seorang siswa, lalu membuka step
// berikutnya di topik yang sama kalau ada. Dipakai baik oleh submit sesi
// practice (session-grading.ts — "selesai" berarti lulus unlockThreshold)
// maupun endpoint mark-lesson-complete (path-steps/[id]/complete —
// "selesai" berarti materi sudah dibuka siswa).
export async function markStepCompletedAndUnlockNext(
  tx: Prisma.TransactionClient,
  studentId: string,
  pathStepId: string,
  sessionId?: string,
): Promise<void> {
  const pathStep = await tx.pathStep.findUniqueOrThrow({ where: { id: pathStepId } });

  await tx.studentPathProgress.upsert({
    where: { studentId_pathStepId: { studentId, pathStepId } },
    create: { studentId, pathStepId, status: "COMPLETED", sessionId, completedAt: new Date() },
    update: { status: "COMPLETED", sessionId, completedAt: new Date() },
  });

  const siblingSteps = await tx.pathStep.findMany({ where: { topicId: pathStep.topicId } });
  const progressRows = await tx.studentPathProgress.findMany({
    where: { studentId, pathStepId: { in: siblingSteps.map((s) => s.id) } },
  });
  const completedIds = new Set(
    progressRows.filter((p) => p.status === "COMPLETED").map((p) => p.pathStepId),
  );
  completedIds.add(pathStepId);

  const unlockedIds = computeUnlockedStepIds(siblingSteps, completedIds);
  const nextStep = siblingSteps
    .filter((s) => unlockedIds.has(s.id) && !completedIds.has(s.id))
    .sort((a, b) => a.orderIndex - b.orderIndex)[0];

  if (!nextStep) return;

  await tx.studentPathProgress.upsert({
    where: { studentId_pathStepId: { studentId, pathStepId: nextStep.id } },
    create: { studentId, pathStepId: nextStep.id, status: "UNLOCKED" },
    update: { status: "UNLOCKED" },
  });
}
