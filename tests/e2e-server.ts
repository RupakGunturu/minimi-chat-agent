import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import type OpenAI from 'openai';
import { createApp } from '../src/app.js';
import { Store } from '../src/store.js';
import type { Turn } from '../src/types.js';

const dir = await mkdtemp(join(tmpdir(), 'minimi-e2e-'));
const store = await new Store(join(dir, 'store.json')).init();
const now = '2026-11-12T04:30:00.000Z';
const turn: Turn = {
  id: 'seed-turn',
  uid: 'local',
  conv: 'demo',
  ts: now,
  tz: 'Asia/Kolkata',
  user: 'What changed in the release docs?',
  assistant: 'The release notes mention a new export path [1].',
  claims: [{ entity: 'Release', claim: 'Export path changed', as_of: '2026-11-01', check_query: 'release export path' }],
  sources: [{ id: 1, title: 'Release notes', url: 'https://example.com/release', published: '2026-11-01' }],
};
await store.reset([turn]);
await store.patchConv('local', 'demo', { title: 'Seeded launch notes' });

const app = createApp({ store, llm: {} as OpenAI, search: async () => [] });
const server = serve({ fetch: app.fetch, port: 3100 }, (info) => {
  if ('port' in info) console.log(`e2e server listening on ${info.port}`);
});

const close = () => server.close(() => process.exit(0));
process.on('SIGTERM', close);
process.on('SIGINT', close);
