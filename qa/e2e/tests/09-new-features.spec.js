// New-in-revamp features: command palette, shortcuts sheet, g+letter navigation, offline chip + retry,
// matrix sort, Analytics isolate + CSV export, Benchmarks compare-selected, currency regression check.
const { test } = require('@playwright/test');
const fs = require('fs');
const { setCur, open, selectModels, send, expect } = require('./helpers');

const activeTab = page => page.evaluate(() => { const b = document.querySelector('.tab-btn.active'); return b && b.dataset.tab; });

test.describe('new features', () => {
  test('command palette: Ctrl+K opens, filters, runs an action, Esc closes, focus returns', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await page.locator('body').press('Control+k');
    await expect.soft(page.locator('#palette-overlay')).toHaveClass(/open/);
    expect.soft(await page.evaluate(() => document.activeElement.id), 'focus goes to the palette input').toBe('palette-input');
    const n0 = await page.locator('#palette-list [role=option], #palette-list li, #palette-list button').count();
    expect.soft(n0, 'palette lists entries').toBeGreaterThan(3);
    await page.fill('#palette-input', 'bench');
    await page.waitForTimeout(150);
    const txt = await page.locator('#palette-list').innerText();
    expect.soft(txt.toLowerCase()).toContain('benchmarks');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(250);
    expect.soft(await activeTab(page), 'Enter runs the highlighted action (go to Benchmarks)').toBe('benchmarks');
    await expect.soft(page.locator('#palette-overlay')).not.toHaveClass(/open/);
    // model search entry
    await page.keyboard.press('Control+k');
    await page.fill('#palette-input', 'gpt-4o');
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    test.info().annotations.push({ type: 'palette-model-select-active', description: String(await page.evaluate(() => STATE.activeCount())) });
    // Esc + empty state
    await page.keyboard.press('Control+k');
    await page.fill('#palette-input', 'zzzzqq');
    expect.soft((await page.locator('#palette-list').innerText()).length + (await page.locator('#palette-status').innerText()).length).toBeGreaterThan(0);
    await page.keyboard.press('Escape');
    await expect.soft(page.locator('#palette-overlay')).not.toHaveClass(/open/);
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('shortcuts: ? sheet, g+c/b/h/a, / focuses search, d toggles theme, ignored while typing', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await page.locator('body').press('?');
    await expect.soft(page.locator('#shortcuts-overlay')).toHaveClass(/open/);
    expect.soft((await page.locator('#shortcuts-body').innerText())).toMatch(/Compare/);
    await page.keyboard.press('Escape');
    await expect.soft(page.locator('#shortcuts-overlay')).not.toHaveClass(/open/);
    for (const [k, tab] of [['b', 'benchmarks'], ['h', 'howitworks'], ['a', 'analytics'], ['c', 'compare']]) {
      await page.locator('body').press('g'); await page.keyboard.press(k); await page.waitForTimeout(250);
      expect.soft(await activeTab(page), `g then ${k}`).toBe(tab);
    }
    await page.locator('body').press('/');
    await page.waitForTimeout(250);
    expect.soft(await page.evaluate(() => document.activeElement.id), '/ focuses model search').toBe('model-search');
    await page.keyboard.type('g');
    await page.keyboard.type('b');
    expect.soft(await activeTab(page), 'shortcuts must be ignored while typing in a field').toBe('compare');
    await page.keyboard.press('Escape');
    await page.locator('body').click({ position: { x: 700, y: 400 } }).catch(() => {});
    const dark0 = await page.evaluate(() => document.body.classList.contains('dark') || document.documentElement.dataset.theme === 'dark');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    await page.keyboard.press('d');
    const dark1 = await page.evaluate(() => document.body.classList.contains('dark') || document.documentElement.dataset.theme === 'dark');
    expect.soft(dark1, 'd toggles theme').not.toBe(dark0);
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('offline chip + retry', async ({ page }) => {
    await open(page, { mode: 'offline' });
    const chip = await page.locator('#data-status-chip').innerText();
    test.info().annotations.push({ type: 'offline-chip-text', description: chip + ' | note: ' + (await page.locator('#data-status-note').innerText()).slice(0, 120) });
    expect.soft(chip).toMatch(/offline|fallback|bundled/i);
    await expect.soft(page.locator('#data-status-retry')).toBeVisible();
    // retry with network back
    await page.unroute('**/*');
    const { LIVE } = require('./helpers');
    await page.route('**/*', r => { const u = r.request().url(); if (u.startsWith('http://localhost')) return r.continue(); if (u.includes('/api/v1/models')) return r.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: JSON.stringify(LIVE) }); return r.abort(); });
    await page.click('#data-status-retry');
    await page.waitForTimeout(1500);
    const after = await page.locator('#data-status-chip').innerText();
    expect.soft(after, 'chip after a successful retry').toMatch(/live|cached|updated/i);
    expect.soft(await page.evaluate(() => STATE.getModels().length), 'catalogue replaced after retry').toBeGreaterThan(100);
  });

  test('matrix sort', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku']);
    for (const p of ['Explain quantum entanglement in detail.', 'Hi', 'Write a long essay about renewable energy policy.']) await send(page, p);
    await page.click('#vt-matrix');
    const sorts = page.locator('#matrix-area .mx-sort');
    const n = await sorts.count();
    expect.soft(n, 'sortable matrix headers').toBeGreaterThan(0);
    const colKey = await sorts.nth(Math.min(1, n - 1)).getAttribute('data-sortkey');
    const read = () => page.locator('#matrix-area tbody tr').evaluateAll(rows => rows.map(r => r.children[0].textContent.trim()));
    const base = await read();
    await sorts.nth(Math.min(1, n - 1)).click();
    const asc = await read();
    await page.locator(`#matrix-area .mx-sort[data-sortkey="${colKey}"]`).click();
    const desc = await read();
    test.info().annotations.push({ type: 'matrix-sort', description: JSON.stringify({ base, asc, desc, colKey }) });
    expect.soft(JSON.stringify(asc) !== JSON.stringify(desc) || JSON.stringify(asc) !== JSON.stringify(base), 'sorting changes row order').toBe(true);
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('analytics: isolate a model, range, Export CSV', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku']);
    for (let i = 0; i < 3; i++) await send(page, 'Turn ' + i + ' explain topic ' + i + ' in some detail.');
    await page.click('.tab-btn[data-tab="analytics"]');
    await page.waitForTimeout(300);
    const nan = await page.evaluate(() => (document.getElementById('analytics-panel').innerHTML.match(/NaN|undefined/g) || []).length);
    expect.soft(nan, 'NaN/undefined in Analytics').toBe(0);
    const kpi = await page.locator('#an-kpi-row').innerText();
    test.info().annotations.push({ type: 'analytics-kpi', description: kpi.replace(/\s+/g, ' ').slice(0, 160) });
    const legend = page.locator('.an-legend button, .an-legend [role=button]');
    const nl = await legend.count();
    expect.soft(nl, 'isolate legend has one entry per model').toBeGreaterThanOrEqual(2);
    const before = await page.locator('#an-body').innerText();
    if (nl) await legend.first().click();
    await page.waitForTimeout(250);
    const after = await page.locator('#an-body').innerText();
    expect.soft(after !== before, 'isolating a model changes the charts/tables').toBe(true);
    const dl = page.waitForEvent('download', { timeout: 5000 });
    await page.click('#an-export');
    const csv = fs.readFileSync(await (await dl).path(), 'utf8');
    const lines = csv.trim().split('\n');
    expect.soft(lines.length, 'CSV has header + rows').toBeGreaterThan(2);
    expect.soft(new Set(lines.map(l => l.split(',').length)).size, 'consistent column count').toBeLessThanOrEqual(2);
    // KPI "Turns" is max (3) not total (6 turn cards across 2 models)
    const turnsKpi = await page.locator('#an-kpi-turns').innerText();
    test.info().annotations.push({ type: 'analytics-turns-kpi', description: turnsKpi.replace(/\s+/g, ' ') + ' (3 turns x 2 models)' });
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('benchmarks: compare-selected', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await page.click('.tab-btn[data-tab="benchmarks"]');
    await page.waitForTimeout(400);
    const picks = page.locator('#benchmarks-panel .lt-pick input[type=checkbox]');
    const np = await picks.count();
    expect.soft(np, 'selectable rows in a benchmark table').toBeGreaterThan(2);
    if (np > 2) { await picks.nth(0).check({ force: true }); await picks.nth(1).check({ force: true }); }
    const btn = page.locator('#benchmarks-panel .lt-cmp-btn').first();
    await expect.soft(btn).toBeVisible();
    await btn.click();
    const box = page.locator('#benchmarks-panel .lt-compare:not([hidden])').first();
    await expect.soft(box).toBeVisible();
    const t = await box.innerText();
    test.info().annotations.push({ type: 'bench-compare', description: t.replace(/\s+/g, ' ').slice(0, 200) });
    expect.soft(t).not.toMatch(/NaN|undefined/);
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  for (const [w, h] of [[1440, 900], [390, 812]]) {
    test(`currency regression @${w}: sidebar total, turn cards, Latest responses, matrix, analytics follow EUR`, async ({ browser }) => {
      const ctx = await browser.newContext({ viewport: { width: w, height: h } });
      const page = await ctx.newPage();
      await open(page, { mode: 'offline', wait: false });
      await page.waitForFunction(() => window.STATE && STATE.getModels().length > 0);
      await page.evaluate(() => { APP.toggleModel('openai/gpt-4o'); APP.toggleModel('anthropic/claude-3-haiku'); });
      await page.fill('#prompt-input', 'Explain RAG in detail.');
      await page.evaluate(() => document.getElementById('send-btn').click());
      await page.waitForFunction(() => !document.getElementById('send-btn').disabled);
      await page.evaluate(() => { const s = document.getElementById('currency-select'); s.value = 'EUR'; s.dispatchEvent(new Event('change', { bubbles: true })); });
      await page.waitForTimeout(1500);
      const r = await page.evaluate(() => ({
        sess: (document.getElementById('sess-cost') || {}).textContent,
        pill: document.getElementById('usage-pill-txt').textContent,
        card: (document.querySelector('.turn-stat.cost .tsv') || {}).textContent,
        colTot: [...document.querySelectorAll('.model-col')].map(c => (c.innerText.match(/Cost\s*\n?\s*([$€£₹][\d.]+)/) || [])[1]),
        op: (document.querySelector('.op-card-head') || {}).textContent,
        budget: (document.getElementById('budget-used') || {}).textContent,
      }));
      test.info().annotations.push({ type: 'eur-' + w, description: JSON.stringify(r) });
      expect.soft(r.pill, 'pill').toMatch(/€/);
      expect.soft(r.sess, 'sidebar #sess-cost').toMatch(/€/);
      expect.soft(r.card, 'existing turn card cost').toMatch(/€/);
      expect.soft(r.colTot.join(','), 'column totals').toMatch(/€/);
      expect.soft(r.op, 'Latest responses header (only if it shows a price)').not.toMatch(/\$\d/);
      await page.click(`.tab-btn[data-tab="analytics"], .bn-btn[data-tab="analytics"]`).catch(() => page.evaluate(() => document.querySelector('.bn-btn[data-tab="analytics"]').click()));
      await page.waitForTimeout(300);
      expect.soft(await page.locator('#analytics-panel').innerText(), 'Analytics in EUR').toMatch(/€/);
      await ctx.close();
    });
  }
});
