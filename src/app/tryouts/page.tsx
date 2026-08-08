"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { ExerciseSession, Tryout } from "@prisma/client";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

export default function StudentTryoutsPage() {
  const { user, isReady } = useRequireAuth();
  const router = useRouter();

  const [tryouts, setTryouts] = useState<Tryout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [startingId, setStartingId] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      try {
        const { tryouts } = await apiFetch<{ tryouts: Tryout[] }>("/api/tryouts");
        setTryouts(tryouts);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : "Gagal memuat tryout");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady]);

  if (!isReady || !user) return null;

  async function handleStart(tryoutId: string) {
    setError(null);
    setStartingId(tryoutId);
    try {
      const { session } = await apiFetch<{ session: ExerciseSession }>("/api/sessions", {
        method: "POST",
        body: JSON.stringify({ source: "tryout", tryoutId }),
      });
      router.push(`/sessions/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal memulai tryout");
    } finally {
      setStartingId(null);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-2xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold">Tryout</h1>

        {loading && <p className="text-sm text-muted-foreground">Memuat...</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}

        {!loading && tryouts.length === 0 && (
          <p className="text-sm text-muted-foreground">Belum ada tryout tersedia.</p>
        )}

        <div className="flex flex-col gap-3">
          {tryouts.map((tryout) => (
            <Card key={tryout.id}>
              <CardHeader>
                <CardTitle>{tryout.title}</CardTitle>
                <CardDescription>{tryout.difficultyTier} · 200 menit</CardDescription>
              </CardHeader>
              <CardContent>
                <Button onClick={() => handleStart(tryout.id)} disabled={startingId === tryout.id}>
                  {startingId === tryout.id ? "Memulai..." : "Mulai Tryout"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
}
