// ── Enhancement 6: Webhook / Slack Alerts ─────────
window.WEBHOOKS = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  var _endpoints = [
    { id:'wh1', name:'Slack #ai-costs', url:'https://hooks.slack.com/services/T00/B00/EXAMPLE', triggers:['budget-80','budget-100','pii-block'], active:true  },
    { id:'wh2', name:'PagerDuty', url:'https://events.pagerduty.com/v2/enqueue',           triggers:['budget-100','policy-block'],         active:false },
    { id:'wh3', name:'Custom Dashboard', url:'https://dashboard.acme.com/webhooks/llm',          triggers:['budget-80','session-end'],            active:true  }
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
    if (ep) {
      ep.active = !ep.active; _render();
      var cb = document.querySelector('[data-ep="' + id + '"]');
      if (cb) cb.focus();
    }
  }
  function testEndpoint(id) {
    var ep = _endpoints.filter(function(e){ return e.id===id; })[0];
    if (!ep) return;
    var res = document.getElementById('wh-test-'+id);
    if (!res) return;
    res.className = 'wh-test-result';
    res.textContent = 'Sending test payload';
    res.classList.add('pending');
    // Simulate: slack-like URLs succeed, others may fail
    var success = ep.url.indexOf('slack.com') >= 0 || ep.url.indexOf('dashboard.acme.com') >= 0;
    setTimeout(function() {
      if (success) {
        res.className = 'wh-test-result success';
        res.textContent = 'Test payload delivered (200 OK).';
        _log.unshift({ ts: new Date().toTimeString().slice(0,5), status:'ok', endpoint:ep.name, event:'Test ping' });
      } else {
        res.className = 'wh-test-result fail';
        res.textContent = 'Delivery failed. Check the URL and network access.';
        _log.unshift({ ts: new Date().toTimeString().slice(0,5), status:'fail', endpoint:ep.name, event:'Test ping failed' });
      }
    }, 700);
  }
  function addEndpoint() {
    var name = (document.getElementById('wh-new-name')||{}).value||'';
    var url = (document.getElementById('wh-new-url')||{}).value||'';
    var trigger = (document.getElementById('wh-new-trigger')||{}).value||'budget-80';
    var nameEl = document.getElementById('wh-new-name'), urlEl = document.getElementById('wh-new-url');
    var errName = document.getElementById('wh-new-name-err'), errUrl = document.getElementById('wh-new-url-err');
    var validUrl = /^https?:\/\/[^\s]+\.[^\s]+/i.test(url);
    if (nameEl) nameEl.setAttribute('aria-invalid', name ? 'false' : 'true');
    if (urlEl) urlEl.setAttribute('aria-invalid', validUrl ? 'false' : 'true');
    if (errName) errName.textContent = name ? '' : 'Give the endpoint a name.';
    if (errUrl) errUrl.textContent = validUrl ? '' : 'Enter a full URL that starts with https://.';
    if (!name || !validUrl) return;
    _endpoints.push({ id:'wh'+Date.now(), name:name, url:url, triggers:[trigger], active:true });
    _render();
    if (typeof TOAST !== 'undefined') TOAST.show('Webhook added.', 'success');
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

    var epRows = _endpoints.map(function(ep) {
      var chips = ep.triggers.map(function(t){ return TLUI.pill(esc(_TRIGGER_LABELS[t]||t)); }).join('');
      return {
        cls: ep.active ? '' : 'off',
        cells: [
          '<input type="checkbox" class="tl-switch" data-ep="' + ep.id + '" ' + (ep.active ? 'checked' : '') + ' aria-label="Enable ' + esc(ep.name) + '" onchange="WEBHOOKS.toggleEndpoint(\'' + ep.id + '\')">',
          '<div class="wrap-cell"><div class="tl-name">' + esc(ep.name) + '</div><div class="tl-meta tl-mono wh-url">' + esc(ep.url) + '</div>'
            + '<div class="tl-chips" style="margin-top:6px">' + chips + '</div>'
            + '<div id="wh-test-' + ep.id + '" class="wh-test-result" role="status"></div></div>',
          '<button type="button" class="tl-btn secondary sm" onclick="WEBHOOKS.testEndpoint(\'' + ep.id + '\')">Send test</button>'
        ]
      };
    });
    var epHtml = TLUI.block('Endpoints', 'Alerts go to every active endpoint whose trigger matches.', TLUI.ledger({
      label: 'Webhook endpoints', cols: '44px minmax(0,1fr) 96px', min: 0,
      head: [{label:'On'}, {label:'Endpoint'}, {label:''}], rows: epRows
    }));

    var addForm = TLUI.block('Add an endpoint', null,
      '<div class="tl-form">'
      + '<div class="tl-field"><label class="tl-label" for="wh-new-name">Name</label><input class="tl-input" id="wh-new-name" placeholder="Slack #channel"><div class="tl-error" id="wh-new-name-err"></div></div>'
      + '<div class="tl-field"><label class="tl-label" for="wh-new-trigger">Trigger on</label><select class="tl-select" id="wh-new-trigger">'
      + Object.keys(_TRIGGER_LABELS).map(function(k){ return '<option value="'+k+'">'+_TRIGGER_LABELS[k]+'</option>'; }).join('')
      + '</select></div>'
      + '<div class="tl-field full"><label class="tl-label" for="wh-new-url">URL</label><input class="tl-input" id="wh-new-url" placeholder="https://hooks.slack.com/..." type="url"><div class="tl-error" id="wh-new-url-err"></div></div>'
      + '</div><div class="tl-actions" style="margin-top:16px"><button type="button" class="tl-btn" onclick="WEBHOOKS.addEndpoint()">Add webhook</button></div>');

    var logRows = _log.slice(0,6).map(function(l) {
      return { cells: ['<span class="mute">' + l.ts + '</span>', esc(l.endpoint), '<span class="tl-name">' + esc(l.event) + '</span>', l.status === 'ok' ? TLUI.pill('Delivered', 'positive') : TLUI.pill('Failed', 'negative')] };
    });
    var logHtml = TLUI.block('Delivery log', 'Most recent deliveries.', TLUI.ledger({
      label: 'Delivery log', cols: '56px minmax(0,1fr) minmax(0,1.6fr) 88px', colsSm: '48px minmax(0,1fr) 80px', min: 0,
      head: [{label:'Time'}, {label:'Endpoint'}, {label:'Event', cls:'hide-sm'}, {label:'Result'}], rows: logRows
    }));

    el.innerHTML = '<p class="tl-lede">Send an alert to Slack, PagerDuty or your own dashboard when a budget or policy event fires. No requests leave your browser in this build.</p>' + epHtml + addForm + logHtml;
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('webhooks-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, toggleEndpoint:toggleEndpoint, testEndpoint:testEndpoint, addEndpoint:addEndpoint, fire:fire };
})();

