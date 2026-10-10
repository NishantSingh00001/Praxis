// Calls the backend for model-written text, and quietly falls back to the
// deterministic version if there's no key, the free tier is busy, or anything
// else goes wrong. The agents never block on the model.

export async function narrate(prompt: string, fallback: string): Promise<{ text: string; viaModel: boolean }> {
  try {
    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt }),
    });
    const data = await res.json();
    if (data?.text) return { text: data.text, viaModel: true };
  } catch {
    /* fall through */
  }
  return { text: fallback, viaModel: false };
}
