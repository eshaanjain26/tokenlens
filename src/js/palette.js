/* ══════════════════════════════════════════════════════════
   PALETTE — command palette (Ctrl/Cmd+K)
   Fuzzy search over actions and models. Actions call existing module
   functions; nothing here owns app logic. Other modules can add actions
   with PALETTE.register({ id, title, group, keywords, hint, run }).
   ══════════════════════════════════════════════════════════ */
window.PALETTE = (function() {
  var RECENT_KEY = 'tl_ui_recent';
  var MAX_RECENT = 5;
  var MAX_RESULTS = 30;
  var MAX_MODEL_RESULTS = 12;
  var TAB_LABELS = [['compare', 'Compare', 'c'], ['benchmarks', 'Benchmarks', 'b'], ['howitworks', 'How it works', 'h'], ['analytics', 'Analytics', 'a']];
  var CURRENCIES = ['USD', 'EUR', 'GBP', 'INR'];

  var extra = [];
  var shown = [];
  var active = 0;
  var el = {};

  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function slug(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
  function isMac() { return /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent); }
  function resolve(v) { return typeof v === 'function' ? v() : v; }

  function loadRecent() {
    try {
      var r = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      return Array.isArray(r) ? r.filter(function(x) { return typeof x === 'string'; }) : [];
    } catch (e) { return []; }
  }
  function pushRecent(id) {
    var r = loadRecent().filter(function(x) { return x !== id; });
    r.unshift(id);
    try { localStorage.setItem(RECENT_KEY, JSON.stringify(r.slice(0, MAX_RECENT))); } catch (e) {}
  }

  function wordStart(t, i) { return i === 0 || /[^a-z0-9]/.test(t.charAt(i - 1)); }

  function fuzzy(q, text) {
    var t = text.toLowerCase();
    var at = t.indexOf(q);
    if (at !== -1) {
      var idx = [];
      for (var k = 0; k < q.length; k++) idx.push(at + k);
      return { score: 100 + (wordStart(t, at) ? 40 : 0) - at - (t.length - q.length) * 0.25, idx: idx };
    }
    var pos = [];
    var from = 0;
    var score = 0;
    var prev = -2;
    for (var i = 0; i < q.length; i++) {
      var p = t.indexOf(q.charAt(i), from);
      if (p === -1) return null;
      score += 10;
      if (p === prev + 1) score += 8;
      if (wordStart(t, p)) score += 10;
      score -= Math.min(p - from, 6);
      pos.push(p);
      prev = p;
      from = p + 1;
    }
    return { score: score - t.length * 0.1, idx: pos };
  }

  function match(query, action, title) {
    var tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    var total = 0;
    var hits = [];
    var kw = (action.keywords || '') + ' ' + (action.group || '');
    for (var i = 0; i < tokens.length; i++) {
      var m = fuzzy(tokens[i], title);
      if (m) { total += m.score; hits = hits.concat(m.idx); continue; }
      var k = fuzzy(tokens[i], kw);
      if (!k) return null;
      total += k.score * 0.5;
    }
    return { score: total, idx: hits };
  }

  function highlight(title, idx) {
    if (!idx || !idx.length) return esc(title);
    var set = {};
    idx.forEach(function(i) { set[i] = true; });
    var out = '';
    var open = false;
    for (var i = 0; i < title.length; i++) {
      var on = !!set[i];
      if (on && !open) { out += '<mark class="pal-hit">'; open = true; }
      if (!on && open) { out += '</mark>'; open = false; }
      out += esc(title.charAt(i));
    }
    return out + (open ? '</mark>' : '');
  }

  function goTab(name) { SHORTCUTS.goTab(name); }

  function buildActions(withModels) {
    var list = [];
    function add(a) { list.push(a); }

    TAB_LABELS.forEach(function(t) {
      add({ id: 'nav:' + t[0], group: 'Go to', title: t[1], keywords: 'tab page switch open ' + t[0], hint: ['g', t[2]], run: function() { goTab(t[0]); } });
    });

    var sendBtn = document.getElementById('send-btn');
    var sendLabel = sendBtn ? sendBtn.textContent.trim() || 'Simulate' : 'Simulate';
    add({
      id: 'run:send', group: 'Run', title: 'Run ' + sendLabel, keywords: 'send submit prompt compare simulate',
      hint: [SHORTCUTS.mod, 'Enter'],
      run: function() {
        goTab('compare');
        var pi = document.getElementById('prompt-input');
        if (!pi || !pi.value.trim()) {
          if (pi) pi.focus();
          TOAST.warning('Write a prompt first.');
          return;
        }
        if (sendBtn) sendBtn.click();
      }
    });
    add({ id: 'run:focus-prompt', group: 'Run', title: 'Write a prompt', keywords: 'focus type input textarea', run: function() { goTab('compare'); var pi = document.getElementById('prompt-input'); if (pi) pi.focus(); } });
    add({ id: 'run:focus-models', group: 'Run', title: 'Search models', keywords: 'filter find rail sidebar', hint: ['/'], run: function() { SHORTCUTS.focusModelSearch(); } });

    add({ id: 'view:usage', group: 'View', title: 'Open usage', keywords: 'tokens cost impact caching footprint session', run: function() { USAGE.open(); } });
    add({ id: 'view:share', group: 'View', title: 'Copy share URL', keywords: 'link clipboard', run: function() { APP.shareURL(); } });

    document.querySelectorAll('#tools-dropdown .tools-item').forEach(function(btn) {
      var oc = btn.getAttribute('onclick') || '';
      if (/USAGE\.open|APP\.shareURL/.test(oc)) return;
      var title = btn.textContent.trim();
      add({ id: 'tool:' + slug(title), group: 'Tools', title: title, keywords: 'tool menu open', run: function() { btn.click(); } });
    });

    add({
      id: 'set:dark', group: 'Settings', keywords: 'theme appearance night light dark mode', hint: ['d'],
      title: function() { return document.body.classList.contains('dark') ? 'Switch to light mode' : 'Switch to dark mode'; },
      run: function() { APP.toggleDark(); }
    });
    CURRENCIES.forEach(function(c) {
      add({
        id: 'set:cur-' + c, group: 'Settings', keywords: 'currency money price ' + c,
        title: function() { return 'Show prices in ' + c; },
        meta: function() { var a = document.querySelector('.cur-btn.active'); return a && a.dataset.cur === c ? 'Current' : ''; },
        run: function() {
          var b = document.querySelector('.cur-btn[data-cur="' + c + '"]');
          if (b) b.click();
          var s = document.getElementById('currency-select');
          if (s) s.value = c;
        }
      });
    });

    add({ id: 'help:shortcuts', group: 'Help', title: 'Keyboard shortcuts', keywords: 'keys hotkeys help cheat sheet', hint: ['?'], run: function() { SHORTCUTS.open(); } });
    add({ id: 'help:about', group: 'Help', title: 'About and methodology', keywords: 'sources research', run: function() { TOAST._openAbout(); } });

    extra.forEach(add);

    if (withModels && window.STATE) {
      STATE.getModels().forEach(function(m) {
        var name = m.name || (m.id || '').split('/').pop();
        add({
          id: 'model:' + m.id, group: 'Models', modelOf: m.id,
          title: function() { return (STATE.isActive(m.id) ? 'Deselect ' : 'Select ') + name; },
          keywords: m.id,
          run: function() {
            var was = STATE.isActive(m.id);
            APP.toggleModel(m.id);
            if (STATE.isActive(m.id) !== was) TOAST.info((was ? 'Removed ' : 'Added ') + name + '. ' + STATE.activeCount() + ' of 10 selected.');
          }
        });
      });
    }
    return list;
  }

  function search(query) {
    var q = query.trim();
    var all = buildActions(!!q);
    if (!q) {
      var byId = {};
      all.forEach(function(a) { byId[a.id] = a; });
      var recent = loadRecent().map(function(id) { return byId[id]; }).filter(Boolean);
      var rows = [];
      if (recent.length) rows.push({ heading: 'Recent', actions: recent });
      var order = [];
      var groups = {};
      all.forEach(function(a) {
        if (!groups[a.group]) { groups[a.group] = []; order.push(a.group); }
        groups[a.group].push(a);
      });
      order.forEach(function(g) { rows.push({ heading: g, actions: groups[g] }); });
      return rows;
    }
    var scored = [];
    all.forEach(function(a, order) {
      var title = resolve(a.title);
      var m = match(q, a, title);
      if (m) scored.push({ action: a, title: title, score: m.score + (a.group === 'Models' ? -5 : 0), idx: m.idx, order: order });
    });
    scored.sort(function(x, y) { return y.score - x.score || x.order - y.order; });
    var models = 0;
    var out = [];
    for (var i = 0; i < scored.length && out.length < MAX_RESULTS; i++) {
      if (scored[i].action.group === 'Models' && ++models > MAX_MODEL_RESULTS) continue;
      out.push(scored[i]);
    }
    return [{ heading: null, scored: out }];
  }

  function optionHtml(n, action, title, idx, searching) {
    var hint = action.hint ? '<span class="pal-keys">' + action.hint.map(function(k) { return '<kbd>' + esc(k) + '</kbd>'; }).join('') + '</span>' : '';
    var meta = action.meta ? resolve(action.meta) : '';
    var group = searching ? '<span class="pal-meta">' + esc(action.group) + '</span>' : '';
    return '<div class="pal-opt" role="option" id="pal-opt-' + n + '" data-n="' + n + '" aria-selected="false">'
      + '<span class="pal-title">' + highlight(title, idx) + '</span>'
      + (meta ? '<span class="pal-meta">' + esc(meta) + '</span>' : '')
      + hint + group
      + '</div>';
  }

  function render() {
    var query = el.input.value;
    var searching = !!query.trim();
    var groups = search(query);
    shown = [];
    var html = '';
    groups.forEach(function(g) {
      var inner = '';
      if (g.actions) {
        g.actions.forEach(function(a) {
          shown.push({ action: a });
          inner += optionHtml(shown.length - 1, a, resolve(a.title), null, false);
        });
        html += '<div role="group" aria-label="' + esc(g.heading) + '"><div class="pal-group" aria-hidden="true">' + esc(g.heading) + '</div>' + inner + '</div>';
      } else {
        g.scored.forEach(function(s) {
          shown.push({ action: s.action });
          inner += optionHtml(shown.length - 1, s.action, s.title, s.idx, true);
        });
        html += inner;
      }
    });
    if (!shown.length) {
      html = '<div class="pal-empty"><p>No match for “' + esc(query.trim()) + '”.</p><p class="pal-empty-sub">Try a tab name, a tool, or a model such as “gpt”.</p></div>';
    }
    el.list.innerHTML = html;
    el.list.classList.toggle('searching', searching);
    active = 0;
    paintActive(false);
    el.status.textContent = shown.length ? shown.length + (shown.length === 1 ? ' result' : ' results') : 'No results';
  }

  function paintActive(scroll) {
    var opts = el.list.querySelectorAll('[role="option"]');
    for (var i = 0; i < opts.length; i++) opts[i].setAttribute('aria-selected', i === active ? 'true' : 'false');
    var cur = opts[active];
    if (cur) {
      el.input.setAttribute('aria-activedescendant', cur.id);
      if (scroll) cur.scrollIntoView({ block: 'nearest' });
    } else {
      el.input.removeAttribute('aria-activedescendant');
    }
  }

  function move(delta) {
    if (!shown.length) return;
    active = (active + delta + shown.length) % shown.length;
    paintActive(true);
  }

  function runAt(n) {
    var item = shown[n];
    if (!item) return;
    close();
    pushRecent(item.action.id);
    setTimeout(function() { item.action.run(); }, 0);
  }

  function onKeydown(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'PageDown') { e.preventDefault(); move(5); }
    else if (e.key === 'PageUp') { e.preventDefault(); move(-5); }
    else if (e.key === 'Enter') { e.preventDefault(); if (!e.isComposing) runAt(active); }
  }

  function welcomeOpen() {
    var w = document.getElementById('onboarding-overlay');
    return !!w && w.classList.contains('open') && !w.classList.contains('hidden');
  }

  function isOpen() { return !!el.overlay && el.overlay.classList.contains('open'); }

  function open() {
    if (!el.overlay || isOpen() || welcomeOpen()) return;
    if (window.SHORTCUTS && SHORTCUTS.isOpen()) SHORTCUTS.close();
    el.input.value = '';
    if (window.SHELL) SHELL.rememberOpener(el.overlay, document.activeElement);
    el.overlay.classList.add('open');
    render();
    el.input.focus({ preventScroll: true });
  }
  function close() {
    if (!el.overlay) return;
    el.overlay.classList.remove('open');
    if (document.activeElement === el.input) el.input.blur();
  }
  function toggle() { if (isOpen()) close(); else open(); }
  function register(action) { if (action && action.id && action.title && typeof action.run === 'function') extra.push(action); }

  function init() {
    el.overlay = document.getElementById('palette-overlay');
    el.input = document.getElementById('palette-input');
    el.list = document.getElementById('palette-list');
    el.status = document.getElementById('palette-status');
    var kbd = document.getElementById('palette-kbd');
    if (kbd) kbd.textContent = isMac() ? '⌘K' : 'Ctrl K';
    var btn = document.getElementById('palette-btn');
    if (btn && !isMac()) btn.title = 'Search (Ctrl+K)'; else if (btn) btn.title = 'Search (⌘K)';
    if (!el.overlay) return;

    el.input.addEventListener('input', render);
    el.input.addEventListener('keydown', onKeydown);
    el.list.addEventListener('click', function(e) {
      var o = e.target.closest('[role="option"]');
      if (o) runAt(Number(o.dataset.n));
    });
    el.list.addEventListener('pointermove', function(e) {
      var o = e.target.closest('[role="option"]');
      if (!o) return;
      var n = Number(o.dataset.n);
      if (n !== active) { active = n; paintActive(false); }
    });

    document.addEventListener('keydown', function(e) {
      if (!(e.metaKey || e.ctrlKey) || e.shiftKey || e.altKey || String(e.key).toLowerCase() !== 'k') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      toggle();
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { open: open, close: close, toggle: toggle, isOpen: isOpen, register: register };
})();
