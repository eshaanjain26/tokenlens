import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOT_DIR = process.env.SHOT_DIR || 'docs/qa/compare';
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

async function pick3(page) {
  await page.locator('#columns-area .empty-action').click();
  await expect(page.locator('#columns-area .model-col')).toHaveCount(3);
}

async function send(page, text, expectedCards) {
  await page.locator('#prompt-input').fill(text);
  await page.locator('#send-btn').click();
  await expect(page.locator('#columns-area .turn-card')).toHaveCount(expectedCards, { timeout: 30000 });
}

async function setup3x2(page) {
  await boot(page);
  await pick3(page);
  await send(page, 'Summarize the tradeoffs of prompt caching for a CPQ quoting assistant.', 3);
  await send(page, 'Now list the three biggest risks and how to measure each one.', 6);
}

async function shot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: true });
}

test('empty state keeps its header and offers one-click model picking', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await expect(page.locator('#columns-area .no-models-msg')).toBeVisible();
  await expect(page.locator('.view-toggle-bar h2')).toHaveText('Comparison');
  await expect(page.locator('#verdict-banner')).toBeHidden();
  await shot(page, 'empty-1440');
  await pick3(page);
  await expect(page.locator('#model-count')).toHaveText('3 of 10 selected');
  await expect(page.locator('#columns-area .turn-card')).toHaveCount(0);
  await expect(page.locator('#columns-area .col-turns').first()).toBeEmpty();
  expect(errors).toEqual([]);
});

test('3 models x 2 turns render the ledger layout', async ({ page }) => {
  const errors = trackErrors(page);
  await setup3x2(page);
  await expect(page.locator('#output-panel')).toBeVisible();
  await expect(page.locator('#op-cards .op-card')).toHaveCount(3);
  await expect(page.locator('#verdict-banner .vb-card')).toHaveCount(5);
  await expect(page.locator('#columns-area .turn-stat')).toHaveCount(6 * 8);
  const first = page.locator('#columns-area .turn-stat').first();
  await expect(first).toHaveAttribute('title', /tokens/);
  const bad = await page.evaluate(() => {
    const hits = [];
    for (const el of document.querySelectorAll('#compare-panel, #sidebar')) {
      const cs = getComputedStyle(el);
      if (cs.backgroundImage !== 'none') hits.push('gradient on ' + el.id);
    }
    const emoji = /\p{Extended_Pictographic}/u;
    for (const el of document.querySelectorAll('#compare-panel *')) {
      if (el.children.length === 0 && emoji.test(el.textContent)) hits.push('emoji: ' + el.textContent.slice(0, 20));
    }
    return hits;
  });
  expect(bad).toEqual([]);
  await shot(page, 'columns-1440');
  expect(errors).toEqual([]);
});

test('click a model name to follow it, Escape clears', async ({ page }) => {
  await setup3x2(page);
  const names = page.locator('#columns-area .col-name');
  await names.nth(1).click();
  await expect(page.locator('#columns-area .model-col.is-hl')).toHaveCount(1);
  await expect(page.locator('#columns-area .model-col.is-dim')).toHaveCount(2);
  await expect(page.locator('#op-cards .op-card.is-hl')).toHaveCount(1);
  await expect(page.locator('#hl-clear')).toBeVisible();
  await expect(names.nth(1)).toHaveAttribute('aria-pressed', 'true');
  await page.locator('#vt-matrix').click();
  await expect(page.locator('#matrix-area td.is-hl').first()).toBeVisible();
  await shot(page, 'highlight-matrix-1440');
  await page.keyboard.press('Escape');
  await expect(page.locator('#hl-clear')).toBeHidden();
  await expect(page.locator('#matrix-area .is-dim')).toHaveCount(0);
});

