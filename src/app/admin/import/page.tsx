"use client";

import { useState } from "react";
import { Navbar } from "@/components/navbar";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useAuthStore } from "@/store/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface ValidRowPreview {
  rowNumber: number;
  subjectSlug: string;
  topicName: string;
  difficulty: string;
  questionText: string;
}

interface RowError {
  rowNumber: number;
  message: string;
}

interface PreviewResult {
  summary: { total: number; valid: number; invalid: number };
  validRows: ValidRowPreview[];
  errors: RowError[];
}

export default function AdminImportPage() {
  const { user, isReady } = useRequireAuth("ADMIN");

  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<string | null>(null);

  if (!isReady || !user) return null;

  async function callImport(method: "PUT" | "POST") {
    if (!file) return null;
    const token = useAuthStore.getState().token;
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch("/api/questions/import", {
      method,
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      body: formData,
    });
    const data = await res.json().catch(() => null);
    if (!res.ok) {
      throw new Error(data?.error ?? "Gagal memproses file");
    }
    return data;
  }

  async function handlePreview() {
    setError(null);
    setCommitResult(null);
    setPreview(null);
    setIsPreviewing(true);
    try {
      const data = await callImport("PUT");
      setPreview(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal memuat preview");
    } finally {
      setIsPreviewing(false);
    }
  }

  async function handleCommit() {
    setError(null);
    setIsCommitting(true);
    try {
      const data = await callImport("POST");
      setCommitResult(`${data.createdCount} soal berhasil diimpor.`);
      setPreview(null);
      setFile(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Gagal mengimpor");
    } finally {
      setIsCommitting(false);
    }
  }

  async function handleDownloadTemplate() {
    const token = useAuthStore.getState().token;
    const res = await fetch("/api/questions/import/template", {
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "template-import-soal.xlsx";
    a.click();
    URL.revokeObjectURL(url);
  }

  const canCommit = preview !== null && preview.errors.length === 0 && preview.validRows.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar user={user} />
      <main className="mx-auto w-full max-w-3xl flex-1 p-6">
        <h1 className="mb-4 text-xl font-semibold">Import Soal dari Excel</h1>

        <div className="mb-6 flex flex-col gap-4 rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Belum punya template? Unduh dulu supaya kolomnya pas.
            </p>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              Unduh Template
            </Button>
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="import-file">File Excel (.xlsx)</Label>
            <Input
              id="import-file"
              type="file"
              accept=".xlsx"
              onChange={(e) => {
                setFile(e.target.files?.[0] ?? null);
                setPreview(null);
                setCommitResult(null);
                setError(null);
              }}
            />
          </div>

          <div className="flex gap-2">
            <Button onClick={handlePreview} disabled={!file || isPreviewing}>
              {isPreviewing ? "Memproses..." : "Preview"}
            </Button>
            <Button onClick={handleCommit} disabled={!canCommit || isCommitting} variant="outline">
              {isCommitting ? "Mengimpor..." : "Import Sekarang"}
            </Button>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}
          {commitResult && <p className="text-sm text-emerald-600">{commitResult}</p>}
        </div>

        {preview && (
          <>
            <p className="mb-3 text-sm text-muted-foreground">
              Total {preview.summary.total} baris — {preview.summary.valid} valid,{" "}
              {preview.summary.invalid} error
              {preview.summary.invalid > 0 &&
                " (perbaiki dulu di file Excel, lalu preview ulang sebelum bisa import)"}
            </p>

            {preview.errors.length > 0 && (
              <div className="mb-6">
                <h2 className="mb-2 text-sm font-medium text-destructive">Baris bermasalah</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Baris</TableHead>
                      <TableHead>Error</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.errors.map((err) => (
                      <TableRow key={err.rowNumber}>
                        <TableCell>{err.rowNumber}</TableCell>
                        <TableCell className="text-destructive">{err.message}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}

            {preview.validRows.length > 0 && (
              <div>
                <h2 className="mb-2 text-sm font-medium text-muted-foreground">Baris valid</h2>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Baris</TableHead>
                      <TableHead>Topik</TableHead>
                      <TableHead>Tingkat</TableHead>
                      <TableHead>Teks Soal</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {preview.validRows.map((row) => (
                      <TableRow key={row.rowNumber}>
                        <TableCell>{row.rowNumber}</TableCell>
                        <TableCell>
                          {row.subjectSlug} / {row.topicName}
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary">{row.difficulty}</Badge>
                        </TableCell>
                        <TableCell className="max-w-md truncate">{row.questionText}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
