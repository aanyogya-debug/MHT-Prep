import { z } from "zod";
import { DIFFICULTIES } from "./question";

const DIFFICULTY_ORDER: Record<(typeof DIFFICULTIES)[number], number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

const lessonStepSchema = z.object({
  topicId: z.string().min(1, "Topik wajib dipilih"),
  orderIndex: z.number().int().min(0).default(0),
  stepType: z.literal("LESSON"),
  lessonId: z.string().min(1, "Materi wajib dipilih"),
});

const practiceStepSchema = z
  .object({
    topicId: z.string().min(1, "Topik wajib dipilih"),
    orderIndex: z.number().int().min(0).default(0),
    stepType: z.literal("PRACTICE"),
    difficultyMin: z.enum(DIFFICULTIES),
    difficultyMax: z.enum(DIFFICULTIES),
    questionCount: z.number().int().min(1, "Jumlah soal wajib diisi"),
    // nullable = auto-unlock tanpa syarat skor (section 3 & 8)
    unlockThreshold: z.number().int().min(0).max(100).nullable().optional(),
  })
  .refine((data) => DIFFICULTY_ORDER[data.difficultyMin] <= DIFFICULTY_ORDER[data.difficultyMax], {
    message: "Tingkat kesulitan minimum harus <= maksimum",
    path: ["difficultyMax"],
  });

export const createPathStepSchema = z.discriminatedUnion("stepType", [
  lessonStepSchema,
  practiceStepSchema,
]);

export const updatePathStepSchema = z.object({
  orderIndex: z.number().int().min(0).optional(),
  lessonId: z.string().min(1).optional(),
  difficultyMin: z.enum(DIFFICULTIES).optional(),
  difficultyMax: z.enum(DIFFICULTIES).optional(),
  questionCount: z.number().int().min(1).optional(),
  unlockThreshold: z.number().int().min(0).max(100).nullable().optional(),
});

export type CreatePathStepInput = z.infer<typeof createPathStepSchema>;
export type UpdatePathStepInput = z.infer<typeof updatePathStepSchema>;
