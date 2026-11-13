import { clock, config } from './config.js';
import { retrieve } from './retrieve.js';
import type { Store } from './store.js';
import { isoDate, isoDateTime, resolveDates, type Resolved } from './time.js';
import type { Claim, Turn } from './types.js';

const PERSONAL_PAST =
  /\b(i (asked|told|mentioned|said|wanted)|you (told|said|answered|recommended|suggested|gave)|we (shortlisted|discussed|talked|picked|chose|decided|compared|looked|went)|did (i|we)|last time|earlier|previous(ly)?|our (last|previous|earlier)|that (answer|recommendation))\b/i;
const RECHECK = /\b(still|changed?|changes|since|updates?|updated|anything new|shipped|outdated|up to date|re-?check|verify|anymore)\b/i;

export interface Match { turn: Turn; date: string; time: string; inLive: boolean }
export interface Ctx {
  now: string; today: string; tz: string;
  resolved: Resolved[];
  matches: Match[];
  live: Turn[];
  olderSummary: string;
  olderCount: number;
  noMatch: boolean;
  recheck: boolean;
  prefetch: Claim[];
  trace: unknown;
}
export interface Req { uid: string; conv: string; message: string; tz: string; now: Date }

/** Everything about time and memory is decided here, in plain code, before any model call. */
export function buildContext(store: Store, req: Req): Ctx {
  const { uid, conv, message, tz, now } = req;
  const today = isoDate(now, tz);
  const personalPast = PERSONAL_PAST.test(message);
  const resolved = resolveDates(message, now, tz, personalPast);
  const dates = resolved.flatMap((r) => [r.date, r.alt].filter(Boolean) as string[]);

  const all = store.conv(uid, conv);
  const live = all.slice(-config.liveTurns);
  const older = all.slice(0, Math.max(0, all.length - config.liveTurns));
  const summaryTurns = older.slice(-config.summaryTurns);
  const olderSummary = summaryTurns.map((t) => {
    const day = isoDate(new Date(t.ts), tz);
    const claims = t.claims.map((c) => `${c.entity}: ${c.claim}`).join('; ');
    return `- ${day}: asked "${t.user.replace(/\s+/g, ' ').slice(0, 180)}"; answered "${t.assistant.replace(/\s+/g, ' ').slice(0, 260)}"${claims ? `; claims: ${claims.slice(0, 320)}` : ''}`;
  }).join('\n');
  const liveIds = new Set(live.map((t) => t.id));
  const found = retrieve(store.all(uid), message, dates, tz);
  const matches: Match[] = found.map((t) => {
    const d = new Date(t.ts);
    return { turn: t, date: isoDate(d, tz), time: isoDateTime(d, tz).slice(11), inLive: liveIds.has(t.id) };
  });
  const noMatch = personalPast && matches.length === 0;

  // Speculative re-verification: if the user wants to know whether an earlier answer still holds,
  // start the searches now (parallel) instead of paying a model round-trip to ask for them.
  const wantsRecheck = RECHECK.test(message) && (personalPast || dates.length > 0);
  const seen = new Set<string>();
  const prefetch: Claim[] = [];
  if (wantsRecheck)
    for (const m of matches.slice(0, 3))
      for (const c of m.turn.claims) {
        const as_of = c.as_of || m.date;
        const key = c.check_query.trim().toLowerCase();
        if (as_of >= today || seen.has(key)) continue;
        seen.add(key);
        prefetch.push({ ...c, as_of });
      }

  const explain = matches.length
    ? `Matched ${matches.length} earlier turn${matches.length === 1 ? '' : 's'} by ${dates.length ? 'date and topic' : 'topic'} keywords.`
    : personalPast
      ? 'No earlier turn matched the dates or topic words in this message.'
      : 'No earlier turn was needed for this message.';
  return {
    now: isoDateTime(now, tz), today, tz, resolved, matches, live, olderSummary, olderCount: older.length, noMatch, recheck: wantsRecheck,
    prefetch: prefetch.slice(0, config.maxPrefetch),
    trace: {
      now: isoDateTime(now, tz), tz,
      resolved: resolved.map((r) => ({ phrase: r.phrase, date: r.date, alt: r.alt })),
      matched: matches.map((m) => ({ id: m.turn.id, date: m.date, user: m.turn.user.slice(0, 70) })),
      explain,
      trimmed: older.length,
      summarized: summaryTurns.length,
      recheck: wantsRecheck, prefetch: Math.min(prefetch.length, config.maxPrefetch), noMatch,
    },
  };
}
export { clock };
