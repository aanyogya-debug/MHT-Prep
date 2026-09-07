"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MasteryBars } from "@/components/mastery-bars";
import { ScoreTrendChart } from "@/components/score-trend-chart";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface MasteryItem {
  topicId: string;
  topicName: string;
  subjectName: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  masteryScore: number;
  questionsAttempted: number;
  questionsCorrect: number;
}

interface SessionSummary {
  id: string;
  mode: "PRACTICE" | "SIMULATION";
  status: "IN_PROGRESS" | "SUBMITTED" | "EXPIRED";
  label: string;
  score: number | null;
  correctCount: number | null;
  incorrectCount: number | null;
  unansweredCount: number | null;
  totalQuestions: number;
  startedAt: string;
  submittedAt: string | null;
}

interface ProgressData {
  student: { id: string; name: string; email: string };
  mastery: MasteryItem[];
  sessions: SessionSummary[];
}

function statusLabel(status: SessionSummary["status"]) {
  if (status === "IN_PROGRESS") return "Sedang berjalan";
  if (status === "EXPIRED") return "Waktu habis";
  return "Selesai";
}

export default function AdminStudentProgressPage() {
  const { user, isReady } = useRequireAuth("ADMIN");
  const { id } = useParams<{ id: string }>();

  const [data, setData] = useState<ProgressData | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  useEffect(() => {
    if (!isReady) return;
    (async () => {
      setLoading(true);
      setLoadError(null);
      try {
        const result = await apiFetch<ProgressData>(`/api/students/${id}/progress`);
        setData(result);
      } catch (err) {
        setLoadError(err instanceof ApiError ? err.message : "Gagal memuat data");
      } finally {
        setLoading(false);
      }
    })();
  }, [isReady, id]);

  if (!isReady || !user) return null;

  async function handleReset() {
    if (!data) return;
    const confirmed = confirm(
      `Reset seluruh progres ${data.student.name}? Semua riwayat sesi latihan/tryout dan skor mastery akan dihapus permanen. Akun (nama, email, password) tetap ada — siswa mulai dari nol lagi.`,
    );
    if (!confirmed) return;

    setResetError(null);
    setIsResetting(true);
    try {
      await apiFetch(`/api/students/${id}/reset`, { method: "POST" });
      const result = await apiFetch<ProgressData>(`/api/students/${id}/progress`);
      setData(result);
    } catch (err) {
      setResetError(err instanceof ApiError ? err.message : "Gagal mereset progres");
    } finally {
      setIsResetting(false);
    }
  }

  const trendPoints = data
    ? data.sessions
        .filter((s) => s.mode === "SIMULATION" && s.status !== "IN_PROGRESS" && s.score !== null)
        .map((s) => ({ id: s.id, date: s.submittedAt ?? s.startedAt, score: s.score!, label: s.label }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    : [];

  const sortedSessions = data
    ? [...data.sessions].sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime())
    : [];

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <Link href="/admin/students" className="text-sm text-muted-foreground hover:underline">
          &larr; Kembali ke Siswa
        </Link>

        {loading && <p className="mt-4 text-sm text-muted-foreground">Memuat...</p>}
        {loadError && <p className="mt-4 text-sm text-destructive">{loadError}</p>}

        {!loading && !loadError && data && (
          <>
            <div className="mt-2 mb-6 flex items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-semibold">Progres — {data.student.name}</h1>
                <p className="text-sm text-muted-foreground">{data.student.email}</p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleReset}
                disabled={isResetting}
              >
                {isResetting ? "Mereset..." : "Reset Progres"}
              </Button>
            </div>
            {resetError && <p className="mb-4 text-sm text-destructive">{resetError}</p>}

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Tren Skor Tryout</CardTitle>
              </CardHeader>
              <CardContent>
                <ScoreTrendChart points={trendPoints} />
              </CardContent>
            </Card>

            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Mastery per Topik</CardTitle>
              </CardHeader>
              <CardContent>
                <MasteryBars items={data.mastery} />
              </CardContent>
            </Card>

            <h2 className="mb-2 text-sm font-medium text-muted-foreground">Riwayat Sesi</h2>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Mode</TableHead>
                  <TableHead>Topik/Tryout</TableHead>
                  <TableHead>Skor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Tanggal</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedSessions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground">
                      Belum ada sesi latihan/tryout
                    </TableCell>
                  </TableRow>
                )}
                {sortedSessions.map((s) => (
                  <TableRow key={s.id}>
                    <TableCell>
                      <Badge variant="secondary">{s.mode === "SIMULATION" ? "Tryout" : "Latihan"}</Badge>
                    </TableCell>
                    <TableCell>{s.label}</TableCell>
                    <TableCell>
                      {s.score ?? "-"} {s.status !== "IN_PROGRESS" && `(${s.correctCount}/${s.totalQuestions} benar)`}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{statusLabel(s.status)}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(s.startedAt).toLocaleDateString("id-ID")}
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
