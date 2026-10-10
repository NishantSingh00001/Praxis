import { useState } from "react";
import { chunk, retrieve, type Hit, type Passage } from "../../shared/retrieval.ts";
import { runSteps, type StepView } from "../lib/runner.ts";
import { narrate } from "../lib/ai.ts";
import { StepTrace } from "../components/StepTrace.tsx";

const SOURCES = `Zero trust assumes no implicit trust. Every request is authenticated, authorized and inspected, no matter where it comes from. The perimeter is gone — identity and device posture decide access.

A consistent-hash ring spreads keys across nodes using virtual nodes. When a node joins or leaves, only about 1/N of keys move, instead of reshuffling everything — which is why it suits distributed caches and databases.

A circuit breaker stops calling a failing dependency. After repeated failures it trips "open" and fails fast; after a cooldown it goes "half-open" and lets one request through to test recovery, closing again on success.

Event-time stream processing uses watermarks to decide when a time window is complete. Late events arriving after the watermark can be dropped or sent to a side output.`;

export function Research() {
  const [sources, setSources] = useState(SOURCES);
  const [q, setQ] = useState("How does a circuit breaker recover after it trips?");
  const [steps, setSteps] = useState<StepView[]>([]);
  const [hits, setHits] = useState<Hit[]>([]);
  const [answer, setAnswer] = useState<{ text: string; viaModel: boolean } | null>(null);
  const [running, setRunning] = useState(false);

  async function go() {
    setRunning(true);
    setHits([]);
    setAnswer(null);
    const ctx: { passages?: Passage[]; hits?: Hit[] } = {};
    await runSteps(
      [
        {
          title: "Index the sources",
          tool: "chunk",
          fn: () => {
            ctx.passages = chunk(sources);
            return `Split into ${ctx.passages.length} passages.`;
          },
        },
        {
          title: "Retrieve the most relevant passages",
          tool: "tf-idf",
          fn: () => {
            ctx.hits = retrieve(q, ctx.passages!, 2);
            setHits(ctx.hits);
            if (!ctx.hits.length) throw new Error("No passage matched the question.");
            return `Top match: passage [${ctx.hits[0].id}] (score ${ctx.hits[0].score}).`;
          },
        },
        {
          title: "Synthesise a cited answer",
          tool: "gemini",
          fn: async () => {
            const ctxText = ctx.hits!.map((h) => `[${h.id}] ${h.text}`).join("\n\n");
            const fallback =
              ctx.hits!.map((h) => h.text).join(" ") + ` [${ctx.hits!.map((h) => h.id).join("][")}]`;
            const prompt = `Answer the question using ONLY the sources, and cite them inline like [1]. If the sources don't answer it, say so.\n\nSources:\n${ctxText}\n\nQuestion: ${q}\n\nAnswer in 2-3 sentences with citations.`;
            const a = await narrate(prompt, fallback);
            setAnswer(a);
            return a.viaModel ? "Synthesised with Gemini." : "Extracted from the retrieved passages (offline).";
          },
        },
      ],
      setSteps,
    );
    setRunning(false);
  }

  return (
    <div className="agent">
      <div className="agent-input card">
        <label className="field-label">Sources (blank line between passages)</label>
        <textarea rows={8} value={sources} onChange={(e) => setSources(e.target.value)} style={{ fontSize: 14 }} />
        <label className="field-label" style={{ marginTop: 12 }}>Ask about the sources</label>
        <div className="row" style={{ gap: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} />
          <button className="btn primary" onClick={go} disabled={running}>{running ? "Working…" : "Research"}</button>
        </div>
      </div>

      {(steps.length > 0 || answer) && (
        <div className="agent-output">
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Agent trace</div>
            <StepTrace steps={steps} />
          </div>
          {answer && (
            <div className="card">
              <div className="row spread" style={{ marginBottom: 8 }}>
                <strong>Answer</strong>
                <span className="tool-chip mono">{answer.viaModel ? "gemini" : "offline"}</span>
              </div>
              <p style={{ marginTop: 0 }}>{answer.text}</p>
              <div className="eyebrow" style={{ margin: "14px 0 8px" }}>Citations</div>
              {hits.map((h) => (
                <div key={h.id} className="citation">
                  <span className="cite-id mono">[{h.id}]</span>
                  <span className="muted tiny">{h.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
