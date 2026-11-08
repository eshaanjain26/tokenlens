import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOT_DIR = process.env.SHOT_DIR || 'docs/qa/learn';
const NETWORK_NOISE = /openrouter\.ai|fonts\.googleapis\.com|fonts\.gstatic\.com/;
const KNOWN_ANALYTICS_NAN = /<path> attribute d: Expected number/;
const VIEWPORTS = [[360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]];

function trackErrors(page) {
  const errors = [];
  page.on('pageerror', (err) => errors.push('pageerror: ' + err.message));
  page.on('console', (msg) => {
    if (msg.type() !== 'error') return;
    const url = msg.location().url || '';
    if (NETWORK_NOISE.test(url) || NETWORK_NOISE.test(msg.text())) return;
    if (KNOWN_ANALYTICS_NAN.test(msg.text())) return;
    errors.push('console.error: ' + msg.text() + ' @ ' + url);
  });
  return errors;
}

async function boot(page) {
  await page.goto('/');
  await page.locator('.onboard-start-btn').click();
  await expect(page.locator('#onboarding-overlay')).toBeHidden();
  await expect(page.locator('#model-list .model-item').first()).toBeAttached();
}

async function clickTab(page, tab) {
  await page.locator(`.tab-btn[data-tab="${tab}"]:visible, .bn-btn[data-tab="${tab}"]:visible`).first().click();
  await expect(page.locator(`#${tab}-panel`)).toHaveClass(/active/);
}

async function selectModels(page) {
  let opened = false;
  if (!(await page.locator('#model-list').isVisible())) {
    await page.locator('#mobile-menu-btn:visible, #rail-btn-models:visible').first().click();
    await expect(page.locator('#model-list')).toBeVisible();
    opened = true;
  }
  const boxes = page.locator('#model-list .model-item input[type=checkbox]');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  if (opened) {
    await page.keyboard.press('Escape');
    await expect(page.locator('#model-list')).toBeHidden();
  }
}

async function sendTurn(page, expected) {
  await page.locator('#prompt-input').fill('Summarize the tradeoffs of prompt caching for a CPQ quoting assistant.');
  await page.locator('#send-btn').click();
  await expect(page.locator('#compare-panel .turn-card')).toHaveCount(expected, { timeout: 30000 });
}

async function threeModelsTwoTurns(page) {
  await selectModels(page);
  await sendTurn(page, 3);
  await sendTurn(page, 6);
}

async function overflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function shot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: true });
}

async function firstCell(page, tableId) {
  return page.locator(`#${tableId} tbody tr td[data-first] .lt-name`).allInnerTexts();
}

