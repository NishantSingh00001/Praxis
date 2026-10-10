import { useState } from "react";
import { parseCSV, plan, run, describe, type Result, type Dataset } from "../../shared/analysis.ts";
import { runSteps, type StepView } from "../lib/runner.ts";
import { narrate } from "../lib/ai.ts";
import { StepTrace } from "../components/StepTrace.tsx";
import { Chart } from "../components/Chart.tsx";

const SAMPLE = `region,quarter,new_accounts,revenue
APAC,Q2,120,52000
APAC,Q3,250,91000
LATAM,Q2,80,30000
LATAM,Q3,110,42000
EMEA,Q2,60,25000
EMEA,Q3,70,31000
NA,Q2,200,120000
NA,Q3,210,126000`;

export function Data() {
  const [csv, setCsv] = useState(SAMPLE);
  const [q, setQ] = useState("Top 3 regions by revenue");
  const [steps, setSteps] = useState<StepView[]>([]);
  const [result, setResult] = useState<Result | null>(null);
  const [narrative, setNarrative] = useState<{ text: string; viaModel: boolean } | null>(null);
  const [running, setRunning] = useState(false);

  async function go() {
    setRunning(true);
    setResult(null);
    setNarrative(null);
    const ctx: { ds?: Dataset; res?: Result } = {};
    await runSteps(
      [
        {
          title: "Read the dataset",
          tool: "parse_csv",
          fn: () => {
            ctx.ds = parseCSV(csv);
            const t = ctx.ds.columns.map((c) => `${c.name}:${c.type}`).join(", ");
            return `${ctx.ds.rows.length} rows · ${ctx.ds.columns.length} columns (${t}).`;
          },
        },
        {
          title: "Plan the analysis",
          tool: "reason",
          fn: () => {
            const p = plan(q, ctx.ds!);
            (ctx as any).plan = p;
            return p.rationale;
          },
        },
        {
          title: "Run the computation",
          tool: "compute",
          fn: () => {
            ctx.res = run((ctx as any).plan, ctx.ds!);
            setResult(ctx.res);
            return `Computed “${ctx.res.title}” over ${ctx.ds!.rows.length} rows.`;
          },
        },
        {
          title: "Write the finding",
          tool: "gemini",
          fn: async () => {
            const fallback = describe((ctx as any).plan, ctx.res!);
            const prompt = `You are a data analyst. In two sentences, explain this result to a business reader. Question: "${q}". Result title: ${ctx.res!.title}. Labels: ${ctx.res!.labels.join(", ")}. Values: ${ctx.res!.values.join(", ")}.`;
            const n = await narrate(prompt, fallback);
            setNarrative(n);
            return n.viaModel ? "Drafted with Gemini." : "Drafted from the computed result (offline).";
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
        <label className="field-label">Your data (CSV)</label>
        <textarea rows={7} value={csv} onChange={(e) => setCsv(e.target.value)} className="mono" style={{ fontSize: 13 }} />
        <label className="field-label" style={{ marginTop: 12 }}>Ask a question</label>
        <div className="row" style={{ gap: 10 }}>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="e.g. average revenue by region" />
          <button className="btn primary" onClick={go} disabled={running}>{running ? "Working…" : "Analyze"}</button>
        </div>
        <div className="faint tiny" style={{ marginTop: 8 }}>Try: “total revenue by region”, “top 3 regions by revenue”, “summary”.</div>
      </div>

      {(steps.length > 0 || result) && (
        <div className="agent-output">
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Agent trace</div>
            <StepTrace steps={steps} />
          </div>
          {result && (
            <div className="card">
              <div className="row spread" style={{ marginBottom: 10 }}>
                <strong>{result.title}</strong>
                {narrative && <span className="tool-chip mono">{narrative.viaModel ? "gemini" : "offline"}</span>}
              </div>
              <Chart r={result} />
              {narrative && <p style={{ marginTop: 14 }}>{narrative.text}</p>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
