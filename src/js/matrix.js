/* ══════════════════════════════════════════════════════════
   MODULE — MATRIX
   Turn-by-turn comparison table view
   ══════════════════════════════════════════════════════════ */
window.MATRIX = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _currentView = 'cols';

  function switchView(v) {
    _currentView = v;
    document.getElementById('vt-cols').classList.toggle('active', v === 'cols');
    document.getElementById('vt-matrix').classList.toggle('active', v === 'matrix');
    document.getElementById('columns-area').style.display = v === 'cols' ? '' : 'none';
    var ma = document.getElementById('matrix-area');
    if (v === 'matrix') { ma.classList.add('visible'); render(); }
    else { ma.classList.remove('visible'); }
  }

  function render() {
    var ma = document.getElementById('matrix-area');
    if (!ma) return;
    var models = STATE.getActiveModels();
    if (!models || !models.length) { ma.innerHTML = '<p style="color:var(--text-3);padding:20px">Select models to see the matrix view.</p>'; return; }
    var maxTurns = STATE.maxTurns();
    if (!maxTurns) { ma.innerHTML = '<p style="color:var(--text-3);padding:20px">Send a prompt to populate the matrix.</p>'; return; }

    var html = '<table><thead><tr><th>Turn</th>';
    models.forEach(function(m) {
      var short = (m.name || m.id).split('/').pop();
      html += '<th colspan="3" style="text-align:center">'+esc(short)+'</th>';
    });
    html += '</tr><tr><th></th>';
    models.forEach(function() {
      html += '<th>Tokens</th><th>Cost</th><th>CO₂</th>';
    });
    html += '</tr></thead><tbody>';

    for (var i = 1; i <= maxTurns; i++) {
      html += '<tr><td>Turn '+i+'</td>';
      models.forEach(function(m) {
        var sess = STATE.getSession(m.id);
        var turn = sess && sess.turns && sess.turns[i-1];
        if (!turn) { html += '<td colspan="3" style="color:var(--text-3);font-size:11px">—</td>'; return; }
        var simBadge = turn.isSimulated ? '<span class="mx-sim">sim</span> ' : '';
        html += '<td>'+(turn.inputTokens||0)+' in / '+(turn.outputTokens||0)+' out</td>'
          +'<td class="mx-cost">'+simBadge+CALC.fmtCost(turn.cost)+'</td>'
          +'<td>'+CALC.fmtCO2(turn.co2)+'</td>';
      });
      html += '</tr>';
    }
    html += '</tbody></table>';
    ma.innerHTML = html;
  }

  return { switchView: switchView, render: render };
})();

