/* ══════════════════════════════════════════════════════════
   MODULE — BUDGET
   Session budget guard with progress bar
   ══════════════════════════════════════════════════════════ */
window.BUDGET = (function() {
  function getCap() {
    var v = parseFloat(document.getElementById('budget-input') && document.getElementById('budget-input').value || '1');
    return isNaN(v) || v <= 0 ? 1 : v;
  }
  function update() {
    var g = STATE.globalTotals();
    var spent = g ? (g.cost || 0) : 0;
    var isSimMode = !API.hasKey();
    var fill = document.getElementById('budget-fill');
    var usedLbl = document.getElementById('budget-used');
    var capLbl = document.getElementById('budget-cap-lbl');
    if (!fill) return;
    if (isSimMode) {
      fill.style.width = '0%';
      fill.className = 'budget-bar-fill';
      if (usedLbl) usedLbl.textContent = 'Simulated · $' + spent.toFixed(4);
      if (capLbl) capLbl.textContent = 'no real spend';
      return;
    }
    var cap = getCap();
    var pct = Math.min((spent / cap) * 100, 100);
    fill.style.width = pct + '%';
    fill.className = 'budget-bar-fill' + (pct >= 100 ? ' over' : pct >= 70 ? ' warn' : '');
    if (usedLbl) usedLbl.textContent = '$' + spent.toFixed(4) + ' used';
    if (capLbl) capLbl.textContent = 'of $' + cap.toFixed(2);
    if (pct >= 100) {
      TOAST.show('⚠️ Session budget exceeded! ($' + spent.toFixed(4) + ' / $' + cap.toFixed(2) + ')', 'warning', 5000);
      if (typeof WEBHOOKS !== 'undefined') WEBHOOKS.fire('budget-100', { spent: spent, cap: cap });
    } else if (pct >= 70 && pct < 72) {
      TOAST.show('💰 Budget at ' + Math.round(pct) + '% — consider wrapping up.', 'warning', 4000);
      if (typeof WEBHOOKS !== 'undefined') WEBHOOKS.fire('budget-80', { pct: Math.round(pct), spent: spent });
    }
  }
  return { update: update, getCap: getCap };
})();

