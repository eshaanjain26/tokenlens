// ── Enterprise: RBAC & Key Vault ─────────────────
window.RBAC = (function() {
  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  var _keys = [
    { id:'k1', provider:'OpenRouter', icon:'🔀', name:'Production Key', masked:'sk-or-****7a2f', project:'All Projects', budgetCap:50, budgetUsed:23.4, scope:'Team-wide', addedBy:'admin@acme.com', active:true },
    { id:'k2', provider:'Azure OpenAI', icon:'☁️', name:'Azure GPT-4', masked:'****9c3d', project:'Backend Team', budgetCap:20, budgetUsed:18.1, scope:'Project', addedBy:'manager@acme.com', active:true },
    { id:'k3', provider:'AWS Bedrock', icon:'🌲', name:'Bedrock Claude', masked:'AKIA****X8TZ', project:'Data Science', budgetCap:30, budgetUsed:4.2, scope:'Project', addedBy:'manager@acme.com', active:false }
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
      if (btn) btn.classList.toggle('active', n === t);
      if (panel) panel.classList.toggle('active', n === t);
    });
    _renderTab(t);
  }

  function _renderTab(t) {
    if (t === 'vault') _renderVault();
    else if (t === 'members') _renderMembers();
    else if (t === 'projects') _renderProjects();
  }

  function _renderVault() {
    var el = document.getElementById('rbac-panel-vault');
    if (!el) return;
    var html = _keys.map(function(k) {
      var pct = Math.min((k.budgetUsed / k.budgetCap) * 100, 100);
      var fillCls = pct >= 90 ? 'danger' : pct >= 70 ? 'warn' : '';
      return '<div class="vault-card' + (k.active?' active-key':'') + '">'
        + '<div class="vault-provider-icon">' + k.icon + '</div>'
        + '<div class="vault-info">'
        +   '<div class="vault-name">' + esc(k.name) + ' <span style="font-size:10px;font-weight:600;color:var(--text-3)">— ' + esc(k.provider) + '</span></div>'
        +   '<div class="vault-key">' + esc(k.masked) + ' · ' + esc(k.scope) + ' · ' + esc(k.project) + '</div>'
        +   '<div class="vault-meta">Added by ' + esc(k.addedBy) + ' · ' + (k.active ? '🟢 Active' : '⚫ Inactive') + '</div>'
        +   '<div class="vault-budget-bar" style="margin-top:6px">'
        +     '<div style="display:flex;justify-content:space-between;font-size:10px;color:var(--text-2);margin-bottom:2px">'
        +       '<span>$' + k.budgetUsed.toFixed(2) + ' used</span><span>Cap: $' + k.budgetCap + '</span>'
        +     '</div>'
        +     '<div class="vault-budget-track"><div class="vault-budget-fill ' + fillCls + '" style="width:' + pct.toFixed(1) + '%"></div></div>'
        +   '</div>'
        + '</div>'
        + '<div class="vault-actions">'
        +   '<button class="vault-action-btn" onclick="RBAC.rotateKey(\'' + k.id + '\')" title="Rotate key">🔄</button>'
        +   '<button class="vault-action-btn" onclick="RBAC.toggleKey(\'' + k.id + '\')" title="Toggle active">' + (k.active ? '⏸' : '▶') + '</button>'
        +   '<button class="vault-action-btn" onclick="RBAC.deleteKey(\'' + k.id + '\')" title="Revoke" style="color:#C82020">🗑</button>'
        + '</div>'
        + '</div>';
    }).join('');
    html += '<div class="vault-add-form">'
      + '<h4>➕ Provision New Key</h4>'
      + '<div class="vault-form-grid">'
      +   '<div><label>Provider</label><select id="vnew-provider"><option>OpenRouter</option><option>Azure OpenAI</option><option>AWS Bedrock</option><option>Anthropic Direct</option><option>Google Vertex</option></select></div>'
      +   '<div><label>Display Name</label><input id="vnew-name" placeholder="e.g. Prod Key" /></div>'
      +   '<div><label>API Key</label><input id="vnew-key" type="password" placeholder="sk-or-…" /></div>'
      +   '<div><label>Assign To Project</label><select id="vnew-proj"><option>All Projects</option><option>Backend Team</option><option>Data Science</option><option>Analytics</option></select></div>'
      +   '<div><label>Budget Cap ($)</label><input id="vnew-cap" type="number" value="25" min="1" /></div>'
      +   '<div><label>Scope</label><select id="vnew-scope"><option>Team-wide</option><option>Project</option><option>Personal</option></select></div>'
      + '</div>'
      + '<button class="rbac-add-btn" style="margin-top:10px" onclick="RBAC.addKey()">Provision Key</button>'
      + '</div>';
    el.innerHTML = html;
  }

  function _renderMembers() {
    var el = document.getElementById('rbac-panel-members');
    if (!el) return;
    var rows = _members.map(function(m) {
      return '<tr>'
        + '<td>' + esc(m.email) + '</td>'
        + '<td><span class="rbac-role-badge ' + m.role + '">' + m.role + '</span></td>'
        + '<td>' + esc(m.projects) + '</td>'
        + '<td>$' + m.spend.toFixed(2) + '</td>'
        + '<td style="color:var(--text-3)">' + m.lastSeen + '</td>'
        + '<td><button class="vault-action-btn" onclick="RBAC.removeMember(\'' + esc(m.email) + '\')" style="color:#C82020">Remove</button></td>'
        + '</tr>';
    }).join('');
    el.innerHTML = '<table class="rbac-table"><thead><tr><th>Email</th><th>Role</th><th>Projects</th><th>Spend</th><th>Last Active</th><th></th></tr></thead><tbody>' + rows + '</tbody></table>'
      + '<div class="rbac-add-row" style="margin-top:12px">'
      +   '<input id="member-email" placeholder="engineer@company.com" style="flex:2" />'
      +   '<select id="member-role"><option value="developer">Developer</option><option value="manager">Manager</option><option value="readonly">Read-only</option></select>'
      +   '<button class="rbac-add-btn" onclick="RBAC.addMember()">Invite</button>'
      + '</div>';
  }

  function _renderProjects() {
    var el = document.getElementById('rbac-panel-projects');
    if (!el) return;
    var projs = [
      { name:'All Projects', members:5, keys:1, monthBudget:50, spent:23.4, color:'#0A6B3C' },
      { name:'Backend Team', members:2, keys:1, monthBudget:20, spent:18.1, color:'#2563EB' },
      { name:'Data Science', members:1, keys:1, monthBudget:30, spent:4.2,  color:'#7C3AED' },
      { name:'Analytics',    members:1, keys:0, monthBudget:10, spent:0.4,  color:'#D97706' }
    ];
    var html = projs.map(function(p) {
      var pct = Math.min((p.spent/p.monthBudget)*100,100);
      return '<div class="project-row">'
        + '<div class="project-dot" style="background:' + p.color + '"></div>'
        + '<div class="project-info">'
        +   '<div class="project-name">' + esc(p.name) + '</div>'
        +   '<div class="project-meta">' + p.members + ' members · ' + p.keys + ' keys · $' + p.spent.toFixed(2) + ' / $' + p.monthBudget + ' this month</div>'
        + '</div>'
        + '<span class="project-budget-chip">' + pct.toFixed(0) + '%</span>'
        + '</div>';
    }).join('');
    html += '<div class="rbac-add-row" style="margin-top:12px">'
      + '<input id="proj-name" placeholder="New project name" style="flex:2" />'
      + '<input id="proj-cap" type="number" placeholder="Budget cap $" style="flex:1" />'
      + '<button class="rbac-add-btn" onclick="RBAC.addProject()">Create Project</button>'
      + '</div>';
    el.innerHTML = html;
  }

  function rotateKey(id) {
    if (typeof TOAST !== 'undefined') TOAST.show('Key rotation initiated — new key will be provisioned in 30s', 'success');
  }
  function toggleKey(id) {
    var k = _keys.filter(function(x){ return x.id===id; })[0];
    if (k) { k.active = !k.active; _renderVault(); }
  }
  function deleteKey(id) {
    _keys = _keys.filter(function(x){ return x.id!==id; });
    _renderVault();
    if (typeof TOAST !== 'undefined') TOAST.show('Key revoked', 'info');
  }
  function addKey() {
    var prov = (document.getElementById('vnew-provider')||{}).value || 'OpenRouter';
    var name = (document.getElementById('vnew-name')||{}).value || 'New Key';
    var cap = parseFloat((document.getElementById('vnew-cap')||{}).value) || 25;
    var proj = (document.getElementById('vnew-proj')||{}).value || 'All Projects';
    var icons = {'OpenRouter':'🔀','Azure OpenAI':'☁️','AWS Bedrock':'🌲','Anthropic Direct':'🧠','Google Vertex':'🔷'};
    _keys.push({ id:'k'+Date.now(), provider:prov, icon:icons[prov]||'🔑', name:name, masked:'sk-****new', project:proj, budgetCap:cap, budgetUsed:0, scope:'Project', addedBy:'you', active:true });
    _renderVault();
    if (typeof TOAST !== 'undefined') TOAST.show('Key provisioned ✓', 'success');
  }
  function addMember() {
    var email = (document.getElementById('member-email')||{}).value || '';
    var role = (document.getElementById('member-role')||{}).value || 'developer';
    if (!email) return;
    _members.push({ email:email, role:role, projects:'—', spend:0, lastSeen:'Just now' });
    _renderMembers();
    if (typeof TOAST !== 'undefined') TOAST.show('Invitation sent to ' + email, 'success');
  }
  function removeMember(email) {
    _members = _members.filter(function(m){ return m.email !== email; });
    _renderMembers();
  }
  function addProject() {
    var name = (document.getElementById('proj-name')||{}).value || 'New Project';
    var cap = parseFloat((document.getElementById('proj-cap')||{}).value) || 10;
    if (typeof TOAST !== 'undefined') TOAST.show('Project "' + name + '" created with $' + cap + ' cap', 'success');
    _renderProjects();
  }

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') { var ov = document.getElementById('rbac-overlay'); if (ov && ov.classList.contains('open')) close(); }
  });

  return { open:open, close:close, switchTab:switchTab, rotateKey:rotateKey, toggleKey:toggleKey, deleteKey:deleteKey, addKey:addKey, addMember:addMember, removeMember:removeMember, addProject:addProject };
})();

