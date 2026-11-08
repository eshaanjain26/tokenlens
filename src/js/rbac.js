// ── Enterprise: RBAC & Key Vault ─────────────────
window.RBAC = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var _keys = [
    { id:'k1', provider:'OpenRouter', name:'Production Key', masked:'sk-or-****7a2f', project:'All Projects', budgetCap:50, budgetUsed:23.4, scope:'Team-wide', addedBy:'admin@acme.com', active:true },
    { id:'k2', provider:'Azure OpenAI', name:'Azure GPT-4', masked:'****9c3d', project:'Backend Team', budgetCap:20, budgetUsed:18.1, scope:'Project', addedBy:'manager@acme.com', active:true },
    { id:'k3', provider:'AWS Bedrock', name:'Bedrock Claude', masked:'AKIA****X8TZ', project:'Data Science', budgetCap:30, budgetUsed:4.2, scope:'Project', addedBy:'manager@acme.com', active:false }
  ];
  var _members = [
    { email:'admin@acme.com',      role:'admin',     projects:'All',           spend:12.40, lastSeen:'2 min ago' },
    { email:'eng-lead@acme.com',   role:'manager',   projects:'Backend, DS',   spend:8.70,  lastSeen:'1 hr ago' },
    { email:'alice@acme.com',      role:'developer', projects:'Backend',       spend:5.20,  lastSeen:'3 hrs ago' },
    { email:'bob@acme.com',        role:'developer', projects:'Data Science',  spend:3.10,  lastSeen:'Yesterday' },
    { email:'carol@acme.com',      role:'readonly',  projects:'Analytics',     spend:0.40,  lastSeen:'1 week ago' }
  ];
  var _activeTab = 'vault';

  function open() {
    var ov = document.getElementById('rbac-overlay');
    if (ov) ov.classList.add('open');
    _renderTab(_activeTab);
  }
  function close() {
    var ov = document.getElementById('rbac-overlay');
    if (ov) ov.classList.remove('open');
  }
  function switchTab(t) {
    _activeTab = t;
    ['vault','members','projects'].forEach(function(n) {
      var btn = document.getElementById('rbac-tab-'+n);
      var panel = document.getElementById('rbac-panel-'+n);
      if (btn) { btn.classList.toggle('active', n === t); btn.setAttribute('aria-selected', n === t ? 'true' : 'false'); }
      if (panel) panel.classList.toggle('active', n === t);
    });
    _renderTab(t);
  }

  function _renderTab(t) {
    if (t === 'vault') _renderVault();
    else if (t === 'members') _renderMembers();
    else if (t === 'projects') _renderProjects();
  }

  function _icoBtn(icon, label, onclick, extra) {
    return '<button type="button" class="tl-icon-btn' + (extra || '') + '" onclick="' + onclick + '" title="' + label + '" aria-label="' + label + '">' + window.TL_ICON(icon) + '</button>';
  }
  function _field(label, ctl, id) { return '<div class="tl-field"><label class="tl-label" for="' + id + '">' + label + '</label>' + ctl + '</div>'; }

  function _renderVault() {
    var el = document.getElementById('rbac-panel-vault');
    if (!el) return;
    var rows = _keys.map(function(k) {
      var pct = Math.min((k.budgetUsed / k.budgetCap) * 100, 100);
      var tone = pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : '';
      return {
        sort: [k.name, k.project, pct, k.active ? 1 : 0],
        cells: [
          '<div class="wrap-cell"><div class="tl-name">' + esc(k.name) + '</div><div class="tl-meta"><span class="tl-mono">' + esc(k.masked) + '</span> · ' + esc(k.provider) + '</div></div>',
          '<div class="wrap-cell"><div class="tl-name">' + esc(k.project) + '</div><div class="tl-meta">' + esc(k.scope) + ' · added by ' + esc(k.addedBy) + '</div></div>',
          '<div class="rbac-budget"><span>$' + k.budgetUsed.toFixed(2) + ' of $' + k.budgetCap + '</span>' + TLUI.meter(pct, tone) + '</div>',
          k.active ? TLUI.pill('Active', 'positive') : TLUI.pill('Inactive'),
          '<div class="rbac-actions">' + _icoBtn('refresh', 'Rotate key', "RBAC.rotateKey('" + k.id + "')")
            + _icoBtn(k.active ? 'pause' : 'play', k.active ? 'Pause key' : 'Activate key', "RBAC.toggleKey('" + k.id + "')")
            + '<button type="button" class="tl-icon-btn danger" data-confirm="Revoke?" onclick="RBAC.deleteKey(\'' + k.id + '\')" title="Revoke key" aria-label="Revoke key">' + window.TL_ICON('trash') + '</button></div>'
        ].map(function(c, i) { return c; })
      };
    });
    var html = TLUI.ledger({
      label: 'API keys', cols: 'minmax(0,1.2fr) minmax(0,1.2fr) minmax(0,1fr) 84px 112px', colsSm: 'minmax(0,1fr) 112px', min: 0,
      head: [{label:'Key', sort:true}, {label:'Project', sort:true, cls:'hide-sm'}, {label:'Budget', sort:true, cls:'hide-sm'}, {label:'Status', sort:true, cls:'hide-sm'}, {label:'', cls:'num'}],
      rows: rows.map(function(r) {
        r.cells[1] = r.cells[1]; return r;
      })
    });
    html += '<section class="tl-block"><div class="tl-block-head"><div><h3 class="tl-h">Provision a key</h3><p class="tl-sub">The key is held in this browser session only.</p></div></div>'
      + '<div class="tl-form">'
      + _field('Provider', '<select class="tl-select" id="vnew-provider"><option>OpenRouter</option><option>Azure OpenAI</option><option>AWS Bedrock</option><option>Anthropic Direct</option><option>Google Vertex</option></select>', 'vnew-provider')
      + _field('Display name', '<input class="tl-input" id="vnew-name" placeholder="Production key">', 'vnew-name')
      + _field('API key', '<input class="tl-input" id="vnew-key" type="password" placeholder="sk-or-..." autocomplete="off">', 'vnew-key')
      + _field('Assign to project', '<select class="tl-select" id="vnew-proj"><option>All Projects</option><option>Backend Team</option><option>Data Science</option><option>Analytics</option></select>', 'vnew-proj')
      + _field('Budget cap (USD)', '<input class="tl-input" id="vnew-cap" type="number" value="25" min="1">', 'vnew-cap')
      + _field('Scope', '<select class="tl-select" id="vnew-scope"><option>Team-wide</option><option>Project</option><option>Personal</option></select>', 'vnew-scope')
      + '</div><div class="tl-actions" style="margin-top:16px"><button type="button" class="tl-btn" onclick="RBAC.addKey()">Provision key</button></div></section>';
    el.innerHTML = html;
  }

  function _renderMembers() {
    var el = document.getElementById('rbac-panel-members');
    if (!el) return;
    var maxSpend = Math.max.apply(null, _members.map(function(m){ return m.spend; }).concat([0.01]));
    var rows = _members.map(function(m) {
      return {
        w: m.spend / maxSpend,
        sort: [m.email, m.role, m.projects, m.spend, m.lastSeen],
        cells: [
          '<span class="tl-name">' + esc(m.email) + '</span>',
          TLUI.pill(esc(m.role.charAt(0).toUpperCase() + m.role.slice(1)), m.role === 'admin' ? 'warning' : ''),
          esc(m.projects), '$' + m.spend.toFixed(2), '<span class="mute">' + esc(m.lastSeen) + '</span>',
          '<button type="button" class="tl-btn ghost sm danger" data-confirm="Confirm" onclick="RBAC.removeMember(\'' + esc(m.email) + '\')">Remove</button>'
        ]
      };
    });
    el.innerHTML = TLUI.ledger({
      label: 'Team members', cols: 'minmax(0,1.5fr) 96px minmax(0,1fr) 72px minmax(0,1fr) 88px', colsSm: 'minmax(0,1fr) 88px', min: 0,
      head: [{label:'Email', sort:true}, {label:'Role', sort:true, cls:'hide-sm'}, {label:'Projects', sort:true, cls:'hide-sm'}, {label:'Spend', num:true, sort:true, cls:'hide-sm'}, {label:'Last active', sort:true, cls:'hide-sm'}, {label:''}],
      rows: rows
    })
    + '<section class="tl-block"><div class="tl-block-head"><div><h3 class="tl-h">Invite a member</h3></div></div><div class="tl-form three">'
    + _field('Email', '<input class="tl-input" id="member-email" type="email" placeholder="engineer@company.com" autocomplete="off">', 'member-email')
    + _field('Role', '<select class="tl-select" id="member-role"><option value="developer">Developer</option><option value="manager">Manager</option><option value="readonly">Read-only</option></select>', 'member-role')
    + '<div class="tl-field"><span class="tl-label">&nbsp;</span><button type="button" class="tl-btn" onclick="RBAC.addMember()">Invite</button></div>'
    + '</div></section>';
  }

  function _renderProjects() {
    var el = document.getElementById('rbac-panel-projects');
    if (!el) return;
    var projs = [
      { name:'All Projects', members:5, keys:1, monthBudget:50, spent:23.4 },
      { name:'Backend Team', members:2, keys:1, monthBudget:20, spent:18.1 },
      { name:'Data Science', members:1, keys:1, monthBudget:30, spent:4.2 },
      { name:'Analytics',    members:1, keys:0, monthBudget:10, spent:0.4 }
    ];
    var rows = projs.map(function(p) {
      var pct = Math.min((p.spent/p.monthBudget)*100,100);
      return {
        sort: [p.name, p.members, p.keys, pct],
        cells: [
          '<span class="tl-name">' + esc(p.name) + '</span>', String(p.members), String(p.keys),
          '<div class="rbac-budget"><span>$' + p.spent.toFixed(2) + ' of $' + p.monthBudget + '</span>' + TLUI.meter(pct, pct >= 90 ? 'bad' : pct >= 70 ? 'warn' : '') + '</div>',
          pct.toFixed(0) + '%'
        ]
      };
    });
    el.innerHTML = TLUI.ledger({
      label: 'Projects', cols: 'minmax(0,1.2fr) 72px 56px minmax(0,1.4fr) 56px', colsSm: 'minmax(0,1fr) minmax(0,1.2fr) 48px', min: 0,
      head: [{label:'Project', sort:true}, {label:'Members', num:true, sort:true, cls:'hide-sm'}, {label:'Keys', num:true, sort:true, cls:'hide-sm'}, {label:'Spent this month', sort:true}, {label:'Used', num:true, sort:true}],
      rows: rows
    })
    + '<section class="tl-block"><div class="tl-block-head"><div><h3 class="tl-h">New project</h3></div></div><div class="tl-form three">'
    + _field('Name', '<input class="tl-input" id="proj-name" placeholder="New project name">', 'proj-name')
    + _field('Budget cap (USD)', '<input class="tl-input" id="proj-cap" type="number" placeholder="10" min="1">', 'proj-cap')
    + '<div class="tl-field"><span class="tl-label">&nbsp;</span><button type="button" class="tl-btn" onclick="RBAC.addProject()">Create project</button></div>'
    + '</div></section>';
  }

  function rotateKey(id) {
    if (typeof TOAST !== 'undefined') TOAST.show('Key rotation started. The new key will be provisioned in 30 seconds.', 'success');
  }
  function toggleKey(id) {
    var k = _keys.filter(function(x){ return x.id===id; })[0];
    if (k) { k.active = !k.active; _renderVault(); }
  }
  function deleteKey(id) {
    _keys = _keys.filter(function(x){ return x.id!==id; });
    _renderVault();
    if (typeof TOAST !== 'undefined') TOAST.show('Key revoked.', 'info');
  }
  function addKey() {
    var prov = (document.getElementById('vnew-provider')||{}).value || 'OpenRouter';
    var name = (document.getElementById('vnew-name')||{}).value || 'New Key';
    var cap = parseFloat((document.getElementById('vnew-cap')||{}).value) || 25;
    var proj = (document.getElementById('vnew-proj')||{}).value || 'All Projects';
        _keys.push({ id:'k'+Date.now(), provider:prov, name:name, masked:'sk-****new', project:proj, budgetCap:cap, budgetUsed:0, scope:'Project', addedBy:'you', active:true });
    _renderVault();
    if (typeof TOAST !== 'undefined') TOAST.show('Key provisioned.', 'success');
  }
  function addMember() {
    var email = (document.getElementById('member-email')||{}).value || '';
    var role = (document.getElementById('member-role')||{}).value || 'developer';
    if (!email) return;
    _members.push({ email:email, role:role, projects:'—', spend:0, lastSeen:'Just now' });
    _renderMembers();
    if (typeof TOAST !== 'undefined') TOAST.show('Invitation sent to ' + email + '.', 'success');
  }
  function removeMember(email) {
    _members = _members.filter(function(m){ return m.email !== email; });
    _renderMembers();
  }
  function addProject() {
    var name = (document.getElementById('proj-name')||{}).value || 'New Project';
    var cap = parseFloat((document.getElementById('proj-cap')||{}).value) || 10;
    if (typeof TOAST !== 'undefined') TOAST.show('Project "' + name + '" created with a $' + cap + ' cap.', 'success');
    _renderProjects();
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('rbac-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, switchTab:switchTab, rotateKey:rotateKey, toggleKey:toggleKey, deleteKey:deleteKey, addKey:addKey, addMember:addMember, removeMember:removeMember, addProject:addProject };
})();

