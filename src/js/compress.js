// ── Feature 2: Context Compression ───────────────
window.COMPRESS = (function() {
  var _compressed = '';
  var _FILLERS = [
    /\bplease\b\s*/gi,
    /\bcould you\b\s*/gi,
    /\bI would like you to\b\s*/gi,
    /\bI want you to\b\s*/gi,
    /\bas an AI\b[^,.]*/gi,
    /\bkindly\b\s*/gi,
    /\bcan you please\b\s*/gi,
    /\bwould you be able to\b\s*/gi,
    /\bI was wondering if\b\s*/gi,
    /\bfeel free to\b\s*/gi,
    /\bin your response,?\s*/gi,
    /\bmake sure to\b\s*/gi,
    /\bensure that\b\s*/gi,
  ];

  function _estTokens(s) { return Math.ceil((s||'').length / 4); }

  function toggle() {
    var panel = document.getElementById('compress-panel');
    if (!panel) return;
    if (panel.classList.contains('open')) {
      panel.classList.remove('open');
    } else {
      _run();
      panel.classList.add('open');
    }
  }

  function _run() {
    var ta = document.getElementById('prompt-input');
    var text = ta ? ta.value : '';
    if (!text.trim()) return;

    var compressed = text;
    _FILLERS.forEach(function(re) { compressed = compressed.replace(re, ''); });
    // collapse double spaces/newlines
    compressed = compressed.replace(/  +/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
    // capitalize first char if lowercase after removal
    if (compressed.length > 0) compressed = compressed[0].toUpperCase() + compressed.slice(1);

    _compressed = compressed;

    var origTok = _estTokens(text);
    var newTok = _estTokens(compressed);
    var saving = origTok > 0 ? Math.round((1 - newTok/origTok) * 100) : 0;

    var origEl = document.getElementById('compress-orig-text');
    var newEl = document.getElementById('compress-new-text');
    var origTokEl = document.getElementById('compress-orig-tok');
    var newTokEl = document.getElementById('compress-new-tok');
    var savLbl = document.getElementById('compress-savings-lbl');

    if (origEl) origEl.textContent = text;
    if (newEl) newEl.textContent = compressed;
    if (origTokEl) origTokEl.textContent = origTok + ' tok';
    if (newTokEl) newTokEl.textContent = newTok + ' tok';
    if (savLbl) savLbl.textContent = saving > 0 ? ('−' + saving + '% tokens') : 'No savings found';

    // Semantic cache check
    _checkCache(text);
  }

  function _checkCache(text) {
    var cacheEl = document.getElementById('compress-cache-hit');
    if (!cacheEl) return;
    var words = text.toLowerCase().split(/\W+/).filter(function(w){ return w.length > 4; });
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    var bestMatch = null, bestScore = 0;
    models.forEach(function(m) {
      var sess = STATE.getSession ? STATE.getSession(m.id) : null;
      if (!sess || !sess.turns) return;
      sess.turns.forEach(function(t) {
        if (!t.prompt) return;
        var tWords = t.prompt.toLowerCase().split(/\W+/).filter(function(w){ return w.length > 4; });
        var common = words.filter(function(w){ return tWords.indexOf(w) >= 0; });
        var score = words.length ? common.length / words.length : 0;
        if (score > bestScore) { bestScore = score; bestMatch = t; }
      });
    });
    if (bestScore >= 0.6 && bestMatch) {
      cacheEl.classList.add('visible');
      cacheEl.innerHTML = '<strong>Semantic cache hit</strong> (' + Math.round(bestScore*100) + '% similarity)<br>'
        + 'Similar prompt found: "' + (bestMatch.prompt||'').slice(0,80) + '…"<br>'
        + '<span>Consider reusing the cached response instead of sending again.</span>';
    } else {
      cacheEl.classList.remove('visible');
    }
  }

  function apply() {
    var ta = document.getElementById('prompt-input');
    if (ta && _compressed) {
      ta.value = _compressed;
      ta.dispatchEvent(new Event('input'));
    }
    var panel = document.getElementById('compress-panel');
    if (panel) panel.classList.remove('open');
  }

  return { toggle: toggle, apply: apply };
})();