test.describe('Benchmarks', () => {
  test('renders with zero turns and no models selected', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await clickTab(page, 'benchmarks');
    await expect(page.locator('#bn-train tbody tr')).toHaveCount(10);
    await expect(page.locator('#bn-inf tbody tr')).toHaveCount(10);
    await expect(page.locator('#bench-radar-wrap .bn-empty')).toBeVisible();
    await expect(page.locator('#cc-chart svg .lc-bar')).toHaveCount(5);
    await expect(page.locator('#be-chart svg .lc-line')).toHaveCount(2);
    expect(await page.locator('#benchmarks-panel').innerHTML()).not.toMatch(/&#1\d{5}|[\u{1F300}-\u{1FAFF}]|[☀-➿]/u);
    expect(errors).toEqual([]);
  });

  test('renders with three models and two turns, scorecard filled', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await threeModelsTwoTurns(page);
    await clickTab(page, 'benchmarks');
    await expect(page.locator('#bn-score tbody tr')).toHaveCount(3);
    await expect(page.locator('#bn-score .lt-fill.is-best').first()).toBeVisible();
    await shot(page, 'benchmarks-3models-1440');
    expect(errors).toEqual([]);
  });

  test('table sort, filter chips, search and persistence', async ({ page }) => {
    await boot(page);
    await clickTab(page, 'benchmarks');
    const co2 = page.locator('#bn-train th[data-key="co2"]');
    await co2.locator('button').click();
    await expect(co2).toHaveAttribute('aria-sort', 'descending');
    expect((await firstCell(page, 'bn-train'))[0]).toBe('GPT-4');
    await co2.locator('button').click();
    await expect(co2).toHaveAttribute('aria-sort', 'ascending');
    expect((await firstCell(page, 'bn-train'))[0]).toBe('BERT-base');
    await page.reload();
    await expect(page.locator('#model-list .model-item').first()).toBeAttached();
    await clickTab(page, 'benchmarks');
    await expect(page.locator('#bn-train th[data-key="co2"]')).toHaveAttribute('aria-sort', 'ascending');
    await page.locator('#bn-train th[data-key="co2"] button').click();
    await expect(page.locator('#bn-train th[data-key="co2"]')).toHaveAttribute('aria-sort', 'none');

    await page.locator('#bn-train .lt-chip', { hasText: 'Verified' }).click();
    await expect(page.locator('#bn-train tbody tr')).toHaveCount(6);
    await expect(page.locator('#bn-train .lt-chip', { hasText: 'Verified' })).toHaveAttribute('aria-pressed', 'true');
    await page.locator('#bn-train .lt-chip', { hasText: 'All' }).click();
    await page.locator('#bn-train .lt-search input').fill('gpt');
    await expect(page.locator('#bn-train tbody tr')).toHaveCount(2);
    await page.locator('#bn-train .lt-search input').fill('zzzz');
    await expect(page.locator('#bn-train tbody tr')).toHaveCount(0);
    await expect(page.locator('#bn-train .lt-empty')).toBeVisible();
    await expect(page.locator('#bn-train thead')).toBeVisible();

    await page.locator('#bn-inf th[data-key="power"] button').click();
    expect((await firstCell(page, 'bn-inf'))[0]).toBe('o3');
    await page.locator('#bn-inf th[data-key="model"] button').click();
    expect((await firstCell(page, 'bn-inf'))[0]).toBe('Claude 3.5 Haiku');
  });

  test('compare selected shows a side-by-side table', async ({ page }) => {
    await boot(page);
    await clickTab(page, 'benchmarks');
    const btn = page.locator('#bn-train .lt-cmp-btn');
    await expect(btn).toBeDisabled();
    const boxes = page.locator('#bn-train tbody input[type=checkbox]');
    await boxes.nth(0).check();
    await expect(btn).toBeDisabled();
    await boxes.nth(2).check();
    await expect(btn).toBeEnabled();
    await btn.click();
    const cmp = page.locator('#bn-train .lt-compare');
    await expect(cmp).toBeVisible();
    await expect(cmp.locator('thead th')).toHaveCount(3);
    await expect(cmp.locator('td.is-lo').first()).toBeVisible();
    await boxes.nth(1).check();
    await boxes.nth(3).check();
    await boxes.nth(4).click();
    await expect(boxes.nth(4)).not.toBeChecked();
    await cmp.locator('.lt-cmp-clear').click();
    await expect(cmp).toBeHidden();
    await expect(btn).toBeDisabled();
  });

  test('sticky header stays in view while the table scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 520 });
    await boot(page);
    await clickTab(page, 'benchmarks');
    const info = await page.evaluate(() => {
      const sc = document.querySelector('#bn-inf .lt-scroll');
      sc.scrollTop = 120;
      const th = sc.querySelector('th');
      return { scrollable: sc.scrollHeight > sc.clientHeight, delta: th.getBoundingClientRect().top - sc.getBoundingClientRect().top };
    });
    expect(info.scrollable).toBe(true);
    expect(Math.abs(info.delta)).toBeLessThanOrEqual(1);
  });

  test('phone shows a scroll hint that clears at the end', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await boot(page);
    await clickTab(page, 'benchmarks');
    const hint = page.locator('#bn-train .lt-hint');
    await expect(hint).toBeVisible();
    await page.evaluate(() => { const s = document.querySelector('#bn-train .lt-scroll'); s.scrollLeft = s.scrollWidth; });
    await expect(hint).toBeHidden();
    await shot(page, 'benchmarks-390-scrolled');
  });

  test('chart tooltip follows pointer and keyboard', async ({ page }) => {
    await boot(page);
    await clickTab(page, 'benchmarks');
    const chart = page.locator('#cc-chart');
    await chart.scrollIntoViewIfNeeded();
    const box = await chart.locator('.lc-hit').boundingBox();
    await page.mouse.move(box.x + box.width * 0.5, box.y + box.height * 0.5);
    const tip = chart.locator('.lc-tip');
    await expect(tip).toBeVisible();
    await expect(tip).toContainText('Turn 3');
    await expect(chart.locator('.lc-cross')).not.toHaveAttribute('hidden', '');
    await page.mouse.move(box.x + box.width * 0.1, box.y + box.height * 0.5);
    await expect(tip).toContainText('Turn 1');
    await page.mouse.move(5, 5);
    await expect(tip).toBeHidden();

    await chart.focus();
    await page.keyboard.press('ArrowLeft');
    await page.keyboard.press('ArrowLeft');
    await expect(tip).toContainText('Turn 4');
    await page.keyboard.press('Home');
    await expect(tip).toContainText('Turn 1');
    await page.keyboard.press('Escape');
    await expect(tip).toBeHidden();
    await chart.focus();
    await shot(page, 'benchmarks-context-chart-focus');

    const be = page.locator('#be-chart');
    await be.scrollIntoViewIfNeeded();
    const bb = await be.locator('.lc-hit').boundingBox();
    await page.mouse.move(bb.x + bb.width * 0.6, bb.y + bb.height * 0.5);
    await expect(be.locator('.lc-tip')).toBeVisible();
    await expect(be.locator('.lc-tip .lc-tip-r')).toHaveCount(2);
  });

  test('calculator results update and settle on the final value', async ({ page }) => {
    await boot(page);
    await clickTab(page, 'benchmarks');
    await page.locator('#cc-n').fill('10');
    await expect(page.locator('#cc-n-val')).toHaveText('10');
    await expect(page.locator('#cc-chart .lc-bar')).toHaveCount(10);
    await expect(page.locator('#cc-mult')).toHaveText('4.6×', { timeout: 2000 });
    await page.locator('#cc-model').selectOption({ index: 2 });
    await expect(page.locator('#cc-r1')).toHaveText(/^\$/);
    await page.locator('#be-in').fill('20000000');
    await expect(page.locator('#be-results .be-result-card')).toHaveCount(3);
  });

  test('copy citation confirms', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await boot(page);
    await clickTab(page, 'benchmarks');
    const btn = page.locator('.bn-cite .bn-copy').first();
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(btn).toContainText('Copied');
    const clip = await page.evaluate(() => navigator.clipboard.readText());
    expect(clip).toContain('Luccioni');
    await expect(btn).toContainText('Copy', { timeout: 3000 });
  });

  test('no horizontal overflow at any viewport (3 models, 2 turns)', async ({ page }) => {
    test.setTimeout(240000);
    await boot(page);
    await threeModelsTwoTurns(page);
    for (const [w, h] of VIEWPORTS) {
      await page.setViewportSize({ width: w, height: h });
      for (const tab of ['benchmarks', 'howitworks']) {
        await clickTab(page, tab);
        await page.waitForTimeout(250);
        expect.soft(await overflow(page), `${tab} at ${w}`).toBeLessThanOrEqual(0);
      }
    }
  });
});

