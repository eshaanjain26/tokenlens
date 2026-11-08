// ── Feature 4: ESG Reporting ─────────────────────
window.ESG = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function open() {
    var ov = document.getElementById('esg-overlay');
    if (ov) ov.classList.add('open');
    _render();
    TLUI.countUp(document.getElementById('esg-body'));
  }
  function close() {
    var ov = document.getElementById('esg-overlay');
    if (ov) ov.classList.remove('open');
  }

  function _render() {
    var bodyEl = document.getElementById('esg-body');
    if (!bodyEl) return;
    var totals = STATE.globalTotals ? STATE.globalTotals() : { turns:0, cost:0, co2:0, water:0, power:0 };
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    var now = new Date().toISOString().slice(0,10);

    var kpiHtml = '<p class="esg-meta">Generated ' + now + ' by TokenLens. Figures are estimates.</p>'
      + TLUI.block('Executive summary', 'Totals across every active model this session.', TLUI.kpis([
          ['API turns', String(totals.turns || 0)],
          ['CO₂ emitted', esc(CALC.fmtCO2 ? CALC.fmtCO2(totals.co2) : (totals.co2||0).toFixed(2)+'g')],
          ['Water used', esc(CALC.fmtWater ? CALC.fmtWater(totals.water) : (totals.water||0).toFixed(2)+'L')],
          ['Energy', esc(CALC.fmtPower ? CALC.fmtPower(totals.power) : (totals.power||0).toFixed(4)+'kWh')]
        ]));

    var data = models.map(function(m) {
      var sess = STATE.getSession ? STATE.getSession(m.id) : null;
      var turns = sess && sess.turns ? sess.turns : [];
      var mCo2=0, mWater=0, mPower=0, mCost=0;
      turns.forEach(function(t){ mCo2+=t.co2||0; mWater+=t.water||0; mPower+=t.power||0; mCost+=t.cost||0; });
      return { m: m, n: turns.length, co2: mCo2, water: mWater, power: mPower, cost: mCost };
    });
    var maxCo2 = Math.max.apply(null, data.map(function(d){ return d.co2; }).concat([1e-12]));
    var rows = data.map(function(d) {
      var name = d.m.name || d.m.id;
      return {
        w: d.co2 / maxCo2,
        sort: [name, d.n, d.co2, d.water, d.power, d.cost],
        cells: [
          '<span class="tl-name">' + esc(name) + '</span>', String(d.n),
          esc(CALC.fmtCO2 ? CALC.fmtCO2(d.co2) : d.co2.toFixed(3)+'g'),
          esc(CALC.fmtWater ? CALC.fmtWater(d.water) : d.water.toFixed(4)+'L'),
          esc(CALC.fmtPower ? CALC.fmtPower(d.power) : d.power.toFixed(5)+'kWh'),
          esc(CALC.fmtCost ? CALC.fmtCost(d.cost) : '$'+d.cost.toFixed(4))
        ]
      };
    });
    var tableHtml = TLUI.block('Per-model breakdown', 'The grey bar shows each model’s share of the highest CO₂ total.',
      rows.length ? TLUI.ledger({
        label: 'Per-model footprint', cols: 'minmax(0,1.4fr) 56px minmax(0,1fr) minmax(0,1fr) minmax(0,1fr) minmax(0,1fr)', min: 640,
        head: [{label:'Model', sort:true}, {label:'Turns', num:true, sort:true}, {label:'CO₂', num:true, sort:true}, {label:'Water', num:true, sort:true}, {label:'Energy', num:true, sort:true}, {label:'Cost', num:true, sort:true}],
        rows: rows
      }) : TLUI.empty('No session data yet. Select models and send a prompt to populate this report.'));

    var methHtml = TLUI.block('Methodology', null,
      '<p class="esg-text">CO₂ is based on <b>Luccioni et al. (2023)</b> energy-per-token estimates multiplied by regional grid carbon intensity (global average 436 gCO₂/kWh). '
      + 'Water use comes from <b>Li et al. (2023)</b> on-site water consumption ratios for data centers. '
      + 'Power figures use model-size-based draw estimates (0.001 to 0.01 kWh per 1M tokens). '
      + 'All figures are estimates; real values vary by provider infrastructure and location.</p>');

    var fwHtml = TLUI.block('Compliance frameworks', null,
      '<div class="esg-fw">' + ['GHG Protocol Scope 3', 'CDP Climate Disclosure', 'GRI 305 Emissions', 'ISO 14064-1', 'TCFD'].map(function(f){ return TLUI.pill(f); }).join('') + '</div>'
      + '<p class="esg-text">AI API usage falls under <b>GHG Protocol Scope 3, Category 1</b> (purchased goods and services) or Category 11 (use of sold products). Include it in your annual CDP submission under IT and data infrastructure.</p>');

    bodyEl.innerHTML = kpiHtml + tableHtml + methHtml + fwHtml;
  }

  function downloadJSON() {
    var totals = STATE.globalTotals ? STATE.globalTotals() : {};
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    var perModel = models.map(function(m) {
      var sess = STATE.getSession ? STATE.getSession(m.id) : null;
      var turns = sess && sess.turns ? sess.turns : [];
      var mCo2=0, mWater=0, mPower=0, mCost=0;
      turns.forEach(function(t){ mCo2+=t.co2||0; mWater+=t.water||0; mPower+=t.power||0; mCost+=t.cost||0; });
      return { model: m.id, name: m.name, turns: turns.length, co2_g: mCo2, water_L: mWater, power_kWh: mPower, cost_USD: mCost };
    });
    var report = {
      generated: new Date().toISOString(),
      platform: 'TokenLens',
      session_summary: totals,
      per_model: perModel,
      methodology: 'Luccioni et al. 2023 (energy), Li et al. 2023 (water), GHG Protocol Scope 3',
      frameworks: ['GHG Protocol Scope 3', 'CDP', 'GRI 305', 'ISO 14064-1', 'TCFD']
    };
    var blob = JSON.stringify(report, null, 2);
    var uri = 'data:application/json;charset=utf-8,' + encodeURIComponent(blob);
    var a = document.createElement('a');
    a.href = uri; a.download = 'tokenlens-esg-report.json'; a.click();
    if (window.TOAST) TOAST.success('Saved tokenlens-esg-report.json.');
  }

  function printReport() {
    var wasDark = document.body.classList.contains('dark');
    document.body.classList.add('printing-report');
    document.body.classList.remove('dark');
    function _cleanup() {
      document.body.classList.remove('printing-report');
      if (wasDark) document.body.classList.add('dark');
      window.removeEventListener('afterprint', _cleanup);
    }
    window.addEventListener('afterprint', _cleanup);
    window.print();
    // Fallback cleanup in case afterprint doesn't fire (older WebKit).
    setTimeout(_cleanup, 2000);
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('esg-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, downloadJSON: downloadJSON, printReport: printReport };
})();

