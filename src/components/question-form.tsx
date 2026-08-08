"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { Difficulty, Question, QuestionOption } from "@prisma/client";
import { apiFetch, ApiError } from "@/lib/api-client";
import { MarkdownContent } from "@/components/markdown-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPTION_LABELS, DIFFICULTIES } from "@/lib/validations/question";

type QuestionWithOptions = Question & { options: QuestionOption[] };

function buildInitialOptions(question?: QuestionWithOptions): string[] {
  if (!question) return OPTION_LABELS.map(() => "");
  const byLabel = new Map(question.options.map((o) => [o.label, o.text]));
  return OPTION_LABELS.map((label) => byLabel.get(label) ?? "");
}

function findInitialCorrectIndex(question?: QuestionWithOptions): number {
  if (!question) return 0;
  const byLabel = new Map(question.options.map((o) => [o.label, o.isCorrect]));
  const index = OPTION_LABELS.findIndex((label) => byLabel.get(label));
  return index === -1 ? 0 : index;
}

export function QuestionForm({
  topicId,
  question,
}: {
  topicId: string;
  question?: QuestionWithOptions;
}) {
  const router = useRouter();
  const isEditing = !!question;

  const [difficulty, setDifficulty] = useState<Difficulty>(question?.difficulty ?? "EASY");
  const [questionText, setQuestionText] = useState(question?.questionText ?? "");
  const [explanation, setExplanation] = useState(question?.explanation ?? "");
  const [imageUrl, setImageUrl] = useState(question?.imageUrl ?? "");
  const [sourceImageUrl, setSourceImageUrl] = useState(question?.sourceImageUrl ?? "");
  const [optionTexts, setOptionTexts] = useState<string[]>(buildInitialOptions(question));
  const [correctIndex, setCorrectIndex] = useState(String(findInitialCorrectIndex(question)));
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function updateOptionText(index: number, text: string) {
    setOptionTexts((prev) => prev.map((t, i) => (i === index ? text : t)));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const payload = {
      topicId,
      difficulty,
      questionText,
      explanation: explanation || undefined,
      imageUrl: imageUrl || undefined,
      sourceImageUrl: sourceImageUrl || undefined,
      options: optionTexts.map((text, i) => ({ text, isCorrect: String(i) === correctIndex })),
    };

    try {
      if (isEditing) {
        await apiFetch(`/api/questions/${question.id}`, {
          method: "PATCH",
          body: JSON.stringify(payload),
        });
      } else {
        await apiFetch("/api/questions", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }
      router.push(`/admin/topics/${topicId}/questions`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Gagal menyimpan soal");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex max-w-40 flex-col gap-2">
        <Label htmlFor="difficulty">Tingkat kesulitan</Label>
        <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
          <SelectTrigger id="difficulty">
            <SelectValue placeholder="Pilih tingkat" />
          </SelectTrigger>
          <SelectContent>
            {DIFFICULTIES.map((d) => (
              <SelectItem key={d} value={d}>
                {d}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="question-text">Teks soal (markdown + LaTeX)</Label>
          <Textarea
            id="question-text"
            rows={8}
            value={questionText}
            onChange={(e) => setQuestionText(e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Preview</Label>
          <div className="max-h-56 overflow-y-auto rounded-lg border p-3">
            <MarkdownContent content={questionText || "_(kosong)_"} />
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="image-url">URL gambar (opsional, hasil crop Cloudinary)</Label>
          <Input
            id="image-url"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="source-image-url">URL halaman asli (opsional, referensi crop)</Label>
          <Input
            id="source-image-url"
            value={sourceImageUrl}
            onChange={(e) => setSourceImageUrl(e.target.value)}
            placeholder="https://..."
          />
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label>Pilihan jawaban (tandai yang benar)</Label>
        <RadioGroup value={correctIndex} onValueChange={(v) => setCorrectIndex(v as string)}>
          {OPTION_LABELS.map((label, index) => (
            <div key={label} className="flex items-start gap-3">
              <RadioGroupItem value={String(index)} id={`correct-${index}`} className="mt-2.5" />
              <div className="flex flex-1 items-center gap-2">
                <Label htmlFor={`option-${index}`} className="w-5 shrink-0 font-mono">
                  {label}
                </Label>
                <Textarea
                  id={`option-${index}`}
                  rows={1}
                  value={optionTexts[index]}
                  onChange={(e) => updateOptionText(index, e.target.value)}
                  required
                />
              </div>
            </div>
          ))}
        </RadioGroup>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="explanation">Pembahasan (opsional, markdown + LaTeX)</Label>
          <Textarea
            id="explanation"
            rows={6}
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label>Preview</Label>
          <div className="max-h-44 overflow-y-auto rounded-lg border p-3">
            <MarkdownContent content={explanation || "_(kosong)_"} />
          </div>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex justify-end">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan..." : "Simpan"}
        </Button>
      </div>
    </form>
  );
}
