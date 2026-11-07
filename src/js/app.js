/* ══════════════════════════════════════════════════════════
   MODULE 10 — APP  (boot, event wiring, model list, tab routing)
   ══════════════════════════════════════════════════════════ */
window.APP = (function() {

  var modelFilter = '';
  var providerFilter = '';
  var _darkMode = false;
  var _tplOpen = false;

  // ── Dark Mode ──────────────────────────────────────────
  function toggleDark() {
    _darkMode = !_darkMode;
    document.body.classList.toggle('dark', _darkMode);
    document.getElementById('dark-toggle').textContent = _darkMode ? '☀️' : '🌙';
    try { localStorage.setItem('lti_theme_v1', _darkMode ? 'dark' : 'light'); } catch(e){}
  }

  // ── Sidebar collapse ────────────────────────────────────
  var _sidebarCollapsed = false;
  function toggleSidebarCollapse() {
    _sidebarCollapsed = !_sidebarCollapsed;
    var sb = document.getElementById('sidebar');
    var btn = document.getElementById('sidebar-collapse-btn');
    if (sb) sb.classList.toggle('collapsed', _sidebarCollapsed);
    if (btn) btn.textContent = _sidebarCollapsed ? '▶' : '◀';
    if (btn) btn.title = _sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar';
  }

  // ── Shareable URL ──────────────────────────────────────
  function shareURL() {
    var models = STATE.getActiveModels().map(function(m){return m.id;});
    var prompt = (document.getElementById('prompt-input')||{}).value || '';
    var hash = '#m=' + encodeURIComponent(models.join(',')) + (prompt ? '&p=' + encodeURIComponent(prompt.slice(0,200)) : '');
    var url = location.href.split('#')[0] + hash;
    // Guard: some proxies/older browsers cap URLs around 2048 chars.
    // 10 models + a 200-char prompt normally lands near 1.2K, but warn
    // rather than silently hand back a link that could get truncated.
    if (url.length > 1900) {
      TOAST.warning('Share link is ' + url.length + ' chars — some browsers/proxies may truncate links over ~2000 chars. Consider sharing with fewer models or a shorter prompt.');
    }
    try { navigator.clipboard.writeText(url); TOAST.success('Link copied to clipboard!'); } catch(e) { TOAST.info('Copy URL: ' + url); }
  }

  function applyURLHash() {
    try {
      var h = location.hash;
      if (!h || h.length < 3) return;
      var params = {};
      h.slice(1).split('&').forEach(function(p){ var kv=p.split('='); params[kv[0]]=decodeURIComponent(kv.slice(1).join('=')); });
      if (params.m) {
        params.m.split(',').forEach(function(id){
          if (id && !STATE.isActive(id)) STATE.toggleModel(id);
        });
        UI_COMPARE.renderAll();
        renderModelList();
      }
      if (params.p) {
        var pi = document.getElementById('prompt-input');
        if (pi) { pi.value = params.p; UI_COMPARE.updateLivePreview(params.p); }
      }
    } catch(e) {}
  }

  // ── Session History ────────────────────────────────────
  function openHistory() {
    var listEl = document.getElementById('history-list');
    var hist = STATE.loadHistory();
    if (!listEl) return;
    if (!hist.length) {
      listEl.innerHTML = '<div class="hm-empty">No sessions saved yet.<br>Sessions are auto-saved after each prompt.</div>';
    } else {
      listEl.innerHTML = hist.map(function(entry, i) {
        var date = new Date(entry.date).toLocaleString();
        var modelNames = entry.models.map(function(m){return m.name||m.id.split('/').pop();}).join(', ');
        return '<div class="hm-session" onclick="APP.restoreSession('+i+')">'
          +'<div class="hs-title">'+(entry.turns)+' turn'+(entry.turns!==1?'s':'')+' · '+CALC.fmtCost(entry.totalCost||0)+'</div>'
          +'<div class="hs-meta">'+date+'</div>'
          +'<div class="hs-models">'+modelNames+'</div>'
          +'</div>';
      }).join('');
    }
    document.getElementById('history-overlay').classList.add('open');
  }

  function closeHistory() {
    document.getElementById('history-overlay').classList.remove('open');
  }

  function restoreSession(idx) {
    var hist = STATE.loadHistory();
    var entry = hist[idx]; if (!entry) return;
    closeHistory();
    TOAST.info('Session restore is a reference view only — data shown above.');
  }

  function clearHistory() {
    STATE.clearHistory();
    openHistory();
  }

  // ── Cost Projection ────────────────────────────────────
  function openProjection() {
    var models = STATE.getActiveModels();
    if (!models.length) { TOAST.warning('Select at least one model from the sidebar to project costs.'); return; }
    document.getElementById('projection-overlay').classList.add('open');
    updateProjection();
  }

  function closeProjection() {
    document.getElementById('projection-overlay').classList.remove('open');
  }

  function updateProjection() {
    var models = STATE.getActiveModels(); if (!models.length) return;
    var runs = parseInt((document.getElementById('proj-runs')||{}).value||1000);
    var inTok = parseInt((document.getElementById('proj-in')||{}).value||500);
    var outTok = parseInt((document.getElementById('proj-out')||{}).value||300);
    var wrap = document.getElementById('proj-table-wrap'); if (!wrap) return;
    var costPerRun = models.map(function(m){ return CALC.cost(m, inTok, outTok); });
    var minCost = Math.min.apply(null, costPerRun);
    var maxCost = Math.max.apply(null, costPerRun);
    var rows = models.map(function(m, i) {
      var cpr = costPerRun[i];
      var daily = cpr * runs;
      var monthly = daily * 30;
      var yearly = daily * 365;
      var isBest = cpr === minCost;
      var isWorst = cpr === maxCost;
      var cls = isBest && models.length > 1 ? ' class="best"' : isWorst && models.length > 1 ? ' class="worst"' : '';
      var sname = m.name || m.id.split('/').pop();
      return '<tr><td><strong>'+esc(sname)+'</strong></td>'
        +'<td'+cls+'>'+CALC.fmtCost(cpr)+'</td>'
        +'<td'+cls+'>'+CALC.fmtCost(daily)+'</td>'
        +'<td'+cls+'>'+CALC.fmtCost(monthly)+'</td>'
        +'<td'+cls+'>'+CALC.fmtCost(yearly)+(isBest&&models.length>1?' ✅':'')+'</td></tr>';
    }).join('');
    wrap.innerHTML = '<table class="pm-table"><thead><tr>'
      +'<th>Model</th><th>Per Run</th><th>Daily ('+runs.toLocaleString()+'×)</th><th>Monthly</th><th>Yearly</th>'
      +'</tr></thead><tbody>'+rows+'</tbody></table>'
      +'<p style="font-size:10px;color:var(--text-3);margin-top:9px">Based on '+inTok.toLocaleString()+' input + '+outTok.toLocaleString()+' output tokens per run.</p>';
  }

  // ── Templates dropdown ─────────────────────────────────
  function toggleTemplates() {
    _tplOpen = !_tplOpen;
    var dd = document.getElementById('tpl-dropdown');
    if (dd) dd.classList.toggle('open', _tplOpen);
  }

  function applyTemplate(text) {
    var pi = document.getElementById('prompt-input');
    if (pi) { pi.value = text; UI_COMPARE.updateLivePreview(text); pi.focus(); }
    _tplOpen = false;
    var dd = document.getElementById('tpl-dropdown');
    if (dd) dd.classList.remove('open');
  }

  // ── Provider chip filter ───────────────────────────────
  function setProviderFilter(prov) {
    providerFilter = prov;
    document.querySelectorAll('.pchip').forEach(function(c){ c.classList.toggle('active', c.dataset.prov === prov); });
    renderModelList();
  }

  async function init() {
    // Apply saved theme
    try {
      if (localStorage.getItem('lti_theme_v1') === 'dark') {
        _darkMode = true;
        document.body.classList.add('dark');
        // SVG toggle handles display via CSS; no textContent needed
      }
    } catch(e) {}
    // Set initial send button label based on key state
    var _sb = document.getElementById('send-btn');
    if (_sb) _sb.textContent = API.hasKey() ? 'Send ▶' : 'Simulate ▶';

    var models = await API.fetchModels();
    STATE.setModels(models);
    renderModelList();
    TOAST.success(models.length + ' models loaded' + (models.length > 30 ? ' live from OpenRouter' : ' (offline fallback)'));

    // Apply URL hash after models loaded
    applyURLHash();

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.tab-btn').forEach(function(b){b.classList.remove('active');});
        document.querySelectorAll('.tab-panel').forEach(function(p){p.classList.remove('active');});
        btn.classList.add('active');
        var panel = document.getElementById(btn.dataset.tab+'-panel');
        if (panel) panel.classList.add('active');
        if (btn.dataset.tab==='benchmarks') UI_BENCHMARKS.render();
        if (btn.dataset.tab==='analytics')  UI_ANALYTICS.render();
        // howitworks panel is static HTML — no render needed
      });
    });

    // Currency
    document.querySelectorAll('.cur-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        document.querySelectorAll('.cur-btn').forEach(function(b){b.classList.remove('active');});
        btn.classList.add('active');
        CALC.setCurrency(btn.dataset.cur);
        UI_COMPARE.refreshAllCurrencies();
      });
    });

    // API key
    var keyInput = document.getElementById('api-key-input');
    keyInput.addEventListener('input', function() {
      API.setKey(keyInput.value);
      var s = document.getElementById('api-key-status');
      var btn = document.getElementById('send-btn');
      if (API.hasKey()) {
        s.className='api-key-status ok';
        s.textContent='✅ Key set — real model responses enabled';
        if (btn && !btn.disabled) btn.textContent = 'Send ▶';
      } else {
        s.className='api-key-status idle';
        s.textContent='⚫ No key — simulated responses shown';
        if (btn && !btn.disabled) btn.textContent = 'Simulate ▶';
      }
      if (typeof BUDGET !== 'undefined') BUDGET.update();
    });

    // Prompt
    var pi = document.getElementById('prompt-input');
    pi.addEventListener('input', function() { UI_COMPARE.updateLivePreview(pi.value); });
    pi.addEventListener('keydown', function(e) {
      if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) { e.preventDefault(); send(); }
    });
    document.getElementById('send-btn').addEventListener('click', send);

    // Model search
    document.getElementById('model-search').addEventListener('input', function(e) {
      modelFilter = e.target.value.toLowerCase();
      renderModelList();
    });

    // Provider chips
    document.querySelectorAll('.pchip').forEach(function(chip) {
      chip.addEventListener('click', function() {
        setProviderFilter(chip.dataset.prov);
      });
    });

    // Close template dropdown on outside click
    document.addEventListener('click', function(e) {
      var wrap = document.querySelector('.tpl-wrap');
      if (wrap && !wrap.contains(e.target)) {
        _tplOpen = false;
        var dd = document.getElementById('tpl-dropdown');
        if (dd) dd.classList.remove('open');
      }
    });

    // Legacy sidebar templates still work
    document.querySelectorAll('.template-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        pi.value = btn.dataset.prompt;
        UI_COMPARE.updateLivePreview(pi.value);
        pi.focus();
      });
    });

    // ── Global keyboard shortcuts ─────────────────────────────────
    document.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') {
        closeHistory(); closeProjection();
        V6.closeModal('rec'); V6.closeModal('optimizer');
        V6.closeModal('scenario'); V6.closeModal('abtest');
        TOAST._closeAbout(); TOAST._closeTools();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        var ms = document.getElementById('model-search');
        if (ms) { ms.focus(); ms.select(); }
      }
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'D') {
        e.preventDefault(); toggleDark();
      }
    });

    // Initialize onboarding
    TOAST._initOnboarding();
  }

  function send() {
    var t = document.getElementById('prompt-input').value.trim();
    if (t) UI_COMPARE.sendPrompt(t);
  }

  function renderModelList() {
    var models  = STATE.getModels();
    var listEl  = document.getElementById('model-list');
    var countEl = document.getElementById('model-count');
    var knownProviders = ['openai','anthropic','google','meta-llama','mistralai','deepseek','x-ai','cohere','perplexity','qwen'];
    var filtered = models.filter(function(m) {
      var id = (m.id||'').toLowerCase();
      var name = (m.name||'').toLowerCase();
      if (modelFilter && !id.includes(modelFilter) && !name.includes(modelFilter)) return false;
      if (providerFilter) {
        var prov = id.split('/')[0];
        if (providerFilter === 'other') return !knownProviders.includes(prov);
        if (prov !== providerFilter) return false;
      }
      if (window.GREEN && !GREEN.shouldShow(m)) return false;
      return true;
    });
    var atMax = STATE.activeCount() >= 10;
    listEl.innerHTML = filtered.slice(0,100).map(function(m) {
      var chk      = STATE.isActive(m.id)?'checked':'';
      var provider = (m.id||'').split('/')[0];
      var sname    = m.name || (m.id||'').split('/').pop();
      var ctxK     = (m.context_length/1000).toFixed(0);
      var disabledCls = (atMax && !STATE.isActive(m.id)) ? ' disabled' : '';
      var greenBadge = window.GREEN ? GREEN.getBadgeHtml(m) : '';
      return '<label class="model-item'+disabledCls+'" title="'+(atMax && !STATE.isActive(m.id) ? 'Deselect a model first' : '')+'">'
        +'<input type="checkbox" '+chk+' onchange="APP.toggleModel(\''+esc(m.id)+'\')">'
        +'<div><div class="model-name">'+esc(sname)+greenBadge+'</div>'
        +'<div class="model-provider">'+esc(provider)+' &middot; '+ctxK+'K ctx</div></div>'
        +'</label>';
    }).join('');
    if (filtered.length === 0 && window.GREEN && GREEN.isGreenOnly()) {
      listEl.innerHTML = '<p style="color:var(--text-2);font-size:12px;padding:8px">No models meet the 70% renewable threshold for the current region. Try a different region or turn off Green Only.</p>';
    }
    countEl.textContent = STATE.activeCount() + ' of 10 selected';
    var tipEl = document.getElementById('max-model-tip');
    if (tipEl) tipEl.classList.toggle('visible', atMax);
  }

  function toggleModel(id) {
    if (!STATE.toggleModel(id)) { TOAST.warning('Maximum 10 models selected — deselect one before adding another.'); return; }
    renderModelList();
    UI_COMPARE.renderAll();
  }

  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

  // ── Mobile sidebar ──────────────────────────────────────
  var _sidebarOpen = false;
  function toggleSidebar() {
    _sidebarOpen = !_sidebarOpen;
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebar-overlay');
    var btn = document.getElementById('mobile-menu-btn');
    if (sidebar) sidebar.classList.toggle('mobile-open', _sidebarOpen);
    if (overlay) overlay.classList.toggle('visible', _sidebarOpen);
    if (btn) btn.setAttribute('aria-expanded', _sidebarOpen ? 'true' : 'false');
  }

  // ── Export CSV ──────────────────────────────────────────
  function exportCSV() {
    var models = STATE.getActiveModels();
    if (!models.length) { TOAST.warning('Select at least one model to export data.'); return; }
    var rows = [['Model','Provider','Context (K)','Input $/1M','Output $/1M','Power Wh/1M','CO₂ g/1M','Water mL/1M','Turns','Total Cost','Total CO₂','Total Water']];
    models.forEach(function(m) {
      var s = STATE.getSession(m.id) || {};
      var ip = (parseFloat(m.pricing.prompt)*1e6).toFixed(4);
      var op = (parseFloat(m.pricing.completion)*1e6).toFixed(4);
      var pwr = DATA.getPowerRate(m.id).toFixed(0);
      var co2pm = DATA.getCO2Rate(m.id).toFixed(3);
      var wpm  = (DATA.getWaterRate(m.id)*1000).toFixed(2);
      rows.push([
        m.name||m.id, m.id.split('/')[0],
        (m.context_length/1000).toFixed(0),
        ip, op, pwr, co2pm, wpm,
        s.turns?s.turns.length:0,
        s.totalCost?s.totalCost.toFixed(6):0,
        s.totalCO2?s.totalCO2.toFixed(4):0,
        s.totalWater?s.totalWater.toFixed(4):0,
      ]);
    });
    var csv = rows.map(function(r){ return r.map(function(c){ return '"'+String(c).replace(/"/g,'""')+'"'; }).join(','); }).join('\n');
    var blob = new Blob([csv], {type:'text/csv'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'tokenlens-comparison.csv'; a.click();
    URL.revokeObjectURL(url);
    TOAST.success('CSV exported successfully.');
  }

  function exportJSON() {
    var models = STATE.getActiveModels();
    if (!models.length) { TOAST.warning('Select at least one model to export data.'); return; }
    var data = {
      exported: new Date().toISOString(),
      source: 'TokenLens v1.0',
      disclaimer: 'Environmental figures are research-derived estimates. See tokenlens About panel for methodology.',
      models: models.map(function(m) {
        var s = STATE.getSession(m.id) || {};
        return {
          id: m.id, name: m.name,
          context_length: m.context_length,
          pricing: { input_per_1m: parseFloat(m.pricing.prompt)*1e6, output_per_1m: parseFloat(m.pricing.completion)*1e6 },
          environmental_per_1m_tokens: {
            power_wh: DATA.getPowerRate(m.id),
            co2_grams: DATA.getCO2Rate(m.id),
            water_ml: DATA.getWaterRate(m.id)*1000,
          },
          session: { turns: s.turns?s.turns.length:0, total_cost: s.totalCost||0, total_co2_g: s.totalCO2||0, total_water_l: s.totalWater||0 }
        };
      })
    };
    var blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'tokenlens-comparison.json'; a.click();
    URL.revokeObjectURL(url);
    TOAST.success('JSON exported successfully.');
  }

  return {init, toggleModel, toggleDark, toggleSidebarCollapse, shareURL, openHistory, closeHistory, restoreSession, clearHistory,
          openProjection, closeProjection, updateProjection, toggleTemplates, applyTemplate, setProviderFilter,
          toggleSidebar, exportCSV, exportJSON, _renderModelList: renderModelList};
})();

