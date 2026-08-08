import type { Question, QuestionOption, ExerciseSessionItem, Passage } from "@prisma/client";

type ItemWithQuestion = ExerciseSessionItem & {
  question: Question & { options: QuestionOption[]; passage: Passage | null };
};

export interface SanitizedOption {
  id: string;
  label: string;
  text: string;
}

export interface SanitizedPassage {
  id: string;
  title: string;
  content: string;
}

export interface SanitizedItem {
  id: string;
  orderIndex: number;
  selectedOptionId: string | null;
  answeredAt: Date | null;
  question: {
    id: string;
    difficulty: Question["difficulty"];
    questionText: string;
    imageUrl: string | null;
    options: SanitizedOption[];
    passage: SanitizedPassage | null;
  };
}

// Dipakai selama sesi IN_PROGRESS: sembunyikan isCorrect tiap opsi dan
// explanation soal, supaya tidak bisa "dicontek" siswa lewat network tab
// selagi timer masih jalan. Setelah submit, endpoint hasil boleh pakai
// data mentah (options+explanation lengkap) — bukan fungsi ini.
// Isi passage (bacaan reading comprehension) BUKAN rahasia — aman ditampilkan
// selama sesi berjalan, cuma isCorrect/explanation yang disembunyikan.
export function sanitizeItemForActiveSession(item: ItemWithQuestion): SanitizedItem {
  return {
    id: item.id,
    orderIndex: item.orderIndex,
    selectedOptionId: item.selectedOptionId,
    answeredAt: item.answeredAt,
    question: {
      id: item.question.id,
      difficulty: item.question.difficulty,
      questionText: item.question.questionText,
      imageUrl: item.question.imageUrl,
      options: item.question.options.map((o) => ({ id: o.id, label: o.label, text: o.text })),
      passage: item.question.passage
        ? { id: item.question.passage.id, title: item.question.passage.title, content: item.question.passage.content }
        : null,
    },
  };
}
