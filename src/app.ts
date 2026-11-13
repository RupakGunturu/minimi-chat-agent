import { randomUUID } from 'node:crypto';
import OpenAI from 'openai';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';
import { serveStatic } from '@hono/node-server/serve-static';
import { stream } from 'hono/streaming';
import { runAgent } from './agent.js';
import { rateKey, userId } from './auth.js';
import { clock, config, validTz } from './config.js';
import { RateLimiter } from './limits.js';
import { seedTurns } from './seed-data.js';
import { checkPublicUrl } from './source-check.js';
import type { Store } from './store.js';
import type { SearchFn } from './types.js';

export interface AppDeps { store: Store; llm: OpenAI; search: SearchFn }

type AppEnv = { Variables: { requestId: string } };

export function createApp(deps: AppDeps) {
  const app = new Hono<AppEnv>();
  const apiLimiter = new RateLimiter();
  const chatLimiter = new RateLimiter();
  let apiHits = 0;
  let chatHits = 0;

  app.use('*', async (c, next) => {
    const id = c.req.header('x-request-id') || randomUUID();
    c.set('requestId', id);
    c.header('X-Request-Id', id);
    await next();
  });

  app.use('/api/*', async (c, next) => {
    if (++apiHits % 200 === 0) apiLimiter.prune();
    const uid = userId((name) => c.req.header(name));
    const result = apiLimiter.hit(rateKey(uid, c.req.header('x-forwarded-for')), config.apiRateLimit, config.apiRateWindowMs);
    c.header('X-RateLimit-Limit', String(config.apiRateLimit));
    c.header('X-RateLimit-Remaining', String(result.remaining));
    if (!result.ok) {
      c.header('Retry-After', String(Math.ceil(result.retryAfterMs / 1000)));
      return c.json({ error: 'too many requests', requestId: String(c.get('requestId')) }, 429);
    }
    await next();
  });

  app.use('/api/*', bodyLimit({
    maxSize: config.maxBodyBytes,
    onError: (c) => c.json({ error: 'request body too large', requestId: String(c.get('requestId')) }, 413),
  }));

  app.post('/api/chat', async (c) => {
    const requestId = String(c.get('requestId'));
    const uid = userId((name) => c.req.header(name));
    const limited = chatLimiter.hit(rateKey(uid, c.req.header('x-forwarded-for')), config.chatRateLimit, config.chatRateWindowMs);
    c.header('X-RateLimit-Limit', String(config.chatRateLimit));
    c.header('X-RateLimit-Remaining', String(limited.remaining));
    if (!limited.ok) {
      c.header('Retry-After', String(Math.ceil(limited.retryAfterMs / 1000)));
      return c.json({ error: 'too many chat requests', requestId }, 429);
    }

    const body = await c.req.json().catch(() => ({}));
    const message = String(body.message ?? '').trim().slice(0, config.maxMessageChars);
    if (!message) return c.json({ error: 'message required', requestId }, 400);
    if (!config.llmApiKey)
      return c.json({ error: 'Model key missing. Set GEMINI_API_KEY (or LLM_API_KEY) in .env and restart.', requestId }, 503);
    if (++chatHits % 100 === 0) chatLimiter.prune();
    const conv = String(body.conv || 'default').slice(0, 64);
    const tz = validTz(body.tz) ? String(body.tz) : config.defaultTz;
    if (deps.store.conv(uid, conv).length >= config.maxTurnsPerConv)
      return c.json({ error: 'conversation turn limit reached; start a new chat', requestId }, 409);

    c.header('Content-Type', 'application/x-ndjson; charset=utf-8');
    c.header('Cache-Control', 'no-cache');
    c.header('X-Accel-Buffering', 'no');
    return stream(c, async (s) => {
      const ac = new AbortController();
      s.onAbort(() => ac.abort());
      const emit = (e: unknown) => { s.write(JSON.stringify(e) + '\n').catch(() => {}); };
      try {
        if (!process.env.TAVILY_API_KEY)
          emit({ type: 'status', text: 'Web search key is missing; this answer cannot be checked against sources.' });
        const result = await runAgent(deps, { uid, conv, message, tz, now: clock() }, emit, ac.signal);
        const claims = await result.claimsDone.catch(() => []);
        if (claims.length) emit({ type: 'claims', turnId: result.turn.id, claims });
      } catch (e) {
        if (!ac.signal.aborted) {
          console.error(JSON.stringify({
            level: 'error', requestId, route: '/api/chat', uid, conv, message: (e as Error).message,
          }));
          emit({ type: 'error', message: 'The answer could not be completed. Please retry.', requestId });
        }
      }
    });
  });

  app.patch('/api/conversations/:id', async (c) => {
    const uid = userId((name) => c.req.header(name));
    const body = await c.req.json().catch(() => ({}));
    const patch: { title?: string; pinned?: boolean; archived?: boolean } = {};
    if (typeof body.title === 'string') patch.title = body.title.trim().slice(0, 120);
    if (typeof body.pinned === 'boolean') patch.pinned = body.pinned;
    if (typeof body.archived === 'boolean') patch.archived = body.archived;
    if (!Object.keys(patch).length) return c.json({ error: 'nothing to update' }, 400);
    await deps.store.patchConv(uid, c.req.param('id'), patch);
    return c.json({ ok: true });
  });

  app.delete('/api/conversations', async (c) => {
    await deps.store.clear(userId((name) => c.req.header(name)));
    return c.json({ ok: true });
  });

  app.delete('/api/conversations/:id', async (c) => {
    await deps.store.deleteConv(userId((name) => c.req.header(name)), c.req.param('id'));
    return c.json({ ok: true });
  });

  app.delete('/api/turns/:id', async (c) => {
    const removed = await deps.store.deleteTurn(userId((name) => c.req.header(name)), c.req.param('id'));
    return removed ? c.json({ ok: true }) : c.json({ error: 'not found' }, 404);
  });

  app.get('/api/history', (c) => {
    const turns = deps.store.conv(userId((name) => c.req.header(name)), c.req.query('conv') || 'default');
    return c.json(turns.map(({ id, ts, user, assistant, sources, claims, verdicts }) => ({ id, ts, user, assistant, sources, claims, verdicts })));
  });

  app.get('/api/conversations', (c) => {
    return c.json(deps.store.conversations(userId((name) => c.req.header(name))));
  });

  app.get('/api/status', (c) => {
    let provider = config.llmBaseUrl;
    try { provider = new URL(config.llmBaseUrl).hostname; } catch {}
    return c.json({
      provider,
      models: { main: config.modelMain, fast: config.modelFast },
      search: 'Tavily',
      searchMode: {
        depth: config.searchDepth,
        results: config.searchResults,
        readPages: config.readPages,
        pagesPerQuery: config.readPagesPerQuery,
      },
      configured: { model: !!config.llmApiKey, search: !!process.env.TAVILY_API_KEY },
      auth: config.authHeader === 'x-user-id' ? 'single-user seam' : 'header seam',
      limits: {
        messageChars: config.maxMessageChars,
        turnsPerConversation: config.maxTurnsPerConv,
        chatPerMinute: config.chatRateLimit,
      },
    });
  });

  app.post('/api/demo/seed', async (c) => {
    const uid = userId((name) => c.req.header(name));
    const body = await c.req.json().catch(() => ({}));
    const tz = validTz(body.tz) ? String(body.tz) : config.defaultTz;
    const added = await deps.store.addMany(seedTurns(clock(), tz, uid));
    return c.json({ ok: true, added, conversations: deps.store.conversations(uid) });
  });

  app.post('/api/source-check', async (c) => {
    const body = await c.req.json().catch(() => ({}));
    if (typeof body.url !== 'string') return c.json({ error: 'url required' }, 400);
    return c.json(await checkPublicUrl(body.url));
  });

  app.onError((err, c) => {
    console.error(JSON.stringify({
      level: 'error', requestId: String(c.get('requestId')), method: c.req.method,
      path: new URL(c.req.url).pathname, message: err.message,
    }));
    return c.json({ error: 'internal server error', requestId: String(c.get('requestId')) }, 500);
  });

  app.use('/*', serveStatic({ root: './public' }));
  return app;
}
