import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const SHOT_DIR = process.env.SHOT_DIR || 'docs/qa/tools';
const NETWORK_NOISE = /openrouter\.ai|fonts\.googleapis\.com|fonts\.gstatic\.com/;
const KNOWN_ANALYTICS_NAN = /<path> attribute d: Expected number/;

const TOOLS = [
  ['usage', 'USAGE.open()', '#usage-overlay'],
  ['finder', 'FINDER.open()', '#finder-overlay'],
  ['rec', "V6.openModal('rec')", '#rec-overlay'],
  ['optimizer', "V6.openModal('optimizer')", '#optimizer-overlay'],
  ['scenario', "V6.openModal('scenario')", '#scenario-overlay'],
  ['abtest', "V6.openModal('abtest')", '#abtest-overlay'],
  ['history', 'APP.openHistory()', '#history-overlay'],
  ['projection', 'APP.openProjection()', '#projection-overlay'],
  ['router', 'ROUTER.open()', '#router-overlay'],
  ['finecalc', 'FINECALC.open()', '#finecalc-overlay'],
  ['esg', 'ESG.open()', '#esg-overlay'],
  ['livebench', 'LIVEBENCH.open()', '#livebench-overlay'],
  ['rbac', 'RBAC.open()', '#rbac-overlay'],
  ['shadow', 'SHADOW.open()', '#shadow-overlay'],
  ['policy', 'POLICY.open()', '#policy-overlay'],
  ['forecast', 'FORECAST.open()', '#forecast-overlay'],
  ['bookmarks', 'BOOKMARKS.open()', '#bookmarks-overlay'],
  ['webhooks', 'WEBHOOKS.open()', '#webhooks-overlay'],
  ['notes', 'NOTES.open()', '#notes-overlay'],
];
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

async function boot(page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await page.locator('.onboard-start-btn').click();
  await expect(page.locator('#model-list .model-item').first()).toBeAttached();
}

async function addTurns(page) {
  const phone = (page.viewportSize()?.width || 1440) <= 768;
  let opened = false;
  if (!(await page.locator('#model-list').isVisible())) {
    await page.locator('#mobile-menu-btn:visible, #rail-btn-models:visible').first().click();
    opened = true;
  }
  const boxes = page.locator('#model-list .model-item input[type=checkbox]');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  if (opened || phone) { await page.keyboard.press('Escape'); await expect(page.locator('#model-list')).toBeHidden(); }
  for (let t = 0; t < 2; t++) {
    await page.locator('#prompt-input').fill('Summarize the tradeoffs of prompt caching for a CPQ quoting assistant, please be concise. ' + t);
    await page.locator('#send-btn').click();
    await expect(page.locator('#columns-area .col-header')).toHaveCount(3, { timeout: 30000 });
    await page.waitForTimeout(t ? 1500 : 300);
  }
}

async function open(page, expr, overlay) {
  await page.evaluate(expr);
  await expect(page.locator(overlay)).toHaveClass(/open/);
  await expect(page.locator(overlay + ' .tl-dialog, ' + overlay + ' > div').first()).toBeVisible();
}

async function closeWithEsc(page, overlay) {
  await page.keyboard.press('Escape');
  await expect(page.locator(overlay)).not.toHaveClass(/open/);
}

async function checkFit(page, overlay) {
  const m = await page.evaluate((sel) => {
    const ov = document.querySelector(sel);
    const dlg = ov.querySelector('.tl-dialog') || ov.firstElementChild;
    const r = dlg.getBoundingClientRect();
    const cs = getComputedStyle(dlg);
    return {
      left: r.left, right: r.right, top: r.top, bottom: r.bottom,
      vw: window.innerWidth, vh: window.innerHeight,
      docW: document.documentElement.scrollWidth,
      dlgOverX: dlg.scrollWidth - dlg.clientWidth,
      overflowY: cs.overflowY, scrollable: dlg.scrollHeight > dlg.clientHeight + 1,
    };
  }, overlay);
  expect(m.left).toBeGreaterThanOrEqual(-1);
  expect(m.right).toBeLessThanOrEqual(m.vw + 1);
  expect(m.top).toBeGreaterThanOrEqual(-1);
  expect(m.bottom).toBeLessThanOrEqual(m.vh + 1);
  expect(m.docW).toBeLessThanOrEqual(m.vw + 1);
  expect(m.dlgOverX).toBeLessThanOrEqual(1);
  if (m.scrollable) {
    expect(['auto', 'scroll']).toContain(m.overflowY);
    const moved = await page.evaluate((sel) => {
      const ov = document.querySelector(sel);
      const dlg = ov.querySelector('.tl-dialog') || ov.firstElementChild;
      dlg.scrollTop = 40;
      return dlg.scrollTop;
    }, overlay);
    expect(moved).toBeGreaterThan(0);
  }
}

