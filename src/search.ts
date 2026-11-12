import { config } from './config.js';
import type { Hit, SearchFn, SearchOpts } from './types.js';

const normDate = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(+d) ? undefined : d.toISOString().slice(0, 10);
};

async function tavily(body: Record<string, unknown>): Promise<Hit[]> {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ search_depth: 'basic', max_results: 6, include_answer: false, ...body }),
    signal: AbortSignal.timeout(12_000),
  });
  if (!r.ok) throw new Error(`search provider returned ${r.status}`);
  const j: any = await r.json();
  return (j.results ?? []).map((x: any) => ({
    title: String(x.title ?? x.url), url: String(x.url), content: String(x.content ?? ''),
    published: normDate(x.published_date), dated: false,
  }));
}

/**
 * `since` fans out into TWO parallel queries:
 *  - dated:   results published after `since` (announcements, changelogs, news)
 *  - current: no date filter, because pricing/docs pages are evergreen and undated; a date filter alone would hide them
 * The model then diffs the old claim against both.
 */
async function run(query: string, { since, topic = 'general' }: SearchOpts): Promise<Hit[]> {
  const base = { query, topic };
  if (!since) return tavily(base);
  const [changes, current] = await Promise.allSettled([tavily({ ...base, start_date: since }), tavily(base)]);
  if (changes.status === 'rejected' && current.status === 'rejected') throw changes.reason;
  const seen = new Set<string>();
  const out: Hit[] = [];
  const push = (list: PromiseSettledResult<Hit[]>, dated: boolean) => {
    if (list.status !== 'fulfilled') return;
    for (const h of list.value) if (!seen.has(h.url)) { seen.add(h.url); out.push({ ...h, dated }); }
  };
  push(changes, true);
  push(current, false);
  return out.slice(0, 8);
}

/** Cache + in-flight dedupe keyed by (query, since, topic). */
export function makeSearch(): SearchFn {
  const cache = new Map<string, { at: number; p: Promise<Hit[]> }>();
  return (query, opts = {}) => {
    const key = `${query.toLowerCase().trim()}|${opts.since ?? ''}|${opts.topic ?? 'general'}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < config.searchTtlMs) return hit.p;
    const p = run(query, opts);
    cache.set(key, { at: Date.now(), p });
    p.catch(() => cache.delete(key));
    return p;
  };
}
