// Shared helpers for the TokenLens E2E suite. Target URL comes from TL_URL.
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

const URL = process.env.TL_URL || 'http://localhost:8791/index.html';
const ROOT = path.join(__dirname, '..');
const SHOTS = path.join(ROOT, 'shots');
const LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, 'fixtures', 'live-models.json'), 'utf8'));
fs.mkdirSync(SHOTS, { recursive: true });

const ORIGIN = new (global.URL)(URL).origin;

/**
 * mode:
 *  fixture  - /models served from the recorded OpenRouter payload (deterministic "live")
 *  offline  - /models aborted (bundled fallback path)
 *  slow     - /models delayed by `delay` ms, then fixture
 *  real     - let the real network through for /models
 * chat/completions is NEVER allowed through: always 401 (optionally delayed).
 */
async function open(page, o = {}) {
  const mode = o.mode || 'fixture';
  const errors = [];
  page.__errors = errors;
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console.error: ' + m.text()); });
  page.__chatCalls = 0;

  await page.route('**/*', route => {
    const u = route.request().url();
    if (u.startsWith(ORIGIN) || u.startsWith('data:') || u.startsWith('blob:')) return route.continue();
    if (u.includes('openrouter.ai/api/v1/chat/completions')) {
      page.__chatCalls++;
      const d = o.chatDelay || 0;
      return setTimeout(() => route.fulfill({ status: 401, contentType: 'application/json', body: '{"error":{"message":"invalid key (test stub)"}}' }), d);
    }
    if (u.includes('openrouter.ai/api/v1/models')) {
      if (mode === 'offline') return route.abort('internetdisconnected');
      if (mode === 'real') return route.continue();
      const send = () => route.fulfill({ status: 200, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: o.modelsBody || JSON.stringify(LIVE) });
      if (mode === 'slow') return setTimeout(send, o.delay || 4000);
      return send();
    }
    // fonts, links, etc: abort so the run is hermetic
    return route.abort();
  });

  const storage = Object.assign({}, o.onboarded === false ? {} : { lti_onboarded_v1: '1' }, o.storage || {});
  if (!o.keepStorage) {
    await page.addInitScript(([s, once]) => {
      if (sessionStorage.getItem('__seeded') && once) return;
      sessionStorage.setItem('__seeded', '1');
      Object.keys(s).forEach(k => localStorage.setItem(k, s[k]));
    }, [storage, true]);
  }
  await page.goto(URL + (o.hash || ''));
  if (o.wait !== false) await page.waitForFunction(() => document.querySelectorAll('#model-list .model-item').length > 0, null, { timeout: 15000 }).catch(() => {});
  return errors;
}

async function selectModel(page, id) {
  await page.fill('#model-search', id);
  const cb = page.locator(`#model-list input[onchange="APP.toggleModel('${id}')"]`);
  await cb.first().check({ force: true });
  await page.fill('#model-search', '');
}

async function selectModels(page, ids) { for (const id of ids) await selectModel(page, id); }

async function send(page, prompt) {
  await page.fill('#prompt-input', prompt);
  await page.click('#send-btn');
  await page.waitForFunction(() => !document.getElementById('send-btn').disabled);
}

async function shot(page, name) {
  const p = path.join(SHOTS, name + '.png');
  await page.screenshot({ path: p, fullPage: false });
  return p;
}

function num(s) { return parseFloat(String(s).replace(/[^0-9.\-eE]/g, '')); }

async function openTool(page, label) {
  await page.click('#tools-btn');
  await page.locator('#tools-dropdown .tools-item', { hasText: label }).click();
}

async function setCur(page, cur) {
  const sel = page.locator('#currency-select');
  if (await sel.count() && await sel.isVisible()) await sel.selectOption(cur);
  else await page.evaluate(c => document.querySelector('.cur-btn[data-cur="' + c + '"]').click(), cur);
}

module.exports = { setCur, URL, SHOTS, LIVE, open, selectModel, selectModels, send, shot, num, openTool, expect };
