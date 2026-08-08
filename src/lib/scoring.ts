// Formula skor MHT: benar +4, salah -1, tidak dijawab 0. Dipakai identik di
// latihan bebas, practice step (learning path), dan tryout — satu mesin,
// tiga pemicu (lihat prisma/schema.prisma: ExerciseSession/ExerciseSessionItem).

export const POINTS_CORRECT = 4;
export const POINTS_INCORRECT = -1;
export const POINTS_UNANSWERED = 0;

export interface GradedAnswer {
  isCorrect: boolean | null; // null = tidak dijawab
  pointsEarned: number;
}

export function gradeAnswer(
  selectedOptionId: string | null,
  correctOptionId: string,
): GradedAnswer {
  if (selectedOptionId === null) {
    return { isCorrect: null, pointsEarned: POINTS_UNANSWERED };
  }
  const isCorrect = selectedOptionId === correctOptionId;
  return {
    isCorrect,
    pointsEarned: isCorrect ? POINTS_CORRECT : POINTS_INCORRECT,
  };
}

export interface SessionSummary {
  score: number;
  correctCount: number;
  incorrectCount: number;
  unansweredCount: number;
}

export function summarizeSession(items: GradedAnswer[]): SessionSummary {
  const summary: SessionSummary = {
    score: 0,
    correctCount: 0,
    incorrectCount: 0,
    unansweredCount: 0,
  };

  for (const item of items) {
    summary.score += item.pointsEarned;
    if (item.isCorrect === null) {
      summary.unansweredCount += 1;
    } else if (item.isCorrect) {
      summary.correctCount += 1;
    } else {
      summary.incorrectCount += 1;
    }
  }

  return summary;
}
