import type Anthropic from '@anthropic-ai/sdk';
import { randomUUID } from 'node:crypto';
import { extractClaims } from './claims.js';
import { config } from './config.js';
import { buildContext, type Req } from './context.js';
import { dynamicPrompt, STATIC_PROMPT, stripCites } from './prompt.js';
import type { Store } from './store.js';
import { isoDate, isoDateTime } from './time.js';
import type { AgentEvent, Hit, SearchFn, Source, Turn } from './types.js';

export interface Deps { store: Store; search: SearchFn; anthropic: Anthropic }

const SEARCH_TOOL = {
  name: 'web_search',
  description:
    'Search the web. Returns numbered results [n] with title, host, publication date (or "undated") and a snippet. ' +
    'Set `since` for "what changed / new since X" questions: it adds results published after that date AND current undated pages.',
  input_schema: {
    type: 'object' as const,
    properties: {
      query: { type: 'string', description: 'Short, specific query (3-8 words). One entity or topic per call.' },
      since: { type: 'string', description: 'ISO date YYYY-MM-DD of the earlier answer/event.' },
      topic: { type: 'string', enum: ['general', 'news'] },
    },
    required: ['query'],
  },
};

/** Per-turn source registry: stable [n] ids shared by prefetch and tool calls. */
class Sources {
  list: Source[] = [];
  add(h: Hit) {
    const hit = this.list.find((s) => s.url === h.url);
    if (hit) return hit.id;
    this.list.push({ id: this.list.length + 1, title: h.title, url: h.url, published: h.published });
    return this.list.length;
  }
}

function formatHits(reg: Sources, hits: Hit[]) {
  return hits.slice(0, 6).map((h) => {
    const id = reg.add(h);
    let host = h.url;
    try { host = new URL(h.url).hostname.replace(/^www\./, ''); } catch { /* keep raw */ }
    return `[${id}] ${h.title} — ${host} — ${h.published ? 'published ' + h.published : 'undated'}\n${h.content.replace(/\s+/g, ' ').slice(0, 450)}`;
  }).join('\n\n');
}

export async function runAgent(deps: Deps, req: Req, emit: (e: AgentEvent) => void, signal?: AbortSignal) {
  const t0 = performance.now();
  let ttft: number | null = null;
  let searches = 0;
  const ctx = buildContext(deps.store, req);
  emit({ type: 'context', data: ctx.trace });

  const reg = new Sources();
  const pushSources = () => emit({ type: 'sources', sources: reg.list });

  // 1) Speculative evidence for "is it still correct?" questions: searches run in parallel, before the first model call.
  let evidence = '';
  if (ctx.prefetch.length) {
    emit({ type: 'status', text: `Re-checking ${ctx.prefetch.length} earlier claim(s) against sources since their date…` });
    const res = await Promise.all(ctx.prefetch.map(async (c) => {
      try { return { c, hits: await deps.search(c.check_query, { since: c.as_of }), failed: false }; }
      catch { return { c, hits: [] as Hit[], failed: true }; }
    }));
    searches += res.length;
    evidence = `<prefetched_evidence note="Searches already run by code. Each used since=as_of (dated results) plus an undated current-state query.">\n` +
      res.map(({ c, hits, failed }) => {
        const attrs = `entity="${c.entity}" old_claim="${c.claim}" as_of="${c.as_of}" query="${c.check_query}"`;
        return failed ? `<check ${attrs} status="search_failed"/>` : `<check ${attrs}>\n${formatHits(reg, hits) || 'No results.'}\n</check>`;
      }).join('\n') + '\n</prefetched_evidence>';
    pushSources();
  }

  // 2) Messages: this conversation's recent turns (timestamped) + the new message.
  const stamp = (d: Date) => `[${isoDateTime(d, req.tz)}] `;
  const messages: Anthropic.MessageParam[] = [];
  for (const t of ctx.live) {
    messages.push({ role: 'user', content: stamp(new Date(t.ts)) + t.user });
    messages.push({ role: 'assistant', content: stripCites(t.assistant) || '(no answer)' });
  }
  messages.push({ role: 'user', content: stamp(req.now) + req.message });

  const system: Anthropic.TextBlockParam[] = [
    { type: 'text', text: STATIC_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamicPrompt(ctx, evidence) },
  ];

  // 3) Single loop, parallel tools, hard step cap. The last step forbids tools so we always end with an answer.
  let answer = '';
  for (let step = 0; step < config.maxSteps; step++) {
    const last = step === config.maxSteps - 1;
    const stream = deps.anthropic.messages.stream(
      {
        model: config.modelMain, max_tokens: 1800, system, messages, tools: [SEARCH_TOOL],
        tool_choice: (last ? { type: 'none' } : { type: 'auto' }) as any,
      },
      { signal },
    );
    stream.on('text', (d) => {
      ttft ??= performance.now() - t0;
      if (answer && step > 0 && !answer.endsWith('\n')) { answer += '\n\n'; emit({ type: 'text', delta: '\n\n' }); }
      answer += d;
      emit({ type: 'text', delta: d });
    });
    const msg = await stream.finalMessage();
    messages.push({ role: 'assistant', content: msg.content });
    const uses = msg.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use');
    if (!uses.length) break;

    emit({ type: 'status', text: `Searching: ${uses.map((u) => (u.input as any).query).join(' · ')}` });
    searches += uses.length;
    const results = await Promise.all(uses.map(async (u): Promise<Anthropic.ToolResultBlockParam> => {
      const { query, since, topic } = u.input as { query?: string; since?: string; topic?: string };
      const ok = since && /^\d{4}-\d{2}-\d{2}$/.test(since) && since <= ctx.today ? since : undefined;
      try {
        const hits = await deps.search(String(query ?? '').slice(0, 200), { since: ok, topic: topic === 'news' ? 'news' : 'general' });
        return { type: 'tool_result', tool_use_id: u.id, content: formatHits(reg, hits) || 'No results.' };
      } catch (e) {
        return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: `Search failed: ${(e as Error).message}. Tell the user; do not guess.` };
      }
    }));
    messages.push({ role: 'user', content: results });
    pushSources();
  }
  if (!answer.trim()) { answer = 'I could not produce an answer. Please try again.'; emit({ type: 'text', delta: answer }); }

  // 4) Persist the turn immediately; claim extraction happens off the hot path.
  const cited = new Set([...answer.matchAll(/\[(\d+)\]/g)].map((m) => +m[1]));
  const turn: Turn = {
    id: randomUUID(), uid: req.uid, conv: req.conv, ts: req.now.toISOString(), tz: req.tz,
    user: req.message, assistant: answer, claims: [], sources: reg.list.filter((s) => cited.has(s.id)),
  };
  await deps.store.add(turn);
  emit({ type: 'done', turnId: turn.id, ttftMs: ttft && Math.round(ttft), totalMs: Math.round(performance.now() - t0), searches });

  const claimsDone = extractClaims(deps.anthropic, { user: req.message, answer, today: isoDate(req.now, req.tz) })
    .then((claims) => deps.store.patch(turn.id, { claims }));
  return { turn, claimsDone, answer };
}
