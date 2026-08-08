// Section 3: progres learning path dikunci — step berikutnya baru terbuka
// kalau step sebelumnya "selesai". Untuk practice step, "selesai" berarti
// skor sesi terbaik (bukan sekadar attempt terakhir — retry tidak boleh
// mengunci ulang step yang sudah pernah lulus) sudah lulus unlockThreshold.
// unlockThreshold null = auto-unlock tanpa syarat skor (topik tanpa
// prasyarat pedagogis kuat, mis. Biologi/Reading — lihat section 3 & 8).
//
// Modul ini murni urus kaskade lock/unlock berdasarkan order_index; definisi
// "selesai" untuk lesson step (mis. sudah dibuka vs harus di-acknowledge)
// sengaja diserahkan ke pemanggil — itu keputusan UX yang lebih baik
// diputuskan sambil lihat perilaku sungguhan, bukan ditebak di sini.

export function hasPassedThreshold(
  bestScore: number | null,
  unlockThreshold: number | null,
): boolean {
  if (unlockThreshold === null) return true;
  if (bestScore === null) return false;
  return bestScore >= unlockThreshold;
}

export interface OrderedStep {
  id: string;
  orderIndex: number;
}

// order_index bersifat per-subject/topik, bukan urutan global — kaskade ini
// dijalankan per topik (siswa bisa jalan paralel di beberapa topik sekaligus).
export function computeUnlockedStepIds(
  steps: OrderedStep[],
  completedStepIds: ReadonlySet<string>,
): Set<string> {
  const sorted = [...steps].sort((a, b) => a.orderIndex - b.orderIndex);
  const unlocked = new Set<string>();

  sorted.forEach((step, index) => {
    if (index === 0) {
      unlocked.add(step.id);
      return;
    }
    const previous = sorted[index - 1];
    if (completedStepIds.has(previous.id)) {
      unlocked.add(step.id);
    }
  });

  return unlocked;
}

export type PathStepStatusValue = "LOCKED" | "UNLOCKED" | "COMPLETED";

export function resolveStepStatus(
  stepId: string,
  unlockedStepIds: ReadonlySet<string>,
  completedStepIds: ReadonlySet<string>,
): PathStepStatusValue {
  if (completedStepIds.has(stepId)) return "COMPLETED";
  if (unlockedStepIds.has(stepId)) return "UNLOCKED";
  return "LOCKED";
}
