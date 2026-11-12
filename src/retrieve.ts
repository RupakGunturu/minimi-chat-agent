import type { Turn } from './types.js';
import { isoDate } from './time.js';

const STOP = new Set(
  `the and but for with from about are was were been being does did have has had what which who when where why how can could would should will shall might must not yes than then there here just also very more most some any all each other into over under again only own same too you your our they them their him her its this that these those
   asked ask asking told tell said say shortlisted shortlist discussed compared last next week month today yesterday tomorrow ago earlier previous previously before since still correct changed change changes anything something shipped big update updated answer
   monday tuesday wednesday thursday friday saturday sunday january february march april may june july august september october november december`
    .split(/\s+/),
);

export const tokens = (s: string) =>
  (s.toLowerCase().match(/[a-z0-9][a-z0-9.+#]*/g) ?? [])
    .filter((t) => t.length > 2 && !STOP.has(t))
    .map((t) => (t.length > 3 && t.endsWith('s') ? t.slice(0, -1) : t));

/**
 * Deliberately simple: date window + keyword overlap. History is small and the dates are the
 * strongest signal; a vector index would add infra and failure modes without improving recall here.
 */
export function retrieve(turns: Turn[], query: string, dates: string[], tz: string, k = 3): Turn[] {
  const q = new Set(tokens(query));
  const dateSet = new Set(dates);
  return turns
    .map((t) => {
      const bag = new Set(tokens(`${t.user} ${t.assistant} ${t.claims.map((c) => c.entity).join(' ')}`));
      let kw = 0;
      for (const w of q) if (bag.has(w)) kw++;
      return { t, kw, dateHit: dateSet.has(isoDate(new Date(t.ts), tz)) };
    })
    // Topical match, or right day AND (some topical overlap OR the user gave almost no topic: "what did I ask on 3 Nov?")
    .filter((s) => s.kw >= 2 || (s.dateHit && (s.kw >= 1 || q.size <= 2)))
    .sort((a, b) => Number(b.dateHit) - Number(a.dateHit) || b.kw - a.kw || b.t.ts.localeCompare(a.t.ts))
    .slice(0, k)
    .map((s) => s.t);
}
