/* ══════════════════════════════════════════════════════════
   SHELL — dialog management, tab sync, rail resets, data status,
   welcome flow, footer and theme chrome.
   Modules open and close overlays by toggling `.open`; this file
   layers focus handling, inert background and ARIA on top of that.
   ══════════════════════════════════════════════════════════ */
(function() {
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var BACKGROUND = ['.skip-link', '#header', '#main', '#bottom-nav', '#notes-fab', '#toast-container'];
  var openers = new Map();
  var order = [];

  function isOpen(ov) { return ov.classList.contains('open') && !ov.classList.contains('hidden'); }
  function dialogOf(ov) { return ov.querySelector('.tl-dialog') || ov; }
  function visible(el) { return !!(el.offsetWidth || el.offsetHeight || el.getClientRects().length); }
  function focusables(root) { return Array.prototype.filter.call(root.querySelectorAll(FOCUSABLE), visible); }

  function prepare(ov) {
    var dlg = dialogOf(ov);
    if (!ov.hasAttribute('role') && !dlg.hasAttribute('role')) {
      dlg.setAttribute('role', 'dialog');
      dlg.setAttribute('aria-modal', 'true');
      var heading = dlg.querySelector('h1,h2,h3,[id$="-title"]');
      if (heading) {
        if (!heading.id) heading.id = ov.id + '-title';
        dlg.setAttribute('aria-labelledby', heading.id);
      } else {
        dlg.setAttribute('aria-label', 'Dialog');
      }
    }
    dlg.setAttribute('tabindex', '-1');
  }

  function topOverlay() { return order.length ? order[order.length - 1] : null; }

  function applyInert() {
    var top = topOverlay();
    BACKGROUND.forEach(function(sel) {
      var el = document.querySelector(sel);
      if (el && sel !== '#toast-container') el.inert = !!top;
    });
    document.querySelectorAll('.tl-overlay').forEach(function(ov) {
      ov.inert = isOpen(ov) && ov !== top;
    });
    document.body.classList.toggle('modal-open', !!top);
  }

  function onOpened(ov) {
    if (order.indexOf(ov) !== -1) return;
    if (!openers.has(ov)) openers.set(ov, document.activeElement);
    order.push(ov);
    applyInert();
    var dlg = dialogOf(ov);
    var first = dlg.querySelector('[autofocus]') || dlg;
    requestAnimationFrame(function() { first.focus({ preventScroll: true }); });
  }

  function onClosed(ov) {
    var i = order.indexOf(ov);
    if (i === -1) return;
    order.splice(i, 1);
    ov.inert = false;
    if (ov.contains(document.activeElement)) document.activeElement.blur();
    applyInert();
    var opener = openers.get(ov);
    openers.delete(ov);
    var top = topOverlay();
    if (top) { dialogOf(top).focus({ preventScroll: true }); return; }
    if (opener && document.contains(opener) && visible(opener) && opener !== document.body) opener.focus({ preventScroll: true });
  }

  function sync(ov) { if (isOpen(ov)) onOpened(ov); else onClosed(ov); }

  var overlayObserver = new MutationObserver(function(records) {
    records.forEach(function(r) { sync(r.target); });
  });

  function closeTop() {
    var top = topOverlay();
    if (!top) return false;
    var btn = top.querySelector('.tl-close[aria-label^="Close"],.onboard-start-btn');
    if (btn) btn.click();
    else top.classList.remove('open');
    return true;
  }

  function trap(e, container) {
    var items = focusables(container);
    if (!items.length) { e.preventDefault(); container.focus(); return; }
    var first = items[0], last = items[items.length - 1];
    if (!container.contains(document.activeElement) || document.activeElement === container) {
      e.preventDefault();
      (e.shiftKey ? last : first).focus();
    } else if (e.shiftKey && document.activeElement === first) {
      e.preventDefault(); last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault(); first.focus();
    }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && topOverlay()) {
      closeTop();
      e.stopImmediatePropagation();
      return;
    }
    if (e.key !== 'Tab') return;
    var top = topOverlay();
    if (top) { trap(e, dialogOf(top)); return; }
    if (document.body.classList.contains('sheet-open')) trap(e, document.getElementById('sidebar'));
  }, true);

  function initOverlays() {
    document.querySelectorAll('.tl-overlay').forEach(function(ov) {
      prepare(ov);
      overlayObserver.observe(ov, { attributes: true, attributeFilter: ['class'] });
      sync(ov);
    });
  }

  var indicatorReady = false;
  function placeIndicator() {
    var wrap = document.querySelector('.header-tabs');
    var ind = wrap && wrap.querySelector('.tab-indicator');
    var act = wrap && wrap.querySelector('.tab-btn.active');
    if (!ind || !act || !act.offsetWidth) return;
    var cs = getComputedStyle(act);
    var padL = parseFloat(cs.paddingLeft) || 0;
    var padR = parseFloat(cs.paddingRight) || 0;
    var x = act.offsetLeft + padL;
    var w = Math.max(1, act.offsetWidth - padL - padR);
    ind.style.transform = 'translateX(' + x + 'px) scaleX(' + w + ')';
    if (!indicatorReady) {
      indicatorReady = true;
      requestAnimationFrame(function() { ind.classList.add('ready'); });
    }
  }

  function initTabs() {
    var tabs = document.querySelectorAll('.tab-btn[data-tab]');
    var nav = document.querySelectorAll('.bn-btn[data-tab]');
    var current = null;
    tabs.forEach(function(t) {
      t.id = 'tab-' + t.dataset.tab;
      var panel = document.getElementById(t.dataset.tab + '-panel');
      if (panel) { panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', t.id); }
    });
    function sync() {
      var active = document.querySelector('.tab-btn.active');
      var name = active ? active.dataset.tab : 'compare';
      tabs.forEach(function(t) { t.setAttribute('aria-selected', t.dataset.tab === name ? 'true' : 'false'); });
      nav.forEach(function(b) {
        var on = b.dataset.tab === name;
        b.classList.toggle('active', on);
        if (on) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
      });
      if (current !== null && current !== name) window.scrollTo(0, 0);
      current = name;
      placeIndicator();
    }
    var obs = new MutationObserver(sync);
    tabs.forEach(function(t) { obs.observe(t, { attributes: true, attributeFilter: ['class'] }); });
    if (window.ResizeObserver) {
      var ro = new ResizeObserver(placeIndicator);
      ro.observe(document.querySelector('.header-tabs'));
      tabs.forEach(function(t) { ro.observe(t); });
    }
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(placeIndicator);
    nav.forEach(function(b) {
      b.addEventListener('click', function() {
        var t = document.querySelector('.tab-btn[data-tab="' + b.dataset.tab + '"]');
        if (t) t.click();
      });
    });
    sync();
  }

  function initToolsMenu() {
    var dd = document.getElementById('tools-dropdown');
    var btn = document.getElementById('tools-btn');
    if (!dd || !btn) return;
    new MutationObserver(function() {
      if (dd.classList.contains('open')) {
        var first = dd.querySelector('.tools-item');
        if (first) first.focus({ preventScroll: true });
      } else if (dd.contains(document.activeElement)) {
        btn.focus({ preventScroll: true });
      }
    }).observe(dd, { attributes: true, attributeFilter: ['class'] });
    dd.addEventListener('keydown', function(e) {
      var items = Array.prototype.slice.call(dd.querySelectorAll('.tools-item'));
      var i = items.indexOf(document.activeElement);
      if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
      else if (e.key === 'Home') { e.preventDefault(); items[0].focus(); }
      else if (e.key === 'End') { e.preventDefault(); items[items.length - 1].focus(); }
    });
  }

  function initTemplates() {
    var dd = document.getElementById('tpl-dropdown');
    var btn = document.getElementById('tpl-btn');
    if (!dd || !btn) return;
    function place() {
      if (!dd.classList.contains('open')) return;
      var r = btn.getBoundingClientRect();
      var vw = window.innerWidth, vh = window.innerHeight;
      var width = Math.min(380, vw - 16);
      var left = Math.min(Math.max(8, r.left), vw - width - 8);
      var below = vh - r.bottom - 14;
      var above = r.top - 14;
      dd.style.width = width + 'px';
      dd.style.left = left + 'px';
      if (below >= 280 || below >= above) {
        dd.style.top = (r.bottom + 6) + 'px'; dd.style.bottom = 'auto';
        dd.style.maxHeight = Math.max(160, below) + 'px';
      } else {
        dd.style.bottom = (vh - r.top + 6) + 'px'; dd.style.top = 'auto';
        dd.style.maxHeight = Math.max(160, above) + 'px';
      }
    }
    new MutationObserver(place).observe(dd, { attributes: true, attributeFilter: ['class'] });
    window.addEventListener('scroll', place, { passive: true });
    window.addEventListener('resize', place);
    dd.addEventListener('keydown', function(e) {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.classList.contains('tpl-item')) { e.preventDefault(); e.target.click(); }
    });
  }

  function initRailReset() {
    ['(max-width: 768px)', '(min-width: 1100px)'].forEach(function(q) {
      window.matchMedia(q).addEventListener('change', function() { if (window.APP) APP.closeRail(); });
    });
  }

  function initSheet() {
    var sb = document.getElementById('sidebar');
    var was = false;
    new MutationObserver(function() {
      var now = document.body.classList.contains('sheet-open');
      if (now === was) return;
      was = now;
      var btn = document.getElementById('mobile-menu-btn');
      if (now) { var c = sb.querySelector('.rail-close'); if (c) c.focus({ preventScroll: true }); }
      else if (btn && visible(btn)) btn.focus({ preventScroll: true });
    }).observe(document.body, { attributes: true, attributeFilter: ['class'] });
  }

  // ── Data status: loading, live, cached, offline ────────
  var statusEls = {};
  var dataLoaded = false;
  var examplePending = false;

  function cacheStatusEls() {
    statusEls.box = document.getElementById('data-status');
    statusEls.chip = document.getElementById('data-status-chip');
    statusEls.note = document.getElementById('data-status-note');
    statusEls.retry = document.getElementById('data-status-retry');
    statusEls.footer = document.getElementById('footer-status');
    statusEls.list = document.getElementById('model-list');
  }

  var CHIP = {
    loading: { text: 'Loading', cls: '' },
    live: { text: 'Live', cls: 'positive' },
    cached: { text: 'Cached', cls: '' },
    offline: { text: 'Offline', cls: 'warning' }
  };

  function setStatus(state, note) {
    if (!statusEls.box) return;
    var c = CHIP[state];
    statusEls.box.dataset.state = state;
    statusEls.chip.textContent = c.text;
    statusEls.chip.className = 'pill data-status-chip' + (c.cls ? ' ' + c.cls : '');
    statusEls.note.textContent = note;
    statusEls.retry.hidden = state !== 'offline';
    if (statusEls.list) statusEls.list.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    if (statusEls.footer) {
      statusEls.footer.dataset.state = state;
      statusEls.footer.textContent = c.text;
      statusEls.footer.className = 'fb-status pill' + (c.cls ? ' ' + c.cls : '');
    }
  }

  function readBadge(count) {
    var badge = document.getElementById('pricing-badge');
    var text = badge ? badge.textContent : '';
    var when = (text.match(/\(([^)]+)\)/) || [])[1] || '';
    if (badge && badge.classList.contains('live')) return ['live', 'Updated ' + (when || 'just now') + '.'];
    if (badge && badge.classList.contains('cached')) {
      if (/offline/i.test(text)) return ['offline', 'No connection. Showing saved prices' + (when ? ' from ' + when : '') + '.'];
      return ['cached', 'Saved prices' + (when ? ', ' + when : '') + '. Refreshed daily.'];
    }
    return ['offline', 'No connection. Showing the built-in list of ' + count + ' models.'];
  }

  function showSkeleton() {
    if (!statusEls.list || (window.STATE && STATE.getModels().length)) return;
    var row = '<div class="model-skeleton"><span class="sk-box"></span><span class="sk-lines"><span class="sk-line"></span><span class="sk-line short"></span></span></div>';
    statusEls.list.innerHTML = new Array(9).join(row);
  }

  function initStatus() {
    cacheStatusEls();
    if (!statusEls.box || !window.API) return;
    setStatus('loading', 'Fetching live prices.');
    showSkeleton();

    var original = API.fetchModels;
    API.fetchModels = async function() {
      setStatus('loading', 'Fetching live prices.');
      showSkeleton();
      var models = await original.apply(API, arguments);
      var st = readBadge(models.length);
      setStatus(st[0], st[1]);
      dataLoaded = true;
      var ex = document.getElementById('onboard-example');
      if (ex) { ex.disabled = false; ex.textContent = 'Try an example'; }
      if (examplePending) { examplePending = false; setTimeout(tryExample, 0); }
      return models;
    };

    statusEls.retry.addEventListener('click', async function() {
      statusEls.retry.classList.add('busy');
      var models = await API.fetchModels();
      statusEls.retry.classList.remove('busy');
      STATE.setModels(models);
      APP._renderModelList();
      if (STATE.activeCount()) UI_COMPARE.renderAll();
      if (statusEls.box.dataset.state === 'offline') TOAST.warning('Still offline. Showing ' + models.length + ' models from the saved or built-in list.');
      else TOAST.success(models.length + ' models loaded.');
    });
  }

  // ── Empty search results ───────────────────────────────
  function initEmptyState() {
    var list = document.getElementById('model-list');
    var box = document.getElementById('model-empty');
    var text = document.getElementById('model-empty-text');
    var clear = document.getElementById('model-empty-clear');
    var search = document.getElementById('model-search');
    if (!list || !box) return;
    function sync() {
      var empty = list.children.length === 0 && window.STATE && STATE.getModels().length > 0;
      box.hidden = !empty;
      if (!empty) return;
      var q = search.value.trim();
      var chip = document.querySelector('.pchip.active');
      var prov = chip && chip.dataset.prov ? chip.textContent.trim() : '';
      text.textContent = 'No models match' + (q ? ' “' + q + '”' : '') + (prov ? ' in ' + prov : '') + '.';
    }
    new MutationObserver(sync).observe(list, { childList: true });
    clear.addEventListener('click', function() {
      search.value = '';
      search.dispatchEvent(new Event('input', { bubbles: true }));
      if (window.APP) APP.setProviderFilter('');
      search.focus();
    });
  }

  // ── Usage pill count-up ────────────────────────────────
  function initCountUp() {
    var el = document.getElementById('usage-pill-txt');
    if (!el) return;
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var NUM = /\d[\d,]*(?:\.\d+)?/;
    var written = el.textContent;
    var shown = 0;
    var raf = 0;

    function parse(str) {
      var m = NUM.exec(str);
      if (!m) return null;
      var frac = m[0].indexOf('.') === -1 ? 0 : m[0].length - m[0].indexOf('.') - 1;
      return { start: m.index, len: m[0].length, value: parseFloat(m[0].replace(/,/g, '')), frac: frac, group: m[0].indexOf(',') !== -1 };
    }
    function fmt(v, p) {
      return v.toLocaleString('en-US', { minimumFractionDigits: p.frac, maximumFractionDigits: p.frac, useGrouping: p.group });
    }
    function write(str) { written = str; el.textContent = str; }

    new MutationObserver(function() {
      if (el.textContent === written) return;
      var target = el.textContent;
      var p = parse(target);
      cancelAnimationFrame(raf);
      if (!p || reduce.matches || el.offsetParent === null) { shown = p ? p.value : 0; written = target; return; }
      var from = shown;
      if (from === p.value) { written = target; return; }
      var t0 = performance.now();
      function frame(now) {
        var k = Math.min(1, (now - t0) / 360);
        if (k >= 1) { shown = p.value; write(target); return; }
        shown = from + (p.value - from) * (1 - Math.pow(1 - k, 3));
        write(target.slice(0, p.start) + fmt(shown, p) + target.slice(p.start + p.len));
        raf = requestAnimationFrame(frame);
      }
      write(target);
      raf = requestAnimationFrame(frame);
    }).observe(el, { childList: true, characterData: true, subtree: true });
  }

  // ── Footer ─────────────────────────────────────────────
  function initFooter() {
    var v = document.getElementById('app-version');
    if (v && typeof __APP_VERSION__ !== 'undefined') v.textContent = 'TokenLens v' + __APP_VERSION__;
    document.querySelectorAll('[data-goto]').forEach(function(b) {
      b.addEventListener('click', function() {
        var t = document.querySelector('.tab-btn[data-tab="' + b.dataset.goto + '"]');
        if (t) t.click();
      });
    });
  }

  function initSkipLink() {
    var link = document.querySelector('.skip-link');
    var target = document.getElementById('content');
    if (!link || !target) return;
    link.addEventListener('click', function(e) {
      e.preventDefault();
      target.focus();
      target.scrollIntoView({ block: 'start' });
    });
  }

  // ── Theme chrome ───────────────────────────────────────
  function initThemeChrome() {
    function sync() {
      var dark = document.body.classList.contains('dark');
      document.querySelectorAll('meta[name="theme-color"]').forEach(function(m) {
        m.setAttribute('content', dark ? '#0b0b0b' : '#f8f8f8');
      });
    }
    new MutationObserver(sync).observe(document.body, { attributes: true, attributeFilter: ['class'] });
    sync();
  }

  // ── Welcome flow ───────────────────────────────────────
  var SAMPLE_PROMPT = 'Summarize the main trade-offs of prompt caching for a customer-support assistant in three bullet points.';
  var EXAMPLE_PICKS = [
    ['openai/gpt-4o-mini', 'openai/gpt-4.1-mini', 'openai/gpt-4o', /^openai\/gpt-[^:]+$/],
    ['anthropic/claude-haiku-4.5', 'anthropic/claude-3.5-haiku', 'anthropic/claude-sonnet-4.5', 'anthropic/claude-sonnet-4', /^anthropic\/claude-[^:]+$/],
    ['google/gemini-2.5-flash', 'google/gemini-2.0-flash-001', 'google/gemini-2.5-pro', /^google\/gemini-[^:]+$/]
  ];

  function pickExampleModels() {
    var models = STATE.getModels().filter(function(m) { return m.id && m.id.indexOf(':') === -1; });
    var picked = [];
    EXAMPLE_PICKS.forEach(function(patterns) {
      for (var i = 0; i < patterns.length; i++) {
        var want = patterns[i];
        var hit = models.find(function(m) {
          return (typeof want === 'string' ? m.id === want : want.test(m.id)) && picked.indexOf(m.id) === -1;
        });
        if (hit) { picked.push(hit.id); return; }
      }
    });
    for (var j = 0; j < models.length && picked.length < 3; j++) {
      if (picked.indexOf(models[j].id) === -1) picked.push(models[j].id);
    }
    return picked.slice(0, 3);
  }

  function tryExample() {
    var btn = document.getElementById('onboard-example');
    if (!dataLoaded || !STATE.getModels().length) {
      examplePending = true;
      if (btn) { btn.disabled = true; btn.textContent = 'Loading models'; }
      return;
    }
    var ids = pickExampleModels();
    ids.forEach(function(id) { if (!STATE.isActive(id)) APP.toggleModel(id); });
    var pi = document.getElementById('prompt-input');
    if (pi) { pi.value = SAMPLE_PROMPT; UI_COMPARE.updateLivePreview(SAMPLE_PROMPT); }
    TOAST._closeOnboarding();
    var compare = document.querySelector('.tab-btn[data-tab="compare"]');
    if (compare && !compare.classList.contains('active')) compare.click();
    var send = document.getElementById('send-btn');
    TOAST.success('Example ready: ' + ids.length + ' models and a sample prompt.', {
      action: { label: send ? send.textContent.trim() : 'Simulate', onClick: function() { if (send) send.click(); } }
    });
    setTimeout(function() { if (send && send.offsetParent !== null) send.focus({ preventScroll: true }); }, 80);
  }

  function initWelcome() {
    var root = document.getElementById('onboarding-overlay');
    if (!root) return;
    var steps = root.querySelectorAll('.onboard-step');
    var dots = root.querySelectorAll('.onboard-dot');
    var back = document.getElementById('onboard-back');
    var next = document.getElementById('onboard-next');
    var at = 0;
    function go(n) {
      at = Math.max(0, Math.min(steps.length - 1, n));
      steps.forEach(function(s, i) { s.hidden = i !== at; s.classList.toggle('active', i === at); });
      dots.forEach(function(d, i) {
        d.classList.toggle('active', i === at);
        d.classList.toggle('done', i < at);
        if (i === at) d.setAttribute('aria-current', 'step'); else d.removeAttribute('aria-current');
      });
      back.disabled = at === 0;
      next.disabled = at === steps.length - 1;
    }
    back.addEventListener('click', function() { go(at - 1); });
    next.addEventListener('click', function() { go(at + 1); });
    dots.forEach(function(d) { d.addEventListener('click', function() { go(Number(d.dataset.step)); }); });
    root.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(at + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(at - 1); }
    });
    var ex = document.getElementById('onboard-example');
    if (ex && !dataLoaded) { ex.disabled = true; ex.textContent = 'Loading models'; }
    go(0);
  }

  window.SHELL = { tryExample: tryExample, setStatus: setStatus, rememberOpener: function(ov, el) { if (!openers.has(ov)) openers.set(ov, el); } };

  function hideSeenWelcome() {
    var w = document.getElementById('onboarding-overlay');
    var seen = false;
    try { seen = !!localStorage.getItem('lti_onboarded_v1'); } catch (e) {}
    if (w && seen) w.classList.add('hidden');
  }

  function init() {
    hideSeenWelcome();
    initSheet();
    initOverlays();
    initTabs();
    initToolsMenu();
    initTemplates();
    initRailReset();
    initStatus();
    initEmptyState();
    initCountUp();
    initFooter();
    initSkipLink();
    initThemeChrome();
    initWelcome();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
