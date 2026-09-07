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
    // Wajib sejak "latihan bertingkat": satu sesi = satu tingkat kesulitan,
    // selalu berisi SELURUH pool soal level itu (bukan jumlah pilihan siswa)
    // — lihat perhitungan questionCount di route.ts, bukan dari input klien.
    difficulty: z.enum(DIFFICULTIES),
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
