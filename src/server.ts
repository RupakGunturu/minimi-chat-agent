import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import Anthropic from '@anthropic-ai/sdk';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { runAgent } from './agent.js';
import { clock, config, validTz } from './config.js';
import { makeSearch } from './search.js';
import { Store } from './store.js';

for (const k of ['ANTHROPIC_API_KEY', 'TAVILY_API_KEY'])
  if (!process.env[k]) console.warn(`⚠ ${k} is not set (copy .env.example to .env)`);

const store = await new Store(config.dataFile).init();
const deps = { store, search: makeSearch(), anthropic: new Anthropic() };
const app = new Hono();

app.post('/api/chat', async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const message = String(body.message ?? '').trim().slice(0, 4000);
  if (!message) return c.json({ error: 'message required' }, 400);
  const conv = String(body.conv || 'default').slice(0, 64);
  const tz = validTz(body.tz) ? String(body.tz) : config.defaultTz;
  const uid = c.req.header('x-user-id') || 'local';

  c.header('Content-Type', 'application/x-ndjson; charset=utf-8');
  c.header('Cache-Control', 'no-cache');
  c.header('X-Accel-Buffering', 'no');
  return stream(c, async (s) => {
    const ac = new AbortController();
    s.onAbort(() => ac.abort());
    const emit = (e: unknown) => { s.write(JSON.stringify(e) + '\n').catch(() => {}); };
    try {
      await runAgent(deps, { uid, conv, message, tz, now: clock() }, emit, ac.signal);
    } catch (e) {
      if (!ac.signal.aborted) emit({ type: 'error', message: (e as Error).message });
    }
  });
});

app.get('/api/history', (c) => {
  const turns = store.conv(c.req.header('x-user-id') || 'local', c.req.query('conv') || 'default');
  return c.json(turns.map(({ id, ts, user, assistant, sources }) => ({ id, ts, user, assistant, sources })));
});

app.use('/*', serveStatic({ root: './public' }));
serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`Agent on http://localhost:${i.port}`));
