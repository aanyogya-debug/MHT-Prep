import { z } from "zod";
import { DIFFICULTIES } from "./question";

// Tiga cara memulai sesi (section 3 & 4): latihan bebas per topik, practice
// step di dalam learning path, atau tryout. `source` menentukan cabang mana
// yang dipakai — bukan `mode` (PRACTICE/SIMULATION), karena dua sumber
// pertama sama-sama mode PRACTICE tapi butuh input berbeda.
export const startSessionSchema = z.discriminatedUnion("source", [
  z.object({
    source: z.literal("topic"),
    topicId: z.string().min(1, "Topik wajib dipilih"),
    questionCount: z.number().int().min(1).max(100),
    difficulty: z.enum(DIFFICULTIES).optional(),
  }),
  z.object({
    source: z.literal("pathStep"),
    pathStepId: z.string().min(1, "Path step wajib diisi"),
  }),
  z.object({
    source: z.literal("tryout"),
    tryoutId: z.string().min(1, "Tryout wajib diisi"),
  }),
]);

export const submitAnswerSchema = z.object({
  questionId: z.string().min(1),
  selectedOptionId: z.string().min(1).nullable(),
});

export type StartSessionInput = z.infer<typeof startSessionSchema>;
export type SubmitAnswerInput = z.infer<typeof submitAnswerSchema>;
