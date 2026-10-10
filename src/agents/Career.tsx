import { useState } from "react";
import { extractKeywords, scoreMatch, type Match } from "../../shared/career.ts";
import { runSteps, type StepView } from "../lib/runner.ts";
import { narrate } from "../lib/ai.ts";
import { StepTrace } from "../components/StepTrace.tsx";

const JD = `Backend Software Engineer. We're looking for someone strong in Java and Spring Boot, building REST APIs and microservices. Experience with Kafka, Docker, Kubernetes and CI/CD pipelines. Familiarity with SQL databases and cloud (AWS or GCP) is a plus.`;
const RESUME = `Computer Engineering graduate. Built REST APIs with Java and Spring Boot (Scaler). Streaming project on Apache Kafka and Flink. Comfortable with Docker, Git and CI/CD via GitHub Actions. Python for data work. Deployed on Netlify and AWS.`;

export function Career() {
  const [jd, setJd] = useState(JD);
  const [resume, setResume] = useState(RESUME);
  const [steps, setSteps] = useState<StepView[]>([]);
  const [match, setMatch] = useState<Match | null>(null);
  const [bullets, setBullets] = useState<{ text: string; viaModel: boolean } | null>(null);
  const [running, setRunning] = useState(false);

  async function go() {
    setRunning(true);
    setMatch(null);
    setBullets(null);
    const ctx: { keys?: string[]; m?: Match } = {};
    await runSteps(
      [
        {
          title: "Read the job description",
          tool: "extract",
          fn: () => {
            ctx.keys = extractKeywords(jd, 14);
            return `Pulled ${ctx.keys.length} required skills: ${ctx.keys.slice(0, 8).join(", ")}…`;
          },
        },
        {
          title: "Score the resume against it",
          tool: "ats_match",
          fn: () => {
            ctx.m = scoreMatch(jd, resume);
            setMatch(ctx.m);
            return `ATS-style match: ${ctx.m.score}%. ${ctx.m.missing.length} gaps to address.`;
          },
        },
        {
          title: "Tailor the resume bullets",
          tool: "gemini",
          fn: async () => {
            const fallback = ctx.m!.missing.length
              ? ctx.m!.missing.slice(0, 3).map((k) => `• Add a bullet evidencing ${k} — a project, result or metric that proves it.`).join("\n")
              : "• Your resume already covers the key requirements — quantify the impact of each bullet with a metric.";
            const prompt = `You are a resume coach. The job needs: ${ctx.keys!.join(", ")}. The candidate's resume: """${resume}""". Missing keywords: ${ctx.m!.missing.join(", ") || "none"}. Write 3 concise, tailored resume bullet points (start each with •) that close the gaps using the candidate's real background. No preamble.`;
            const b = await narrate(prompt, fallback);
            setBullets(b);
            return b.viaModel ? "Tailored with Gemini." : "Suggested from the gap analysis (offline).";
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
        <div className="two-col">
          <div>
            <label className="field-label">Job description</label>
            <textarea rows={6} value={jd} onChange={(e) => setJd(e.target.value)} />
          </div>
          <div>
            <label className="field-label">Your resume</label>
            <textarea rows={6} value={resume} onChange={(e) => setResume(e.target.value)} />
          </div>
        </div>
        <button className="btn primary" style={{ marginTop: 12 }} onClick={go} disabled={running}>
          {running ? "Working…" : "Tailor my resume"}
        </button>
      </div>

      {(steps.length > 0 || match) && (
        <div className="agent-output">
          <div className="card">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Agent trace</div>
            <StepTrace steps={steps} />
          </div>
          {match && (
            <div className="card">
              <div className="row spread wrap" style={{ marginBottom: 14 }}>
                <div>
                  <div className="eyebrow">ATS match</div>
                  <div className="big-score" style={{ color: match.score >= 70 ? "var(--ok)" : match.score >= 45 ? "var(--warn)" : "var(--err)" }}>
                    {match.score}%
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 220 }}>
                  <div className="tiny muted" style={{ marginBottom: 6 }}>Matched</div>
                  <div className="chips">{match.matched.map((k) => <span key={k} className="kw ok">{k}</span>)}</div>
                  {match.missing.length > 0 && (
                    <>
                      <div className="tiny muted" style={{ margin: "10px 0 6px" }}>Missing</div>
                      <div className="chips">{match.missing.map((k) => <span key={k} className="kw miss">{k}</span>)}</div>
                    </>
                  )}
                </div>
              </div>
              {bullets && (
                <>
                  <div className="row spread" style={{ marginBottom: 6 }}>
                    <strong>Tailored bullets</strong>
                    <span className="tool-chip mono">{bullets.viaModel ? "gemini" : "offline"}</span>
                  </div>
                  <div className="bullets">{bullets.text.split("\n").map((l, i) => <div key={i}>{l}</div>)}</div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
