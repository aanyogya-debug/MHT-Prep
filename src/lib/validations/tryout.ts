import { z } from "zod";
import { DIFFICULTIES } from "./question";

export const sectionQuotasSchema = z
  .record(z.string().min(1), z.number().int().min(0))
  .refine((quotas) => Object.values(quotas).some((v) => v > 0), {
    message: "Minimal satu section harus punya kuota > 0",
  });

export const createTryoutSchema = z.object({
  title: z.string().min(1, "Judul tryout wajib diisi"),
  difficultyTier: z.string().min(1, "Label tingkat kesulitan wajib diisi"),
  sectionQuotas: sectionQuotasSchema,
});

export const updateTryoutSchema = z.object({
  title: z.string().min(1).optional(),
  difficultyTier: z.string().min(1).optional(),
  sectionQuotas: sectionQuotasSchema.optional(),
  status: z.enum(["DRAFT", "PUBLISHED"]).optional(),
});

export const generateTryoutSchema = z.object({
  allowedDifficulties: z
    .array(z.enum(DIFFICULTIES))
    .min(1, "Pilih minimal satu tingkat kesulitan"),
});

export const addTryoutQuestionSchema = z.object({
  questionId: z.string().min(1, "Soal wajib dipilih"),
});

export type CreateTryoutInput = z.infer<typeof createTryoutSchema>;
export type UpdateTryoutInput = z.infer<typeof updateTryoutSchema>;
export type GenerateTryoutInput = z.infer<typeof generateTryoutSchema>;
