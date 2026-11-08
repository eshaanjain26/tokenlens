import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const SHOT_DIR = process.env.SHOT_DIR || 'docs/qa/shell';
const BASELINE = !!process.env.BASELINE;

const NETWORK_NOISE = /openrouter\.ai|fonts\.googleapis\.com|fonts\.gstatic\.com/;
const KNOWN_ANALYTICS_NAN = /<path> attribute d: Expected number/;

const VIEWPORTS = [
  [360, 740],
  [390, 844],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
  [1920, 1080],
  [2560, 1440],
];
const TABS = ['compare', 'benchmarks', 'howitworks', 'analytics'];

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

async function dismissWelcome(page) {
  await page.locator('.onboard-start-btn').click({ force: BASELINE });
  await expect(page.locator('#onboarding-overlay')).toBeHidden();
}

async function openModelPicker(page) {
  if (await page.locator('#model-list').isVisible()) return false;
  const trigger = page.locator('#mobile-menu-btn:visible, #rail-btn-models:visible').first();
  await trigger.click({ force: BASELINE });
  await expect(page.locator('#model-list')).toBeVisible();
  return true;
}

async function closeModelPicker(page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('#model-list')).toBeHidden();
}

async function selectModelsAndSimulate(page) {
  await expect(page.locator('#model-list .model-item').first()).toBeAttached();
  const opened = await openModelPicker(page);
  const boxes = page.locator('#model-list .model-item input[type=checkbox]');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  if (opened) await closeModelPicker(page);
  await page.locator('#prompt-input').fill('Summarize the tradeoffs of prompt caching for a CPQ quoting assistant.');
  await page.locator('#send-btn').click({ force: BASELINE });
  await expect(page.locator('#columns-area .col-header')).toHaveCount(3, { timeout: 30000 });
}

async function clickTab(page, tab) {
  await page
    .locator(`.tab-btn[data-tab="${tab}"]:visible, .bn-btn[data-tab="${tab}"]:visible`)
    .first()
    .click({ force: BASELINE });
  await expect(page.locator(`#${tab}-panel`)).toHaveClass(/active/);
}

async function waitForToastsToClear(page) {
  await page.waitForFunction(() => !document.querySelector('#toast-container .toast'), null, { timeout: 12000 });
}

function measureLayout() {
  const visible = (el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) === 0) return false;
    const r = el.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const out = { overflowX: 0, headerBad: [], textareaOverlaps: [], headerHeight: 0 };
  out.overflowX = document.documentElement.scrollWidth - window.innerWidth;

  const header = document.querySelector('#header');
  const hr = header.getBoundingClientRect();
  out.headerHeight = hr.height;
  for (const el of header.querySelectorAll('*')) {
    if (!visible(el) || el.closest('#tools-dropdown')) continue;
    const r = el.getBoundingClientRect();
    if (r.left < hr.left - 0.5 || r.right > hr.right + 0.5 || r.top < hr.top - 0.5 || r.bottom > hr.bottom + 0.5) {
      out.headerBad.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + el.className) + ' ' + Math.round(r.left) + '-' + Math.round(r.right));
    }
  }

  const ta = document.querySelector('#prompt-input');
  if (ta && visible(ta)) {
    const tr = ta.getBoundingClientRect();
    const sx = document.documentElement.scrollLeft, sy = document.documentElement.scrollTop;
    void sx; void sy;
    for (const el of document.body.querySelectorAll('*')) {
      if (el === ta || el.contains(ta) || ta.contains(el)) continue;
      if (!visible(el)) continue;
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') continue;
      const r = el.getBoundingClientRect();
      const w = Math.min(r.right, tr.right) - Math.max(r.left, tr.left);
      const h = Math.min(r.bottom, tr.bottom) - Math.max(r.top, tr.top);
      if (w > 1 && h > 1) {
        const cs = getComputedStyle(el);
        const paints = cs.backgroundColor !== 'rgba(0, 0, 0, 0)' || el.children.length === 0 || cs.position === 'fixed';
        if (paints) out.textareaOverlaps.push((el.id ? '#' + el.id : el.tagName.toLowerCase() + '.' + String(el.className).slice(0, 30)));
      }
    }
  }
  return out;
}

async function assertLayout(page, label) {
  const m = await page.evaluate(measureLayout);
  expect.soft(m.overflowX, `${label}: horizontal overflow`).toBeLessThanOrEqual(0);
  expect.soft(m.headerBad, `${label}: header children outside header`).toEqual([]);
  expect.soft(m.textareaOverlaps, `${label}: elements overlapping #prompt-input`).toEqual([]);
}

