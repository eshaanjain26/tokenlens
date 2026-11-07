/* ══════════════════════════════════════════════════════════
   MODULE — CACHE
   Prompt-caching settings (on/off, assumed hit rate) + per-turn plan
   ══════════════════════════════════════════════════════════ */
window.CACHE = (function() {
  var KEY = 'tl_cache_v1';
  var _on = true, _hit = 90;
  try {
    var raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (raw) {
      _on = raw.on !== false;
      if (typeof raw.hit === 'number') _hit = Math.max(0, Math.min(100, raw.hit));
    }
  } catch(e) {}

  function _save() { try { localStorage.setItem(KEY, JSON.stringify({ on: _on, hit: _hit })); } catch(e) {} }
  function _changed() { if (typeof USAGE !== 'undefined') USAGE.refresh(); }

  function isEnabled()  { return _on; }
  function getHitRate() { return _hit; }
  function setEnabled(b) { _on = !!b; _save(); _changed(); }
  function setHitRate(p, silent) {
    p = parseInt(p, 10);
    if (isNaN(p)) return;
    _hit = Math.max(0, Math.min(100, p));
    _save();
    if (!silent) _changed();
  }

  // Decide how many of this turn's input tokens are cache reads / writes.
  // Turn 1 has no prefix to read. On turn 2+, the prior context is the
  // cacheable prefix; the assumed hit rate says how much of it is still warm.
  function plan(model, session, promptTok, turnInput) {
    var t = CALC.cacheTerms(model);
    if (!_on || !t.supported) return { cached: 0, written: 0, on: false, supported: t.supported };
    var prior   = Math.max(0, turnInput - promptTok);
    var cached  = session.turns.length ? Math.round(prior * _hit / 100) : 0;
    var written = t.write > 1 ? promptTok : 0;
    return { cached: cached, written: written, on: true, supported: true };
  }

  return { isEnabled: isEnabled, getHitRate: getHitRate, setEnabled: setEnabled, setHitRate: setHitRate, plan: plan };
})();

