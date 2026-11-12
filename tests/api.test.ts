import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serve } from '@hono/node-server';
import test from 'node:test';
import type OpenAI from 'openai';
import { createApp } from '../src/app.js';
import { config } from '../src/config.js';
import { seedTurns } from '../src/seed-data.js';
import { Store } from '../src/store.js';

test('api integration', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'minimi-api-'));
  const store = await new Store(join(dir, 'store.json')).init();
  await store.reset(seedTurns(new Date('2026-11-11T09:00:00Z'), 'Asia/Kolkata'));
  config.chatRateLimit = 2;
  config.maxTurnsPerConv = 1;
  const app = createApp({
    store,
    llm: {} as OpenAI,
    search: async () => [],
  });
  const server = await new Promise<ReturnType<typeof serve>>((resolve) => {
    const s = serve({ fetch: app.fetch, port: 0 }, () => resolve(s));
  });
  const address = server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  const url = `http://127.0.0.1:${port}`;
  const headers = { 'x-user-id': 'local', 'content-type': 'application/json' };

  try {
    await t.test('status exposes configuration without secrets', async () => {
      const r = await fetch(`${url}/api/status`);
      assert.equal(r.status, 200);
      assert.ok(r.headers.get('x-request-id'));
      const body = await r.json();
      assert.ok(body.provider);
      assert.ok(body.models.main);
      assert.ok(body.models.fast);
      assert.equal(body.search, 'Tavily');
      assert.equal(JSON.stringify(body).includes(config.llmApiKey) && !!config.llmApiKey, false);
      assert.ok(body.limits.turnsPerConversation);
    });

    await t.test('history and conversations are isolated by the auth seam', async () => {
      const list = await (await fetch(`${url}/api/conversations`, { headers })).json();
      assert.ok(Array.isArray(list) && list.length > 0);
      const conv = list[0].id;
      const hist = await (await fetch(`${url}/api/history?conv=${encodeURIComponent(conv)}`, { headers })).json();
      assert.ok(Array.isArray(hist) && hist.length > 0);
      assert.ok(hist[0].id && hist[0].user && !hist[0].uid);
      const other = await (await fetch(`${url}/api/conversations`, { headers: { 'x-user-id': 'other' } })).json();
      assert.deepEqual(other, []);
    });

    await t.test('conversation metadata and deletion routes work', async () => {
      const list = await (await fetch(`${url}/api/conversations`, { headers })).json();
      const id = list[0].id;
      let r = await fetch(`${url}/api/conversations/${encodeURIComponent(id)}`, {
        method: 'PATCH', headers, body: JSON.stringify({ title: 'Renamed chat', pinned: true }),
      });
      assert.equal(r.status, 200);
      const renamed = await (await fetch(`${url}/api/conversations`, { headers })).json();
      assert.equal(renamed.find((c: { id: string }) => c.id === id).title, 'Renamed chat');
      r = await fetch(`${url}/api/conversations/${encodeURIComponent(id)}`, { method: 'DELETE', headers });
      assert.equal(r.status, 200);
      const remaining = await (await fetch(`${url}/api/conversations`, { headers })).json();
      assert.equal(remaining.some((c: { id: string }) => c.id === id), false);
    });

    await t.test('turn deletion returns 404 after the first delete', async () => {
      const turn = store.all('local')[0];
      assert.ok(turn);
      assert.equal((await fetch(`${url}/api/turns/${encodeURIComponent(turn.id)}`, { method: 'DELETE', headers })).status, 200);
      assert.equal((await fetch(`${url}/api/turns/${encodeURIComponent(turn.id)}`, { method: 'DELETE', headers })).status, 404);
    });

    await t.test('source checks reject local and non-http targets', async () => {
      for (const target of ['http://127.0.0.1/', 'http://localhost/', 'file:///etc/passwd', 'http://10.0.0.1/']) {
        const r = await fetch(`${url}/api/source-check`, { method: 'POST', headers, body: JSON.stringify({ url: target }) });
        assert.equal(r.status, 200);
        const body = await r.json();
        assert.equal(body.ok, false, target);
      }
    });

    await t.test('body size, chat rate limit, turn cap, and error ids are enforced', async () => {
      const large = await fetch(`${url}/api/source-check`, {
        method: 'POST', headers, body: JSON.stringify({ url: 'https://example.com/', pad: 'x'.repeat(config.maxBodyBytes) }),
      });
      assert.equal(large.status, 413);

      const c1 = await fetch(`${url}/api/chat`, { method: 'POST', headers, body: JSON.stringify({ message: '' }) });
      assert.equal(c1.status, 400);
      assert.ok(c1.headers.get('x-request-id'));
      for (let i = 0; i < 2; i++) {
        const r = await fetch(`${url}/api/chat`, { method: 'POST', headers: { ...headers, 'x-user-id': 'rate-test' }, body: JSON.stringify({ message: '' }) });
        assert.equal(r.status, 400);
      }
      const c3 = await fetch(`${url}/api/chat`, { method: 'POST', headers: { ...headers, 'x-user-id': 'rate-test' }, body: JSON.stringify({ message: '' }) });
      assert.equal(c3.status, 429);

      const source = store.all('local')[0];
      assert.ok(source);
      await store.add({ ...source, id: 'cap-turn', uid: 'cap-test', user: 'seeded', assistant: 'seeded' });
      const capped = await fetch(`${url}/api/chat`, {
        method: 'POST', headers: { ...headers, 'x-user-id': 'cap-test' },
        body: JSON.stringify({ message: 'hello', conv: source.conv }),
      });
      assert.equal(capped.status, 409);
    });
  } finally {
    await new Promise<void>((resolve, reject) => server.close((e) => (e ? reject(e) : resolve())));
    await rm(dir, { recursive: true, force: true });
  }
});
