const STOPWORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'been', 'being', 'but', 'by', 'can', 'could', 'did', 'do',
  'does', 'for', 'from', 'had', 'has', 'have', 'he', 'her', 'here', 'him', 'his', 'how', 'i', 'if', 'in',
  'into', 'is', 'it', 'its', 'me', 'my', 'no', 'not', 'of', 'on', 'or', 'our', 'out', 'she', 'should',
  'so', 'some', 'such', 'than', 'that', 'the', 'their', 'them', 'then', 'there', 'these', 'they', 'this',
  'those', 'to', 'too', 'up', 'us', 'was', 'we', 'were', 'what', 'when', 'where', 'which', 'who', 'why',
  'will', 'with', 'would', 'you', 'your', 'about', 'after', 'before', 'over', 'under', 'again', 'just',
  'please', 'tell', 'asked', 'said', 'mention', 'mentioned', 'search', 'web', 'internet',
]);

/** Generic words that should never identify a vendor domain on their own. */
const GENERIC_TERMS = new Set([
  'pricing', 'price', 'prices', 'cost', 'costs', 'plan', 'plans', 'free', 'paid', 'version', 'versions',
  'release', 'releases', 'release notes', 'changelog', 'docs', 'documentation', 'official', 'site',
  'latest', 'current', 'currently', 'today', 'now', 'new', 'news', 'update', 'updates', 'updated',
  'changed', 'change', 'changes', 'shipped', 'anything', 'something', 'still', 'since', 'compare',
  'comparison', 'alternative', 'alternatives', 'review', 'reviews', 'best', 'top', 'vs', 'guide',
  'starter', 'professional', 'enterprise', 'growth', 'business', 'advanced', 'essentials', 'basic',
  'plus', 'suite', 'pro', 'startup',
  'blog', 'article', 'details', 'information', 'info', 'available', 'availability', 'support',
]);

const TERM_RE = /[a-z0-9][a-z0-9+.#-]*/gi;

function cleanTerm(term: string) {
  return term.toLowerCase().replace(/^[.#+-]+|[.#+-]+$/g, '');
}

export function queryTerms(text: string, opts: { generic?: boolean } = {}): string[] {
  const out = new Set<string>();
  for (const raw of String(text ?? '').match(TERM_RE) ?? []) {
    const term = cleanTerm(raw);
    if (term.length < 3 || STOPWORDS.has(term)) continue;
    if (opts.generic && GENERIC_TERMS.has(term)) continue;
    out.add(term);
  }
  return [...out];
}

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', ndash: '–', mdash: '—',
  hellip: '…', rsquo: '’', lsquo: '‘', rdquo: '”', ldquo: '“', copy: '©', reg: '®', trade: '™',
};

function codePointEntity(value: string, radix: number, original: string): string {
  const code = Number.parseInt(value, radix);
  return code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : original;
}

export function decodeEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (match, hex: string) => codePointEntity(hex, 16, match))
    .replace(/&#(\d+);/g, (match, dec: string) => codePointEntity(dec, 10, match))
    .replace(/&([a-z]+);/gi, (match, name: string) => ENTITIES[name.toLowerCase()] ?? match);
}

export function htmlToText(html: string): string {
  return decodeEntities(
    String(html ?? '')
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ')
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ')
      .replace(/<template\b[^>]*>[\s\S]*?<\/template>/gi, ' ')
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ')
      .replace(/<!--[\s\S]*?-->/g, ' ')
      .replace(/<(?:br|\/p|\/div|\/li|\/h[1-6]|\/tr|\/section|\/article|\/main|\/header|\/footer)\b[^>]*>/gi, '\n')
      .replace(/<[^>]+>/g, ' '),
  )
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, ' ')
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\u00a0/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function cleanMarkdown(value: string): string {
  return value
    .replace(/!\[[^\]]*\]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]+)\]\((?:[^)]*)\)/g, '$1')
    .replace(/\[([^\]]+)\]\[[^\]]*\]/g, '$1')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/^\s*[-*+]\s+/gm, '')
    .replace(/\|/g, ' ')
    .replace(/\u00a0/g, ' ');
}

