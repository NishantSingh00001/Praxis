import type { StepView } from "../lib/runner.ts";

export function StepTrace({ steps }: { steps: StepView[] }) {
  if (!steps.length) return null;
  return (
    <div className="trace">
      {steps.map((s, i) => (
        <div key={i} className={`tstep ${s.state}`}>
          <div className="trail">
            <span className="tnode" />
          </div>
          <div className="tbody">
            <div className="row spread" style={{ gap: 10 }}>
              <strong className="tstep-title">{s.title}</strong>
              {s.tool && <span className="tool-chip mono">{s.tool}</span>}
            </div>
            {s.detail && <div className="muted tiny tstep-detail">{s.detail}</div>}
            {s.state === "running" && <div className="muted tiny">working…</div>}
          </div>
        </div>
      ))}
    </div>
  );
}
