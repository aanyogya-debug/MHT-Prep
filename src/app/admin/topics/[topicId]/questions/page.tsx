"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Question, QuestionOption, Topic } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type QuestionWithOptions = Question & { options: QuestionOption[] };

export default function AdminTopicQuestionsPage() {
  const { user, isReady } = useRequireAuth("ADMIN");
  const { topicId } = useParams<{ topicId: string }>();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [questions, setQuestions] = useState<QuestionWithOptions[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [topicRes, questionsRes] = await Promise.all([
          apiFetch<{ topic: Topic }>(`/api/topics/${topicId}`),
          apiFetch<{ questions: QuestionWithOptions[] }>(`/api/questions?topicId=${topicId}`),
        ]);
        setTopic(topicRes.topic);
        setQuestions(questionsRes.questions);
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

  async function handleDelete(question: QuestionWithOptions) {
    if (!confirm("Hapus soal ini?")) return;
    try {
      await apiFetch(`/api/questions/${question.id}`, { method: "DELETE" });
      setQuestions((prev) => prev.filter((q) => q.id !== question.id));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus soal");
    }
  }

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
            <h1 className="mt-2 mb-4 text-xl font-semibold">Soal — {topic.name}</h1>

            <div className="mb-3 flex justify-end">
              <Button size="sm" render={<Link href={`/admin/topics/${topicId}/questions/new`} />}>
                Tambah Soal
              </Button>
            </div>

            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tingkat</TableHead>
                  <TableHead>Teks Soal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {questions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Belum ada soal
                    </TableCell>
                  </TableRow>
                )}
                {questions.map((question) => (
                  <TableRow key={question.id}>
                    <TableCell>
                      <Badge variant="secondary">{question.difficulty}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{question.questionText}</TableCell>
                    <TableCell className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        render={<Link href={`/admin/topics/${topicId}/questions/${question.id}`} />}
                      >
                        Edit
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleDelete(question)}>
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
