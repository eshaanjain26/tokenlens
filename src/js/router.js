// ── Feature 1: Smart Route ───────────────────────
window.ROUTER = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function open() {
    var ov = document.getElementById('router-overlay');
    if (ov) ov.classList.add('open');
  }
  function close() {
    var ov = document.getElementById('router-overlay');
    if (ov) ov.classList.remove('open');
  }

  function _complexity(text) {
    var words = text.trim().split(/\s+/).length;
    var codeKw = /\bcode\b|function|class|def |import |```|algorithm|implement/i.test(text);
    var mathKw = /\bmath\b|equation|calcul|formula|integral|derivative|proof/i.test(text);
    var analKw = /\banalyz|compar|evaluat|assess|research|strateg|comprehensive/i.test(text);
    if (words > 80 || (codeKw && mathKw) || analKw) return 'complex';
    if (words > 25 || codeKw || mathKw) return 'moderate';
    return 'simple';
  }

  function _score(model, complexity, tokens) {
    var pIn = model.pricing ? parseFloat(model.pricing.prompt) * 1e6 : 5;
    var pOut = model.pricing ? parseFloat(model.pricing.completion) * 1e6 : 5;
    if (!pIn || isNaN(pIn)) pIn = 5;
    if (!pOut || isNaN(pOut)) pOut = 5;
    var ctx = model.context_length || 8192;
    var avgPrice = (pIn + pOut) / 2;

    // cost score: cheaper = higher
    var sCost = Math.max(0, 1 - avgPrice / 30);
    // eco proxy: cost correlates with model size/power
    var sEco = Math.max(0, 1 - avgPrice / 25);
    // ctx fit
    var sCtx = complexity === 'complex' ? (ctx >= 32000 ? 1 : ctx / 32000) : 1;
    // complexity fit: penalize tiny cheap models for complex tasks
    var complexPenalty = complexity === 'complex' && avgPrice < 0.3 ? 0.6 : 1;

    var raw = (sCost * 0.4 + sEco * 0.25 + sCtx * 0.35) * complexPenalty;
    return Math.min(Math.max(raw, 0), 1);
  }

  function _reason(model, complexity, score) {
    var pIn = model.pricing ? parseFloat(model.pricing.prompt) * 1e6 : 5;
    if (!pIn || isNaN(pIn)) pIn = 5;
    var ctx = model.context_length || 8192;
    var reasons = [];
    if (pIn < 1) reasons.push('very low input cost');
    else if (pIn < 5) reasons.push('competitive pricing');
    if (ctx >= 100000) reasons.push('large context window (' + Math.round(ctx/1000) + 'K)');
    if (complexity === 'simple' && pIn < 2) reasons.push('ideal for simple queries');
    if (complexity === 'complex' && ctx >= 32000) reasons.push('handles complex multi-step tasks');
    if (reasons.length === 0) reasons.push('balanced cost-performance profile');
    return reasons.join(', ');
  }

  function analyze() {
    var inp = document.getElementById('router-input');
    var text = inp ? (inp.value || '').trim() : '';
    var res = document.getElementById('router-results');
    if (!res) return;
    if (!text) { res.innerHTML = '<p style="color:var(--text-2);font-size:12px">Enter a prompt above to analyze.</p>'; return; }

    var complexity = _complexity(text);
    var tokens = Math.ceil(text.length / 4);
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    if (!models.length) { res.innerHTML = '<p style="color:var(--text-2);font-size:12px">Select at least one model in the sidebar first.</p>'; return; }

    var scored = models.map(function(m) {
      return { m: m, score: _score(m, complexity, tokens) };
    }).sort(function(a,b){ return b.score - a.score; }).slice(0,3);

    var medals = ['🥇','🥈','🥉'];
    var complexLabels = { simple:'Simple query', moderate:'Moderate complexity', complex:'Complex / long-form' };
    var complexClasses = { simple:'simple', moderate:'moderate', complex:'complex' };

    var html = '<span class="router-complexity ' + complexClasses[complexity] + '">🧠 Detected: ' + complexLabels[complexity] + '</span>';

    scored.forEach(function(r, i) {
      var pIn = r.m.pricing ? parseFloat(r.m.pricing.prompt) * 1e6 : null;
      var estCost = pIn ? '$' + (pIn * tokens / 1e6 * 1000).toFixed(4) : 'n/a';
      var conf = Math.round(r.score * 100);
      var reason = _reason(r.m, complexity, r.score);
      html += '<div class="router-rec-card">'
        + '<div class="router-rank">' + medals[i] + '</div>'
        + '<div class="router-rec-info">'
        +   '<div class="router-rec-name">' + esc(r.m.name || r.m.id) + '</div>'
        +   '<div class="router-rec-reason">Recommended because: ' + esc(reason) + '</div>'
        +   '<div class="router-rec-meta">'
        +     '<span class="router-meta-chip">~' + esc(estCost) + '/1K prompts</span>'
        +     (r.m.context_length ? '<span class="router-meta-chip">' + Math.round(r.m.context_length/1000) + 'K ctx</span>' : '')
        +   '</div>'
        + '</div>'
        + '<div class="router-conf"><div class="router-conf-pct">' + conf + '%</div><div style="font-size:9px;color:var(--text-3)">confidence</div></div>'
        + '</div>';
    });

    // Routing reasoning
    var topName = scored[0] ? esc(scored[0].m.name || scored[0].m.id) : 'the top model';
    html += '<div class="router-reasoning">'
      + '<h4>🔍 Routing Reasoning</h4>'
      + '<p>Your prompt was classified as <strong>' + complexLabels[complexity] + '</strong> (~' + tokens + ' input tokens). '
      + 'The engine weighted cost efficiency (40%), context window fit (35%), and carbon footprint proxy (25%). '
      + (complexity === 'complex' ? 'Complex prompts require larger context windows, which down-scored smaller models. ' : '')
      + (complexity === 'simple' ? 'Simple prompts benefit most from low-cost, fast models. ' : '')
      + '<strong>' + topName + '</strong> scored highest on the combined routing matrix.</p>'
      + '</div>';

    res.innerHTML = html;
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('router-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, analyze: analyze };
})();

