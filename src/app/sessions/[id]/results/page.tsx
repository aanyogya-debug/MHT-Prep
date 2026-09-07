"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { ArrowLeft, CheckCircle2, MinusCircle, XCircle } from "lucide-react";
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

interface ResultPassage {
  id: string;
  title: string;
  content: string;
}

interface ResultItem {
  id: string;
  orderIndex: number;
  selectedOptionId: string | null;
  isCorrect: boolean | null;
  pointsEarned: number | null;
  question: {
    id: string;
    difficulty: "EASY" | "MEDIUM" | "HARD";
    questionText: string;
    explanation: string | null;
    options: ResultOption[];
    passage: ResultPassage | null;
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

  // Analisis ringan per tingkat kesulitan (section: sedikit analisis) —
  // dihitung langsung dari items yang sudah ada, tidak perlu endpoint baru.
  const DIFFICULTY_LABEL: Record<string, string> = { EASY: "Mudah", MEDIUM: "Sedang", HARD: "Sulit" };
  const byDifficulty = (["EASY", "MEDIUM", "HARD"] as const).map((diff) => {
    const items = sortedItems.filter((it) => it.question.difficulty === diff);
    const correct = items.filter((it) => it.isCorrect === true).length;
    return { diff, label: DIFFICULTY_LABEL[diff], correct, total: items.length };
  }).filter((d) => d.total > 0);
  const weakest = [...byDifficulty]
    .filter((d) => d.correct < d.total)
    .sort((a, b) => a.correct / a.total - b.correct / b.total)[0];

  return (
    <main className="min-h-screen bg-muted/30 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Kembali ke Beranda
        </Link>

        <Card className="mt-4 mb-6 shadow-sm">
          <CardHeader>
            <CardTitle>Hasil Tes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4 text-center">
              <div>
                <p className="text-3xl font-bold tracking-tight text-primary">{session.score ?? "-"}</p>
                <p className="mt-1 text-xs text-muted-foreground">Skor</p>
              </div>
              <div>
                <CheckCircle2 className="mx-auto mb-1 size-5 text-emerald-600" />
                <p className="text-xl font-semibold">{session.correctCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Benar</p>
              </div>
              <div>
                <XCircle className="mx-auto mb-1 size-5 text-destructive" />
                <p className="text-xl font-semibold">{session.incorrectCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Salah</p>
              </div>
              <div>
                <MinusCircle className="mx-auto mb-1 size-5 text-muted-foreground" />
                <p className="text-xl font-semibold">{session.unansweredCount ?? 0}</p>
                <p className="text-xs text-muted-foreground">Kosong</p>
              </div>
            </div>
            {session.status === "EXPIRED" && (
              <p className="mt-4 rounded-md bg-muted px-3 py-2 text-center text-sm text-muted-foreground">
                Waktu habis — hasil disimpan otomatis.
              </p>
            )}
          </CardContent>
        </Card>

        {byDifficulty.length > 0 && (
          <Card className="mb-6 shadow-sm">
            <CardHeader>
              <CardTitle className="text-base">Analisis Singkat</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-3">
                {byDifficulty.map((d) => {
                  const pct = Math.round((d.correct / d.total) * 100);
                  return (
                    <div key={d.diff}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{d.label}</span>
                        <span className="text-muted-foreground">
                          {d.correct}/{d.total} benar
                        </span>
                      </div>
                      <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            pct >= 80 ? "bg-emerald-500" : pct >= 50 ? "bg-amber-500" : "bg-destructive",
                          )}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
              {weakest && (
                <p className="mt-4 rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground">
                  Soal tingkat <span className="font-medium text-foreground">{weakest.label}</span> paling
                  banyak salah — coba ulangi subbab ini untuk memperkuat bagian itu.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col gap-6">
          {sortedItems.map((item, index) => {
            // Tampilkan passage sekali saja di depan kelompok soal yang
            // berbagi bacaan yang sama, bukan diulang tiap nomor.
            const showPassage =
              item.question.passage &&
              sortedItems[index - 1]?.question.passage?.id !== item.question.passage.id;

            return (
              <div key={item.id} className="flex flex-col gap-3">
                {showPassage && item.question.passage && (
                  <div className="rounded-xl border bg-card p-4 shadow-sm">
                    <p className="mb-2 text-sm font-medium text-muted-foreground">
                      {item.question.passage.title}
                    </p>
                    <MarkdownContent content={item.question.passage.content} />
                  </div>
                )}
                <div className="rounded-xl border bg-card p-4 shadow-sm">
                  <div className="mb-3 flex items-center gap-2">
                    <span className="text-sm font-medium">Soal {index + 1}</span>
                    {item.isCorrect === true && (
                      <Badge className="border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
                        Benar
                      </Badge>
                    )}
                    {item.isCorrect === false && <Badge variant="destructive">Salah</Badge>}
                    {item.isCorrect === null && <Badge variant="secondary">Tidak dijawab</Badge>}
                  </div>
                  <MarkdownContent content={item.question.questionText} />
                  <div className="mt-3 flex flex-col gap-1.5">
                    {item.question.options.map((option) => {
                      const isSelected = option.id === item.selectedOptionId;
                      return (
                        <div
                          key={option.id}
                          className={cn(
                            "flex items-center gap-3 rounded-lg border p-2.5 text-sm",
                            option.isCorrect &&
                              "border-emerald-600/40 bg-emerald-50 dark:bg-emerald-950/20",
                            isSelected && !option.isCorrect && "border-destructive/40 bg-destructive/5",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-7 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                              option.isCorrect
                                ? "border-emerald-600 bg-emerald-600 text-white"
                                : isSelected
                                  ? "border-destructive bg-destructive text-white"
                                  : "border-border text-muted-foreground",
                            )}
                          >
                            {option.label}
                          </span>
                          <span className="flex-1">
                            <MarkdownContent content={option.text} className="[&>p]:m-0" />
                          </span>
                          {isSelected && (
                            <span className="shrink-0 text-xs text-muted-foreground">Jawabanmu</span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {item.question.explanation && (
                    <div className="mt-3 rounded-md bg-muted p-3">
                      <p className="mb-1 text-xs font-medium text-muted-foreground">Pembahasan</p>
                      <MarkdownContent content={item.question.explanation} />
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <Button className="mt-6 w-full sm:w-auto" render={<Link href="/" />}>
          Kembali ke Beranda
        </Button>
      </div>
    </main>
  );
}
