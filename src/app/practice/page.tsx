"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Subject } from "@prisma/client";
import {
  ArrowLeft,
  ArrowRight,
  Atom,
  BookOpenText,
  Calculator,
  Leaf,
  Sparkles,
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Difficulty = "EASY" | "MEDIUM" | "HARD";

// Topik dari /api/topics kini ikut membawa questionCounts per tingkat
// kesulitan (section "latihan bertingkat") supaya daftar subbab bisa
// menampilkan & menavigasi 3 level Mudah/Sedang/Sulit secara terpisah.
interface TopicWithCounts {
  id: string;
  subjectId: string;
  name: string;
  orderIndex: number;
  questionCounts: Record<Difficulty, number>;
}

interface MasteryEntry {
  topicId: string;
  difficulty: Difficulty;
  masteryScore: number;
  questionsAttempted: number;
}

const DIFFICULTY_LABEL: Record<Difficulty, string> = { EASY: "Mudah", MEDIUM: "Sedang", HARD: "Sulit" };
const DIFFICULTY_ORDER: Difficulty[] = ["EASY", "MEDIUM", "HARD"];
const MINUTES_PER_QUESTION: Record<Difficulty, number> = { EASY: 1.5, MEDIUM: 2, HARD: 2.5 };

const SUBJECT_ICON: Record<string, typeof Atom> = {
  Fisika: Atom,
  Biologi: Leaf,
  "Penalaran Matematika": Calculator,
  "Literasi Bahasa Inggris": BookOpenText,
  "Tes Potensial Skolastik": Sparkles,
};

function MasteryBadge({ entry }: { entry: MasteryEntry | undefined }) {
  if (!entry || entry.questionsAttempted === 0) {
    return <Badge variant="secondary">Belum dikerjakan</Badge>;
  }
  const score = Math.round(entry.masteryScore);
  if (score >= 80) {
    return (
      <Badge className="border-emerald-600/30 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400">
        {score}%
      </Badge>
    );
  }
  if (score >= 50) {
    return (
      <Badge className="border-amber-600/30 bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
        {score}%
      </Badge>
    );
  }
  return <Badge variant="destructive">{score}%</Badge>;
}

export default function PracticePage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<TopicWithCounts[]>([]);
  const [mastery, setMastery] = useState<MasteryEntry[]>([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [selectedTopicId, setSelectedTopicId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingDifficulty, setStartingDifficulty] = useState<Difficulty | null>(null);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const [subjectsRes, topicsRes, masteryRes] = await Promise.all([
          apiFetch<{ subjects: Subject[] }>("/api/subjects"),
          apiFetch<{ topics: TopicWithCounts[] }>("/api/topics"),
          apiFetch<{ mastery: MasteryEntry[] }>("/api/me/mastery"),
        ]);
        setSubjects(subjectsRes.subjects);
        setTopics(topicsRes.topics);
        setMastery(masteryRes.mastery);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady]);

  const masteryByTopicDifficulty = useMemo(() => {
    const map = new Map<string, MasteryEntry>();
    for (const m of mastery) map.set(`${m.topicId}|${m.difficulty}`, m);
    return map;
  }, [mastery]);

  if (!isReady || !user) return null;

  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId) ?? null;
  const topicsForSubject = topics
    .filter((t) => t.subjectId === selectedSubjectId)
    .sort((a, b) => a.orderIndex - b.orderIndex);
  const selectedTopic = topics.find((t) => t.id === selectedTopicId) ?? null;

  async function handleStartDifficulty(topicId: string, difficulty: Difficulty) {
    setError(null);
    setStartingDifficulty(difficulty);
    try {
      const { session } = await apiFetch<{ session: { id: string } }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ source: "topic", topicId, difficulty }),
      });
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memulai latihan");
      setStartingDifficulty(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-muted/30">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        {!selectedSubject ? (
          <>
            <h1 className="mb-1 text-xl font-semibold">Latihan per Subbab</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Pilih mata pelajaran, lalu kerjakan subbab mana saja — bebas, tanpa urutan wajib.
            </p>

            {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}

            {!loading && !error && (
              <div className="grid gap-3 sm:grid-cols-2">
                {subjects.map((subject) => {
                  const Icon = SUBJECT_ICON[subject.name] ?? Sparkles;
                  const count = topics.filter((t) => t.subjectId === subject.id).length;
                  return (
                    <button
                      key={subject.id}
                      type="button"
                      onClick={() => setSelectedSubjectId(subject.id)}
                      className="group flex items-center gap-4 rounded-xl border bg-card p-4 text-left ring-1 ring-foreground/10 transition-all hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30"
                    >
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <Icon className="size-5" />
                      </span>
                      <span className="flex-1">
                        <span className="block text-sm font-medium">{subject.name}</span>
                        <span className="block text-xs text-muted-foreground">{count} subbab</span>
                      </span>
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                    </button>
                  );
                })}
              </div>
            )}
          </>
        ) : !selectedTopic ? (
          <>
            <button
              type="button"
              onClick={() => setSelectedSubjectId(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-4" />
              Ganti mata pelajaran
            </button>
            <h1 className="mb-1 text-xl font-semibold">{selectedSubject.name}</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Tap subbab untuk memilih tingkat kesulitan (Mudah/Sedang/Sulit).
            </p>

            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

            {topicsForSubject.length === 0 && (
              <p className="text-sm text-muted-foreground">Belum ada subbab untuk mata pelajaran ini.</p>
            )}

            <div className="flex flex-col gap-2">
              {topicsForSubject.map((topic) => {
                const totalQuestions = DIFFICULTY_ORDER.reduce((sum, d) => sum + topic.questionCounts[d], 0);
                const noQuestions = totalQuestions === 0;
                return (
                  <button
                    key={topic.id}
                    type="button"
                    disabled={noQuestions}
                    onClick={() => setSelectedTopicId(topic.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card p-4 text-left ring-1 ring-foreground/10 transition-all",
                      noQuestions
                        ? "cursor-not-allowed opacity-50"
                        : "hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30",
                    )}
                  >
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{topic.name}</span>
                      <span className="block text-xs text-muted-foreground">
                        {totalQuestions} soal tersedia
                      </span>
                    </span>
                    <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setSelectedTopicId(null)}
              className="mb-4 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground hover:underline"
            >
              <ArrowLeft className="size-4" />
              Kembali ke daftar subbab
            </button>
            <h1 className="mb-1 text-xl font-semibold">{selectedTopic.name}</h1>
            <p className="mb-6 text-sm text-muted-foreground">
              Pilih tingkat kesulitan — satu sesi berisi seluruh soal di level itu.
            </p>

            {error && <p className="mb-4 text-sm text-destructive">{error}</p>}

            <div className="flex flex-col gap-2">
              {DIFFICULTY_ORDER.map((difficulty) => {
                const count = selectedTopic.questionCounts[difficulty];
                const noQuestions = count === 0;
                const isStarting = startingDifficulty === difficulty;
                const masteryEntry = masteryByTopicDifficulty.get(`${selectedTopic.id}|${difficulty}`);
                const estimatedMinutes = Math.max(10, Math.round(count * MINUTES_PER_QUESTION[difficulty]));
                return (
                  <button
                    key={difficulty}
                    type="button"
                    disabled={noQuestions || isStarting}
                    onClick={() => handleStartDifficulty(selectedTopic.id, difficulty)}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border bg-card p-4 text-left ring-1 ring-foreground/10 transition-all",
                      noQuestions
                        ? "cursor-not-allowed opacity-50"
                        : "hover:-translate-y-0.5 hover:shadow-md hover:ring-primary/30",
                    )}
                  >
                    <span className="flex-1">
                      <span className="block text-sm font-medium">{DIFFICULTY_LABEL[difficulty]}</span>
                      <span className="block text-xs text-muted-foreground">
                        {noQuestions
                          ? "Belum ada soal"
                          : `${count} soal · ~${estimatedMinutes} menit`}
                      </span>
                    </span>
                    {!noQuestions && <MasteryBadge entry={masteryEntry} />}
                    {isStarting ? (
                      <span className="text-xs text-muted-foreground">Memulai...</span>
                    ) : (
                      <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
