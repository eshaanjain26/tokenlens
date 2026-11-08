// ── Enhancement 2: Turn Annotations & Bookmarks ──
window.BOOKMARKS = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _store = {}; // { turnKey: { bookmarked, note } }

  function _key(modelId, turnNum) { return modelId + '::' + turnNum; }

  function toggleBookmark(modelId, turnNum) {
    var k = _key(modelId, turnNum);
    if (!_store[k]) _store[k] = { bookmarked: false, note: '' };
    _store[k].bookmarked = !_store[k].bookmarked;
    var btn = document.getElementById('bk-btn-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
    if (btn) { btn.classList.toggle('bookmarked', _store[k].bookmarked); btn.setAttribute('aria-pressed', _store[k].bookmarked ? 'true' : 'false'); }
    if (typeof TOAST !== 'undefined') TOAST.show(_store[k].bookmarked ? 'Bookmarked' : 'Bookmark removed', 'info');
  }

  function toggleNote(modelId, turnNum) {
    var id = 'note-wrap-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum;
    var wrap = document.getElementById(id);
    if (wrap) {
      wrap.classList.toggle('open');
      var nb = document.getElementById('note-btn-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
      if (nb) nb.setAttribute('aria-expanded', wrap.classList.contains('open') ? 'true' : 'false');
      var ta = document.getElementById('note-input-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
      if (ta && wrap.classList.contains('open')) ta.focus();
    }
  }

  function saveNote(modelId, turnNum) {
    var k = _key(modelId, turnNum);
    var id = 'note-input-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum;
    var ta = document.getElementById(id);
    if (!_store[k]) _store[k] = { bookmarked: false, note: '' };
    if (ta) _store[k].note = ta.value;
    var saved = document.getElementById('note-saved-' + modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum);
    if (saved) { saved.style.display = 'block'; setTimeout(function(){ saved.style.display='none'; }, 1500); }
  }

  function open() {
    var ov = document.getElementById('bookmarks-overlay');
    if (ov) ov.classList.add('open');
    _render();
  }
  function close() {
    var ov = document.getElementById('bookmarks-overlay');
    if (ov) ov.classList.remove('open');
  }

  function _render() {
    var el = document.getElementById('bookmarks-list');
    if (!el) return;
    var bookmarked = Object.keys(_store).filter(function(k){ return _store[k].bookmarked; });
    if (!bookmarked.length) {
      el.innerHTML = '<p style="color:var(--text-2);font-size:12px;padding:16px">No bookmarks yet. Use the bookmark button on any turn to save it here.</p>';
      return;
    }
    var models = STATE.getActiveModels ? STATE.getActiveModels() : [];
    var html = bookmarked.map(function(k) {
      var parts = k.split('::');
      var modelId = parts[0], turnNum = parseInt(parts[1]);
      var model = models.filter(function(m){ return m.id===modelId; })[0];
      var sess = STATE.getSession ? STATE.getSession(modelId) : null;
      var turn = sess && sess.turns ? sess.turns.filter(function(t){ return t.turnNum===turnNum; })[0] : null;
      var note = _store[k].note;
      return '<div class="bk-item">'
        + '<div class="bk-model">' + esc(model ? (model.name||model.id) : modelId) + '</div>'
        + '<div class="bk-prompt">' + esc((turn && turn.prompt ? turn.prompt : '(prompt not found)').slice(0,120)) + (turn && turn.prompt && turn.prompt.length > 120 ? '…' : '') + '</div>'
        + (note ? '<div class="bk-note">"' + esc(note) + '"</div>' : '')
        + '<div class="bk-meta">Turn ' + turnNum + (turn ? ' · ' + CALC.fmtCost(turn.cost) : '') + '</div>'
        + '</div>';
    }).join('');
    el.innerHTML = html;
  }

  function getAnnotationHtml(modelId, turnNum) {
    var safeId = modelId.replace(/[^a-z0-9]/gi,'_') + '_' + turnNum;
    var k = _key(modelId, turnNum);
    var bk = _store[k] ? _store[k].bookmarked : false;
    var note = _store[k] ? _store[k].note : '';
    return '<div class="rating-row" role="group" aria-label="Turn notes">'
      + '<button id="bk-btn-' + safeId + '" class="turn-annotation-btn' + (bk?' bookmarked':'') + '" aria-pressed="' + bk + '" onclick="BOOKMARKS.toggleBookmark(\'' + modelId.replace(/'/g,"\\'") + '\',' + turnNum + ')" title="Bookmark this turn" aria-label="Bookmark this turn">' + TL_ICON('bookmark') + '</button>'
      + '<button id="note-btn-' + safeId + '" class="turn-annotation-btn" aria-expanded="false" onclick="BOOKMARKS.toggleNote(\'' + modelId.replace(/'/g,"\\'") + '\',' + turnNum + ')" title="Add a note" aria-label="Add a note to this turn">' + TL_ICON('note') + '</button>'
      + '</div>'
      + '<div id="note-wrap-' + safeId + '" class="turn-note-wrap">'
      +   '<textarea id="note-input-' + safeId + '" class="turn-note-input" rows="2" placeholder="Add a note…" aria-label="Note for this turn" oninput="BOOKMARKS.saveNote(\'' + modelId.replace(/'/g,"\\'") + '\',' + turnNum + ')">' + esc(note) + '</textarea>'
      +   '<div id="note-saved-' + safeId + '" class="turn-note-saved" role="status">Saved</div>'
      + '</div>';
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('bookmarks-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { toggleBookmark:toggleBookmark, toggleNote:toggleNote, saveNote:saveNote, open:open, close:close, getAnnotationHtml:getAnnotationHtml };
})();

