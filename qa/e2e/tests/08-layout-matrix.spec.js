// Layout matrix: 8 viewports x light/dark. Records to viewport-report-v2.json, soft-asserts the layout expectations.
const { test } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { open, shot, expect, SHOTS } = require('./helpers');

const VPS = [[360, 740], [390, 812], [768, 1024], [1024, 768], [1280, 720], [1440, 900], [1920, 1080], [2560, 1440]];
const REPORT = path.join(SHOTS, '..', 'viewport-report-v2.json');
const report = fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, 'utf8')) : {};
const save = () => fs.writeFileSync(REPORT, JSON.stringify(report, null, 1));

const DIALOGS = [
  ['usage', 'USAGE.open()'], ['finder', 'FINDER.open()'], ['rec', "V6.openModal('rec')"], ['optimizer', "V6.openModal('optimizer')"],
  ['scenario', "V6.openModal('scenario')"], ['abtest', "V6.openModal('abtest')"], ['history', 'APP.openHistory()'], ['projection', 'APP.openProjection()'],
  ['router', 'ROUTER.open()'], ['finecalc', 'FINECALC.open()'], ['esg', 'ESG.open()'], ['livebench', 'LIVEBENCH.open()'], ['rbac', 'RBAC.open()'],
  ['shadow', 'SHADOW.open()'], ['policy', 'POLICY.open()'], ['bookmarks', 'BOOKMARKS.open()'], ['forecast', 'FORECAST.open()'], ['notes', 'NOTES.open()'],
  ['webhooks', 'WEBHOOKS.open()'], ['about', 'TOAST._openAbout()'], ['palette', 'PALETTE.open()'],
];

async function seed(page, theme) {
  await page.evaluate(t => { try { localStorage.setItem('lti_theme_v1', t); } catch (e) {} document.body.classList.toggle('dark', t === 'dark'); document.documentElement.setAttribute('data-theme', t); }, theme);
  await page.evaluate(() => { ['openai/gpt-4o', 'anthropic/claude-3-haiku', 'openai/gpt-3.5-turbo'].forEach(id => APP.toggleModel(id)); });
  for (const p of ['Explain transformers in detail please.', 'Now compare them with state space models.']) {
    await page.fill('#prompt-input', p);
    await page.evaluate(() => document.getElementById('send-btn').click());
    await page.waitForFunction(() => !document.getElementById('send-btn').disabled);
  }
}

