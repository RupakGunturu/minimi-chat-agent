import { lookup } from 'node:dns/promises';
import { isIP } from 'node:net';

const BLOCKED_HOSTS = new Set(['localhost', 'localhost.localdomain', 'metadata.google.internal']);
const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa'];

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

export async function checkPublicUrl(raw: string): Promise<{ url: string; ok: boolean; status?: number; error?: string }> {
  let url: URL;
  try {
    url = new URL(String(raw));
  } catch {
    return { url: '', ok: false, error: 'invalid url' };
  }
  if (!/^https?:$/.test(url.protocol)) return { url: url.toString(), ok: false, error: 'only http and https are allowed' };
  if (url.username || url.password) return { url: url.toString(), ok: false, error: 'credentials are not allowed' };
  const host = url.hostname.toLowerCase();
  if (BLOCKED_HOSTS.has(host) || BLOCKED_SUFFIXES.some((suffix) => host.endsWith(suffix)) || blockedLiteral(host))
    return { url: url.toString(), ok: false, error: 'private hosts are not allowed' };
  try {
    const addresses = await lookup(host, { all: true, verbatim: true });
    if (!addresses.length || addresses.some((a) => (a.family === 4 ? privateIpv4(a.address) : privateIpv6(a.address))))
      return { url: url.toString(), ok: false, error: 'private hosts are not allowed' };
  } catch {
    return { url: url.toString(), ok: false, error: 'host not found' };
  }

  const attempt = async (method: 'HEAD' | 'GET') => {
    const response = await fetch(url, {
      method, redirect: 'follow', signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': 'Minimi source check/1.0', accept: 'text/html,application/xhtml+xml,*/*;q=0.5' },
    });
    if (method === 'GET') await response.body?.cancel();
    return response;
  };
  try {
    let response = await attempt('HEAD');
    if (response.status === 405 || response.status === 403 || response.status === 501) response = await attempt('GET');
    return { url: url.toString(), ok: response.ok, status: response.status, error: response.ok ? undefined : `HTTP ${response.status}` };
  } catch (e) {
    return { url: url.toString(), ok: false, error: (e as Error).message };
  }
}
