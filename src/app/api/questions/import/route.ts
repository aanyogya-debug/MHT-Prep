import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { parseImportFile } from "@/lib/excel-parser";
import { validateImportRows, buildTopicLookupKey, type ValidateImportResult } from "@/lib/excel-import";

// Dibedakan dari error lain (mis. DB down) supaya tidak salah dilabeli
// "gagal baca file" padahal sebenarnya masalah server — kesalahan yg
// hampir kejadian saat implementasi (satu try/catch besar menutupi
// keduanya dengan pesan yg sama).
class FileParseError extends Error {}

async function buildTopicLookup(): Promise<Map<string, string>> {
  const topics = await db.topic.findMany({ include: { subject: true } });
  const lookup = new Map<string, string>();
  for (const topic of topics) {
    lookup.set(buildTopicLookupKey(topic.subject.slug, topic.name), topic.id);
  }
  return lookup;
}

async function readAndParseFile(request: NextRequest) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    throw new FileParseError("Body request bukan multipart/form-data yang valid");
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    throw new FileParseError("File wajib diunggah (field 'file')");
  }

  let rawRows;
  try {
    const buffer = await file.arrayBuffer();
    rawRows = await parseImportFile(buffer);
  } catch {
    throw new FileParseError("File bukan format .xlsx yang valid");
  }

  if (rawRows.length === 0) {
    throw new FileParseError("File kosong atau format kolom tidak dikenali");
  }

  return rawRows;
}

async function parseAndValidate(request: NextRequest): Promise<ValidateImportResult> {
  const rawRows = await readAndParseFile(request);
  const topicLookup = await buildTopicLookup();
  return validateImportRows(rawRows, topicLookup);
}

// Preview — parse + validasi saja, TIDAK menulis ke DB (section 6: "preview
// (PUT) dulu, baru commit (POST)").
export async function PUT(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const { validRows, errors } = await parseAndValidate(request);
    return NextResponse.json({
      summary: { total: validRows.length + errors.length, valid: validRows.length, invalid: errors.length },
      validRows,
      errors,
    });
  } catch (err) {
    if (err instanceof FileParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("PUT /api/questions/import failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}

// Commit — hanya jalan kalau HASIL PARSE SAAT INI 100% valid (bukan
// mengandalkan preview sebelumnya, karena file bisa saja beda antara dua
// request). Semua soal dibuat dalam satu transaksi (all-or-nothing).
export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const { validRows, errors } = await parseAndValidate(request);
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Masih ada baris tidak valid — perbaiki dulu lewat preview", errors },
        { status: 400 },
      );
    }
    if (validRows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris untuk diimpor" }, { status: 400 });
    }

    const created = await db.$transaction(
      validRows.map((row) =>
        db.question.create({
          data: {
            topicId: row.topicId,
            difficulty: row.difficulty,
            questionText: row.questionText,
            explanation: row.explanation,
            imageUrl: row.imageUrl,
            createdById: auth.payload.sub,
            options: { create: row.options },
          },
        }),
      ),
    );

    return NextResponse.json({ createdCount: created.length }, { status: 201 });
  } catch (err) {
    if (err instanceof FileParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/questions/import failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
