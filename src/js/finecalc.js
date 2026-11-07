// ── Feature 3: Fine-Tune ROI Calculator ──────────
window.FINECALC = (function() {
  function open() {
    var ov = document.getElementById('finecalc-overlay');
    if (ov) ov.classList.add('open');
    _render();
  }
  function close() {
    var ov = document.getElementById('finecalc-overlay');
    if (ov) ov.classList.remove('open');
  }

  function _render() {
    var spend = parseFloat((document.getElementById('fc-spend')||{}).value) || 2000;
    var vol = parseFloat((document.getElementById('fc-volume')||{}).value) || 100000;
    var tier = (document.getElementById('fc-tier')||{}).value || 'gpt4';

    var tierData = {
      gpt4:   { trainMin:6000, trainMax:8000, hostMin:300, hostMax:400, label:'GPT-4 class' },
      claude: { trainMin:4000, trainMax:7000, hostMin:250, hostMax:380, label:'Claude class' },
      gemini: { trainMin:2000, trainMax:5000, hostMin:150, hostMax:280, label:'Gemini class' }
    };
    var t = tierData[tier] || tierData['gpt4'];
    var trainCost = (t.trainMin + t.trainMax) / 2;
    var hostCost = (t.hostMin + t.hostMax) / 2;

    // monthly fine-tuned total cost
    var ftMonthly = hostCost;
    // API monthly cost: already given as `spend`
    // cumulative: API goes up linearly, FT starts with trainCost then adds hosting
    var breakEven = null;
    var apiCum = [], ftCum = [];
    for (var m = 1; m <= 24; m++) {
      var api = spend * m;
      var ft = trainCost + hostCost * m;
      apiCum.push(api);
      ftCum.push(ft);
      if (breakEven === null && ft <= api) breakEven = m;
    }

    var roi12 = apiCum[11] > 0 ? Math.round(((apiCum[11] - ftCum[11]) / ftCum[11]) * 100) : 0;
    var roi24 = apiCum[23] > 0 ? Math.round(((apiCum[23] - ftCum[23]) / ftCum[23]) * 100) : 0;

    var resEl = document.getElementById('fc-results');
    if (!resEl) return;

    // KPIs
    var kpiHtml = '<div class="fc-kpis">'
      + '<div class="fc-kpi"><div class="fc-kpi-val">' + (breakEven ? 'Mo. ' + breakEven : 'N/A') + '</div><div class="fc-kpi-lbl">Break-even</div></div>'
      + '<div class="fc-kpi"><div class="fc-kpi-val" style="color:' + (roi12>0?'var(--tl)':'#C82020') + '">' + roi12 + '%</div><div class="fc-kpi-lbl">ROI at 12 months</div></div>'
      + '<div class="fc-kpi"><div class="fc-kpi-val" style="color:' + (roi24>0?'var(--tl)':'#C82020') + '">' + roi24 + '%</div><div class="fc-kpi-lbl">ROI at 24 months</div></div>'
      + '</div>';

    // SVG chart
    var W = 580, H = 200, padL = 55, padB = 30, padT = 16, padR = 16;
    var maxY = Math.max.apply(null, apiCum.concat(ftCum));
    function sx(i) { return padL + (i / 23) * (W - padL - padR); }
    function sy(v) { return padT + (1 - v/maxY) * (H - padT - padB); }

    var apiPath = apiCum.map(function(v,i){ return (i===0?'M':'L') + sx(i).toFixed(1) + ',' + sy(v).toFixed(1); }).join(' ');
    var ftPath = ftCum.map(function(v,i){ return (i===0?'M':'L') + sx(i).toFixed(1) + ',' + sy(v).toFixed(1); }).join(' ');

    // y-axis labels
    var yLabels = [0, 0.25, 0.5, 0.75, 1].map(function(f) {
      var v = maxY * f;
      var label = v >= 1000 ? '$' + (v/1000).toFixed(0) + 'k' : '$' + v.toFixed(0);
      var y = sy(v);
      return '<text x="' + (padL-6) + '" y="' + (y+4) + '" text-anchor="end" font-size="9" fill="#888">' + label + '</text>'
           + '<line x1="' + padL + '" y1="' + y + '" x2="' + (W-padR) + '" y2="' + y + '" stroke="#eee" stroke-width="1"/>';
    }).join('');

    var xLabels = [1,6,12,18,24].map(function(m) {
      return '<text x="' + sx(m-1).toFixed(1) + '" y="' + (H-padB+14) + '" text-anchor="middle" font-size="9" fill="#888">Mo.' + m + '</text>';
    }).join('');

    var beVLine = breakEven ? '<line x1="' + sx(breakEven-1).toFixed(1) + '" y1="' + padT + '" x2="' + sx(breakEven-1).toFixed(1) + '" y2="' + (H-padB) + '" stroke="#0A6B3C" stroke-width="1.5" stroke-dasharray="4,3"/><text x="' + (sx(breakEven-1)+3).toFixed(1) + '" y="' + (padT+10) + '" font-size="9" fill="#0A6B3C">Break-even</text>' : '';

    var chartHtml = '<div id="fc-chart"><svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg" style="width:100%;height:auto">'
      + yLabels + xLabels + beVLine
      + '<path d="' + apiPath + '" fill="none" stroke="#C82020" stroke-width="2"/>'
      + '<path d="' + ftPath + '" fill="none" stroke="#0A6B3C" stroke-width="2" stroke-dasharray="6,3"/>'
      + '<circle cx="' + sx(11).toFixed(1) + '" cy="' + sy(apiCum[11]).toFixed(1) + '" r="4" fill="#C82020"/>'
      + '<circle cx="' + sx(11).toFixed(1) + '" cy="' + sy(ftCum[11]).toFixed(1) + '" r="4" fill="#0A6B3C"/>'
      + '<text x="' + (W-padR-2) + '" y="' + (sy(apiCum[23])-5) + '" text-anchor="end" font-size="9" fill="#C82020">API cost</text>'
      + '<text x="' + (W-padR-2) + '" y="' + (sy(ftCum[23])-5) + '" text-anchor="end" font-size="9" fill="#0A6B3C">Fine-tuned cost</text>'
      + '</svg></div>';

    var assumHtml = '<div class="fc-assumptions"><table>'
      + '<tr><td>Training cost (one-time)</td><td>$' + t.trainMin.toLocaleString() + '–$' + t.trainMax.toLocaleString() + ' (avg $' + trainCost.toLocaleString() + ')</td></tr>'
      + '<tr><td>Hosting cost/month</td><td>$' + t.hostMin + '–$' + t.hostMax + '/mo (avg $' + hostCost + ')</td></tr>'
      + '<tr><td>API cost/month</td><td>$' + spend.toLocaleString() + ' (your input)</td></tr>'
      + '<tr><td>Model tier</td><td>' + t.label + '</td></tr>'
      + '</table><p style="margin-top:6px;font-size:10px">* Training costs are estimates based on GPU rental + engineering time. Hosting includes inference infrastructure for open-source models (e.g. Llama-3, Mistral).</p></div>';

    resEl.innerHTML = kpiHtml + chartHtml + assumHtml;
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('finecalc-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, render: _render };
})();

