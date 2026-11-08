// ── Boot ──────────────────────────────────────────
(function() {
  var THEME_KEY = 'lti_theme_v1';
  var dark = window.matchMedia('(prefers-color-scheme: dark)');

  function chosen() {
    try { return localStorage.getItem(THEME_KEY); } catch (e) { return null; }
  }
  function forget() {
    try { localStorage.removeItem(THEME_KEY); } catch (e) {}
  }

  var seeded = false;
  if (!chosen() && dark.matches) {
    try { localStorage.setItem(THEME_KEY, 'dark'); seeded = true; } catch (e) {}
  }
  APP.init();
  if (seeded) forget();

  dark.addEventListener('change', function(e) {
    if (chosen() || document.body.classList.contains('dark') === e.matches) return;
    APP.toggleDark();
    forget();
  });
})();