for (const theme of ['light', 'dark']) for (const [w, h] of VPS) {
  test.describe(`layout ${w}x${h} ${theme}`, () => {
    test.use({ viewport: { width: w, height: h }, colorScheme: theme });

    test('compare columns + header + menus', async ({ page }) => {
      const errs = await open(page, { mode: 'offline' });
      await seed(page, theme);
      const k = `${w}x${h}/${theme}`;
      const m = await page.evaluate(() => {
        const vw = innerWidth, vh = innerHeight;
        const r = el => { const b = el.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), h: Math.round(b.height), w: Math.round(b.width) }; };
        const q = s => document.querySelector(s);
        const vis = e => { const c = getComputedStyle(e); const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0 && c.visibility !== 'hidden' && c.display !== 'none'; };
        const hdrKids = [...q('#header').children].filter(vis).map(c => ({ id: c.id || String(c.className).split(' ')[0], r: r(c) })).filter(k => k.r.r > vw + 1 || k.r.l < -1);
        const turn = q('.turn-card'); const turns = turn && turn.parentElement;
        const scroller = [q('#content'), q('#compare-panel'), q('#main'), document.scrollingElement].map(e => e && ({ id: e.id || 'doc', ov: getComputedStyle(e).overflowY, sh: e.scrollHeight, ch: e.clientHeight }));
        const small = [...document.querySelectorAll('button, a[href], select, input:not([type=hidden]):not([type=checkbox]), textarea')].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return (b.width < 44 || b.height < 44) && !e.closest('#model-list') && b.bottom > 0 && b.top < vh; }).map(e => (e.id ? '#' + e.id : String(e.className).split(' ')[0] || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().width) + 'x' + Math.round(e.getBoundingClientRect().height));
        const clipped = [...document.querySelectorAll('#header *, #prompt-bar *, #columns-area *, #bottom-nav *')].filter(vis).filter(e => { const b = e.getBoundingClientRect(); return (b.right > vw + 1 || b.left < -1) && !e.closest('.col-turns, .matrix-wrap, [data-scroll], .mx-scroll') ; }).slice(0, 6).map(e => (e.id || String(e.className).split(' ')[0] || e.tagName) + ' ' + Math.round(e.getBoundingClientRect().left) + '..' + Math.round(e.getBoundingClientRect().right));
        const inputs = ['prompt-input', 'model-search', 'api-key-input'].map(id => { const e = document.getElementById(id); return e && vis(e) ? [id, parseFloat(getComputedStyle(e).fontSize)] : null; }).filter(Boolean);
        return { vw, vh, hscroll: document.documentElement.scrollWidth > vw, scrollW: document.documentElement.scrollWidth, hdrOut: hdrKids, hdrH: r(q('#header')).h, turnList: turns ? r(turns) : null, firstCard: turn ? r(turn) : null, scroller, small: small.length, smallEx: small.slice(0, 6), clipped, inputs, bottomNav: q('#bottom-nav') && vis(q('#bottom-nav')) };
      });
      report[k + '/compare'] = m;
      expect.soft(m.hscroll, `page horizontal overflow ${m.scrollW} > ${m.vw}`).toBe(false);
      expect.soft(m.hdrOut, 'header children off-screen').toEqual([]);
      expect.soft(m.clipped, 'compare controls clipped horizontally').toEqual([]);
      if (m.firstCard) expect.soft(m.firstCard.t < m.vh && m.turnList.h > 150, `turn list reachable (list h ${m.turnList && m.turnList.h}, first card top ${m.firstCard.t}/${m.vh})`).toBe(true);
      if (w <= 768) { expect.soft(m.small, 'tap targets < 44px: ' + m.smallEx.join(' ; ')).toBe(0); expect.soft(m.inputs.filter(i => i[1] < 16), 'inputs < 16px').toEqual([]); }
      // tools menu
      await page.evaluate(() => document.getElementById('tools-btn').click());
      const dd = await page.evaluate(() => { const d = document.getElementById('tools-dropdown'); const b = d.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), vw: innerWidth, vh: innerHeight, ov: getComputedStyle(d).overflowY, sh: d.scrollHeight, ch: d.clientHeight, mh: getComputedStyle(d).maxHeight }; });
      report[k + '/tools'] = dd;
      expect.soft(dd.r <= dd.vw + 1 && dd.l >= -1, 'tools menu horizontally inside').toBe(true);
      expect.soft(dd.b <= dd.vh + 1 || (/auto|scroll/.test(dd.ov) && dd.sh > dd.ch), `tools menu taller than viewport and not scrollable ${JSON.stringify(dd)}`).toBe(true);
      await page.keyboard.press('Escape');
      // templates
      await page.evaluate(() => document.getElementById('tpl-btn').click());
      const td = await page.evaluate(() => { const d = document.getElementById('tpl-dropdown'); const b = d.getBoundingClientRect(); return { t: Math.round(b.top), b: Math.round(b.bottom), l: Math.round(b.left), r: Math.round(b.right), vw: innerWidth, vh: innerHeight, ov: getComputedStyle(d).overflowY, sh: d.scrollHeight, ch: d.clientHeight, vis: getComputedStyle(d).display !== 'none' }; });
      report[k + '/templates'] = td;
      expect.soft(td.t >= 0 && td.r <= td.vw + 1 && td.l >= -1 && (td.b <= td.vh + 1 || /auto|scroll/.test(td.ov)), 'templates dropdown inside viewport ' + JSON.stringify(td)).toBe(true);
      await page.evaluate(() => document.getElementById('tpl-btn').click());
      // matrix view
      await page.evaluate(() => MATRIX.switchView('matrix'));
      const mx = await page.evaluate(() => { const a = document.getElementById('matrix-area'); const b = a.getBoundingClientRect(); return { hscroll: document.documentElement.scrollWidth > innerWidth, w: Math.round(b.width), sw: a.scrollWidth, cw: a.clientWidth, h: Math.round(b.height), t: Math.round(b.top), vh: innerHeight }; });
      report[k + '/matrix'] = mx;
      expect.soft(mx.hscroll, 'matrix causes page horizontal overflow').toBe(false);
      expect.soft(mx.h, 'matrix area has height').toBeGreaterThan(100);
      if (w === 390 || w === 1440) await shot(page, `v2-${k.replace('/', '-')}-matrix`);
      await page.evaluate(() => MATRIX.switchView('cols'));
      if (w === 360 || w === 1280 || w === 1440 || w === 2560) await shot(page, `v2-${k.replace('/', '-')}-compare`);
      save();
      expect.soft(errs, errs.join('\n')).toEqual([]);
    });

    test('pages: benchmarks / how it works / analytics', async ({ page }) => {
      const errs = await open(page, { mode: 'offline' });
      await seed(page, theme);
      const k = `${w}x${h}/${theme}`;
      for (const tab of ['benchmarks', 'howitworks', 'analytics']) {
        await page.evaluate(t => document.querySelector(`.tab-btn[data-tab="${t}"], .bn-btn[data-tab="${t}"]`).click(), tab);
        await page.waitForTimeout(350);
        const m = await page.evaluate(t => {
          const p = document.getElementById(t + '-panel'); const vw = innerWidth;
          const wide = [...p.querySelectorAll('*')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && b.right > vw + 1 && !e.closest('[class*="scroll"], .table-wrap, .bn-tablewrap, svg') ; }).slice(0, 5).map(e => (e.id || String(e.className).split(' ')[0] || e.tagName) + ' r=' + Math.round(e.getBoundingClientRect().right));
          const nan = (p.innerHTML.match(/NaN|undefined|Infinity/g) || []).length;
          return { hscroll: document.documentElement.scrollWidth > vw, scrollW: document.documentElement.scrollWidth, panelSW: p.scrollWidth, panelCW: p.clientWidth, wide, nan, svgs: p.querySelectorAll('svg').length };
        }, tab);
        report[k + '/' + tab] = m;
        expect.soft(m.hscroll, `${tab}: page horizontal overflow ${m.scrollW}`).toBe(false);
        expect.soft(m.wide, `${tab}: elements past the right edge`).toEqual([]);
        expect.soft(m.nan, `${tab}: NaN/undefined in DOM`).toBe(0);
        if (w === 390 || w === 1440) await shot(page, `v2-${k.replace('/', '-')}-${tab}`);
      }
      save();
      expect.soft(errs, errs.join('\n')).toEqual([]);
    });

    test('dialogs fit the viewport', async ({ page }) => {
      const errs = await open(page, { mode: 'offline' });
      await seed(page, theme);
      const k = `${w}x${h}/${theme}`;
      await page.evaluate(() => { window.print = () => {}; });
      const bad = [];
      for (const [name, fn] of DIALOGS) {
        await page.evaluate(f => { try { (0, eval)(f); } catch (e) { window.__dlgErr = String(e); } }, fn);
        await page.waitForTimeout(220);
        const m = await page.evaluate(name => {
          const ov = document.getElementById(name + '-overlay');
          if (!ov) return { missing: true };
          const modal = ov.firstElementChild; const c = getComputedStyle(ov);
          const open = c.display !== 'none' && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0.01 && ov.getBoundingClientRect().width > 0;
          const b = modal.getBoundingClientRect(); const cm = getComputedStyle(modal);
          const body = modal.querySelector('[class*="body"], .ux-body') || modal;
          const scrollable = [modal, body].some(e => /auto|scroll/.test(getComputedStyle(e).overflowY) && e.scrollHeight > e.clientHeight);
          const wide = [...modal.querySelectorAll('*')].filter(e => { const x = e.getBoundingClientRect(); return x.width > 0 && (x.right > innerWidth + 1 || x.left < -1) && !e.closest('[class*="scroll"], .table-wrap'); }).slice(0, 3).map(e => (e.id || String(e.className).split(' ')[0] || e.tagName));
          const focusIn = modal.contains(document.activeElement) || ov.contains(document.activeElement);
          return { open, l: Math.round(b.left), r: Math.round(b.right), t: Math.round(b.top), b: Math.round(b.bottom), vw: innerWidth, vh: innerHeight, scrollable, hs: modal.scrollWidth > modal.clientWidth + 2, wide, focusIn, role: ov.getAttribute('role') || modal.getAttribute('role'), modalAttr: ov.getAttribute('aria-modal') || modal.getAttribute('aria-modal') };
        }, name === 'palette' ? 'palette' : name);
        report[k + '/dialog-' + name] = m;
        if (m.missing) { bad.push(name + ': overlay missing'); continue; }
        if (!m.open) { bad.push(name + ': did not open'); continue; }
        if (m.l < -1 || m.r > m.vw + 1) bad.push(`${name}: horizontally outside (${m.l}..${m.r}/${m.vw})`);
        if ((m.t < -1 || m.b > m.vh + 1) && !m.scrollable) bad.push(`${name}: taller than viewport, not scrollable (${m.t}..${m.b}/${m.vh})`);
        if (m.hs || m.wide.length) bad.push(`${name}: horizontal content overflow ${m.wide.join(',')}`);
        if (!m.focusIn) bad.push(`${name}: focus not moved into dialog`);
        if (m.role !== 'dialog' || m.modalAttr !== 'true') bad.push(`${name}: missing role=dialog/aria-modal`);
        if (w === 390 && (name === 'usage' || name === 'palette' || name === 'scenario')) await shot(page, `v2-${k.replace('/', '-')}-dlg-${name}`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(160);
        const still = await page.evaluate(name => { const ov = document.getElementById(name + '-overlay'); const c = getComputedStyle(ov); return c.display !== 'none' && c.visibility !== 'hidden' && parseFloat(c.opacity) > 0.01; }, name);
        if (still) { bad.push(`${name}: Esc did not close`); await page.evaluate(() => document.querySelectorAll('.tl-overlay.open').forEach(o => o.classList.remove('open'))); }
      }
      save();
      expect.soft(bad, bad.join(' | ')).toEqual([]);
      expect.soft(errs, errs.join('\n')).toEqual([]);
    });
  });
}
