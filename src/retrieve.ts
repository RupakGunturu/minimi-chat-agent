import type { Turn } from './types.js';
import { isoDate } from './time.js';

const STOP = new Set(
  `the and but for with from about are was were been being does did have has had what which who when where why how can could would should will shall might must not yes than then there here just also very more most some any all each other into over under again only own same too you your our they them their him her its this that these those
   thing things stuff kind sort big
   asked ask asking told tell said say shortlisted shortlist discussed compared last next week month today yesterday tomorrow ago earlier previous previously before since still correct changed change changes anything something shipped update updated answer
   latest new newest current currently recent recently
   monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december`
    .split(/\s+/),
);

/** Tiny domain normalizer so "prices", "pricing", "postgres" and "postgre" agree. */
function canonical(t: string) {
  const w = t.replace(/[^a-z0-9]/g, '');
  if (/^postgre/.test(w)) return 'postgres';
  if (/^pric/.test(w)) return 'pricing';
  if (/^licen[cs]/.test(w)) return 'license';
  if (/^versio/.test(w)) return 'version';
  if (/^releas/.test(w)) return 'release';
  if (/^tool/.test(w)) return 'tool';
  if (/^plan/.test(w)) return 'plan';
  if (/^node/.test(w)) return 'node';
  return t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t;
}

export const tokens = (s: string) =>
  (s.toLowerCase().match(/[a-z0-9][a-z0-9.+#]*/g) ?? [])
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map(canonical);

interface Doc {
  turn: Turn;
  tf: Map<string, number>;
  len: number;
  dateHit: boolean;
  claimText: string;
}

/**
 * Deliberately simple and explainable: BM25 over user text, answers and claims, plus a
 * strong boost for a resolved date and a small recency tie-break. No vector index and no
 * new dependencies; the dates are the strongest signal and histories are small.
 *
 * Known limit: lexical matching misses pure paraphrases with no shared word ("that database
 * thing"). Embeddings are the upgrade; a bigger stop-word list and claim text carry most of
 * the win at this scale.
 */
export function retrieve(turns: Turn[], query: string, dates: string[], tz: string, k = 3): Turn[] {
  const q = new Set(tokens(query));
  const dateSet = new Set(dates);
  const docs: Doc[] = turns.map((turn) => {
    const claimText = turn.claims.map((c) => `${c.entity} ${c.claim} ${c.check_query}`).join(' ');
    const words = tokens(`${turn.user} ${turn.assistant} ${claimText}`);
    const tf = new Map<string, number>();
    for (const word of words) tf.set(word, (tf.get(word) ?? 0) + 1);
    return { turn, tf, len: words.length, dateHit: dateSet.has(isoDate(new Date(turn.ts), tz)), claimText: claimText.toLowerCase() };
  });
  if (!docs.length) return [];

  const N = docs.length;
  const avgdl = docs.reduce((sum, d) => sum + d.len, 0) / N || 1;
  const df = new Map<string, number>();
  for (const doc of docs)
    for (const word of q) if (doc.tf.has(word)) df.set(word, (df.get(word) ?? 0) + 1);

  const k1 = 1.2;
  const b = 0.75;
  const now = Date.now();
  const scored = docs.map((doc) => {
    let score = 0;
    let matched = 0;
    for (const word of q) {
      const tf = doc.tf.get(word) ?? 0;
      if (!tf) continue;
      matched++;
      const dfw = df.get(word) ?? 0;
      const idf = Math.log(1 + (N - dfw + 0.5) / (dfw + 0.5));
      score += idf * ((tf * (k1 + 1)) / (tf + k1 * (1 - b + (b * doc.len) / avgdl)));
      if (word.length > 3 && doc.claimText.includes(word)) score += 0.35;
    }
    if (doc.dateHit) score += 3;
    const ageDays = Math.max(0, (now - new Date(doc.turn.ts).getTime()) / 86_400_000);
    score += 0.08 / (1 + ageDays / 30);
    return { doc, score, matched };
  });

  const minMatch = Math.min(2, q.size);
  return scored
    .filter(({ doc, score, matched }) => {
      if (q.size === 0) return doc.dateHit;
      // A bare date question ("what did I ask on 3 November?") should not need a
      // lexical hit. Only use that fallback when the words carry no real signal,
      // otherwise every turn on the date would match a topic query.
      const dateOnly = doc.dateHit && dateSet.size > 0 && matched === 0 && q.size <= 1;
      return (dateOnly || matched >= minMatch) && (doc.dateHit || score >= 0.6);
    })
    .sort((a, b2) => b2.score - a.score || b2.doc.turn.ts.localeCompare(a.doc.turn.ts))
    .slice(0, k)
    .map(({ doc }) => doc.turn);
}
