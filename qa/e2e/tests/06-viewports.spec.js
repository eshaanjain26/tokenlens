const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { open, selectModels, send, shot, openTool, expect, SHOTS } = require('./helpers');

const VPS = [[390, 812], [768, 1024], [1280, 720], [1440, 900], [1920, 1080]];
const report = {};
const REPORT = path.join(SHOTS, '..', 'viewport-report.json');

async function metrics(page, scope) {
  return page.evaluate(scope => {
    const root = scope ? document.querySelector(scope) : document.body;
    const vw = innerWidth, vh = innerHeight;
    const hscroll = document.documentElement.scrollWidth > vw;
    const clipped = [];
    const small = [];
    root.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [role=tab], [onclick]').forEach(el => {
      const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
      if (!r.width || !r.height || cs.visibility === 'hidden' || cs.display === 'none') return;
      if (r.bottom < 0 || r.top > vh * 3) return;
      const tag = (el.id ? '#' + el.id : (typeof el.className === 'string' ? '.' + el.className.split(' ')[0] : el.tagName)) + ' "' + (el.textContent || el.placeholder || '').trim().slice(0, 18) + '"';
      if (vw <= 768 && (r.width < 44 || r.height < 44) && el.type !== 'checkbox' && !el.closest('#model-list')) small.push(tag + ' ' + Math.round(r.width) + 'x' + Math.round(r.height));
      if (r.left < -1 || r.right > vw + 1) clipped.push(tag + ' x=' + Math.round(r.left) + '..' + Math.round(r.right));
    });
    // text overflow / clipped text
    const clippedText = [];
    root.querySelectorAll('h1,h2,h3,.model-id,.model-name,.logo-name,.tab-btn,.cur-btn,button').forEach(el => {
      const r = el.getBoundingClientRect(); if (!r.width) return;
      const cs = getComputedStyle(el);
      if (cs.overflow !== 'visible' && el.scrollWidth > el.clientWidth + 2 && cs.textOverflow !== 'ellipsis') clippedText.push((el.id || el.className) + ' "' + el.textContent.trim().slice(0, 18) + '" ' + el.scrollWidth + '>' + el.clientWidth);
    });
    // overlapping fixed elements: freshness bar vs toast vs fab
    const fixed = [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none').map(e => ({ id: e.id || (typeof e.className === 'string' ? e.className.split(' ')[0] : ''), r: e.getBoundingClientRect() }));
    const overlaps = [];
    for (let i = 0; i < fixed.length; i++) for (let j = i + 1; j < fixed.length; j++) {
      const a = fixed[i].r, b = fixed[j].r; if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom && !/overlay|modal/.test(fixed[i].id + fixed[j].id)) overlaps.push(fixed[i].id + ' x ' + fixed[j].id);
    }
    return { vw, vh, hscroll, scrollW: document.documentElement.scrollWidth, clipped: clipped.slice(0, 8), small: small.length, smallEx: small.slice(0, 8), clippedText: clippedText.slice(0, 6), overlaps };
  }, scope);
}