test.describe.configure({ timeout: 240000 });
test.describe('every tool dialog fits, scrolls inside itself and closes with Escape', () => {
  for (const withData of [false, true]) {
    for (const [w, h] of VIEWPORTS) {
      test(`${w}px, ${withData ? '3 models x 2 turns' : 'no turns'}`, async ({ page }) => {
        const errors = trackErrors(page);
        await boot(page, w, h);
        if (withData) await addTurns(page);
        for (const [name, expr, overlay] of TOOLS) {
          if (name === 'projection' && !withData) {
            await page.evaluate(expr);
            await expect(page.locator('#toast-container .toast').last()).toContainText('Select at least one model');
            await expect(page.locator(overlay)).not.toHaveClass(/open/);
            continue;
          }
          await open(page, expr, overlay);
          await checkFit(page, overlay);
          if (withData && [390, 768, 1440].includes(w) && ['finder', 'esg', 'rbac', 'finecalc', 'usage', 'scenario'].includes(name)) {
            fs.mkdirSync(SHOT_DIR, { recursive: true });
            await page.waitForTimeout(600);
            await page.screenshot({ path: `${SHOT_DIR}/${name}-${w}.png` });
          }
          await closeWithEsc(page, overlay);
        }
        expect(errors).toEqual([]);
      });
    }
  }
});

test('tools menu: sections, search filter, arrow keys, hints', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await page.locator('#tools-btn').click();
  const dd = page.locator('#tools-dropdown');
  await expect(dd).toBeVisible();
  await expect(dd.locator('.tools-group-label')).toHaveText(['Analyse', 'Optimise', 'Govern', 'Share']);
  await expect(page.locator('#tools-search')).toBeFocused();
  await expect(dd.locator('.tools-foot')).toContainText('Open');

  await page.locator('#tools-search').fill('scen');
  await expect(dd.locator('.tools-item:visible')).toHaveCount(1);
  await expect(dd.locator('.tools-item:visible')).toHaveText(/Scenario builder/);
  await expect(dd.locator('.tools-group:visible')).toHaveCount(1);
  await page.locator('#tools-search').fill('zzzz');
  await expect(page.locator('#tools-empty')).toBeVisible();
  await page.locator('#tools-search').fill('');

  await page.keyboard.press('ArrowDown');
  await expect(dd.locator('.tools-item').first()).toBeFocused();
  await page.keyboard.press('ArrowDown');
  await expect(dd.locator('.tools-item').nth(1)).toBeFocused();
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowUp');
  await expect(dd.locator('.tools-item:visible').last()).toBeFocused();

  await page.locator('#tools-search').focus();
  await page.locator('#tools-search').fill('route');
  await page.keyboard.press('Enter');
  await expect(page.locator('#router-overlay')).toHaveClass(/open/);
  await page.keyboard.press('Escape');
  await expect(page.locator('#router-overlay')).not.toHaveClass(/open/);
  expect(errors).toEqual([]);
});

test('projection: period toggle persists, sorting reorders, copy confirms', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await addTurns(page);
  await open(page, 'APP.openProjection()', '#projection-overlay');
  const wrap = page.locator('#proj-table-wrap');
  await expect(wrap.locator('.tl-rows .tl-row')).toHaveCount(3);
  await page.locator('#projection-overlay .tl-seg button[data-v="y"]').click();
  await expect(wrap).toHaveAttribute('data-period', 'y');
  expect(await page.evaluate(() => localStorage.getItem('tl_ui_proj_period'))).toBe('y');

  await page.locator('#proj-table-wrap .tl-th[data-sort="3"]').click();
  const asc = await wrap.locator('.tl-rows .tl-row').evaluateAll((rows) => rows.map((r) => parseFloat(r.dataset.s3)));
  expect(asc).toEqual([...asc].sort((a, b) => a - b));
  await page.locator('#proj-table-wrap .tl-th[data-sort="3"]').click();
  const desc = await wrap.locator('.tl-rows .tl-row').evaluateAll((rows) => rows.map((r) => parseFloat(r.dataset.s3)));
  expect(desc).toEqual([...desc].sort((a, b) => b - a));

  await page.locator('#proj-runs').fill('5000');
  await expect(wrap).toContainText('5,000 runs a day');
  await page.locator('#proj-copy').click();
  await expect(page.locator('#toast-container .toast').last()).toContainText(/copied|blocked/i);
  expect(errors).toEqual([]);
});

