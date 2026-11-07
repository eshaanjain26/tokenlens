// ── Enterprise: Shadow AI Discovery ──────────────
window.SHADOW = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var _FAKE_TRAFFIC = [
    { ts:'09:14', user:'alice@acme.com',    provider:'OpenAI Direct',   model:'gpt-4o',              tokens:3420,  cost:0.104, risk:'high',   tag:'🚨 Unregistered Key', pii:true  },
    { ts:'09:31', user:'bob@acme.com',      provider:'Anthropic Direct',model:'claude-3-5-sonnet',   tokens:1280,  cost:0.038, risk:'medium', tag:'⚠️ Outside Policy',   pii:false },
    { ts:'10:02', user:'unknown',           provider:'OpenRouter',      model:'meta-llama/llama-3',  tokens:890,   cost:0.002, risk:'high',   tag:'🚨 No Auth Header',   pii:true  },
    { ts:'10:45', user:'eng-lead@acme.com', provider:'Azure OpenAI',    model:'gpt-4-turbo',         tokens:5600,  cost:0.224, risk:'low',    tag:'✅ Authorized',        pii:false },
    { ts:'11:20', user:'carol@acme.com',    provider:'Google Gemini',   model:'gemini-1.5-pro',      tokens:2100,  cost:0.063, risk:'medium', tag:'⚠️ Unregistered Key',  pii:false },
    { ts:'11:58', user:'unknown',           provider:'Cohere',          model:'command-r-plus',      tokens:440,   cost:0.009, risk:'high',   tag:'🚨 PII Detected',     pii:true  },
    { ts:'12:33', user:'alice@acme.com',    provider:'Mistral',         model:'mistral-large',       tokens:770,   cost:0.018, risk:'medium', tag:'⚠️ Outside Budget',   pii:false },
    { ts:'13:10', user:'eng-lead@acme.com', provider:'OpenRouter',      model:'anthropic/claude-3',  tokens:1900,  cost:0.057, risk:'low',    tag:'✅ Authorized',        pii:false }
  ];

  var _PII_TYPES = [
    { type:'Email addresses', count:23, icon:'📧' },
    { type:'Social Security Numbers', count:4,  icon:'🪪' },
    { type:'Credit card numbers', count:2,  icon:'💳' },
    { type:'Phone numbers', count:11, icon:'📞' },
    { type:'IP addresses', count:37, icon:'🌐' }
  ];

  function open() {
    var ov = document.getElementById('shadow-overlay');
    if (ov) ov.classList.add('open');
    _render();
  }
  function close() {
    var ov = document.getElementById('shadow-overlay');
    if (ov) ov.classList.remove('open');
  }

  function _render() {
    var el = document.getElementById('shadow-body');
    if (!el) return;

    var totalTokens = _FAKE_TRAFFIC.reduce(function(s,r){ return s+r.tokens; }, 0);
    var totalCost = _FAKE_TRAFFIC.reduce(function(s,r){ return s+r.cost; }, 0);
    var unauthorized = _FAKE_TRAFFIC.filter(function(r){ return r.risk==='high'; }).length;
    var piiCount = _FAKE_TRAFFIC.filter(function(r){ return r.pii; }).length;
    var leakPct = Math.round((unauthorized / _FAKE_TRAFFIC.length) * 100);

    var alerts = '<div class="shadow-alert critical"><div class="shadow-alert-icon">🚨</div><div class="shadow-alert-body"><strong>' + unauthorized + ' unregistered API calls detected in the last 24h</strong>These requests are using keys not provisioned through Key Vault — potential data exfiltration risk. Block and investigate immediately.</div></div>'
      + '<div class="shadow-alert warning"><div class="shadow-alert-icon">⚠️</div><div class="shadow-alert-body"><strong>PII detected in ' + piiCount + ' outbound prompts</strong>Raw personal data is being sent to external LLM providers. GDPR / CCPA compliance at risk.</div></div>'
      + '<div class="shadow-alert info"><div class="shadow-alert-icon">ℹ️</div><div class="shadow-alert-body"><strong>$' + totalCost.toFixed(2) + ' in shadow spend tracked today</strong>This spend is not tracked in any project budget. Integrate Key Vault to bring it under governance.</div></div>';

    var kpis = '<div class="shadow-kpis">'
      + '<div class="shadow-kpi"><div class="shadow-kpi-val">' + _FAKE_TRAFFIC.length + '</div><div class="shadow-kpi-lbl">API Calls Today</div></div>'
      + '<div class="shadow-kpi"><div class="shadow-kpi-val danger">' + unauthorized + '</div><div class="shadow-kpi-lbl">🚨 Unauthorized</div></div>'
      + '<div class="shadow-kpi"><div class="shadow-kpi-val warn">' + piiCount + '</div><div class="shadow-kpi-lbl">⚠️ PII Incidents</div></div>'
      + '<div class="shadow-kpi"><div class="shadow-kpi-val">$' + totalCost.toFixed(2) + '</div><div class="shadow-kpi-lbl">Shadow Spend</div></div>'
      + '</div>';

    var tableRows = _FAKE_TRAFFIC.map(function(r) {
      return '<tr>'
        + '<td style="color:var(--text-3)">' + r.ts + '</td>'
        + '<td>' + esc(r.user) + '</td>'
        + '<td>' + esc(r.provider) + '</td>'
        + '<td style="font-size:10px;color:var(--text-2)">' + esc(r.model) + '</td>'
        + '<td>' + r.tokens.toLocaleString() + '</td>'
        + '<td>$' + r.cost.toFixed(3) + '</td>'
        + '<td><span class="risk-chip ' + r.risk + '">' + r.tag + '</span></td>'
        + '</tr>';
    }).join('');

    var table = '<h3 style="font-size:12px;font-weight:800;color:var(--tl);text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px">📡 Intercepted Traffic Log (Today)</h3>'
      + '<table class="shadow-table"><thead><tr><th>Time</th><th>User</th><th>Provider</th><th>Model</th><th>Tokens</th><th>Cost</th><th>Status</th></tr></thead><tbody>' + tableRows + '</tbody></table>';

    var piiRows = _PII_TYPES.map(function(p) {
      return '<div class="shadow-pii-row">'
        + '<div class="shadow-pii-icon">' + p.icon + '</div>'
        + '<div class="shadow-pii-info">' + p.type + '</div>'
        + '<div class="shadow-pii-count">' + p.count + '</div>'
        + '</div>';
    }).join('');

    var pii = '<h3 style="font-size:12px;font-weight:800;color:#C82020;text-transform:uppercase;letter-spacing:0.5px;margin:0 0 8px">🔴 PII Detected in Outbound Prompts</h3>' + piiRows;

    var leakBar = '<div class="shadow-leakage-bar">'
      + '<div class="shadow-leakage-label">Shadow Traffic Leakage Score: <strong>' + leakPct + '%</strong> of calls are ungoverned</div>'
      + '<div class="shadow-leakage-track"><div class="shadow-leakage-fill" style="width:' + leakPct + '%"></div></div>'
      + '<div style="font-size:10px;color:var(--text-3);margin-top:3px">Target: 0%. Fully governed orgs achieve <5% shadow spend via Key Vault enforcement.</div>'
      + '</div>';

    el.innerHTML = alerts + kpis + table + '<div style="margin-top:16px">' + pii + '</div><div style="margin-top:16px">' + leakBar + '</div>';
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('shadow-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close };
})();

