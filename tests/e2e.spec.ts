import { expect, test, type Page } from '@playwright/test';

const conv = 'demo';

const frames = (turnId: string, prompt: string) => [
  { type: 'context', data: { now: '2026-11-12 10:00', tz: 'Asia/Kolkata', explain: 'No matching earlier turn', noMatch: true, resolved: [] } },
  { type: 'status', text: 'Searching the web once.' },
  {
    type: 'sources',
    sources: [{ id: 1, title: '<img src=x onerror="window.__xss=1">', url: 'https://example.com/changed', published: '2026-11-01' }],
  },
  { type: 'text', delta: `Here is the **answer** for ${prompt} [1]. <img src=x onerror="window.__xss=2">` },
  {
    type: 'claims',
    turnId,
    claims: [{ entity: 'Release', claim: 'Export path changed', as_of: '2026-11-01', check_query: 'release export path' }],
  },
  { type: 'done', turnId, ttftMs: 120, totalMs: 860, searches: 1 },
];

const ndjson = (items: unknown[]) => items.map((item) => JSON.stringify(item)).join('\n') + '\n';

async function openDemo(page: Page) {
  await page.addInitScript((id) => localStorage.setItem('minimi-conv', id), conv);
  await page.goto('/');
  await expect(page.locator('#chatTitle')).toHaveText('Seeded launch notes');
}

test('history, safe rendering, source actions, edit, and regenerate', async ({ page }) => {
  const chatCalls: Array<{ message: string; conv: string }> = [];
  const deleted: string[] = [];
  let chatIndex = 0;

  await page.route('**/api/chat', async (route) => {
    const body = route.request().postDataJSON() as { message: string; conv: string };
    chatCalls.push(body);
    chatIndex++;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
      body: ndjson(frames(`live-${chatIndex}`, body.message)),
    });
  });
  await page.route('**/api/turns/*', async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue();
    deleted.push(route.request().url().split('/').pop() || '');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true }) });
  });
  await page.route('**/api/source-check', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, status: 404, error: 'Not found' }) });
  });

  await openDemo(page);
  await expect(page.locator('.msg.user')).toHaveCount(1);
  await expect(page.locator('.msg.bot').first()).toContainText('release notes mention');

  await page.locator('#q').fill('What changed today?');
  await page.locator('#q').press('Enter');
  const live = page.locator('.msg.bot').last();
  await expect(live).toContainText('Here is the answer for What changed today?');
  await expect(page.locator('#live')).toContainText('Answer ready');
  await expect(live.locator('.claim-list li')).toHaveCount(1);
  await expect(live.locator('.src a').first()).toContainText('<img src=x');
  expect(await page.locator('img').count()).toBe(0);
  expect(await page.evaluate(() => (window as unknown as { __xss?: number }).__xss)).toBeUndefined();

  await live.locator('.src-check').click();
  await expect(live.locator('.src-check')).toHaveText('Unavailable');
  await expect(live.locator('.src-retry')).toBeVisible();

  const firstUser = page.locator('.msg.user').last();
  await firstUser.locator('.msg-action', { hasText: 'Edit' }).click();
  await expect(page.locator('#q')).toHaveValue('What changed today?');
  await page.locator('#q').press('Escape');
  await expect(page.locator('#q')).toHaveValue('');

  await firstUser.locator('.msg-action', { hasText: 'Edit' }).click();
  await page.locator('#q').fill('What changed after the edit?');
  await page.locator('#q').press('Enter');
  await expect.poll(() => chatCalls.length).toBe(2);
  expect(chatCalls[1].message).toBe('What changed after the edit?');
  await expect(page.locator('.msg.user')).toHaveCount(2);
  await expect(page.locator('.msg.user').last()).toContainText('What changed after the edit?');
  expect(deleted).toContain('live-1');

  const secondLive = page.locator('.msg.bot').last();
  await expect(secondLive).toContainText('after the edit');
  await secondLive.locator('.msg-action', { hasText: 'Regenerate' }).click();
  await expect.poll(() => chatCalls.length).toBe(3);
  expect(chatCalls[2].message).toBe('What changed after the edit?');
  expect(deleted).toContain('live-2');
});

test('settings status, timezone select, mobile drawer, and offline banner', async ({ page }) => {
  await openDemo(page);
  await page.locator('#settingsBtn').click();
  await expect(page.locator('#providerSetting')).not.toHaveText('Checking...');
  await expect(page.locator('#modelSetting')).not.toHaveText('Checking...');
  await page.locator('#tzSelect').selectOption('Asia/Tokyo');
  await expect(page.locator('#footZone')).toContainText('Asia/Tokyo');
  await page.locator('#settingsClose').click();

  await page.setViewportSize({ width: 390, height: 800 });
  await page.locator('#menu').click();
  await expect(page.locator('body')).toHaveClass(/nav-open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('body')).not.toHaveClass(/nav-open/);

  await page.context().setOffline(true);
  await expect(page.locator('#offlineBanner')).toBeVisible();
  await page.context().setOffline(false);
  await expect(page.locator('#offlineBanner')).toBeHidden();
});