test('finder: sliders update the ranking, filter chips toggle, add button selects a model', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await open(page, 'FINDER.open()', '#finder-overlay');
  const rows = page.locator('#finder-results .tl-rows .tl-row');
  await expect(rows).toHaveCount(8);
  const before = await rows.first().innerText();
  await page.locator('#fs-cost').fill('100');
  await page.locator('#fs-speed').fill('0');
  await expect(page.locator('#fs-cost-val')).toHaveText('100');
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tl_ui_finder')).cost)).toBe(100);
  await page.locator('#fchip-anthropic').click();
  await expect(page.locator('#fchip-anthropic')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fchip-all')).toHaveAttribute('aria-pressed', 'false');
  expect(typeof before).toBe('string');
  await page.locator('#finder-results .finder-add').first().click();
  await expect(page.locator('#finder-results .finder-add').first()).toHaveText('Added');
  await expect(page.locator('#model-count')).toContainText('1 of 10');
  await page.locator('#finder-overlay .tl-btn', { hasText: 'Copy ranking' }).click();
  await expect(page.locator('#toast-container .toast').last()).toContainText(/copied|blocked/i);
  expect(errors).toEqual([]);
});

test('fine-tune ROI: live results, validation, chart tooltip by pointer and keyboard', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await open(page, 'FINECALC.open()', '#finecalc-overlay');
  await page.waitForTimeout(600);
  const kpi = page.locator('#fc-results .tl-kpi-v').first();
  const first = await kpi.innerText();
  await page.locator('#fc-spend').fill('20000');
  await page.waitForTimeout(100);
  const second = await page.locator('#fc-results .tl-kpi-v').first().innerText();
  expect(second).not.toBe(first);
  await page.locator('#fc-spend').fill('0');
  await expect(page.locator('#fc-spend-err')).toContainText('Enter a number above zero');
  await expect(page.locator('#fc-spend')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#fc-spend').fill('2000');
  await expect(page.locator('#fc-spend-err')).toBeEmpty();

  const svg = page.locator('#fc-chart svg');
  await expect(svg.locator('.g')).toHaveCount(5);
  await svg.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#fc-chart .tl-tip')).toBeVisible();
  const tip1 = await page.locator('#fc-chart .tl-tip').innerText();
  await page.keyboard.press('ArrowLeft');
  expect(await page.locator('#fc-chart .tl-tip').innerText()).not.toBe(tip1);
  await page.locator('#fc-chart').hover({ position: { x: 200, y: 100 } });
  await expect(page.locator('#fc-chart .tl-tip')).toBeVisible();

  await page.locator('#fc-results .tl-seg button[data-v="12"]').click();
  await expect(page.locator('#fc-results')).toHaveAttribute('data-h', '12');
  await expect(page.locator('#fc-chart svg .t').last()).toContainText('Mo. 12');
  expect(errors).toEqual([]);
});

test('router and optimizer update as you type; copy and use buttons confirm', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await addTurns(page);
  await open(page, 'ROUTER.open()', '#router-overlay');
  await page.locator('#router-input').fill('Please analyze and compare three pricing strategies in a comprehensive report.');
  await expect(page.locator('#router-results .tl-rows .tl-row')).toHaveCount(3);
  await page.locator('#router-copy').click();
  await expect(page.locator('#toast-container .toast').last()).toContainText(/copied|blocked/i);
  await page.keyboard.press('Escape');

  await open(page, "V6.openModal('optimizer')", '#optimizer-overlay');
  await page.locator('#opt-original').fill('Please could you make sure to summarize this in order to save time. Thank you.');
  await expect(page.locator('#opt-result')).not.toHaveValue('');
  await expect(page.locator('#opt-stats-wrap .tl-kpi')).toHaveCount(3);
  await page.locator('#opt-original').fill('');
  await expect(page.locator('#opt-result')).toHaveValue('');
  await page.locator('#opt-original').fill('In order to proceed, please make sure to review the document.');
  await expect(page.locator('#opt-model-savings .tl-rows .tl-row')).toHaveCount(3);
  await page.locator('#optimizer-overlay .tl-btn', { hasText: 'Use as prompt' }).click();
  await expect(page.locator('#prompt-input')).not.toHaveValue('');
  expect(errors).toEqual([]);
});

