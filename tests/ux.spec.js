import { test, expect } from '@playwright/test';
import fs from 'node:fs';

const SHOT_DIR = 'docs/qa/ux';
const NETWORK_NOISE = /openrouter\.ai|fonts\.googleapis\.com|fonts\.gstatic\.com|ERR_FAILED/;
const KNOWN_ANALYTICS_NAN = /<path> attribute d: Expected number/;
const MODELS_URL = '**/openrouter.ai/api/v1/models';

const FIXTURE = {
  data: [
    { id: 'openai/gpt-4o-mini', name: 'OpenAI: GPT-4o mini', context_length: 128000, pricing: { prompt: '0.00000015', completion: '0.0000006' } },
    { id: 'anthropic/claude-haiku-4.5', name: 'Anthropic: Claude Haiku 4.5', context_length: 200000, pricing: { prompt: '0.000001', completion: '0.000005' } },
    { id: 'google/gemini-2.5-flash', name: 'Google: Gemini 2.5 Flash', context_length: 1000000, pricing: { prompt: '0.0000003', completion: '0.0000025' } },
    { id: 'mistralai/mistral-large', name: 'Mistral Large', context_length: 128000, pricing: { prompt: '0.000002', completion: '0.000006' } },
  ],
};

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

async function stubModels(page) {
  await page.route(MODELS_URL, (r) => r.fulfill({ json: FIXTURE }));
}

async function open(page, { welcome = false } = {}) {
  await stubModels(page);
  await page.goto('/');
  if (!welcome) await page.locator('.onboard-start-btn').click();
  await expect(page.locator('#model-list .model-item').first()).toBeAttached();
}

async function openPalette(page) {
  await page.keyboard.press('Control+k');
  await expect(page.locator('#palette-input')).toBeFocused();
}

async function shot(page, name) {
  fs.mkdirSync(SHOT_DIR, { recursive: true });
  await page.screenshot({ path: `${SHOT_DIR}/${name}.png` });
}

