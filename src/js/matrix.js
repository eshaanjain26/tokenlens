/* ══════════════════════════════════════════════════════════
   MODULE — MATRIX
   Turn-by-turn comparison table view
   ══════════════════════════════════════════════════════════ */
window.MATRIX = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  var _currentView = 'cols';
  var _sort = { key: 'turn', dir: 'asc' };
  var METRICS = [
    { id: 'tok',  label: 'Tokens' },
    { id: 'cost', label: 'Cost' },
    { id: 'co2',  label: 'CO₂' }
  ];

  function switchView(v) {
    _currentView = v;
    var cols = document.getElementById('vt-cols');
    var mx = document.getElementById('vt-matrix');
    cols.classList.toggle('active', v === 'cols');
    mx.classList.toggle('active', v === 'matrix');
    cols.setAttribute('aria-pressed', v === 'cols' ? 'true' : 'false');
    mx.setAttribute('aria-pressed', v === 'matrix' ? 'true' : 'false');
    document.getElementById('columns-area').style.display = v === 'cols' ? '' : 'none';
    var ma = document.getElementById('matrix-area');
    if (v === 'matrix') { ma.classList.add('visible'); render(); }
    else { ma.classList.remove('visible'); }
    try { localStorage.setItem('tl_ui_compare_view', v); } catch (e) {}
  }

  function emptyHtml(msg, withAction) {
    return '<div class="mx-empty"><p>' + msg + '</p>'
      + (withAction ? '<button type="button" class="empty-action" onclick="UI_COMPARE.pickPopular()">Pick 3 popular models</button>' : '')
      + '</div>';
  }

  function cellValue(turn, metric) {
    if (!turn) return null;
    if (metric === 'tok')  return (turn.inputTokens || 0) + (turn.outputTokens || 0);
    if (metric === 'cost') return turn.cost || 0;
    return turn.co2 || 0;
  }

  function sort(key) {
    var prev = key;
    if (key === 'turn') {
      _sort = { key: 'turn', dir: _sort.key === 'turn' && _sort.dir === 'asc' ? 'desc' : 'asc' };
    } else if (_sort.key === key) {
      _sort = _sort.dir === 'asc' ? { key: key, dir: 'desc' } : { key: 'turn', dir: 'asc' };
    } else {
      _sort = { key: key, dir: 'asc' };
    }
    render();
    var ma = document.getElementById('matrix-area');
    var btn = ma && (ma.querySelector('.mx-sort[data-sortkey="' + prev + '"]') || ma.querySelector('.mx-sort[data-sortkey="turn"]'));
    if (btn) btn.focus();
  }

  function caret(active, dir) {
    var name = active && dir === 'asc' ? 'chevronUp' : 'chevronDown';
    return '<span class="mx-caret' + (active ? ' on' : '') + '">' + TL_ICON(name) + '</span>';
  }

  function render() {
    var ma = document.getElementById('matrix-area');
    if (!ma) return;
    var models = STATE.getActiveModels();
    if (!models || !models.length) { ma.innerHTML = emptyHtml('Select models from the sidebar to see the matrix.', true); return; }
    var maxTurns = STATE.maxTurns();
    if (!maxTurns) { ma.innerHTML = emptyHtml('Send a prompt to fill the matrix.'); return; }

    var rows = [];
    for (var i = 1; i <= maxTurns; i++) {
      rows.push({ n: i, cells: models.map(function(m) {
        var sess = STATE.getSession(m.id);
        return sess && sess.turns && sess.turns[i - 1] || null;
      }) });
    }

    var sortLabel = 'turn number';
    if (_sort.key !== 'turn') {
      var sp = _sort.key.split('|'), mi = parseInt(sp[1], 10), mt = sp[0];
      if (models[mi]) {
        rows.sort(function(a, b) {
          var av = cellValue(a.cells[mi], mt), bv = cellValue(b.cells[mi], mt);
          if (av === null && bv === null) return a.n - b.n;
          if (av === null) return 1;
          if (bv === null) return -1;
          return (_sort.dir === 'asc' ? av - bv : bv - av) || a.n - b.n;
        });
        sortLabel = METRICS.filter(function(x){ return x.id === mt; })[0].label + ' for ' + (models[mi].name || models[mi].id);
      } else {
        _sort = { key: 'turn', dir: 'asc' };
      }
    } else if (_sort.dir === 'desc') {
      rows.reverse();
    }

    function best(vals) {
      var live = vals.filter(function(v){ return v !== null; });
      if (live.length < 2) return null;
      var lo = Math.min.apply(null, live);
      return lo === Math.max.apply(null, live) ? null : lo;
    }
    function ariaSort(key) {
      return _sort.key === key ? (_sort.dir === 'asc' ? 'ascending' : 'descending') : 'none';
    }

    var html = '<table class="mx-table"><thead><tr>'
      + '<th rowspan="2" scope="col" class="mx-turn" aria-sort="' + ariaSort('turn') + '">'
      + '<button type="button" class="mx-sort" data-sortkey="turn" onclick="MATRIX.sort(\'turn\')">Turn' + caret(_sort.key === 'turn', _sort.dir) + '</button></th>';
    models.forEach(function(m) {
      var short = (m.name || m.id).split('/').pop();
      html += '<th colspan="3" scope="colgroup" class="mx-model" data-model="' + esc(m.id) + '">'
        + '<button type="button" class="js-model" data-hl="' + esc(m.id) + '" aria-pressed="false" title="Highlight ' + esc(short) + ' across the page">' + esc(short) + '</button></th>';
    });
    html += '</tr><tr>';
    models.forEach(function(m, mi) {
      METRICS.forEach(function(mt) {
        var key = mt.id + '|' + mi;
        html += '<th scope="col" class="mx-metric" data-model="' + esc(m.id) + '" aria-sort="' + ariaSort(key) + '">'
          + '<button type="button" class="mx-sort" data-sortkey="' + key + '" onclick="MATRIX.sort(\'' + key + '\')" title="Sort turns by ' + mt.label + ' for ' + esc(m.name || m.id) + '">'
          + mt.label + caret(_sort.key === key, _sort.dir) + '</button></th>';
      });
    });
    html += '</tr></thead><tbody>';

    var totals = models.map(function() { return { in: 0, out: 0, cost: 0, co2: 0, sim: false }; });
    rows.forEach(function(row) {
      var bestTok  = best(row.cells.map(function(t){ return cellValue(t, 'tok'); }));
      var bestCost = best(row.cells.map(function(t){ return cellValue(t, 'cost'); }));
      var bestCo2  = best(row.cells.map(function(t){ return cellValue(t, 'co2'); }));
      var maxCost  = Math.max.apply(null, row.cells.map(function(t){ return cellValue(t, 'cost') || 0; }));
      html += '<tr><th scope="row" class="mx-turn">Turn ' + row.n + '</th>';
      models.forEach(function(m, mi) {
        var turn = row.cells[mi];
        var mid = esc(m.id);
        if (!turn) { html += '<td colspan="3" class="mx-none" data-model="' + mid + '">No turn</td>'; return; }
        totals[mi].in += turn.inputTokens || 0; totals[mi].out += turn.outputTokens || 0;
        totals[mi].cost += turn.cost || 0; totals[mi].co2 += turn.co2 || 0;
        if (turn.isSimulated) totals[mi].sim = true;
        var tok = cellValue(turn, 'tok'), cost = cellValue(turn, 'cost'), co2 = cellValue(turn, 'co2');
        var simBadge = turn.isSimulated ? '<span class="mx-sim" title="Simulated response">sim</span>' : '';
        var share = maxCost > 0 ? (cost / maxCost * 100).toFixed(1) : 0;
        html += '<td class="mx-tok' + (tok === bestTok ? ' mx-best' : '') + '" data-model="' + mid + '"' + (tok === bestTok ? ' title="Fewest tokens this turn"' : '') + '>'
            + (turn.inputTokens || 0).toLocaleString() + ' in / ' + (turn.outputTokens || 0).toLocaleString() + ' out</td>'
          + '<td class="mx-cost' + (cost === bestCost ? ' mx-best' : '') + '" data-model="' + mid + '" style="--bar:' + share + '%"' + (cost === bestCost ? ' title="Lowest cost this turn"' : '') + '>'
            + '<span class="mx-cost-val">' + simBadge + CALC.fmtCost(cost) + '</span></td>'
          + '<td class="mx-co2' + (co2 === bestCo2 ? ' mx-best' : '') + '" data-model="' + mid + '"' + (co2 === bestCo2 ? ' title="Lowest CO₂ this turn"' : '') + '>'
            + CALC.fmtCO2(co2) + '</td>';
      });
      html += '</tr>';
    });
    html += '</tbody><tfoot><tr><th scope="row" class="mx-turn">Total</th>';
    var bestTotTok  = best(totals.map(function(t){ return t.in + t.out; }));
    var bestTotCost = best(totals.map(function(t){ return t.cost; }));
    var bestTotCo2  = best(totals.map(function(t){ return t.co2; }));
    models.forEach(function(m, mi) {
      var t = totals[mi], mid = esc(m.id);
      html += '<td class="mx-tok' + (t.in + t.out === bestTotTok ? ' mx-best' : '') + '" data-model="' + mid + '">' + t.in.toLocaleString() + ' in / ' + t.out.toLocaleString() + ' out</td>'
        + '<td class="mx-cost' + (t.cost === bestTotCost ? ' mx-best' : '') + '" data-model="' + mid + '"><span class="mx-cost-val">' + CALC.fmtCost(t.cost) + '</span></td>'
        + '<td class="mx-co2' + (t.co2 === bestTotCo2 ? ' mx-best' : '') + '" data-model="' + mid + '">' + CALC.fmtCO2(t.co2) + '</td>';
    });
    html += '</tr></tfoot></table>'
      + '<div class="sr-only" role="status" aria-live="polite">Sorted by ' + esc(sortLabel) + ', ' + (_sort.dir === 'asc' ? 'ascending' : 'descending') + '.</div>';
    ma.innerHTML = html;
  }

  return { switchView: switchView, render: render, sort: sort };
})();