test('matrix sorts by header, keeps a sticky first column and marks the best value', async ({ page }) => {
  const errors = trackErrors(page);
  await setup3x2(page);
  await page.locator('#vt-matrix').click();
  await expect(page.locator('#vt-matrix')).toHaveAttribute('aria-pressed', 'true');
  const rowOrder = () => page.locator('#matrix-area tbody th.mx-turn').allTextContents();
  expect(await rowOrder()).toEqual(['Turn 1', 'Turn 2']);
  const btn = () => page.locator('#matrix-area .mx-sort[data-sortkey="tok|0"]');
  await btn().click();
  await expect(page.locator('#matrix-area th[aria-sort="ascending"]')).toHaveCount(1);
  expect(await rowOrder()).toEqual(['Turn 1', 'Turn 2']);
  await btn().click();
  await expect(page.locator('#matrix-area th[aria-sort="descending"]')).toHaveCount(1);
  expect(await rowOrder()).toEqual(['Turn 2', 'Turn 1']);
  await expect(btn()).toBeFocused();
  await btn().click();
  expect(await rowOrder()).toEqual(['Turn 1', 'Turn 2']);
  await expect(page.locator('#matrix-area th[aria-sort="ascending"]')).toHaveCount(1);
  const sticky = await page.evaluate(() => getComputedStyle(document.querySelector('#matrix-area tbody th.mx-turn')).position);
  expect(sticky).toBe('sticky');
  await expect(page.locator('#matrix-area tfoot')).toContainText('Total');
  expect(await page.locator('#matrix-area .mx-best').count()).toBeGreaterThan(0);
  await shot(page, 'matrix-1440');
  await page.reload();
  await page.locator('.onboard-start-btn').click({ timeout: 3000 }).catch(() => {});
  await expect(page.locator('#vt-matrix')).toHaveAttribute('aria-pressed', 'true');
  expect(errors).toEqual([]);
});

test('pin, remove, copy, show more and keyboard navigation work', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await setup3x2(page);

  await page.locator('#columns-area .js-pin').nth(2).click();
  await expect(page.locator('#columns-area .model-col.is-pinned')).toHaveCount(1);
  const order = await page.evaluate(() => getComputedStyle(document.querySelector('#columns-area .model-col.is-pinned')).order);
  expect(order).toBe('-1');
  expect(await page.evaluate(() => localStorage.getItem('tl_ui_compare_pins'))).toContain('/');

  await page.locator('#columns-area .col-name').first().focus();
  const pinnedId = await page.locator('#columns-area .model-col.is-pinned').getAttribute('data-model');
  await page.locator('#columns-area .model-col.is-pinned .col-name').focus();
  await page.keyboard.press('ArrowRight');
  const focusedModel = await page.evaluate(() => document.activeElement.closest('.model-col').getAttribute('data-model'));
  expect(focusedModel).not.toBe(pinnedId);
  await page.keyboard.press('ArrowLeft');
  expect(await page.evaluate(() => document.activeElement.closest('.model-col').getAttribute('data-model'))).toBe(pinnedId);

  const resp = page.locator('#columns-area .turn-response-text').first();
  const more = page.locator('#columns-area .js-more').first();
  await expect(more).toBeVisible();
  const before = await resp.evaluate((e) => e.clientHeight);
  await more.click();
  await expect(more).toHaveText('Show less');
  await expect(more).toHaveAttribute('aria-expanded', 'true');
  await expect.poll(() => resp.evaluate((e) => e.clientHeight)).toBeGreaterThan(before);
  await more.click();
  await expect(more).toHaveText('Show more');
  await expect.poll(() => resp.evaluate((e) => e.clientHeight)).toBe(before);

  const copy = page.locator('#columns-area .js-copy').first();
  const text = await resp.textContent();
  await copy.click();
  await expect(copy).toHaveClass(/copied/);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(text);

  await page.locator('#columns-area .js-remove').nth(1).click();
  await expect(page.locator('#columns-area .model-col')).toHaveCount(2);
  await expect(page.locator('#model-count')).toHaveText('2 of 10 selected');
});

