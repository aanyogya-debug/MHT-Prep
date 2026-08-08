"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseSession, Subject, Topic } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function PracticePage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [subjectId, setSubjectId] = useState<string>("");
  const [topicId, setTopicId] = useState<string>("");
  const [questionCount, setQuestionCount] = useState("10");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const [subjectsRes, topicsRes] = await Promise.all([
          apiFetch<{ subjects: Subject[] }>("/api/subjects"),
          apiFetch<{ topics: Topic[] }>("/api/topics"),
        ]);
        setSubjects(subjectsRes.subjects);
        setTopics(topicsRes.topics);
        setSubjectId(subjectsRes.subjects[0]?.id ?? "");
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady]);

  if (!isReady || !user) return null;

  const topicsForSubject = topics.filter((t) => t.subjectId === subjectId);

  async function handleStart() {
    setError(null);
    setIsStarting(true);
    try {
      const { session } = await apiFetch<{ session: ExerciseSession }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({
          source: "topic",
          topicId,
          questionCount: Number(questionCount),
        }),
      });
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memulai sesi");
    } finally {
      setIsStarting(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-md flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold">Latihan Bebas</h1>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}

        {!loading && (
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="subject">Mata pelajaran</Label>
              <Select
                value={subjectId}
                onValueChange={(v) => {
                  setSubjectId(v as string);
                  setTopicId("");
                }}
              >
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Pilih subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="topic">Topik</Label>
              <Select value={topicId} onValueChange={(v) => setTopicId(v as string)}>
                <SelectTrigger id="topic">
                  <SelectValue placeholder="Pilih topik" />
                </SelectTrigger>
                <SelectContent>
                  {topicsForSubject.length === 0 && (
                    <SelectItem value="_none" disabled>
                      Belum ada topik
                    </SelectItem>
                  )}
                  {topicsForSubject.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="count">Jumlah soal</Label>
              <Input
                id="count"
                type="number"
                min={1}
                max={100}
                value={questionCount}
                onChange={(e) => setQuestionCount(e.target.value)}
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button onClick={handleStart} disabled={!topicId || isStarting}>
              {isStarting ? "Memulai..." : "Mulai Latihan"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
