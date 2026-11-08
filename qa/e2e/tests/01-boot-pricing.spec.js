const { test } = require('@playwright/test');
const { setCur, open, selectModel, shot, expect, URL } = require('./helpers');

test.describe('boot, onboarding, pricing paths', () => {
  test('onboarding shows first run, dismisses, persists', async ({ page }) => {
    await open(page, { onboarded: false });
    const ov = page.locator('#onboarding-overlay');
    await expect.soft(ov).toBeVisible();
    await shot(page, 'onboarding-first-run');
    await page.keyboard.press('Escape');
    await expect.soft(ov, 'Esc should close the welcome modal').toBeHidden();
    await page.click('.onboard-start-btn');
    await expect.soft(ov).toBeHidden();
    await page.reload();
    await page.waitForTimeout(800);
    await expect.soft(ov, 'onboarding must not reappear after dismissal').toBeHidden();
  });

  test('onboarding focus is trapped / initial focus inside dialog', async ({ page }) => {
    await open(page, { onboarded: false });
    const inside = await page.evaluate(() => document.getElementById('onboarding-overlay').contains(document.activeElement));
    expect.soft(inside, 'focus should move into the welcome dialog on open').toBe(true);
  });

  test('fixture ("live") path: badge, toast, no console errors', async ({ page }) => {
    const errs = await open(page, { mode: 'fixture' });
    await expect.soft(page.locator('#pricing-badge')).toContainText('Live');
    const toast = await page.locator('#toast-container').innerText();
    expect.soft(toast).toMatch(/models loaded live from OpenRouter/);
    expect.soft(errs, errs.join('\n')).toEqual([]);
    const cache = await page.evaluate(() => localStorage.getItem('tl_pricing_cache_v1'));
    expect.soft(cache, 'pricing cache written').toBeTruthy();
    expect.soft(cache.length, 'cache size chars').toBeGreaterThan(1000);
  });

  test('offline fallback path: badge + toast must say offline', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await expect.soft(page.locator('#pricing-badge')).toContainText('Offline');
    const toast = await page.locator('#toast-container').innerText();
    expect.soft(toast, 'offline load must NOT claim "live from OpenRouter"').not.toMatch(/live from OpenRouter/);
    const n = await page.locator('#model-list .model-item').count();
    expect.soft(n).toBeGreaterThan(20);
    expect.soft(errs, errs.join('\n')).toEqual([]);
    await shot(page, 'offline-fallback');
  });

  test('fresh cache is served without network, badge says Cached', async ({ page }) => {
    await open(page, { mode: 'fixture' });
    const calls = [];
    page.on('request', r => { if (r.url().includes('/api/v1/models')) calls.push(r.url()); });
    await page.reload();
    await page.waitForSelector('#model-list .model-item');
    await expect.soft(page.locator('#pricing-badge')).toContainText('Cached');
    expect.soft(calls.length, 'no network call when cache is fresh').toBe(0);
  });

  test('stale cache (>24h) triggers refetch; stale cache used when offline', async ({ page, context }) => {
    // seed stale cache with a recognisable single model
    const stale = JSON.stringify({ ts: Date.now() - 30 * 3600 * 1000, models: [{ id: 'acme/stale-model', name: 'Stale Model', context_length: 8000, pricing: { prompt: '0.000001', completion: '0.000002' } }] });
    await open(page, { mode: 'offline', storage: { tl_pricing_cache_v1: stale } });
    await expect.soft(page.locator('#pricing-badge')).toContainText('Cached (offline)');
    await expect.soft(page.locator('#model-list')).toContainText('Stale Model');
  });

  test('corrupt cache JSON falls back gracefully', async ({ page }) => {
    const errs = await open(page, { mode: 'offline', storage: { tl_pricing_cache_v1: '{not json' } });
    await expect.soft(page.locator('#pricing-badge')).toContainText('Offline');
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('controls work while /models is still loading (slow network)', async ({ page }) => {
    await open(page, { mode: 'slow', delay: 4000, wait: false });
    await page.waitForTimeout(500);
    const welcomeShown = await page.evaluate(() => getComputedStyle(document.getElementById('onboarding-overlay')).display !== 'none' && !document.getElementById('onboarding-overlay').classList.contains('hidden'));
    expect.soft(welcomeShown, 'returning user (already onboarded) must not see the welcome modal while pricing loads').toBe(false);
    await page.evaluate(() => document.querySelector('.tab-btn[data-tab="howitworks"]').click());
    const active = await page.evaluate(() => document.getElementById('howitworks-panel').classList.contains('active'));
    expect.soft(active, 'tab click must work before pricing fetch resolves (listeners are attached after await in APP.init)').toBe(true);
    await setCur(page, 'EUR');
    const cur = await page.evaluate(() => CALC.getCurrency());
    expect.soft(cur, 'currency toggle before fetch resolves').toBe('EUR');
    await shot(page, 'slow-network-controls');
  });

  test('negative-priced router models (openrouter/auto, price -1)', async ({ page }) => {
    await open(page, { mode: 'fixture' });
    await selectModel(page, 'openrouter/auto');
    await page.fill('#prompt-input', 'hello world');
    await page.click('#send-btn');
    await page.waitForTimeout(400);
    const cost = await page.evaluate(() => STATE.globalTotals().cost);
    expect.soft(cost, 'cost must never be negative').toBeGreaterThanOrEqual(0);
    const txt = await page.locator('#sess-cost').innerText();
    expect.soft(txt).not.toMatch(/-/);
    await shot(page, 'negative-price-model');
  });

  test('about modal opens and closes with Esc', async ({ page }) => {
    await open(page);
    await page.click('#tools-btn');
    await page.locator('.tools-item', { hasText: 'About' }).click();
    await expect.soft(page.locator('#about-overlay')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect.soft(page.locator('#about-overlay')).toBeHidden();
  });

  test('about copy: model count matches fallback list', async ({ page }) => {
    await open(page, { mode: 'offline' });
    const n = await page.evaluate(() => DATA.FALLBACK_MODELS.length);
    const claim = (await page.locator('#about-modal').innerText()).match(/(\d+) curated/);
    expect.soft(claim && +claim[1], `About says ${claim && claim[1]} curated models, fallback has ${n}`).toBe(n);
  });
});
