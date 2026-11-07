// ── Feature 4: ESG Reporting ─────────────────────
window.ESG = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  function open() {
    var ov = document.getElementById('esg-overlay');
    if (ov) ov.classList.add('open');
    _render();
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

    var kpiHtml = '<div class="esg-section"><h3>📊 Executive Summary</h3>'
      + '<div class="esg-kpi-row">'
      + '<div class="esg-kpi"><div class="esg-kpi-val">' + (totals.turns||0) + '</div><div class="esg-kpi-lbl">API Turns</div></div>'
      + '<div class="esg-kpi"><div class="esg-kpi-val">' + esc(CALC.fmtCO2 ? CALC.fmtCO2(totals.co2) : (totals.co2||0).toFixed(2)+'g') + '</div><div class="esg-kpi-lbl">CO₂ Emitted</div></div>'
      + '<div class="esg-kpi"><div class="esg-kpi-val">' + esc(CALC.fmtWater ? CALC.fmtWater(totals.water) : (totals.water||0).toFixed(2)+'L') + '</div><div class="esg-kpi-lbl">Water Used</div></div>'
      + '<div class="esg-kpi"><div class="esg-kpi-val">' + esc(CALC.fmtPower ? CALC.fmtPower(totals.power) : (totals.power||0).toFixed(4)+'kWh') + '</div><div class="esg-kpi-lbl">Energy</div></div>'
      + '</div></div>';

    var rows = models.map(function(m) {
      var sess = STATE.getSession ? STATE.getSession(m.id) : null;
      var turns = sess && sess.turns ? sess.turns : [];
      var mCo2=0, mWater=0, mPower=0, mCost=0;
      turns.forEach(function(t){ mCo2+=t.co2||0; mWater+=t.water||0; mPower+=t.power||0; mCost+=t.cost||0; });
      return '<tr>'
        + '<td>' + esc(m.name||m.id) + '</td>'
        + '<td>' + turns.length + '</td>'
        + '<td>' + esc(CALC.fmtCO2 ? CALC.fmtCO2(mCo2) : mCo2.toFixed(3)+'g') + '</td>'
        + '<td>' + esc(CALC.fmtWater ? CALC.fmtWater(mWater) : mWater.toFixed(4)+'L') + '</td>'
        + '<td>' + esc(CALC.fmtPower ? CALC.fmtPower(mPower) : mPower.toFixed(5)+'kWh') + '</td>'
        + '<td>' + esc(CALC.fmtCost ? CALC.fmtCost(mCost) : '$'+mCost.toFixed(4)) + '</td>'
        + '</tr>';
    }).join('');

    var tableHtml = '<div class="esg-section"><h3>🤖 Per-Model Breakdown</h3>'
      + '<table class="esg-table"><thead><tr><th>Model</th><th>Turns</th><th>CO₂</th><th>Water</th><th>Energy</th><th>Cost</th></tr></thead>'
      + '<tbody>' + (rows || '<tr><td colspan="6" style="color:var(--text-3)">No session data yet</td></tr>') + '</tbody></table></div>';

    var methHtml = '<div class="esg-section"><h3>📖 Methodology</h3>'
      + '<div class="esg-methodology">CO₂ calculations based on <strong>Luccioni et al. (2023)</strong> energy-per-token estimates × regional grid carbon intensity (global avg 436 gCO₂/kWh). '
      + 'Water usage derived from <strong>Li et al. (2023)</strong> on-site water consumption ratios for data centers. '
      + 'Power figures use model-size-based power draw estimates (0.001–0.01 kWh/1M tokens). '
      + 'All figures are estimates; actual values vary by provider infrastructure and location.</div></div>';

    var fwHtml = '<div class="esg-section"><h3>✅ Compliance Frameworks</h3>'
      + '<div class="esg-framework">'
      + '<span class="esg-fw-chip">GHG Protocol — Scope 3</span>'
      + '<span class="esg-fw-chip">CDP Climate Disclosure</span>'
      + '<span class="esg-fw-chip">GRI 305 — Emissions</span>'
      + '<span class="esg-fw-chip">ISO 14064-1</span>'
      + '<span class="esg-fw-chip">TCFD</span>'
      + '</div>'
      + '<p style="font-size:11px;color:var(--text-2);margin-top:8px">AI API usage falls under <strong>GHG Protocol Scope 3, Category 1</strong> (Purchased Goods &amp; Services) or Category 11 (Use of Sold Products). Include in your annual CDP submission under IT &amp; Data Infrastructure.</p></div>';

    var exportHtml = '<div class="esg-export-row">'
      + '<button class="esg-export-btn" onclick="ESG.downloadJSON()">📄 Download JSON</button>'
      + '<button class="esg-export-btn" onclick="ESG.printReport()">🖨️ Print Report</button>'
      + '</div>';

    bodyEl.innerHTML = kpiHtml + tableHtml + methHtml + fwHtml + exportHtml;
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
  }

  function printReport() {
    document.body.classList.add('printing-report');
    function _cleanup() {
      document.body.classList.remove('printing-report');
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

