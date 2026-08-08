import { z } from "zod";

export const DIFFICULTIES = ["EASY", "MEDIUM", "HARD"] as const;

// Format ujian MHT: pilihan ganda 5 opsi (A-E). Label diberikan server-side
// berdasarkan urutan array, bukan input admin — menghindari label
// duplikat/typo (mis. dua opsi sama-sama "C").
const optionInputSchema = z.object({
  text: z.string().min(1, "Teks pilihan wajib diisi"),
  isCorrect: z.boolean(),
});

const optionsInputSchema = z
  .array(optionInputSchema)
  .length(5, "Harus ada tepat 5 pilihan jawaban (A-E)")
  .refine((opts) => opts.filter((o) => o.isCorrect).length === 1, {
    message: "Harus ada tepat satu jawaban benar",
  });

const optionalUrl = z
  .string()
  .trim()
  .refine((v) => v === "" || z.string().url().safeParse(v).success, "URL tidak valid")
  .optional();

export const createQuestionSchema = z.object({
  topicId: z.string().min(1, "Topik wajib dipilih"),
  difficulty: z.enum(DIFFICULTIES),
  questionText: z.string().min(1, "Teks soal wajib diisi"),
  explanation: z.string().optional(),
  imageUrl: optionalUrl,
  sourceImageUrl: optionalUrl,
  options: optionsInputSchema,
});

export const updateQuestionSchema = z.object({
  topicId: z.string().min(1).optional(),
  difficulty: z.enum(DIFFICULTIES).optional(),
  questionText: z.string().min(1).optional(),
  explanation: z.string().optional(),
  imageUrl: optionalUrl,
  sourceImageUrl: optionalUrl,
  options: optionsInputSchema.optional(),
});

export type CreateQuestionInput = z.infer<typeof createQuestionSchema>;
export type UpdateQuestionInput = z.infer<typeof updateQuestionSchema>;

export const OPTION_LABELS = ["A", "B", "C", "D", "E"] as const;

const DIFFICULTY_ORDER: Record<(typeof DIFFICULTIES)[number], number> = {
  EASY: 0,
  MEDIUM: 1,
  HARD: 2,
};

// Dipakai saat menarik soal utk practice step (PathStep.difficultyMin/Max
// mendeskripsikan rentang inklusif, bukan satu nilai).
export function difficultyRange(
  min: (typeof DIFFICULTIES)[number],
  max: (typeof DIFFICULTIES)[number],
): (typeof DIFFICULTIES)[number][] {
  const lo = DIFFICULTY_ORDER[min];
  const hi = DIFFICULTY_ORDER[max];
  return DIFFICULTIES.filter((d) => DIFFICULTY_ORDER[d] >= lo && DIFFICULTY_ORDER[d] <= hi);
}
