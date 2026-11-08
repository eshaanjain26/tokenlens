// ── Feature 6: Live Benchmarking ─────────────────
window.LIVEBENCH = (function() {
  var _interval = null;
  var _isOpen = false;
  var _baseCache = {};

  // Deterministic hash of a model id -> positive int, so each model gets
  // a stable seed instead of a fresh Math.random() draw on every tick.
  function _hash(str) {
    var h = 0;
    for (var i = 0; i < str.length; i++) { h = (h << 5) - h + str.charCodeAt(i); h |= 0; }
    return Math.abs(h);
  }
  function _seededRandom(seed) {
    var x = Math.sin(seed) * 10000;
    return x - Math.floor(x);
  }

  // Base TTFT by model name heuristic (ms). Cached per model id so the
  // anchor point is stable across the 30s auto-refresh — only the
  // per-tick variance (see _variance) moves.
  function _baseTTFT(m) {
    var id = (m.id||'').toLowerCase();
    if (_baseCache[id] !== undefined) return _baseCache[id];
    var r = _seededRandom(_hash(id));
    var lo, span;
    if (/flash|mini|haiku|nano|turbo/.test(id))            { lo = 180; span = 200; }
    else if (/sonnet|gpt-4o(?!-mini)|pro(?!-exp)/.test(id)) { lo = 400; span = 400; }
    else if (/opus|gpt-4(?!o)|ultra|plus/.test(id))         { lo = 800; span = 600; }
    else                                                    { lo = 350; span = 450; }
    _baseCache[id] = lo + r * span;
    return _baseCache[id];
  }

  // Per-tick jitter around the stable base. Uses a 3-sample average
  // (cheap approximation of gaussian noise via the central limit theorem)
  // instead of a single uniform draw, so ticks drift smoothly rather
  // than snapping between the extremes of the range.
  function _variance(base) {
    var noise = (Math.random() + Math.random() + Math.random()) / 3; // ~N(0.5, small)
    var factor = 0.85 + noise * 0.3;
    return base * factor;
  }

  function _availability() {
    var r = Math.random();
    if (r > 0.98) return 97.2 + Math.random()*1.5; // occasional dip
    return 99.5 + Math.random()*0.4;
  }

  function _drift() { return 85 + Math.random()*14; }

  function _providerStatus(models) {
    var provs = {};
    models.forEach(function(m) {
      var id = (m.id||'').toLowerCase();
      var prov = id.match(/gemini/) ? 'Google' :
                 id.match(/claude/) ? 'Anthropic' :
                 id.match(/gpt|openai/) ? 'OpenAI' :
                 id.match(/llama/) ? 'Meta' :
                 id.match(/mistral/) ? 'Mistral' :
                 id.match(/cohere/) ? 'Cohere' : 'Other';
      if (!provs[prov]) provs[prov] = [];
      provs[prov].push(m);
    });
    return provs;
  }

  function _esc(v) {
    return String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _render() {
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    var bodyEl = document.getElementById('lb-body');
    if (!bodyEl || !_isOpen) return;

    var provs = _providerStatus(models);
    var provHtml = '<div class="lb-provider-row" role="list" aria-label="Provider status">';
    Object.keys(provs).forEach(function(prov) {
      var r = Math.random();
      var dotCls = r > 0.97 ? 'red' : r > 0.92 ? 'amber' : 'green';
      var word = dotCls === 'red' ? 'degraded' : dotCls === 'amber' ? 'slow' : 'operational';
      provHtml += '<span class="lb-prov-chip" role="listitem"><span class="lb-status-dot ' + dotCls + '" aria-hidden="true"></span>' + _esc(prov) + '<span class="sr-only">, ' + word + '</span></span>';
    });
    provHtml += '</div>';

    var updEl = document.getElementById('lb-updated');
    if (updEl) updEl.textContent = 'Updated ' + new Date().toLocaleTimeString();

    var tableHtml;
    if (!models.length) {
      tableHtml = '<div class="lb-empty">Select models in the model panel, then open this panel.</div>';
    } else {
      var rowsHtml = '';
      models.forEach(function(m) {
        var ttft = Math.round(_variance(_baseTTFT(m)));
        var p50 = Math.round(ttft * 1.8);
        var p95 = Math.round(ttft * 3.5);
        var avail = _availability();
        var drift = _drift();
        var driftCls = drift >= 95 ? 'lb-good' : drift >= 90 ? 'lb-warn' : 'lb-bad';
        var availCls = avail >= 99.5 ? 'lb-good' : avail >= 98 ? 'lb-warn' : 'lb-bad';
        rowsHtml += '<tr><td data-first="1" title="' + _esc(m.name || m.id) + '">' + _esc((m.name || m.id).slice(0, 28)) + '</td>'
          + '<td class="is-num">' + ttft + ' ms</td><td class="is-num">' + p50 + ' ms</td><td class="is-num">' + p95 + ' ms</td>'
          + '<td class="is-num ' + driftCls + '">' + drift.toFixed(1) + '%</td>'
          + '<td class="is-num ' + availCls + '">' + avail.toFixed(2) + '%</td></tr>';
      });
      tableHtml = '<div class="lb-scroll"><table class="bench-table lt-table lb-table"><thead><tr>'
        + '<th scope="col">Model</th><th scope="col" class="is-num">TTFT</th><th scope="col" class="is-num">P50</th><th scope="col" class="is-num">P95</th><th scope="col" class="is-num">Drift</th><th scope="col" class="is-num">Uptime</th>'
        + '</tr></thead><tbody>' + rowsHtml + '</tbody></table></div>'
        + '<p class="lb-note">Illustrative figures drawn around a stable baseline per model. They refresh every 30 seconds and are not live measurements.</p>';
    }

    bodyEl.innerHTML = '<div class="lb-bar">' + provHtml
      + '<button type="button" class="lb-refresh" onclick="LIVEBENCH.refresh()"><span class="ic">' + (window.TL_ICON ? window.TL_ICON('clock') : '') + '</span>Refresh now</button></div>'
      + tableHtml;
  }

  function open() {
    var ov = document.getElementById('livebench-overlay');
    if (ov) ov.classList.add('open');
    _isOpen = true;
    _render();
    _interval = setInterval(_render, 30000);
  }

  function close() {
    var ov = document.getElementById('livebench-overlay');
    if (ov) ov.classList.remove('open');
    _isOpen = false;
    if (_interval) { clearInterval(_interval); _interval = null; }
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('livebench-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, refresh: _render };
})();