test('rating, bookmark and note toggle with accessible state', async ({ page }) => {
  await setup3x2(page);
  const card = page.locator('#columns-area .turn-card').first();
  const up = card.locator('.rate-btn').first();
  await up.click();
  await expect(up).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#quality-leaderboard .ql-row')).toHaveCount(1);
  const bk = card.locator('.turn-annotation-btn').first();
  await bk.click();
  await expect(bk).toHaveClass(/bookmarked/);
  const noteBtn = card.locator('.turn-annotation-btn').nth(1);
  await noteBtn.click();
  await expect(noteBtn).toHaveAttribute('aria-expanded', 'true');
  await expect(card.locator('.turn-note-input')).toBeVisible();
});

test('sparkline hover and keyboard show a per-turn readout', async ({ page }) => {
  await setup3x2(page);
  const spark = page.locator('#columns-area .spark').first();
  await spark.scrollIntoViewIfNeeded();
  const box = await spark.boundingBox();
  await page.mouse.move(box.x + 2, box.y + box.height / 2);
  await expect(page.locator('#columns-area .sparkline-read').first()).toHaveText(/^Turn 1: /);
  await expect(spark.locator('.spark-cursor')).toBeVisible();
  await page.mouse.move(0, 0);
  await expect(page.locator('#columns-area .sparkline-read').first()).toHaveText(/^Peak /);
  await spark.focus();
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#columns-area .sparkline-read').first()).toHaveText(/^Turn 1: /);
});

test('totals count up and settle on the exact formatted value', async ({ page }) => {
  await setup3x2(page);
  await page.waitForTimeout(700);
  const mismatches = await page.evaluate(() => {
    const out = [];
    for (const m of STATE.getActiveModels()) {
      const id = 'col-' + m.id.replace(/[/]/g, '-');
      const s = STATE.getSession(m.id);
      const got = document.getElementById(id + '-t-cost').textContent;
      if (got !== CALC.fmtCost(s.totalCost)) out.push(got + ' vs ' + CALC.fmtCost(s.totalCost));
      if (document.getElementById(id + '-t-out').textContent !== s.totalOut.toLocaleString()) out.push('out');
    }
    return out;
  });
  expect(mismatches).toEqual([]);
});

test('reduced motion disables the count-up and clamp transition', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await setup3x2(page);
  const t = await page.evaluate(() => getComputedStyle(document.querySelector('.js-clamp')).transitionDuration);
  expect(parseFloat(t)).toBeLessThan(0.001);
});

for (const [w, h] of VIEWPORTS) {
  test(`no horizontal overflow at ${w}px (empty, columns, matrix)`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: w, height: h });
    await boot(page);
    const overflow = () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(await overflow(), 'empty').toBeLessThanOrEqual(0);
    await pick3(page);
    await send(page, 'Summarize the tradeoffs of prompt caching for a CPQ quoting assistant.', 3);
    await send(page, 'Now list the three biggest risks and how to measure each one.', 6);
    expect(await overflow(), 'columns').toBeLessThanOrEqual(0);
    await shot(page, `columns-${w}`);
    await page.locator('#vt-matrix').click();
    expect(await overflow(), 'matrix').toBeLessThanOrEqual(0);
    if (w === 390 || w === 1920) await shot(page, `matrix-${w}`);
    expect(errors).toEqual([]);
  });
}

test('dark mode toggles cleanly', async ({ page }) => {
  const errors = trackErrors(page);
  await setup3x2(page);
  await page.locator('#dark-toggle').click();
  await expect(page.locator('body')).toHaveClass(/dark/);
  const bg = await page.evaluate(() => getComputedStyle(document.querySelector('.model-col')).backgroundColor);
  expect(bg).toBe('rgb(20, 20, 20)');
  const ink = await page.evaluate(() => getComputedStyle(document.querySelector('.vb-name')).color);
  expect(ink).toBe('rgb(52, 179, 109)');
  await shot(page, 'dark-1440');
  await page.locator('#vt-matrix').click();
  await shot(page, 'dark-matrix-1440');
  await page.locator('#dark-toggle').click();
  await expect(page.locator('body')).not.toHaveClass(/dark/);
  expect(errors).toEqual([]);
});
