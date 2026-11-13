# Minimi

A time-aware chat assistant with exactly one tool: **web search**.

Its three sample questions are not search questions. They are questions about time and
continuity: *"What did I ask you on 3 November? Is your answer still correct today?"*,
*"Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"*,
*"On Monday we shortlisted 5 CRM tools. Has any of them changed pricing or shipped
something big since?"*

Most agents leave those to the model. Minimi moves time and memory into ordinary code and
keeps the model loop small:

- **Dates are resolved in code.** `chrono-node` runs against the user's wall clock and
  timezone. The model receives absolute dates and never does calendar arithmetic.
- **Memory is data.** Every turn is stored with a UTC timestamp and retrieval is
  deterministic: a small BM25-style score over the user text, answer, and claims, with a
  strong boost for a resolved date. Answers produce structured claims that can be re-checked.
- **Re-verification starts early.** For "has anything changed since?" the claim searches
  run in parallel before the first model token; duplicate check queries are collapsed.
- **Honest negatives are structural.** The model emits machine-readable verdicts; code
  strips the control block, validates citations, persists the result, and the UI shows
  *changed / unchanged / couldn't verify* chips. No "nothing changed" without saying what
  was checked.
- **Evidence is read, not just listed.** Search uses Tavily advanced depth, canonical URL
  dedupe, clean page excerpts, and a capped top-page read for each claim. Sources are
  labeled primary/secondary; current-value checks target the vendor's domain when known.
  A confident verdict backed only by a secondary source is downgraded to "couldn't verify".

Read [`DESIGN.md`](DESIGN.md) for the architecture and the tradeoffs.

## Quickstart

Requires Node 20+.

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY and TAVILY_API_KEY
npm run dev              # http://localhost:3000
```

Then use **Load demo history** in the empty chat rail (or in Settings → Data) to try the
sample questions immediately. `npm run seed` is the CLI equivalent and **resets** the
local store.

## API keys

| Key | Required | Used for |
| --- | --- | --- |
| `GEMINI_API_KEY` (or `LLM_API_KEY`) | yes | answers, tool calls, claim extraction |
| `TAVILY_API_KEY` | yes | `web_search` |

Everything else in [`.env.example`](.env.example) is optional. Models run through the
OpenAI-compatible API; point `LLM_BASE_URL`, `MODEL_MAIN`, and `MODEL_FAST` at another
provider if you prefer.

## Search quality

Defaults: advanced Tavily depth, 8 results per query, one top-page read per claim
(600-character excerpt, 512 KB / 6 s caps), 15-minute cache. Claim searches target a
known vendor domain for the current-value half of a `since` check.

Tune with `SEARCH_DEPTH`, `SEARCH_RESULTS`, `READ_PAGES`, `READ_PAGES_PER_QUERY`,
`READ_CHARS`, `SEARCH_TIMEOUT_MS`, `FETCH_TIMEOUT_MS`, and `MAX_PAGE_BYTES` in
[`.env.example`](.env.example). Set `SEARCH_DEPTH=basic` and `READ_PAGES=false` to trade
evidence quality for latency.

It is deliberately one provider plus page excerpts, not a multi-provider deep-research
stack: no browser JS rendering, no learned reranker, and the vendor-domain hints are a
small heuristic.

## Commands

```bash
npm run dev        # watch server on :3000
npm start          # one-shot server
npm run seed       # reset the store with relative demo history
npm run eval       # deterministic checks, plus live end-to-end + judge when keys exist
npm run typecheck  # tsc --noEmit
npm test           # API + retrieval/date/search/prompt tests (offline)
npm run test:e2e   # Playwright UI tests (offline; install browsers once)
npm run check      # typecheck + client syntax + offline tests
```

The first Playwright run needs `npx playwright install chromium`.

## Try these

- "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them
  changed pricing or shipped something big since?"
- "What did I ask you on 3 November? Is your answer still correct today?"
- "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?"

Seeded dates are computed relative to today. Set `NOW_OVERRIDE` before seeding and
starting the server to fake the clock.

## Layout

```
src/time.ts          deterministic date resolution (chrono, timezone-safe)
src/retrieve.ts      BM25-style date + topic + claim retrieval over past turns
src/context.ts       what the model gets: dates, history, claims, prefetch plan
src/search.ts        Tavily wrapper: advanced search, since fan-out, page reads, cache
src/page.ts          SSRF-safe page fetch: redirects, size/time caps, cache, concurrency
src/excerpt.ts       HTML/markdown cleanup, query-aware excerpts, canonical URLs
src/rank.ts          primary/secondary source ranking and labels
src/verdicts.ts      parse and guard changed / unchanged / unverified verdicts
src/source-check.ts  public-URL validation shared by checks and page reads
src/agent.ts         one streaming loop, parallel tools, step cap, verdicts, persist
src/claims.ts        async claim extraction
src/prompt.ts        static (cached) + dynamic system prompt, sanitize/citation guards
src/app.ts           Hono routes, limits, error handling
src/server.ts        process entry point
src/store.ts         atomic JSON store
public/              static chat UI
tests/               API, core, and Playwright tests
eval/                deterministic and live evaluation
scripts/seed.ts      demo history CLI
```

## Data

Conversations live in `data/store.json` (git-ignored). Delete that file, or use
Settings → Data → Clear all chats, to start fresh.