for (const [w, h] of VPS) {
  test.describe(`viewport ${w}x${h}`, () => {
    test.use({ viewport: { width: w, height: h } });

    test('compare tab, 3 models, 2 turns', async ({ page }) => {
      const errs = await open(page, { mode: 'offline' });
      if (w <= 768) await page.evaluate(() => { document.getElementById('mobile-menu-btn') && 0; });
      // select models through the app API on small screens (sidebar is a drawer)
      await page.evaluate(() => { ['openai/gpt-4o', 'anthropic/claude-3-haiku', 'openai/gpt-3.5-turbo'].forEach(id => APP.toggleModel(id)); });
      await page.fill('#prompt-input', 'Explain transformers in detail please.');
      await page.evaluate(() => document.getElementById('send-btn').click());
      await page.waitForTimeout(300);
      await page.fill('#prompt-input', 'Now compare them with state space models.');
      await page.evaluate(() => document.getElementById('send-btn').click());
      await page.waitForTimeout(400);
      const m = await metrics(page);
      report[`${w}x${h}/compare`] = m;
      await shot(page, `vp-${w}x${h}-compare`);
      expect.soft(m.hscroll, `horizontal overflow at ${w}x${h}: scrollWidth ${m.scrollW}`).toBe(false);
      expect.soft(m.clipped, `elements outside viewport: ${m.clipped.join(' ; ')}`).toEqual([]);
      if (w <= 768) expect.soft(m.small, `tap targets < 44px (${m.small}): ${m.smallEx.join(' ; ')}`).toBe(0);
      // can the user actually see the turn cards? first turn-card top must be inside viewport
      const vis = await page.evaluate(() => { const t = document.querySelector('.turn-card'); if (!t) return null; const r = t.getBoundingClientRect(); const cont = t.parentElement.getBoundingClientRect(); return { top: r.top, h: r.height, contH: cont.height, vh: innerHeight, contTop: cont.top }; });
      report[`${w}x${h}/turnvis`] = vis;
      expect.soft(vis.contH, `turn list container is only ${Math.round(vis.contH)}px tall at ${w}x${h} (card is ${Math.round(vis.h)}px)`).toBeGreaterThan(200);
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
      expect.soft(errs, errs.join('\n')).toEqual([]);
    });

    test('tabs: benchmarks / analytics / how-it-works', async ({ page }) => {
      await open(page, { mode: 'offline' });
      await page.evaluate(() => { ['openai/gpt-4o', 'anthropic/claude-3-haiku'].forEach(id => APP.toggleModel(id)); });
      await page.fill('#prompt-input', 'Explain RAG'); await page.evaluate(() => document.getElementById('send-btn').click()); await page.waitForTimeout(200);
      for (const tab of ['benchmarks', 'analytics', 'howitworks']) {
        await page.evaluate(t => document.querySelector(`.tab-btn[data-tab="${t}"]`).click(), tab);
        await page.waitForTimeout(300);
        const m = await metrics(page, '#' + tab + '-panel');
        report[`${w}x${h}/${tab}`] = m;
        expect.soft(m.hscroll, `${tab}: page horizontal overflow at ${w}x${h} (scrollWidth ${m.scrollW})`).toBe(false);
        const inner = await page.evaluate(t => { const p = document.getElementById(t + '-panel'); return { sw: p.scrollWidth, cw: p.clientWidth }; }, tab);
        expect.soft(inner.sw <= inner.cw + 2, `${tab} panel content wider than panel at ${w}x${h}: ${inner.sw} > ${inner.cw}`).toBe(true);
        await shot(page, `vp-${w}x${h}-${tab}`);
      }
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
    });

    test('header, tools menu, modals fit', async ({ page }) => {
      await open(page, { mode: 'offline' });
      await page.evaluate(() => { APP.toggleModel('openai/gpt-4o'); });
      const hdr = await page.evaluate(() => { const h = document.getElementById('header'); const kids = [...h.children].filter(c => c.getBoundingClientRect().width > 0).map(c => ({ id: c.id || c.className.toString().split(' ')[0], r: c.getBoundingClientRect() })); const over = kids.filter(k => k.r.right > innerWidth + 1 || k.r.left < -1).map(k => k.id + ' ' + Math.round(k.r.left) + '..' + Math.round(k.r.right)); return { h: h.getBoundingClientRect().height, over, sw: h.scrollWidth, cw: h.clientWidth }; });
      expect.soft(hdr.over, `header children outside the viewport at ${w}x${h}: ${hdr.over.join(' ; ')}`).toEqual([]);
      expect.soft(hdr.sw <= hdr.cw + 1, `header content wider than header: ${hdr.sw} > ${hdr.cw}`).toBe(true);
      await page.click('#tools-btn');
      const dd = await page.evaluate(() => { const d = document.getElementById('tools-dropdown'); const r = d.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, h: r.height, vh: innerHeight, sh: d.scrollHeight, ov: getComputedStyle(d).overflowY, left: r.left, right: r.right, vw: innerWidth }; });
      await shot(page, `vp-${w}x${h}-tools-menu`);
      expect.soft(dd.right <= dd.vw + 1 && dd.left >= -1, `tools dropdown horizontally outside viewport ${JSON.stringify(dd)}`).toBe(true);
      expect.soft(dd.bottom <= dd.vh + 1 || dd.ov !== 'visible', `tools dropdown taller than viewport and not scrollable ${JSON.stringify(dd)}`).toBe(true);
      await page.keyboard.press('Escape');
      // usage modal
      await page.evaluate(() => USAGE.open());
      const um = await page.evaluate(() => { const r = document.getElementById('usage-modal').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, vw: innerWidth, vh: innerHeight }; });
      expect.soft(um.l >= -1 && um.r <= um.vw + 1, `usage modal outside viewport ${JSON.stringify(um)}`).toBe(true);
      await shot(page, `vp-${w}x${h}-usage`);
      await page.keyboard.press('Escape');
      // templates dropdown
      await page.evaluate(() => document.getElementById('tpl-btn').click());
      const td = await page.evaluate(() => { const d = document.getElementById('tpl-dropdown'); const r = d.getBoundingClientRect(); return { t: r.top, b: r.bottom, l: r.left, r: r.right, vw: innerWidth, vh: innerHeight }; });
      await shot(page, `vp-${w}x${h}-templates`);
      expect.soft(td.t >= 0 && td.r <= td.vw + 1, `templates dropdown clipped (top=${Math.round(td.t)}, right=${Math.round(td.r)} / vw ${td.vw})`).toBe(true);
      // freshness bar
      const fb = await page.evaluate(() => { const f = document.getElementById('freshness-bar'); if (!f) return null; const r = f.getBoundingClientRect(); return { t: r.top, h: r.height, sw: f.scrollWidth, cw: f.clientWidth, vh: innerHeight, txt: f.innerText.slice(0, 160), fs: getComputedStyle(f).fontSize, ov: getComputedStyle(f).overflow }; });
      report[`${w}x${h}/freshness`] = fb;
      fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));
    });
  });
}

