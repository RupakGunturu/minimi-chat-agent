import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildContext } from '../src/context.js';
import { sanitizeAnswer, validateCitations } from '../src/prompt.js';
import { retrieve } from '../src/retrieve.js';
import { seedTurns } from '../src/seed-data.js';
import { checkPublicUrl } from '../src/source-check.js';
import { Store } from '../src/store.js';
import { resolveDates } from '../src/time.js';

const NOW = new Date('2026-11-11T09:00:00Z');
const TZ = 'Asia/Kolkata';
const dates = (msg: string) => resolveDates(msg, NOW, TZ, true);

test('date resolution is code-owned', () => {
  const tue = dates('Last Tuesday I asked about Postgres');
  assert.equal(tue.length, 1);
  assert.ok(tue[0].date === '2026-11-03' || tue[0].alt === '2026-11-03', 'last Tuesday should offer 3 Nov');

  const nov = dates('What did I ask on 3 November?');
  assert.equal(nov[0].date, '2026-11-03');

  const mon = dates('On Monday we shortlisted CRM tools');
  assert.equal(mon[0].date, '2026-11-09');

  const fri = dates('Last Friday we compared project tools');
  assert.equal(fri[0].date, '2026-11-06');
});

test('retrieval recalls by topic, date, and claim text', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'minimi-core-'));
  const store = await new Store(join(dir, 'store.json')).init();
  await store.reset(seedTurns(NOW, TZ));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const turns = store.all('local');

  assert.equal(retrieve(turns, 'Last Tuesday I asked about Postgres pricing', [], TZ)[0]?.id, 'seed-postgres');
  assert.deepEqual(
    retrieve(turns, 'Last Tuesday I asked about Postgres pricing', ['2026-11-10', '2026-11-03'], TZ).map((x) => x.id),
    ['seed-postgres'],
  );
  assert.deepEqual(
    retrieve(turns, 'What did I ask you then?', ['2026-11-03'], TZ).map((x) => x.id).sort(),
    ['seed-postgres', 'seed-vector'],
  );
  assert.equal(retrieve(turns, 'HubSpot pricing', [], TZ)[0]?.id, 'seed-crm');
  assert.equal(retrieve(turns, 'that database thing', [], TZ)[0]?.id, 'seed-vector');
  assert.deepEqual(retrieve(turns, 'Last Friday we compared project management tools', [], TZ), []);
  assert.deepEqual(retrieve(turns, 'What is the latest Node.js LTS version?', [], TZ), []);
});

test('context prefetches dated claims and refuses a plain question', async (t) => {
  const dir = await mkdtemp(join(tmpdir(), 'minimi-ctx-'));
  const store = await new Store(join(dir, 'store.json')).init();
  await store.reset(seedTurns(NOW, TZ));
  t.after(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const crm = buildContext(store, {
    uid: 'local', conv: 'crm',
    message: 'On Monday we shortlisted 5 CRM tools. Has any pricing changed since?',
    tz: TZ, now: NOW,
  });
  assert.ok(crm.prefetch.length >= 5, `expected 5 CRM claims, got ${crm.prefetch.length}`);

  const plain = buildContext(store, {
    uid: 'local', conv: 'plain', message: 'What is the latest Node.js LTS version?', tz: TZ, now: NOW,
  });
  assert.equal(plain.noMatch, false);
  assert.equal(plain.matches.length, 0);
  assert.equal(plain.prefetch.length, 0);

  const missing = buildContext(store, {
    uid: 'local', conv: 'missing',
    message: 'Last Friday we compared project management tools. Has anything changed since?',
    tz: TZ, now: NOW,
  });
  assert.equal(missing.noMatch, true);
  assert.equal(missing.prefetch.length, 0);
});

test('answers cannot persist control tags or invented citations', () => {
  const dirty = '<history_status>NO_MATCHING_HISTORY</history_status><time>now</time>Answer [1].\n\n\n<verdicts>{"checks":[]}</verdicts>';
  assert.equal(sanitizeAnswer(dirty), 'Answer [1].');

  const out = validateCitations('a [1] b [2, 9] c [0] [3]', 2);
  assert.match(out, /\[1\]/);
  assert.match(out, /\[2\]/);
  assert.ok(!out.includes('9') && !out.includes('[0]') && !out.includes('[3]'));
});

test('source checks reject local and non-http targets before any fetch', async () => {
  for (const url of ['http://127.0.0.1/', 'http://localhost:3000/', 'http://[::1]/', 'file:///etc/passwd', 'http://169.254.169.254/latest/meta-data/']) {
    const res = await checkPublicUrl(url);
    assert.equal(res.ok, false, url);
  }
});
