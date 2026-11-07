/* ══════════════════════════════════════════════════════════
   MODULE — FINDER
   Smart Model Finder — scores all models by priority weights
   ══════════════════════════════════════════════════════════ */
window.FINDER = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _providerFilter = null;

  function open() {
    document.getElementById('finder-overlay').classList.add('open');
    run();
  }
  function close() {
    document.getElementById('finder-overlay').classList.remove('open');
  }
  function chipAll() {
    _providerFilter = null;
    document.querySelectorAll('.finder-chip').forEach(function(c){ c.classList.remove('on'); });
    document.getElementById('fchip-all').classList.add('on');
    run();
  }
  function chipProvider(prov) {
    _providerFilter = prov;
    document.querySelectorAll('.finder-chip').forEach(function(c){ c.classList.remove('on'); });
    var el = document.getElementById('fchip-'+prov);
    if (el) el.classList.add('on');
    run();
  }

  function _norm(val, min, max) {
    if (max === min) return 0.5;
    return Math.max(0, Math.min(1, (val - min) / (max - min)));
  }

  function run() {
    var allModels = STATE.getModels ? STATE.getModels() : [];
    if (!allModels || !allModels.length) {
      document.getElementById('finder-results').innerHTML = '<p style="color:var(--text-3);font-size:13px">No models loaded yet.</p>';
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
      document.getElementById('finder-results').innerHTML = '<p style="color:var(--text-3);font-size:13px">No models match this filter.</p>';
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

    var html = '<div style="font-size:11px;font-weight:700;color:var(--text-3);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:10px">'
      + 'Top Matches ('+candidates.length+' models scored)</div>';

    top.forEach(function(r, ri) {
      var pIn  = parseFloat(r.m.pricing && r.m.pricing.prompt     || 0) * 1e6;
      var pOut = parseFloat(r.m.pricing && r.m.pricing.completion || 0) * 1e6;
      var ctx  = r.m.context_length || 0;
      var pct  = Math.round(r.score * 100);
      var barColor = ri === 0 ? '#0A6B3C' : ri === 1 ? '#0072A3' : ri === 2 ? '#B85C00' : '#8AA89A';
      var medal = ri === 0 ? '🥇' : ri === 1 ? '🥈' : ri === 2 ? '🥉' : (ri+1)+'.';
      html += '<div class="finder-result'+(ri===0?' gold':'')+'">'
        + '<div class="finder-rank">'+medal+'</div>'
        + '<div class="finder-info">'
        +   '<div style="font-size:13px;font-weight:800;color:var(--text)">'+esc(r.m.name||r.m.id)+'</div>'
        +   '<div style="font-size:11px;color:var(--text-2);margin-top:2px">'
        +     (pIn?'$'+pIn.toFixed(2)+'/Mtok in · $'+pOut.toFixed(2)+'/Mtok out':'Free/Unknown')
        +     (ctx?' · '+Math.round(ctx/1000)+'K ctx':'')
        +   '</div>'
        +   '<div class="finder-pills">'
        +     (pIn < 0.5 ? '<span class="finder-pill" style="background:#E3F9EE;color:#0A7A48">💰 Budget</span>' : '')
        +     (r.eco < 0.01 ? '<span class="finder-pill" style="background:#E3F9EE;color:#0A7A48">🌱 Eco</span>' : '')
        +     (r.speed >= 80 ? '<span class="finder-pill" style="background:#E3F3FB;color:#0072A3">⚡ Fast</span>' : '')
        +     (ctx >= 100000 ? '<span class="finder-pill" style="background:#FFF3E8;color:#B85C00">📄 Long ctx</span>' : '')
        +   '</div>'
        + '</div>'
        + '<div class="finder-score">'
        +   '<div class="finder-score-val">'+pct+'</div>'
        +   '<div style="font-size:9px;color:var(--text-3)">score</div>'
        +   '<div class="finder-score-bar"><div class="finder-score-fill" style="width:'+pct+'%;background:'+barColor+'"></div></div>'
        + '</div>'
        + '</div>';
    });

    document.getElementById('finder-results').innerHTML = html;
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('finder-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, run: run, chipAll: chipAll, chipProvider: chipProvider };
})();

