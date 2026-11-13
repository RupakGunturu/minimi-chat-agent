import { config } from './config.js';
import { canonicalUrl, htmlToText } from './excerpt.js';
import { validateUrl } from './source-check.js';

export type PageReader = (url: string) => Promise<string | null>;

const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 4;
const ALLOWED = /^(text\/html|application\/xhtml\+xml|text\/plain|text\/markdown)/i;

async function readBody(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) {
        chunks.push(value.subarray(0, Math.max(0, value.byteLength - (total - maxBytes))));
        await reader.cancel();
        break;
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return new TextDecoder('utf-8', { fatal: false }).decode(Buffer.concat(chunks.map((c) => Buffer.from(c))));
}

/** Fetch a validated public page and reduce it to readable text. Never throws. */
async function fetchPage(raw: string): Promise<string | null> {
  const first = await validateUrl(raw);
  if ('error' in first) return null;
  let current = first.url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await fetch(current, {
        redirect: 'manual',
        signal: AbortSignal.timeout(config.fetchTimeoutMs),
        headers: {
          'user-agent': 'Minimi reader/1.0 (+local research assistant)',
          accept: 'text/html,application/xhtml+xml,text/plain,text/markdown;q=0.9,*/*;q=0.1',
        },
      });
    } catch {
      return null;
    }

    if (REDIRECTS.has(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) return null;
      let next: URL;
      try { next = new URL(location, current); } catch { return null; }
      const checked = await validateUrl(next);
      if ('error' in checked) return null;
      current = checked.url;
      continue;
    }

    if (!response.ok) {
      await response.body?.cancel();
      return null;
    }
    const type = response.headers.get('content-type') ?? '';
    if (type && !ALLOWED.test(type)) {
      await response.body?.cancel();
      return null;
    }
    const body = await readBody(response, config.maxPageBytes);
    const text = /html|xhtml/i.test(type) ? htmlToText(body) : body.replace(/\s+/g, ' ').trim();
    return text.length >= 80 ? text : null;
  }
  return null;
}

/** Cache + in-flight dedupe keyed by canonical URL, with a global fetch limit. */
export function makePageReader(): PageReader {
  const cache = new Map<string, { at: number; p: Promise<string | null> }>();
  const maxConcurrent = 4;
  let active = 0;
  const queue: (() => void)[] = [];
  const acquire = () => new Promise<void>((resolve) => {
    if (active < maxConcurrent) { active++; resolve(); }
    else queue.push(() => { active++; resolve(); });
  });
  const release = () => {
    active--;
    queue.shift()?.();
  };
  const limited = async (key: string) => {
    await acquire();
    try { return await fetchPage(key); } finally { release(); }
  };

  return (url: string) => {
    const key = canonicalUrl(url);
    const hit = cache.get(key);
    if (hit && Date.now() - hit.at < config.pageCacheTtlMs) return hit.p;
    const p = limited(key);
    cache.set(key, { at: Date.now(), p });
    p.then((text) => { if (text === null) cache.delete(key); }).catch(() => cache.delete(key));
    return p;
  };
}