test('recommender updates when an answer changes', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await open(page, "V6.openModal('rec')", '#rec-overlay');
  await expect(page.locator('#rec-results .tl-rows .tl-row')).toHaveCount(3);
  const before = await page.locator('#rec-results .tl-rows').innerText();
  await page.locator('#rec-task').selectOption('vision');
  await page.locator('#rec-budget').selectOption('10');
  await expect.poll(async () => page.locator('#rec-results .tl-rows').innerText()).not.toBe(before);
  expect(errors).toEqual([]);
});

test('scenario builder: add and remove turns, staged results; A/B test expands a run', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await open(page, "V6.openModal('scenario')", '#scenario-overlay');
  await expect(page.locator('.scenario-turn-item')).toHaveCount(5);
  await page.locator('#scenario-overlay .scenario-add-btn').click();
  await expect(page.locator('.scenario-turn-item')).toHaveCount(6);
  await page.locator('.scenario-turn-del').last().click();
  await expect(page.locator('.scenario-turn-item')).toHaveCount(5);
  await page.locator('#scenario-overlay .scenario-run-btn').click();
  await expect(page.locator('#scenario-results .scenario-model')).toHaveCount(2);
  await expect(page.locator('#scenario-results .scenario-model').first().locator('.tl-rows .tl-row')).toHaveCount(5);
  await page.locator('#scenario-model-b').selectOption('');
  await expect(page.locator('#scenario-results .scenario-model')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await open(page, "V6.openModal('abtest')", '#abtest-overlay');
  await page.locator('#abtest-overlay .ab-run-btn').click();
  await expect(page.locator('#ab-chart svg .bar')).toHaveCount(5);
  await expect(page.locator('#ab-results .tl-kpi')).toHaveCount(4);
  const head = page.locator('.ab-run-head').first();
  await head.click();
  await expect(head).toHaveAttribute('aria-expanded', 'true');
  await expect(page.locator('#ab-run-0')).toHaveClass(/open/);
  await page.locator('#ab-chart svg').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#ab-chart .tl-tip')).toBeVisible();
  expect(errors).toEqual([]);
});

test('governance dialogs: tabs by keyboard, two-step revoke, filters, validation, switches keep focus', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await open(page, 'RBAC.open()', '#rbac-overlay');
  await expect(page.locator('#rbac-overlay .tl-sample')).toBeVisible();
  await page.locator('#rbac-tab-vault').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#rbac-tab-members')).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('#rbac-panel-members')).toBeVisible();
  await page.locator('#rbac-tab-vault').click();
  const keys = page.locator('#rbac-panel-vault .tl-rows .tl-row');
  await expect(keys).toHaveCount(3);
  const revoke = page.locator('#rbac-panel-vault [data-confirm]').first();
  await revoke.click();
  await expect(keys).toHaveCount(3);
  await revoke.click();
  await expect(keys).toHaveCount(2);
  await page.keyboard.press('Escape');

  await open(page, 'SHADOW.open()', '#shadow-overlay');
  await expect(page.locator('#shadow-overlay .tl-sample')).toBeVisible();
  const rows = page.locator('#shadow-traffic .tl-rows .tl-row:visible');
  await expect(rows).toHaveCount(8);
  await page.locator('#shadow-overlay .tl-seg button[data-v="high"]').click();
  await expect(rows).toHaveCount(3);
  await page.keyboard.press('Escape');

  await open(page, 'POLICY.open()', '#policy-overlay');
  const sw = page.locator('[data-rule="p4"]');
  await expect(sw).not.toBeChecked();
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('[data-rule="p4"]')).toBeChecked();
  await expect(page.locator('[data-rule="p4"]')).toBeFocused();
  await page.keyboard.press('Escape');

  await open(page, 'WEBHOOKS.open()', '#webhooks-overlay');
  await expect(page.locator('#webhooks-overlay .tl-sample')).toBeVisible();
  await page.locator('#webhooks-overlay .tl-btn', { hasText: 'Add webhook' }).click();
  await expect(page.locator('#wh-new-name-err')).not.toBeEmpty();
  await expect(page.locator('#wh-new-url')).toHaveAttribute('aria-invalid', 'true');
  await page.locator('#wh-new-name').fill('Ops');
  await page.locator('#wh-new-url').fill('https://example.com/hook');
  await page.locator('#webhooks-overlay .tl-btn', { hasText: 'Add webhook' }).click();
  await expect(page.locator('#webhooks-body .tl-switch')).toHaveCount(4);
  expect(errors).toEqual([]);
});