async function assertTurnCards(page, label) {
  const m = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#compare-panel .turn-card')];
    const narrow = [], hidden = [];
    for (const c of cards) {
      const r = c.getBoundingClientRect();
      if (r.width < 280) narrow.push(Math.round(r.width));
      const stats = c.querySelector('.turn-stats');
      if (!stats) { hidden.push('no stats'); continue; }
      const sr = stats.getBoundingClientRect();
      if (sr.width < 200 || sr.height < 20) hidden.push('stats ' + Math.round(sr.width) + 'x' + Math.round(sr.height));
      for (const cell of stats.children) {
        const cr = cell.getBoundingClientRect();
        if (cr.width < 20 || cr.height < 10) hidden.push('cell ' + Math.round(cr.width) + 'x' + Math.round(cr.height));
      }
    }
    return { count: cards.length, narrow, hidden };
  });
  expect.soft(m.count, `${label}: turn cards rendered`).toBeGreaterThanOrEqual(3);
  expect.soft(m.narrow, `${label}: turn cards narrower than 280px`).toEqual([]);
  expect.soft(m.hidden, `${label}: turn stat cells collapsed`).toEqual([]);
}

async function assertMenusInViewport(page, label) {
  await page.locator('#tools-btn').click({ force: BASELINE });
  const tools = await page.evaluate(() => {
    const d = document.querySelector('#tools-dropdown');
    const r = d.getBoundingClientRect();
    return { top: r.top, bottom: window.innerHeight - r.bottom, left: r.left, right: window.innerWidth - r.right, scrolls: d.scrollHeight > d.clientHeight, overflowY: getComputedStyle(d).overflowY };
  });
  expect.soft(tools.top, `${label}: tools menu top`).toBeGreaterThanOrEqual(0);
  expect.soft(tools.bottom, `${label}: tools menu bottom edge inside viewport`).toBeGreaterThanOrEqual(-0.5);
  expect.soft(tools.left, `${label}: tools menu left`).toBeGreaterThanOrEqual(-0.5);
  expect.soft(tools.right, `${label}: tools menu right`).toBeGreaterThanOrEqual(-0.5);
  if (tools.scrolls) expect.soft(tools.overflowY, `${label}: tools menu scrolls`).toBe('auto');
  const last = page.locator('#tools-dropdown .tools-item').last();
  await last.scrollIntoViewIfNeeded();
  await expect.soft(last).toBeInViewport();
  await page.keyboard.press('Escape');
  await expect(page.locator('#tools-dropdown')).toBeHidden();

  await page.evaluate(() => document.querySelector('#tpl-btn').scrollIntoView({ block: 'center' }));
  await page.locator('#tpl-btn').click({ force: BASELINE });
  const tpl = await page.evaluate(() => {
    const d = document.querySelector('#tpl-dropdown');
    const r = d.getBoundingClientRect();
    return { top: r.top, bottom: window.innerHeight - r.bottom, left: r.left, right: window.innerWidth - r.right, scrolls: d.scrollHeight > d.clientHeight };
  });
  expect.soft(tpl.top, `${label}: templates menu top`).toBeGreaterThanOrEqual(0);
  expect.soft(tpl.bottom, `${label}: templates menu bottom`).toBeGreaterThanOrEqual(-0.5);
  expect.soft(tpl.left, `${label}: templates menu left`).toBeGreaterThanOrEqual(-0.5);
  expect.soft(tpl.right, `${label}: templates menu right`).toBeGreaterThanOrEqual(-0.5);
  const lastTpl = page.locator('#tpl-dropdown .tpl-item').last();
  await lastTpl.scrollIntoViewIfNeeded();
  await expect.soft(lastTpl).toBeInViewport();
  await page.locator('#prompt-input').click({ force: true });
  await page.locator('h1, .logo').first().click({ force: true, position: { x: 2, y: 2 } }).catch(() => {});
  await page.evaluate(() => { document.querySelector('#tpl-dropdown').classList.remove('open'); window.scrollTo(0, 0); });
}

async function shot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.evaluate(() => document.fonts && document.fonts.ready);
  await page.waitForTimeout(350);
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png') });
}

