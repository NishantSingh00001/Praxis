// The data-analysis agent's engine. CSV parsing, column type inference, a small
// set of analysis operations, and a rule-based planner that turns a plain-English
// question into one of those operations. This all runs deterministically with no
// model call — the LLM only writes the narrative on top. That keeps the agent
// useful even on the free API tier or offline.

export type ColType = "number" | "date" | "string";
export interface Column {
  name: string;
  type: ColType;
}
export interface Dataset {
  columns: Column[];
  rows: Record<string, string | number>[];
}

export function parseCSV(text: string): Dataset {
  const lines = text.trim().split(/\r?\n/).filter((l) => l.length);
  if (!lines.length) return { columns: [], rows: [] };
  const headers = splitLine(lines[0]);
  const raw = lines.slice(1).map(splitLine);
  const types: ColType[] = headers.map((_, c) => inferType(raw.map((r) => r[c] ?? "")));
  const rows = raw.map((r) => {
    const obj: Record<string, string | number> = {};
    headers.forEach((h, c) => {
      const v = r[c] ?? "";
      obj[h] = types[c] === "number" ? Number(v.replace(/[,$%]/g, "")) || 0 : v;
    });
    return obj;
  });
  return { columns: headers.map((name, c) => ({ name, type: types[c] })), rows };
}

function splitLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let q = false;
  for (const ch of line) {
    if (ch === '"') q = !q;
    else if (ch === "," && !q) {
      out.push(cur.trim());
      cur = "";
    } else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

function inferType(vals: string[]): ColType {
  const nonEmpty = vals.filter((v) => v !== "");
  if (!nonEmpty.length) return "string";
  const numeric = nonEmpty.filter((v) => /^-?[\d,$%.]+$/.test(v) && !isNaN(Number(v.replace(/[,$%]/g, ""))));
  if (numeric.length / nonEmpty.length > 0.8) return "number";
  const dates = nonEmpty.filter((v) => !isNaN(Date.parse(v)) && /[-/]/.test(v));
  if (dates.length / nonEmpty.length > 0.8) return "date";
  return "string";
}

export type Agg = "sum" | "avg" | "count" | "max" | "min";
export interface Plan {
  op: "groupAggregate" | "topN" | "summary" | "trend";
  group?: string;
  value?: string;
  agg?: Agg;
  n?: number;
  date?: string;
  rationale: string;
}

export interface Result {
  kind: "bar" | "line" | "table";
  title: string;
  labels: string[];
  values: number[];
  unit?: string;
  table?: { col: string; stats: Record<string, number> }[];
}

const AGG_WORDS: [RegExp, Agg][] = [
  [/\b(avg|average|mean)\b/i, "avg"],
  [/\b(sum|total)\b/i, "sum"],
  [/\b(count|number of|how many)\b/i, "count"],
  [/\b(max|highest|largest|most)\b/i, "max"],
  [/\b(min|lowest|smallest|least)\b/i, "min"],
];

export function plan(question: string, ds: Dataset): Plan {
  const q = question.toLowerCase();
  const nums = ds.columns.filter((c) => c.type === "number");
  const cats = ds.columns.filter((c) => c.type === "string");
  const dates = ds.columns.filter((c) => c.type === "date");
  const mentioned = (c: Column) => q.includes(c.name.toLowerCase());

  if (/\b(summary|describe|overview|statistics|stats)\b/.test(q) || (!nums.length && !cats.length)) {
    return { op: "summary", rationale: "The question asks for an overview, so compute summary statistics for each numeric column." };
  }

  const agg = AGG_WORDS.find(([re]) => re.test(q))?.[1] ?? "sum";
  const value = nums.find(mentioned)?.name ?? nums[0]?.name;
  const date = dates.find(mentioned)?.name ?? dates[0]?.name;

  if (/\b(trend|over time|by month|by year|timeline|growth)\b/.test(q) && date && value) {
    return { op: "trend", date, value, agg: agg === "count" ? "count" : "sum", rationale: `Plot ${agg} of ${value} over ${date} to show the trend.` };
  }

  const n = Number((q.match(/top\s+(\d+)/) || [])[1]) || (/(top|rank|best|worst)/.test(q) ? 5 : 0);
  const group = cats.find(mentioned)?.name ?? (q.match(/by\s+([a-z ]+)/)?.[1]?.trim() && cats.find((c) => q.includes(c.name.toLowerCase()))?.name) ?? cats[0]?.name;

  if (n && group && value) {
    return { op: "topN", group, value, agg, n, rationale: `Rank ${group} by ${agg} of ${value} and take the top ${n}.` };
  }
  if (group && value) {
    return { op: "groupAggregate", group, value, agg, rationale: `Group by ${group} and compute ${agg} of ${value}.` };
  }
  return { op: "summary", rationale: "Couldn't map the question to a grouping, so fall back to summary statistics." };
}

function aggregate(vals: number[], agg: Agg): number {
  if (!vals.length) return 0;
  switch (agg) {
    case "sum": return vals.reduce((a, b) => a + b, 0);
    case "avg": return vals.reduce((a, b) => a + b, 0) / vals.length;
    case "count": return vals.length;
    case "max": return Math.max(...vals);
    case "min": return Math.min(...vals);
  }
}

export function run(p: Plan, ds: Dataset): Result {
  if (p.op === "summary") {
    const nums = ds.columns.filter((c) => c.type === "number");
    const table = nums.map((c) => {
      const vals = ds.rows.map((r) => Number(r[c.name])).filter((n) => !isNaN(n));
      return {
        col: c.name,
        stats: {
          count: vals.length,
          sum: Math.round(aggregate(vals, "sum")),
          avg: Math.round(aggregate(vals, "avg") * 100) / 100,
          min: aggregate(vals, "min"),
          max: aggregate(vals, "max"),
        },
      };
    });
    return { kind: "table", title: "Summary statistics", labels: [], values: [], table };
  }

  const groups = new Map<string, number[]>();
  const keyCol = p.op === "trend" ? p.date! : p.group!;
  for (const r of ds.rows) {
    const key = String(r[keyCol]);
    const v = p.agg === "count" ? 1 : Number(r[p.value!]) || 0;
    (groups.get(key) ?? groups.set(key, []).get(key)!).push(v);
  }
  let entries = [...groups.entries()].map(([k, vs]) => [k, aggregate(vs, p.agg!)] as [string, number]);

  if (p.op === "trend") entries.sort((a, b) => Date.parse(a[0]) - Date.parse(b[0]));
  else entries.sort((a, b) => b[1] - a[1]);
  if (p.op === "topN") entries = entries.slice(0, p.n);

  return {
    kind: p.op === "trend" ? "line" : "bar",
    title: `${p.agg} of ${p.value ?? "rows"} by ${keyCol}`.replace(/^avg/, "average"),
    labels: entries.map((e) => e[0]),
    values: entries.map((e) => Math.round(e[1] * 100) / 100),
  };
}

/** A deterministic narrative, used when no model is available. */
export function describe(_p: Plan, r: Result): string {
  if (r.kind === "table") {
    const top = r.table?.[0];
    return top ? `Across ${top.stats.count} rows, ${top.col} averages ${top.stats.avg} (min ${top.stats.min}, max ${top.stats.max}).` : "No numeric columns to summarise.";
  }
  if (!r.labels.length) return "No data matched the question.";
  const lead = r.labels[0];
  const leadV = r.values[0];
  const total = r.values.reduce((a, b) => a + b, 0);
  const share = total ? Math.round((leadV / total) * 100) : 0;
  return `${lead} leads with ${leadV}${r.kind === "bar" ? ` — about ${share}% of the total across ${r.labels.length} groups` : ""}.`;
}
