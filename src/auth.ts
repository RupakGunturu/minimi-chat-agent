import { config } from './config.js';

const clean = (value: string | undefined) => (value || '').trim().replace(/[^\w@.:-]/g, '').slice(0, 64);

export function userId(header: (name: string) => string | undefined): string {
  return clean(header(config.authHeader)) || 'local';
}

export function rateKey(uid: string, ip: string | undefined): string {
  return `${uid}|${clean(ip) || 'unknown'}`;
}
