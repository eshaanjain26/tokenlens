/* ══════════════════════════════════════════════════════════
   SHORTCUTS — single-key shortcuts and the "?" sheet
   Ignored while typing. The command palette (Ctrl/Cmd+K) lives in palette.js.
   ══════════════════════════════════════════════════════════ */
window.SHORTCUTS = (function() {
  var IS_MAC = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
  var MOD = IS_MAC ? '⌘' : 'Ctrl';
  var CHORD_MS = 1000;
  var TABS = { c: 'compare', b: 'benchmarks', h: 'howitworks', a: 'analytics' };
  var chordAt = 0;

  var GROUPS = [
    { title: 'Go to', items: [
      { keys: ['g', 'c'], label: 'Compare' },
      { keys: ['g', 'b'], label: 'Benchmarks' },
      { keys: ['g', 'h'], label: 'How it works' },
      { keys: ['g', 'a'], label: 'Analytics' }
    ] },
    { title: 'Actions', items: [
      { keys: [MOD, 'K'], label: 'Open the command palette' },
      { keys: ['/'], label: 'Search models' },
      { keys: [MOD, 'Enter'], label: 'Send the prompt' },
      { keys: ['d'], label: 'Switch between light and dark' },
      { keys: ['?'], label: 'Show this sheet' },
      { keys: ['Esc'], label: 'Close a dialog or menu' }
    ] }
  ];

  function isTyping(t) {
    if (!t || t === document.body) return false;
    var tag = t.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (tag === 'INPUT') return !/^(checkbox|radio|button|submit|reset|range|color|file)$/.test(t.type);
    if (t.isContentEditable) return true;
    var role = t.getAttribute && t.getAttribute('role');
    return role === 'textbox' || role === 'combobox' || role === 'searchbox';
  }

  function overlay() { return document.getElementById('shortcuts-overlay'); }
  function isOpen() { var o = overlay(); return !!o && o.classList.contains('open'); }
  function open() {
    var o = overlay();
    if (!o) return;
    if (window.PALETTE && PALETTE.isOpen()) PALETTE.close();
    if (!o.dataset.ready) render();
    o.classList.add('open');
  }
  function close() { var o = overlay(); if (o) o.classList.remove('open'); }
  function toggle() { if (isOpen()) close(); else open(); }

  function kbds(keys) {
    return keys.map(function(k) { return '<kbd>' + k + '</kbd>'; }).join('<span class="sc-then" aria-hidden="true"></span>');
  }

  function render() {
    var body = document.getElementById('shortcuts-body');
    if (!body) return;
    body.innerHTML = GROUPS.map(function(g) {
      return '<section class="sc-group"><h3 class="sc-group-title">' + g.title + '</h3><dl class="sc-list">'
        + g.items.map(function(it) {
          var spoken = it.keys.join(it.keys[0] === 'g' ? ' then ' : ' plus ');
          return '<div class="sc-row"><dt>' + it.label + '</dt><dd><span class="sr-only">' + spoken + '</span><span class="sc-keys" aria-hidden="true">' + kbds(it.keys) + '</span></dd></div>';
        }).join('')
        + '</dl></section>';
    }).join('');
    overlay().dataset.ready = '1';
  }

  function goTab(name) {
    var t = document.querySelector('.tab-btn[data-tab="' + name + '"]');
    if (t) t.click();
  }

  function focusModelSearch() {
    if (window.APP && APP.railExpand) APP.railExpand('rail-models');
    setTimeout(function() {
      var ms = document.getElementById('model-search');
      if (ms && ms.offsetParent !== null) { ms.focus(); ms.select(); }
    }, 60);
  }

  function onKey(e) {
    if (e.defaultPrevented || e.isComposing) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (isTyping(e.target)) return;
    var key = e.key;
    var modal = document.body.classList.contains('modal-open');

    if (key === '?') {
      if (modal && !isOpen()) return;
      e.preventDefault();
      toggle();
      return;
    }
    if (modal) return;

    if (chordAt && Date.now() - chordAt < CHORD_MS && TABS[key.toLowerCase()]) {
      chordAt = 0;
      e.preventDefault();
      goTab(TABS[key.toLowerCase()]);
      return;
    }
    chordAt = 0;

    if (e.shiftKey || e.repeat) return;
    if (key === 'g') { chordAt = Date.now(); return; }
    if (key === '/') { e.preventDefault(); focusModelSearch(); return; }
    if (key === 'd') { e.preventDefault(); if (window.APP) APP.toggleDark(); }
  }

  document.addEventListener('keydown', onKey);

  return { open: open, close: close, toggle: toggle, isOpen: isOpen, isTyping: isTyping, groups: GROUPS, mod: MOD, goTab: goTab, focusModelSearch: focusModelSearch };
})();
