"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Subject, Topic } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";

export default function StudentPathListPage() {
  const { user, isReady } = useRequireAuth();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady]);

  if (!isReady || !user) return null;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold">Learning Path</h1>
        <p className="mb-6 text-sm text-muted-foreground">
          Pilih topik untuk melihat urutan materi &amp; latihan berjenjangnya.
        </p>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && !error && (
          <div className="flex flex-col gap-6">
            {subjects.map((subject) => {
              const subjectTopics = topics
                .filter((t) => t.subjectId === subject.id)
                .sort((a, b) => a.orderIndex - b.orderIndex);
              if (subjectTopics.length === 0) return null;

              return (
                <div key={subject.id}>
                  <h2 className="mb-2 text-sm font-medium text-muted-foreground">{subject.name}</h2>
                  <div className="flex flex-wrap gap-2">
                    {subjectTopics.map((topic) => (
                      <Button
                        key={topic.id}
                        variant="outline"
                        size="sm"
                        render={<Link href={`/path/${topic.id}`} />}
                      >
                        {topic.name}
                      </Button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
