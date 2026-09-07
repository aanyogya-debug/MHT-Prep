import { z } from "zod";

export const createStudentSchema = z.object({
  name: z.string().min(1, "Nama wajib diisi"),
  email: z.string().email("Email tidak valid"),
  password: z.string().min(8, "Password minimal 8 karakter"),
});

// Dipakai admin utk mengganti password siswa yang lupa (section: "Reset
// Progres" tidak sama dengan ini — reset progres tidak menyentuh akun sama
// sekali). Password lama tidak pernah bisa ditampilkan (tersimpan sbg hash
// satu-arah), jadi satu-satunya cara "kasih tau siswa" adalah set yang baru.
export const updateStudentPasswordSchema = z.object({
  password: z.string().min(8, "Password minimal 8 karakter"),
});

export type CreateStudentInput = z.infer<typeof createStudentSchema>;
export type UpdateStudentPasswordInput = z.infer<typeof updateStudentPasswordSchema>;
