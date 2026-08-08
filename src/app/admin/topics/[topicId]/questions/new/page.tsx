"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { QuestionForm } from "@/components/question-form";

export default function NewQuestionPage() {
  const { user, isReady } = useRequireAuth("ADMIN");
  const { topicId } = useParams<{ topicId: string }>();

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
        <h1 className="mt-2 mb-4 text-xl font-semibold">Tambah Soal</h1>
        <QuestionForm topicId={topicId} />
      </main>
    </div>
  );
}
