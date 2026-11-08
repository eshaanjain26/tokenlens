const { test } = require('@playwright/test');
const { setCur, open, selectModel, selectModels, send, shot, num, openTool, expect, LIVE } = require('./helpers');

test.describe('extras', () => {
  test('real network smoke: live badge, 400+ models, no errors', async ({ page }) => {
    test.skip(!!process.env.TL_NO_NET, 'network disabled');
    const errs = await open(page, { mode: 'real' });
    await expect.soft(page.locator('#pricing-badge')).toContainText(/Live/);
    const n = await page.evaluate(() => STATE.getModels().length);
    expect.soft(n).toBeGreaterThan(100);
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('hostile model metadata from the API is escaped everywhere', async ({ page }) => {
    const evil = [{ id: "evil/o'neil\"<b>", name: '<img src=x onerror="window.__pwn=1">Evil & Co', context_length: 8000, pricing: { prompt: '0.000001', completion: '0.000002' } },
      { id: 'evil/ok', name: 'Fine', context_length: 8000, pricing: { prompt: '0.000001', completion: '0.000002' } }];
    const errs = await open(page, { mode: 'fixture', modelsBody: JSON.stringify({ data: evil }) });
    await page.fill('#model-search', 'evil');
    await page.locator('#model-list input').first().check({ force: true }).catch(() => {});
    await page.fill('#prompt-input', 'hi');
    await page.click('#send-btn');
    await page.waitForTimeout(400);
    for (const tab of ['analytics', 'benchmarks']) { await page.click(`.tab-btn[data-tab="${tab}"]`); await page.waitForTimeout(200); }
    await page.click('.tab-btn[data-tab="compare"]');
    await page.evaluate(() => USAGE.open());
    await page.keyboard.press('Escape');
    expect.soft(await page.evaluate(() => window.__pwn), 'script via model name').toBeUndefined();
    // apostrophe/quote in id breaks inline onclick (export / toggle)
    const active = await page.evaluate(() => STATE.activeCount());
    test.info().annotations.push({ type: 'hostile-id-selected', description: String(active) });
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('Latest Responses meta currency + usage pill follow currency', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    await send(page, 'Explain something to me in detail.');
    await setCur(page, 'GBP');
    const meta = await page.locator('.op-card-head .occ').first().innerText();
    expect.soft(meta, 'Latest Responses header still in USD after switching to GBP: ' + meta).toMatch(/£/);
    const matrixSw = await page.evaluate(() => { MATRIX.switchView('matrix'); return document.getElementById('matrix-area').innerText; });
    expect.soft(matrixSw).toMatch(/£/);
  });

  test('currency + budget cap + selection persistence across reload (documented)', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await setCur(page, 'INR');
    await page.fill('#budget-input', '5');
    await page.check('#green-only-toggle');
    await page.reload();
    await page.waitForSelector('#model-list .model-item');
    const cur = await page.evaluate(() => CALC.getCurrency());
    const budget = await page.inputValue('#budget-input');
    const green = await page.isChecked('#green-only-toggle');
    test.info().annotations.push({ type: 'persist-after-reload', description: JSON.stringify({ cur, budget, green }) });
    expect.soft(cur, 'currency selection should persist across reload').toBe('INR');
    // header button state must match the model (active class)
    const activeBtn = await page.locator('.cur-btn.active').innerText();
    expect.soft(activeBtn).toBe('₹');
  });

  test('focus-visible outline on interactive controls', async ({ page }) => {
    await open(page, { mode: 'offline' });
    const missing = [];
    for (const sel of ['.tab-btn[data-tab="benchmarks"]', '.cur-btn[data-cur="EUR"]', '#usage-pill', '#tools-btn', '#dark-toggle', '#send-btn', '.pchip[data-prov="openai"]', '#tpl-btn', '.template-btn']) {
      await page.focus(sel);
      await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab');
      const ok = await page.evaluate(s => { const e = document.querySelector(s); const cs = getComputedStyle(e); return (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'; }, sel);
      if (!ok) missing.push(sel);
    }
    expect.soft(missing, 'controls with no visible keyboard focus indicator').toEqual([]);
  });

  test('perf: 3 models x 40 turns stays responsive, DOM bounded', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku', 'google/gemini-2.0-flash']);
    const t0 = Date.now();
    for (let i = 0; i < 40; i++) {
      await page.fill('#prompt-input', 'Turn ' + i + ': what is the next step?');
      await page.evaluate(() => document.getElementById('send-btn').click());
      await page.waitForFunction(() => !document.getElementById('send-btn').disabled);
    }
    const dt = Date.now() - t0;
    const nodes = await page.evaluate(() => document.getElementsByTagName('*').length);
    const ls = await page.evaluate(() => Object.keys(localStorage).map(k => [k, localStorage.getItem(k).length]));
    test.info().annotations.push({ type: 'perf-40-turns', description: `${dt}ms, ${nodes} DOM nodes, localStorage=${JSON.stringify(ls)}` });
    expect.soft(dt, '40 sends x 3 models').toBeLessThan(20000);
    const t1 = Date.now();
    await page.click('.tab-btn[data-tab="analytics"]');
    const dt2 = Date.now() - t1;
    expect.soft(dt2, 'analytics render with 120 turns').toBeLessThan(2000);
    // context bar is capped and cost totals are still sums
    const ok = await page.evaluate(() => { const s = STATE.getSession('openai/gpt-4o'); return Math.abs(s.totalCost - s.turns.reduce((a, t) => a + t.cost, 0)) < 1e-9; });
    expect.soft(ok).toBe(true);
    await shot(page, 'analytics-40-turns');
    // history keeps only 10 and stores whole sessions
    const hist = await page.evaluate(() => JSON.parse(localStorage.getItem('lti_sessions_v1')).length);
    expect.soft(hist).toBeLessThanOrEqual(10);
  });

  test('localStorage quota exhausted does not break send', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await page.evaluate(() => { const o = Storage.prototype.setItem; Storage.prototype.setItem = function () { throw new DOMException('quota', 'QuotaExceededError'); }; });
    await selectModel(page, 'openai/gpt-4o');
    await send(page, 'quota test');
    expect.soft(await page.locator('.turn-card').count()).toBe(1);
    await page.click('#dark-toggle');
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('analytics 2-model/1-turn NaN source', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku']);
    await send(page, 'One turn only.');
    await page.click('.tab-btn[data-tab="analytics"]');
    const src = await page.evaluate(() => [...document.querySelectorAll('#analytics-panel svg')].map((s, i) => { if (!/NaN/.test(s.outerHTML)) return null; let p = s, t = ''; while (p && !t) { p = p.parentElement; const h = p && p.querySelector && p.querySelector('h3,h4,[class*=title]'); if (h) t = h.textContent.trim().slice(0, 50); } return i + ':' + t; }).filter(Boolean));
    test.info().annotations.push({ type: 'analytics-nan-charts', description: src.join(' | ') });
    expect.soft(src, 'charts that render NaN paths with 1 turn').toEqual([]);
  });

  test('toast stacking and auto-dismiss; toast a11y role', async ({ page }) => {
    await open(page, { mode: 'offline' });
    for (let i = 0; i < 6; i++) await page.evaluate(() => APP.shareURL());
    const n = await page.locator('.toast').count();
    test.info().annotations.push({ type: 'toast-count', description: String(n) });
    const roles = await page.locator('.toast').first().getAttribute('role');
    expect.soft(roles).toBe('alert');
    // duplicated role: container is role=status aria-live polite, toasts role=alert -> double announce
    await page.waitForTimeout(3600);
    expect.soft(await page.locator('.toast').count(), 'toasts auto-dismiss').toBe(0);
  });
});
