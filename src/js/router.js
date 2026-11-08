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

  var _text = '';
  function analyze(quiet) {
    var inp = document.getElementById('router-input');
    var text = inp ? (inp.value || '').trim() : '';
    var res = document.getElementById('router-results');
    var cp = document.getElementById('router-copy');
    if (!res) return;
    if (cp) cp.hidden = true;
    if (!text) { res.innerHTML = quiet === true ? '' : '<div class="tl-block">' + TLUI.empty('Enter a prompt above to analyze it.') + '</div>'; return; }

    var complexity = _complexity(text);
    var tokens = Math.ceil(text.length / 4);
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    if (!models.length) { res.innerHTML = '<div class="tl-block">' + TLUI.empty('Select at least one model in the sidebar first.') + '</div>'; return; }

    var scored = models.map(function(m) {
      return { m: m, score: _score(m, complexity, tokens) };
    }).sort(function(a,b){ return b.score - a.score; }).slice(0,3);

    var complexLabels = { simple:'Simple query', moderate:'Moderate complexity', complex:'Complex or long-form' };
    var rows = scored.map(function(r, i) {
      var pIn = r.m.pricing ? parseFloat(r.m.pricing.prompt) * 1e6 : null;
      var estCost = pIn ? '$' + (pIn * tokens / 1e6 * 1000).toFixed(4) : 'n/a';
      var conf = Math.round(r.score * 100);
      return {
        cls: i === 0 ? 'best' : '',
        w: r.score,
        sort: [i + 1, r.m.name || r.m.id, estCost, conf],
        cells: [
          '<span class="mute">' + (i + 1) + '</span>',
          '<div class="wrap-cell"><div class="tl-name hl">' + esc(r.m.name || r.m.id) + '</div><div class="tl-meta">' + esc(_reason(r.m, complexity, r.score)) + (r.m.context_length ? ' · ' + Math.round(r.m.context_length/1000) + 'K context' : '') + '</div></div>',
          esc(estCost),
          '<span class="hl">' + conf + '%</span>'
        ]
      };
    });
    var topName = scored[0] ? scored[0].m.name || scored[0].m.id : 'the top model';
    _text = 'Smart route: ' + complexLabels[complexity] + ' (~' + tokens + ' input tokens)\nBest fit: ' + topName + ' (' + Math.round(scored[0].score * 100) + '% confidence)';

    res.innerHTML = '<div class="tl-block"><div class="tl-block-head"><div><h3 class="tl-h">Recommended models</h3>'
      + '<p class="tl-sub rt-sum">Detected ' + TLUI.pill(complexLabels[complexity]) + ' about ' + tokens.toLocaleString() + ' input tokens.</p></div></div>'
      + TLUI.ledger({
          label: 'Routing recommendations', cols: '24px minmax(0,1fr) 120px 88px', colsSm: '20px minmax(0,1fr) 64px', min: 0,
          head: [{label: '#'}, {label: 'Model'}, {label: 'Est. cost / 1K prompts', num: true, cls: 'hide-sm'}, {label: 'Confidence', num: true}],
          rows: rows
        })
      + '<p class="rt-why">The prompt was classified as <b>' + complexLabels[complexity] + '</b>. The engine weighted cost efficiency (40%), context window fit (35%) and a carbon footprint proxy (25%). '
      + (complexity === 'complex' ? 'Complex prompts need larger context windows, which down-scored smaller models. ' : '')
      + (complexity === 'simple' ? 'Simple prompts benefit most from low-cost, fast models. ' : '')
      + '<b>' + esc(topName) + '</b> scored highest on the combined routing matrix.</p></div>';
    if (cp) cp.hidden = false;
  }
  var live = TLUI.debounce(function() { analyze(true); }, 300);
  function copy() { if (_text) TLUI.copy(_text, 'Routing result copied.'); }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('router-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, analyze: analyze, live: live, copy: copy };
})();

