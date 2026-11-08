// ── Enhancement 4: Response Rating ────────────────
window.RATINGS = (function() {
  var _store = {}; // { turnKey: 1 or -1 }

  function rate(modelId, turnNum, val) {
    var k = modelId + '::' + turnNum;
    _store[k] = val;
    var upBtn = document.getElementById('rate-up-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
    var downBtn = document.getElementById('rate-dn-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
    if (upBtn) { upBtn.className = 'rate-btn' + (val===1?' rated-up':''); upBtn.setAttribute('aria-pressed', val===1 ? 'true' : 'false'); }
    if (downBtn) { downBtn.className = 'rate-btn' + (val===-1?' rated-down':''); downBtn.setAttribute('aria-pressed', val===-1 ? 'true' : 'false'); }
    _updateLeaderboard();
    if (typeof TOAST !== 'undefined') TOAST.show(val===1 ? 'Rated helpful' : 'Rated unhelpful', 'info');
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
    el.innerHTML = '<div class="sec-text"><h2>Response quality</h2><p class="sec-sub">Share of thumbs-up ratings per model, from the turns you have rated.</p></div>'
      + '<div class="ql-list">'
      + sorted.map(function(id, i) {
          var s = scores[id];
          return '<div class="ql-row" data-model="'+esc(id)+'" style="--bar:'+s.pct+'%">'
            + '<button type="button" class="ql-name js-model" data-hl="'+esc(id)+'" aria-pressed="false" title="Highlight '+esc(s.name)+' across the page">'+esc(s.name)+'</button>'
            + '<span class="ql-score">'+s.pct+'%</span>'
            + '<span class="ql-count">'+s.total+(s.total===1?' rating':' ratings')+'</span>'
            + '</div>';
        }).join('')
      + '</div>';
  }

  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  function getRatingHtml(modelId, turnNum) {
    var safeId = modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum;
    var k = modelId + '::' + turnNum;
    var v = _store[k] || 0;
    return '<div class="rating-row" role="group" aria-label="Rate response">'
      + '<button id="rate-up-'+safeId+'" class="rate-btn'+(v===1?' rated-up':'')+'" aria-pressed="'+(v===1)+'" onclick="RATINGS.rate(\''+modelId.replace(/'/g,"\\'")+'\','+turnNum+',1)" title="Helpful" aria-label="Rate helpful">'+TL_ICON('thumbUp')+'</button>'
      + '<button id="rate-dn-'+safeId+'" class="rate-btn'+(v===-1?' rated-down':'')+'" aria-pressed="'+(v===-1)+'" onclick="RATINGS.rate(\''+modelId.replace(/'/g,"\\'")+'\','+turnNum+',-1)" title="Not helpful" aria-label="Rate not helpful">'+TL_ICON('thumbDown')+'</button>'
      + '</div>';
  }

  return { rate:rate, getRatingHtml:getRatingHtml };
})();

