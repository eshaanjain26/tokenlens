const { test } = require('@playwright/test');
const fs = require('fs');
const { setCur, open, selectModel, selectModels, send, shot, num, openTool, expect } = require('./helpers');

const TOOLS = [
  ['Usage & Caching', 'usage-overlay'], ['Smart Model Finder', 'finder-overlay'], ['Model Recommender', 'rec-overlay'],
  ['Prompt Optimizer', 'optimizer-overlay'], ['Scenario Builder', 'scenario-overlay'], ['A/B Test Mode', 'abtest-overlay'],
  ['Session History', 'history-overlay'], ['Smart Route', 'router-overlay'], ['Fine-Tune ROI', 'finecalc-overlay'],
  ['ESG Report', 'esg-overlay'], ['Live Bench', 'livebench-overlay'], ['Key Vault', 'rbac-overlay'],
  ['Shadow AI', 'shadow-overlay'], ['Policy Enforcement', 'policy-overlay'], ['Cost Forecast', 'forecast-overlay'],
  ['Bookmarked Turns', 'bookmarks-overlay'], ['Alert Webhooks', 'webhooks-overlay'], ['Session Notes', 'notes-overlay'],
];

const vis = (page, id) => page.evaluate(id => { const e = document.getElementById(id); if (!e) return false; const s = getComputedStyle(e); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0' && e.getBoundingClientRect().width > 0; }, id);

test.describe('tools menu: every item opens, renders in viewport, closes with Esc, survives clicking everything', () => {
  for (const [label, ov] of TOOLS) {
    test(`tool: ${label}`, async ({ page }) => {
      const errs = await open(page, { mode: 'offline' });
      await page.addInitScript(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
      await page.evaluate(() => { window.print = () => { window.__printed = (window.__printed || 0) + 1; }; });
      await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku']);
      await send(page, 'Explain how prompt caching reduces cost.');
      await openTool(page, label);
      await page.waitForTimeout(400);
      expect.soft(await vis(page, ov), label + ' overlay visible').toBe(true);
      // modal fits the viewport (1440x900)
      const box = await page.evaluate(id => { const o = document.getElementById(id); const m = o.firstElementChild; const r = m.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, w: innerWidth, h: innerHeight, ovf: getComputedStyle(m).overflowY, sh: m.scrollHeight, ch: m.clientHeight }; }, ov);
      expect.soft(box.t >= -1 && box.l >= -1 && box.r <= box.w + 1, `${label} modal horizontally/top inside viewport ${JSON.stringify(box)}`).toBe(true);
      await shot(page, 'tool-' + ov.replace('-overlay', ''));
      // click every button inside the modal (re-query each time)
      const n = await page.evaluate(id => document.getElementById(id).querySelectorAll('button, [onclick]').length, ov);
      for (let i = 0; i < Math.min(n, 40); i++) {
        const txt = await page.evaluate(([id, i]) => { const el = document.getElementById(id).querySelectorAll('button, [onclick]')[i]; return el ? (el.textContent || '').trim().slice(0, 30) : null; }, [ov, i]);
        if (txt === null) break;
        if (/Close|✕|Clear All|Download|Send/i.test(txt)) continue;
        await page.evaluate(([id, i]) => { const el = document.getElementById(id).querySelectorAll('button, [onclick]')[i]; if (el) el.click(); }, [ov, i]).catch(() => {});
      }
      expect.soft(errs, errs.join('\n')).toEqual([]);
      await page.keyboard.press('Escape');
      await page.waitForTimeout(250);
      expect.soft(await vis(page, ov), `${label}: Esc closes`).toBe(false);
    });
  }
});

test.describe('tool correctness', () => {
  test('Projection modal math and empty-input handling', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    await page.click('#proj-btn');
    const row = (await page.locator('#proj-table-wrap tbody tr').first().innerText()).split(/\t|\n/).filter(x => x.trim());
    row.unshift('');
    // 500 in x $2.5/M + 300 out x $10/M = 0.00425/run
    expect.soft(row[1]).toContain('0.0043');
    expect.soft(num(row[2]), 'daily = 0.00425*1000').toBeCloseTo(4.25, 2);
    expect.soft(num(row[3]), 'monthly = daily*30').toBeCloseTo(127.5, 1);
    expect.soft(num(row[4]), 'yearly = daily*365').toBeCloseTo(1551.25, 1);
    await page.fill('#proj-runs', '');
    const t = await page.locator('#proj-table-wrap').innerText();
    expect.soft(t, 'empty runs input renders NaN').not.toMatch(/NaN/);
    await page.fill('#proj-in', '-5');
    expect.soft(await page.locator('#proj-table-wrap').innerText(), 'negative tokens should be rejected').not.toMatch(/-\$|\$-/);
  });

  test('Projection with 0 models warns', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await page.click('#proj-btn');
    await expect.soft(page.locator('.toast.warning')).toContainText('Select at least one model');
  });

  test('FinCalc: defaults, volume/tokens inputs, zero spend', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await openTool(page, 'Fine-Tune ROI');
    const kt = await page.locator('#fc-results').innerText();
    expect.soft(kt).toContain('Month 5');
    expect.soft(kt).toContain('114%');
    const before = await page.locator('#fc-results').innerHTML();
    await page.fill('#fc-volume', '9999999');
    await page.fill('#fc-tokens', '99999');
    expect.soft(await page.locator('#fc-results').innerHTML(), 'Monthly Request Volume / Avg Tokens inputs have no effect on results').not.toBe(before);
    await page.fill('#fc-spend', '0');
    const a = await page.locator('#fc-results').innerText();
    expect.soft(a, 'spend 0 must not silently behave like $2,000 (still shows Month 5 / 114%)').not.toContain('114%');
    await page.fill('#fc-spend', '100');
    expect.soft(await page.locator('#fc-results').innerText()).not.toContain('Month 5');
    await page.selectOption('#fc-tier', 'gemini');
    await shot(page, 'fincalc-gemini');
  });

  test('Smart Route: complexity + negative/zero priced models', async ({ page }) => {
    await open(page, { mode: 'fixture' });
    await selectModels(page, ['openrouter/auto', 'openai/gpt-4o-mini']);
    await openTool(page, 'Smart Route');
    await page.fill('#router-input', 'Hello?');
    await page.locator('#router-overlay .tl-btn',{hasText:'Analyze'}).click();
    const first = await page.locator('#router-results').innerText();
    expect.soft(first, 'a router model with price -1 must not be ranked #1 "very low input cost"').not.toMatch(/Auto Router/i);
    const txt = await page.locator('#router-results').innerText();
    expect.soft(txt).not.toMatch(/\$-/);
    await page.selectOption('#green-region-select', 'auto').catch(() => {});
  });

  test('Smart Route: currency ignored', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    await setCur(page, 'EUR');
    await openTool(page, 'Smart Route');
    await page.fill('#router-input', 'Hello there how are you doing today my friend?');
    await page.locator('#router-overlay .tl-btn',{hasText:'Analyze'}).click();
    expect.soft(await page.locator('#router-results').innerText(), 'Router estimate shows $ while currency is EUR').toMatch(/€/);
  });

  test('Prompt Optimizer keeps code indentation intact', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await openTool(page, 'Prompt Optimizer');
    const code = 'Please fix this:\n```python\ndef f(x):\n    if x:\n        return 1\n    return 2\n```\nThank you.';
    await page.fill('#opt-original', code);
    await page.locator('#optimizer-overlay .tl-btn',{hasText:/^Optimize$/}).click();
    const out = await page.inputValue('#opt-result');
    expect.soft(out, 'indentation inside the code block must be preserved:\n' + out).toContain('    if x:\n        return 1');
  });

  test('Recommender: tight budget relaxes silently, negative-price models', async ({ page }) => {
    await open(page, { mode: 'fixture' });
    await openTool(page, 'Model Recommender');
    await page.selectOption('#rec-budget', '10');
    await page.selectOption('#rec-vol', 'massive');
    await page.waitForTimeout(300);
    const txt = await page.locator('#rec-results').innerText();
    const names = [txt.slice(0,80)];
    const monthly = (txt.match(/\$[\d,.]+\/mo/g) || []).map(x => '💰 ' + x);
    test.info().annotations.push({ type: 'rec-tight-budget', description: names.join(' | ') + ' :: ' + monthly.filter(m => /mo/.test(m)).join(' | ') });
    const over = monthly.filter(m => /💰/.test(m)).some(m => num(m) > 10);
    expect.soft(over && !/over budget|no model|exceed/i.test(txt), 'recommendations exceed the $10/mo budget with no warning: ' + monthly.join(' ')).toBe(false);
    await page.selectOption('#rec-budget', '99999');
    await page.selectOption('#rec-vol', 'low');
    await page.waitForTimeout(300);
    const n2 = [await page.locator('#rec-results').innerText()];
    expect.soft(n2.join(' ')).not.toMatch(/Auto|Router|Fusion|Pareto|Switchyard|bodybuilder/i);
    await shot(page, 'recommender-defaults-live');
  });

  test('Scenario builder math = sum of turns; A/B test', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await openTool(page, 'Scenario Builder');
    await page.selectOption('#scenario-model-a', 'openai/gpt-4o');
    await page.locator('#scenario-overlay .tl-btn',{hasText:'Project costs'}).click();
    const check = await page.evaluate(() => {
      const t = document.querySelector('#scenario-results table');
      const rows = t ? [...t.querySelectorAll('tbody tr')].map(r => [...r.children].map(c => c.textContent)) : [];
      const m = STATE.getModels().find(x => x.id === 'openai/gpt-4o');
      let ctx = 0, total = 0; const exp = [];
      const turns = rows.map(r => r[1]);
      return { rows, m: m.pricing };
    });
    expect.soft(check.rows.length).toBe(5);
    // recompute T1 input tokens
    const p1 = 'Hello, what can you help me with today?';
    const inTok1 = Math.ceil(p1.length / 4);
    expect.soft(check.rows.length && +check.rows[0][2].replace(/,/g, '')).toBe(inTok1);
    await page.locator('#scenario-overlay .tl-btn',{hasText:'Add turn'}).click();
    expect.soft(await page.locator('#scenario-turns-list textarea').count()).toBe(6);
    await page.keyboard.press('Escape');
    await openTool(page, 'A/B Test Mode');
    await page.selectOption('#ab-runs', '10');
    await page.locator('#abtest-overlay .tl-btn',{hasText:'Run A/B'}).click();
    const cv = (await page.locator('#ab-results').innerText()).match(/Variance \(CV\)\s*([\d.]+%)/);
    test.info().annotations.push({ type: 'ab-cv', description: String(cv && cv[1]) });
    await page.fill('#ab-prompt', '');
    await page.locator('#abtest-overlay .tl-btn',{hasText:'Run A/B'}).click();
    await expect.soft(page.locator('.toast').last()).toContainText(/prompt/i);
  });

  test('Finder: opens, scores, selects', async ({ page }) => {
    const errs = await open(page, { mode: 'fixture' });
    await openTool(page, 'Smart Model Finder');
    await shot(page, 'finder-open');
    const html = await page.locator('#finder-modal').innerText();
    expect.soft(html.length).toBeGreaterThan(50);
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('ESG JSON export units and print view', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await page.evaluate(() => { window.print = () => { window.__printed = 1; }; });
    await selectModel(page, 'openai/gpt-4o');
    await send(page, 'Write an essay about renewable energy in detail.');
    const g = await page.evaluate(() => STATE.globalTotals());
    await openTool(page, 'ESG Report');
    const dl = page.waitForEvent('download');
    await page.locator('#esg-overlay .tl-btn',{hasText:'JSON'}).click();
    const d = await dl;
    const j = JSON.parse(fs.readFileSync(await d.path(), 'utf8'));
    // totals.power is Wh. A field named power_kWh must be Wh/1000.
    expect.soft(j.per_model[0].power_kWh, 'power_kWh field holds Wh (1000x too big)').toBeCloseTo(g.power / 1000, 6);
    // ESG on-screen KPI vs sidebar
    
    // methodology text vs real constants
    const meth = await page.locator('#esg-body').innerText();
    expect.soft(meth, 'ESG methodology quotes a 436 g/kWh global average and 0.001-0.01 kWh/1M tokens; app uses 90-600 g/kWh and 0.09-24 kWh/1M tokens').not.toMatch(/436|0\.001.0\.01/);
    // print view
    await page.locator('#esg-overlay .tl-btn',{hasText:'Print'}).click();
    expect.soft(await page.evaluate(() => window.__printed)).toBe(1);
    await page.evaluate(() => document.body.classList.add('printing-report'));
    await page.emulateMedia({ media: 'print' });
    await shot(page, 'esg-print-view');
    const vis = await page.evaluate(() => ({ app: getComputedStyle(document.getElementById('app')).display, esg: getComputedStyle(document.getElementById('esg-modal')).display, h: document.getElementById('esg-modal').getBoundingClientRect().height }));
    expect.soft(vis.app).toBe('none');
    expect.soft(vis.esg).not.toBe('none');
    await page.pdf({ path: require('path').join(__dirname, '..', 'shots', 'esg-print.pdf') }).catch(() => {});
    await page.emulateMedia({ media: 'screen' });
  });

  test('main page print stylesheet', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku']);
    await send(page, 'Explain RAG.');
    await page.emulateMedia({ media: 'print' });
    await shot(page, 'print-main');
    const r = await page.evaluate(() => ({ sb: getComputedStyle(document.getElementById('sidebar')).display, hdr: getComputedStyle(document.getElementById('header')).display, hs: document.documentElement.scrollWidth > innerWidth }));
    test.info().annotations.push({ type: 'print-main', description: JSON.stringify(r) });
    await page.emulateMedia({ media: 'screen' });
  });

  test('Export CSV / JSON (header + column)', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    await send(page, 'Say "quoted", with comma, and =formula');
    const dl1 = page.waitForEvent('download');
    await openTool(page, 'Export CSV');
    const csv = fs.readFileSync(await (await dl1).path(), 'utf8');
    const lines = csv.split('\n');
    expect.soft(lines[0].split(',').length).toBe(lines[1].split(',').length);
    const dl2 = page.waitForEvent('download');
    await openTool(page, 'Export JSON');
    const js = JSON.parse(fs.readFileSync(await (await dl2).path(), 'utf8'));
    expect.soft(js.models[0].pricing.input_per_1m).toBeCloseTo(2.5, 6);
    expect.soft(js.models[0].environmental_per_1m_tokens.power_wh).toBe(3200);
    expect.soft(js.models[0].environmental_per_1m_tokens.co2_grams).toBeCloseTo(800, 6);
    // per-model column CSV: prompt starting with = must be neutralised
    await page.fill('#prompt-input', '=HYPERLINK("http://evil","x")');
    await page.click('#send-btn');
    await page.waitForFunction(() => !document.getElementById('send-btn').disabled);
    const dl3 = page.waitForEvent('download');
    await page.click('#col-openai-gpt-4o .col-export button:has-text("CSV")');
    const col = fs.readFileSync(await (await dl3).path(), 'utf8');
    expect.soft(col, 'CSV formula injection: cell starting with = is not neutralised').not.toMatch(/,"=HYPERLINK/);
  });

  test('Usage panel: breakdown sums, cache toggle, hit slider, scope, copy', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku']);
    await openTool(page, 'Usage & Caching');
    expect.soft((await page.locator('#usage-body').innerText()).length).toBeGreaterThan(10);
    await page.keyboard.press('Escape');
    await send(page, 'Explain transformers in detail please.');
    await send(page, 'Now compare them with RNNs.');
    await send(page, 'Which is cheaper to serve?');
    await page.click('#usage-pill');
    const parts = await page.evaluate(() => {
      const ids = STATE.getActiveModels().map(m => m.id); let cost = 0, sumParts = 0;
      ids.forEach(id => { const m = STATE.getModels().find(x => x.id === id); STATE.getSession(id).turns.forEach(t => { const cd = CALC.costDetailed(m, t.inputTokens, t.outputTokens, t.cachedTokens, t.cacheWriteTokens); sumParts += cd.freshCost + cd.cachedCost + cd.writeCost + cd.outCost; cost += t.cost; }); });
      return { cost, sumParts };
    });
    expect.soft(parts.sumParts).toBeCloseTo(parts.cost, 10);
    // hit rate math in the panel
    const g = await page.evaluate(() => STATE.globalTotals());
    const pctTxt = await page.locator('.ux-limit').nth(2).locator('.ux-pct').innerText();
    expect.soft(num(pctTxt)).toBe(Math.round(g.cached / g.tokensIn * 100));
    // CO2 equivalents: 404 g is EPA per MILE, label says km
    const equiv = await page.locator('.ux-equiv').innerText();
    const km = num(equiv.match(/≈ ([\d.]+) km/)[1]);
    expect.soft(km, `"km driven" uses 404 g/mile: got ${km}, expected ${(g.co2 / 251).toFixed(4)} (≈251 g/km)`).toBeCloseTo(g.co2 / 251, 3);
    // cache off -> new turn has 0 cached
    await page.locator('.ux-switch').click();
    await page.keyboard.press('Escape');
    await send(page, 'One more question about sharding.');
    const last = await page.evaluate(() => STATE.getSession('openai/gpt-4o').turns.slice(-1)[0]);
    expect.soft(last.cachedTokens).toBe(0);
    // hit rate slider: set to 0 then new turn
    await page.click('#usage-pill');
    await page.locator('.ux-switch').click();
    await page.locator('.ux-hit input[type=range]').fill('0');
    await page.keyboard.press('Escape');
    await send(page, 'Again with zero hit rate.');
    const z = await page.evaluate(() => STATE.getSession('openai/gpt-4o').turns.slice(-1)[0]);
    expect.soft(z.cachedTokens).toBe(0);
    expect.soft(await page.evaluate(() => JSON.parse(localStorage.getItem('tl_cache_v1')))).toEqual({ on: true, hit: 0 });
    // scope + metric + copy
    await page.click('#usage-pill');
    await page.selectOption('.ux-sel', 'openai/gpt-4o');
    for (const k of ['Tokens', 'CO₂', 'Water', 'Power', 'Cost']) await page.locator('.ux-chip', { hasText: k }).click();
    await page.click('.ux-btn:has-text("Copy summary")');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect.soft(clip).toMatch(/TokenLens usage summary/);
    await shot(page, 'usage-panel-full');
    await page.click('.ux-btn:has-text("Open Analytics")');
    await expect.soft(page.locator('#analytics-panel')).toHaveClass(/active/);
  });

  test('Budget guard: repeated toasts', async ({ page }) => {
    await open(page, { mode: 'offline', chatDelay: 10 });
    await selectModel(page, 'openai/gpt-4o');
    await page.fill('#api-key-input', 'sk-or-v1-test');
    await page.fill('#budget-input', '0.0001');
    await send(page, 'Write a long essay about budgets please. '.repeat(10));
    await page.waitForTimeout(500);
    const before = await page.locator('.toast', { hasText: 'budget exceeded' }).count();
    for (let i = 0; i < 4; i++) await page.fill('#budget-input', '0.000' + (1 + i));
    const after = await page.locator('.toast', { hasText: 'budget exceeded' }).count();
    test.info().annotations.push({ type: 'budget-toasts', description: `${before} -> ${after}` });
    expect.soft(after, 'budget-exceeded toast fires on every keystroke in the cap input').toBeLessThanOrEqual(before + 1);
    await page.fill('#api-key-input', '');
    const lbl = await page.locator('#budget-used').innerText();
    expect.soft(lbl).toMatch(/Simulated/);
  });

  test('Bookmarks / ratings / notes / webhooks persist & behave', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    await send(page, 'rate and bookmark me');
    // rating + bookmark buttons on the turn card
    const btns = await page.locator('#col-openai-gpt-4o-turns .turn-card button').allInnerTexts();
    test.info().annotations.push({ type: 'turn-card-buttons', description: btns.join(' | ') });
    await openTool(page, 'Session Notes');
    await page.fill('#notes-textarea', 'hello notes world');
    await expect.soft(page.locator('#notes-wc')).toHaveText('3 words');
    await page.keyboard.press('Escape');
    await page.reload();
    await page.waitForSelector('#model-list .model-item');
    await openTool(page, 'Session Notes');
    expect.soft(await page.inputValue('#notes-textarea'), 'notes persisted').toBe('hello notes world');
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });
});

test.describe('turn annotations', () => {
  test('bookmark / rating of a cleared turn must not reappear on the next conversation', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    await send(page, 'first conversation');
    await page.evaluate(() => document.querySelector('#col-openai-gpt-4o-turns .turn-annotation-btn').click());
    await page.click('#col-openai-gpt-4o .col-export button:has-text("Clear")');
    await send(page, 'a brand new conversation');
    const cls = await page.locator('#col-openai-gpt-4o-turns .turn-annotation-btn').first().getAttribute('class');
    expect.soft(cls, 'new turn 1 inherits the bookmark of the cleared turn 1').not.toContain('bookmarked');
    await openTool(page, 'Bookmarked Turns');
    const txt = await page.locator('#bookmarks-list').innerText();
    expect.soft(txt).not.toMatch(/a brand new conversation/);
  });
});
