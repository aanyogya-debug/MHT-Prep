"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SessionOption {
  id: string;
  label: string;
  text: string;
}

interface SessionPassage {
  id: string;
  title: string;
  content: string;
}

interface SessionItem {
  id: string;
  orderIndex: number;
  selectedOptionId: string | null;
  question: {
    id: string;
    difficulty: string;
    questionText: string;
    imageUrl: string | null;
    options: SessionOption[];
    passage: SessionPassage | null;
  };
}

interface SessionData {
  id: string;
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  startedAt: string;
  durationMinutes: number;
  totalQuestions: number;
  items: SessionItem[];
}

function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export default function SessionPage() {
  const { isReady } = useRequireAuth();
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [session, setSession] = useState<SessionData | null>(null);
  const [items, setItems] = useState<SessionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [timeLeftMs, setTimeLeftMs] = useState<number | null>(null);
  const [isStopping, setIsStopping] = useState(false);
  const hasFinalizedRef = useRef(false);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      try {
        const { session } = await apiFetch<{ session: SessionData }>(`/api/sessions/${id}`);
        if (session.status !== "IN_PROGRESS") {
          router.replace(`/sessions/${id}/results`);
          return;
        }
        setSession(session);
        setItems(session.items);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat sesi");
      }
    })();
  }, [isReady, id, router]);

  const finalize = useCallback(async () => {
    if (hasFinalizedRef.current) return;
    hasFinalizedRef.current = true;
    try {
      await apiFetch(`/api/sessions/${id}/submit`, { method: "POST" });
    } catch {
      // Kemungkinan sudah di-finalize server (mis. race dgn lazy-expiry-check
      // dari request lain) — tetap lanjut ke halaman hasil.
    }
    router.push(`/sessions/${id}/results`);
  }, [id, router]);

  // Timer dihitung dari startedAt + durationMinutes (bukan countdown lokal
  // independen) — supaya tetap akurat walau tab di-refresh di tengah jalan.
  // Server juga mengecek expiry sendiri (lazy, di GET/answer) sbg pengaman
  // kalau client offline/tab ditutup sebelum auto-submit ini sempat jalan.
  useEffect(() => {
    if (!session) return;
    const deadline = new Date(session.startedAt).getTime() + session.durationMinutes * 60_000;

    function tick() {
      const remaining = deadline - Date.now();
      setTimeLeftMs(Math.max(0, remaining));
      if (remaining <= 0) {
        finalize();
      }
    }

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [session, finalize]);

  async function selectOption(questionId: string, optionId: string) {
    setItems((prev) =>
      prev.map((it) => (it.question.id === questionId ? { ...it, selectedOptionId: optionId } : it)),
    );
    try {
      await apiFetch(`/api/sessions/${id}/answer`, {
        method: "POST",
        body: JSON.stringify({ questionId, selectedOptionId: optionId }),
      });
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        router.replace(`/sessions/${id}/results`);
      }
    }
  }

  async function handleStopTest() {
    const confirmed = confirm(
      "Yakin ingin menghentikan tes? Jawaban yang sudah diisi akan disimpan sebagai hasil akhir.",
    );
    if (!confirmed) return;
    setIsStopping(true);
    await finalize();
  }

  if (!isReady) return null;

  if (loadError) {
    return <main className="p-6 text-sm text-destructive">{loadError}</main>;
  }
  if (!session || timeLeftMs === null) {
    return <main className="p-6 text-sm text-muted-foreground">Memuat...</main>;
  }

  const current = items[currentIndex];
  const answeredCount = items.filter((it) => it.selectedOptionId !== null).length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b bg-background px-6 py-3">
        <span className="text-sm text-muted-foreground">
          Terjawab {answeredCount}/{items.length}
        </span>
        <span
          className={cn(
            "font-mono text-lg font-semibold",
            timeLeftMs < 60_000 && "text-destructive",
          )}
        >
          {formatTime(timeLeftMs)}
        </span>
        <Button variant="outline" size="sm" onClick={handleStopTest} disabled={isStopping}>
          {isStopping ? "Menyimpan..." : "Hentikan Tes"}
        </Button>
      </header>

      <div className="flex flex-wrap gap-1.5 border-b px-6 py-3">
        {items.map((it, index) => (
          <button
            key={it.id}
            type="button"
            onClick={() => setCurrentIndex(index)}
            className={cn(
              "flex size-8 items-center justify-center rounded-md border text-xs font-medium",
              index === currentIndex ? "border-primary ring-2 ring-primary/30" : "border-border",
              it.selectedOptionId
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground",
            )}
          >
            {index + 1}
          </button>
        ))}
      </div>

      <main
        className={cn(
          "mx-auto w-full flex-1 p-6",
          current?.question.passage ? "max-w-5xl" : "max-w-2xl",
        )}
      >
        {current && (
          <div className={current.question.passage ? "grid gap-6 md:grid-cols-2" : undefined}>
            {current.question.passage && (
              <div className="rounded-lg border p-4 md:sticky md:top-20 md:max-h-[calc(100vh-6rem)] md:overflow-y-auto">
                <p className="mb-2 text-sm font-medium text-muted-foreground">
                  {current.question.passage.title}
                </p>
                <MarkdownContent content={current.question.passage.content} />
              </div>
            )}

            <div>
              <p className="mb-2 text-sm text-muted-foreground">
                Soal {currentIndex + 1} dari {items.length}
              </p>
              <MarkdownContent content={current.question.questionText} />
              {current.question.imageUrl && (
                // eslint-disable-next-line @next/next/no-img-element -- URL Cloudinary eksternal, domain belum dikonfigurasi utk next/image
                <img
                  src={current.question.imageUrl}
                  alt="Gambar soal"
                  className="my-4 max-w-full rounded-lg border"
                />
              )}
              <div className="mt-6 flex flex-col gap-2">
                {current.question.options.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => selectOption(current.question.id, option.id)}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 text-left text-sm transition-colors hover:bg-muted",
                      current.selectedOptionId === option.id && "border-primary bg-primary/5",
                    )}
                  >
                    <span className="font-mono font-medium">{option.label}.</span>
                    <span className="flex-1">
                      <MarkdownContent content={option.text} className="[&>p]:m-0" />
                    </span>
                  </button>
                ))}
              </div>

              <div className="mt-6 flex justify-between">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                  disabled={currentIndex === 0}
                >
                  Sebelumnya
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setCurrentIndex((i) => Math.min(items.length - 1, i + 1))}
                  disabled={currentIndex === items.length - 1}
                >
                  Selanjutnya
                </Button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
