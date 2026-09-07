interface MasteryItem {
  topicId: string;
  topicName: string;
  subjectName: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  masteryScore: number;
  questionsAttempted: number;
  questionsCorrect: number;
}

const DIFFICULTY_LABEL: Record<MasteryItem["difficulty"], string> = {
  EASY: "Mudah",
  MEDIUM: "Sedang",
  HARD: "Sulit",
};
const DIFFICULTY_ORDER: MasteryItem["difficulty"][] = ["EASY", "MEDIUM", "HARD"];

// Bar horizontal satu-hue (bg-primary) — magnitude (0-100%), bukan identitas,
// jadi tidak butuh palet kategorikal/legend (lihat skill dataviz: "sequential
// = satu hue, panjang bar yang membawa makna, bukan warnanya").
//
// Sejak "latihan bertingkat": mastery dipecah per (topik, tingkat kesulitan),
// jadi tiap topik kini menampilkan 3 bar mini (Mudah/Sedang/Sulit) bukan satu
// bar gabungan, supaya kelihatan "sudah kuasai Mudah tapi Sulit belum".
export function MasteryBars({ items }: { items: MasteryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada data — siswa belum mengerjakan latihan apa pun.
      </p>
    );
  }

  const bySubject = new Map<string, Map<string, { topicName: string; byDifficulty: Map<string, MasteryItem> }>>();
  for (const item of items) {
    const subjectTopics = bySubject.get(item.subjectName) ?? new Map();
    const topicEntry = subjectTopics.get(item.topicId) ?? { topicName: item.topicName, byDifficulty: new Map() };
    topicEntry.byDifficulty.set(item.difficulty, item);
    subjectTopics.set(item.topicId, topicEntry);
    bySubject.set(item.subjectName, subjectTopics);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(bySubject.entries()).map(([subjectName, topics]) => (
        <div key={subjectName}>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{subjectName}</h3>
          <div className="flex flex-col gap-4">
            {Array.from(topics.entries()).map(([topicId, { topicName, byDifficulty }]) => (
              <div key={topicId}>
                <p className="mb-1 truncate text-sm font-medium" title={topicName}>
                  {topicName}
                </p>
                <div className="flex flex-col gap-1">
                  {DIFFICULTY_ORDER.map((diff) => {
                    const m = byDifficulty.get(diff);
                    return (
                      <div key={diff} className="flex items-center gap-3">
                        <span className="w-14 shrink-0 text-xs text-muted-foreground">{DIFFICULTY_LABEL[diff]}</span>
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                          {m && (
                            <div
                              className="h-full rounded-full bg-primary"
                              style={{ width: `${Math.max(0, Math.min(100, m.masteryScore))}%` }}
                            />
                          )}
                        </div>
                        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                          {m ? `${Math.round(m.masteryScore)}%` : "—"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
