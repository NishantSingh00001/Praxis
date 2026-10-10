import { useState } from "react";
import { useTheme } from "./lib/theme.ts";
import { Data } from "./agents/Data.tsx";
import { Career } from "./agents/Career.tsx";
import { Research } from "./agents/Research.tsx";

type View = "home" | "data" | "career" | "research";

const AGENTS = [
  { id: "career" as const, name: "Career agent", tagline: "Tailor a resume to a job, score the match, close the gaps.", pattern: "generate → critique → iterate", glyph: "◉" },
  { id: "data" as const, name: "Data-analysis agent", tagline: "Upload a CSV, ask in plain English, get a chart and a finding.", pattern: "plan → act → observe", glyph: "▦" },
  { id: "research" as const, name: "Research agent", tagline: "Retrieve across your sources and answer with citations.", pattern: "retrieve → synthesize → cite", glyph: "❖" },
];

export function App() {
  const [theme, toggle] = useTheme();
  const [view, setView] = useState<View>("home");
  const active = AGENTS.find((a) => a.id === view);

  return (
    <div className="shell">
      <header className="top">
        <button className="brand" onClick={() => setView("home")}>
          <span className="brand-mark">⬡</span> Praxis
        </button>
        <nav className="top-nav">
          {AGENTS.map((a) => (
            <button key={a.id} className={`top-link ${view === a.id ? "on" : ""}`} onClick={() => setView(a.id)}>
              {a.name.replace(" agent", "")}
            </button>
          ))}
          <button className="theme-toggle" onClick={toggle} aria-label="Toggle theme" title="Toggle light / dark">
            {theme === "dark" ? "☀" : "☾"}
          </button>
        </nav>
      </header>

      <main className="main">
        {view === "home" ? (
          <div className="home">
            <div className="home-hero">
              <span className="eyebrow">A workbench of AI agents</span>
              <h1>Agents that show<br />their work.</h1>
              <p className="lead">
                Three agents, each a different kind of thinking — they plan, call tools, and lay out
                every step as they go. Built on Gemini, with real logic underneath so they keep
                working even when the model is offline.
              </p>
            </div>
            <div className="agent-cards">
              {AGENTS.map((a) => (
                <button key={a.id} className="agent-card card" onClick={() => setView(a.id)}>
                  <span className="ac-glyph">{a.glyph}</span>
                  <h3>{a.name}</h3>
                  <p className="muted">{a.tagline}</p>
                  <span className="ac-pattern mono">{a.pattern}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="agent-page">
            <div className="agent-head">
              <button className="back" onClick={() => setView("home")}>← All agents</button>
              <h2>{active!.name}</h2>
              <p className="muted">{active!.tagline} <span className="mono faint">· {active!.pattern}</span></p>
            </div>
            {view === "data" && <Data />}
            {view === "career" && <Career />}
            {view === "research" && <Research />}
          </div>
        )}
      </main>

      <footer className="foot">
        Praxis · three AI agents · by Nishant Singh
      </footer>
    </div>
  );
}
