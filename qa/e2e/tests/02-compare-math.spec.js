const { test } = require('@playwright/test');
const { setCur, open, selectModel, selectModels, send, shot, num, expect } = require('./helpers');

// Offline fallback gives deterministic prices:
// gpt-4o 2.5/10 per 1M (ctx 128k) | claude-3-haiku 0.25/1.25 (ctx 200k) | gpt-3.5-turbo 0.5/1.5 (ctx 16385)
const cid = id => 'col-' + id.replace(/[/]/g, '-');

async function readTurn(page, modelId, n) {
  return page.evaluate(([c, n]) => {
    const card = document.querySelectorAll('#' + c + '-turns .turn-card')[n - 1];
    if (!card) return null;
    const o = {};
    card.querySelectorAll('.turn-stat').forEach(s => { o[s.querySelector('.tsl').textContent.replace(/^\S+\s/, '').trim()] = s.querySelector('.tsv').childNodes[0].textContent.trim(); });
    return o;
  }, [cid(modelId), n]);
}

test.describe('compare: numeric correctness (offline fallback prices)', () => {
  test('cost = tokens x price/1M, CO2/water/power recompute, multi-turn context, totals', async ({ page }) => {
    const errs = await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    const P1 = 'Explain quantum entanglement in simple terms.'; const PT = Math.ceil(P1.length / 4);
    await send(page, P1);
    const t1 = await page.evaluate(() => STATE.getSession('openai/gpt-4o').turns[0]);
    expect.soft(t1.promptTokens, 'prompt tokens (prose /4)').toBe(PT);
    expect.soft(t1.inputTokens).toBe(PT);
    const c1 = PT * 2.5e-6 + t1.outputTokens * 10e-6;
    expect.soft(t1.cost).toBeCloseTo(c1, 10);
    // turn 1 has no cacheable prefix
    expect.soft(t1.cachedTokens).toBe(0);
    const tot1 = (PT + t1.outputTokens) / 1e6;
    expect.soft(t1.co2).toBeCloseTo(tot1 * 3200 * 250 / 1000, 8);
    expect.soft(t1.water).toBeCloseTo(tot1 * 3200 * 11.5 / 1000, 8);
    expect.soft(t1.power).toBeCloseTo(tot1 * 3200, 8);

    // UI string vs model
    const ui = await readTurn(page, 'openai/gpt-4o', 1);
    expect.soft(ui['Input tokens']).toBe(String(PT));
    expect.soft(num(ui['Turn cost'])).toBeCloseTo(+c1.toFixed(c1 < 0.001 ? 6 : c1 < 0.01 ? 4 : 3), 6);

    // turn 2 (context accumulation + cache)
    const P2 = 'Now give a one paragraph summary of that.';
    await send(page, P2);
    const t2 = await page.evaluate(() => STATE.getSession('openai/gpt-4o').turns[1]);
    const ctx1 = t1.promptTokens + t1.outputTokens;
    expect.soft(t2.inputTokens, 'turn2 input = prior prompt+output + new prompt').toBe(ctx1 + t2.promptTokens);
    const prior = t2.inputTokens - t2.promptTokens;
    const cached = Math.round(prior * 0.9);
    expect.soft(t2.cachedTokens).toBe(cached);
    const fresh = t2.inputTokens - cached;
    const c2 = fresh * 2.5e-6 + cached * 2.5e-6 * 0.5 + t2.outputTokens * 10e-6;
    expect.soft(t2.cost).toBeCloseTo(c2, 10);
    expect.soft(t2.costNoCache).toBeCloseTo(t2.inputTokens * 2.5e-6 + t2.outputTokens * 10e-6, 10);
    const eff = t2.inputTokens - cached * 0.9;
    expect.soft(t2.co2).toBeCloseTo((eff + t2.outputTokens) / 1e6 * 3200 * 250 / 1000, 8);

    // column totals = sum of turns
    const sums = await page.evaluate(() => {
      const s = STATE.getSession('openai/gpt-4o');
      return { cost: s.turns.reduce((a, t) => a + t.cost, 0), tin: s.turns.reduce((a, t) => a + t.inputTokens, 0), tout: s.turns.reduce((a, t) => a + t.outputTokens, 0), co2: s.turns.reduce((a, t) => a + t.co2, 0), totalCost: s.totalCost, totalIn: s.totalIn, totalOut: s.totalOut, totalCO2: s.totalCO2 };
    });
    expect.soft(sums.totalCost).toBeCloseTo(sums.cost, 12);
    expect.soft(sums.totalIn).toBe(sums.tin);
    expect.soft(sums.totalOut).toBe(sums.tout);
    expect.soft(sums.totalCO2).toBeCloseTo(sums.co2, 12);
    const c = cid('openai/gpt-4o');
    expect.soft(await page.locator('#' + c + '-t-in').innerText()).toBe(sums.tin.toLocaleString());
    expect.soft(await page.locator('#' + c + '-t-out').innerText()).toBe(sums.tout.toLocaleString());
    const colCostUI = await page.locator('#' + c + '-t-cost').innerText();
    expect.soft(num(colCostUI)).toBeCloseTo(+sums.cost.toFixed(sums.cost < 0.01 ? 4 : 3), 6);
    // sparkline + ctx bar updated
    const pct = await page.locator('#' + c + '-ctx-pct').innerText();
    const wantPct = ((t2.contextTokens) / 128000 * 100).toFixed(1) + '%';
    expect.soft(pct).toBe(wantPct);
    await shot(page, 'compare-two-turns-gpt4o');
    expect.soft(errs, errs.join('\n')).toEqual([]);
  });

  test('gpt-4o output multiplier regex /gpt-4o[^-]/ should match plain gpt-4o id', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'openai/gpt-4o-mini']);
    await send(page, 'Hi');
    const r = await page.evaluate(() => ['openai/gpt-4o', 'openai/gpt-4o-mini'].map(id => { const t = STATE.getSession(id).turns[0]; return { id, out: t.outputTokens, raw: TOKEN_ENGINE.count(t.response) }; }));
    // gpt-4o is a "1.15x frontier" model per outMult table; ratio out/raw should be 1.15
    expect.soft(r[0].out / r[0].raw, 'gpt-4o should get the 1.15 frontier multiplier (regex requires a trailing char)').toBeGreaterThan(1.1);
  });

  test('session totals equal sum of columns; 3 models', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku', 'openai/gpt-3.5-turbo']);
    await send(page, 'Write a Python function that finds all prime numbers up to n.');
    await send(page, 'Add type hints and a docstring.');
    const r = await page.evaluate(() => {
      const ids = STATE.getActiveModels().map(m => m.id);
      const g = STATE.globalTotals();
      const sum = k => ids.reduce((a, id) => a + STATE.getSession(id)[k], 0);
      return { g, cost: sum('totalCost'), co2: sum('totalCO2'), water: sum('totalWater'), power: sum('totalPower'), turns: STATE.maxTurns() };
    });
    expect.soft(r.g.cost).toBeCloseTo(r.cost, 12);
    expect.soft(r.g.turns).toBe(2);
    expect.soft(await page.locator('#sess-turns').innerText()).toBe('2');
    expect.soft(num(await page.locator('#sess-cost').innerText())).toBeCloseTo(+r.cost.toFixed(r.cost < 0.01 ? 4 : 3), 6);
    // tokens tile
    const tok = await page.evaluate(() => { const g = STATE.globalTotals(); return g.tokensIn + g.tokensOut; });
    const tileTxt = await page.locator('#sess-tokens').innerText();
    expect.soft(tileTxt.length).toBeGreaterThan(0);
    // claude-3-haiku: cache write multiplier 1.25 applies to the prompt on EVERY turn incl. turn 1
    const h1 = await page.evaluate(() => STATE.getSession('anthropic/claude-3-haiku').turns[0]);
    expect.soft(h1.cacheWriteTokens).toBe(h1.promptTokens);
    test.info().annotations.push({ type: 'haiku-turn1', description: 'cost ' + h1.cost + ' vs noCache ' + h1.costNoCache });
    await shot(page, 'compare-three-models');
  });

  test('currency toggle converts every visible figure (EUR/GBP/INR)', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModels(page, ['openai/gpt-4o', 'anthropic/claude-3-haiku']);
    await send(page, 'Explain transformers to a software engineer in detail.');
    await send(page, 'Compare that with state space models.');
    const base = await page.evaluate(() => ({ cost: STATE.globalTotals().cost, t: STATE.getSession('openai/gpt-4o').turns[1].cost }));
    const FX = { EUR: 0.92, GBP: 0.79, INR: 83.2 }, SY = { EUR: '€', GBP: '£', INR: '₹' };
    for (const cur of ['EUR', 'GBP', 'INR']) {
      await setCur(page, cur);
      const sess = await page.locator('#sess-cost').innerText();
      expect.soft(sess.startsWith(SY[cur]), `${cur} symbol in session total: ${sess}`).toBe(true);
      const v = base.cost * FX[cur];
      const dp = v < 0.001 ? 6 : v < 0.01 ? 4 : v < 1 ? 3 : 2;
      expect.soft(num(sess), `${cur} session cost`).toBeCloseTo(+v.toFixed(dp), dp);
      const colCost = await page.locator('#col-openai-gpt-4o-t-cost').innerText();
      expect.soft(colCost.startsWith(SY[cur])).toBe(true);
      // turn card (already rendered) must also convert
      const tc = await page.locator('#col-openai-gpt-4o-turns .turn-card').nth(1).locator('.turn-stat.cost .tsv').innerText();
      expect.soft(tc.startsWith(SY[cur]), `turn card still shows old currency: ${tc}`).toBe(true);
      // header pill
      const pill = await page.locator('#usage-pill-txt').innerText();
      expect.soft(pill.startsWith(SY[cur]), `usage pill: ${pill}`).toBe(true);
      // column header price line is USD always
      const meta = await page.locator('#col-openai-gpt-4o .model-meta').innerText();
      expect.soft(meta, 'header price line in $ when currency=' + cur).toMatch(/\$/);
      const budget = await page.locator('#budget-used').innerText();
      if (cur === 'INR') await shot(page, 'currency-inr');
      // report budget label currency
      test.info().annotations.push({ type: 'budget-label-' + cur, description: budget });
    }
    // projection modal
    await page.click('#proj-btn');
    const proj = await page.locator('#proj-table-wrap').innerText();
    expect.soft(proj, 'projection table should use ₹').toMatch(/₹/);
    await page.keyboard.press('Escape');
  });

  test('turn cards show raw figures for active currency after switch BEFORE sending', async ({ page }) => {
    await open(page, { mode: 'offline' });
    await selectModel(page, 'openai/gpt-4o');
    await setCur(page, 'INR');
    await send(page, 'Say hello');
    const tc = await page.locator('#col-openai-gpt-4o-turns .turn-stat.cost .tsv').first().innerText();
    expect.soft(tc.startsWith('₹')).toBe(true);
  });

  test('token counting: prose, code, CJK, emoji, empty/whitespace', async ({ page }) => {
    await open(page, { mode: 'offline' });
    const r = await page.evaluate(() => ({
      empty: TOKEN_ENGINE.count(''), ws: TOKEN_ENGINE.count('   '), one: TOKEN_ENGINE.count('a'),
      prose: TOKEN_ENGINE.count('word '.repeat(100)),
      cjk: TOKEN_ENGINE.count('你好世界'.repeat(25)),
      emoji: TOKEN_ENGINE.count('😀'.repeat(100)),
      code: TOKEN_ENGINE.count('```js\nfunction f(a){return a*2;}\n```'),
    }));
    expect.soft(r.empty).toBe(0);
    expect.soft(r.ws, 'whitespace only prompt should be 0 tokens').toBe(0);
    expect.soft(r.emoji, '100 emoji are >=100 tokens in every real BPE; estimator gives ' + r.emoji).toBeGreaterThanOrEqual(100);
    expect.soft(r.cjk).toBe(Math.ceil(100 / 1.5));
  });

  test('intent detection regressions', async ({ page }) => {
    await open(page, { mode: 'offline' });
    const r = await page.evaluate(() => ({
      quick: TOKEN_ENGINE.detectIntent('Write a Python quicksort implementation'),
      sbs: TOKEN_ENGINE.detectIntent('Step by step, how do I set up a Next.js app?'),
      summarizeTpl: TOKEN_ENGINE.detectIntent('Summarize the following text in 3 concise bullet points: [paste your text here]'),
    }));
    expect.soft(r.quick, '"quicksort" matches the unanchored "quick" alternative').not.toBe('brief');
    expect.soft(r.sbs, '"step by step" prompt is classified as list because \\bsteps?\\b is tested first').toBe('tutorial');
    expect.soft(r.summarizeTpl, 'Summarize template should be summarize, "concise" hijacks it').toBe('summarize');
  });
});
