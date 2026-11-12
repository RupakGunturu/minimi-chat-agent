# Time-aware chat agent

One tool (web search), built around time and conversation continuity. Read `DESIGN.md` for the architecture.

```bash
npm install
cp .env.example .env     # add GEMINI_API_KEY and TAVILY_API_KEY
npm run seed             # optional: demo history (Mon CRM shortlist, last Tue Postgres, 3 Nov vector DB)
npm run dev              # http://localhost:3000
npm run eval             # deterministic checks always; end-to-end + judge when keys are set
```

Models run through the OpenAI-compatible API. By default this points at Google Gemini
(`https://generativelanguage.googleapis.com/v1beta/openai/`); set `LLM_BASE_URL`,
`MODEL_MAIN` and `MODEL_FAST` to use another OpenAI-compatible provider.

Try: "What did I ask you on 3 November? Is your answer still correct today?", "Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?", "On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?"

Seeded dates are computed relative to today. Set `NOW_OVERRIDE` before `npm run seed` and `npm run dev` to fake the clock.

```
src/time.ts      date resolution (chrono, timezone-safe)
src/retrieve.ts  date + keyword retrieval over past turns
src/context.ts   decides what the model gets: dates, history, prefetch
src/search.ts    Tavily wrapper: since → dated + current fan-out, cache
src/agent.ts     the loop: stream, parallel tools, step cap, persist
src/claims.ts    async claim extraction
src/prompt.ts    static (cached) + dynamic system prompt
```
