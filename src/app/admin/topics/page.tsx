"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import type { Subject, Topic } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
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

interface TopicFormState {
  name: string;
  orderIndex: string;
}

const EMPTY_FORM: TopicFormState = { name: "", orderIndex: "0" };

export default function AdminTopicsPage() {
  const { user, isReady } = useRequireAuth("ADMIN");

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [activeSubjectId, setActiveSubjectId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTopic, setEditingTopic] = useState<Topic | null>(null);
  const [form, setForm] = useState<TopicFormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [subjectsRes, topicsRes] = await Promise.all([
          apiFetch<{ subjects: Subject[] }>("/api/subjects"),
          apiFetch<{ topics: Topic[] }>("/api/topics"),
        ]);
        setSubjects(subjectsRes.subjects);
        setTopics(topicsRes.topics);
        setActiveSubjectId((current) => current ?? subjectsRes.subjects[0]?.id ?? null);
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
    setEditingTopic(null);
    setForm(EMPTY_FORM);
    setFormError(null);
    setDialogOpen(true);
  }

  function openEditDialog(topic: Topic) {
    setEditingTopic(topic);
    setForm({ name: topic.name, orderIndex: String(topic.orderIndex) });
    setFormError(null);
    setDialogOpen(true);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeSubjectId) return;

    setFormError(null);
    setIsSubmitting(true);
    try {
      const orderIndex = Number(form.orderIndex);
      if (editingTopic) {
        const { topic } = await apiFetch<{ topic: Topic }>(`/api/topics/${editingTopic.id}`, {
          method: "PATCH",
          body: JSON.stringify({ name: form.name, orderIndex }),
        });
        setTopics((prev) => prev.map((t) => (t.id === topic.id ? topic : t)));
      } else {
        const { topic } = await apiFetch<{ topic: Topic }>("/api/topics", {
          method: "POST",
          body: JSON.stringify({ subjectId: activeSubjectId, name: form.name, orderIndex }),
        });
        setTopics((prev) => [...prev, topic]);
      }
      setDialogOpen(false);
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : "Gagal menyimpan topik");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete(topic: Topic) {
    if (!confirm(`Hapus topik "${topic.name}"?`)) return;
    try {
      await apiFetch(`/api/topics/${topic.id}`, { method: "DELETE" });
      setTopics((prev) => prev.filter((t) => t.id !== topic.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus topik");
    }
  }

  const topicsForActiveSubject = topics
    .filter((t) => t.subjectId === activeSubjectId)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold">Kelola Topik</h1>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && (
          <Tabs value={activeSubjectId ?? undefined} onValueChange={(v) => setActiveSubjectId(v as string)}>
            <TabsList>
              {subjects.map((subject) => (
                <TabsTrigger key={subject.id} value={subject.id}>
                  {subject.name}
                </TabsTrigger>
              ))}
            </TabsList>

            {subjects.map((subject) => (
              <TabsContent key={subject.id} value={subject.id}>
                <div className="mb-3 flex justify-end">
                  <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                    <DialogTrigger render={<Button size="sm" onClick={openCreateDialog} />}>
                      Tambah Topik
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingTopic ? "Edit Topik" : "Tambah Topik"}
                        </DialogTitle>
                      </DialogHeader>
                      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="topic-name">Nama topik</Label>
                          <Input
                            id="topic-name"
                            value={form.name}
                            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                            disabled={isSubmitting}
                            required
                          />
                        </div>
                        <div className="flex flex-col gap-2">
                          <Label htmlFor="topic-order">Urutan (order index)</Label>
                          <Input
                            id="topic-order"
                            type="number"
                            min={0}
                            value={form.orderIndex}
                            onChange={(e) => setForm((f) => ({ ...f, orderIndex: e.target.value }))}
                            disabled={isSubmitting}
                            required
                          />
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
                      <TableHead>Nama Topik</TableHead>
                      <TableHead className="text-right">Aksi</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topicsForActiveSubject.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground">
                          Belum ada topik
                        </TableCell>
                      </TableRow>
                    )}
                    {topicsForActiveSubject.map((topic) => (
                      <TableRow key={topic.id}>
                        <TableCell>{topic.orderIndex}</TableCell>
                        <TableCell>{topic.name}</TableCell>
                        <TableCell className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/admin/topics/${topic.id}/lessons`} />}
                          >
                            Materi
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/admin/topics/${topic.id}/questions`} />}
                          >
                            Soal
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            render={<Link href={`/admin/topics/${topic.id}/path`} />}
                          >
                            Path
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => openEditDialog(topic)}>
                            Edit
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(topic)}>
                            Hapus
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
}
