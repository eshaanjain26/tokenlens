// ── Enhancement 3: Cost Forecast ──────────────────
window.FORECAST = (function() {
  var _scenario = 'linear';

  function open() {
    var ov = document.getElementById('forecast-overlay');
    if (ov) ov.classList.add('open');
    _render();
    TLUI.countUp(document.getElementById('forecast-body'));
  }
  function close() {
    var ov = document.getElementById('forecast-overlay');
    if (ov) ov.classList.remove('open');
  }
  function setScenario(s) {
    _scenario = s;
    _render();
    var b = document.querySelector('.fc2-scenario-btn[data-scenario="' + s + '"]');
    if (b) b.focus();
  }

  function _render() {
    var el = document.getElementById('forecast-body');
    if (!el) return;
    var totals = STATE.globalTotals ? STATE.globalTotals() : { turns:0, cost:0, co2:0, water:0 };
    var turns = totals.turns || 0;
    var totalCost = totals.cost || 0;
    if (!turns) {
      el.innerHTML = TLUI.empty('Run a prompt first. The forecast needs at least one session turn to read your pace.');
      return;
    }
    var costPerTurn = totalCost / turns;
    // Assume ~20 turns/day usage pace
    var pacePerDay = Math.max(turns, 1);
    // Project over 30 days
    var days = 30;
    var multipliers = { linear:1, conservative:0.7, aggressive:1.8 };
    var mult = multipliers[_scenario] || 1;
    var dailyRate = costPerTurn * pacePerDay * mult;

    var projected30 = dailyRate * days;
    var projected7 = dailyRate * 7;
    var breakEvenBudget = BUDGET.getCap ? BUDGET.getCap() : 1;
    var daysToCapExhaust = breakEvenBudget / dailyRate;

    var cs = getComputedStyle(el);
    var W = Math.max(280, Math.floor(el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)) || 560), H = 240, padL = 64, padR = 16, padT = 12, padB = 30;
    var points = [];
    for (var d=0; d<=30; d++) points.push(totalCost + dailyRate * d);
    var maxY = Math.max.apply(null, points);
    function sx(d) { return padL + (d/30)*(W-padL-padR); }
    function sy(v) { return padT + (1 - v/maxY)*(H-padT-padB); }
    var capY = sy(breakEvenBudget);
    var capLine = breakEvenBudget <= maxY
      ? '<line x1="'+padL+'" y1="'+capY.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+capY.toFixed(1)+'" class="ch-cap"/><text x="'+(W-padR-2)+'" y="'+(capY-6)+'" text-anchor="end" class="an-cap-label">Budget cap $'+breakEvenBudget.toFixed(2)+'</text>'
      : '';
    var yLabels = [0,0.25,0.5,0.75,1].map(function(f){
      var v=maxY*f, y=sy(v);
      var lbl = v>=1?'$'+v.toFixed(2):'$'+(v*100).toFixed(1)+'\u00a2';
      return '<text x="'+(padL-8)+'" y="'+(y+4)+'" text-anchor="end" class="ch-tick">'+lbl+'</text><line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" class="ch-grid"/>';
    }).join('');
    var xLabels = [0,7,14,21,30].map(function(d){
      return '<text x="'+sx(d).toFixed(1)+'" y="'+(H-padB+20)+'" text-anchor="middle" class="ch-tick">Day '+d+'</text>';
    }).join('');
    var path = points.map(function(v,i){ return (i===0?'M':'L')+sx(i).toFixed(1)+','+sy(v).toFixed(1); }).join(' ');
    var chart = '<div class="an-chart" id="fc2-chart"><svg width="'+W+'" height="'+H+'" role="img" aria-label="Projected cumulative cost over 30 days">'
      + yLabels + xLabels + capLine
      + '<path d="'+path+'" class="ch-line" style="--sc:var(--data)"/>'
      + '<circle cx="'+sx(0).toFixed(1)+'" cy="'+sy(points[0]).toFixed(1)+'" r="3" class="ch-pt" style="--sc:var(--data)"/>'
      + '<circle cx="'+sx(30).toFixed(1)+'" cy="'+sy(points[30]).toFixed(1)+'" r="4" class="ch-pt" style="--sc:var(--data)"/>'
      + '</svg></div>';

    var kpis = TLUI.kpis([
      ['7-day projection', '$' + projected7.toFixed(4), {money: true}],
      ['30-day projection', '$' + projected30.toFixed(4), {money: true, tone: projected30 > breakEvenBudget ? 'neg' : ''}],
      ['Days until cap', isFinite(daysToCapExhaust) ? daysToCapExhaust.toFixed(1) + ' days' : 'No limit', {tone: daysToCapExhaust < 7 ? 'neg' : ''}]
    ]);

    var labels = { linear:'Linear', conservative:'Conservative (-30%)', aggressive:'Aggressive (+80%)' };
    var scenarios = '<div class="tl-seg" role="group" aria-label="Growth scenario">'
      + ['linear','conservative','aggressive'].map(function(s){
          return '<button type="button" class="fc2-scenario-btn" data-scenario="'+s+'" aria-pressed="'+(s===_scenario)+'" onclick="FORECAST.setScenario(\''+s+'\')">'+labels[s]+'</button>';
        }).join('') + '</div>';

    _summary = 'Cost forecast (' + _scenario + '): 7-day $' + projected7.toFixed(4) + ', 30-day $' + projected30.toFixed(4)
      + ', cap $' + breakEvenBudget.toFixed(2) + (isFinite(daysToCapExhaust) ? ', reached in ' + daysToCapExhaust.toFixed(1) + ' days' : '');

    el.innerHTML = kpis
      + '<div class="tl-toolbar">' + scenarios + '<button type="button" class="tl-btn secondary sm" onclick="FORECAST.copy()"><span class="ic" data-icon="copy"></span>Copy</button></div>'
      + chart
      + '<p class="tl-hint" style="margin-top:12px">Based on ' + turns + ' turns at $' + costPerTurn.toFixed(5) + ' per turn on average, with the ' + _scenario + ' growth model.</p>';
    if (window.TL_HYDRATE_ICONS) TL_HYDRATE_ICONS(el);
    CHARTS.scrub(document.getElementById('fc2-chart'), {
      n: 31, xs: points.map(function(v, i){ return sx(i); }), top: padT, bottom: H - padB,
      label: 'Projected cost chart. Use the left and right arrow keys to read each day.',
      dots: function(i){ return [{ x: sx(i), y: sy(points[i]), color: 'var(--data)' }]; },
      html: function(i){
        return '<div class="chart-tip-h">Day '+i+'</div><div class="chart-tip-r"><span>Cumulative</span><span class="chart-tip-v">$'+points[i].toFixed(4)+'</span></div>'
          + (points[i] > breakEvenBudget ? '<div class="chart-tip-r"><span class="chart-tip-d up">Over the $'+breakEvenBudget.toFixed(2)+' cap</span></div>' : '');
      }
    });
  }
  var _summary = '';
  function copy() { if (_summary) TLUI.copy(_summary, 'Forecast copied.'); }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('forecast-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, setScenario:setScenario, copy:copy };
})();

