import { config } from './config.js';
import { bestExcerpt, canonicalUrl, queryTerms } from './excerpt.js';
import { makePageReader, type PageReader } from './page.js';
import { isPrimary, isReadable, rankHit } from './rank.js';
import type { Hit, SearchFn, SearchOpts } from './types.js';

type Provider = (query: string, opts: SearchOpts) => Promise<Hit[]>;

/** Known official domains for common vendors; generic entities fall back to <name>.com. */
const OFFICIAL_DOMAINS: Record<string, string> = {
  aws: 'aws.amazon.com', amazon: 'aws.amazon.com', node: 'nodejs.org', nodejs: 'nodejs.org',
  postgres: 'postgresql.org', postgresql: 'postgresql.org', pgvector: 'github.com',
  qdrant: 'qdrant.tech', milvus: 'milvus.io', redis: 'redis.io', docker: 'docker.com',
};

function vendorDomains(entity?: string): string[] {
  const term = queryTerms(String(entity ?? ''), { generic: true })[0];
  if (!term) return [];
  return [OFFICIAL_DOMAINS[term] ?? `${term}.com`];
}

const normDate = (s?: string) => {
  if (!s) return undefined;
  const d = new Date(s);
  return isNaN(+d) ? undefined : d.toISOString().slice(0, 10);
};

function toHit(x: Record<string, unknown>, dated = false): Hit {
  return {
    title: String(x.title ?? x.url ?? ''),
    url: String(x.url ?? ''),
    content: String(x.content ?? ''),
    raw: typeof x.raw_content === 'string' && x.raw_content.trim() ? x.raw_content : undefined,
    published: normDate(typeof x.published_date === 'string' ? x.published_date : undefined),
    dated,
  };
}

async function tavilyRequest(body: Record<string, unknown>): Promise<Hit[]> {
  const r = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${process.env.TAVILY_API_KEY}` },
    body: JSON.stringify({ include_answer: false, ...body }),
    signal: AbortSignal.timeout(config.searchTimeoutMs),
  });
  if (!r.ok) throw new Error(`search provider returned ${r.status}`);
  const j: { results?: Record<string, unknown>[] } = await r.json();
  return (j.results ?? []).map((x) => toHit(x));
}

async function tavily(query: string, opts: SearchOpts): Promise<Hit[]> {
  const base = {
    query,
    topic: opts.topic ?? 'general',
    max_results: config.searchResults,
    include_raw_content: true,
    ...(opts.includeDomains?.length ? { include_domains: opts.includeDomains } : {}),
    search_depth: config.searchDepth,
    ...(config.searchDepth === 'advanced' ? { chunks_per_source: 3 } : {}),
  };
  try {
    return await tavilyRequest(base);
  } catch (e) {
    if (config.searchDepth === 'advanced' && /\b(400|422)\b/.test((e as Error).message))
      return tavilyRequest({ ...base, search_depth: 'basic', include_raw_content: false, chunks_per_source: undefined });
    throw e;
  }
}

function dedupe(hits: Hit[]): Hit[] {
  const seen = new Map<string, Hit>();
  for (const hit of hits) {
    const key = canonicalUrl(hit.url);
    const prior = seen.get(key);
    if (!prior) { seen.set(key, hit); continue; }
    if ((hit.raw?.length ?? 0) + hit.content.length > (prior.raw?.length ?? 0) + prior.content.length) seen.set(key, hit);
  }
  return [...seen.values()];
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    for (;;) {
      const i = next++;
      if (i >= items.length) return;
      out[i] = await fn(items[i]);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * `since` fans out into TWO parallel queries:
 *  - dated:   results published after `since` (announcements, changelogs, news)
 *  - current: no date filter, because pricing/docs pages are evergreen and undated; a date filter alone would hide them
 * The model then diffs the old claim against both.
 */
async function run(query: string, opts: SearchOpts, provider: Provider, read: PageReader): Promise<Hit[]> {
  const base = { ...opts, query };
  const official = vendorDomains(opts.entity);
  const current: SearchOpts = { ...base, since: undefined, ...(official.length ? { includeDomains: official } : {}) };
  let hits: Hit[];
  if (!opts.since) {
    hits = await provider(query, opts.entity && official.length ? current : base);
  } else {
    const [changes, currentHits] = await Promise.allSettled([
      provider(query, { ...base, since: opts.since }),
      provider(query, current),
    ]);
    if (changes.status === 'rejected' && currentHits.status === 'rejected') throw changes.reason;
    const datedLimit = Math.ceil(config.searchResults / 2);
    const merged: Hit[] = [];
    if (changes.status === 'fulfilled') merged.push(...changes.value.slice(0, datedLimit).map((h) => ({ ...h, dated: true })));
    if (currentHits.status === 'fulfilled') merged.push(...currentHits.value);
    hits = merged.slice(0, config.searchResults + 8);
  }

  const matchQuery = `${query} ${opts.entity ?? ''}`.trim();
  hits = dedupe(hits).map((h) => ({
    ...h,
    content: bestExcerpt(h.raw ?? h.content, matchQuery, config.readChars),
  }));

  if (!config.readPages || !config.readPagesPerQuery) return hits;
  const candidates = hits
    .map((h, index) => ({ h, index, score: rankHit(h, matchQuery) }))
    .filter(({ h }) => isReadable(h, matchQuery) && (isPrimary(h, matchQuery) || !h.raw || h.raw.length < 800))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.readPagesPerQuery);

  await mapLimit(candidates, 2, async ({ h, index }) => {
    const text = await read(h.url);
    if (text) hits[index] = { ...h, content: bestExcerpt(text, matchQuery, config.readChars) };
  });
  return hits;
}

/** Cache + in-flight dedupe keyed by (query, since, topic, entity). */
export function makeSearch(deps: { provider?: Provider; read?: PageReader } = {}): SearchFn {
  const provider = deps.provider ?? tavily;
  const read = deps.read ?? makePageReader();
  const cache = new Map<string, { at: number; p: Promise<Hit[]> }>();
  return (query, opts = {}) => {
    const key = `${query.toLowerCase().trim()}|${opts.since ?? ''}|${opts.topic ?? 'general'}|${opts.entity ?? ''}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < config.searchTtlMs) return hit.p;
    const p = run(query, opts, provider, read);
    cache.set(key, { at: Date.now(), p });
    p.catch(() => cache.delete(key));
    return p;
  };
}
