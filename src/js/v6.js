/* ══════════════════════════════════════════════════════════
   MODULE 9 — V6
   Recommender · Prompt Optimizer · Scenario Builder · A/B Test
   ══════════════════════════════════════════════════════════ */
window.V6 = (function() {

  function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function setEl(id,v){ var e=document.getElementById(id); if(e) e.innerHTML=v; }

  // ── Modal open/close ──────────────────────────────
  function openModal(name) {
    if (name === 'scenario') _populateScenarioSelects();
    if (name === 'abtest')   _populateABSelect();
    document.getElementById(name+'-overlay').classList.add('open');
    if (name === 'rec') runRecommender();
  }
  function closeModal(name) {
    document.getElementById(name+'-overlay').classList.remove('open');
  }

  // ─────────────────────────────────────────────────
  // 1. MODEL RECOMMENDER
  // ─────────────────────────────────────────────────
  function runRecommender() {
    var task    = document.getElementById('rec-task').value;
    var vol     = document.getElementById('rec-vol').value;
    var budget  = parseFloat(document.getElementById('rec-budget').value);
    var latency = document.getElementById('rec-latency').value;
    var ctx     = document.getElementById('rec-ctx').value;
    var eco     = document.getElementById('rec-eco').value;
    var models  = STATE.getModels().slice(0, 200);

    // Score each model on 6 dimensions (0–100 each)
    var ctxMin = {small:0, medium:16000, large:128000}[ctx];
    var qualified = models.filter(function(m){ return m.context_length >= ctxMin; });

    // Estimate monthly cost for this volume
    var runsPerMonth = {low:20000, medium:2000000, high:60000000, massive:500000000}[vol];
    var avgIn = 500, avgOut = 300;
    if (task==='writing'||task==='analysis') { avgIn=300; avgOut=800; }
    if (task==='code') { avgIn=400; avgOut=600; }
    if (task==='rag')  { avgIn=2000; avgOut=300; }

    qualified = qualified.filter(function(m){
      var monthly = CALC.cost(m, avgIn, avgOut) * runsPerMonth;
      return monthly <= budget;
    });
    if (!qualified.length) qualified = models.slice(0,20); // relax if too tight

    // Task affinity weights
    var taskAffinity = {
      code:    function(id){ return /gpt-4o|claude|codestral|deepseek|mistral|llama/.test(id)?85:/gemini|grok/.test(id)?70:55; },
      chat:    function(id){ return /gpt-4o|claude.*sonnet|gemini.*flash|llama/.test(id)?90:/mini|haiku/.test(id)?80:65; },
      analysis:function(id){ return /o3|o4|claude.*opus|gemini.*pro|deepseek-r1/.test(id)?95:/sonnet|gpt-4o/.test(id)?82:60; },
      writing: function(id){ return /claude.*opus|claude.*sonnet|gpt-4o[^-]|gemini.*pro/.test(id)?92:/mistral-large|llama.*70b/.test(id)?75:60; },
      summary: function(id){ return /haiku|flash|mini|mistral-7b|llama.*8b/.test(id)?90:/sonnet|gpt-4o-mini/.test(id)?85:65; },
      translate:function(id){ return /gpt-4o|gemini|claude.*sonnet/.test(id)?88:/llama/.test(id)?70:60; },
      rag:     function(id){ return /gemini.*1\.5|claude.*opus|gpt-4o[^-]/.test(id)?90:/sonnet|llama.*70b/.test(id)?80:60; },
      vision:  function(id){ return /gpt-4o[^-]|claude.*opus|gemini.*pro|grok.*vision/.test(id)?90:50; },
    };

    function scoreModel(m) {
      var id = m.id.toLowerCase();
      var tps = CHARTS.getTPS(m.id);
      // 1. Cost efficiency (0–100)
      var monthly = CALC.cost(m, avgIn, avgOut) * runsPerMonth;
      var costScore = Math.max(0, 100 - (monthly/budget)*60);
      // 2. Speed (0–100)
      var speedScore = latency==='fast' ? Math.min(100,tps/90*100) :
                       latency==='slow' ? 100 : Math.min(100,tps/50*100);
      // 3. Task affinity (0–100)
      var taskScore = (taskAffinity[task]||taskAffinity['chat'])(id);
      // 4. Context (0–100)
      var ctxScore = ctx==='large' ? Math.min(100,(m.context_length/2000000)*100) :
                     ctx==='medium'? Math.min(100,(m.context_length/200000)*100) : 100;
      // 5. Eco (0–100): lower CO2 = higher score
      var co2 = DATA.getCO2Rate(m.id);
      var ecoScore = eco==='high' ? Math.max(0,100-(co2/1000)*80) :
                     eco==='medium'? Math.max(0,100-(co2/2000)*60) : 75;
      // 6. Reliability proxy: known frontier models get boost
      var relScore = /gpt-4o|claude|gemini.*pro|llama.*70b|mistral-large|grok-3/.test(id) ? 85 : 65;
      // Weighted total
      var weights = {cost:0.28, speed:0.18, task:0.25, ctx:0.10, eco:0.09, rel:0.10};
      return costScore*weights.cost + speedScore*weights.speed + taskScore*weights.task
           + ctxScore*weights.ctx + ecoScore*weights.eco + relScore*weights.rel;
    }

    var scored = qualified.map(function(m){ return {m:m, score:scoreModel(m)}; });
    scored.sort(function(a,b){ return b.score-a.score; });
    var top3 = scored.slice(0,3);

    var rows = top3.map(function(item,i){
      var m = item.m; var sc = Math.min(100,item.score).toFixed(0);
      var sname = m.name || m.id.split('/').pop();
      var tps = CHARTS.getTPS(m.id);
      var monthly = CALC.cost(m, avgIn, avgOut) * runsPerMonth;
      var co2pm = DATA.getCO2Rate(m.id) * (avgIn+avgOut)/1e6 * runsPerMonth;
      var meta = ['~'+tps+' tok/s', Math.round(m.context_length/1000)+'K context'];
      if (tps >= 70) meta.push('fast');
      if (monthly < budget*0.3) meta.push(Math.round((1-monthly/budget)*100)+'% under budget');
      if (DATA.getCO2Rate(m.id) < 200) meta.push('low CO₂');
      return {
        cls: i === 0 ? 'best' : '',
        w: sc/100,
        sort: [i+1, sname, sc, monthly, co2pm],
        cells: [
          '<span class="mute">'+(i+1)+'</span>',
          '<div class="wrap-cell"><div class="tl-name hl">'+esc(sname)+'</div><div class="tl-meta">'+esc(meta.join(' · '))+'</div></div>',
          '<span class="hl">'+sc+'</span><span class="mute"> / 100</span>',
          CALC.fmtCost(monthly)+'<span class="mute">/mo</span>',
          co2pm.toFixed(1)+'<span class="mute"> g/mo</span>'
        ]
      };
    });
    if (!rows.length) { setEl('rec-results', TLUI.empty('No models match these constraints. Loosen the budget or context window.')); return; }
    setEl('rec-results',
      '<div class="tl-block-head"><div><h3 class="tl-h">Best fit</h3><p class="tl-sub">Scored on cost, speed, task fit, context, CO₂ and reliability.</p></div>'
      + '<button type="button" class="tl-btn secondary sm" onclick="V6.copyRecommendation()"><span class="ic" data-icon="copy"></span>Copy</button></div>'
      + TLUI.ledger({
          label: 'Recommended models',
          cols: '24px minmax(0,1fr) 84px 96px 88px', colsSm: '20px minmax(0,1fr) 64px 80px',
          min: 0,
          head: [{label:'#'}, {label:'Model', sort:true}, {label:'Score', num:true, sort:true}, {label:'Est. cost', num:true, sort:true}, {label:'CO₂', num:true, cls:'hide-sm', sort:true}],
          rows: rows
        }));
    _recText = top3.map(function(it,i){ return (i+1)+'. '+(it.m.name||it.m.id)+' ('+Math.min(100,it.score).toFixed(0)+'/100)'; }).join('\n');
    if (window.TL_HYDRATE_ICONS) TL_HYDRATE_ICONS(document.getElementById('rec-results'));
  }
  var _recText = '';
  function copyRecommendation() { if (_recText) TLUI.copy('Model recommendation\n' + _recText, 'Recommendation copied.'); }

  // ─────────────────────────────────────────────────
  // 2. PROMPT OPTIMIZER
  // ─────────────────────────────────────────────────
  var _optimizerRules = [
    // Remove filler openers
    [/^(please\s+|kindly\s+|could you\s+|i would like you to\s+|i want you to\s+|can you\s+|i need you to\s+)/i, ''],
    // Remove trailing politeness
    [/(\s*thank you[\.,!]?\s*)$/i, ''],
    [/(\s*please\s+and\s+thank\s*you[\.,!]?\s*)$/i, ''],
    // Compress "in order to" → "to"
    [/\bin order to\b/gi, 'to'],
    // "due to the fact that" → "because"
    [/\bdue to the fact that\b/gi, 'because'],
    // "at this point in time" → "now"
    [/\bat this point in time\b/gi, 'now'],
    // "in the event that" → "if"
    [/\bin the event that\b/gi, 'if'],
    // "make sure to" → ensure
    [/\bmake sure to\b/gi, 'ensure'],
    // "it is important to note that" → Note:
    [/\bit is important to note that\b/gi, 'Note:'],
    // "it should be noted that" → Note:
    [/\bit should be noted that\b/gi, 'Note:'],
    // "as mentioned previously" → (remove)
    [/\bas mentioned (previously|above|before)\b[,.]?\s*/gi, ''],
    // "with regard to" → "regarding"
    [/\bwith regard to\b/gi, 'regarding'],
    // "in terms of" → "for"
    [/\bin terms of\b/gi, 'for'],
    // "a large number of" → "many"
    [/\ba large number of\b/gi, 'many'],
    // "the majority of" → "most"
    [/\bthe majority of\b/gi, 'most'],
    // "at the present time" → "currently"
    [/\bat the present time\b/gi, 'currently'],
    // collapse multiple spaces/newlines
    [/[ \t]{2,}/g, ' '],
    [/\n{3,}/g, '\n\n'],
  ];

  function _optReset() {
    var res = document.getElementById('opt-result'); if (res) res.value = '';
    setEl('opt-stats-wrap', '');
    setEl('opt-model-savings', TLUI.empty('Paste a prompt above to see the shorter version and what it saves.'));
  }

  function runOptimizer() {
    var original = (document.getElementById('opt-original')||{}).value||'';
    if (!original.trim()) { _optReset(); return; }
    var optimized = original;
    _optimizerRules.forEach(function(rule){ optimized = optimized.replace(rule[0], rule[1]); });
    optimized = optimized.trim();
    var origTok = TOKEN_ENGINE.count(original);
    var optTok  = TOKEN_ENGINE.count(optimized);
    var saving  = origTok - optTok;
    var pct     = origTok > 0 ? ((saving/origTok)*100).toFixed(1) : 0;
    var res = document.getElementById('opt-result');
    if (res) res.value = optimized;
    setEl('opt-stats-wrap', TLUI.kpis([
      ['Original', origTok.toLocaleString() + ' tokens', {sub: original.length.toLocaleString() + ' characters'}],
      ['Optimized', optTok.toLocaleString() + ' tokens', {sub: optimized.length.toLocaleString() + ' characters'}],
      ['Saved', saving > 0 ? saving.toLocaleString() + ' tokens' : 'None', {tone: saving > 0 ? 'pos' : '', sub: saving > 0 ? pct + '% shorter' : 'Already tight, nothing to trim'}]
    ]));
    var models = STATE.getActiveModels();
    if (models.length) {
      var data = models.map(function(m){
        var origCost = CALC.cost(m, origTok, TOKEN_ENGINE.predictOutput(original));
        var optCost  = CALC.cost(m, optTok,  TOKEN_ENGINE.predictOutput(optimized));
        return {m: m, o: origCost, n: optCost, saved: origCost - optCost};
      });
      var maxSaved = Math.max.apply(null, data.map(function(d){ return Math.abs(d.saved); }).concat([1e-12]));
      var rows = data.map(function(d){
        var sname = d.m.name||d.m.id.split('/').pop();
        return {
          w: Math.abs(d.saved)/maxSaved,
          sort: [sname, d.o, d.n, d.saved],
          cells: ['<span class="tl-name">'+esc(sname)+'</span>', CALC.fmtCost(d.o), CALC.fmtCost(d.n), '<span class="hl">'+CALC.fmtCost(d.saved)+'</span> <span class="mute">('+pct+'%)</span>']
        };
      });
      setEl('opt-model-savings',
        '<div class="tl-block-head"><div><h3 class="tl-h">Savings per call</h3><p class="tl-sub">Priced for each active model at its current rates.</p></div></div>'
        + TLUI.ledger({
            label: 'Savings per model', cols: 'minmax(0,1fr) 96px 96px 150px', colsSm: 'minmax(0,1fr) 84px 110px', min: 0,
            head: [{label:'Model', sort:true}, {label:'Original', num:true, sort:true, cls:'hide-sm'}, {label:'Optimized', num:true, sort:true}, {label:'Saved', num:true, sort:true}],
            rows: rows
          }));
    } else {
      setEl('opt-model-savings', TLUI.empty('Select models in the sidebar to see per-model savings.'));
    }
  }
  var liveOptimize = TLUI.debounce(runOptimizer, 200);
  function copyOptimized() {
    var v = (document.getElementById('opt-result')||{}).value||'';
    if (!v) { TOAST.warning('Optimize a prompt first.'); return; }
    TLUI.copy(v, 'Optimized prompt copied.');
  }
  function useOptimized() {
    var v = (document.getElementById('opt-result')||{}).value||'';
    var ta = document.getElementById('prompt-input');
    if (!v || !ta) { TOAST.warning('Optimize a prompt first.'); return; }
    ta.value = v;
    ta.dispatchEvent(new Event('input'));
    closeModal('optimizer');
    TOAST.success('Optimized prompt is in the prompt box.');
  }

  // ─────────────────────────────────────────────────
  // 3. MULTI-TURN SCENARIO BUILDER
  // ─────────────────────────────────────────────────
  var _scenarioTurns = [
    'Hello, what can you help me with today?',
    'Can you explain your pricing structure?',
    'What are the limitations of your service?',
    'How do I get started with the API?',
    'Thank you, that was very helpful.',
  ];

  function _populateScenarioSelects() {
    var models = STATE.getModels().slice(0,60);
    var opts = '<option value="">Select a model</option>'
      + models.map(function(m){ return '<option value="'+esc(m.id)+'">'+esc(m.name||m.id.split('/').pop())+'</option>'; }).join('');
    ['scenario-model-a','scenario-model-b','scenario-model-c'].forEach(function(id,i){
      var el = document.getElementById(id); if (!el) return;
      el.innerHTML = i === 0 ? opts : opts.replace('Select a model', 'None');
      if (i===0 && models[0]) el.value = models[0].id;
      if (i===1 && models[1]) el.value = models[1].id;
    });
    _renderScenarioTurns();
    runScenario(true);
  }

  function _renderScenarioTurns() {
    var list = document.getElementById('scenario-turns-list'); if (!list) return;
    list.innerHTML = _scenarioTurns.map(function(t,i){
      return '<div class="scenario-turn-item">'
        +'<span class="scenario-turn-num">'+(i+1)+'</span>'
        +'<textarea class="scenario-turn-input" rows="2" aria-label="Turn '+(i+1)+'" oninput="V6.scenarioUpdateTurn('+i+',this.value)">'+esc(t)+'</textarea>'
        +'<button type="button" class="tl-icon-btn danger scenario-turn-del" onclick="V6.scenarioRemoveTurn('+i+')" title="Remove turn" aria-label="Remove turn '+(i+1)+'">'+window.TL_ICON('x')+'</button>'
        +'</div>';
    }).join('');
  }

  function scenarioAddTurn() {
    _scenarioTurns.push('New turn: describe what the user says here.');
    _renderScenarioTurns();
    scenarioRefresh();
    var items = document.querySelectorAll('.scenario-turn-input');
    if (items.length) items[items.length-1].focus();
  }
  function scenarioRemoveTurn(i) {
    _scenarioTurns.splice(i,1);
    _renderScenarioTurns();
    scenarioRefresh();
  }
  var _scenarioLive = TLUI.debounce(function(){ scenarioRefresh(); }, 250);
  function scenarioUpdateTurn(i,v) { _scenarioTurns[i]=v; _scenarioLive(); }
  var _scenarioRan = false, _scenarioText = '';
  function scenarioRefresh() { if (_scenarioRan) runScenario(true); }

  function runScenario(quiet) {
    var modelIds = ['scenario-model-a','scenario-model-b','scenario-model-c']
      .map(function(id){ return (document.getElementById(id)||{}).value; })
      .filter(Boolean);
    var copyBtn = document.getElementById('scenario-copy');
    if (!modelIds.length) {
      if (quiet !== true) TOAST.warning('Select at least one model in the Scenario Builder.');
      setEl('scenario-results', TLUI.empty('Choose a model and select Project costs.'));
      if (copyBtn) copyBtn.hidden = true;
      _scenarioRan = false;
      return;
    }
    var models = modelIds.map(function(id){ return STATE.getModels().find(function(m){return m.id===id;}); }).filter(Boolean);
    var turns = _scenarioTurns.filter(function(t){return t.trim();});
    if (!turns.length) {
      setEl('scenario-results', TLUI.empty('Add at least one turn with some text.'));
      if (copyBtn) copyBtn.hidden = true;
      return;
    }
    _scenarioRan = true;
    var text = [];

    var results = models.map(function(m){
      var ctx=0, totalCost=0, totalIn=0, totalOut=0, totalPower=0, rows=[];
      turns.forEach(function(prompt,i){
        var pTok = TOKEN_ENGINE.count(prompt);
        var inTok = ctx + pTok;
        var outTok = TOKEN_ENGINE.predictOutput(prompt);
        var c = CALC.cost(m, inTok, outTok);
        var pw = CALC.power(m.id, inTok, outTok);
        ctx += pTok + outTok;
        totalCost += c; totalIn += inTok; totalOut += outTok; totalPower += pw;
        rows.push({ctx: ctx, cells: [String(i+1), esc(prompt.slice(0,60)), inTok.toLocaleString(), outTok.toLocaleString(), CALC.fmtCost(c), ctx.toLocaleString()]});
      });
      var maxCtx = ctx || 1;
      rows.forEach(function(r){ r.w = r.ctx / maxCtx; r.cells[1] = '<span class="tl-name">'+r.cells[1]+'</span>'; r.cells[0] = '<span class="mute">'+r.cells[0]+'</span>'; });
      var sname = m.name || m.id.split('/').pop();
      text.push(sname + ': ' + CALC.fmtCost(totalCost) + ' total, ' + totalIn.toLocaleString() + ' input and ' + totalOut.toLocaleString() + ' output tokens');
      return '<div class="scenario-model">'
        + '<h4 class="tl-h">'+esc(sname)+'</h4>'
        + TLUI.kpis([
            ['Total cost', CALC.fmtCost(totalCost), {money:true}],
            ['Input tokens', totalIn.toLocaleString()],
            ['Output tokens', totalOut.toLocaleString()],
            ['Power', CALC.fmtPower(totalPower)]
          ])
        + TLUI.ledger({
            label: 'Turns for '+sname, cols: '28px minmax(0,1fr) 84px 84px 96px 92px', colsSm: '24px minmax(0,1fr) 64px 88px', min: 0,
            head: [{label:'#'}, {label:'Prompt'}, {label:'Input', num:true, cls:'hide-sm'}, {label:'Output', num:true, cls:'hide-sm'}, {label:'Cost', num:true}, {label:'Context', num:true}],
            rows: rows
          })
        + '</div>';
    });
    _scenarioText = 'Scenario projection (' + turns.length + ' turns)\n' + text.join('\n');
    setEl('scenario-results', '<div class="tl-stagger">' + results.join('') + '</div>');
    if (copyBtn) copyBtn.hidden = false;
  }
  function copyScenario() { if (_scenarioText) TLUI.copy(_scenarioText, 'Projection copied.'); }

  // ─────────────────────────────────────────────────
  // 4. A/B TEST MODE
  // ─────────────────────────────────────────────────
  function _populateABSelect() {
    var models = STATE.getModels().slice(0,60);
    var opts = '<option value="">Select a model</option>'
      + models.map(function(m){ return '<option value="'+esc(m.id)+'">'+esc(m.name||m.id.split('/').pop())+'</option>'; }).join('');
    var el = document.getElementById('ab-model'); if (el) { el.innerHTML=opts; if(models[0]) el.value=models[0].id; }
    setEl('ab-results', TLUI.empty('Pick a model and a prompt, then run the test.'));
  }

  function runABTest() {
    var modelId = (document.getElementById('ab-model')||{}).value;
    var runs    = parseInt((document.getElementById('ab-runs')||{}).value||5);
    var prompt  = (document.getElementById('ab-prompt')||{}).value||'';
    if (!modelId || !prompt.trim()) { TOAST.warning('Select a model and enter a prompt to run the A/B test.'); return; }
    var m = STATE.getModels().find(function(x){return x.id===modelId;});
    if (!m) return;
    var sname = m.name||m.id.split('/').pop();
    var inTok = TOKEN_ENGINE.count(prompt);
    // Simulate N runs with slight output variance (realistic simulation)
    var baseOut = TOKEN_ENGINE.predictOutput(prompt);
    var tps = CHARTS.getTPS(modelId);
    var runData = [];
    for (var i=0; i<runs; i++) {
      // Add ±15% natural variance to output length
      var variance = 0.85 + Math.random()*0.3;
      var outTok = Math.round(baseOut * variance);
      var c = CALC.cost(m, inTok, outTok);
      var eta = (outTok/tps).toFixed(1);
      var resp = API.simulateResponse(modelId, prompt);
      runData.push({outTok:outTok, cost:c, eta:eta, resp:resp});
    }
    var outToks = runData.map(function(r){return r.outTok;});
    var costs   = runData.map(function(r){return r.cost;});
    var avgOut  = (outToks.reduce(function(a,b){return a+b;},0)/runs).toFixed(0);
    var stdDev  = Math.sqrt(outToks.map(function(v){return Math.pow(v-avgOut,2);}).reduce(function(a,b){return a+b;},0)/runs).toFixed(0);
    var minOut  = Math.min.apply(null,outToks);
    var maxOut  = Math.max.apply(null,outToks);
    var avgCost = costs.reduce(function(a,b){return a+b;},0)/runs;
    var cv = avgOut > 0 ? (stdDev/avgOut*100).toFixed(1) : '0'; // coefficient of variation
    var cvn = parseFloat(cv);
    var rating = cvn<5 ? TLUI.pill('Stable','positive') : cvn<15 ? TLUI.pill('Moderate','warning') : TLUI.pill('High variance','negative');

    var summaryHtml = TLUI.kpis([
      ['Average output', avgOut + ' tokens', {sub: 'Range ' + minOut + ' to ' + maxOut}],
      ['Standard deviation', stdDev + ' tokens'],
      ['Variance (CV)', cv + '%', {sub: 'Consistency: ' + rating}],
      ['Average cost per run', CALC.fmtCost(avgCost), {money:true}]
    ]);

    var runRows = runData.map(function(r,i){
      return '<div class="ab-run">'
        +'<button type="button" class="tl-row ab-run-head" style="--cols:28px minmax(0,1fr) 84px 96px 72px 20px;--i:'+i+'" aria-expanded="false" aria-controls="ab-run-'+i+'" onclick="V6.toggleRun(this)">'
          +'<span class="tl-cell mute">'+(i+1)+'</span>'
          +'<span class="tl-cell tl-name">'+esc(r.resp.slice(0,70))+'</span>'
          +'<span class="tl-cell num">'+r.outTok+' tok</span>'
          +'<span class="tl-cell num">'+CALC.fmtCost(r.cost)+'</span>'
          +'<span class="tl-cell num mute">~'+r.eta+'s</span>'
          +'<span class="tl-cell ab-chev">'+window.TL_ICON('chevronDown')+'</span>'
        +'</button>'
        +'<div class="tl-collapse" id="ab-run-'+i+'"><div><p class="ab-run-body">'+esc(r.resp)+'</p></div></div>'
      +'</div>';
    }).join('');

    setEl('ab-results',
      '<div class="tl-block-head"><div><h3 class="tl-h">'+runs+' runs on '+esc(sname)+'</h3><p class="tl-sub">Output length per run. Bars flagged in red sit more than 1.5 standard deviations from the average.</p></div></div>'
      + summaryHtml
      + '<div class="tl-chart" id="ab-chart" style="margin-top:20px"></div>'
      + '<div class="tl-block"><div class="tl-block-head"><div><h3 class="tl-h">Responses</h3><p class="tl-sub">Select a run to read its simulated response.</p></div></div>'
      + '<div class="ab-runs tl-stagger" role="list">' + runRows + '</div></div>');
    TLUI.barChart(document.getElementById('ab-chart'), {
      label: 'Output tokens per run',
      labels: outToks.map(function(v,i){ return 'Run '+(i+1); }),
      values: outToks,
      flags: outToks.map(function(v){ return Math.abs(v-avgOut)>stdDev*1.5; }),
      avg: parseFloat(avgOut),
      seriesName: 'Output tokens',
      fmtY: function(v){ return String(Math.round(v)); },
      extra: function(i){ return [{name:'Cost', value: CALC.fmtCost(runData[i].cost), tone:'grey'}]; }
    });
    TLUI.countUp(document.getElementById('ab-results'));
  }
  function toggleRun(btn) {
    var open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
    var panel = document.getElementById(btn.getAttribute('aria-controls'));
    if (panel) panel.classList.toggle('open', open);
  }

  return {openModal, closeModal, runRecommender, copyRecommendation, runOptimizer, liveOptimize, copyOptimized, useOptimized,
          runScenario, scenarioRefresh, copyScenario, scenarioAddTurn, scenarioRemoveTurn, scenarioUpdateTurn, runABTest, toggleRun};
})();
