import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const NETWORK_NOISE = /openrouter\.ai|fonts\.googleapis\.com|fonts\.gstatic\.com/;
// Pre-existing bug: Analytics charts emit NaN SVG paths after a single-turn session. Tracked separately, not fixed in the migration PR.
const KNOWN_ANALYTICS_NAN = /<path> attribute d: Expected number/;

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
  await page.locator('.onboard-start-btn', { hasText: 'Get Started' }).click();
  await expect(page.locator('#model-list .model-item').first()).toBeVisible();
}

async function selectModelsAndSend(page) {
  const boxes = page.locator('#model-list .model-item input[type=checkbox]');
  for (let i = 0; i < 3; i++) await boxes.nth(i).check();
  await page.locator('#prompt-input').fill('Summarize the tradeoffs of prompt caching for a CPQ quoting assistant.');
  await page.locator('#send-btn').click();
  await expect(page.locator('#columns-area .col-header')).toHaveCount(3, { timeout: 30000 });
}

test('compare flow and top tabs', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await selectModelsAndSend(page);

  await expect(page.locator('#compare-panel')).toBeVisible();
  const shotDir = process.env.SHOT_DIR;
  if (shotDir) {
    fs.mkdirSync(shotDir, { recursive: true });
    await page.waitForTimeout(1500);
    await page.screenshot({ path: path.join(shotDir, 'compare-1440x900.png') });
  }

  for (const [tab, panel] of [
    ['benchmarks', '#benchmarks-panel'],
    ['howitworks', '#howitworks-panel'],
    ['analytics', '#analytics-panel'],
    ['compare', '#compare-panel'],
  ]) {
    await page.locator('.tab-btn[data-tab="' + tab + '"]').click();
    await expect(page.locator(panel)).toBeVisible();
    await expect(page.locator(panel)).toHaveClass(/active/);
    await page.waitForTimeout(300);
  }

  expect(errors).toEqual([]);
});

test('usage panel, ESG modal and history modal open without errors', async ({ page }) => {
  const errors = trackErrors(page);
  await boot(page);
  await selectModelsAndSend(page);

  await page.locator('#usage-pill').click();
  await expect(page.locator('#usage-modal')).toBeVisible();
  await expect(page.locator('#usage-body')).not.toBeEmpty();
  await page.locator('#usage-overlay .ux-icon[aria-label="Close usage panel"]').click();
  await expect(page.locator('#usage-modal')).toBeHidden();

  await page.locator('#tools-btn').click();
  await page.locator('#tools-dropdown .tools-item', { hasText: 'ESG Report' }).click();
  await expect(page.locator('#esg-modal')).toBeVisible();
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.ESG.close && window.ESG.close());
  await expect(page.locator('#esg-modal')).toBeHidden();

  await page.locator('#tools-btn').click();
  await page.locator('#tools-dropdown .tools-item', { hasText: 'Session History' }).click();
  await expect(page.locator('#history-overlay')).toHaveClass(/open/);
  await page.evaluate(() => window.APP.closeHistory());
  await expect(page.locator('#history-overlay')).not.toHaveClass(/open/);

  expect(errors).toEqual([]);
});
