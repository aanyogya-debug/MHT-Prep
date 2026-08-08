interface MasteryItem {
  topicId: string;
  topicName: string;
  subjectName: string;
  masteryScore: number;
  questionsAttempted: number;
  questionsCorrect: number;
}

// Bar horizontal satu-hue (bg-primary) — magnitude (0-100%), bukan identitas,
// jadi tidak butuh palet kategorikal/legend (lihat skill dataviz: "sequential
// = satu hue, panjang bar yang membawa makna, bukan warnanya").
export function MasteryBars({ items }: { items: MasteryItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Belum ada data — siswa belum mengerjakan latihan apa pun.
      </p>
    );
  }

  const bySubject = new Map<string, MasteryItem[]>();
  for (const item of items) {
    const list = bySubject.get(item.subjectName) ?? [];
    list.push(item);
    bySubject.set(item.subjectName, list);
  }

  return (
    <div className="flex flex-col gap-6">
      {Array.from(bySubject.entries()).map(([subjectName, topics]) => (
        <div key={subjectName}>
          <h3 className="mb-2 text-sm font-medium text-muted-foreground">{subjectName}</h3>
          <div className="flex flex-col gap-2">
            {topics.map((t) => (
              <div key={t.topicId} className="flex items-center gap-3">
                <span className="w-48 shrink-0 truncate text-sm" title={t.topicName}>
                  {t.topicName}
                </span>
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max(0, Math.min(100, t.masteryScore))}%` }}
                  />
                </div>
                <span className="w-12 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
                  {Math.round(t.masteryScore)}%
                </span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