test.describe('How it works', () => {
  test('table of contents highlights the section in view and scrolls on click', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await clickTab(page, 'howitworks');
    const cur = page.locator('.hiw-toc [aria-current="true"]');
    await expect(cur).toHaveText('Overview');
    await page.locator('.hiw-toc a', { hasText: 'Power' }).click();
    await expect(cur).toHaveText('Power');
    await expect.poll(() => page.evaluate(() => document.getElementById('hiw-power').getBoundingClientRect().top), { timeout: 4000 }).toBeLessThan(160);
    await page.evaluate(() => document.getElementById('hiw-water').scrollIntoView({ behavior: 'instant', block: 'start' }));
    await expect(cur).toHaveText('Water');
    await page.evaluate(() => document.getElementById('hiw-limits').scrollIntoView({ behavior: 'instant', block: 'start' }));
    await expect(cur).not.toHaveText('Water');
    expect(errors).toEqual([]);
  });

  test('numbered sections and ordered pipeline', async ({ page }) => {
    await boot(page);
    await clickTab(page, 'howitworks');
    await expect(page.locator('ol.hiw-steps > li')).toHaveCount(5);
    const nums = await page.locator('.hiw-num h2').evaluateAll((els) => els.map((e) => getComputedStyle(e, '::before').content));
    expect(nums.every((n) => n.includes('counter(hiw)'))).toBe(true);
    expect(nums).toHaveLength(5);
    expect(await page.locator('#hiw-overview h2').evaluate((e) => getComputedStyle(e, '::before').content)).toBe('none');
    await expect(page.locator('#hiw-method')).toContainText('Cache-read energy factor');
    await expect(page.locator('#hiw-method')).toContainText('Luccioni et al. 2023 power anchor');
    await expect(page.locator('[data-calc="cache-factor"]')).toHaveText('10%');
  });

  test('collapsible rates animate open and closed', async ({ page }) => {
    await boot(page);
    await clickTab(page, 'howitworks');
    const btn = page.locator('.fold-btn[aria-controls="hiw-power-rates"]');
    const body = page.locator('#hiw-power-rates');
    await btn.scrollIntoViewIfNeeded();
    expect(await body.evaluate((e) => e.getBoundingClientRect().height)).toBe(0);
    await expect(body).toHaveAttribute('inert', '');
    await btn.click();
    await expect(btn).toHaveAttribute('aria-expanded', 'true');
    await expect.poll(() => body.evaluate((e) => e.getBoundingClientRect().height)).toBeGreaterThan(80);
    await expect(body).not.toHaveAttribute('inert', '');
    await btn.press('Enter');
    await expect(btn).toHaveAttribute('aria-expanded', 'false');
    await expect.poll(() => body.evaluate((e) => e.getBoundingClientRect().height)).toBe(0);
  });

  test('copy citation and copy formula buttons confirm', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await boot(page);
    await clickTab(page, 'howitworks');
    const cite = page.locator('[data-hiw-cite]');
    await cite.click();
    await expect(cite).toContainText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('How every number is calculated');
    const f = page.locator('[data-hiw-copy]').first();
    await f.scrollIntoViewIfNeeded();
    await f.click();
    await expect(f).toContainText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('inputTokens');
  });

  test('live walkthrough computes and reacts to changes', async ({ page }) => {
    await boot(page);
    await clickTab(page, 'howitworks');
    await page.locator('#hiw-run, .hiw-run').click();
    await expect(page.locator('#hiw-result .hiw-warn')).toBeVisible();
    await page.locator('#hiw-prompt').fill('Summarize this 500-word article about climate change for an executive audience.');
    await page.locator('.hiw-run').click();
    await expect(page.locator('#hiw-result .bn-kpi')).toHaveCount(5);
    const before = await page.locator('#hiw-result .bn-kpi').nth(3).innerText();
    await page.locator('#hiw-provider').selectOption('deepseek');
    await expect.poll(() => page.locator('#hiw-result .bn-kpi').nth(3).innerText()).not.toBe(before);
    await page.locator('#hiw-prompt').fill('Short prompt');
    await page.keyboard.press('Meta+Enter');
    await expect(page.locator('#hiw-result .bn-kpi').first()).toContainText('Input tokens');
  });

  test('renders cleanly in the main viewports', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    for (const [w, h] of [[390, 844], [768, 1024], [1920, 1080]]) {
      await page.setViewportSize({ width: w, height: h });
      await clickTab(page, 'howitworks');
      await page.waitForTimeout(250);
      await page.evaluate(() => window.scrollTo(0, 0));
      await shot(page, `howitworks-${w}`);
    }
    expect(errors).toEqual([]);
  });
});

