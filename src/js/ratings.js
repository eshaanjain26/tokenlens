// ── Enhancement 4: Response Rating ────────────────
window.RATINGS = (function() {
  var _store = {}; // { turnKey: 1 or -1 }

  function rate(modelId, turnNum, val) {
    var k = modelId + '::' + turnNum;
    _store[k] = val;
    var upBtn = document.getElementById('rate-up-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
    var downBtn = document.getElementById('rate-dn-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
    if (upBtn) upBtn.className = 'rate-btn' + (val===1?' rated-up':'');
    if (downBtn) downBtn.className = 'rate-btn' + (val===-1?' rated-down':'');
    _updateLeaderboard();
    if (typeof TOAST !== 'undefined') TOAST.show(val===1 ? '👍 Rated helpful' : '👎 Rated unhelpful', 'info');
  }

  function _updateLeaderboard() {
    var el = document.getElementById('quality-leaderboard');
    if (!el) return;
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    if (!models.length) return;
    var scores = {};
    models.forEach(function(m) {
      var up=0, down=0, total=0;
      Object.keys(_store).forEach(function(k) {
        if (k.indexOf(m.id+'::') === 0) { total++; if (_store[k]===1) up++; else down++; }
      });
      scores[m.id] = { name: m.name||m.id, up:up, down:down, total:total, pct: total ? Math.round((up/total)*100) : null };
    });
    var sorted = Object.keys(scores).filter(function(id){ return scores[id].total>0; }).sort(function(a,b){ return (scores[b].pct||0)-(scores[a].pct||0); });
    if (!sorted.length) { el.style.display='none'; el.innerHTML = ''; return; }
    el.style.display='block';
    el.innerHTML = '<h4>👍 Response Quality Leaderboard</h4>'
      + sorted.map(function(id) {
          var s = scores[id];
          return '<div class="ql-row">'
            + '<span class="ql-name">'+s.name.slice(0,22)+'</span>'
            + '<div class="ql-bar"><div class="ql-fill" style="width:'+s.pct+'%"></div></div>'
            + '<span class="ql-score">'+s.pct+'%</span>'
            + '<span style="font-size:10px;color:var(--text-3)">('+s.total+')</span>'
            + '</div>';
        }).join('');
  }

  function getRatingHtml(modelId, turnNum) {
    var safeId = modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum;
    var k = modelId + '::' + turnNum;
    var v = _store[k] || 0;
    return '<div class="rating-row">'
      + '<span class="rate-label">Rate response:</span>'
      + '<button id="rate-up-'+safeId+'" class="rate-btn'+(v===1?' rated-up':'')+'" onclick="RATINGS.rate(\''+modelId.replace(/'/g,"\\'")+'\','+turnNum+',1)" title="Helpful">👍</button>'
      + '<button id="rate-dn-'+safeId+'" class="rate-btn'+(v===-1?' rated-down':'')+'" onclick="RATINGS.rate(\''+modelId.replace(/'/g,"\\'")+'\','+turnNum+',-1)" title="Not helpful">👎</button>'
      + '</div>';
  }

  return { rate:rate, getRatingHtml:getRatingHtml };
})();

