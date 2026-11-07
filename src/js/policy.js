// ── Enterprise: Policy Enforcement ───────────────
window.POLICY = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var _rules = [
    { id:'p1', name:'Token Overflow Reroute',     desc:'If input context > 50K tokens, automatically route from claude-opus to claude-haiku to reduce cost by ~95%.', trigger:'context > 50K tokens', action:'Route to claude-haiku', enabled:true,  triggered:14, type:'route' },
    { id:'p2', name:'PII Scrubbing Block',         desc:'Block any prompt containing patterns matching SSN, credit card numbers, or email addresses. Alert the security team.', trigger:'PII pattern detected',    action:'Block + alert',      enabled:true,  triggered:7,  type:'block' },
    { id:'p3', name:'Budget Cap Enforcement',      desc:'When any single user hits 80% of their monthly budget, force-route all subsequent calls to the cheapest available model.', trigger:'user spend > 80% cap',    action:'Route to cheapest',  enabled:true,  triggered:3,  type:'route' },
    { id:'p4', name:'Off-Hours Audit Flag',        desc:'Log and flag all API calls made outside 6am–10pm local time for security review.', trigger:'request outside 6am-10pm',action:'Flag for review',      enabled:false, triggered:22, type:'warn'  },
    { id:'p5', name:'Competitor Mention Block',    desc:'Block prompts that contain names of listed competitors to prevent accidental information leakage to external AI providers.', trigger:'competitor keyword match', action:'Block + warn user',   enabled:false, triggered:0,  type:'block' },
    { id:'p6', name:'Max Output Token Ceiling',    desc:'Cap all completions at 2,048 output tokens. Any model request above this threshold is silently truncated before billing.', trigger:'output tokens > 2048',    action:'Cap at 2048 tokens', enabled:true,  triggered:41, type:'route' }
  ];
  var _log = [
    { ts:'13:22', type:'block', msg:'PII block triggered — SSN pattern detected in prompt from bob@acme.com' },
    { ts:'12:58', type:'route', msg:'Token overflow rule routed alice@acme.com from claude-opus to claude-haiku (52K ctx)' },
    { ts:'12:31', type:'route', msg:'Budget cap rule activated — carol@acme.com routed to cheapest model (83% cap hit)' },
    { ts:'11:47', type:'block', msg:'PII block triggered — credit card pattern in prompt from unknown@acme.com' },
    { ts:'11:20', type:'route', msg:'Output ceiling applied — completion truncated at 2048 tokens (user requested 4096)' },
    { ts:'10:55', type:'warn',  msg:'Off-hours flag: API call at 10:55pm from eng-lead@acme.com — queued for review' }
  ];

  function open() {
    var ov = document.getElementById('policy-overlay');
    if (ov) ov.classList.add('open');
    _render();
  }
  function close() {
    var ov = document.getElementById('policy-overlay');
    if (ov) ov.classList.remove('open');
  }

  function toggleRule(id) {
    var r = _rules.filter(function(x){ return x.id===id; })[0];
    if (r) { r.enabled = !r.enabled; _render(); }
  }

  function addRule() {
    var trigger = (document.getElementById('pol-trigger')||{}).value || '';
    var action = (document.getElementById('pol-action')||{}).value || 'warn';
    var desc = (document.getElementById('pol-desc')||{}).value || '';
    var name = (document.getElementById('pol-name')||{}).value || 'Custom Rule';
    if (!trigger) return;
    _rules.push({ id:'p'+Date.now(), name:name, desc:desc||trigger, trigger:trigger, action:action, enabled:true, triggered:0, type:'warn' });
    _log.unshift({ ts:new Date().toTimeString().slice(0,5), type:'route', msg:'New policy rule created: "' + name + '"' });
    _render();
    if (typeof TOAST !== 'undefined') TOAST.show('Policy rule created ✓', 'success');
  }

  function _render() {
    var el = document.getElementById('policy-body');
    if (!el) return;

    var totalTriggered = _rules.reduce(function(s,r){ return s+r.triggered; }, 0);
    var enabled = _rules.filter(function(r){ return r.enabled; }).length;

    var statsHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:16px">'
      + '<div class="shadow-kpi"><div class="shadow-kpi-val">' + _rules.length + '</div><div class="shadow-kpi-lbl">Total Rules</div></div>'
      + '<div class="shadow-kpi"><div class="shadow-kpi-val">' + enabled + '</div><div class="shadow-kpi-lbl">Active</div></div>'
      + '<div class="shadow-kpi"><div class="shadow-kpi-val">' + totalTriggered + '</div><div class="shadow-kpi-lbl">Triggers Today</div></div>'
      + '</div>';

    var rulesHtml = _rules.map(function(r) {
      var enabledCls = r.enabled ? ' enabled' : '';
      var triggeredCls = r.triggered > 0 && r.enabled ? ' triggered' : '';
      var typeIcon = { route:'🔀', block:'🚫', warn:'⚠️' };
      return '<div class="policy-rule' + enabledCls + triggeredCls + '">'
        + '<input type="checkbox" class="policy-rule-toggle" ' + (r.enabled?'checked':'') + ' onchange="POLICY.toggleRule(\'' + r.id + '\')">'
        + '<div class="policy-rule-body">'
        +   '<div class="policy-rule-name">' + (typeIcon[r.type]||'🛡️') + ' ' + esc(r.name) + '</div>'
        +   '<div class="policy-rule-desc">' + esc(r.desc) + '</div>'
        +   '<div class="policy-rule-meta">'
        +     '<span class="policy-meta-chip trigger">IF: ' + esc(r.trigger) + '</span>'
        +     '<span class="policy-meta-chip action">THEN: ' + esc(r.action) + '</span>'
        +   '</div>'
        + '</div>'
        + '<div><div class="policy-trigger-count">' + r.triggered + '</div><div class="policy-trigger-lbl">triggers</div></div>'
        + '</div>';
    }).join('');

    var builderHtml = '<div class="policy-builder">'
      + '<h4>🔧 Create Custom Rule</h4>'
      + '<div class="policy-builder-row"><label>Rule Name</label><input id="pol-name" placeholder="e.g. Competitor Block" style="flex:2"/></div>'
      + '<div class="policy-builder-row"><label>IF trigger</label>'
      +   '<select id="pol-trigger">'
      +     '<option value="context > 50K tokens">Context &gt; 50K tokens</option>'
      +     '<option value="context > 100K tokens">Context &gt; 100K tokens</option>'
      +     '<option value="PII pattern detected">PII pattern detected</option>'
      +     '<option value="user spend > 80% cap">User spend &gt; 80% cap</option>'
      +     '<option value="user spend > 100% cap">User spend &gt; 100% cap</option>'
      +     '<option value="competitor keyword match">Competitor keyword match</option>'
      +     '<option value="output tokens > 2048">Output tokens &gt; 2048</option>'
      +     '<option value="output tokens > 4096">Output tokens &gt; 4096</option>'
      +     '<option value="request outside 6am-10pm">Request outside 6am–10pm</option>'
      +   '</select>'
      + '</div>'
      + '<div class="policy-builder-row"><label>THEN action</label>'
      +   '<select id="pol-action">'
      +     '<option value="Route to cheapest model">Route to cheapest model</option>'
      +     '<option value="Route to claude-haiku">Route to claude-haiku</option>'
      +     '<option value="Route to gemini-flash">Route to gemini-flash</option>'
      +     '<option value="Block + alert">Block + alert security team</option>'
      +     '<option value="Block + warn user">Block + warn user</option>'
      +     '<option value="Cap at 2048 tokens">Cap output at 2048 tokens</option>'
      +     '<option value="Flag for review">Flag for compliance review</option>'
      +   '</select>'
      + '</div>'
      + '<div class="policy-builder-row"><label>Description</label><input id="pol-desc" placeholder="Explain what this rule does…" style="flex:2"/></div>'
      + '<button class="policy-save-btn" onclick="POLICY.addRule()">Save Rule</button>'
      + '</div>';

    var logEntries = _log.slice(0,6).map(function(l) {
      return '<div class="policy-log-entry ' + l.type + '"><span class="policy-log-time">' + l.ts + '</span><span class="policy-log-msg">' + esc(l.msg) + '</span></div>';
    }).join('');

    var logHtml = '<div class="policy-log"><h3>📋 Enforcement Log</h3>' + logEntries + '</div>';

    el.innerHTML = statsHtml + rulesHtml + builderHtml + logHtml;
  }

  // Hook into sendPrompt to enforce policies
  function evaluate(promptText, modelId) {
    var warnings = [];
    var blocked = false;
    var routeTo = null;
    _rules.filter(function(r){ return r.enabled; }).forEach(function(r) {
      if (r.trigger === 'PII pattern detected') {
        var piiRe = /\b\d{3}-\d{2}-\d{4}\b|\b\d{16}\b|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        if (piiRe.test(promptText)) {
          r.triggered++;
          if (r.action.indexOf('Block') >= 0) { blocked = true; warnings.push('🚫 PII detected — prompt blocked by policy.'); }
          else warnings.push('⚠️ PII detected in prompt.');
          _log.unshift({ ts:new Date().toTimeString().slice(0,5), type:'block', msg:'PII policy triggered on model ' + modelId });
        }
      }
      if (r.trigger.indexOf('context') >= 0) {
        var tokLimit = r.trigger.indexOf('100K') >= 0 ? 100000 : 50000;
        var estTok = Math.ceil(promptText.length / 4);
        if (estTok > tokLimit) {
          r.triggered++;
          if (r.action.indexOf('haiku') >= 0) routeTo = 'anthropic/claude-haiku-4-5';
          else if (r.action.indexOf('cheapest') >= 0) routeTo = 'cheapest';
          warnings.push('🔀 Token overflow policy: routing to cheaper model.');
          _log.unshift({ ts:new Date().toTimeString().slice(0,5), type:'route', msg:'Token overflow rule: ' + estTok + ' tokens, routing away from ' + modelId });
        }
      }
    });
    return { blocked: blocked, warnings: warnings, routeTo: routeTo };
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('policy-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, toggleRule:toggleRule, addRule:addRule, evaluate:evaluate };
})();

