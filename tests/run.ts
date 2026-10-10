import { check, eq, report, section } from "./assert.ts";
import { parseCSV, plan, run, describe } from "../shared/analysis.ts";

const CSV = `region,quarter,new_accounts,revenue
APAC,Q2,120,50000
APAC,Q3,250,90000
LATAM,Q2,80,30000
LATAM,Q3,110,42000
EMEA,Q2,60,25000
EMEA,Q3,70,30000
NA,Q2,200,120000
NA,Q3,210,125000`;

section("CSV parsing + type inference");
const ds = parseCSV(CSV);
{
  eq("8 rows parsed", ds.rows.length, 8);
  eq("region is a string column", ds.columns.find((c) => c.name === "region")!.type, "string");
  eq("revenue is numeric", ds.columns.find((c) => c.name === "revenue")!.type, "number");
  eq("numeric value is a number", ds.rows[1].revenue, 90000);
}

section("Rule-based planning");
{
  const p1 = plan("total revenue by region", ds);
  eq("maps to groupAggregate", p1.op, "groupAggregate");
  eq("groups by region", p1.group, "region");
  eq("values revenue", p1.value, "revenue");
  eq("sum aggregation", p1.agg, "sum");

  const p2 = plan("top 2 regions by revenue", ds);
  eq("top-N recognised", p2.op, "topN");
  eq("n parsed", p2.n, 2);

  const p3 = plan("average new_accounts by region", ds);
  eq("avg aggregation", p3.agg, "avg");

  const p4 = plan("give me a summary", ds);
  eq("summary recognised", p4.op, "summary");
}

section("Running the plan");
{
  const r = run(plan("total revenue by region", ds), ds);
  eq("bar chart", r.kind, "bar");
  eq("NA leads on revenue", r.labels[0], "NA");
  eq("NA total correct", r.values[0], 245000);
  check("sorted descending", r.values[0] >= r.values[1]);

  const top = run(plan("top 2 regions by revenue", ds), ds);
  eq("top-2 returns two groups", top.labels.length, 2);

  const sum = run(plan("summary", ds), ds);
  eq("summary is a table", sum.kind, "table");
  const rev = sum.table!.find((t) => t.col === "revenue")!;
  eq("revenue count", rev.stats.count, 8);
  eq("revenue max", rev.stats.max, 125000);
}

section("Trend over a real date column");
{
  const dated = parseCSV(`month,revenue
2026-01-01,100
2026-02-01,140
2026-03-01,180`);
  eq("month inferred as date", dated.columns[0].type, "date");
  const p = plan("revenue trend over time", dated);
  eq("trend recognised", p.op, "trend");
  const r = run(p, dated);
  eq("line chart", r.kind, "line");
  eq("chronological order", r.labels[0], "2026-01-01");
}

section("Deterministic narrative (offline fallback)");
{
  const r = run(plan("total revenue by region", ds), ds);
  const text = describe(plan("total revenue by region", ds), r);
  check("mentions the leader", text.includes("NA"), text);
}

section("Career: keyword extraction + ATS-style scoring");
{
  const { extractKeywords, scoreMatch } = await import("../shared/career.ts");
  const jd = "Looking for a backend engineer with strong Java, Spring Boot, REST APIs, Kafka and Docker experience. Kubernetes a plus.";
  const keys = extractKeywords(jd, 10);
  check("pulls java as a keyword", keys.includes("java"), keys);
  check("pulls kafka", keys.includes("kafka"));
  check("drops stopwords", !keys.includes("with") && !keys.includes("experience"));

  const strong = scoreMatch(jd, "Backend engineer. Built REST APIs in Java with Spring Boot, Kafka streaming, Docker and Kubernetes.");
  const weak = scoreMatch(jd, "Frontend developer skilled in React, CSS and design systems.");
  check("a matching resume scores high", strong.score >= 65, strong.score);
  check("an off-target resume scores low", weak.score < 40, weak.score);
  check("missing keywords are reported", weak.missing.includes("java"));
}

section("Research: chunking + TF-IDF retrieval");
{
  const { chunk, retrieve } = await import("../shared/retrieval.ts");
  const sources = `Zero trust assumes no implicit trust and verifies every request.

Kafka partitions let many consumers share a topic's load.

A circuit breaker stops calls to a failing service after repeated errors.`;
  const passages = chunk(sources);
  eq("three passages", passages.length, 3);
  const hits = retrieve("how does a circuit breaker work", passages, 2);
  check("retrieves the circuit-breaker passage first", hits[0].text.includes("circuit breaker"), hits[0]);
  check("scores are ranked", hits.length < 2 || hits[0].score >= hits[1].score);
}

section("Backend endpoint (degrades gracefully without a key)");
{
  const handler = (await import("../netlify/functions/api.mts")).default;
  const call = async (p: string, body?: unknown) => {
    const res = await handler(
      new Request(`https://praxis.test/api/${p}`, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    );
    return { status: res.status, body: await res.json() };
  };
  const health = await call("health");
  eq("health ok", health.body.ok, true);
  const gen = await call("generate", { prompt: "hello" });
  check("falls back to offline when no key is set", gen.body.fallback === true, gen.body);
  eq("unknown route 404s", (await call("nope")).status, 404);
}

report();
