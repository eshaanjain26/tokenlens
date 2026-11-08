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
    cost:   { label: 'Cost' },
    tokens: { label: 'Tokens' },
    co2:    { label: 'CO\u2082' },
    water:  { label: 'Water' },
    power:  { label: 'Power' }
  };

  function fmtTok(n) {
    n = n || 0;
    if (n < 1000) return String(Math.round(n));
    if (n < 1e6)  return (n / 1000).toFixed(n < 10000 ? 2 : 1) + 'k';
    return (n / 1e6).toFixed(2) + 'M';
  }
  function pct(a, b) { return b > 0 ? (a / b) * 100 : 0; }
  function clampPct(p) { return Math.max(0, Math.min(100, p)); }
  function barCls(p) { return p >= 100 ? 'bad' : p >= 70 ? 'warn' : ''; }

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
  function limitRow(label, rightTxt, p, tone, sub) {
    return '<div class="ux-limit">'
      + '<div class="ux-limit-top"><span>' + esc(label) + '</span><span class="ux-pct">' + rightTxt + '</span></div>'
      + TLUI.meter(clampPct(p), tone)
      + (sub ? '<div class="tl-hint">' + sub + '</div>' : '')
      + '</div>';
  }
  function saveKpi(label, now, was, saved, fmt) {
    var p = was > 0 ? (saved / was) * 100 : 0;
    return [label, fmt(now), { sub: saved > 1e-12 ? '<b>' + p.toFixed(0) + '% lower</b> than ' + fmt(was) + ' without caching' : 'No cache effect' }];
  }

  // ── Main render ──
  function render() {
    var body = document.getElementById('usage-body');
    if (!body) return;
    var ae = document.activeElement, fk = ae && ae.dataset ? ae.dataset.fk : null;
    var g   = STATE.globalTotals();
    var sim = !API.hasKey();
    var a   = gather(_scope);
    if (_scope !== 'all' && !a.models.length) { _scope = 'all'; a = gather('all'); }

    var lede = '<p class="tl-lede">Spend, tokens, caching and footprint for this session, updated after every prompt.' + (sim ? ' ' + TLUI.pill('Simulated spend') : '') + '</p>';

    if (!g.turns) {
      body.innerHTML = lede + TLUI.empty('<b>No usage yet.</b><br>Select models and send a prompt. Simulate mode works without an API key and fills this panel with estimated tokens, cost, CO₂, water and power.')
        + TLUI.block('Prompt caching', null, cacheControls(a, true));
      _restoreFocus(body, fk);
      return;
    }

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
                 CALC.fmtCost(g.cost) + ' of ' + CALC.fmtCost(cap) + (sim ? ' (simulated spend)' : ''))
      + limitRow('Context window', ctxPct.toFixed(ctxPct < 10 ? 1 : 0) + '%', ctxPct, barCls(ctxPct),
                 'Fullest: ' + esc(ctxName) + '. History is re-sent every turn.')
      + limitRow('Cache hit rate', CACHE.isEnabled() ? hit.toFixed(0) + '%' : 'Off', CACHE.isEnabled() ? hit : 0, 'data',
                 fmtTok(g.cached) + ' of ' + fmtTok(g.tokensIn) + ' input tokens served from cache');

    var saved = Math.max(0, g.costNoCache - g.cost);
    var active = STATE.getActiveModels().filter(function(m){ var s=STATE.getSession(m.id); return s && s.turns.length; }).length;
    var stats = TLUI.kpis([
        ['Cost', CALC.fmtCost(g.cost), { money: true }],
        ['Cache saved', saved > 1e-12 ? CALC.fmtCost(saved) : '—', { money: true, tone: saved > 1e-12 ? 'pos' : '' }],
        ['Tokens', fmtTok(g.tokensIn + g.tokensOut)]
      ])
      + '<dl class="tl-dl" style="margin-top:12px"><div><dt>Turns</dt><dd>' + g.turns + '</dd></div><div><dt>Models</dt><dd>' + active + '</dd></div>'
      + '<div><dt>Mode</dt><dd>' + (sim ? 'Simulated' : 'Live API') + '</dd></div></dl>';

    var scopeOpts = '<option value="all"' + (_scope === 'all' ? ' selected' : '') + '>All models</option>'
      + STATE.getActiveModels().filter(function(m){ var s=STATE.getSession(m.id); return s && s.turns.length; }).map(function(m) {
          return '<option value="' + esc(m.id) + '"' + (_scope === m.id ? ' selected' : '') + '>' + esc(m.name || m.id) + '</option>';
        }).join('');
    var p = a.parts;
    var maxTok = Math.max(a.fresh, a.cached, a.write, a.tout, 1);
    function bdRow(label, tokens, costTxt, note) {
      return { w: pct(tokens, maxTok) / 100, cells: [esc(label) + (note ? ' ' + TLUI.pill(note) : ''), fmtTok(tokens), costTxt] };
    }
    var breakdown = TLUI.ledger({
      label: 'Token and cost breakdown', cols: 'minmax(0,1fr) 84px 104px', min: 0,
      head: [{ label: 'Part' }, { label: 'Tokens', num: true }, { label: 'Cost', num: true }],
      rows: [
        bdRow('Input (fresh)', a.fresh, CALC.fmtCost(p.fresh)),
        bdRow('Cache read', a.cached, CALC.fmtCost(p.cached), CACHE.isEnabled() ? '' : 'Off'),
        bdRow('Cache write', a.write, CALC.fmtCost(p.write)),
        bdRow('Output', a.tout, CALC.fmtCost(p.out))
      ]
    });

    var sv = Math.max(0, a.costNC - a.cost);
    var impact = '<div class="ux-impact">'
      + '<div><div class="ux-limit-top"><span>Without caching</span><span class="ux-pct">' + CALC.fmtCost(a.costNC) + '</span></div>' + TLUI.meter(100, 'grey') + '</div>'
      + '<div><div class="ux-limit-top"><span>With caching</span><span class="ux-pct">' + CALC.fmtCost(a.cost) + '</span></div>' + TLUI.meter(clampPct(pct(a.cost, a.costNC || 1)), 'data') + '</div>'
      + '<p class="tl-note ' + (sv > 1e-12 ? 'pos' : '') + '">' + (sv > 1e-12
          ? 'Saved <b>' + CALC.fmtCost(sv) + '</b> (' + pct(sv, a.costNC).toFixed(1) + '%) on ' + fmtTok(a.cached) + ' cached input tokens.'
          : 'No cache savings on this selection yet. Savings start on turn 2, for models that support prompt caching.')
      + '</p></div>';

    var foot = TLUI.kpis([
        saveKpi('CO₂', a.co2, a.co2NC, a.co2NC - a.co2, CALC.fmtCO2),
        saveKpi('Water', a.water, a.waterNC, a.waterNC - a.water, CALC.fmtWater),
        saveKpi('Power', a.power, a.powerNC, a.powerNC - a.power, CALC.fmtPower)
      ])
      + '<p class="tl-hint" style="margin-top:12px">About ' + (a.co2 / 404).toFixed(a.co2 / 404 < 0.01 ? 4 : 3) + ' km driven, '
      + (a.water * 1000 / 250).toFixed(2) + ' glasses of water, ' + (a.power / 12).toFixed(3) + ' phone charges.</p>';

    var maxRow = 0;
    a.rows.forEach(function(r) { maxRow = Math.max(maxRow, metricValue(_metric, r)); });
    var ranked = a.rows.slice().sort(function(x, y) { return metricValue(_metric, y) - metricValue(_metric, x); }).slice(0, 8);
    var metricChips = '<div class="tl-seg" role="group" aria-label="Rank by">' + Object.keys(METRICS).map(function(k) {
      return '<button type="button" data-fk="metric-' + k + '" aria-pressed="' + (k === _metric) + '" onclick="USAGE.setMetric(\'' + k + '\')">' + METRICS[k].label + '</button>';
    }).join('') + '</div>';
    var rank = TLUI.ledger({
      label: 'Models ranked by ' + METRICS[_metric].label, cols: 'minmax(0,1fr) 110px', min: 0,
      head: [{ label: 'Model' }, { label: METRICS[_metric].label, num: true }],
      rows: ranked.map(function(r, i) {
        var v = metricValue(_metric, r);
        return { w: pct(v, maxRow) / 100, cls: i === 0 ? 'best' : '', cells: ['<span class="tl-name hl" title="' + esc(r.m.id) + '">' + esc(r.m.name || r.m.id) + '</span>', fmtMetric(_metric, v)] };
      })
    });

    body.innerHTML = lede
      + TLUI.block('Limits', 'How close this session is to its budget, context and cache ceilings.', limits)
      + TLUI.block('This session', null, stats)
      + TLUI.block('Breakdown', 'Where tokens and cost went.', breakdown, '<select class="tl-select ux-sel" data-fk="scope" onchange="USAGE.setScope(this.value)" aria-label="Scope">' + scopeOpts + '</select>')
      + TLUI.block('Caching impact', null, impact + cacheControls(a, false))
      + TLUI.block('Footprint', 'Estimated impact, with the saving from caching.', foot)
      + TLUI.block('What is driving your usage', 'Top models by the metric you pick.', rank, metricChips)
      + '<section class="tl-block"><p class="tl-note"><b>Tip.</b> ' + tip(g, ctxPct, saved) + '</p></section>'
      + '<div class="tl-actions" style="margin-top:24px"><button type="button" class="tl-btn secondary" onclick="USAGE.copy()"><span class="ic" data-icon="copy"></span>Copy summary</button>'
      + '<button type="button" class="tl-btn secondary" onclick="USAGE.toAnalytics()">Open Analytics</button></div>';
    if (window.TL_HYDRATE_ICONS) TL_HYDRATE_ICONS(body);
    _restoreFocus(body, fk);
    if (_fresh) { _fresh = false; TLUI.countUp(body); }
  }
  var _fresh = false;
  function _restoreFocus(body, fk) {
    if (!fk) return;
    var el = body.querySelector('[data-fk="' + fk + '"]');
    if (el) el.focus({ preventScroll: true });
  }

  function cacheControls(a, empty) {
    var on = CACHE.isEnabled();
    var first = (a.models && a.models[0]) || STATE.getActiveModels()[0];
    var t = first ? CALC.cacheTerms(first) : null;
    var termTxt = t ? (t.supported
        ? 'Cache read costs ' + t.read.toFixed(2) + 'x the input price and a write ' + t.write.toFixed(2) + 'x (' + t.source + ').'
        : esc(first.name || first.id) + ' has no prompt caching, so no savings apply.')
      : 'Pick a model to see its cache pricing.';
    return '<div class="ux-cache">'
      + '<label class="tl-toggle"><input type="checkbox" class="tl-switch" data-fk="cache" ' + (on ? 'checked' : '') + ' onchange="USAGE.setCache(this.checked)"><b>Prompt caching</b></label>'
      + '<div class="ux-hit"><label class="tl-label" for="ux-hit-range">Assumed hit rate</label>'
      + '<input class="tl-range" id="ux-hit-range" data-fk="hit" type="range" min="0" max="100" step="5" value="' + CACHE.getHitRate() + '" ' + (on ? '' : 'disabled ') + 'oninput="USAGE.setHit(this.value)" onchange="USAGE.refresh()">'
      + '<b id="ux-hit-v">' + CACHE.getHitRate() + '%</b></div>'
      + '<p class="tl-hint">' + termTxt + ' Changes apply to new turns; past turns keep their numbers. Energy for a cached token is assumed at '
      + Math.round(CALC.CACHE_ENERGY_FACTOR * 100) + '% of a fresh one.</p>'
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
    _fresh = true;
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

