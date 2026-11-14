# DESIGN

**Thesis.** The sample prompts are about time and continuity, not search: "Monday", "3 November", "still correct today". A generic ReAct loop leaves that to the model, which does calendar arithmetic badly, remembers nothing, and cannot tell "no change found" from "no change". So I moved time and memory into code and kept the model loop small.

## How it works

The code is split by role: `time.ts` resolves dates, `retrieve.ts` and `context.ts` build history, `search.ts` owns retrieval, `page.ts` handles safe reads, `excerpt.ts` cleans evidence, `rank.ts` labels sources, `verdicts.ts` validates re-checks, and `agent.ts` runs the model loop.

1. **Dates are code-owned.** `chrono-node` runs against the user's wall clock and timezone; the model receives absolute dates such as `Monday → 2026-11-09`. Ambiguous phrases like "last Tuesday" keep both readings; retrieval tries both and the model says which it used.
2. **Memory is injected, not a tool.** Every turn is stored with a UTC timestamp. Retrieval is a BM25-style score over the user text, answer, and claims, with a date boost and a two-term guard. This works because the history is small and date-addressed.
3. **Claims are the unit of continuity.** After an answer, a cheap model extracts `{entity, claim, as_of, check_query}` off the hot path. "Is it still correct?" becomes: for each claim, search since `as_of`, then compare.
4. **Re-verification starts early.** For "still/changed/since", code starts claim searches in parallel before the first model call, deduping and capping the fan-out.
5. **`since` searches two ways.** One query finds dated results after `as_of`; a second finds the current undated page. Pricing pages are usually undated, so a date filter alone would hide the value the user needs. Known vendor domains restrict the current query.
6. **Evidence is read, not just listed.** Search uses advanced Tavily depth, canonical dedupe, clean excerpts, and at most one top primary-looking page per claim. Page reads are SSRF-checked, redirect-revalidated, content-type filtered, and capped at 512 KB and 6 seconds. Sources are labeled primary or secondary before the model sees them.
7. **Honest negatives are structural.** The model emits a machine-readable verdict block. Code parses it, strips it from the saved answer, validates citations, and renders changed / unchanged / couldn't verify chips. A confident verdict backed only by a secondary source is downgraded. The prompt requires "no change found in the sources I checked since DATE", never "nothing changed".
8. **The boundary is code.** Model output cannot persist control tags, unregistered citations, or unsafe URLs. If the user refers to something not in history, code injects `NO_MATCHING_HISTORY` and the model asks one short question.

## Why I built it this way

The reliable parts are deterministic, so I made them deterministic: calendar arithmetic, history lookup, source ranking, citation validation, and verdict parsing do not need a model. The model is best at understanding the question, choosing searches, and writing the answer. A hard four-step loop, with the last step tool-free, means it always ends with prose.

## What I considered and rejected

- **Planner/critic or multi-agent loops:** more latency and failure modes for little gain.
- **A vector database for history:** infrastructure and recall problems for no real benefit on a small, date-addressed history.
- **Letting the model resolve dates or manage memory as a tool:** unreliable, and a second tool violates the brief.
- **LangChain or a framework agent:** opaque control flow. The raw SDK loop is smaller and easier to defend.
- **SQLite:** native builds can break `npm install`; an atomic JSON file cannot.
- **A browser rendering stack:** it adds a service, latency, and a larger failure surface. Page excerpts plus primary-source ranking were the better trade.

## What I'd do with another week

I would build a 30-case eval set around the three prompts, with per-claim diff scoring and citation-faithfulness checks. Then I would add embeddings as a fallback behind the date index, a learned reranker or entailment check, and scheduled re-verification for high-value claims. I would also add per-user timezone profiles and a real multi-user store.

Known limits: retrieval is lexical; search is single-provider; primary/secondary detection is heuristic; and advanced search plus page reads can push TTFT well above the basic setting. `SEARCH_DEPTH=basic` and `READ_PAGES=false` are the rollback knobs.
