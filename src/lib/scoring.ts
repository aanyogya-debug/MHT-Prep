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

// unlockThreshold (PathStep, section 3 brief: "default 60") adalah PERSENTASE
// dari skor maksimum sesi, bukan skor mentah — skor mentah 5 soal cuma bisa
// maksimum 20 (5*4), jadi threshold 60 mustahil tercapai kalau dibandingkan
// mentah-mentah. Dikonversi di sini supaya threshold tetap masuk akal
// berapa pun jumlah soal di practice step-nya.
export function scoreToPercentage(score: number, totalQuestions: number): number {
  if (totalQuestions <= 0) return 0;
  const maxScore = totalQuestions * POINTS_CORRECT;
  return (score / maxScore) * 100;
}
