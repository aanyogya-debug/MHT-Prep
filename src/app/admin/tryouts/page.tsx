"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Subject, Tryout } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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

export default function AdminTryoutsPage() {
  const { user, isReady } = useRequireAuth("ADMIN");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [tryouts, setTryouts] = useState<Tryout[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [difficultyTier, setDifficultyTier] = useState("");
  const [quotas, setQuotas] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [subjectsRes, tryoutsRes] = await Promise.all([
          apiFetch<{ subjects: Subject[] }>("/api/subjects"),
          apiFetch<{ tryouts: Tryout[] }>("/api/tryouts"),
        ]);
        setSubjects(subjectsRes.subjects);
        setTryouts(tryoutsRes.tryouts);
        setQuotas(Object.fromEntries(subjectsRes.subjects.map((s) => [s.slug, "0"])));
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady]);

  if (!isReady || !user) {
    return null;
  }

  function openCreateDialog() {
    setTitle("");
    setDifficultyTier("");
    setQuotas(Object.fromEntries(subjects.map((s) => [s.slug, "0"])));
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const sectionQuotas = Object.fromEntries(
      Object.entries(quotas).map(([slug, value]) => [slug, Number(value) || 0]),
    );

    try {
      const { tryout } = await apiFetch<{ tryout: Tryout }>("/api/tryouts", {
        method: "POST",
        body: JSON.stringify({ title, difficultyTier, sectionQuotas }),
      });
      setTryouts((prev) => [tryout, ...prev]);
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal membuat tryout");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold">Kelola Tryout</h1>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && (
          <>
            <div className="mb-3 flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger render={<Button size="sm" onClick={openCreateDialog} />}>
                  Tambah Tryout
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Tambah Tryout</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="tryout-title">Judul</Label>
                      <Input
                        id="tryout-title"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label htmlFor="tryout-tier">Label tingkat kesulitan</Label>
                      <Input
                        id="tryout-tier"
                        placeholder="mis. easy-medium"
                        value={difficultyTier}
                        onChange={(e) => setDifficultyTier(e.target.value)}
                        disabled={isSubmitting}
                        required
                      />
                    </div>
                    <div className="flex flex-col gap-2">
                      <Label>Kuota soal per subject</Label>
                      {subjects.map((subject) => (
                        <div key={subject.id} className="flex items-center gap-2">
                          <span className="w-40 shrink-0 text-sm">{subject.name}</span>
                          <Input
                            type="number"
                            min={0}
                            value={quotas[subject.slug] ?? "0"}
                            onChange={(e) =>
                              setQuotas((q) => ({ ...q, [subject.slug]: e.target.value }))
                            }
                            disabled={isSubmitting}
                          />
                        </div>
                      ))}
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
                  <TableHead>Judul</TableHead>
                  <TableHead>Tingkat</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tryouts.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Belum ada tryout
                    </TableCell>
                  </TableRow>
                )}
                {tryouts.map((tryout) => (
                  <TableRow key={tryout.id}>
                    <TableCell>{tryout.title}</TableCell>
                    <TableCell>{tryout.difficultyTier}</TableCell>
                    <TableCell>
                      <Badge variant={tryout.status === "PUBLISHED" ? "default" : "secondary"}>
                        {tryout.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/admin/tryouts/${tryout.id}`} />}
                      >
                        Kelola
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </>
        )}
      </main>
    </div>
  );
}
