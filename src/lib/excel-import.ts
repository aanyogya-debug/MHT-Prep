import { DIFFICULTIES, OPTION_LABELS } from "./validations/question";

// Template kolom Excel — didesain dari nol karena dokumen v0.2.0 yang jadi
// rujukan aslinya (section 6 brief) tidak ada di project ini. Satu baris =
// satu soal pilihan ganda 5 opsi. passage_title/passage_text opsional —
// dipakai utk reading comprehension (satu bacaan, beberapa nomor soal):
// isi passage_text lengkap di baris kemunculan PERTAMA judul itu saja,
// baris-baris berikutnya dgn passage_title sama cukup isi judulnya.
export const IMPORT_COLUMNS = [
  "subject",
  "topic",
  "difficulty",
  "question_text",
  "option_a",
  "option_b",
  "option_c",
  "option_d",
  "option_e",
  "correct_option",
  "explanation",
  "image_url",
  "passage_title",
  "passage_text",
] as const;

export interface RawImportRow {
  rowNumber: number; // nomor baris asli di Excel (termasuk header) — biar gampang dicocokkan admin
  subject?: string;
  topic?: string;
  difficulty?: string;
  question_text?: string;
  option_a?: string;
  option_b?: string;
  option_c?: string;
  option_d?: string;
  option_e?: string;
  correct_option?: string;
  explanation?: string;
  image_url?: string;
  passage_title?: string;
  passage_text?: string;
}

export interface ParsedQuestionRow {
  rowNumber: number;
  subjectSlug: string;
  topicName: string;
  topicId: string;
  difficulty: (typeof DIFFICULTIES)[number];
  questionText: string;
  options: { label: string; text: string; isCorrect: boolean }[];
  explanation?: string;
  imageUrl?: string;
  passageKey?: string; // = title (unik global) — dipetakan ke id nyata (existing/baru) saat commit
}

export interface NewPassageToCreate {
  key: string; // = title, sama dgn ParsedQuestionRow.passageKey
  topicId: string; // "topik rumah" = topik baris yg pertama kali memperkenalkan passage ini
  title: string;
  content: string;
}

export interface RowValidationError {
  rowNumber: number;
  message: string;
}

export interface ValidateImportResult {
  validRows: ParsedQuestionRow[];
  errors: RowValidationError[];
  newPassages: NewPassageToCreate[];
}

function topicKey(subjectSlug: string, topicName: string): string {
  return `${subjectSlug}::${topicName}`;
}

export function buildTopicLookupKey(subjectSlug: string, topicName: string): string {
  return topicKey(subjectSlug, topicName);
}

export function buildPassageLookupKey(title: string): string {
  return title;
}

// topicLookup: "subjectSlug::topicName" -> topicId
// existingPassageLookup: title -> passageId (passage yg sudah ada di DB). Title
// unik GLOBAL (bukan per-topik) karena satu passage lazim dipakai lintas topik
// skill yang berbeda (mis. "Reading - Main Idea" & "Reading - Detail
// Information" sama-sama soal dari 1 bacaan yang sama).
// Keduanya dicari pemanggil dari DB sebelum manggil fungsi ini — fungsi ini
// sendiri murni (tidak sentuh DB), jadi bisa ditest tanpa database.
export function validateImportRows(
  rows: RawImportRow[],
  topicLookup: ReadonlyMap<string, string>,
  existingPassageLookup: ReadonlyMap<string, string> = new Map(),
): ValidateImportResult {
  const validRows: ParsedQuestionRow[] = [];
  const errors: RowValidationError[] = [];
  const newPassagesByKey = new Map<string, NewPassageToCreate>();

  for (const row of rows) {
    const rowErrors: string[] = [];

    const subjectSlug = row.subject?.trim().toLowerCase() ?? "";
    const topicName = row.topic?.trim() ?? "";
    const difficulty = row.difficulty?.trim().toUpperCase() ?? "";
    const questionText = row.question_text?.trim() ?? "";
    const correctOption = row.correct_option?.trim().toUpperCase() ?? "";

    if (!subjectSlug) rowErrors.push("Kolom subject kosong");
    if (!topicName) rowErrors.push("Kolom topic kosong");
    if (!(DIFFICULTIES as readonly string[]).includes(difficulty)) {
      rowErrors.push(`difficulty harus salah satu dari ${DIFFICULTIES.join("/")}`);
    }
    if (!questionText) rowErrors.push("Kolom question_text kosong");

    type OptionColumn = "option_a" | "option_b" | "option_c" | "option_d" | "option_e";
    const optionTexts = OPTION_LABELS.map((label) => {
      const key = `option_${label.toLowerCase()}` as OptionColumn;
      return row[key]?.trim() ?? "";
    });
    optionTexts.forEach((text, i) => {
      if (!text) rowErrors.push(`Kolom option_${OPTION_LABELS[i].toLowerCase()} kosong`);
    });

    if (!(OPTION_LABELS as readonly string[]).includes(correctOption)) {
      rowErrors.push(`correct_option harus salah satu dari ${OPTION_LABELS.join("/")}`);
    }

    let topicId: string | undefined;
    if (subjectSlug && topicName) {
      topicId = topicLookup.get(topicKey(subjectSlug, topicName));
      if (!topicId) {
        rowErrors.push(`Topik "${topicName}" tidak ditemukan di subject "${subjectSlug}"`);
      }
    }

    let passageKey: string | undefined;
    const passageTitle = row.passage_title?.trim();
    if (passageTitle && topicId) {
      passageKey = buildPassageLookupKey(passageTitle);
      const alreadyKnown = existingPassageLookup.has(passageKey) || newPassagesByKey.has(passageKey);
      if (!alreadyKnown) {
        const passageText = row.passage_text?.trim();
        if (!passageText) {
          rowErrors.push(
            `passage_text wajib diisi utk kemunculan pertama passage "${passageTitle}"`,
          );
        } else {
          newPassagesByKey.set(passageKey, { key: passageKey, topicId, title: passageTitle, content: passageText });
        }
      }
    }

    if (rowErrors.length > 0) {
      errors.push({ rowNumber: row.rowNumber, message: rowErrors.join("; ") });
      continue;
    }

    validRows.push({
      rowNumber: row.rowNumber,
      subjectSlug,
      topicName,
      topicId: topicId!,
      difficulty: difficulty as (typeof DIFFICULTIES)[number],
      questionText,
      options: OPTION_LABELS.map((label, i) => ({
        label,
        text: optionTexts[i],
        isCorrect: label === correctOption,
      })),
      explanation: row.explanation?.trim() || undefined,
      imageUrl: row.image_url?.trim() || undefined,
      passageKey,
    });
  }

  return { validRows, errors, newPassages: Array.from(newPassagesByKey.values()) };
}
