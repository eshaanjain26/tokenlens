// ── Feature 5: Green Routing ──────────────────────
window.GREEN = (function() {
  var PROVIDERS = [
    { key: 'google',     label: 'Google (Gemini)', pct: 90, match: /gemini/i },
    { key: 'anthropic',  label: 'Anthropic (Claude)', pct: 85, match: /claude/i },
    { key: 'mistral',    label: 'Mistral', pct: 75, match: /mistral/i },
    { key: 'openai',     label: 'OpenAI / Microsoft', pct: 60, match: /gpt|openai/i },
    { key: 'cohere',     label: 'Cohere', pct: 55, match: /cohere/i },
    { key: 'meta',       label: 'Meta (Llama)', pct: 45, match: /llama/i },
  ];
  var REGION_ADJUST = { 'auto':0, 'us-west':8, 'eu-north':12, 'us-east':-5 };
  var _greenOnly = false;
  var _region = 'auto';

  function _adjustedPct(base) {
    return Math.min(100, Math.max(0, base + (REGION_ADJUST[_region] || 0)));
  }

  function _providerForModel(m) {
    var id = (m.id || '').toLowerCase();
    var name = (m.name || '').toLowerCase();
    for (var i=0; i<PROVIDERS.length; i++) {
      if (PROVIDERS[i].match.test(id) || PROVIDERS[i].match.test(name)) return PROVIDERS[i];
    }
    return { pct: 50 };
  }

  function getModelRenewable(m) {
    return _adjustedPct(_providerForModel(m).pct);
  }

  function onToggle() {
    var cb = document.getElementById('green-only-toggle');
    _greenOnly = cb ? cb.checked : false;
    // Trigger model list re-render
    if (typeof renderModelList === 'function') renderModelList();
    else if (window.APP && APP._renderModelList) APP._renderModelList();
  }

  function onRegion() {
    var sel = document.getElementById('green-region-select');
    _region = sel ? sel.value : 'auto';
    _renderProvList();
    // Region shifts renewable % per model, which affects the Green Only
    // filter and the badge shown next to each model in the sidebar.
    if (typeof renderModelList === 'function') renderModelList();
    else if (window.APP && APP._renderModelList) APP._renderModelList();
  }

  function isGreenOnly() { return _greenOnly; }

  function shouldShow(m) {
    if (!_greenOnly) return true;
    return getModelRenewable(m) >= 70;
  }

  function _renderProvList() {
    var el = document.getElementById('green-prov-list');
    if (!el) return;
    var html = PROVIDERS.map(function(p) {
      var pct = _adjustedPct(p.pct);
      var color = pct >= 70 ? 'var(--tl-light)' : pct >= 55 ? '#F59E0B' : '#EF4444';
      return '<div class="green-prov-row">'
        + '<span class="green-prov-name">' + p.label + '</span>'
        + '<div class="green-prov-bar"><div class="green-prov-fill" style="width:' + pct + '%;background:' + color + '"></div></div>'
        + '<span class="green-prov-pct">' + pct + '%</span>'
        + '</div>';
    }).join('');
    el.innerHTML = html;
  }

  function getBadgeHtml(m) {
    var pct = getModelRenewable(m);
    var cls = pct >= 70 ? 'high' : pct >= 55 ? 'mid' : 'low';
    return '<span class="green-badge ' + cls + '">' + pct + '% 🌿</span>';
  }

  // init
  (function _init() {
    setTimeout(function() { _renderProvList(); }, 200);
  })();

  return { onToggle: onToggle, onRegion: onRegion, isGreenOnly: isGreenOnly, shouldShow: shouldShow, getBadgeHtml: getBadgeHtml, getModelRenewable: getModelRenewable };
})();