test('mobile drawer: sidebar open/close, overlay, focus', async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 812 }, hasTouch: true, isMobile: true });
  const page = await ctx.newPage();
  const errs = await open(page, { mode: 'offline' });
  await page.tap('#mobile-menu-btn');
  await page.waitForTimeout(600);
  expect.soft(await page.evaluate(() => document.getElementById('sidebar').classList.contains('mobile-open'))).toBe(true);
  expect.soft(await page.getAttribute('#mobile-menu-btn', 'aria-expanded')).toBe('true');
  await shot(page, 'mobile-drawer-open');
  const sb = await page.evaluate(() => { const r = document.getElementById('sidebar').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
  expect.soft(sb.r <= sb.w + 1 && sb.l >= -1).toBe(true);
  // choose a model inside the drawer then close via overlay
  await page.fill('#model-search', 'openai/gpt-4o');
  await page.locator('#model-list input[onchange="APP.toggleModel(\'openai/gpt-4o\')"]').first().tap();
  await page.mouse.click(380, 400); // overlay
  await page.waitForTimeout(300);
  expect.soft(await page.evaluate(() => document.getElementById('sidebar').classList.contains('mobile-open')), 'tapping outside should close the drawer').toBe(false);
  expect.soft(await page.evaluate(() => STATE.activeCount())).toBe(1);
  // Esc should close the drawer too
  await page.tap('#mobile-menu-btn');
  await page.keyboard.press('Escape');
  expect.soft(await page.evaluate(() => document.getElementById('sidebar').classList.contains('mobile-open')), 'Esc closes the mobile drawer').toBe(false);
  // 16px font on inputs (iOS zoom)
  const fs16 = await page.evaluate(() => ['prompt-input', 'model-search', 'api-key-input'].map(id => [id, parseFloat(getComputedStyle(document.getElementById(id)).fontSize)]));
  expect.soft(fs16.filter(([, s]) => s < 16), 'inputs under 16px zoom on focus in iOS Safari: ' + JSON.stringify(fs16)).toEqual([]);
  expect.soft(errs, errs.join('\n')).toEqual([]);
  await ctx.close();
});
