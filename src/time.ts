import * as chrono from 'chrono-node';

const pad = (n: number) => String(n).padStart(2, '0');

export function localParts(d: Date, tz: string) {
  const f = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  const p = Object.fromEntries(f.formatToParts(d).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, hh: +p.hour, mm: +p.minute };
}
export const isoDate = (d: Date, tz: string) => {
  const p = localParts(d, tz);
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
};
export const isoDateTime = (d: Date, tz: string) => {
  const p = localParts(d, tz);
  return `${isoDate(d, tz)} ${pad(p.hh)}:${pad(p.mm)}`;
};
export const weekday = (iso: string) =>
  new Date(iso + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
export const label = (iso: string) => `${weekday(iso)} ${iso}`;
export function addDays(iso: string, n: number) {
  const d = new Date(iso + 'T12:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export interface Resolved { phrase: string; date: string; alt?: string }

/**
 * Deterministic date resolution. The LLM never does calendar arithmetic.
 * chrono runs against the user's *wall clock* (so server timezone is irrelevant) and we read
 * back y/m/d components rather than instants.
 */
export function resolveDates(text: string, now: Date, tz: string, preferPast: boolean): Resolved[] {
  const p = localParts(now, tz);
  const wall = new Date(p.y, p.m - 1, p.d, p.hh, p.mm);
  const today = isoDate(now, tz);
  const out = new Map<string, Resolved>();
  for (const r of chrono.parse(text, wall, { forwardDate: false })) {
    if (/^(today|now|tonight|right now)$/i.test(r.text.trim())) continue;
    const y = r.start.get('year')!, m = r.start.get('month')!, d = r.start.get('day')!;
    let date = `${y}-${pad(m)}-${pad(d)}`;
    const weekdayOnly = r.start.isCertain('weekday') && !r.start.isCertain('year') && !r.start.isCertain('month') && !r.start.isCertain('day');
    if (preferPast && weekdayOnly) {
      // chrono can pick the upcoming weekday even with forwardDate:false; for a past-tense request
      // ("on Monday we shortlisted...") step back whole weeks instead of subtracting a year.
      while (date > today && !/\bnext\b/i.test(r.text)) date = addDays(date, -7);
    } else if (preferPast && date > today && !r.start.isCertain('year')) {
      // "3 November" said in January means last November when the user is talking about the past.
      date = `${y - 1}-${pad(m)}-${pad(d)}`;
    }
    // chrono reads "last Tuesday" as the most recent past Tuesday. On a Wednesday people may also mean the
    // Tuesday a week earlier, so keep both readings: retrieval tries both and the model is told which it used.
    let alt: string | undefined;
    if (/\blast\s+(sun|mon|tues|wednes|thurs|fri|satur)day\b/i.test(r.text) && addDays(date, 7) > today)
      alt = addDays(date, -7);
    if (!out.has(date)) out.set(date, { phrase: r.text, date, alt });
  }
  return [...out.values()];
}
