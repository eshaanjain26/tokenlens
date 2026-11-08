/* ══════════════════════════════════════════════════════════
   MODULE 0 — TOAST  (notification system + UI utilities)
   Replaces all native alert() / confirm() dialogs.
   Stack of at most 3, auto-dismiss that pauses on hover/focus,
   optional action button, announced through the aria-live container.
   ══════════════════════════════════════════════════════════ */
window.TOAST = (function() {
  var ICONS = { info:'info', success:'checkCircle', warning:'alert', error:'xCircle' };
  var DURATIONS = { info:3500, success:3000, warning:4000, error:5000 };
  var MAX_STACK = 3;
  var ACTION_MIN = 7000;
  var EXIT_MS = 160;
  var _toolsOpen = false;
  var _held = [];

  var PICTOGRAPHS = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}️‍]/gu;

  function plain(msg) {
    return String(msg == null ? '' : msg).replace(PICTOGRAPHS, '').replace(/\s{2,}/g, ' ').trim();
  }

  function dismiss(t, immediate) {
    if (!t || !t.parentNode || t._leaving) return;
    clearTimeout(t._timer);
    t._leaving = true;
    if (immediate) { t.remove(); return; }
    t.classList.add('leaving');
    setTimeout(function() { if (t.parentNode) t.remove(); }, EXIT_MS);
  }

  function arm(t) {
    clearTimeout(t._timer);
    if (t._persist) return;
    t._timer = setTimeout(function() { dismiss(t); }, t._duration);
  }

  function welcomeOpen() {
    var w = document.getElementById('onboarding-overlay');
    return !!w && w.classList.contains('open') && !w.classList.contains('hidden');
  }

  function flushHeld() {
    var held = _held;
    _held = [];
    held.forEach(function(h) { show(h[0], h[1], h[2], h[3]); });
  }

  function show(msg, type, duration, opts) {
    if (welcomeOpen()) {
      if (_held.length < MAX_STACK) _held.push([msg, type, duration, opts]);
      return null;
    }
    type = ICONS[type] ? type : 'info';
    opts = opts || {};
    var container = document.getElementById('toast-container');
    if (!container) return null;
    var text = plain(msg);
    if (!text) return null;

    var live = container.querySelectorAll('.toast:not(.leaving)');
    for (var i = 0; i < live.length; i++) {
      if (live[i]._text === text && live[i]._type === type) { arm(live[i]); return live[i]; }
    }
    while (live.length >= MAX_STACK) {
      dismiss(live[0], true);
      live = container.querySelectorAll('.toast:not(.leaving)');
    }

    var t = document.createElement('div');
    t.className = 'toast ' + type;
    if (type === 'error') t.setAttribute('role', 'alert');
    t._text = text;
    t._type = type;
    t._persist = !!opts.persist;
    t._duration = Math.max(duration || DURATIONS[type], opts.action ? ACTION_MIN : 0);

    var icon = document.createElement('span');
    icon.className = 'toast-icon';
    icon.innerHTML = window.TL_ICON(ICONS[type]);
    var body = document.createElement('span');
    body.className = 'toast-msg';
    body.textContent = text;
    t.appendChild(icon);
    t.appendChild(body);

    if (opts.action && opts.action.label) {
      var act = document.createElement('button');
      act.type = 'button';
      act.className = 'toast-action';
      act.textContent = opts.action.label;
      act.addEventListener('click', function() {
        dismiss(t);
        if (typeof opts.action.onClick === 'function') opts.action.onClick();
      });
      t.appendChild(act);
    }

    var close = document.createElement('button');
    close.type = 'button';
    close.className = 'toast-close';
    close.setAttribute('aria-label', 'Dismiss notification');
    close.innerHTML = window.TL_ICON('x');
    close.addEventListener('click', function() { dismiss(t); });
    t.appendChild(close);

    t.addEventListener('mouseenter', function() { clearTimeout(t._timer); });
    t.addEventListener('mouseleave', function() { arm(t); });
    t.addEventListener('focusin', function() { clearTimeout(t._timer); });
    t.addEventListener('focusout', function() { arm(t); });

    container.appendChild(t);
    arm(t);
    return t;
  }

  function info(msg, opts)    { return show(msg, 'info',    DURATIONS.info,    opts); }
  function success(msg, opts) { return show(msg, 'success', DURATIONS.success, opts); }
  function warning(msg, opts) { return show(msg, 'warning', DURATIONS.warning, opts); }
  function error(msg, opts)   { return show(msg, 'error',   DURATIONS.error,   opts); }

  function _closeOnboarding() {
    var el = document.getElementById('onboarding-overlay');
    if (el) el.classList.add('hidden');
    try { localStorage.setItem('lti_onboarded_v1', '1'); } catch(e) {}
    flushHeld();
  }

  function _openAbout() {
    var el = document.getElementById('about-overlay');
    if (el) el.style.display === 'flex' ? el.style.display = '' : (el.classList.add('open'));
  }
  function _closeAbout() {
    var el = document.getElementById('about-overlay');
    if (el) el.classList.remove('open');
  }

  function _toggleTools() {
    _toolsOpen = !_toolsOpen;
    var dd = document.getElementById('tools-dropdown');
    var btn = document.getElementById('tools-btn');
    if (dd) dd.classList.toggle('open', _toolsOpen);
    if (btn) btn.setAttribute('aria-expanded', _toolsOpen ? 'true' : 'false');
  }
  function _closeTools() {
    _toolsOpen = false;
    var dd = document.getElementById('tools-dropdown');
    var btn = document.getElementById('tools-btn');
    if (dd) dd.classList.remove('open');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }

  function _initOnboarding() {
    var seen = false;
    try { seen = !!localStorage.getItem('lti_onboarded_v1'); } catch(e) {}
    if (seen) {
      var el = document.getElementById('onboarding-overlay');
      if (el) el.classList.add('hidden');
      flushHeld();
    }
  }

  document.addEventListener('click', function(e) {
    if (_toolsOpen) {
      var wrap = document.querySelector('.tools-wrap');
      if (wrap && !wrap.contains(e.target)) _closeTools();
    }
  });

  return { show, info, success, warning, error, dismiss, _closeOnboarding, _openAbout, _closeAbout, _toggleTools, _closeTools, _initOnboarding };
})();
