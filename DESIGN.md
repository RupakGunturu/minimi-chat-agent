# DESIGN

**Thesis.** The example prompts are not about search. They are about time and continuity ("Monday", "3 November", "still correct today"). A generic ReAct loop leaves both to the LLM, which is where it fails: it does calendar arithmetic badly, remembers nothing, and cannot tell "no change found" from "no change". So I moved time and memory into plain code and kept the model loop small.

## How it works
```
message → buildContext (code, ~ms) → [prefetch searches, parallel] → one streaming loop (≤4 steps) → persist → extract claims (async)
```
1. **Time is resolved in code.** `chrono-node` runs against the user's wall clock and timezone; the model receives `"Monday" → Mon 2026-11-09`. "Last Tuesday" is ambiguous on a Wednesday, so both readings are kept: retrieval tries both and the model must say which it used.
2. **Memory is injected, not a tool** (the brief allows exactly one tool). Every turn is stored with a UTC timestamp. Retrieval is date window + keyword overlap, and returns the old answer plus its structured claims, stamped with the date they were made.
3. **Claims, not prose.** After each answer a cheap model extracts `{entity, claim, as_of, check_query}` off the hot path. "Is it still correct?" becomes: for each claim, search since `as_of`, then diff. That is far more reliable than re-reading paragraphs.
4. **Speculative re-verification.** When the message refers to the past and asks "still/changed/since", code starts the claim searches in parallel *before* the first model call. This removes one full model round-trip from the slowest class of question.
5. **`since` fans out into two searches:** dated results after `as_of` (announcements, changelogs) and an undated current-state query. Pricing pages are undated, so a date filter alone would hide exactly what the user needs.
6. **Honest negatives are structural.** The prompt forces Changed / Unchanged / Couldn't verify, and "no change found in the sources I checked since DATE" rather than "nothing changed". Nothing is called unchanged without a source showing the current value.
7. **Never invent memory.** If the user refers to something not in history, code injects `NO_MATCHING_HISTORY` and the model asks one short question.
8. **Speed.** Streaming from the first token, parallel tool calls, hard 4-step cap (last step forbids tools, so it always ends with an answer), cached prompt prefix, search cache with in-flight dedupe, and nothing before the first token except string work.

## Considered and rejected
- **Planner/critic or multi-agent loops:** more latency, little gain on this task. The hard parts are deterministic.
- **Vector DB for history:** infra and failure modes for no recall gain on date-addressed, small histories.
- **Letting the LLM resolve dates / a "memory" tool:** unreliable, and a second tool violates the constraint.
- **LangChain / framework agents:** opaque. The raw SDK loop is about 80 lines and fully explainable.
- **SQLite:** native builds can break `npm install`; an atomic JSON file cannot.

## Tradeoffs and known limits
- Lexical retrieval misses paraphrases with no date ("that database thing"). Fine at this scale; embeddings are the upgrade.
- Cache TTL (15 min) trades freshness for speed. Claim extraction is best-effort: when it fails, the model derives claims from the answer text.
- Seed data is illustrative and may be stale on purpose. `NOW_OVERRIDE` fakes the clock for demos.
- Single user (`x-user-id` header is the seam for multi-user).

## Another week
Larger eval set (30 variants of the three prompts) with per-claim diff scoring and citation-faithfulness checks; embeddings as a fallback behind the date index; source-quality ranking (vendor pricing pages first); per-user timezone profile; a claim-diff view in the UI; scheduled re-verification of high-value claims.

`npm run eval` runs deterministic context checks without keys, plus end-to-end runs with an LLM judge when keys are present.
