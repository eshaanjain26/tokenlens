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

    var points = [], xs = [];
    for (var d=0; d<=30; d++) { points.push(totalCost + dailyRate * d); xs.push(d); }
    var maxY = Math.max.apply(null, points);

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
      + '<div id="forecast-chart"></div>'
      + '<p class="tl-hint" style="margin-top:12px">Based on ' + turns + ' turns at $' + costPerTurn.toFixed(5) + ' per turn on average, with the ' + _scenario + ' growth model.</p>';
    if (window.TL_HYDRATE_ICONS) TL_HYDRATE_ICONS(el);
    TLUI.lineChart(document.getElementById('forecast-chart'), {
      label: 'Projected cumulative cost over 30 days',
      xs: xs, xTicks: [0, 7, 14, 21, 30],
      series: [{ name: 'Projected', values: points, tone: 'ink' }],
      refs: breakEvenBudget <= maxY ? [{ value: breakEvenBudget, label: 'Budget cap $' + breakEvenBudget.toFixed(2), tone: 'neg' }] : [],
      fmtX: function(i, long) { return 'Day ' + i; },
      fmtY: function(v) { return v >= 1 ? '$' + v.toFixed(2) : '$' + v.toFixed(4); }
    });
  }
  var _summary = '';
  function copy() { if (_summary) TLUI.copy(_summary, 'Forecast copied.'); }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('forecast-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, setScenario:setScenario, copy:copy };
})();

