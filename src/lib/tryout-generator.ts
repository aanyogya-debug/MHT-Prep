import type { Difficulty } from "@prisma/client";

// Section 4: admin input kuota per section + band kesulitan -> sistem narik
// soal random dari bank soal -> admin review/tukar soal sebelum publish.
// Modul ini cuma urus algoritma pemilihannya (pure, tidak sentuh DB) —
// pemanggil yang menyuplai daftar kandidat (hasil query Prisma) dan yang
// menyimpan hasilnya.

export interface CandidateQuestion {
  id: string;
  subjectSlug: string;
  difficulty: Difficulty;
}

export type TryoutQuotas = Record<string, number>;

export interface TryoutShortfall {
  subjectSlug: string;
  requested: number;
  available: number;
}

export interface TryoutGenerationResult {
  selectedQuestionIds: string[];
  shortfalls: TryoutShortfall[];
}

export function shuffle<T>(items: T[], random: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// `random` bisa disuplai (mis. mulberry32 dengan seed) supaya hasil bisa
// direproduksi di test; default Math.random utk pemakaian sungguhan.
export function generateTryoutQuestionSet(
  candidates: CandidateQuestion[],
  quotas: TryoutQuotas,
  allowedDifficulties: readonly Difficulty[],
  random: () => number = Math.random,
): TryoutGenerationResult {
  const eligible = candidates.filter((c) => allowedDifficulties.includes(c.difficulty));

  const selectedQuestionIds: string[] = [];
  const shortfalls: TryoutShortfall[] = [];

  for (const [subjectSlug, requested] of Object.entries(quotas)) {
    const pool = shuffle(
      eligible.filter((c) => c.subjectSlug === subjectSlug),
      random,
    );
    const taken = pool.slice(0, requested);
    selectedQuestionIds.push(...taken.map((q) => q.id));

    if (taken.length < requested) {
      shortfalls.push({ subjectSlug, requested, available: pool.length });
    }
  }

  return { selectedQuestionIds, shortfalls };
}
