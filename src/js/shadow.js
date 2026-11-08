// ── Enterprise: Shadow AI Discovery ──────────────
window.SHADOW = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var _FAKE_TRAFFIC = [
    { ts:'09:14', user:'alice@acme.com',    provider:'OpenAI Direct',   model:'gpt-4o',              tokens:3420,  cost:0.104, risk:'high',   tag:'Unregistered key', pii:true  },
    { ts:'09:31', user:'bob@acme.com',      provider:'Anthropic Direct',model:'claude-3-5-sonnet',   tokens:1280,  cost:0.038, risk:'medium', tag:'Outside policy',   pii:false },
    { ts:'10:02', user:'unknown',           provider:'OpenRouter',      model:'meta-llama/llama-3',  tokens:890,   cost:0.002, risk:'high',   tag:'No auth header',   pii:true  },
    { ts:'10:45', user:'eng-lead@acme.com', provider:'Azure OpenAI',    model:'gpt-4-turbo',         tokens:5600,  cost:0.224, risk:'low',    tag:'Authorized',        pii:false },
    { ts:'11:20', user:'carol@acme.com',    provider:'Google Gemini',   model:'gemini-1.5-pro',      tokens:2100,  cost:0.063, risk:'medium', tag:'Unregistered key',  pii:false },
    { ts:'11:58', user:'unknown',           provider:'Cohere',          model:'command-r-plus',      tokens:440,   cost:0.009, risk:'high',   tag:'PII detected',     pii:true  },
    { ts:'12:33', user:'alice@acme.com',    provider:'Mistral',         model:'mistral-large',       tokens:770,   cost:0.018, risk:'medium', tag:'Outside budget',   pii:false },
    { ts:'13:10', user:'eng-lead@acme.com', provider:'OpenRouter',      model:'anthropic/claude-3',  tokens:1900,  cost:0.057, risk:'low',    tag:'Authorized',        pii:false }
  ];

  var _PII_TYPES = [
    { type:'Email addresses', count:23 },
    { type:'Social Security numbers', count:4 },
    { type:'Credit card numbers', count:2 },
    { type:'Phone numbers', count:11 },
    { type:'IP addresses', count:37 }
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

    var alerts = '<div class="shadow-alerts">'
      + '<p class="tl-note neg"><b>' + unauthorized + ' unregistered API calls in the last 24 hours.</b> These requests use keys not provisioned through Key Vault, a potential data exfiltration risk. Block and investigate.</p>'
      + '<p class="tl-note warn"><b>PII detected in ' + piiCount + ' outbound prompts.</b> Raw personal data is going to external providers, which puts GDPR and CCPA compliance at risk.</p>'
      + '<p class="tl-note"><b>$' + totalCost.toFixed(2) + ' of shadow spend tracked today.</b> This spend is outside every project budget. Bring it under governance with Key Vault.</p></div>';

    var kpis = '<div class="tl-block">' + TLUI.kpis([
      ['API calls today', String(_FAKE_TRAFFIC.length)],
      ['Unauthorized', String(unauthorized), {tone:'neg'}],
      ['PII incidents', String(piiCount)],
      ['Shadow spend', '$' + totalCost.toFixed(2), {money:true}]
    ]) + '</div>';

    var maxTok = Math.max.apply(null, _FAKE_TRAFFIC.map(function(r){ return r.tokens; }));
    var tableRows = _FAKE_TRAFFIC.map(function(r) {
      var tone = r.risk === 'high' ? 'negative' : r.risk === 'medium' ? 'warning' : 'positive';
      return {
        w: r.tokens / maxTok, attrs: ' data-risk="' + r.risk + '"',
        sort: [r.ts, r.user, r.provider, r.tokens, r.cost, r.risk],
        cells: [
          '<span class="mute">' + r.ts + '</span>', esc(r.user),
          esc(r.provider) + '<div class="tl-meta">' + esc(r.model) + '</div>',
          r.tokens.toLocaleString(), '$' + r.cost.toFixed(3),
          TLUI.pill(esc(r.tag), tone)
        ]
      };
    });
    var table = TLUI.block('Intercepted traffic today', 'Sort any column. Use the filter to focus on one risk level.',
      '<div class="tl-toolbar" style="margin-top:0"><div class="tl-seg" role="group" aria-label="Risk filter" data-for="shadow-traffic" data-attr="risk" data-persist="shadow_risk">'
      + '<button type="button" data-v="all" aria-pressed="true">All</button><button type="button" data-v="high" aria-pressed="false">High</button><button type="button" data-v="medium" aria-pressed="false">Medium</button><button type="button" data-v="low" aria-pressed="false">Low</button></div></div>'
      + '<div id="shadow-traffic" data-risk="all">' + TLUI.ledger({
        label: 'Intercepted traffic', cols: '56px minmax(0,1fr) minmax(0,1.2fr) 72px 72px 150px', colsSm: '48px minmax(0,1fr) 120px', min: 0,
        head: [{label:'Time', sort:true}, {label:'User', sort:true}, {label:'Provider', sort:true, cls:'hide-sm'}, {label:'Tokens', num:true, sort:true, cls:'hide-sm'}, {label:'Cost', num:true, sort:true, cls:'hide-sm'}, {label:'Status', sort:true}],
        rows: tableRows
      }) + '</div>');

    var maxPii = Math.max.apply(null, _PII_TYPES.map(function(p){ return p.count; }));
    var piiRows = _PII_TYPES.map(function(p) {
      return { w: p.count / maxPii, cells: [esc(p.type), String(p.count)] };
    });
    var pii = TLUI.block('PII found in outbound prompts', 'Incidents by data type.', TLUI.ledger({
      label: 'PII incidents', cols: 'minmax(0,1fr) 64px', min: 0,
      head: [{label:'Type'}, {label:'Incidents', num:true}], rows: piiRows
    }));

    var leakBar = TLUI.block('Shadow traffic leakage', leakPct + '% of calls are ungoverned. Target is 0%; fully governed teams stay under 5% through Key Vault enforcement.',
      TLUI.meter(leakPct, leakPct >= 50 ? 'bad' : leakPct >= 20 ? 'warn' : ''));

    el.innerHTML = '<p class="tl-lede">Findings from a sample traffic log. Connect a proxy or gateway to see your own.</p>' + alerts + kpis + table + pii + leakBar;
    TLUI.countUp(el);
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('shadow-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close };
})();