for (const [w, h] of VIEWPORTS) {
  test.describe(`viewport ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test(`shell holds together on all four tabs at ${w}px`, async ({ page }) => {
      const errors = trackErrors(page);
      await page.goto('/');
      await dismissWelcome(page);
      await selectModelsAndSimulate(page);
      await waitForToastsToClear(page);

      await page.evaluate(() => window.scrollTo(0, 0));
      await assertTurnCards(page, `${w}px compare`);
      await assertMenusInViewport(page, `${w}px`);

      for (const tab of TABS) {
        await clickTab(page, tab);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(400);
        await assertLayout(page, `${w}px ${tab}`);
        await shot(page, `${w}-${tab}`);
      }

      await clickTab(page, 'compare');
      await page.evaluate(() => window.scrollTo(0, 0));
      await assertLayout(page, `${w}px compare (return)`);

      expect.soft(errors).toEqual([]);
    });
  });
}

test.describe('dark mode', () => {
  for (const [w, h] of [[390, 844], [1440, 900], [1920, 1080]]) {
    test(`dark theme persists and renders at ${w}px`, async ({ page }) => {
      await page.setViewportSize({ width: w, height: h });
      await page.goto('/');
      await dismissWelcome(page);
      await selectModelsAndSimulate(page);
      await waitForToastsToClear(page);

      await page.locator('#dark-toggle').click({ force: BASELINE });
      await expect(page.locator('body')).toHaveClass(/dark/);
      await page.locator('#dark-toggle').click({ force: BASELINE });
      await expect(page.locator('body')).not.toHaveClass(/dark/);
      await page.locator('#dark-toggle').click({ force: BASELINE });
      await expect(page.locator('body')).toHaveClass(/dark/);
      expect.soft(await page.locator('#dark-toggle svg').count(), 'theme toggle keeps its svg icons').toBeGreaterThan(0);

      await page.evaluate(() => window.scrollTo(0, 0));
      await assertLayout(page, `dark ${w}px compare`);
      await shot(page, `dark-${w}-compare`);
      for (const tab of ['benchmarks', 'analytics']) {
        await clickTab(page, tab);
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.waitForTimeout(300);
        await shot(page, `dark-${w}-${tab}`);
      }

      await page.reload();
      await expect(page.locator('body')).toHaveClass(/dark/);
    });
  }
});

test.describe('modals at 390px', () => {
  test.use({ viewport: { width: 390, height: 844 } });

  const fits = (sel) => async (page) =>
    page.evaluate((s) => {
      const r = document.querySelector(s).getBoundingClientRect();
      return { top: r.top, left: r.left, right: window.innerWidth - r.right, bottom: window.innerHeight - r.bottom };
    }, sel);

  test('welcome modal fits the viewport and scrolls inside itself', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('.onboard-modal')).toBeVisible();
    const edge = await fits('.onboard-modal')(page);
    expect.soft(edge.top, 'welcome top').toBeGreaterThanOrEqual(-0.5);
    expect.soft(edge.left, 'welcome left').toBeGreaterThanOrEqual(-0.5);
    expect.soft(edge.right, 'welcome right').toBeGreaterThanOrEqual(-0.5);
    expect.soft(edge.bottom, 'welcome bottom').toBeGreaterThanOrEqual(-0.5);
    await shot(page, '390-welcome-modal');
    if (!BASELINE) {
      await expect(page.locator('#onboarding-overlay')).toHaveAttribute('role', 'dialog');
      const startVisible = await page.locator('.onboard-start-btn').isVisible();
      expect.soft(startVisible, 'start button reachable').toBe(true);
    }
  });

  test('tools modal fits the viewport, traps focus and closes on Escape', async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto('/');
    await dismissWelcome(page);
    await page.locator('#tools-btn').click({ force: BASELINE });
    await page.locator('#tools-dropdown .tools-item', { hasText: 'Prompt Optimizer' }).click({ force: BASELINE });
    await expect(page.locator('#optimizer-overlay')).toHaveClass(/open/);
    const edge = await fits('#optimizer-overlay .v6-modal')(page);
    expect.soft(edge.top, 'tool modal top').toBeGreaterThanOrEqual(-0.5);
    expect.soft(edge.left, 'tool modal left').toBeGreaterThanOrEqual(-0.5);
    expect.soft(edge.right, 'tool modal right').toBeGreaterThanOrEqual(-0.5);
    expect.soft(edge.bottom, 'tool modal bottom').toBeGreaterThanOrEqual(-0.5);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect.soft(overflow, 'no horizontal overflow with modal open').toBeLessThanOrEqual(0);
    await shot(page, '390-tools-modal');

    if (!BASELINE) {
      await expect(page.locator('#optimizer-overlay .v6-modal')).toHaveAttribute('role', 'dialog');
      await expect(page.locator('#optimizer-overlay .v6-modal')).toHaveAttribute('aria-modal', 'true');
      for (let i = 0; i < 14; i++) await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => !!document.activeElement.closest('#optimizer-overlay'));
      expect.soft(inside, 'focus stays inside the dialog').toBe(true);
      const inert = await page.evaluate(() => document.querySelector('#main').inert);
      expect.soft(inert, 'background is inert').toBe(true);
      await page.keyboard.press('Escape');
      await expect(page.locator('#optimizer-overlay')).not.toHaveClass(/open/);
      const restored = await page.evaluate(() => document.querySelector('#main').inert);
      expect.soft(restored, 'background interactive again').toBe(false);
    }
    expect.soft(errors).toEqual([]);
  });
});

test.describe('touch targets', () => {
  test.use({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });

  test('controls are at least 44px under a coarse pointer', async ({ page }) => {
    test.skip(BASELINE, 'new shell only');
    await page.goto('/');
    await dismissWelcome(page);
    expect(await page.evaluate(() => matchMedia('(pointer: coarse)').matches)).toBe(true);
    const small = await page.evaluate(() => {
      const sels = ['#dark-toggle', '#tools-btn', '#send-btn', '#mobile-menu-btn', '.bn-btn', '#currency-select', '#compress-btn', '#tpl-btn', '#model-search'];
      const bad = [];
      for (const s of sels) {
        for (const el of document.querySelectorAll(s)) {
          const r = el.getBoundingClientRect();
          if (r.width === 0 || r.height === 0) continue;
          if (r.height < 43.5 || r.width < 43.5) bad.push(s + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
        }
      }
      return bad;
    });
    expect(small).toEqual([]);
  });
});
