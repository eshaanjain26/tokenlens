/* ══════════════════════════════════════════════════════════
   MODULE — USAGE
   Usage & impact panel: limit bars, session stats, token/cost
   breakdown, caching impact, footprint, per-model ranking
   ══════════════════════════════════════════════════════════ */
window.USAGE = (function() {
  function esc(s) { return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  var _open   = false;
  var _scope  = 'all';
  var _metric = 'cost';

  var METRICS = {
    cost:   { label: 'Cost',   color: '#D97706' },
    tokens: { label: 'Tokens', color: '#2563EB' },
    co2:    { label: 'CO₂',    color: '#16A34A' },
    water:  { label: 'Water',  color: '#0891B2' },
    power:  { label: 'Power',  color: '#7C3AED' }
  };
  var COLORS = { fresh: '#2563EB', cached: '#16A34A', write: '#7C3AED', out: '#D97706' };

  function fmtTok(n) {
    n = n || 0;
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6)  return (n / 1000).toFixed(n < 10000 ? 2 : 1) + 'k';
    return (n / 1e6).toFixed(2) + 'M';
  }
  function pct(a, b) { return b > 0 ? (a / b) * 100 : 0; }
  function clampPct(p) { return Math.max(0, Math.min(100, p)); }
  function barCls(p) { return p >= 100 ? 'bad' : p >= 70 ? 'warn' : 'ok'; }

  // ── Aggregate session data for the chosen scope ──
  function gather(scope) {
    var a = { models: [], turns: 0, tin: 0, tout: 0, cached: 0, write: 0, fresh: 0,
              cost: 0, costNC: 0, co2: 0, co2NC: 0, water: 0, waterNC: 0, power: 0, powerNC: 0,
              parts: { fresh: 0, cached: 0, write: 0, out: 0 }, rows: [] };
    STATE.getActiveModels().forEach(function(m) {
      var s = STATE.getSession(m.id);
      if (!s || !s.turns.length) return;
      if (scope !== 'all' && scope !== m.id) return;
      a.models.push(m);
      a.rows.push({ m: m, s: s });
      a.turns = Math.max(a.turns, s.turns.length);
      s.turns.forEach(function(t) {
        var cd = CALC.costDetailed(m, t.inputTokens, t.outputTokens, t.cachedTokens || 0, t.cacheWriteTokens || 0);
        a.parts.fresh  += cd.freshCost;
        a.parts.cached += cd.cachedCost;
        a.parts.write  += cd.writeCost;
        a.parts.out    += cd.outCost;
      });
      a.tin    += s.totalIn;           a.tout   += s.totalOut;
      a.cached += s.totalCached || 0;  a.write  += s.totalCacheWrite || 0;
      a.cost   += s.totalCost;         a.costNC += (s.totalCostNoCache  || s.totalCost);
      a.co2    += s.totalCO2;          a.co2NC  += (s.totalCO2NoCache   || s.totalCO2);
      a.water  += s.totalWater;        a.waterNC+= (s.totalWaterNoCache || s.totalWater);
      a.power  += s.totalPower;        a.powerNC+= (s.totalPowerNoCache || s.totalPower);
    });
    a.fresh = Math.max(0, a.tin - a.cached - a.write);
    return a;
  }

  function metricValue(key, r) {
    var s = r.s;
    if (key === 'cost')   return s.totalCost;
    if (key === 'tokens') return s.totalIn + s.totalOut;
    if (key === 'co2')    return s.totalCO2;
    if (key === 'water')  return s.totalWater;
    return s.totalPower;
  }
  function fmtMetric(key, v) {
    if (key === 'cost')   return CALC.fmtCost(v);
    if (key === 'tokens') return fmtTok(v);
    if (key === 'co2')    return CALC.fmtCO2(v);
    if (key === 'water')  return CALC.fmtWater(v);
    return CALC.fmtPower(v);
  }

  // ── Small HTML builders ──
  function limitRow(label, rightTxt, p, cls, sub) {
    return '<div class="ux-limit">'
      + '<div class="ux-limit-top"><span>' + esc(label) + '</span><span class="ux-pct ' + cls + '">' + rightTxt + '</span></div>'
      + '<div class="ux-track"><div class="ux-fill ' + cls + '" style="width:' + clampPct(p).toFixed(1) + '%"></div></div>'
      + (sub ? '<div class="ux-sub">' + sub + '</div>' : '')
      + '</div>';
  }
  function stat(label, val, cls) {
    return '<div class="ux-stat"><div class="ux-stat-l">' + label + '</div><div class="ux-stat-v ' + (cls || '') + '">' + val + '</div></div>';
  }
  function bdRow(label, color, tokens, maxTokens, costTxt, note) {
    return '<div class="ux-bd-row">'
      + '<div class="ux-bd-name"><i style="background:' + color + '"></i>' + label + (note ? '<em>' + note + '</em>' : '') + '</div>'
      + '<div class="ux-bd-bar"><div style="width:' + clampPct(pct(tokens, maxTokens)).toFixed(1) + '%;background:' + color + '"></div></div>'
      + '<div class="ux-bd-val">' + fmtTok(tokens) + '</div>'
      + '<div class="ux-bd-cost">' + costTxt + '</div>'
      + '</div>';
  }
  function saveTile(icon, label, now, was, saved, fmt) {
    var p = was > 0 ? (saved / was) * 100 : 0;
    return '<div class="ux-tile">'
      + '<div class="ux-tile-l">' + icon + ' ' + label + '</div>'
      + '<div class="ux-tile-v">' + fmt(now) + '</div>'
      + '<div class="ux-tile-s">' + (saved > 1e-12 ? '<b>−' + p.toFixed(0) + '%</b> vs ' + fmt(was) : 'no cache effect') + '</div>'
      + '</div>';
  }

  // ── Main render ──
  function render() {
    var body = document.getElementById('usage-body');
    if (!body) return;
    var g   = STATE.globalTotals();
    var sim = !API.hasKey();
    var a   = gather(_scope);
    if (_scope !== 'all' && !a.models.length) { _scope = 'all'; a = gather('all'); }

    if (!g.turns) {
      body.innerHTML = '<div class="ux-empty"><div style="font-size:34px">📊</div>'
        + '<p><b>No usage yet.</b></p>'
        + '<p>Select models, then send a prompt. Simulate mode works without an API key and fills this panel with estimated tokens, cost, CO₂, water and power.</p></div>'
        + cacheControls(a, true);
      return;
    }

    // Limits
    var cap = BUDGET.getCap();
    var bp  = pct(g.cost, cap);
    var ctxPct = 0, ctxName = '';
    STATE.getActiveModels().forEach(function(m) {
      var s = STATE.getSession(m.id);
      if (!s || !s.turns.length) return;
      var p = pct(s.contextTokens, m.context_length);
      if (p >= ctxPct) { ctxPct = p; ctxName = m.name || m.id; }
    });
    var hit = pct(g.cached, g.tokensIn);
    var limits =
        limitRow('Session budget', Math.min(bp, 999).toFixed(bp < 10 ? 1 : 0) + '%', bp, barCls(bp),
                 CALC.fmtCost(g.cost) + ' of ' + CALC.fmtCost(cap) + (sim ? ' · simulated spend' : ''))
      + limitRow('Context window', ctxPct.toFixed(ctxPct < 10 ? 1 : 0) + '%', ctxPct, barCls(ctxPct),
                 'fullest: ' + esc(ctxName) + ' · history is re-sent every turn')
      + limitRow('Cache hit rate', CACHE.isEnabled() ? hit.toFixed(0) + '%' : 'off', CACHE.isEnabled() ? hit : 0, 'info',
                 fmtTok(g.cached) + ' of ' + fmtTok(g.tokensIn) + ' input tokens served from cache');

    // This session
    var saved = Math.max(0, g.costNoCache - g.cost);
    var stats = '<div class="ux-stats">'
      + stat('Cost', CALC.fmtCost(g.cost))
      + stat('Cache saved', saved > 1e-12 ? CALC.fmtCost(saved) : '—', saved > 1e-12 ? 'ok' : '')
      + stat('Turns', g.turns)
      + stat('Models', STATE.getActiveModels().filter(function(m){ var s=STATE.getSession(m.id); return s && s.turns.length; }).length)
      + stat('Tokens', fmtTok(g.tokensIn + g.tokensOut))
      + stat('Mode', sim ? 'Simulated' : 'Live API', sim ? 'warn' : 'ok')
      + '</div>';

    // Breakdown
    var scopeOpts = '<option value="all"' + (_scope === 'all' ? ' selected' : '') + '>All models</option>'
      + STATE.getActiveModels().filter(function(m){ var s=STATE.getSession(m.id); return s && s.turns.length; }).map(function(m) {
          return '<option value="' + esc(m.id) + '"' + (_scope === m.id ? ' selected' : '') + '>' + esc(m.name || m.id) + '</option>';
        }).join('');
    var maxTok = Math.max(a.fresh, a.cached, a.write, a.tout, 1);
    var p = a.parts;
    var breakdown =
        bdRow('Input (fresh)', COLORS.fresh, a.fresh,  maxTok, CALC.fmtCost(p.fresh))
      + bdRow('Cache read',    COLORS.cached, a.cached, maxTok, CALC.fmtCost(p.cached), CACHE.isEnabled() ? '' : 'off')
      + bdRow('Cache write',   COLORS.write,  a.write,  maxTok, CALC.fmtCost(p.write))
      + bdRow('Output',        COLORS.out,    a.tout,   maxTok, CALC.fmtCost(p.out));

    // Caching impact
    var sv = Math.max(0, a.costNC - a.cost);
    var impact = '<div class="ux-impact">'
      + '<div class="ux-cmp"><div class="ux-cmp-row"><span>Without caching</span><b>' + CALC.fmtCost(a.costNC) + '</b></div>'
      + '<div class="ux-track"><div class="ux-fill gray" style="width:100%"></div></div></div>'
      + '<div class="ux-cmp"><div class="ux-cmp-row"><span>With caching</span><b>' + CALC.fmtCost(a.cost) + '</b></div>'
      + '<div class="ux-track"><div class="ux-fill ok" style="width:' + clampPct(pct(a.cost, a.costNC || 1)).toFixed(1) + '%"></div></div></div>'
      + '<div class="ux-saved">' + (sv > 1e-12
          ? '💾 Saved <b>' + CALC.fmtCost(sv) + '</b> (' + pct(sv, a.costNC).toFixed(1) + '%) on ' + fmtTok(a.cached) + ' cached input tokens'
          : 'No cache savings on this selection yet. Savings start on turn 2, for models that support prompt caching.')
      + '</div></div>';

    // Footprint
    var foot = '<div class="ux-tiles">'
      + saveTile('🌱', 'CO₂',   a.co2,   a.co2NC,   a.co2NC - a.co2,     CALC.fmtCO2)
      + saveTile('💧', 'Water', a.water, a.waterNC, a.waterNC - a.water, CALC.fmtWater)
      + saveTile('⚡', 'Power', a.power, a.powerNC, a.powerNC - a.power, CALC.fmtPower)
      + '</div>'
      + '<div class="ux-equiv">≈ ' + (a.co2 / 404).toFixed(a.co2 / 404 < 0.01 ? 4 : 3) + ' km driven · '
      + (a.water * 1000 / 250).toFixed(2) + ' glasses of water · '
      + (a.power / 12).toFixed(3) + ' phone charges</div>';

    // Ranking
    var maxRow = 0;
    a.rows.forEach(function(r) { maxRow = Math.max(maxRow, metricValue(_metric, r)); });
    var ranked = a.rows.slice().sort(function(x, y) { return metricValue(_metric, y) - metricValue(_metric, x); }).slice(0, 8);
    var metricChips = Object.keys(METRICS).map(function(k) {
      return '<button class="ux-chip' + (k === _metric ? ' on' : '') + '" onclick="USAGE.setMetric(\'' + k + '\')">' + METRICS[k].label + '</button>';
    }).join('');
    var rank = '<div class="ux-chips">' + metricChips + '</div>'
      + ranked.map(function(r) {
          var v = metricValue(_metric, r);
          return '<div class="ux-rank"><span class="ux-rank-n" title="' + esc(r.m.id) + '">' + esc((r.m.name || r.m.id).slice(0, 26)) + '</span>'
            + '<div class="ux-rank-bar"><div style="width:' + clampPct(pct(v, maxRow)).toFixed(1) + '%;background:' + METRICS[_metric].color + '"></div></div>'
            + '<span class="ux-rank-v">' + fmtMetric(_metric, v) + '</span></div>';
        }).join('');

    body.innerHTML =
        '<div class="ux-sec">' + limits + '</div>'
      + '<div class="ux-sec"><div class="ux-h">This session</div>' + stats + '</div>'
      + '<div class="ux-sec"><div class="ux-h">Breakdown<select class="ux-sel" onchange="USAGE.setScope(this.value)" aria-label="Scope">' + scopeOpts + '</select></div>'
      +   '<div class="ux-bd-head"><span></span><span></span><span>Tokens</span><span>Cost</span></div>' + breakdown + '</div>'
      + '<div class="ux-sec"><div class="ux-h">Caching impact</div>' + impact + cacheControls(a, false) + '</div>'
      + '<div class="ux-sec"><div class="ux-h">Footprint</div>' + foot + '</div>'
      + '<div class="ux-sec"><div class="ux-h">What&#39;s driving your usage</div>' + rank + '</div>'
      + '<div class="ux-tip"><b>Tip</b><span>' + tip(g, ctxPct, saved) + '</span></div>'
      + '<div class="ux-actions"><button class="ux-btn" onclick="USAGE.copy()">Copy summary</button>'
      + '<button class="ux-btn" onclick="USAGE.toAnalytics()">Open Analytics</button></div>';
  }

  function cacheControls(a, empty) {
    var on = CACHE.isEnabled();
    var first = (a.models && a.models[0]) || STATE.getActiveModels()[0];
    var t = first ? CALC.cacheTerms(first) : null;
    var termTxt = t ? (t.supported
        ? 'Cache read ' + t.read.toFixed(2) + '× input price · write ' + t.write.toFixed(2) + '× (' + t.source + ')'
        : esc(first.name || first.id) + ' has no prompt caching, so no savings apply.')
      : 'Pick a model to see its cache pricing.';
    return '<div class="ux-cache">'
      + '<label class="ux-switch"><input type="checkbox" ' + (on ? 'checked' : '') + ' onchange="USAGE.setCache(this.checked)"><span></span>'
      + '<b>Prompt caching</b></label>'
      + '<div class="ux-hit"><span>Assumed hit rate</span>'
      + '<input type="range" min="0" max="100" step="5" value="' + CACHE.getHitRate() + '" ' + (on ? '' : 'disabled ') + 'oninput="USAGE.setHit(this.value)" onchange="USAGE.refresh()" aria-label="Cache hit rate">'
      + '<b id="ux-hit-v">' + CACHE.getHitRate() + '%</b></div>'
      + '<div class="ux-sub">' + termTxt + '<br>Changes apply to new turns. Past turns keep their numbers. Energy for a cached token is assumed at '
      + Math.round(CALC.CACHE_ENERGY_FACTOR * 100) + '% of a fresh one.</div>'
      + '</div>';
  }

  function tip(g, ctxPct, saved) {
    if (ctxPct >= 60) return 'Context is ' + ctxPct.toFixed(0) + '% full. Every turn re-sends the whole history, so start a new thread or compress.';
    if (!CACHE.isEnabled() && g.turns >= 2) return 'Prompt caching is off. Turn it on to bill repeated context at the cache-read rate on turns 2+.';
    if (saved > 1e-12) return 'Caching has cut cost by ' + pct(saved, g.costNoCache).toFixed(0) + '% so far. Long, stable system prompts and documents cache best.';
    return 'Longer conversations cost more per turn because input grows. Try Compress on your prompt or switch to a mini model for simple tasks.';
  }

  // ── Sidebar + header live widgets ──
  function updateWidgets() {
    var g = STATE.globalTotals();
    var tok = document.getElementById('sess-tokens');
    var sav = document.getElementById('sess-saved');
    var pill = document.getElementById('usage-pill-txt');
    if (tok) tok.textContent = fmtTok(g.tokensIn + g.tokensOut);
    var saved = Math.max(0, g.costNoCache - g.cost);
    if (sav) sav.textContent = saved > 1e-12 ? CALC.fmtCost(saved) : '—';
    if (pill) {
      var hit = pct(g.cached, g.tokensIn);
      pill.textContent = g.turns ? CALC.fmtCost(g.cost) + (g.cached ? ' · ' + hit.toFixed(0) + '% cached' : '') : 'Usage';
    }
  }

  function refresh() { updateWidgets(); if (_open) render(); }

  function open() {
    var ov = document.getElementById('usage-overlay');
    if (!ov) return;
    ov.classList.add('open');
    _open = true;
    render();
  }
  function close() {
    var ov = document.getElementById('usage-overlay');
    if (ov) ov.classList.remove('open');
    _open = false;
  }
  function setScope(v)  { _scope = v; render(); }
  function setMetric(k) { _metric = k; render(); }
  function setCache(on) { CACHE.setEnabled(on); TOAST.info('Prompt caching ' + (on ? 'on' : 'off') + ' for new turns.'); }
  function setHit(v) {
    CACHE.setHitRate(v, true); // silent: don't re-render mid-drag
    var el = document.getElementById('ux-hit-v');
    if (el) el.textContent = CACHE.getHitRate() + '%';
  }

  function summaryText() {
    var g = STATE.globalTotals();
    var saved = Math.max(0, g.costNoCache - g.cost);
    return 'TokenLens usage summary\n'
      + 'Mode: ' + (API.hasKey() ? 'Live API' : 'Simulated') + '\n'
      + 'Turns: ' + g.turns + '\n'
      + 'Tokens: ' + g.tokensIn.toLocaleString() + ' in (' + g.cached.toLocaleString() + ' cached), ' + g.tokensOut.toLocaleString() + ' out\n'
      + 'Cost: ' + CALC.fmtCost(g.cost) + ' (without caching ' + CALC.fmtCost(g.costNoCache) + ', saved ' + CALC.fmtCost(saved) + ')\n'
      + 'Footprint: ' + CALC.fmtCO2(g.co2) + ' | Water: ' + CALC.fmtWater(g.water) + ' | Power: ' + CALC.fmtPower(g.power) + '\n'
      + 'Estimates only. Method: Luccioni et al. 2023, Li et al. 2023.';
  }
  function copy() {
    var txt = summaryText();
    try {
      navigator.clipboard.writeText(txt).then(function() { TOAST.success('Usage summary copied.'); },
                                              function() { TOAST.info(txt); });
    } catch(e) { TOAST.info(txt); }
  }
  function toAnalytics() {
    close();
    var b = document.querySelector('.tab-btn[data-tab="analytics"]');
    if (b) b.click();
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _open) close();
  });

  return { open: open, close: close, refresh: refresh, render: render, setScope: setScope, setMetric: setMetric,
           setCache: setCache, setHit: setHit, copy: copy, toAnalytics: toAnalytics, summaryText: summaryText };
})();

