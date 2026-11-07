// ── Enhancement 3: Cost Forecast ──────────────────
window.FORECAST = (function() {
  var _scenario = 'linear';

  function open() {
    var ov = document.getElementById('forecast-overlay');
    if (ov) ov.classList.add('open');
    _render();
  }
  function close() {
    var ov = document.getElementById('forecast-overlay');
    if (ov) ov.classList.remove('open');
  }
  function setScenario(s) {
    _scenario = s;
    document.querySelectorAll('.fc2-scenario-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.scenario === s); });
    _render();
  }

  function _render() {
    var el = document.getElementById('forecast-body');
    if (!el) return;
    var totals = STATE.globalTotals ? STATE.globalTotals() : { turns:0, cost:0, co2:0, water:0 };
    var turns = totals.turns || 0;
    var totalCost = totals.cost || 0;
    if (!turns) {
      el.innerHTML = '<p style="color:var(--text-2);font-size:12px">Run some prompts first — forecast requires at least one session turn.</p>';
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

    // SVG chart: 30 day projection
    var W=560, H=180, padL=50, padR=16, padT=16, padB=28;
    var points = [];
    for (var d=0; d<=30; d++) {
      var cumCost = totalCost + dailyRate * d;
      points.push(cumCost);
    }
    var maxY = Math.max.apply(null, points);
    function sx(d) { return padL + (d/30)*(W-padL-padR); }
    function sy(v) { return padT + (1 - v/maxY)*(H-padT-padB); }

    var path = points.map(function(v,i){ return (i===0?'M':'L')+sx(i).toFixed(1)+','+sy(v).toFixed(1); }).join(' ');
    // Shade area under curve
    var areaPath = path + ' L'+sx(30).toFixed(1)+','+(H-padB)+' L'+sx(0).toFixed(1)+','+(H-padB)+' Z';
    // Budget cap line
    var capY = sy(breakEvenBudget);
    var capLine = breakEvenBudget <= maxY
      ? '<line x1="'+padL+'" y1="'+capY.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+capY.toFixed(1)+'" stroke="#EF4444" stroke-width="1.5" stroke-dasharray="5,3"/><text x="'+(W-padR-2)+'" y="'+(capY-4)+'" text-anchor="end" font-size="9" fill="#EF4444">Budget cap $'+breakEvenBudget.toFixed(2)+'</text>'
      : '';
    var yLabels = [0,0.25,0.5,0.75,1].map(function(f){
      var v=maxY*f, y=sy(v);
      var lbl = v>=1?'$'+(v).toFixed(2):'$'+(v*100).toFixed(1)+'¢';
      if (v>=1) lbl='$'+v.toFixed(2);
      return '<text x="'+(padL-5)+'" y="'+(y+4)+'" text-anchor="end" font-size="9" fill="#888">'+lbl+'</text><line x1="'+padL+'" y1="'+y+'" x2="'+(W-padR)+'" y2="'+y+'" stroke="#eee" stroke-width="1"/>';
    }).join('');
    var xLabels = [0,7,14,21,30].map(function(d){
      return '<text x="'+sx(d).toFixed(1)+'" y="'+(H-padB+14)+'" text-anchor="middle" font-size="9" fill="#888">Day '+d+'</text>';
    }).join('');

    var chart = '<svg viewBox="0 0 '+W+' '+H+'" style="width:100%;height:auto;border-radius:8px;border:1px solid var(--border)">'
      + yLabels+xLabels+capLine
      + '<path d="'+areaPath+'" fill="rgba(10,107,60,0.07)"/>'
      + '<path d="'+path+'" fill="none" stroke="var(--tl)" stroke-width="2"/>'
      + '<circle cx="'+sx(0).toFixed(1)+'" cy="'+sy(points[0]).toFixed(1)+'" r="3" fill="var(--tl)"/>'
      + '<circle cx="'+sx(30).toFixed(1)+'" cy="'+sy(points[30]).toFixed(1)+'" r="4" fill="var(--tl)"/>'
      + '</svg>';

    var kpis = '<div class="fc2-kpis">'
      + '<div class="fc2-kpi"><div class="fc2-kpi-val">$'+projected7.toFixed(4)+'</div><div class="fc2-kpi-lbl">7-day projection</div></div>'
      + '<div class="fc2-kpi"><div class="fc2-kpi-val" style="color:'+( projected30 > breakEvenBudget ? '#EF4444':'var(--tl)')+'">$'+projected30.toFixed(4)+'</div><div class="fc2-kpi-lbl">30-day projection</div></div>'
      + '<div class="fc2-kpi"><div class="fc2-kpi-val" style="color:'+(daysToCapExhaust<7?'#EF4444':daysToCapExhaust<14?'#F59E0B':'var(--tl)')+'">'+( isFinite(daysToCapExhaust) ? daysToCapExhaust.toFixed(1)+' days' : '∞')+'</div><div class="fc2-kpi-lbl">Days until cap</div></div>'
      + '</div>';

    var scenarios = '<div class="fc2-scenario-row">'
      + ['linear','conservative','aggressive'].map(function(s){
          var labels = { linear:'📈 Linear', conservative:'📉 Conservative (−30%)', aggressive:'🚀 Aggressive (+80%)' };
          return '<button class="fc2-scenario-btn'+(s===_scenario?' active':'')+'" data-scenario="'+s+'" onclick="FORECAST.setScenario(\''+s+'\')">'+labels[s]+'</button>';
        }).join('')
      + '</div>';

    var note = '<p style="font-size:10px;color:var(--text-3);margin-top:8px">Based on '+turns+' turns at $'+costPerTurn.toFixed(5)+'/turn avg · '+_scenario+' growth model</p>';
    el.innerHTML = kpis + scenarios + chart + note;
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('forecast-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, setScenario:setScenario };
})();