test.describe('command palette', () => {
  test('opens with Ctrl+K, filters, runs the highlighted action with Enter', async ({ page }) => {
    const errors = trackErrors(page);
    await open(page);
    await openPalette(page);
    const dialog = page.locator('#palette-dialog');
    await expect(dialog).toBeVisible();
    await expect(page.locator('#palette-input')).toBeFocused();
    await expect(dialog).toHaveAttribute('role', 'dialog');
    await expect(page.locator('#palette-input')).toHaveAttribute('role', 'combobox');
    await expect(page.locator('#palette-list')).toHaveAttribute('role', 'listbox');

    const all = await page.locator('#palette-list [role=option]').count();
    await page.keyboard.type('bench');
    const filtered = await page.locator('#palette-list [role=option]').count();
    expect(filtered).toBeGreaterThan(0);
    expect(filtered).toBeLessThan(all);
    const first = page.locator('#palette-list [role=option]').first();
    await expect(first).toHaveText(/Benchmarks/);
    await expect(first).toHaveAttribute('aria-selected', 'true');
    const activeId = await page.locator('#palette-input').getAttribute('aria-activedescendant');
    expect(activeId).toBe(await first.getAttribute('id'));

    await page.keyboard.press('Enter');
    await expect(dialog).toBeHidden();
    await expect(page.locator('#benchmarks-panel')).toHaveClass(/active/);
    const recent = await page.evaluate(() => JSON.parse(localStorage.getItem('tl_ui_recent')));
    expect(recent[0]).toBe('nav:benchmarks');
    expect(errors).toEqual([]);
  });

  test('arrow keys move the selection and recent actions lead the empty list', async ({ page }) => {
    await open(page);
    await page.evaluate(() => localStorage.setItem('tl_ui_recent', JSON.stringify(['nav:analytics'])));
    await page.getByRole('button', { name: 'Search actions and models' }).click();
    await expect(page.locator('#palette-input')).toBeFocused();
    await expect(page.locator('#palette-list [role=group]').first()).toHaveAttribute('aria-label', 'Recent');
    const opts = page.locator('#palette-list [role=option]');
    await expect(opts.nth(0)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowDown');
    await expect(opts.nth(1)).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowUp');
    await expect(opts.last()).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');
    await expect(page.locator('#palette-dialog')).toBeHidden();
  });

  test('selects a model by name and toggles dark mode and currency', async ({ page }) => {
    await open(page);
    await openPalette(page);
    await page.keyboard.type('select haiku');
    await expect(page.locator('#palette-list [role=option]').first()).toContainText('Claude Haiku 4.5');
    await page.keyboard.press('Enter');
    await expect(page.locator('#model-list .model-item input:checked')).toHaveCount(1);
    await expect(page.locator('#model-count')).toHaveText('1 of 10 selected');

    await openPalette(page);
    await page.keyboard.type('deselect haiku');
    await page.keyboard.press('Enter');
    await expect(page.locator('#model-count')).toHaveText('0 of 10 selected');

    await openPalette(page);
    await page.keyboard.type('dark mode');
    await page.keyboard.press('Enter');
    await expect(page.locator('body')).toHaveClass(/dark/);

    await openPalette(page);
    await page.keyboard.type('eur');
    await page.keyboard.press('Enter');
    await expect(page.locator('#currency-select')).toHaveValue('EUR');
  });

  test('shows an empty state for a query with no match', async ({ page }) => {
    await open(page);
    await openPalette(page);
    await page.keyboard.type('qzxjv');
    await expect(page.locator('#palette-list .pal-empty')).toBeVisible();
    await expect(page.locator('#palette-list [role=option]')).toHaveCount(0);
  });
});

test.describe('keyboard shortcuts', () => {
  test('g then letter switches tabs, d toggles dark, / focuses model search, ? opens the sheet', async ({ page }) => {
    await open(page);
    await page.keyboard.press('g');
    await page.keyboard.press('a');
    await expect(page.locator('#analytics-panel')).toHaveClass(/active/);
    await page.keyboard.press('g');
    await page.keyboard.press('b');
    await expect(page.locator('#benchmarks-panel')).toHaveClass(/active/);
    await page.keyboard.press('g');
    await page.keyboard.press('h');
    await expect(page.locator('#howitworks-panel')).toHaveClass(/active/);
    await page.keyboard.press('g');
    await page.keyboard.press('c');
    await expect(page.locator('#compare-panel')).toHaveClass(/active/);

    await page.keyboard.press('d');
    await expect(page.locator('body')).toHaveClass(/dark/);
    await page.keyboard.press('d');
    await expect(page.locator('body')).not.toHaveClass(/dark/);

    await page.keyboard.press('/');
    await expect(page.locator('#model-search')).toBeFocused();
    await expect(page.locator('#model-search')).toHaveValue('');

    await page.locator('#model-search').blur();
    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-dialog')).toBeVisible();
    await expect(page.locator('#shortcuts-dialog')).toContainText('Go to');
    await page.keyboard.press('Escape');
    await expect(page.locator('#shortcuts-dialog')).toBeHidden();
  });

  test('single-key shortcuts are ignored while typing', async ({ page }) => {
    await open(page);
    await page.locator('#prompt-input').click();
    await page.keyboard.type('d? g a /');
    await expect(page.locator('#prompt-input')).toHaveValue('d? g a /');
    await expect(page.locator('body')).not.toHaveClass(/dark/);
    await expect(page.locator('#compare-panel')).toHaveClass(/active/);
    await expect(page.locator('#shortcuts-dialog')).toBeHidden();
    await page.locator('#model-search').click();
    await page.keyboard.type('d');
    await expect(page.locator('body')).not.toHaveClass(/dark/);
  });

  test('shortcuts sheet opens from the palette', async ({ page }) => {
    await open(page);
    await openPalette(page);
    await page.keyboard.type('shortcuts');
    await page.keyboard.press('Enter');
    await expect(page.locator('#shortcuts-dialog')).toBeVisible();
  });
});

test.describe('welcome flow', () => {
  test.use({ viewport: { width: 360, height: 640 } });

  test('fits 360x640, steps with dots, skippable and remembered', async ({ page }) => {
    const errors = trackErrors(page);
    await open(page, { welcome: true });
    const dialog = page.locator('.onboard-modal');
    await expect(dialog).toBeVisible();
    const box = await dialog.boundingBox();
    expect(box.y).toBeGreaterThanOrEqual(0);
    expect(box.y + box.height).toBeLessThanOrEqual(640);
    expect(await dialog.evaluate((e) => e.scrollHeight <= e.clientHeight + 1)).toBe(true);
    for (const sel of ['.onboard-start-btn', '#onboard-example', '.onboard-skip']) {
      const b = await page.locator(sel).boundingBox();
      expect(b.y + b.height).toBeLessThanOrEqual(640);
    }
    await shot(page, 'welcome-360x640');

    await expect(page.locator('.onboard-dot')).toHaveCount(3);
    await expect(page.locator('.onboard-step:not([hidden]) .onboard-step-title')).toHaveText('Pick models');
    await page.locator('#onboard-next').click();
    await expect(page.locator('.onboard-step:not([hidden]) .onboard-step-title')).toHaveText('Write a prompt');
    await page.locator('.onboard-dot').nth(2).click();
    await expect(page.locator('.onboard-step:not([hidden]) .onboard-step-title')).toHaveText('Read the verdict');
    await expect(page.locator('.onboard-dot').nth(2)).toHaveAttribute('aria-current', 'step');
    await shot(page, 'welcome-step3-360x640');

    await page.locator('.onboard-skip').click();
    await expect(page.locator('#onboarding-overlay')).toBeHidden();
    expect(await page.evaluate(() => localStorage.getItem('lti_onboarded_v1'))).toBe('1');
    await page.reload();
    await expect(page.locator('#onboarding-overlay')).toBeHidden();
    expect(errors).toEqual([]);
  });

  test('Try an example selects 3 models and fills a prompt', async ({ page }) => {
    await open(page, { welcome: true });
    await expect(page.locator('#onboard-example')).toBeEnabled();
    await page.locator('#onboard-example').click();
    await expect(page.locator('#onboarding-overlay')).toBeHidden();
    await expect(page.locator('[data-models-count]').first()).toHaveText('3');
    await expect(page.locator('#prompt-input')).not.toHaveValue('');
    await expect(page.locator('#toast-container .toast-action')).toBeVisible();
    await page.locator('#toast-container .toast-action').click();
    await expect(page.locator('#columns-area .col-header')).toHaveCount(3, { timeout: 30000 });
  });
});

test.describe('data status', () => {
  test('shows Offline with a retry button when the models route is aborted, then recovers', async ({ page }) => {
    const errors = trackErrors(page);
    await page.route(MODELS_URL, (r) => r.abort());
    await page.goto('/');
    await page.locator('.onboard-start-btn').click();
    await expect(page.locator('#model-list .model-item').first()).toBeAttached();
    const chip = page.locator('#data-status-chip');
    await expect(chip).toHaveText('Offline');
    await expect(page.locator('#data-status')).toHaveAttribute('data-state', 'offline');
    const retry = page.locator('#data-status-retry');
    await expect(retry).toBeVisible();
    await expect(page.locator('#footer-status')).toHaveText('Offline');
    await shot(page, 'offline-chip');

    await page.unroute(MODELS_URL);
    await stubModels(page);
    await retry.click();
    await expect(chip).toHaveText('Live');
    await expect(retry).toBeHidden();
    await expect(page.locator('#model-list .model-item')).toHaveCount(FIXTURE.data.length);
    expect(errors).toEqual([]);
  });

  test('shows skeleton rows while the model list loads', async ({ page }) => {
    let release;
    const gate = new Promise((res) => { release = res; });
    await page.route(MODELS_URL, async (r) => { await gate; await r.fulfill({ json: FIXTURE }); });
    await page.goto('/');
    await expect(page.locator('#model-list .model-skeleton')).toHaveCount(8);
    await expect(page.locator('#data-status-chip')).toHaveText('Loading');
    await expect(page.locator('#model-list')).toHaveAttribute('aria-busy', 'true');
    release();
    await expect(page.locator('#model-list .model-item').first()).toBeAttached();
    await expect(page.locator('#model-list .model-skeleton')).toHaveCount(0);
  });

  test('empty search shows a message and a clear button', async ({ page }) => {
    await open(page);
    await page.locator('#model-search').fill('zzzzqq');
    await expect(page.locator('#model-empty')).toBeVisible();
    await expect(page.locator('#model-empty-text')).toContainText('zzzzqq');
    await page.locator('#model-empty-clear').click();
    await expect(page.locator('#model-empty')).toBeHidden();
    await expect(page.locator('#model-list .model-item')).toHaveCount(FIXTURE.data.length);
  });
});

test.describe('toasts', () => {
  test('stack is capped at 3, errors use role alert, action runs and dismisses', async ({ page }) => {
    await open(page);
    await page.evaluate(() => {
      TOAST.info('one'); TOAST.success('two'); TOAST.warning('three'); TOAST.error('four');
    });
    await expect(page.locator('#toast-container .toast')).toHaveCount(3);
    await expect(page.locator('#toast-container .toast.error')).toHaveAttribute('role', 'alert');
    await expect(page.locator('#toast-container')).toHaveAttribute('aria-live', 'polite');
    await page.evaluate(() => {
      window.__acted = false;
      TOAST.info('with action', { action: { label: 'Undo', onClick: () => { window.__acted = true; } } });
    });
    await page.locator('#toast-container .toast-action').click();
    expect(await page.evaluate(() => window.__acted)).toBe(true);
    await expect(page.locator('#toast-container .toast-action')).toHaveCount(0);
  });

  test('emoji in messages from other modules are removed', async ({ page }) => {
    await open(page);
    await page.evaluate(() => TOAST.show('\u{1F516} Bookmarked ✓', 'info'));
    await expect(page.locator('#toast-container .toast-msg').last()).toHaveText('Bookmarked');
  });
});

test.describe('header, footer and meta', () => {
  test('active tab indicator moves with the tab using transform only', async ({ page }) => {
    await open(page);
    const ind = page.locator('.tab-indicator');
    const before = await ind.evaluate((e) => e.style.transform);
    await page.locator('.tab-btn[data-tab="analytics"]').click();
    await expect.poll(() => ind.evaluate((e) => e.style.transform)).not.toBe(before);
    expect(await ind.evaluate((e) => getComputedStyle(e).transitionProperty)).toBe('transform');
  });

  test('theme follows the system preference until a choice is stored', async ({ browser }) => {
    const ctx = await browser.newContext({ colorScheme: 'dark' });
    const page = await ctx.newPage();
    await open(page);
    await expect(page.locator('body')).toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('lti_theme_v1'))).toBeNull();
    await page.locator('#dark-toggle').click();
    await expect(page.locator('body')).not.toHaveClass(/dark/);
    expect(await page.evaluate(() => localStorage.getItem('lti_theme_v1'))).toBe('light');
    await page.reload();
    await page.locator('.onboard-start-btn').click({ timeout: 2000 }).catch(() => {});
    await expect(page.locator('body')).not.toHaveClass(/dark/);
    await ctx.close();
  });

  test('skip link moves focus to the content', async ({ page }) => {
    await page.addInitScript(() => localStorage.setItem('lti_onboarded_v1', '1'));
    await stubModels(page);
    await page.goto('/');
    await expect(page.locator('#model-list .model-item').first()).toBeAttached();
    await page.keyboard.press('Tab');
    const link = page.locator('.skip-link');
    await expect(link).toBeFocused();
    expect((await link.boundingBox()).y).toBeGreaterThanOrEqual(0);
    await page.keyboard.press('Enter');
    await expect(page.locator('#content')).toBeFocused();
  });

  test('meta tags, manifest and icons are in place', async ({ page, request }) => {
    await open(page);
    await expect(page.locator('meta[name="description"]')).toHaveAttribute('content', /Compare LLM cost/);
    await expect(page.locator('meta[name="theme-color"]')).toHaveCount(2);
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', /og\.png$/);
    const manifestHref = await page.locator('link[rel="manifest"]').getAttribute('href');
    const res = await request.get(new URL(manifestHref, page.url()).href);
    expect(res.ok()).toBe(true);
    const manifest = await res.json();
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBe('TokenLens');
    for (const icon of manifest.icons) {
      const r = await request.get(new URL(icon.src, page.url()).href);
      expect(r.ok(), icon.src).toBe(true);
    }
  });

  test('footer has data sources, methodology link, GitHub link, star and version', async ({ page }) => {
    await open(page);
    const footer = page.locator('#freshness-bar');
    await expect(footer).toContainText('OpenRouter');
    await expect(footer).toContainText('Luccioni');
    await expect(footer.locator('a[href="https://github.com/eshaanjain26/tokenlens"]')).toHaveCount(2);
    await expect(footer.locator('.fb-star')).toContainText('Star');
    await expect(page.locator('#app-version')).toHaveText(/^TokenLens v\d+\.\d+\.\d+/);
    await footer.locator('.fb-link', { hasText: 'Methodology' }).click();
    await expect(page.locator('#howitworks-panel')).toHaveClass(/active/);
  });
});

