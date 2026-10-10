/**
 * Tiny line-diff used for change statistics in the review card.
 * Monaco's DiffEditor computes the actual visual diff; this just powers the
 * "+N -M" badge without pulling in a diff library.
 */
export interface DiffStat {
  added: number;
  removed: number;
}

export function diffStat(before: string, after: string): DiffStat {
  const a = before.length ? before.split("\n") : [];
  const b = after.length ? after.split("\n") : [];
  const setA = countMap(a);
  const setB = countMap(b);
  let added = 0;
  let removed = 0;
  for (const [line, n] of setB) {
    const before_n = setA.get(line) ?? 0;
    if (n > before_n) added += n - before_n;
  }
  for (const [line, n] of setA) {
    const after_n = setB.get(line) ?? 0;
    if (n > after_n) removed += n - after_n;
  }
  return { added, removed };
}

function countMap(lines: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l, (m.get(l) ?? 0) + 1);
  return m;
}