test.describe('Turn explainer and live bench', () => {
  test('explainer dialog opens, sections collapse, copies and restores focus', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    const errors = trackErrors(page);
    await boot(page);
    await threeModelsTwoTurns(page);
    const trigger = page.locator('.expl-turn-btn').first();
    await trigger.scrollIntoViewIfNeeded();
    await trigger.click();
    await expect(page.locator('#explain-modal')).toBeVisible();
    await expect(page.locator('#explain-modal .expl-section')).toHaveCount(5);
    expect(await page.locator('#explain-modal-body').innerHTML()).not.toMatch(/[\u{1F300}-\u{1FAFF}]|[☀-➿]/u);
    const tok = page.locator('#explain-modal .fold-btn').first();
    await tok.click();
    await expect(tok).toHaveAttribute('aria-expanded', 'false');
    await tok.click();
    await expect(tok).toHaveAttribute('aria-expanded', 'true');
    await page.locator('[data-expl-copy]').click();
    await expect(page.locator('[data-expl-copy]')).toContainText('Copied');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toContain('totalCost');
    await shot(page, 'explainer-dialog');
    await page.keyboard.press('Escape');
    await expect(page.locator('#explain-modal')).toBeHidden();
    await expect(trigger).toBeFocused();
    expect(errors).toEqual([]);
  });

  test('live bench lists selected models and refreshes', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await selectModels(page);
    await page.locator('#tools-btn').click();
    await page.locator('#tools-dropdown .tools-item', { hasText: 'Live bench' }).click();
    await expect(page.locator('#livebench-modal')).toBeVisible();
    await expect(page.locator('#lb-body tbody tr')).toHaveCount(3);
    await expect(page.locator('#lb-body .lb-prov-chip').first()).toBeVisible();
    await page.locator('.lb-refresh').click();
    await expect(page.locator('#lb-body tbody tr')).toHaveCount(3);
    await shot(page, 'livebench-dialog');
    await page.keyboard.press('Escape');
    await expect(page.locator('#livebench-modal')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('live bench empty state', async ({ page }) => {
    await boot(page);
    await page.locator('#tools-btn').click();
    await page.locator('#tools-dropdown .tools-item', { hasText: 'Live bench' }).click();
    await expect(page.locator('#lb-body .lb-empty')).toBeVisible();
  });
});

test.describe('Dark mode', () => {
  test('both tabs follow the dark tokens', async ({ page }) => {
    const errors = trackErrors(page);
    await boot(page);
    await selectModels(page);
    await page.locator('#dark-toggle').click();
    await clickTab(page, 'benchmarks');
    await expect(page.locator('#bn-train tbody tr').first()).toBeVisible();
    const res = await page.evaluate(() => {
      const cs = (sel, prop) => getComputedStyle(document.querySelector(sel))[prop];
      return {
        chip: cs('#bn-train .lt-chip[aria-pressed="true"]', 'backgroundColor'),
        thead: cs('#bn-train th', 'backgroundColor'),
        text: cs('.bn-head h1', 'color'),
        grid: getComputedStyle(document.querySelector('#cc-chart .lc-grid')).stroke,
        hi: getComputedStyle(document.querySelector('#cc-chart .lc-bar--hi')).fill,
      };
    });
    expect(res.chip).toBe('rgb(242, 242, 242)');
    expect(res.thead).toBe('rgb(11, 11, 11)');
    expect(res.text).toBe('rgb(237, 237, 237)');
    expect(res.hi).toBe('rgb(52, 179, 109)');
    await shot(page, 'benchmarks-dark-1440');
    await clickTab(page, 'howitworks');
    const code = await page.evaluate(() => getComputedStyle(document.querySelector('.hiw-formula')).backgroundColor);
    expect(code).toBe('rgb(31, 31, 31)');
    await shot(page, 'howitworks-dark-1440');
    await page.locator('#dark-toggle').click();
    expect(errors).toEqual([]);
  });
});
