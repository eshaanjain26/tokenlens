/* ══════════════════════════════════════════════════════════
   MODULE 0 — TOAST  (notification system + UI utilities)
   Replaces all native alert() / confirm() dialogs
   ══════════════════════════════════════════════════════════ */
window.TOAST = (function() {
  var ICONS = { info:'info', success:'checkCircle', warning:'alert', error:'xCircle' };
  var _toolsOpen = false;

  function show(msg, type, duration) {
    type = type || 'info'; duration = duration || 3500;
    var container = document.getElementById('toast-container');
    if (!container) return;
    var t = document.createElement('div');
    t.className = 'toast ' + type;
    t.setAttribute('role', 'alert');
    t.innerHTML = '<span class="toast-icon">'+window.TL_ICON(ICONS[type])+'</span>'
      +'<span class="toast-msg">'+msg+'</span>'
      +'<button class="toast-close" onclick="this.parentNode.remove()" aria-label="Dismiss notification">'+window.TL_ICON('x')+'</button>';
    container.appendChild(t);
    setTimeout(function(){ if (t.parentNode) t.remove(); }, duration);
  }

  function info(msg)    { show(msg, 'info',    3500); }
  function success(msg) { show(msg, 'success', 3000); }
  function warning(msg) { show(msg, 'warning', 4000); }
  function error(msg)   { show(msg, 'error',   5000); }

  function _closeOnboarding() {
    var el = document.getElementById('onboarding-overlay');
    if (el) el.classList.add('hidden');
    try { localStorage.setItem('lti_onboarded_v1', '1'); } catch(e) {}
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
    }
  }

  // Close tools dropdown when clicking outside
  document.addEventListener('click', function(e) {
    if (_toolsOpen) {
      var wrap = document.querySelector('.tools-wrap');
      if (wrap && !wrap.contains(e.target)) _closeTools();
    }
  });

  return { show, info, success, warning, error, _closeOnboarding, _openAbout, _closeAbout, _toggleTools, _closeTools, _initOnboarding };
})();

