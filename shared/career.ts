// The career agent's deterministic core: pull the skills a job description asks
// for, and score a resume against them — a simple, explainable stand-in for the
// keyword matching an applicant-tracking system does. No model needed.

const STOP = new Set(
  ("a an the and or but of to in for on with at by from as is are be we you your our " +
    "will should must have has they their this that these those it its can able strong " +
    "experience work working team teams role looking candidate ideal plus etc using use " +
    "across including include includes within into over per who what when where how " +
    "someone something building looking familiarity comfortable graduate deployed " +
    "good great help want need join new").split(/\s+/),
);

function tokens(text: string): string[] {
  // keep internal + and # (c++, c#) but no trailing punctuation
  return (text.toLowerCase().match(/[a-z][a-z0-9+#]+/g) || []).filter((t) => t.length > 2 && !STOP.has(t));
}

export function extractKeywords(text: string, n = 18): string[] {
  const freq = new Map<string, number>();
  for (const t of tokens(text)) freq.set(t, (freq.get(t) || 0) + 1);
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, n).map((e) => e[0]);
}

export interface Match {
  score: number;
  matched: string[];
  missing: string[];
}

export function scoreMatch(jd: string, resume: string): Match {
  const keys = extractKeywords(jd, 18);
  const have = new Set(tokens(resume));
  const matched = keys.filter((k) => have.has(k));
  const missing = keys.filter((k) => !have.has(k));
  const score = keys.length ? Math.round((matched.length / keys.length) * 100) : 0;
  return { score, matched, missing };
}
