import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa'];
const REDIRECTS = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;

function privateIpv4(ip: string) {
  const [a, b] = ip.split('.').map(Number);
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
}

function privateIpv6(ip: string) {
  const v = ip.toLowerCase();
  return v === '::1' || v === '::' || v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe8') ||
    v.startsWith('fe9') || v.startsWith('fea') || v.startsWith('feb') || v.startsWith('::ffff:127.') ||
    v.startsWith('::ffff:10.') || v.startsWith('::ffff:192.168.');
}

function blockedLiteral(host: string) {
  const ip = host.replace(/^\[|\]$/g, '');
  const kind = isIP(ip);
  if (kind === 4) return privateIpv4(ip);
  if (kind === 6) return privateIpv6(ip);
  return false;
}

type Validated = { url: URL } | { error: string };

/** Re-validate every redirect target, not just the first URL (public -> private hop guard). */
async function validate(target: string | URL): Promise<Validated> {
  let url: URL;
  try {
    url = target instanceof URL ? new URL(target.toString()) : new URL(String(target));
  } catch {
    return { error: 'invalid url' };
  }
  if (!/^https?:$/.test(url.protocol)) return { error: 'only http and https are allowed' };
  if (url.username || url.password) return { error: 'credentials are not allowed' };
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '');
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix)) || blockedLiteral(host))
    return { error: 'private hosts are not allowed' };
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((a) => (a.family === 4 ? privateIpv4(a.address) : privateIpv6(a.address))))
      return { error: 'private hosts are not allowed' };
  } catch {
    return { error: 'host not found' };
  }
  return { url };
}

async function attempt(url: URL, method: 'HEAD' | 'GET') {
  const response = await fetch(url, {
    method, redirect: 'manual', signal: AbortSignal.timeout(8_000),
    headers: { 'user-agent': 'Minimi source check/1.0', accept: 'text/html,application/xhtml+xml,*/*;q=0.5' },
  });
  if (method === 'GET') await response.body?.cancel();
  return response;
}

export async function checkPublicUrl(raw: string): Promise<{ url: string; ok: boolean; status?: number; error?: string }> {
  const first = await validate(raw);
  if ('error' in first) return { url: '', ok: false, error: first.error };
  let current = first.url;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    let response: Response;
    try {
      response = await attempt(current, 'HEAD');
      if ([400, 403, 405, 501].includes(response.status)) response = await attempt(current, 'GET');
    } catch (e) {
      return { url: current.toString(), ok: false, error: (e as Error).message };
    }

    if (REDIRECTS.has(response.status)) {
      const location = response.headers.get('location');
      if (!location) return { url: current.toString(), ok: false, status: response.status, error: 'redirect without location' };
      let next: URL;
      try {
        next = new URL(location, current);
      } catch {
        return { url: current.toString(), ok: false, status: response.status, error: 'invalid redirect' };
      }
      const checked = await validate(next);
      if ('error' in checked) return { url: next.toString(), ok: false, status: response.status, error: `redirect blocked: ${checked.error}` };
      current = checked.url;
      continue;
    }

    return {
      url: current.toString(), ok: response.ok, status: response.status,
      error: response.ok ? undefined : `HTTP ${response.status}`,
    };
  }

  return { url: current.toString(), ok: false, error: 'too many redirects' };
}
