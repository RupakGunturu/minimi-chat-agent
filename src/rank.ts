import { queryTerms } from './excerpt.js';
import type { Hit } from './types.js';

const SOCIAL = /(^|\.)(instagram|tiktok|youtube|pinterest|facebook|linkedin|twitter|x)\.com$/;
const PRIMARY_HOSTS = /(^|\.)(github\.com|npmjs\.com|pypi\.org|learn\.microsoft\.com|developer\.mozilla\.org|nodejs\.org|postgresql\.org)$/;
const LOW_VALUE = /(medium\.com|substack\.com|reddit\.com|quora\.com|linkedin\.com|facebook\.com|instagram\.com|tiktok\.com|pinterest\.com|twitter\.com|x\.com)$/;
const COMPARISON = /\b(vs|versus|alternatives?|compare|comparison|top\s*\d+|best\s+\w+|review|reviews|coupon|deals?)\b/i;

export function isSocial(url: string): boolean {
  try { return SOCIAL.test(new URL(url).hostname.toLowerCase()); } catch { return false; }
}

export function isLowValue(url: string, text = ''): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    if (LOW_VALUE.test(host)) return true;
  } catch { /* keep going */ }
  return false;
}

export function isComparison(url: string, title = ''): boolean {
  try {
    const path = new URL(url).pathname.toLowerCase();
    if (/\/compare\/|\/alternatives?\/|\/vs\//.test(path)) return true;
  } catch { /* keep going */ }
  return COMPARISON.test(title);
}

function hostLabel(url: string): string {
  try { return new URL(url).hostname.toLowerCase(); } catch { return ''; }
}

function tokensFor(query = ''): string[] {
  return queryTerms(query, { generic: true });
}

function matchesHost(url: string, query: string): boolean {
  const host = hostLabel(url);
  if (!host) return false;
  const labels = host.split('.');
  const terms = tokensFor(query);
  if (!terms.length) return false;
  return terms.some((term) => labels.some((label) =>
    label === term || (term.length >= 4 && (label.startsWith(term) || (label.length >= 4 && term.startsWith(label))))));
}

function matchesPath(url: string, query: string): boolean {
  let path = '';
  try { path = new URL(url).pathname.toLowerCase(); } catch { return false; }
  return tokensFor(query).some((term) => path.includes(term));
}

/** Prefer the vendor's own pricing/docs/changelog/repo page over blogs and listicles. */
export function rankHit(h: Hit, query = ''): number {
  const host = hostLabel(h.url);
  let path = '';
  try { path = new URL(h.url).pathname.toLowerCase(); } catch { /* keep empty */ }
  const text = `${h.title} ${h.content}`.toLowerCase();
  let score = 0;

  if (matchesHost(h.url, query)) score += 6;
  else if (matchesPath(h.url, query)) score += 3;
  if (/^(docs|developer|developers|support|help)\./.test(host)) score += 3;
  if (PRIMARY_HOSTS.test(host)) score += 2;
  if (host === 'github.com' && tokensFor(query).some((term) => path === `/${term}` || path.startsWith(`/${term}/`))) score += 3;
  if (/(pricing|plans|changelog|release notes|documentation|docs|releases)/.test(text)) score += 2;
  if (/\/pricing|\/plans|\/changelog|\/releases?|\/docs?\b/.test(path)) score += 2;
  if (isComparison(h.url, h.title)) score -= 3;
  if (isLowValue(h.url)) score -= 2;
  if (isSocial(h.url)) score -= 4;
  if (h.published) score += 1;
  if (h.dated) score += 1;
  return score;
}

/** A source the model should trust first for a current value. */
export function isPrimary(h: Hit, query = ''): boolean {
  if (isSocial(h.url) || isComparison(h.url, h.title)) return false;
  if (matchesHost(h.url, query)) return true;
  const host = hostLabel(h.url);
  let path = '';
  try { path = new URL(h.url).pathname.toLowerCase(); } catch { /* keep empty */ }
  if (host === 'github.com') {
    return tokensFor(query).some((term) => path === `/${term}` || path.startsWith(`/${term}/`));
  }
  return PRIMARY_HOSTS.test(host) || /^(docs|developer|developers|support|help)\./.test(host);
}

/** Pages worth spending a fetch on: public, not social, not a comparison/listicle. */
export function isReadable(h: Hit, query = ''): boolean {
  return !isSocial(h.url) && !isComparison(h.url, h.title) && rankHit(h, query) >= 0;
}
