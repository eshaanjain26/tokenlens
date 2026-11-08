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
    if (r) {
      r.enabled = !r.enabled; _render();
      var cb = document.querySelector('[data-rule="' + id + '"]');
      if (cb) cb.focus();
    }
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
    if (typeof TOAST !== 'undefined') TOAST.show('Policy rule created.', 'success');
  }

  function _field(label, ctl, id, full) { return '<div class="tl-field' + (full ? ' full' : '') + '"><label class="tl-label" for="' + id + '">' + label + '</label>' + ctl + '</div>'; }

  function _render() {
    var el = document.getElementById('policy-body');
    if (!el) return;

    var totalTriggered = _rules.reduce(function(s,r){ return s+r.triggered; }, 0);
    var enabled = _rules.filter(function(r){ return r.enabled; }).length;
    var maxT = Math.max.apply(null, _rules.map(function(r){ return r.triggered; }).concat([1]));

    var statsHtml = TLUI.kpis([['Total rules', String(_rules.length)], ['Active', String(enabled)], ['Triggers today', String(totalTriggered)]]);

    var ruleRows = _rules.map(function(r) {
      var typeLabel = { route:'Route', block:'Block', warn:'Warn' }[r.type] || 'Rule';
      return {
        cls: r.enabled ? '' : 'off',
        sort: [null, r.name, r.triggered],
        cells: [
          '<input type="checkbox" class="tl-switch" data-rule="' + r.id + '" ' + (r.enabled ? 'checked' : '') + ' aria-label="Enable ' + esc(r.name) + '" onchange="POLICY.toggleRule(\'' + r.id + '\')">',
          '<div class="tl-name">' + esc(r.name) + ' ' + TLUI.pill(typeLabel) + '</div><div class="tl-meta">' + esc(r.desc) + '</div>'
            + '<div class="tl-meta policy-if"><b>If</b> ' + esc(r.trigger) + ' <b>then</b> ' + esc(r.action) + '</div>',
          String(r.triggered)
        ]
      };
    });
    var rulesHtml = TLUI.block('Rules', 'Switch a rule on or off. The bar behind each row shows its share of today’s triggers.',
      TLUI.ledger({
        label: 'Policy rules', cols: '44px minmax(0,1fr) 72px', min: 0,
        head: [{label:'On'}, {label:'Rule'}, {label:'Triggers', num:true, sort:true}],
        rows: ruleRows.map(function(r){ r.cells = r.cells.map(function(c, i){ return i === 1 ? '<div class="wrap-cell">' + c + '</div>' : c; }); return r; })
      }));

    var builderHtml = TLUI.block('Create a custom rule', 'Pick a trigger and an action.',
      '<div class="tl-form">'
      + _field('Rule name', '<input class="tl-input" id="pol-name" placeholder="Competitor block">', 'pol-name', true)
      + _field('If', '<select class="tl-select" id="pol-trigger">'
        + '<option value="context > 50K tokens">Context over 50K tokens</option>'
        + '<option value="context > 100K tokens">Context over 100K tokens</option>'
        + '<option value="PII pattern detected">PII pattern detected</option>'
        + '<option value="user spend > 80% cap">User spend over 80% of cap</option>'
        + '<option value="user spend > 100% cap">User spend over 100% of cap</option>'
        + '<option value="competitor keyword match">Competitor keyword match</option>'
        + '<option value="output tokens > 2048">Output tokens over 2048</option>'
        + '<option value="output tokens > 4096">Output tokens over 4096</option>'
        + '<option value="request outside 6am-10pm">Request outside 6am to 10pm</option></select>', 'pol-trigger')
      + _field('Then', '<select class="tl-select" id="pol-action">'
        + '<option value="Route to cheapest model">Route to cheapest model</option>'
        + '<option value="Route to claude-haiku">Route to claude-haiku</option>'
        + '<option value="Route to gemini-flash">Route to gemini-flash</option>'
        + '<option value="Block + alert">Block and alert security team</option>'
        + '<option value="Block + warn user">Block and warn user</option>'
        + '<option value="Cap at 2048 tokens">Cap output at 2048 tokens</option>'
        + '<option value="Flag for review">Flag for compliance review</option></select>', 'pol-action')
      + _field('Description', '<input class="tl-input" id="pol-desc" placeholder="Explain what this rule does">', 'pol-desc', true)
      + '</div><div class="tl-actions" style="margin-top:16px"><button type="button" class="tl-btn" onclick="POLICY.addRule()">Save rule</button></div>');

    var logRows = _log.slice(0,6).map(function(l) {
      var tone = l.type === 'block' ? 'negative' : l.type === 'warn' ? 'warning' : '';
      return { cells: ['<span class="mute">' + l.ts + '</span>', '<span class="tl-name">' + esc(l.msg) + '</span>', TLUI.pill({block:'Block', route:'Route', warn:'Warn'}[l.type] || 'Event', tone)] };
    });
    var logHtml = TLUI.block('Enforcement log', 'Most recent events.', TLUI.ledger({
      label: 'Enforcement log', cols: '56px minmax(0,1fr) 72px', colsSm: '48px minmax(0,1fr) 64px', min: 0,
      head: [{label:'Time'}, {label:'Event'}, {label:'Type'}], rows: logRows
    }));

    el.innerHTML = '<p class="tl-lede">A preview of how rules would act on prompts. Rules are not applied to prompts in this build.</p>'
      + statsHtml + rulesHtml + builderHtml + logHtml;
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
          if (r.action.indexOf('Block') >= 0) { blocked = true; warnings.push('PII detected. Prompt blocked by policy.'); }
          else warnings.push('PII detected in prompt.');
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
          warnings.push('Token overflow policy: routing to a cheaper model.');
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

