// ── Enhancement 6: Webhook / Slack Alerts ─────────
window.WEBHOOKS = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _endpoints = [
    { id:'wh1', name:'Slack #ai-costs',      icon:'💬', url:'https://hooks.slack.com/services/T00/B00/EXAMPLE', triggers:['budget-80','budget-100','pii-block'], active:true  },
    { id:'wh2', name:'PagerDuty',             icon:'🚨', url:'https://events.pagerduty.com/v2/enqueue',           triggers:['budget-100','policy-block'],         active:false },
    { id:'wh3', name:'Custom Dashboard',      icon:'📊', url:'https://dashboard.acme.com/webhooks/llm',          triggers:['budget-80','session-end'],            active:true  }
  ];
  var _log = [
    { ts:'13:22', status:'ok',   endpoint:'Slack #ai-costs',   event:'Budget at 82% — $0.82 of $1.00 used' },
    { ts:'12:58', status:'ok',   endpoint:'Custom Dashboard',  event:'Session summary — 14 turns, $0.74 spend' },
    { ts:'11:47', status:'fail', endpoint:'PagerDuty',         event:'Connection refused — endpoint unreachable' },
    { ts:'10:55', status:'ok',   endpoint:'Slack #ai-costs',   event:'PII block triggered — prompt blocked' }
  ];
  var _TRIGGER_LABELS = { 'budget-80':'Budget ≥80%','budget-100':'Budget 100%','pii-block':'PII Blocked','policy-block':'Policy Block','session-end':'Session End' };

  function open() {
    var ov = document.getElementById('webhooks-overlay');
    if (ov) ov.classList.add('open');
    _render();
  }
  function close() {
    var ov = document.getElementById('webhooks-overlay');
    if (ov) ov.classList.remove('open');
  }
  function toggleEndpoint(id) {
    var ep = _endpoints.filter(function(e){ return e.id===id; })[0];
    if (ep) { ep.active = !ep.active; _render(); }
  }
  function testEndpoint(id) {
    var ep = _endpoints.filter(function(e){ return e.id===id; })[0];
    if (!ep) return;
    var res = document.getElementById('wh-test-'+id);
    if (!res) return;
    res.className = 'wh-test-result';
    // Simulate: slack-like URLs succeed, others may fail
    var success = ep.url.indexOf('slack.com') >= 0 || ep.url.indexOf('dashboard.acme.com') >= 0;
    setTimeout(function() {
      if (success) {
        res.className = 'wh-test-result success';
        res.textContent = '✓ Test payload delivered successfully (200 OK)';
        _log.unshift({ ts: new Date().toTimeString().slice(0,5), status:'ok', endpoint:ep.name, event:'Test ping' });
      } else {
        res.className = 'wh-test-result fail';
        res.textContent = '✗ Delivery failed — check URL and network access';
        _log.unshift({ ts: new Date().toTimeString().slice(0,5), status:'fail', endpoint:ep.name, event:'Test ping failed' });
      }
    }, 700);
  }
  function addEndpoint() {
    var name = (document.getElementById('wh-new-name')||{}).value||'';
    var url = (document.getElementById('wh-new-url')||{}).value||'';
    var trigger = (document.getElementById('wh-new-trigger')||{}).value||'budget-80';
    var icon = url.indexOf('slack.com')>=0?'💬':url.indexOf('pagerduty')>=0?'🚨':'🔗';
    if (!name||!url) return;
    _endpoints.push({ id:'wh'+Date.now(), name:name, icon:icon, url:url, triggers:[trigger], active:true });
    _render();
    if (typeof TOAST !== 'undefined') TOAST.show('Webhook added ✓', 'success');
  }

  // Fire a webhook event (called by POLICY / BUDGET)
  function fire(eventName, payload) {
    _endpoints.filter(function(ep){ return ep.active && ep.triggers.indexOf(eventName)>=0; }).forEach(function(ep) {
      // In a real app this would be a fetch POST. Simulate it:
      _log.unshift({ ts: new Date().toTimeString().slice(0,5), status:'ok', endpoint:ep.name, event:eventName+': '+JSON.stringify(payload).slice(0,60) });
    });
  }

  function _render() {
    var el = document.getElementById('webhooks-body');
    if (!el) return;

    var epHtml = _endpoints.map(function(ep) {
      var chips = ep.triggers.map(function(t){ return '<span class="wh-trigger-chip">'+(_TRIGGER_LABELS[t]||t)+'</span>'; }).join('');
      return '<div class="wh-endpoint'+(ep.active?' active':'')+'">'
        + '<div class="wh-endpoint-icon">'+ep.icon+'</div>'
        + '<div class="wh-endpoint-info">'
        +   '<div class="wh-endpoint-name">'+esc(ep.name)+'</div>'
        +   '<div class="wh-endpoint-url">'+esc(ep.url.slice(0,55))+(ep.url.length>55?'…':'')+'</div>'
        +   '<div class="wh-trigger-chips">'+chips+'</div>'
        +   '<div id="wh-test-'+ep.id+'" class="wh-test-result"></div>'
        + '</div>'
        + '<div style="display:flex;flex-direction:column;gap:5px;align-items:center;flex-shrink:0">'
        +   '<input type="checkbox" class="wh-toggle" '+(ep.active?'checked':'')+' onchange="WEBHOOKS.toggleEndpoint(\''+ep.id+'\')">'
        +   '<button class="vault-action-btn" onclick="WEBHOOKS.testEndpoint(\''+ep.id+'\')" style="font-size:10px;padding:3px 7px">Test</button>'
        + '</div>'
        + '</div>';
    }).join('');

    var addForm = '<div class="wh-add-form"><h4>➕ Add Endpoint</h4>'
      + '<div class="wh-form-row"><label>Name</label><input id="wh-new-name" placeholder="Slack #channel / PagerDuty…"/></div>'
      + '<div class="wh-form-row"><label>URL</label><input id="wh-new-url" placeholder="https://hooks.slack.com/…" type="url"/></div>'
      + '<div class="wh-form-row"><label>Trigger on</label><select id="wh-new-trigger">'
      +   Object.keys(_TRIGGER_LABELS).map(function(k){ return '<option value="'+k+'">'+_TRIGGER_LABELS[k]+'</option>'; }).join('')
      + '</select></div>'
      + '<button class="rbac-add-btn" onclick="WEBHOOKS.addEndpoint()">Add Webhook</button></div>';

    var logEntries = _log.slice(0,6).map(function(l) {
      return '<div class="wh-log-entry '+(l.status==='ok'?'ok':'fail')+'">'
        + '<span style="font-size:10px;font-weight:700;opacity:0.7;white-space:nowrap">'+l.ts+'</span>'
        + '<span style="font-size:10px;font-weight:700">'+esc(l.endpoint)+'</span>'
        + '<span style="flex:1;font-size:11px">'+esc(l.event)+'</span>'
        + (l.status==='ok'?'<span style="font-size:10px">✓</span>':'<span style="font-size:10px">✗</span>')
        + '</div>';
    }).join('');

    var logHtml = '<div class="wh-log"><h3>Delivery Log</h3>'+logEntries+'</div>';

    el.innerHTML = epHtml + addForm + logHtml;
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('webhooks-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, toggleEndpoint:toggleEndpoint, testEndpoint:testEndpoint, addEndpoint:addEndpoint, fire:fire };
})();

