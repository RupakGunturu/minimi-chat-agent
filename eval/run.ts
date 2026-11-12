/**
 * npm run eval
 * Stage 1 (always, no API keys): deterministic checks of the code that owns time + memory.
 * Stage 2 (when keys exist): runs the full agent per case and has a cheap model judge it against a rubric.
 */
import Anthropic from '@anthropic-ai/sdk';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAgent } from '../src/agent.js';
import { config } from '../src/config.js';
import { buildContext, type Ctx } from '../src/context.js';
import { makeSearch } from '../src/search.js';
import { seedTurns } from '../src/seed-data.js';
import { Store } from '../src/store.js';

const NOW = new Date('2026-11-11T09:00:00Z'); // a Wednesday
const TZ = 'Asia/Kolkata';
const store = await new Store(join(tmpdir(), `eval-${Date.now()}.json`)).init();
await store.reset(seedTurns(NOW, TZ));

interface Case { id: string; msg: string; check: (c: Ctx) => string | null; rubric: string }
const has = (c: Ctx, id: string) => c.matches.some((m) => m.turn.id === id);
const cases: Case[] = [
  {
    id: 'postgres-last-tuesday',
    msg: 'Last Tuesday I asked you about Postgres hosting. Has any pricing changed since then?',
    check: (c) => !c.resolved.some((r) => r.date === '2026-11-03' || r.alt === '2026-11-03') ? 'did not resolve "last Tuesday" to 2026-11-03 (as date or alt)'
      : !has(c, 'seed-postgres') ? 'postgres turn not retrieved' : c.prefetch.length < 3 ? 'claims not prefetched' : null,
    rubric: 'Identifies the earlier answer as Tue 3 Nov (may note 10 Nov alternative). Compares Neon/Supabase/RDS prices with fresh sources. Separates changed / unchanged / could not verify. Cites sources. Never says "nothing changed" without naming what was checked.',
  },
  {
    id: 'what-did-i-ask-3-nov',
    msg: 'What did I ask you on 3 November? Is your answer still correct today?',
    check: (c) => !c.resolved.some((r) => r.date === '2026-11-03') ? 'did not resolve 3 November'
      : !(has(c, 'seed-vector') && has(c, 'seed-postgres')) ? 'both 3 Nov turns should be retrieved' : !c.prefetch.length ? 'no prefetch' : null,
    rubric: 'Lists what the user asked on 3 Nov 2026 (vector database question and Postgres hosting) from history, then re-verifies the old claims against fresh sources and reports per-claim status honestly.',
  },
  {
    id: 'crm-monday',
    msg: 'On Monday we shortlisted 5 CRM tools for a 20-person sales team. Has any of them changed pricing or shipped something big since?',
    check: (c) => !c.resolved.some((r) => r.date === '2026-11-09') ? 'did not resolve Monday to 2026-11-09'
      : !has(c, 'seed-crm') ? 'crm turn not retrieved' : c.prefetch.length < 5 ? 'expected 5 prefetched checks' : null,
    rubric: 'Uses the five tools from history (HubSpot, Pipedrive, Zoho, Close, Salesforce), reports pricing/product changes since Mon 9 Nov per tool with sources, and says plainly when nothing was found rather than claiming nothing changed.',
  },
  {
    id: 'missing-history',
    msg: 'Last Friday we compared project management tools. Has anything changed since?',
    check: (c) => !c.noMatch ? 'should flag NO_MATCHING_HISTORY' : c.prefetch.length ? 'must not prefetch without history' : null,
    rubric: 'Does NOT invent a prior comparison. Says it cannot find it and asks ONE short question (which tools?).',
  },
  {
    id: 'plain-question',
    msg: 'What is the latest Node.js LTS version?',
    check: (c) => c.noMatch || c.matches.length || c.prefetch.length ? 'memory machinery fired on a plain question' : null,
    rubric: 'Searches, answers with a current LTS version and cites a source.',
  },
];

let failed = 0;
console.log('\nStage 1: context (deterministic)');
for (const k of cases) {
  const ctx = buildContext(store, { uid: 'local', conv: 'eval', message: k.msg, tz: TZ, now: NOW });
  const err = k.check(ctx);
  if (err) failed++;
  console.log(`${err ? 'FAIL' : 'ok  '} ${k.id}${err ? ' — ' + err : ''}`);
}

if (process.env.ANTHROPIC_API_KEY && process.env.TAVILY_API_KEY) {
  console.log('\nStage 2: end-to-end + LLM judge');
  const anthropic = new Anthropic();
  const deps = { store, search: makeSearch(), anthropic };
  for (const k of cases) {
    let ans = '';
    const { turn } = await runAgent(deps, { uid: 'local', conv: 'eval-' + k.id, message: k.msg, tz: TZ, now: NOW },
      (e) => { if (e.type === 'text') ans += e.delta; if (e.type === 'done') (k as any).m = e; });
    const j = await anthropic.messages.create({
      model: config.modelFast, max_tokens: 300,
      messages: [{ role: 'user', content: `Judge this assistant answer. Today is 2026-11-11.\nRUBRIC: ${k.rubric}\nUSER: ${k.msg}\nANSWER:\n${ans}\n\nReturn ONLY JSON {"pass":boolean,"reason":"one sentence"}` }],
    });
    const txt = j.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
    const v = JSON.parse(txt.match(/\{[\s\S]*\}/)![0]);
    const m = (k as any).m;
    if (!v.pass) failed++;
    console.log(`${v.pass ? 'ok  ' : 'FAIL'} ${k.id}  ttft=${m?.ttftMs}ms total=${m?.totalMs}ms searches=${m?.searches}  ${v.reason}`);
    void turn;
  }
} else {
  console.log('\nStage 2 skipped (set ANTHROPIC_API_KEY and TAVILY_API_KEY).');
}
process.exit(failed ? 1 : 0);
