import type { Result } from "../../shared/analysis.ts";

export function Chart({ r }: { r: Result }) {
  if (r.kind === "table") {
    return (
      <table className="stat-table">
        <thead>
          <tr>
            <th>Column</th><th>Count</th><th>Sum</th><th>Avg</th><th>Min</th><th>Max</th>
          </tr>
        </thead>
        <tbody>
          {r.table!.map((t) => (
            <tr key={t.col}>
              <td>{t.col}</td>
              <td className="mono">{t.stats.count}</td>
              <td className="mono">{t.stats.sum}</td>
              <td className="mono">{t.stats.avg}</td>
              <td className="mono">{t.stats.min}</td>
              <td className="mono">{t.stats.max}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }
  const max = Math.max(...r.values, 1);
  const W = 560;
  const H = 240;
  const pad = 34;
  const n = r.values.length;

  if (r.kind === "line") {
    const pts = r.values.map((v, i) => {
      const x = pad + (i * (W - pad * 2)) / Math.max(1, n - 1);
      const y = H - pad - (v / max) * (H - pad * 2);
      return [x, y] as [number, number];
    });
    const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
    return (
      <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
        <path d={d} fill="none" stroke="var(--accent-2)" strokeWidth="2.5" />
        {pts.map((p, i) => (
          <g key={i}>
            <circle cx={p[0]} cy={p[1]} r="4" fill="var(--accent-2)" />
            <text x={p[0]} y={H - 10} className="axis" textAnchor="middle">{short(r.labels[i])}</text>
          </g>
        ))}
      </svg>
    );
  }

  // bar
  const bw = (W - pad * 2) / n;
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`}>
      {r.values.map((v, i) => {
        const h = (v / max) * (H - pad * 2);
        const x = pad + i * bw;
        const y = H - pad - h;
        return (
          <g key={i}>
            <rect x={x + bw * 0.12} y={y} width={bw * 0.76} height={h} rx="4" fill="var(--accent)" />
            <text x={x + bw / 2} y={y - 6} className="axis" textAnchor="middle">{fmt(v)}</text>
            <text x={x + bw / 2} y={H - 10} className="axis" textAnchor="middle">{short(r.labels[i])}</text>
          </g>
        );
      })}
    </svg>
  );
}

const short = (s: string) => (s.length > 10 ? s.slice(0, 9) + "…" : s);
const fmt = (v: number) => (v >= 1000 ? `${(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${v}`);
