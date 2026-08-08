"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Difficulty, Lesson, PathStep, PathStepType, Topic } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { DIFFICULTIES } from "@/lib/validations/question";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

type PathStepWithLesson = PathStep & { lesson: Lesson | null };

interface StepFormState {
  stepType: PathStepType;
  orderIndex: string;
  lessonId: string;
  difficultyMin: Difficulty;
  difficultyMax: Difficulty;
  questionCount: string;
  unlockThreshold: string; // kosong = null (auto-unlock)
}

function emptyForm(nextOrder: number): StepFormState {
  return {
    stepType: "LESSON",
    orderIndex: String(nextOrder),
    lessonId: "",
    difficultyMin: "EASY",
    difficultyMax: "MEDIUM",
    questionCount: "10",
    unlockThreshold: "60",
  };
}

function formFromStep(step: PathStepWithLesson): StepFormState {
  return {
    stepType: step.stepType,
    orderIndex: String(step.orderIndex),
    lessonId: step.lessonId ?? "",
    difficultyMin: step.difficultyMin ?? "EASY",
    difficultyMax: step.difficultyMax ?? "MEDIUM",
    questionCount: step.questionCount != null ? String(step.questionCount) : "10",
    unlockThreshold: step.unlockThreshold != null ? String(step.unlockThreshold) : "",
  };
}

