"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Difficulty, Lesson, PathStepType, Topic } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type StepStatus = "LOCKED" | "UNLOCKED" | "COMPLETED";

interface PathStepData {
  id: string;
  orderIndex: number;
  stepType: PathStepType;
  status: StepStatus;
  lessonId: string | null;
  lesson: Lesson | null;
  difficultyMin: Difficulty | null;
  difficultyMax: Difficulty | null;
  questionCount: number | null;
  unlockThreshold: number | null;
}

function StatusBadge({ status }: { status: StepStatus }) {
  if (status === "COMPLETED") {
    return (
      <Badge className="border-emerald-600 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        Selesai
      </Badge>
    );
  }
  if (status === "UNLOCKED") return <Badge variant="outline">Terbuka</Badge>;
  return <Badge variant="secondary">Terkunci</Badge>;
}

export default function StudentPathPage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();
  const { topicId } = useParams<{ topicId: string }>();

  const [topic, setTopic] = useState<Topic | null>(null);
  const [steps, setSteps] = useState<PathStepData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<string | null>(null);
  const [isCompleting, setIsCompleting] = useState<string | null>(null);

  // Dipakai ulang utk refresh status step setelah aksi (mis. tandai materi
  // selesai) — sengaja TIDAK toggle `loading` (biar tidak ada kedipan
  // full-page reload, cukup update daftar step di tempat).
  const reloadSteps = useCallback(async () => {
    const { pathSteps } = await apiFetch<{ pathSteps: PathStepData[] }>(
      `/api/path-steps?topicId=${topicId}`,
    );
    setSteps(pathSteps);
  }, [topicId]);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const [topicRes, stepsRes] = await Promise.all([
          apiFetch<{ topic: Topic }>(`/api/topics/${topicId}`),
          apiFetch<{ pathSteps: PathStepData[] }>(`/api/path-steps?topicId=${topicId}`),
        ]);
        setTopic(topicRes.topic);
        setSteps(stepsRes.pathSteps);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady, topicId]);

  if (!isReady || !user) return null;

  async function handleCompleteLesson(stepId: string) {
    setActionError(null);
    setIsCompleting(stepId);
    try {
      await apiFetch(`/api/path-steps/${stepId}/complete`, { method: "POST" });
      setExpandedStepId(null);
      await reloadSteps();
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Gagal menandai materi selesai");
    } finally {
      setIsCompleting(null);
    }
  }

  async function handleStartPractice(stepId: string) {
    setActionError(null);
    setIsStarting(stepId);
    try {
      const { session } = await apiFetch<{ session: { id: string } }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ source: "pathStep", pathStepId: stepId }),
      });
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : "Gagal memulai latihan");
      setIsStarting(null);
    }
  }

  const sortedSteps = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <Link href="/path" className="text-sm text-muted-foreground hover:underline">
          &larr; Kembali ke Learning Path
        </Link>

        {loading && <p className="mt-4 text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="mt-4 text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && topic && (
          <>
            <h1 className="mt-2 mb-6 text-xl font-semibold">Learning Path — {topic.name}</h1>

            {sortedSteps.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada learning path untuk topik ini.</p>
            )}

            {actionError && <p className="mb-4 text-sm text-destructive">{actionError}</p>}

            <div className="flex flex-col gap-3">
              {sortedSteps.map((step, index) => {
                const isLocked = step.status === "LOCKED";
                return (
                  <div key={step.id} className={cn("rounded-lg border p-4", isLocked && "opacity-60")}>
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {index + 1}
                        </span>
                        <div>
                          <p className="text-sm font-medium">
                            {step.stepType === "LESSON"
                              ? `Materi${step.lesson ? `: ${step.lesson.title}` : ""}`
                              : "Latihan"}
                          </p>
                          {step.stepType === "PRACTICE" && (
                            <p className="text-xs text-muted-foreground">
                              {step.difficultyMin}-{step.difficultyMax} · {step.questionCount} soal
                              {step.unlockThreshold != null && ` · lulus skor ${step.unlockThreshold}`}
                            </p>
                          )}
                        </div>
                      </div>
                      <StatusBadge status={step.status} />
                    </div>

                    {!isLocked && step.stepType === "LESSON" && (
                      <div className="mt-3">
                        {expandedStepId === step.id ? (
                          <>
                            <div className="rounded-md bg-muted/30 p-3">
                              <MarkdownContent content={step.lesson?.content ?? ""} />
                            </div>
                            <div className="mt-3 flex gap-2">
                              {step.status !== "COMPLETED" && (
                                <Button
                                  size="sm"
                                  onClick={() => handleCompleteLesson(step.id)}
                                  disabled={isCompleting === step.id}
                                >
                                  {isCompleting === step.id ? "Menyimpan..." : "Tandai Selesai"}
                                </Button>
                              )}
                              <Button variant="outline" size="sm" onClick={() => setExpandedStepId(null)}>
                                Tutup
                              </Button>
                            </div>
                          </>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => setExpandedStepId(step.id)}>
                            Baca Materi
                          </Button>
                        )}
                      </div>
                    )}

                    {!isLocked && step.stepType === "PRACTICE" && (
                      <div className="mt-3">
                        <Button
                          size="sm"
                          onClick={() => handleStartPractice(step.id)}
                          disabled={isStarting === step.id}
                        >
                          {isStarting === step.id
                            ? "Memulai..."
                            : step.status === "COMPLETED"
                              ? "Ulangi Latihan"
                              : "Mulai Latihan"}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