test.describe('phone footer', () => {
  test.use({ viewport: { width: 360, height: 740 } });

  test('footer does not overlap the bottom nav and the page does not overflow', async ({ page }) => {
    await open(page);
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(300);
    const footer = await page.locator('#freshness-bar').boundingBox();
    const nav = await page.locator('#bottom-nav').boundingBox();
    expect(footer.y + footer.height).toBeLessThanOrEqual(nav.y + 0.5);
    const links = await page.locator('.fb-links').boundingBox();
    const fab = await page.locator('#notes-fab').boundingBox();
    const overlapX = links.x + links.width > fab.x && fab.x + fab.width > links.x;
    const overlapY = links.y + links.height > fab.y && fab.y + fab.height > links.y;
    expect(overlapX && overlapY).toBe(false);
    await shot(page, 'footer-360x740');
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  });
});

for (const [w, h] of [[360, 740], [390, 844], [768, 1024], [1024, 768], [1280, 800], [1440, 900], [1920, 1080], [2560, 1440]]) {
  test(`no horizontal overflow with palette, shortcuts and welcome at ${w}`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.setViewportSize({ width: w, height: h });
    await open(page, { welcome: true });
    const fits = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
    expect(await fits()).toBe(true);
    await page.locator('.onboard-start-btn').click();
    expect(await fits()).toBe(true);
    await openPalette(page);
    await expect(page.locator('#palette-dialog')).toBeVisible();
    await page.keyboard.type('gpt');
    expect(await fits()).toBe(true);
    const pbox = await page.locator('#palette-dialog').boundingBox();
    expect(pbox.x).toBeGreaterThanOrEqual(0);
    expect(pbox.x + pbox.width).toBeLessThanOrEqual(w + 0.5);
    if (w === 1440) await shot(page, 'palette-1440x900');
    await page.keyboard.press('Escape');
    await page.keyboard.press('?');
    await expect(page.locator('#shortcuts-dialog')).toBeVisible();
    expect(await fits()).toBe(true);
    if (w === 390) await shot(page, 'shortcuts-390x844');
    await page.keyboard.press('Escape');
    for (const tab of ['benchmarks', 'howitworks', 'analytics', 'compare']) {
      await page.keyboard.press('g');
      await page.keyboard.press({ benchmarks: 'b', howitworks: 'h', analytics: 'a', compare: 'c' }[tab]);
      await expect(page.locator(`#${tab}-panel`)).toHaveClass(/active/);
      expect(await fits()).toBe(true);
    }
    expect(errors).toEqual([]);
  });
}

test('dark mode palette and welcome render', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await stubModels(page);
  await page.goto('/');
  await expect(page.locator('body')).toHaveClass(/dark/);
  await shot(page, 'welcome-dark-1440x900');
  await page.locator('.onboard-start-btn').click();
  await openPalette(page);
  await expect(page.locator('#palette-dialog')).toBeVisible();
  await shot(page, 'palette-dark-1440x900');
});