export default function AdminTopicPathPage() {
  const { user, isReady } = useRequireAuth("ADMIN");
  const { topicId } = useParams<{ topicId: string }>();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [steps, setSteps] = useState<PathStepWithLesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<PathStepWithLesson | null>(null);
  const [form, setForm] = useState<StepFormState>(emptyForm(0));
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [topicRes, lessonsRes, stepsRes] = await Promise.all([
          apiFetch<{ topic: Topic }>(`/api/topics/${topicId}`),
          apiFetch<{ lessons: Lesson[] }>(`/api/lessons?topicId=${topicId}`),
          apiFetch<{ pathSteps: PathStepWithLesson[] }>(`/api/path-steps?topicId=${topicId}`),
        ]);
        setTopic(topicRes.topic);
        setLessons(lessonsRes.lessons);
        setSteps(stepsRes.pathSteps);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady, topicId]);

  if (!isReady || !user) {
    return null;
  }

  function openCreateDialog() {
    setEditingStep(null);
    setForm(emptyForm(steps.length));
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(step: PathStepWithLesson) {
    setEditingStep(step);
    setForm(formFromStep(step));
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setIsSubmitting(true);

    const orderIndex = Number(form.orderIndex);
    const unlockThreshold = form.unlockThreshold.trim() === "" ? null : Number(form.unlockThreshold);

    const payload =
      form.stepType === "LESSON"
        ? { topicId, orderIndex, stepType: "LESSON" as const, lessonId: form.lessonId }
        : {
            topicId,
            orderIndex,
            stepType: "PRACTICE" as const,
            difficultyMin: form.difficultyMin,
            difficultyMax: form.difficultyMax,
            questionCount: Number(form.questionCount),
            unlockThreshold,
          };

    try {
      if (editingStep) {
        const { pathStep } = await apiFetch<{ pathStep: PathStepWithLesson }>(
          `/api/path-steps/${editingStep.id}`,
          { method: "PATCH", body: JSON.stringify(payload) },
        );
        setSteps((prev) => prev.map((s) => (s.id === pathStep.id ? pathStep : s)));
      } else {
        const { pathStep } = await apiFetch<{ pathStep: PathStepWithLesson }>("/api/path-steps", {
          method: "POST",
          body: JSON.stringify(payload),
        });
        setSteps((prev) => [...prev, pathStep]);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan step");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(step: PathStepWithLesson) {
    if (!confirm("Hapus step ini dari path?")) return;
    try {
      await apiFetch(`/api/path-steps/${step.id}`, { method: "DELETE" });
      setSteps((prev) => prev.filter((s) => s.id !== step.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus step");
    }
  }

  const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-4xl flex-1 p-6">
        <Link href="/admin/topics" className="text-sm text-muted-foreground hover:underline">
          &larr; Kembali ke Topik
        </Link>

        {loading && <p className="mt-4 text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="mt-4 text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && topic && (
          <>
            <h1 className="mt-2 mb-4 text-xl font-semibold">Learning Path — {topic.name}</h1>

            <div className="mb-3 flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger render={<Button size="sm" onClick={openCreateDialog} />}>
                  Tambah Step
                </DialogTrigger>
                <DialogContent className="sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingStep ? "Edit Step" : "Tambah Step"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="step-type">Tipe step</Label>
                        <Select
                          value={form.stepType}
                          onValueChange={(v) =>
                            setForm((f) => ({ ...f, stepType: v as PathStepType }))
                          }
                          disabled={!!editingStep}
                        >
                          <SelectTrigger id="step-type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="LESSON">Materi</SelectItem>
                            <SelectItem value="PRACTICE">Latihan</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="step-order">Urutan</Label>
                        <Input
                          id="step-order"
                          type="number"
                          min={0}
                          value={form.orderIndex}
                          onChange={(e) => setForm((f) => ({ ...f, orderIndex: e.target.value }))}
                          disabled={isSubmitting}
                          required
                        />
                      </div>
                    </div>

                    {form.stepType === "LESSON" ? (
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="step-lesson">Materi</Label>
                        <Select
                          value={form.lessonId}
                          onValueChange={(v) => setForm((f) => ({ ...f, lessonId: v as string }))}
                        >
                          <SelectTrigger id="step-lesson">
                            <SelectValue placeholder="Pilih materi" />
                          </SelectTrigger>
                          <SelectContent>
                            {lessons.length === 0 && (
                              <SelectItem value="_none" disabled>
                                Belum ada materi di topik ini
                              </SelectItem>
                            )}
                            {lessons.map((lesson) => (
                              <SelectItem key={lesson.id} value={lesson.id}>
                                {lesson.title}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="step-diff-min">Kesulitan minimum</Label>
                            <Select
                              value={form.difficultyMin}
                              onValueChange={(v) =>
                                setForm((f) => ({ ...f, difficultyMin: v as Difficulty }))
                              }
                            >
                              <SelectTrigger id="step-diff-min">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DIFFICULTIES.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="step-diff-max">Kesulitan maksimum</Label>
                            <Select
                              value={form.difficultyMax}
                              onValueChange={(v) =>
                                setForm((f) => ({ ...f, difficultyMax: v as Difficulty }))
                              }
                            >
                              <SelectTrigger id="step-diff-max">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {DIFFICULTIES.map((d) => (
                                  <SelectItem key={d} value={d}>
                                    {d}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="step-question-count">Jumlah soal</Label>
                            <Input
                              id="step-question-count"
                              type="number"
                              min={1}
                              value={form.questionCount}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, questionCount: e.target.value }))
                              }
                              disabled={isSubmitting}
                              required
                            />
                          </div>
                          <div className="flex flex-col gap-2">
                            <Label htmlFor="step-threshold">
                              Skor lulus (kosong = auto-unlock)
                            </Label>
                            <Input
                              id="step-threshold"
                              type="number"
                              min={0}
                              max={100}
                              value={form.unlockThreshold}
                              onChange={(e) =>
                                setForm((f) => ({ ...f, unlockThreshold: e.target.value }))
                              }
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>
                      </>
                    )}

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
                  <TableHead>Urutan</TableHead>
                  <TableHead>Tipe</TableHead>
                  <TableHead>Detail</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSteps.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Belum ada step
                    </TableCell>
                  </TableRow>
                )}
                {sortedSteps.map((step) => (
                  <TableRow key={step.id}>
                    <TableCell>{step.orderIndex}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {step.stepType === "LESSON" ? "Materi" : "Latihan"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {step.stepType === "LESSON"
                        ? (step.lesson?.title ?? "(materi tidak ditemukan)")
                        : `${step.difficultyMin}-${step.difficultyMax} · ${step.questionCount} soal · lulus ${step.unlockThreshold ?? "auto"}`}
                    </TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(step)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(step)}>
                        Hapus
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
