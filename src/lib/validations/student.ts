import { z } from "zod";

export const createStudentSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
