"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Lesson, Topic } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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

interface LessonFormState {
  title: string;
  orderIndex: string;
  content: string;
}

const EMPTY_FORM: LessonFormState = { title: "", orderIndex: "0", content: "" };

export default function AdminTopicLessonsPage() {
  const { user, isReady } = useRequireAuth("ADMIN");
  const { topicId } = useParams<{ topicId: string }>();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLesson, setEditingLesson] = useState<Lesson | null>(null);
  const [form, setForm] = useState<LessonFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [topicRes, lessonsRes] = await Promise.all([
          apiFetch<{ topic: Topic }>(`/api/topics/${topicId}`),
          apiFetch<{ lessons: Lesson[] }>(`/api/lessons?topicId=${topicId}`),
        ]);
        setTopic(topicRes.topic);
        setLessons(lessonsRes.lessons);
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
    setEditingLesson(null);
    setForm({ ...EMPTY_FORM, orderIndex: String(lessons.length) });
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(lesson: Lesson) {
    setEditingLesson(lesson);
    setForm({
      title: lesson.title,
      orderIndex: String(lesson.orderIndex),
      content: lesson.content,
    });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError(null);
    setIsSubmitting(true);
    try {
      const orderIndex = Number(form.orderIndex);
      if (editingLesson) {
        const { lesson } = await apiFetch<{ lesson: Lesson }>(`/api/lessons/${editingLesson.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: form.title, content: form.content, orderIndex }),
        });
        setLessons((prev) => prev.map((l) => (l.id === lesson.id ? lesson : l)));
      } else {
        const { lesson } = await apiFetch<{ lesson: Lesson }>("/api/lessons", {
          method: "POST",
          body: JSON.stringify({ topicId, title: form.title, content: form.content, orderIndex }),
        });
        setLessons((prev) => [...prev, lesson]);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan materi");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(lesson: Lesson) {
    if (!confirm(`Hapus materi "${lesson.title}"?`)) return;
    try {
      await apiFetch(`/api/lessons/${lesson.id}`, { method: "DELETE" });
      setLessons((prev) => prev.filter((l) => l.id !== lesson.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus materi");
    }
  }

  const sortedLessons = [...lessons].sort((a, b) => a.orderIndex - b.orderIndex);

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
            <h1 className="mt-2 mb-4 text-xl font-semibold">Materi — {topic.name}</h1>

            <div className="mb-3 flex justify-end">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger render={<Button size="sm" onClick={openCreateDialog} />}>
                  Tambah Materi
                </DialogTrigger>
                <DialogContent className="sm:max-w-2xl">
                  <DialogHeader>
                    <DialogTitle>{editingLesson ? "Edit Materi" : "Tambah Materi"}</DialogTitle>
                  </DialogHeader>
                  <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                    <div className="grid grid-cols-[1fr_auto] gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="lesson-title">Judul</Label>
                        <Input
                          id="lesson-title"
                          value={form.title}
                          onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                          disabled={isSubmitting}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="lesson-order">Urutan</Label>
                        <Input
                          id="lesson-order"
                          type="number"
                          min={0}
                          className="w-20"
                          value={form.orderIndex}
                          onChange={(e) => setForm((f) => ({ ...f, orderIndex: e.target.value }))}
                          disabled={isSubmitting}
                          required
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="flex flex-col gap-2">
                        <Label htmlFor="lesson-content">Isi (markdown + LaTeX)</Label>
                        <Textarea
                          id="lesson-content"
                          rows={12}
                          value={form.content}
                          onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                          disabled={isSubmitting}
                          required
                        />
                      </div>
                      <div className="flex flex-col gap-2">
                        <Label>Preview</Label>
                        <div className="max-h-72 overflow-y-auto rounded-lg border p-3">
                          <MarkdownContent content={form.content || "_(kosong)_"} />
                        </div>
                      </div>
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
                  <TableHead>Urutan</TableHead>
                  <TableHead>Judul</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedLessons.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Belum ada materi
                    </TableCell>
                  </TableRow>
                )}
                {sortedLessons.map((lesson) => (
                  <TableRow key={lesson.id}>
                    <TableCell>{lesson.orderIndex}</TableCell>
                    <TableCell>{lesson.title}</TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button variant="outline" size="sm" onClick={() => openEditDialog(lesson)}>
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(lesson)}>
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
