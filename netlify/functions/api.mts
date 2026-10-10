// Praxis backend: one thin endpoint that the agents call for the model-written
// layer (narratives, drafts, synthesis). Everything else — planning, analysis,
// scoring, retrieval — runs in the browser and needs no server. If the key is
// missing or the free tier is busy, this returns { fallback: true } and the
// agent uses its deterministic text instead.

import type { Config } from "@netlify/functions";
import { generate } from "../lib/gemini.ts";

export const config: Config = { path: "/api/*" };

const json = (b: unknown, status = 200) =>
  new Response(JSON.stringify(b), { status, headers: { "content-type": "application/json" } });

export default async (req: Request): Promise<Response> => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "").replace(/\/$/, "");

  if (path === "health") {
    return json({ ok: true, model: process.env.GEMINI_API_KEY ? "gemini" : "fallback-only" });
  }

  if (path === "generate" && req.method === "POST") {
    let prompt = "";
    try {
      prompt = ((await req.json()) as { prompt?: string }).prompt || "";
    } catch {
      return json({ fallback: true, reason: "bad-request" });
    }
    if (!prompt) return json({ fallback: true, reason: "empty-prompt" });
    try {
      const text = await generate(prompt.slice(0, 8000));
      return json({ text });
    } catch (e) {
      return json({ fallback: true, reason: (e as Error).message });
    }
  }

  return json({ error: "not found" }, 404);
};
