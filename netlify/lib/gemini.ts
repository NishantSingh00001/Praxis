// A minimal Gemini client. The whole product is built to work without this —
// every agent has a deterministic fallback — so a missing key or a busy free
// tier degrades gracefully instead of breaking. Set GEMINI_API_KEY (free tier,
// no billing) to turn the model layer on.

const MODEL = process.env.GEMINI_MODEL || "gemini-1.5-flash";

export async function generate(prompt: string): Promise<string> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("no-key");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.6, maxOutputTokens: 600 },
    }),
  });
  if (res.status === 429) throw new Error("rate-limited");
  if (!res.ok) throw new Error(`gemini ${res.status}`);
  const data = (await res.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) throw new Error("empty");
  return text;
}
