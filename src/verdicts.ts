import { queryTerms } from './excerpt.js';
import type { Verdict } from './types.js';

export function parseVerdicts(text: string, maxId: number): Verdict[] {
  const tagged = text.match(/<verdicts>([\s\S]*?)<\/verdicts>/i);
  const bare = text.match(/(?:^|\n)\s*(\{\s*"checks"\s*:[\s\S]*\})\s*$/);
  const body = tagged?.[1] ?? bare?.[1];
  if (!body) return [];
  try {
    const parsed = JSON.parse(body.trim());
    const checks = Array.isArray(parsed?.checks) ? parsed.checks : [];
    return checks
      .filter((c: { entity?: unknown }) => c && typeof c.entity === 'string')
      .map((c: { entity: string; verdict?: string; note?: unknown; source?: unknown }) => {
        const verdict: Verdict['verdict'] = c.verdict === 'changed' || c.verdict === 'unchanged' ? c.verdict : 'unverified';
        const source = Number.isInteger(c.source) && (c.source as number) >= 1 && (c.source as number) <= maxId
          ? (c.source as number) : undefined;
        return {
          entity: c.entity.slice(0, 120), verdict,
          note: typeof c.note === 'string' ? c.note.slice(0, 220) : undefined, source,
        };
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

export type VerdictEvidence = string | { text: string; primary: boolean };

/**
 * Downgrade a confident verdict when the cited evidence never mentions the entity,
 * or when it is only a secondary source. Cheap, conservative, and code-owned: the
 * model cannot claim "unchanged" off a reseller blog or a page about something else.
 */
export function guardVerdicts(verdicts: Verdict[], evidence: (id: number) => VerdictEvidence | undefined): Verdict[] {
  return verdicts.map((v) => {
    if (v.verdict === 'unverified' || !v.source) return v;
    const found = evidence(v.source);
    if (!found) return v;
    const { text, primary } = typeof found === 'string' ? { text: found, primary: true } : found;
    if (!text) return v;
    const terms = queryTerms(v.entity, { generic: true });
    if (!terms.length) return v;
    const lower = text.toLowerCase();
    if (!terms.some((term) => lower.includes(term))) {
      return { ...v, verdict: 'unverified', note: 'The cited source did not mention this entity.' };
    }
    if (!primary) return { ...v, verdict: 'unverified', note: 'Only a secondary source was cited.' };
    return v;
  });
}
