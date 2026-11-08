/* ══════════════════════════════════════════════════════════
   SHELL — dialog management, tab sync, rail resets
   Modules open and close overlays by toggling `.open`; this file
   layers focus handling, inert background and ARIA on top of that.
   ══════════════════════════════════════════════════════════ */
(function() {
  var FOCUSABLE = 'a[href],button:not([disabled]),input:not([disabled]):not([type=hidden]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';
  var BACKGROUND = ['#header', '#main', '#bottom-nav', '#notes-fab', '#toast-container'];
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
    }
    var obs = new MutationObserver(sync);
    tabs.forEach(function(t) { obs.observe(t, { attributes: true, attributeFilter: ['class'] }); });
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

  function init() {
    initSheet();
    initOverlays();
    initTabs();
    initToolsMenu();
    initTemplates();
    initRailReset();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