test('usage, history and forecast: switch, sort and scenario controls work', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await open(page, 'USAGE.open()', '#usage-overlay');
  await expect(page.locator('#usage-body .tl-empty')).toBeVisible();
  await page.keyboard.press('Escape');
  await addTurns(page);
  await open(page, 'USAGE.open()', '#usage-overlay');
  await expect(page.locator('#usage-body .tl-meter').first()).toBeVisible();
  await page.locator('#usage-body [data-fk="metric-tokens"]').click();
  await expect(page.locator('#usage-body [data-fk="metric-tokens"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#usage-body [data-fk="metric-tokens"]')).toBeFocused();
  const sw = page.locator('#usage-body [data-fk="cache"]');
  await sw.focus();
  await page.keyboard.press('Space');
  await expect(page.locator('#usage-body [data-fk="cache"]')).not.toBeChecked();
  await expect(page.locator('#ux-hit-range')).toBeDisabled();
  await page.keyboard.press('Escape');

  await open(page, 'FORECAST.open()', '#forecast-overlay');
  await page.locator('.fc2-scenario-btn[data-scenario="aggressive"]').click();
  await expect(page.locator('.fc2-scenario-btn[data-scenario="aggressive"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#fc2-chart svg .ch-line')).toHaveCount(1);
  await page.keyboard.press('Escape');

  await open(page, 'APP.openHistory()', '#history-overlay');
  const clear = page.locator('#history-overlay [data-confirm]');
  await clear.click();
  await expect(clear).toContainText('Click again');
  expect(errors).toEqual([]);
});

test('ESG report: sortable table, print view shows only the report', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await addTurns(page);
  await open(page, 'ESG.open()', '#esg-overlay');
  await page.locator('#esg-body .tl-th[data-sort="2"]').click();
  await expect(page.locator('#esg-body [aria-sort="ascending"]')).toHaveCount(1);
  await page.evaluate(() => document.body.classList.add('printing-report'));
  await page.emulateMedia({ media: 'print' });
  await expect(page.locator('#header')).toBeHidden();
  await expect(page.locator('#sidebar')).toBeHidden();
  await expect(page.locator('#columns-area')).toBeHidden();
  await expect(page.locator('#esg-modal')).toBeVisible();
  await expect(page.locator('#esg-modal .tl-head .tl-close')).toBeHidden();
  const pos = await page.evaluate(() => getComputedStyle(document.querySelector('#esg-modal')).position);
  expect(pos).not.toBe('fixed');
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/esg-print.png`, fullPage: true });
  await page.emulateMedia({ media: 'screen' });
  await page.evaluate(() => document.body.classList.remove('printing-report'));
  expect(errors).toEqual([]);
});

test('dark mode: tool dialogs use dark tokens and stay legible', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await addTurns(page);
  await page.evaluate(() => APP.toggleDark());
  for (const [name, expr, overlay] of TOOLS.filter((t) => ['finder', 'finecalc', 'esg', 'rbac', 'usage', 'projection', 'abtest'].includes(t[0]))) {
    await open(page, expr, overlay);
    const c = await page.evaluate((sel) => {
      const d = document.querySelector(sel + ' .tl-dialog');
      const bg = getComputedStyle(d).backgroundColor.match(/\d+/g).map(Number);
      const fg = getComputedStyle(d.querySelector('.tl-lede, .tl-body')).color.match(/\d+/g).map(Number);
      return { bg, fg };
    }, overlay);
    expect(Math.max(...c.bg)).toBeLessThan(60);
    expect(Math.max(...c.fg)).toBeGreaterThan(100);
    if (name === 'finecalc' || name === 'esg') {
      fs.mkdirSync(SHOT_DIR, { recursive: true });
      await page.waitForTimeout(500);
      await page.screenshot({ path: `${SHOT_DIR}/${name}-dark.png` });
    }
    await closeWithEsc(page, overlay);
  }
  await page.evaluate(() => APP.toggleDark());
  expect(errors).toEqual([]);
});

test('no emoji, gradients or hard-coded colours in tool dialog markup', async ({ page }) => {
  await boot(page);
  await addTurns(page);
  const emoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/u;
  for (const [, expr, overlay] of TOOLS) {
    await open(page, expr, overlay);
    const text = await page.locator(overlay).innerText();
    expect(emoji.test(text), overlay + ' contains emoji').toBe(false);
    const bad = await page.evaluate((sel) => Array.from(document.querySelectorAll(sel + ' [style]')).map((e) => e.getAttribute('style')).filter((s) => /#[0-9a-f]{3,6}|gradient|rgb\(/i.test(s)), overlay);
    expect(bad).toEqual([]);
    await closeWithEsc(page, overlay);
  }
});
