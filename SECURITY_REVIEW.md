# Security review — 20-point pen-test checklist (2026-11-19)

Praxis is a React/Vite frontend (three client-side "agents": data analysis,
career/ATS, research/RAG) with a single thin Netlify Function
(`netlify/functions/api.mts`) that proxies Gemini for the written-narrative
layer only. No accounts, no database, no stored user data — the browser
does all the real computation. Reviewed `netlify/functions/api.mts`,
`netlify/lib/gemini.ts`, and `shared/*.ts` in full.

| # | Check | Status | Notes |
|---|-------|--------|-------|
| 1 | HTTP/2 Rapid Reset | N/A | Netlify Functions runtime; no self-managed HTTP server. |
| 2 | bcrypt 72-byte limit | N/A | No passwords/accounts. |
| 3 | SAML signature bypass | N/A | No SAML. |
| 4 | nOAuth | N/A | No OAuth. |
| 5 | GraphQL alias batching | N/A | No GraphQL. |
| 6 | TOTP replay | N/A | No TOTP/2FA. |
| 7 | ReDoS | No | All regexes in `shared/analysis.ts`, `shared/career.ts` and `shared/retrieval.ts` are simple fixed character-class/word-boundary patterns (e.g. `/^-?[\d,$%.]+$/`, `/[a-z][a-z0-9+#]+/g`, `/top\s+(\d+)/`) with no nested quantifiers — no catastrophic-backtracking shape, and they run client-side on user-pasted CSV/resume/source text, not on an attacker-reachable server path. |
| 8 | JWT algorithm confusion | N/A | No JWTs. |
| 9 | HTTP request smuggling | N/A | Netlify's edge terminates HTTP. |
| 10 | Web cache poisoning | N/A | `/api/generate` and `/api/health` return plain JSON with no cache headers set either way, and nothing served is per-user or sensitive. |
| 11 | Spoofed X-Forwarded-For | N/A | No code in this repo reads `X-Forwarded-For` or any IP at all — there is no IP-based logic anywhere. |
| 12 | Postgres views bypassing RLS | N/A | No database. |
| 13 | `Math.random()` for security tokens | N/A | No tokens/ids generated anywhere — no auth, no ownership model. |
| 14 | Timing attacks on secret comparison | N/A | No secret comparison anywhere. |
| 15 | Padding oracle | N/A | No encryption. |
| 16 | Server-side prototype pollution | No | `/api/generate` reads exactly one field (`prompt`) out of the parsed body and passes it as a plain string to Gemini — no object merging of untrusted input. |
| 17 | Server-side template injection | N/A | No server-side templating; React (JSX-escaped) on the frontend, plain JSON from the backend. |
| 18 | XXE | N/A | No XML parsing. |
| 19 | Cross-site WebSocket hijacking | N/A | No WebSocket endpoint. |
| 20 | Unicode username normalization | N/A | No usernames/login. |

## Finding outside the 20-point list: uncapped AI endpoint

`/api/generate` (`netlify/functions/api.mts`) has **no rate limiting at
all** — any caller can POST a prompt and trigger a Gemini call, repeatedly,
with nothing keyed per-IP or per-visitor to cap it (contrast with
`ilaaj-saathi`, `quickresume`, `salarium`, `glyph`, etc. in this same
portfolio, which all rate-limit their AI-calling routes). The prompt is
truncated to 8000 characters before being sent, which bounds the size of
each individual call, but not how many calls a single visitor can make.
Since `GEMINI_API_KEY` is described as a free-tier key, the practical
impact today is mostly "free tier gets exhausted/rate-limited by Google
(the code already handles a 429 from Gemini gracefully)" rather than a
billing risk — but if a paid key is ever used here, this becomes an
uncapped-cost endpoint. Suggested fix (not applied — pending your
approval): add the same kind of per-IP/per-window `rateLimit()` used
elsewhere in your portfolio (e.g. Tideline's `clientKey()`+`rateLimit()`
pattern) before calling `generate()`.

## Summary

All 20 checklist items are not applicable (no auth, no database, no
secrets to compare, no templating, no IP-based logic). One finding outside
the 20-point list: `/api/generate` has no rate limiting, unlike the
equivalent AI-calling routes in the rest of your portfolio. No fix has
been applied — per your standing instructions, this is reported for
approval before any change is made.
