import ExcelJS from "exceljs";
import { IMPORT_COLUMNS, type RawImportRow } from "./excel-import";

function isRowEmpty(row: ExcelJS.Row): boolean {
  let empty = true;
  row.eachCell({ includeEmpty: false }, (cell) => {
    if (cell.value != null && String(cell.value).trim() !== "") empty = false;
  });
  return empty;
}

export async function parseImportFile(buffer: ArrayBuffer): Promise<RawImportRow[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const columnIndexByName = new Map<string, number>();
  sheet.getRow(1).eachCell((cell, colNumber) => {
    const name = String(cell.value ?? "").trim().toLowerCase();
    if (name) columnIndexByName.set(name, colNumber);
  });

  const rows: RawImportRow[] = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1 || isRowEmpty(row)) return;

    const get = (col: (typeof IMPORT_COLUMNS)[number]): string | undefined => {
      const idx = columnIndexByName.get(col);
      if (!idx) return undefined;
      const value = row.getCell(idx).value;
      return value == null ? undefined : String(value);
    };

    rows.push({
      rowNumber,
      subject: get("subject"),
      topic: get("topic"),
      difficulty: get("difficulty"),
      question_text: get("question_text"),
      option_a: get("option_a"),
      option_b: get("option_b"),
      option_c: get("option_c"),
      option_d: get("option_d"),
      option_e: get("option_e"),
      correct_option: get("correct_option"),
      explanation: get("explanation"),
      image_url: get("image_url"),
      passage_title: get("passage_title"),
      passage_text: get("passage_text"),
    });
  });

  return rows;
}

export async function buildImportTemplate(): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Soal");
  sheet.addRow([...IMPORT_COLUMNS]);
  sheet.addRow([
    "matematika",
    "Aljabar",
    "EASY",
    "Berapa hasil dari $2 + 2$?",
    "3",
    "4",
    "5",
    "6",
    "7",
    "B",
    "$2 + 2 = 4$",
    "",
    "",
    "",
  ]);
  // Contoh reading comprehension: 2 soal berbagi 1 passage. passage_text
  // cukup diisi di kemunculan pertama; baris kedua cukup passage_title saja.
  sheet.addRow([
    "bahasa_inggris",
    "Reading - Main Idea",
    "EASY",
    "What is the main idea of the passage?",
    "The weather in Jakarta",
    "The history of Jakarta",
    "The population growth of Jakarta",
    "The traffic in Jakarta",
    "The food in Jakarta",
    "C",
    "",
    "",
    "Passage 1",
    "Jakarta has grown rapidly over the past few decades. In 1950, the city had fewer than two million residents. Today, the greater Jakarta area is home to more than thirty million people, making it one of the most populous urban regions in the world.",
  ]);
  sheet.addRow([
    "bahasa_inggris",
    "Reading - Detail Information",
    "EASY",
    "According to the passage, how many people lived in Jakarta in 1950?",
    "Fewer than two million",
    "More than thirty million",
    "About ten million",
    "About twenty million",
    "About five million",
    "A",
    "",
    "",
    "Passage 1",
    "",
  ]);
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
