"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MarkdownContent } from "@/components/markdown-content";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ResultOption {
  id: string;
  label: string;
  text: string;
  isCorrect: boolean;
}

interface ResultItem {
  id: string;
  orderIndex: number;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  pointsEarned: number | null;
  question: {
    id: string;
    questionText: string;
    explanation: string | null;
    options: ResultOption[];
  };
}

interface ResultSession {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  mode: string;
  score: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  totalQuestions: number;
  items: ResultItem[];
}

export default function SessionResultsPage() {
  const { isReady } = useRequireAuth();
  const { id } = useParams<{ id: string }>();

  const [session, setSession] = useState<ResultSession | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      try {
        const { session } = await apiFetch<{ session: ResultSession }>(`/api/sessions/${id}`);
        setSession(session);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat hasil");
      }
    })();
  }, [isReady, id]);

  if (!isReady) return null;
  if (loadError) return <main className="p-6 text-sm text-destructive">{loadError}</main>;
  if (!session) return <main className="p-6 text-sm text-muted-foreground">Memuat...</main>;

  const sortedItems = [...session.items].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <main className="mx-auto w-full max-w-2xl flex-1 p-6">
      <Link href="/" className="text-sm text-muted-foreground hover:underline">
        &larr; Kembali ke Beranda
      </Link>

      <Card className="mt-4 mb-6">
        <CardHeader>
          <CardTitle>Hasil Tes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-4 text-center">
            <div>
              <p className="text-2xl font-semibold">{session.score ?? "-"}</p>
              <p className="text-xs text-muted-foreground">Skor</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-emerald-600">
                {session.correctCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Benar</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-destructive">
                {session.incorrectCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Salah</p>
            </div>
            <div>
              <p className="text-2xl font-semibold text-muted-foreground">
                {session.unansweredCount ?? 0}
              </p>
              <p className="text-xs text-muted-foreground">Kosong</p>
            </div>
          </div>
          {session.status === "EXPIRED" && (
            <p className="mt-3 text-sm text-muted-foreground">
              Waktu habis — hasil disimpan otomatis.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-6">
        {sortedItems.map((item, index) => (
          <div key={item.id} className="rounded-lg border p-4">
            <div className="mb-2 flex items-center gap-2">
              <span className="text-sm font-medium">Soal {index + 1}</span>
              {item.isCorrect === true && <Badge>Benar</Badge>}
              {item.isCorrect === false && <Badge variant="destructive">Salah</Badge>}
              {item.isCorrect === null && <Badge variant="secondary">Tidak dijawab</Badge>}
            </div>
            <MarkdownContent content={item.question.questionText} />
            <div className="mt-3 flex flex-col gap-1.5">
              {item.question.options.map((option) => (
                <div
                  key={option.id}
                  className={cn(
                    "flex items-start gap-2 rounded-md border p-2 text-sm",
                    option.isCorrect && "border-emerald-600 bg-emerald-50 dark:bg-emerald-950/30",
                    option.id === item.selectedOptionId &&
                      !option.isCorrect &&
                      "border-destructive bg-destructive/5",
                  )}
                >
                  <span className="font-mono font-medium">{option.label}.</span>
                  <span className="flex-1">
                    <MarkdownContent content={option.text} className="[&>p]:m-0" />
                  </span>
                  {option.id === item.selectedOptionId && (
                    <span className="text-xs text-muted-foreground">Jawabanmu</span>
                  )}
                </div>
              ))}
            </div>
            {item.question.explanation && (
              <div className="mt-3 rounded-md bg-muted p-3">
                <p className="mb-1 text-xs font-medium text-muted-foreground">Pembahasan</p>
                <MarkdownContent content={item.question.explanation} />
              </div>
            )}
          </div>
        ))}
      </div>

      <Button className="mt-6" render={<Link href="/" />}>
        Kembali ke Beranda
      </Button>
    </main>
  );
}
