import type OpenAI from 'openai';
import { config } from './config.js';
import type { Claim } from './types.js';

const PROMPT = `You extract checkable, time-sensitive claims from a chat exchange so they can be re-verified later.
Return ONLY JSON: {"claims":[{"entity":"","claim":"","as_of":"YYYY-MM-DD","check_query":""}]}
- Up to 8 claims: prices, plans, versions, features, availability, rankings, and lists the user shortlisted (one claim per item).
- Include facts the USER stated that are worth tracking (e.g. a shortlist). Skip timeless facts and opinions.
- as_of = TODAY unless the claim is explicitly dated earlier.
- check_query = a 3-8 word web search that would reveal whether this claim has changed.
- If nothing qualifies: {"claims":[]}`;

const valid = (c: any) => c && typeof c.entity === 'string' && typeof c.claim === 'string' && typeof c.check_query === 'string';

/** Runs after the answer is streamed and persisted, so it never adds user-visible latency. */
export async function extractClaims(
  llm: OpenAI, p: { user: string; answer: string; today: string },
): Promise<Claim[]> {
  try {
    const r = await llm.chat.completions.create({
      model: config.modelFast, max_tokens: 800,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `TODAY: ${p.today}\nUSER: ${p.user}\nASSISTANT: ${p.answer}` },
      ],
    });
    const text = r.choices[0]?.message?.content ?? '';
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return [];
    const j = JSON.parse(m[0]);
    return (Array.isArray(j.claims) ? j.claims : []).filter(valid).slice(0, 8).map((c: any) => ({
      entity: c.entity.slice(0, 80), claim: c.claim.slice(0, 240), check_query: c.check_query.slice(0, 120),
      as_of: /^\d{4}-\d{2}-\d{2}$/.test(c.as_of) && c.as_of <= p.today ? c.as_of : p.today,
    }));
  } catch {
    return [];
  }
}
