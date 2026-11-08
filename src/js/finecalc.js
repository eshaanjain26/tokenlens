// ── Feature 3: Fine-Tune ROI Calculator ──────────
window.FINECALC = (function() {
  function open() {
    var ov = document.getElementById('finecalc-overlay');
    if (ov) ov.classList.add('open');
    var res = document.getElementById('fc-results');
    if (res && !res._wired) { res._wired = true; res.addEventListener('tl-seg', _render); }
    var saved = TLUI.store('fc_horizon');
    if (res && saved) res.dataset.h = saved;
    _render();
    TLUI.countUp(res);
  }
  function close() {
    var ov = document.getElementById('finecalc-overlay');
    if (ov) ov.classList.remove('open');
  }

  function _render() {
    function field(id, fallback, label) {
      var el = document.getElementById(id), err = document.getElementById(id + '-err');
      var v = parseFloat(el && el.value);
      var bad = !(v > 0);
      if (el) el.setAttribute('aria-invalid', bad ? 'true' : 'false');
      if (err) err.textContent = bad ? 'Enter a number above zero. Using ' + fallback.toLocaleString() + ' for now.' : '';
      return bad ? fallback : v;
    }
    var spend = field('fc-spend', 2000);
    var vol = field('fc-volume', 100000);
    field('fc-tokens', 500);
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

    var HZ = resEl.dataset.h === '12' ? 12 : 24;
    TLUI.store('fc_horizon', String(HZ));
    function money(v) { return '$' + Math.round(v).toLocaleString(); }
    var xs = [], i0;
    for (i0 = 1; i0 <= HZ; i0++) xs.push(i0);
    var beVisible = breakEven !== null && breakEven <= HZ;
    var summary = 'Fine-tune ROI: break-even ' + (breakEven ? 'month ' + breakEven : 'not reached') + ', ROI ' + roi12 + '% at 12 months, ' + roi24 + '% at 24 months. API spend ' + money(spend) + '/mo vs fine-tuned ' + money(trainCost) + ' training plus ' + money(hostCost) + '/mo hosting.';
    _summary = summary;

    resEl.innerHTML = TLUI.kpis([
        ['Break-even', breakEven ? 'Month ' + breakEven : 'Not reached', {sub: breakEven ? 'Fine-tuned total drops below API total' : 'API stays cheaper within 24 months'}],
        ['ROI at 12 months', roi12 + '%', {tone: roi12 > 0 ? 'pos' : 'neg'}],
        ['ROI at 24 months', roi24 + '%', {tone: roi24 > 0 ? 'pos' : 'neg'}]
      ])
      + '<div class="fc-chart-wrap"><div class="tl-block-head"><div><h3 class="tl-h">Cumulative cost</h3><p class="tl-sub">What you have paid in total by each month. Where the lines cross, fine-tuning pays off.</p></div>'
      + '<div class="tl-seg" role="group" aria-label="Horizon" data-for="fc-results" data-attr="h" data-persist="fc_horizon"><button type="button" data-v="12" aria-pressed="' + (HZ === 12) + '">12 months</button><button type="button" data-v="24" aria-pressed="' + (HZ === 24) + '">24 months</button></div></div>'
      + '<div id="fc-chart"></div></div>'
      + '<section class="tl-block"><div class="tl-block-head"><div><h3 class="tl-h">Assumptions</h3><p class="tl-sub">Training and hosting are estimates for the ' + t.label + ' tier.</p></div>'
      + '<button type="button" class="tl-btn secondary sm" onclick="FINECALC.copy()"><span class="ic" data-icon="copy"></span>Copy summary</button></div>'
      + '<dl class="tl-dl">'
      + '<div><dt>Training cost, one time</dt><dd>' + money(t.trainMin) + ' to ' + money(t.trainMax) + ' (average ' + money(trainCost) + ')</dd></div>'
      + '<div><dt>Hosting cost per month</dt><dd>' + money(t.hostMin) + ' to ' + money(t.hostMax) + ' (average ' + money(hostCost) + ')</dd></div>'
      + '<div><dt>API cost per month</dt><dd>' + money(spend) + ' (your input)</dd></div>'
      + '<div><dt>Model tier</dt><dd>' + t.label + '</dd></div></dl>'
      + '<p class="tl-hint" style="margin-top:8px">Training costs estimate GPU rental plus engineering time. Hosting covers inference infrastructure for open-source models such as Llama 3 and Mistral.</p></section>';
    if (window.TL_HYDRATE_ICONS) TL_HYDRATE_ICONS(resEl);
    TLUI.lineChart(document.getElementById('fc-chart'), {
      label: 'Cumulative cost of API versus fine-tuned model',
      xs: xs, xTicks: HZ === 12 ? [0, 2, 5, 8, 11] : [0, 5, 11, 17, 23],
      series: [
        { name: 'API', values: apiCum.slice(0, HZ), tone: 'ink' },
        { name: 'Fine-tuned', values: ftCum.slice(0, HZ), tone: 'data' }
      ],
      markers: beVisible ? [{ i: breakEven - 1, label: 'Break-even' }] : [],
      fmtX: function(i, long) { return (long ? 'Month ' : 'Mo. ') + (i + 1); },
      fmtY: function(v, long) { return long ? money(v) : (v >= 1000 ? '$' + (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k' : '$' + Math.round(v)); }
    });
  }
  var _summary = '';
  function copy() { if (_summary) TLUI.copy(_summary, 'Summary copied.'); }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('finecalc-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  return { open: open, close: close, render: _render, copy: copy };
})();

