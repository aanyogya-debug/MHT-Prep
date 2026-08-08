"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Question, QuestionOption } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { QuestionForm } from "@/components/question-form";

type QuestionWithOptions = Question & { options: QuestionOption[] };

export default function EditQuestionPage() {
  const { user, isReady } = useRequireAuth("ADMIN");
  const { topicId, questionId } = useParams<{ topicId: string; questionId: string }>();

  const [question, setQuestion] = useState<QuestionWithOptions | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { question } = await apiFetch<{ question: QuestionWithOptions }>(
          `/api/questions/${questionId}`,
        );
        setQuestion(question);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat soal");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady, questionId]);

  if (!isReady || !user) {
    return null;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link
          href={`/admin/topics/${topicId}/questions`}
          className="text-sm text-muted-foreground hover:underline"
        >
          &larr; Kembali ke Soal
        </Link>
        <h1 className="mt-2 mb-4 text-xl font-semibold">Edit Soal</h1>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="text-sm text-destructive">{loadError}</p>}
        {!loading && !loadError && question && (
          <QuestionForm topicId={topicId} question={question} />
        )}
      </main>
    </div>
  );
}
