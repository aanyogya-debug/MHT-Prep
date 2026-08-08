import { randomUUID } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth/guard";
import { parseImportFile } from "@/lib/excel-parser";
import {
  validateImportRows,
  buildTopicLookupKey,
  buildPassageLookupKey,
  type ValidateImportResult,
} from "@/lib/excel-import";

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

async function buildPassageLookup(): Promise<Map<string, string>> {
  const passages = await db.passage.findMany();
  const lookup = new Map<string, string>();
  for (const passage of passages) {
    lookup.set(buildPassageLookupKey(passage.title), passage.id);
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

async function parseAndValidate(
  request: NextRequest,
): Promise<{ result: ValidateImportResult; existingPassageLookup: Map<string, string> }> {
  const rawRows = await readAndParseFile(request);
  const [topicLookup, existingPassageLookup] = await Promise.all([
    buildTopicLookup(),
    buildPassageLookup(),
  ]);
  return { result: validateImportRows(rawRows, topicLookup, existingPassageLookup), existingPassageLookup };
}

// Preview — parse + validasi saja, TIDAK menulis ke DB (section 6: "preview
// (PUT) dulu, baru commit (POST)").
export async function PUT(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const { result } = await parseAndValidate(request);
    const { validRows, errors, newPassages } = result;
    return NextResponse.json({
      summary: { total: validRows.length + errors.length, valid: validRows.length, invalid: errors.length },
      validRows,
      errors,
      newPassages,
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
// request). Passage baru dibuat dulu (kalau ada), baru soal-soal yang
// mereferensikannya — semua dalam satu transaksi interaktif (all-or-nothing).
export async function POST(request: NextRequest) {
  const auth = requireRole(request, "ADMIN");
  if (!auth.ok) return auth.response;

  try {
    const { result, existingPassageLookup } = await parseAndValidate(request);
    const { validRows, errors, newPassages } = result;
    if (errors.length > 0) {
      return NextResponse.json(
        { error: "Masih ada baris tidak valid — perbaiki dulu lewat preview", errors },
        { status: 400 },
      );
    }
    if (validRows.length === 0) {
      return NextResponse.json({ error: "Tidak ada baris untuk diimpor" }, { status: 400 });
    }

    // Insert satu-satu (satu round-trip per baris) kena timeout transaksi
    // interaktif default Prisma (5 detik) begitu file-nya lebih dari
    // segelintir baris — nyata kejadian saat testing dgn 25 baris. Passage
    // tetap perlu create satu-satu (butuh id-nya lebih dulu utk di-reference),
    // tapi Question+QuestionOption di-batch pakai createMany (id di-generate
    // di sini spy bisa di-link sebelum insert, bukan nunggu DB assign).
    const createdCount = await db.$transaction(async (tx) => {
      const passageIdByKey = new Map<string, string>(existingPassageLookup);
      for (const p of newPassages) {
        const passage = await tx.passage.create({
          data: { topicId: p.topicId, title: p.title, content: p.content, createdById: auth.payload.sub },
        });
        passageIdByKey.set(p.key, passage.id);
      }

      const questionRows = validRows.map((row) => ({
        id: randomUUID(),
        topicId: row.topicId,
        difficulty: row.difficulty,
        questionText: row.questionText,
        explanation: row.explanation,
        imageUrl: row.imageUrl,
        passageId: row.passageKey ? passageIdByKey.get(row.passageKey) : undefined,
        createdById: auth.payload.sub,
      }));
      await tx.question.createMany({ data: questionRows });

      const optionRows = validRows.flatMap((row, i) =>
        row.options.map((option) => ({
          id: randomUUID(),
          questionId: questionRows[i].id,
          label: option.label,
          text: option.text,
          isCorrect: option.isCorrect,
        })),
      );
      await tx.questionOption.createMany({ data: optionRows });

      return questionRows.length;
    });

    return NextResponse.json({ createdCount }, { status: 201 });
  } catch (err) {
    if (err instanceof FileParseError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    console.error("POST /api/questions/import failed:", err);
    return NextResponse.json({ error: "Terjadi kesalahan pada server" }, { status: 500 });
  }
}
