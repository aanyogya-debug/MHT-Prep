"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Difficulty, Question, QuestionOption, Tryout, TryoutQuestion } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { DIFFICULTIES } from "@/lib/validations/question";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type QuestionWithOptions = Question & { options: QuestionOption[] };
type TryoutQuestionWithQuestion = TryoutQuestion & { question: QuestionWithOptions };

export default function AdminTryoutDetailPage() {
  const { user, isReady } = useRequireAuth("ADMIN");
  const { id } = useParams<{ id: string }>();

  const [tryout, setTryout] = useState<Tryout | null>(null);
  const [tryoutQuestions, setTryoutQuestions] = useState<TryoutQuestionWithQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [allowedDifficulties, setAllowedDifficulties] = useState<Set<Difficulty>>(
    new Set(["EASY"]),
  );
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [shortfalls, setShortfalls] = useState<
    { subjectSlug: string; requested: number; available: number }[]
  >([]);
  const [isPublishing, setIsPublishing] = useState(false);

  const loadTryoutQuestions = useCallback(async () => {
    const { tryoutQuestions } = await apiFetch<{ tryoutQuestions: TryoutQuestionWithQuestion[] }>(
      `/api/tryouts/${id}/questions`,
    );
    setTryoutQuestions(tryoutQuestions);
  }, [id]);

  useEffect(() => {
    if (!isReady) return;

    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const { tryout } = await apiFetch<{ tryout: Tryout }>(`/api/tryouts/${id}`);
        setTryout(tryout);
        await loadTryoutQuestions();
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady, id, loadTryoutQuestions]);

  if (!isReady || !user) {
    return null;
  }

  function toggleDifficulty(d: Difficulty, checked: boolean) {
    setAllowedDifficulties((prev) => {
      const next = new Set(prev);
      if (checked) next.add(d);
      else next.delete(d);
      return next;
    });
  }

  async function handleGenerate() {
    setGenerateError(null);
    setShortfalls([]);
    setIsGenerating(true);
    try {
      const result = await apiFetch<{
        selectedCount: number;
        shortfalls: { subjectSlug: string; requested: number; available: number }[];
      }>(`/api/tryouts/${id}/generate`, {
        method: "POST",
        body: JSON.stringify({ allowedDifficulties: Array.from(allowedDifficulties) }),
      });
      setShortfalls(result.shortfalls);
      await loadTryoutQuestions();
    } catch (err) {
      setGenerateError(err instanceof ApiError ? err.message : "Gagal generate tryout");
    } finally {
      setIsGenerating(false);
    }
  }

  async function handleRemoveQuestion(tryoutQuestionId: string) {
    if (!confirm("Hapus soal ini dari tryout?")) return;
    try {
      await apiFetch(`/api/tryouts/${id}/questions/${tryoutQuestionId}`, { method: "DELETE" });
      setTryoutQuestions((prev) => prev.filter((tq) => tq.id !== tryoutQuestionId));
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal menghapus soal");
    }
  }

  async function handleTogglePublish() {
    if (!tryout) return;
    setIsPublishing(true);
    try {
      const nextStatus = tryout.status === "PUBLISHED" ? "DRAFT" : "PUBLISHED";
      const { tryout: updated } = await apiFetch<{ tryout: Tryout }>(`/api/tryouts/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
      setTryout(updated);
    } catch (err) {
      alert(err instanceof ApiError ? err.message : "Gagal ubah status tryout");
    } finally {
      setIsPublishing(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/admin/tryouts" className="text-sm text-muted-foreground hover:underline">
          &larr; Kembali ke Tryout
        </Link>

        {loading && <p className="mt-4 text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="mt-4 text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && tryout && (
          <>
            <div className="mt-2 mb-4 flex items-center justify-between">
              <div>
                <h1 className="text-xl font-semibold">{tryout.title}</h1>
                <p className="text-sm text-muted-foreground">{tryout.difficultyTier}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant={tryout.status === "PUBLISHED" ? "default" : "secondary"}>
                  {tryout.status}
                </Badge>
                <Button size="sm" variant="outline" onClick={handleTogglePublish} disabled={isPublishing}>
                  {tryout.status === "PUBLISHED" ? "Set ke Draft" : "Publish"}
                </Button>
              </div>
            </div>

            <div className="mb-6 rounded-lg border p-4">
              <Label className="mb-2 block">Generate ulang soal (mengganti set saat ini)</Label>
              <div className="mb-3 flex gap-4">
                {DIFFICULTIES.map((d) => (
                  <div key={d} className="flex items-center gap-2">
                    <Checkbox
                      id={`diff-${d}`}
                      checked={allowedDifficulties.has(d)}
                      onCheckedChange={(checked) => toggleDifficulty(d, checked === true)}
                    />
                    <Label htmlFor={`diff-${d}`}>{d}</Label>
                  </div>
                ))}
              </div>
              <Button
                size="sm"
                onClick={handleGenerate}
                disabled={isGenerating || allowedDifficulties.size === 0}
              >
                {isGenerating ? "Generating..." : "Generate"}
              </Button>
              {generateError && <p className="mt-2 text-sm text-destructive">{generateError}</p>}
              {shortfalls.length > 0 && (
                <div className="mt-2 text-sm text-amber-600">
                  Kuota tidak terpenuhi penuh:{" "}
                  {shortfalls
                    .map((s) => `${s.subjectSlug} (${s.available}/${s.requested})`)
                    .join(", ")}
                </div>
              )}
            </div>

            <h2 className="mb-2 text-sm font-medium text-muted-foreground">
              Soal terpilih ({tryoutQuestions.length})
            </h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tingkat</TableHead>
                  <TableHead>Teks Soal</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tryoutQuestions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="text-center text-muted-foreground">
                      Belum ada soal — klik Generate di atas
                    </TableCell>
                  </TableRow>
                )}
                {tryoutQuestions.map((tq) => (
                  <TableRow key={tq.id}>
                    <TableCell>
                      <Badge variant="secondary">{tq.question.difficulty}</Badge>
                    </TableCell>
                    <TableCell className="max-w-md truncate">{tq.question.questionText}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => handleRemoveQuestion(tq.id)}>
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
