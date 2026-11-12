import { serve } from '@hono/node-server';
import { serveStatic } from '@hono/node-server/serve-static';
import OpenAI from 'openai';
import { Hono } from 'hono';
import { stream } from 'hono/streaming';
import { runAgent } from './agent.js';
import { clock, config, validTz } from './config.js';
import { makeSearch } from './search.js';
import { Store } from './store.js';

for (const k of ['GEMINI_API_KEY', 'TAVILY_API_KEY'])
  if (!process.env[k]) console.warn(`⚠ ${k} is not set (copy .env.example to .env)`);

const store = await new Store(config.dataFile).init();
const llm = new OpenAI({ apiKey: config.llmApiKey || 'not-set', baseURL: config.llmBaseUrl });
const deps = { store, search: makeSearch(), llm };
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
      const result = await runAgent(deps, { uid, conv, message, tz, now: clock() }, emit, ac.signal);
      const claims = await result.claimsDone.catch(() => []);
      if (claims.length) emit({ type: 'claims', turnId: result.turn.id, claims });
    } catch (e) {
      if (!ac.signal.aborted) emit({ type: 'error', message: (e as Error).message });
    }
  });
});

app.patch('/api/conversations/:id', async (c) => {
  const uid = c.req.header('x-user-id') || 'local';
  const body = await c.req.json().catch(() => ({}));
  const patch: { title?: string; pinned?: boolean; archived?: boolean } = {};
  if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 120);
  if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;
  if (typeof body.archived === 'boolean') patch.archived = body.archived;
  if (!Object.keys(patch).length) return c.json({ error: 'nothing to update' }, 400);
  await store.patchConv(uid, c.req.param('id'), patch);
  return c.json({ ok: true });
});

app.delete('/api/conversations', async (c) => {
  await store.clear(c.req.header('x-user-id') || 'local');
  return c.json({ ok: true });
});

app.delete('/api/conversations/:id', async (c) => {
  await store.deleteConv(c.req.header('x-user-id') || 'local', c.req.param('id'));
  return c.json({ ok: true });
});

app.delete('/api/turns/:id', async (c) => {
  const removed = await store.deleteTurn(c.req.header('x-user-id') || 'local', c.req.param('id'));
  return removed ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
});

app.get('/api/history', (c) => {
  const turns = store.conv(c.req.header('x-user-id') || 'local', c.req.query('conv') || 'default');
  return c.json(turns.map(({ id, ts, user, assistant, sources, claims }) => ({ id, ts, user, assistant, sources, claims })));
});

app.get('/api/conversations', (c) => {
  const uid = c.req.header('x-user-id') || 'local';
  return c.json(store.conversations(uid));
});

app.use('/*', serveStatic({ root: './public' }));
const server = serve({ fetch: app.fetch, port: config.port }, (i) => console.log(`Agent on http://localhost:${i.port}`));

server.on('error', (err: NodeJS.ErrnoException) => {
  if (err.code === 'EADDRINUSE') {
    console.error(
      `Port ${config.port} is already in use by another process.\n` +
      `Stop it, or set PORT to a free port in .env (e.g. PORT=3001) and run again.`,
    );
    process.exit(1);
  }
  throw err;
});
