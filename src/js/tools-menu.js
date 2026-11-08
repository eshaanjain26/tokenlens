/* ══════════════════════════════════════════════════════════
   TOOLS MENU — grouped sections, inline search, arrow-key navigation
   Item activation stays on each button's own onclick; this module
   only filters, focuses and moves selection.
   ══════════════════════════════════════════════════════════ */
(function() {
  var dd, search, empty;

  function items() { return Array.prototype.slice.call(dd.querySelectorAll('.tools-item')).filter(function(b) { return !b.hidden; }); }

  function filter() {
    var q = search.value.trim().toLowerCase();
    var words = q.split(/\s+/).filter(Boolean);
    var shown = 0;
    dd.querySelectorAll('.tools-item').forEach(function(b) {
      var hay = (b.textContent + ' ' + (b.dataset.keys || '')).toLowerCase();
      var hit = words.every(function(w) { return hay.indexOf(w) !== -1; });
      b.hidden = !hit;
      if (hit) shown++;
    });
    dd.querySelectorAll('.tools-group').forEach(function(g) {
      g.hidden = !g.querySelector('.tools-item:not([hidden])');
    });
    empty.hidden = shown > 0;
  }

  function reset() {
    search.value = '';
    filter();
  }

  function move(list, from, delta) {
    if (!list.length) return;
    var i = from + delta;
    if (i < 0) i = list.length - 1;
    if (i >= list.length) i = 0;
    list[i].focus();
    list[i].scrollIntoView({ block: 'nearest' });
  }

  function init() {
    dd = document.getElementById('tools-dropdown');
    search = document.getElementById('tools-search');
    empty = document.getElementById('tools-empty');
    if (!dd || !search || !empty) return;

    search.addEventListener('input', filter);

    new MutationObserver(function() {
      if (dd.classList.contains('open')) {
        reset();
        if (window.matchMedia('(pointer: fine)').matches) search.focus({ preventScroll: true });
      }
    }).observe(dd, { attributes: true, attributeFilter: ['class'] });

    dd.addEventListener('keydown', function(e) {
      var list = items(), cur = list.indexOf(document.activeElement), inSearch = document.activeElement === search;
      var handled = true;
      if (e.key === 'ArrowDown') move(list, inSearch ? -1 : cur, 1);
      else if (e.key === 'ArrowUp') move(list, inSearch ? 0 : cur, -1);
      else if (e.key === 'Home' && !inSearch) move(list, -1, 1);
      else if (e.key === 'End' && !inSearch) move(list, 0, -1);
      else if (e.key === 'Enter' && inSearch) { if (list[0]) list[0].click(); }
      else if (!inSearch && e.key.length === 1 && !e.metaKey && !e.ctrlKey && !e.altKey && e.key !== ' ') { search.focus(); handled = false; }
      else handled = false;
      if (handled) { e.preventDefault(); e.stopImmediatePropagation(); }
    }, true);

    document.addEventListener('keydown', function(e) {
      if (e.key === '/' && dd.classList.contains('open') && document.activeElement !== search) {
        e.preventDefault();
        search.focus();
      }
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