export function readableText(value: string): string {
  const raw = String(value ?? '');
  const text = /<\/?[a-z][^>]*>/i.test(raw) ? htmlToText(raw) : decodeEntities(raw);
  return cleanMarkdown(text)
    .replace(/[ \t\f\v]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function clip(value: string, maxChars: number): string {
  const text = value.trim();
  if (text.length <= maxChars) return text;
  const cut = text.slice(0, Math.max(1, maxChars - 1));
  const space = Math.max(cut.lastIndexOf(' '), cut.lastIndexOf('\n'));
  return (space > maxChars * 0.55 ? cut.slice(0, space) : cut).trim() + '…';
}

const PRICE_SIGNAL = /[$€£]\s?\d|\b\d+(?:[.,]\d+)?\s*(?:usd|eur|gbp|per\s+(?:seat|user|month|year)|\/mo|a month|monthly|annually)\b/gi;
const PLAN_WORD = /\b(free|starter|professional|enterprise|basic|plus|growth|business|per seat|per month|billed monthly|billed annually)\b/i;
const NAV_SIGNAL = /(skip to content|log in|sign up|book a demo|get a demo|request a demo|accept (all )?cookies|cookie preferences|sitemap|all rights reserved|privacy policy|terms of service)/i;

function windowFor(block: string, terms: string[], maxChars: number, priceQuery: boolean): string {
  if (block.length <= maxChars) return block;
  const lower = block.toLowerCase();
  let bestAt = 0;
  let bestScore = -Infinity;
  const step = Math.max(80, Math.floor(maxChars / 2));
  for (let start = 0; start < block.length; start += step) {
    const slice = lower.slice(start, start + maxChars);
    let score = 0;
    for (const term of terms) {
      let at = slice.indexOf(term);
      while (at !== -1) { score++; at = slice.indexOf(term, at + term.length); }
    }
    if (priceQuery) {
      score += (slice.match(PRICE_SIGNAL)?.length ?? 0) * 4;
      if (PLAN_WORD.test(slice)) score += 1;
      if (NAV_SIGNAL.test(slice)) score -= 6;
    }
    if (score > bestScore) { bestScore = score; bestAt = start; }
  }
  const start = Math.max(0, Math.min(bestAt, block.length - maxChars));
  const end = Math.min(block.length, start + maxChars);
  const cut = block.slice(start, end);
  return (start > 0 ? '…' : '') + cut.trim() + (end < block.length ? '…' : '');
}

/**
 * Pick the most query-relevant coherent slice of a page, capped for the model's context.
 * It favors whole sentences and neighboring context over raw keyword density.
 */
export function bestExcerpt(value: string, query: string, maxChars: number): string {
  const text = readableText(value);
  if (!text) return '';
  if (text.length <= maxChars) return text;
  const terms = queryTerms(query);
  const priceQuery = /pric|cost|plan|billing|tier|subscription|seat/i.test(query);
  const blocks = text
    .split(/(?<=[.!?])\s+|\n{2,}|\n(?=[A-Z0-9])/)
    .map((b) => b.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

  if (!terms.length || !blocks.length) return clip(blocks[0] ?? text, maxChars);

  const scores = blocks.map((block) => {
    const lower = block.toLowerCase();
    let score = 0;
    if (NAV_SIGNAL.test(block)) score -= 6;
    for (const term of terms) {
      let n = 0;
      let at = lower.indexOf(term);
      while (at !== -1) { n++; at = lower.indexOf(term, at + term.length); }
      if (n) score += 2 + Math.min(2, n - 1) * 0.5;
    }
    if (priceQuery) {
      score += Math.min(12, (block.match(PRICE_SIGNAL)?.length ?? 0) * 3);
      if (PLAN_WORD.test(block)) score += 1;
    }
    return score;
  });
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  if (scores[best] <= 0) return clip(blocks[0] ?? text, maxChars);

  const picked = new Set<number>([best]);
  let size = blocks[best].length;
  for (let distance = 1; distance < blocks.length && size < maxChars; distance++) {
    for (const i of [best + distance, best - distance]) {
      if (i < 0 || i >= blocks.length || picked.has(i)) continue;
      if (size + blocks[i].length + 1 > maxChars) continue;
      picked.add(i);
      size += blocks[i].length + 1;
    }
  }
  const ordered = [...picked].sort((a, b) => a - b).map((i) => blocks[i]);
  const excerpt = windowFor(ordered.join(' '), terms, maxChars, priceQuery);
  return clip(excerpt, maxChars);
}

const TRACKING = /^(utm_|gclid$|fbclid$|mc_cid$|mc_eid$|ref$|ref_src$|source$|campaign$|_hs)/i;

/** URL identity for dedupe: lowercase host, no hash, no tracking params, no trailing slash. */
export function canonicalUrl(raw: string): string {
  try {
    const url = new URL(raw);
    url.hash = '';
    url.hostname = url.hostname.toLowerCase();
    if ((url.protocol === 'https:' && url.port === '443') || (url.protocol === 'http:' && url.port === '80')) url.port = '';
    for (const key of [...url.searchParams.keys()]) if (TRACKING.test(key)) url.searchParams.delete(key);
    if (url.pathname.length > 1 && url.pathname.endsWith('/')) url.pathname = url.pathname.slice(0, -1);
    return url.toString();
  } catch {
    return String(raw ?? '').trim();
  }
}
