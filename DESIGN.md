# DESIGN

**Thesis.** The example prompts are not about search. They are about time and continuity ("Monday", "3 November", "still correct today"). A generic ReAct loop leaves both to the LLM, which is where it fails: it does calendar arithmetic badly, remembers nothing, and cannot tell "no change found" from "no change". So I moved time and memory into plain code and kept the model loop small.

## How it works
```
message → buildContext (code, ~ms) → [prefetch searches, parallel] → one streaming loop (≤4 steps) → persist → extract claims (async)
```
1. **Time is resolved in code.** `chrono-node` runs against the user's wall clock and timezone; the model receives `"Monday" → Mon 2026-11-09`. "Last Tuesday" is ambiguous on a Wednesday, so both readings are kept: retrieval tries both and the model must say which it used.
2. **Memory is injected, not a tool** (the brief allows exactly one tool). Every turn is stored with a UTC timestamp. Retrieval is a dependency-free BM25-style score over the user text, answer, and claims: IDF-weighted matches, a claim-text boost, a strong boost for a resolved date, and a tiny recency tie-break. It returns at most 3 turns and requires two matching query terms (one for short queries) to reject accidental overlap.
3. **Claims, not prose.** After each answer a cheap model extracts `{entity, claim, as_of, check_query}` off the hot path. "Is it still correct?" becomes: for each claim, search since `as_of`, then diff. That is more reliable than re-reading paragraphs.
4. **Speculative re-verification.** When the message refers to the past and asks "still/changed/since", code starts the claim searches in parallel *before* the first model call. It expands the top 3 matched turns, dedupes identical `check_query` values, and caps the fan-out at 6. This removes one full model round-trip from the slowest class of question.
5. **`since` fans out into two searches:** dated results after `as_of` (announcements, changelogs) and an undated current-state query. Pricing pages are undated, so a date filter alone would hide exactly what the user needs. Hits are re-ranked with vendor pricing/docs/changelogs first, blogs and aggregators last.
6. **Honest negatives are structural.** The model emits a machine-readable `<verdicts>` block with Changed / Unchanged / Couldn't verify per entity. Code parses it *before* sanitizing, strips the block from the persisted answer, validates every citation id, persists the verdicts, and the UI renders chips. The prompt still requires "no change found in the sources I checked since DATE" rather than "nothing changed", and nothing is called unchanged without a source showing the current value.
7. **Never invent memory.** If the user refers to something not in history, code injects `NO_MATCHING_HISTORY` and the model asks one short question.
8. **Speed.** Streaming from the first token, parallel tool calls, hard 4-step cap (last step forbids tools, so it always ends with an answer), cached prompt prefix, search cache with in-flight dedupe, and nothing before the first token except string work.
9. **The boundary is code.** Model output cannot persist control tags, unregistered citation ids, or unsafe source URLs. Source checks re-validate every redirect hop and refuse private/local targets.

## Considered and rejected
- **Planner/critic or multi-agent loops:** more latency, little gain on this task. The hard parts are deterministic.
- **Vector DB for history:** infra and failure modes for no recall gain on date-addressed, small histories.
- **Letting the LLM resolve dates / a "memory" tool:** unreliable, and a second tool violates the constraint.
- **LangChain / framework agents:** opaque. The raw SDK loop stays small and fully explainable.
- **SQLite:** native builds can break `npm install`; an atomic JSON file cannot.

## Tradeoffs and known limits
- Lexical retrieval still misses two-word paraphrases with only one shared term. The two-term guard buys precision at the cost of some recall; embeddings are the upgrade.
- Cache TTL (15 min) trades freshness for speed. Claim extraction is best-effort: when it fails, the model derives claims from the answer text.
- Seed data is illustrative and may be stale on purpose. `NOW_OVERRIDE` fakes the clock for demos.
- Single user (`x-user-id` header is the seam for multi-user).

## Another week
Larger eval set (30 variants of the three prompts) with per-claim diff scoring and citation-faithfulness checks; embeddings as a fallback behind the date index; a learned source reranker; per-user timezone profile; scheduled re-verification of high-value claims.

`npm test` runs 12 offline API/core checks; `npm run test:e2e` runs 2 Playwright flows. `npm run eval` runs deterministic context checks without keys, plus end-to-end runs with an LLM judge when keys are present.
