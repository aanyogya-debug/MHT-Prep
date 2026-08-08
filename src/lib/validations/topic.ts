import { z } from "zod";

export const createTopicSchema = z.object({
  subjectId: z.string().min(1, "Subject wajib dipilih"),
  name: z.string().min(1, "Nama topik wajib diisi"),
  orderIndex: z.number().int().min(0).default(0),
});

export const updateTopicSchema = z.object({
  name: z.string().min(1, "Nama topik wajib diisi").optional(),
  orderIndex: z.number().int().min(0).optional(),
});

export type CreateTopicInput = z.infer<typeof createTopicSchema>;
export type UpdateTopicInput = z.infer<typeof updateTopicSchema>;
