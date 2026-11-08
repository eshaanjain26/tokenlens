/* ══════════════════════════════════════════════════════════
   MODULE — FINDER
   Smart Model Finder — scores all models by priority weights
   ══════════════════════════════════════════════════════════ */
window.FINDER = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _providerFilter = null;

  var SLIDERS = ['cost', 'eco', 'speed', 'ctx'];
  var _last = [];

  function _restore() {
    try {
      var saved = JSON.parse(TLUI.store('finder') || 'null');
      if (!saved) return;
      SLIDERS.forEach(function(k) {
        var el = document.getElementById('fs-' + k), v = document.getElementById('fs-' + k + '-val');
        if (el && typeof saved[k] === 'number') { el.value = saved[k]; if (v) v.textContent = saved[k]; }
      });
    } catch (e) {}
  }
  function _persist() {
    var o = {};
    SLIDERS.forEach(function(k) { o[k] = parseInt(document.getElementById('fs-' + k).value, 10); });
    TLUI.store('finder', JSON.stringify(o));
  }

  function open() {
    document.getElementById('finder-overlay').classList.add('open');
    _restore();
    run();
  }
  function close() {
    document.getElementById('finder-overlay').classList.remove('open');
  }
  function chipAll() {
    _providerFilter = null;
    _markChip('fchip-all');
    run();
  }
  function chipProvider(prov) {
    _providerFilter = prov;
    _markChip('fchip-' + prov);
    run();
  }
  function _markChip(id) {
    document.querySelectorAll('.finder-chip').forEach(function(c){ c.classList.remove('on'); c.setAttribute('aria-pressed', 'false'); });
    var el = document.getElementById(id);
    if (el) { el.classList.add('on'); el.setAttribute('aria-pressed', 'true'); }
  }
  function _chipId(prov) { return prov === 'mistralai' ? 'fchip-mistral' : 'fchip-' + prov; }

  function _norm(val, min, max) {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
  }

  function run() {
    var allModels = STATE.getModels ? STATE.getModels() : [];
    if (!allModels || !allModels.length) {
      document.getElementById('finder-results').innerHTML = TLUI.empty('No models loaded yet. Pricing loads when the app connects.');
      return;
    }

    var wCost  = parseInt(document.getElementById('fs-cost').value)  / 100;
    var wEco   = parseInt(document.getElementById('fs-eco').value)   / 100;
    var wSpeed = parseInt(document.getElementById('fs-speed').value) / 100;
    var wCtx   = parseInt(document.getElementById('fs-ctx').value)   / 100;

    var candidates = allModels.filter(function(m) {
      if (!_providerFilter) return true;
      return (m.id || '').toLowerCase().indexOf(_providerFilter) === 0;
    }).slice(0, 300); // cap at 300 for perf

    if (!candidates.length) {
      document.getElementById('finder-results').innerHTML = TLUI.empty('No models match this provider filter.');
      return;
    }

    // Extract raw values
    var rows = candidates.map(function(m) {
      var priceIn  = parseFloat(m.pricing && m.pricing.prompt     || 0) * 1e6;
      var priceOut = parseFloat(m.pricing && m.pricing.completion || 0) * 1e6;
      var avgPrice = (priceIn + priceOut) / 2 || 0;
      var ctx      = parseInt(m.context_length || m.contextLength || 0);
      var pwr      = DATA.getPowerRate ? DATA.getPowerRate(m.id) : 0.002;
      var prov     = (m.id || '').split('/')[0] || '_default';
      var provData = { openai:{co2:250}, anthropic:{co2:180}, google:{co2:90}, meta:{co2:210}, mistralai:{co2:220}, _default:{co2:300} };
      var co2rate  = (provData[prov] || provData._default).co2;
      var eco      = pwr * co2rate; // relative carbon footprint score
      // speed: use tokens/sec if available, else infer from model name
      var speed = m.top_provider && m.top_provider.max_completion_tokens_per_second
        ? m.top_provider.max_completion_tokens_per_second
        : (m.id.indexOf('flash') > -1 || m.id.indexOf('mini') > -1 || m.id.indexOf('haiku') > -1) ? 100
        : (m.id.indexOf('turbo') > -1) ? 80
        : 50;
      return { m: m, price: avgPrice, eco: eco, speed: speed, ctx: ctx };
    });

    // Min/max for normalisation
    var prices = rows.map(function(r){ return r.price; });
    var ecos   = rows.map(function(r){ return r.eco; });
    var speeds = rows.map(function(r){ return r.speed; });
    var ctxs   = rows.map(function(r){ return r.ctx; });
    var minP = Math.min.apply(null,prices), maxP = Math.max.apply(null,prices);
    var minE = Math.min.apply(null,ecos),   maxE = Math.max.apply(null,ecos);
    var minS = Math.min.apply(null,speeds), maxS = Math.max.apply(null,speeds);
    var minC = Math.min.apply(null,ctxs),   maxC = Math.max.apply(null,ctxs);

    rows.forEach(function(r) {
      // Lower price = better → invert
      var sCost  = 1 - _norm(r.price, minP, maxP);
      // Lower eco (carbon) = better → invert
      var sEco   = 1 - _norm(r.eco,   minE, maxE);
      // Higher speed = better
      var sSpeed = _norm(r.speed, minS, maxS);
      // Higher ctx = better
      var sCtx   = _norm(r.ctx,   minC, maxC);
      r.score = (wCost*sCost + wEco*sEco + wSpeed*sSpeed + wCtx*sCtx) / (wCost+wEco+wSpeed+wCtx || 1);
    });

    rows.sort(function(a, b){ return b.score - a.score; });
    var top = rows.slice(0, 8);

    _persist();
    var maxScore = top[0] ? Math.max(top[0].score, 1e-9) : 1;
    var rowsData = top.map(function(r, ri) {
      var pIn  = parseFloat(r.m.pricing && r.m.pricing.prompt     || 0) * 1e6;
      var pOut = parseFloat(r.m.pricing && r.m.pricing.completion || 0) * 1e6;
      var ctx  = r.m.context_length || 0;
      var pct  = Math.round(r.score * 100);
      var tags = [];
      if (pIn < 0.5) tags.push(TLUI.pill('Budget'));
      if (r.eco < 0.01) tags.push(TLUI.pill('Low carbon'));
      if (r.speed >= 80) tags.push(TLUI.pill('Fast'));
      if (ctx >= 100000) tags.push(TLUI.pill('Long context'));
      var on = STATE.isActive(r.m.id);
      return {
        cls: ri === 0 ? 'best' : '',
        sort: [ri + 1, r.m.name || r.m.id, pIn, ctx, pct],
        cells: [
          '<span class="mute">' + (ri + 1) + '</span>',
          '<div class="wrap-cell"><div class="tl-name hl">' + esc(r.m.name || r.m.id) + '</div><div class="finder-tags">' + tags.join('') + '</div></div>',
          pIn ? '$' + pIn.toFixed(2) + ' <span class="mute">in</span><br>$' + pOut.toFixed(2) + ' <span class="mute">out</span>' : '<span class="mute">Free or unknown</span>',
          ctx ? Math.round(ctx / 1000) + 'K' : '<span class="mute">n/a</span>',
          '<span class="hl">' + pct + '</span>',
          '<button type="button" class="tl-btn secondary sm finder-add" data-id="' + esc(r.m.id) + '" onclick="FINDER.add(this)"' + (on ? ' aria-pressed="true"' : '') + '>' + (on ? 'Added' : 'Add') + '</button>'
        ]
      };
    });
    _last = top.map(function(r, i) { return (i + 1) + '. ' + (r.m.name || r.m.id) + ' (' + Math.round(r.score * 100) + ')'; });
    document.getElementById('finder-results').innerHTML =
      '<div class="tl-block-head"><div><h3 class="tl-h">Top matches</h3><p class="tl-sub">' + candidates.length + ' models scored. Prices are USD per million tokens.</p></div></div>'
      + TLUI.ledger({
          label: 'Top matching models', cols: '24px minmax(0,1fr) 110px 64px 56px 72px', colsSm: '20px minmax(0,1fr) 48px 64px', min: 0,
          head: [{label: '#'}, {label: 'Model', sort: true}, {label: 'Price', num: true, sort: true, cls: 'hide-sm'}, {label: 'Context', num: true, sort: true, cls: 'hide-sm'}, {label: 'Score', num: true, sort: true}, {label: ''}],
          rows: rowsData
        });
  }

  function add(btn) {
    var id = btn.dataset.id;
    if (!STATE.isActive(id)) APP.toggleModel(id);
    var on = STATE.isActive(id);
    btn.textContent = on ? 'Added' : 'Add';
    if (on) btn.setAttribute('aria-pressed', 'true'); else btn.removeAttribute('aria-pressed');
  }
  function copy() {
    if (!_last.length) { TOAST.warning('Nothing to copy yet.'); return; }
    TLUI.copy('Model finder ranking\n' + _last.join('\n'), 'Ranking copied.');
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('finder-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, run: run, chipAll: chipAll, chipProvider: chipProvider, add: add, copy: copy };
})();

