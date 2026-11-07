// ── Enhancement 1: Prompt Quality Scorer ─────────
window.QUALITY = (function() {
  var _FILLER = /\bplease\b|\bcould you\b|\bi would like\b|\bjust\b|\bkindly\b|\bfeel free\b|\bif you can\b|\bas an ai\b/gi;
  var _INJECT = /ignore (previous|all|above|prior)|disregard|forget (all|previous|your|prior)|you are now|new persona|act as (?!an? assistant)/i;
  var _CODE_KW = /```|function |class |import |def |SELECT |<[a-z]+>/i;
  var _VAGUE = /\b(something|stuff|things|good|nice|better|improve|help me)\b/gi;

  function score(text) {
    if (!text || text.trim().length < 3) return null;
    var words = text.trim().split(/\s+/).length;
    var chars = text.trim().length;

    // Clarity: penalize vague words, reward specificity
    var vagueCount = (text.match(_VAGUE) || []).length;
    var clarity = Math.max(20, Math.min(100, 80 - vagueCount * 15 + Math.min(words / 3, 20)));

    // Specificity: reward longer, structured prompts
    var specificity = Math.min(100, 30 + Math.min(words * 1.5, 50) + (_CODE_KW.test(text) ? 15 : 0));

    // Conciseness: penalize extreme verbosity or filler
    var fillerCount = (text.match(_FILLER) || []).length;
    var conciseness = Math.max(20, Math.min(100, 100 - fillerCount * 12 - (words > 200 ? 20 : 0)));

    // Injection risk
    var injectionRisk = _INJECT.test(text);

    var overall = Math.round((clarity * 0.4 + specificity * 0.35 + conciseness * 0.25));
    return { overall: overall, clarity: Math.round(clarity), specificity: Math.round(specificity), conciseness: Math.round(conciseness), injectionRisk: injectionRisk, words: words };
  }

  function _color(v) {
    if (v >= 75) return '#22C55E';
    if (v >= 50) return '#F59E0B';
    return '#EF4444';
  }

  function _svgRing(score) {
    var r = 14, circ = 2 * Math.PI * r;
    var dashOffset = circ * (1 - score / 100);
    var color = _color(score);
    return '<svg width="36" height="36" viewBox="0 0 36 36"><circle cx="18" cy="18" r="' + r + '" fill="none" stroke="var(--border)" stroke-width="3"/><circle cx="18" cy="18" r="' + r + '" fill="none" stroke="' + color + '" stroke-width="3" stroke-dasharray="' + circ.toFixed(1) + '" stroke-dashoffset="' + dashOffset.toFixed(1) + '" stroke-linecap="round" transform="rotate(-90 18 18)"/></svg>';
  }

  function update() {
    var ta = document.getElementById('prompt-input');
    var bar = document.getElementById('quality-bar');
    if (!ta || !bar) return;
    var text = ta.value || '';
    if (!text.trim()) { bar.classList.remove('visible'); return; }
    var s = score(text);
    if (!s) { bar.classList.remove('visible'); return; }

    bar.classList.add('visible');
    bar.innerHTML = '<div class="qscore-ring">' + _svgRing(s.overall) + '<div class="qscore-num">' + s.overall + '</div></div>'
      + '<div class="qdim"><div class="qdim-dot" style="background:' + _color(s.clarity) + '"></div><div><div>' + s.clarity + '</div><div class="qdim-label">Clarity</div></div></div>'
      + '<div class="qdim"><div class="qdim-dot" style="background:' + _color(s.specificity) + '"></div><div><div>' + s.specificity + '</div><div class="qdim-label">Specific</div></div></div>'
      + '<div class="qdim"><div class="qdim-dot" style="background:' + _color(s.conciseness) + '"></div><div><div>' + s.conciseness + '</div><div class="qdim-label">Concise</div></div></div>'
      + '<div style="font-size:10px;color:var(--text-3);margin-left:4px">' + s.words + ' words</div>'
      + (s.injectionRisk ? '<span class="q-injection-warn">⚠️ Injection risk detected</span>' : '')
      + (s.overall >= 80 ? '<span style="font-size:10px;color:var(--tl);font-weight:700">✓ Strong prompt</span>' : '');
  }

  // Wire up to textarea input
  (function _wire() {
    setTimeout(function() {
      var ta = document.getElementById('prompt-input');
      if (ta) ta.addEventListener('input', function() { setTimeout(update, 100); });
    }, 800);
  })();

  return { score: score, update: update };
})();

