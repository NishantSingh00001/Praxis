// The research agent's retrieval core: split sources into passages and rank them
// against a query with TF-IDF cosine similarity — the same idea behind the
// retrieval step of a RAG pipeline, implemented from scratch so it runs with no
// embeddings service. The model only synthesises the final answer on top.

export interface Passage {
  id: number;
  text: string;
}
export interface Hit extends Passage {
  score: number;
}

const tokenize = (s: string): string[] => (s.toLowerCase().match(/[a-z0-9]{2,}/g) || []);

export function chunk(sources: string): Passage[] {
  return sources
    .split(/\n\s*\n/)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
    .map((text, id) => ({ id: id + 1, text }));
}

function tf(tokensArr: string[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const t of tokensArr) m.set(t, (m.get(t) || 0) + 1);
  for (const [k, v] of m) m.set(k, v / tokensArr.length);
  return m;
}

export function retrieve(query: string, passages: Passage[], k = 3): Hit[] {
  const docs = passages.map((p) => tokenize(p.text));
  const N = docs.length || 1;
  const df = new Map<string, number>();
  for (const d of docs) for (const t of new Set(d)) df.set(t, (df.get(t) || 0) + 1);
  const idf = (t: string) => Math.log((N + 1) / ((df.get(t) || 0) + 1)) + 1;

  const qv = tf(tokenize(query));
  const score = (dv: Map<string, number>): number => {
    let dot = 0;
    let qn = 0;
    let dn = 0;
    for (const [t, w] of qv) {
      const wi = w * idf(t);
      qn += wi * wi;
      const dvw = (dv.get(t) || 0) * idf(t);
      dot += wi * dvw;
    }
    for (const [t, w] of dv) {
      const wi = w * idf(t);
      dn += wi * wi;
    }
    return qn && dn ? dot / Math.sqrt(qn * dn) : 0;
  };

  return passages
    .map((p, i) => ({ ...p, score: Math.round(score(tf(docs[i])) * 1000) / 1000 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, k)
    .filter((h) => h.score > 0);
}
