import { z } from "zod";

export const createLessonSchema = z.object({
  topicId: z.string().min(1, "Topik wajib dipilih"),
  title: z.string().min(1, "Judul materi wajib diisi"),
  content: z.string().min(1, "Isi materi wajib diisi"),
  orderIndex: z.number().int().min(0).default(0),
});

export const updateLessonSchema = z.object({
  title: z.string().min(1, "Judul materi wajib diisi").optional(),
  content: z.string().min(1, "Isi materi wajib diisi").optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export type CreateLessonInput = z.infer<typeof createLessonSchema>;
export type UpdateLessonInput = z.infer<typeof updateLessonSchema>;
