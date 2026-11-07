// ── Enhancement 5: Session Notes ──────────────────
window.NOTES = (function() {
  var _isOpen = false;
  var _content = '';

  function open() {
    _isOpen = true;
    var ov = document.getElementById('notes-overlay');
    if (ov) ov.classList.add('open');
    var ta = document.getElementById('notes-textarea');
    if (ta) ta.value = _content;
    _updateWordCount();
  }
  function close() {
    _isOpen = false;
    var ov = document.getElementById('notes-overlay');
    if (ov) ov.classList.remove('open');
    _save();
  }
  function toggle() {
    if (_isOpen) close(); else open();
  }
  function _save() {
    var ta = document.getElementById('notes-textarea');
    if (ta) _content = ta.value;
  }
  function _updateWordCount() {
    var ta = document.getElementById('notes-textarea');
    var wc = document.getElementById('notes-wc');
    if (ta && wc) {
      var words = ta.value.trim() ? ta.value.trim().split(/\s+/).length : 0;
      wc.textContent = words + ' words';
    }
  }
  function onInput() { _save(); _updateWordCount(); }
  function clear() {
    if (!confirm('Clear all session notes?')) return;
    _content = '';
    var ta = document.getElementById('notes-textarea');
    if (ta) ta.value = '';
    _updateWordCount();
  }
  function copyAll() {
    _save();
    if (navigator.clipboard) navigator.clipboard.writeText(_content);
    if (typeof TOAST !== 'undefined') TOAST.show('Notes copied to clipboard ✓', 'success');
  }

  // Inject FAB after init
  (function _injectFAB() {
    setTimeout(function() {
      if (!document.getElementById('notes-fab')) {
        var fab = document.createElement('button');
        fab.id = 'notes-fab'; fab.title = 'Session Notes'; fab.innerHTML = '📝';
        fab.onclick = function() { NOTES.toggle(); };
        document.body.appendChild(fab);
      }
    }, 900);
  })();

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && _isOpen) close();
  });

  return { open:open, close:close, toggle:toggle, onInput:onInput, clear:clear, copyAll:copyAll };
})();

