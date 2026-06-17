import type { IntegrityPair, IntegrityReport, SessionEvent, StudentState } from "@collabcode/shared";

function tokens(value: string): Set<string> {
  return new Set(
    value
      .replace(/#[^\n]*|\/\/[^\n]*/g, "")
      .toLowerCase()
      .split(/[^a-z0-9_]+/)
      .filter((token) => token.length > 2)
  );
}

function jaccard(a: Set<string>, b: Set<string>): number {
  const intersection = [...a].filter((value) => b.has(value)).length;
  const union = new Set([...a, ...b]).size;
  return union ? intersection / union : 0;
}

function timingCorrelation(a: SessionEvent[], b: SessionEvent[]): number {
  const aSnapshots = a.filter((event) => event.type === "snapshot").slice(-50);
  const bSnapshots = b.filter((event) => event.type === "snapshot").slice(-50);
  if (aSnapshots.length < 4 || bSnapshots.length < 4) return 0;
  const matches = aSnapshots.filter((event) =>
    bSnapshots.some((other) => Math.abs(other.timestamp - event.timestamp) < 3000)
  ).length;
  return matches / Math.min(aSnapshots.length, bSnapshots.length);
}

export function checkAcademicIntegrity(students: StudentState[]): IntegrityReport {
  const suspectedPairs: IntegrityPair[] = [];
  for (let i = 0; i < students.length; i += 1) {
    for (let j = i + 1; j < students.length; j += 1) {
      const first = students[i];
      const second = students[j];
      const codeSimilarity = jaccard(tokens(first.content), tokens(second.content));
      const timing = timingCorrelation(first.sessionEvents, second.sessionEvents);
      const score = Math.round((codeSimilarity * 0.75 + timing * 0.25) * 100);
      if (score < 72 || Math.max(first.content.length, second.content.length) < 40) continue;
      suspectedPairs.push({
        student1Id: first.studentId,
        student2Id: second.studentId,
        student1Name: first.displayName,
        student2Name: second.displayName,
        similarityScore: score,
        evidence: `Code-token similarity ${Math.round(codeSimilarity * 100)}%; edit timing correlation ${Math.round(timing * 100)}%. Instructor review recommended.`
      });
    }
  }
  return { suspectedPairs, generatedAt: Date.now() };
}
