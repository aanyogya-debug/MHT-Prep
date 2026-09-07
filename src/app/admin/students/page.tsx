"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Student {
  id: string;
  name: string;
  email: string;
  createdAt: string;
}

export default function AdminStudentsPage() {
  const { user, isReady } = useRequireAuth("ADMIN");

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dialog ganti password terpisah dari "Tambah Siswa" — dipakai saat siswa
  // lupa password. Password lama tidak pernah bisa ditampilkan (tersimpan
  // sbg hash satu-arah), jadi satu-satunya cara "kasih tau siswa" adalah
  // admin set password baru lalu memberitahukannya langsung.
  const [passwordDialogStudent, setPasswordDialogStudent] = useState<Student | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isSavingPassword, setIsSavingPassword] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { students } = await apiFetch<{ students: Student[] }>("/api/students");
        setStudents(students);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady]);

  if (!isReady || !user) return null;

  function openCreateDialog() {
    setName("");
    setEmail("");
    setPassword("");
    setFormError(null);
    setDialogOpen(true);
  }

  function openPasswordDialog(student: Student) {
    setPasswordDialogStudent(student);
    setNewPassword("");
    setPasswordError(null);
  }

  async function handleChangePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!passwordDialogStudent) return;
    setPasswordError(null);
    setIsSavingPassword(true);
    try {
      await apiFetch(`/api/students/${passwordDialogStudent.id}`, {
        method: "PATCH",
        body: JSON.stringify({ password: newPassword }),
      });
      setPasswordDialogStudent(null);
    } catch (err) {
      setPasswordError(err instanceof ApiError ? err.message : "Gagal mengubah password");
    } finally {
      setIsSavingPassword(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);
    try {
      const { student } = await apiFetch<{ student: Student }>("/api/students", {
        method: "POST",
        body: JSON.stringify({ name, email, password }),
      });
      setStudents((prev) => [...prev, student]);
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal membuat akun siswa");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold">Kelola Siswa</h1>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && (
          <>
            <div className="mb-3 flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger render={<Button size="sm" onClick={openCreateDialog} />}>
                  Tambah Siswa
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tambah Siswa</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="student-name">Nama</Label>
                      <Input
                        id="student-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="student-email">Email</Label>
                      <Input
                        id="student-email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="student-password">Password</Label>
                      <Input
                        id="student-password"
                        type="text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isSubmitting}
                        required
                        minLength={8}
                      />
                      <p className="text-xs text-muted-foreground">
                        Dibuat oleh Anda (bukan siswa) — registrasi mandiri ditutup. Catat &
                        berikan ke anak Anda secara langsung.
                      </p>
                    </div>
                    {formError && <p className="text-sm text-destructive">{formError}</p>}
                    <DialogFooter>
                      <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? "Menyimpan..." : "Simpan"}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nama</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Belum ada siswa
                    </TableCell>
                  </TableRow>
                )}
                {students.map((student) => (
                  <TableRow key={student.id}>
                    <TableCell>{student.name}</TableCell>
                    <TableCell>{student.email}</TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/admin/students/${student.id}`} />}
                      >
                        Lihat Progres
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => openPasswordDialog(student)}>
                        Ubah Password
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            <Dialog
              open={passwordDialogStudent !== null}
              onOpenChange={(open) => !open && setPasswordDialogStudent(null)}
            >
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Ubah Password — {passwordDialogStudent?.name}</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="new-password">Password baru</Label>
                    <Input
                      id="new-password"
                      type="text"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      disabled={isSavingPassword}
                      required
                      minLength={8}
                    />
                    <p className="text-xs text-muted-foreground">
                      Password lama tidak bisa ditampilkan (tersimpan sebagai hash). Set yang baru
                      di sini, lalu beri tahu siswa secara langsung.
                    </p>
                  </div>
                  {passwordError && <p className="text-sm text-destructive">{passwordError}</p>}
                  <DialogFooter>
                    <Button type="submit" disabled={isSavingPassword}>
                      {isSavingPassword ? "Menyimpan..." : "Simpan"}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          </>
        )}
      </main>
    </div>
  );
}
