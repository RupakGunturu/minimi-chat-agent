import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { buildContext } from '../src/context.js';
import { bestExcerpt, canonicalUrl, decodeEntities, htmlToText } from '../src/excerpt.js';
import { sanitizeAnswer, validateCitations } from '../src/prompt.js';
import { isPrimary, rankHit } from '../src/rank.js';
import { retrieve } from '../src/retrieve.js';
import { makeSearch } from '../src/search.js';
import { seedTurns } from '../src/seed-data.js';
import { checkPublicUrl } from '../src/source-check.js';
import { Store } from '../src/store.js';
import { resolveDates } from '../src/time.js';
import type { Hit, SearchOpts } from '../src/types.js';
import { guardVerdicts, parseVerdicts } from '../src/verdicts.js';

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

  const friday = new Date('2026-11-13T09:00:00Z');
  assert.equal(resolveDates('On Monday we shortlisted CRM tools', friday, TZ, true)[0].date, '2026-11-09');
  assert.equal(resolveDates('Monday', friday, TZ, true)[0].date, '2026-11-09');
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
  assert.equal(sanitizeAnswer('Answer [1].\n{"checks":[{"entity":"Neon","verdict":"changed"}]}'), 'Answer [1].');
  assert.equal(sanitizeAnswer('Answer [1].\n{"checks":[{"entity":"Neon","verdict":"cha'), 'Answer [1].');

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

test('excerpts and URLs are cleaned for evidence and dedupe', () => {
  const html = '<script>steal()</script><h1>HubSpot Pricing</h1><p>Starter is $20.</p>';
  const text = htmlToText(html);
  assert.match(text, /HubSpot Pricing/);
  assert.ok(!text.includes('steal()'));

  const long = 'Intro paragraph about the weather. '.repeat(12) +
    'HubSpot pricing starts at $20 per seat for Starter. ' +
    'Pipedrive pricing starts at $14 per seat. '.repeat(5);
  const excerpt = bestExcerpt(long, 'HubSpot pricing', 320);
  assert.match(excerpt, /HubSpot pricing/i);
  assert.ok(excerpt.length <= 321, `excerpt too long: ${excerpt.length}`);

  assert.equal(canonicalUrl('https://Example.com/pricing/?utm_source=x&gclid=y#plans'), 'https://example.com/pricing');
  assert.equal(decodeEntities('&#x110000;'), '&#x110000;');
});

test('entity-aware ranking prefers the vendor page over a comparison page', () => {
  const vendor: Hit = {
    title: 'HubSpot Pricing', url: 'https://www.hubspot.com/pricing', content: 'Starter $20 per seat', dated: false,
  };
  const comparison: Hit = {
    title: 'HubSpot vs Pipedrive: pricing comparison', url: 'https://someblog.example/hubspot-vs-pipedrive',
    content: 'HubSpot pricing vs Pipedrive pricing', published: '2026-11-01', dated: false,
  };
  assert.ok(rankHit(vendor, 'HubSpot pricing') > rankHit(comparison, 'HubSpot pricing'));
  assert.equal(isPrimary(vendor, 'HubSpot pricing'), true);
  assert.equal(isPrimary(comparison, 'HubSpot pricing'), false);
});

test('search dedupes URLs and reads the primary result', async () => {
  let reads = 0;
  const official: Hit = {
    title: 'HubSpot Pricing', url: 'https://www.hubspot.com/pricing?utm_source=newsletter',
    content: 'Plans and pricing.', dated: false,
  };
  const duplicate: Hit = {
    title: 'HubSpot Pricing', url: 'https://www.hubspot.com/pricing', content: 'Duplicate.', dated: false,
  };
  const listicle: Hit = {
    title: 'HubSpot vs Pipedrive', url: 'https://someblog.example/hubspot-vs-pipedrive',
    content: 'A comparison.', published: '2026-11-01', dated: false,
  };
  const search = makeSearch({
    provider: async () => [duplicate, official, listicle],
    read: async (url) => {
      reads++;
      assert.match(url, /hubspot\.com/);
      return 'HubSpot Pricing\nStarter costs $20 per seat. Professional costs $890 per month.';
    },
  });
  const hits = await search('HubSpot pricing');
  assert.equal(hits.length, 2);
  assert.equal(reads, 1);
  const primary = hits.find((h) => h.url.includes('hubspot.com'));
  assert.match(primary?.content ?? '', /\$20/);
});

test('claim searches target the vendor domain for current values', async () => {
  const calls: SearchOpts[] = [];
  const search = makeSearch({
    provider: async (_query, opts) => { calls.push(opts); return []; },
    read: async () => '',
  });
  await search('HubSpot Sales Hub Starter pricing', { entity: 'HubSpot Sales Hub Starter', since: '2026-11-09' });
  assert.equal(calls.length, 2);
  assert.equal(calls.find((c) => c.since)?.includeDomains, undefined);
  assert.deepEqual(calls.find((c) => !c.since)?.includeDomains, ['hubspot.com']);
});

test('verdicts are parsed and guarded by the cited evidence', () => {
  const raw = '<verdicts>{"checks":[{"entity":"HubSpot","verdict":"unchanged","source":1},{"entity":"Pipedrive","verdict":"changed","source":2},{"entity":"Zoho","verdict":"maybe","source":99}]}</verdicts>';
  const parsed = parseVerdicts(raw, 2);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[2].verdict, 'unverified');
  assert.equal(parsed[2].source, undefined);

  const bare = parseVerdicts('Answer.\n{"checks":[{"entity":"Neon","verdict":"changed","source":1}]}', 1);
  assert.equal(bare[0].entity, 'Neon');
  assert.equal(bare[0].verdict, 'changed');

  const guarded = guardVerdicts(parsed, (id) => id === 1 ? 'HubSpot pricing is $20.' : 'A pricing page without the entity.');
  assert.equal(guarded[0].verdict, 'unchanged');
  assert.equal(guarded[1].verdict, 'unverified');
  assert.match(guarded[1].note ?? '', /did not mention/);

  const secondary = guardVerdicts(
    [{ entity: 'Pipedrive', verdict: 'changed', source: 1 }],
    () => ({ text: 'Pipedrive pricing changed.', primary: false }),
  );
  assert.equal(secondary[0].verdict, 'unverified');
  assert.match(secondary[0].note ?? '', /secondary/);
});
