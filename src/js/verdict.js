/* ══════════════════════════════════════════════════════════
   MODULE — VERDICT
   Session verdict banner — winner per dimension
   ══════════════════════════════════════════════════════════ */
window.VERDICT = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function render() {
    var banner = document.getElementById('verdict-banner');
    var grid = document.getElementById('vb-grid');
    var turnsEl = document.getElementById('vb-turns');
    if (!banner || !grid) return;

    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    if (!models || models.length < 2) { banner.classList.remove('visible'); return; }

    // Aggregate per model
    var agg = {};
    var totalTurns = 0;
    models.forEach(function(m) {
      var sess = STATE.getSession ? STATE.getSession(m.id) : null;
      var hist = sess ? (sess.turns || []) : [];
      var totCost = 0, totCo2 = 0, totWater = 0, totPower = 0, turns = 0, totTok = 0;
      hist.forEach(function(t) {
        totCost  += (t.cost        || 0);
        totCo2   += (t.co2         || 0);
        totWater += (t.water       || 0);
        totPower += (t.power       || 0);
        totTok   += (t.inputTokens || 0) + (t.outputTokens || 0);
        turns++;
      });
      if (turns > 0) {
        // tokPerDollar: total tokens divided by total cost; guard zero-cost (free/simulated)
        var tokPerDollar = totCost > 0 ? totTok / totCost : totTok * 1000;
        agg[m.id] = { id: m.id, name: m.name || m.id, cost: totCost, co2: totCo2, water: totWater, power: totPower, tokens: totTok, tokPerDollar: tokPerDollar, turns: turns };
        totalTurns = Math.max(totalTurns, turns);
      }
    });

    var ids = Object.keys(agg);
    if (ids.length < 2) { banner.classList.remove('visible'); return; }

    // Find winners (lowest = better for all metrics)
    function winner(metric) {
      var best = null, bestVal = Infinity;
      ids.forEach(function(id) { if (agg[id][metric] < bestVal) { bestVal = agg[id][metric]; best = id; } });
      return best;
    }

    var dims = [
      { key: 'cost',        label: 'Lowest cost',   better: 'low',  fmt: function(v){ return CALC.fmtCost(v); } },
      { key: 'co2',         label: 'Lowest CO₂',    better: 'low',  fmt: function(v){ return CALC.fmtCO2(v); } },
      { key: 'water',       label: 'Least water',   better: 'low',  fmt: function(v){ return CALC.fmtWater(v); } },
      { key: 'power',       label: 'Lowest power',  better: 'low',  fmt: function(v){ return CALC.fmtPower(v); } },
      { key: 'tokPerDollar',label: 'Tokens per $',  better: 'high', fmt: function(v){ return v >= 1e6 ? (v/1e6).toFixed(1)+'M' : v >= 1000 ? Math.round(v/1000)+'K' : Math.round(v)+''; } },
    ];

    var html = '';
    dims.forEach(function(d) {
      var wid, w;
      if (d.better === 'low') {
        wid = null; var bestVal = Infinity;
        ids.forEach(function(id){ if(agg[id][d.key] < bestVal){ bestVal = agg[id][d.key]; wid = id; } });
      } else {
        wid = null; var bestVal2 = -Infinity;
        ids.forEach(function(id){ if(agg[id][d.key] > bestVal2){ bestVal2 = agg[id][d.key]; wid = id; } });
      }
      if (!wid) return;
      w = agg[wid];
      html += '<div class="vb-card winner" data-model="'+esc(w.id)+'">'
        + '<div class="vb-dim">'+d.label+'</div>'
        + '<div class="vb-val" data-dim="'+d.key+'">'+d.fmt(w[d.key])+'</div>'
        + '<button type="button" class="vb-name js-model" data-hl="'+esc(w.id)+'" aria-pressed="false" title="Highlight '+esc(w.name)+' across the page">'+esc(w.name)+'</button>'
        + '</div>';
    });

    if (turnsEl) turnsEl.textContent = totalTurns;
    grid.innerHTML = html;
    banner.classList.add('visible');
  }

  function hide() {
    var banner = document.getElementById('verdict-banner');
    if (banner) banner.classList.remove('visible');
  }

  return { render: render, hide: hide };
})();

