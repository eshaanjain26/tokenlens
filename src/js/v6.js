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

    var rankMeta = ['top','second','third'];
    var rankEmoji = ['🥇','🥈','🥉'];
    var html = top3.map(function(item,i){
      var m = item.m; var sc = Math.min(100,item.score).toFixed(0);
      var sname = m.name || m.id.split('/').pop();
      var tps = CHARTS.getTPS(m.id);
      var monthly = CALC.cost(m, avgIn, avgOut) * runsPerMonth;
      var co2pm = DATA.getCO2Rate(m.id) * (avgIn+avgOut)/1e6 * runsPerMonth;
      var reasons = [];
      if (tps >= 70) reasons.push('⚡ Fast ('+tps+'tk/s)');
      if (monthly < budget*0.3) reasons.push('💰 '+Math.round((1-monthly/budget)*100)+'% under budget');
      if (m.context_length >= 200000) reasons.push('📏 Large context ('+Math.round(m.context_length/1000)+'K)');
      if (DATA.getCO2Rate(m.id) < 200) reasons.push('🌱 Low CO₂ ('+DATA.getCO2Rate(m.id).toFixed(0)+'g/1M)');
      return '<div class="rec-card '+rankMeta[i]+'">'
        +'<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">'
          +'<span class="rec-rank">'+rankEmoji[i]+'</span>'
          +'<span class="rec-model-name">'+esc(sname)+'</span>'
          +'<span style="margin-left:auto;font-size:12px;font-weight:900;color:var(--tl)">'+sc+'/100</span>'
        +'</div>'
        +'<div class="rec-score-bar-wrap">'
          +'<div class="rec-score-bar"><div class="rec-score-fill" style="width:'+sc+'%;background:'+(i===0?'var(--tl)':i===1?'var(--blue)':'var(--green)')+'"></div></div>'
        +'</div>'
        +'<div class="rec-dims">'
          +'<span class="rec-dim">💰 ~'+CALC.fmtCost(monthly)+'/mo</span>'
          +'<span class="rec-dim">⚡ ~'+tps+'tk/s</span>'
          +'<span class="rec-dim">📏 '+Math.round(m.context_length/1000)+'K ctx</span>'
          +'<span class="rec-dim">🌱 '+co2pm.toFixed(1)+'g CO₂/mo</span>'
        +'</div>'
        +(reasons.length ? '<div class="rec-reason">Why: '+reasons.join(' · ')+'</div>' : '')
      +'</div>';
    }).join('');
    setEl('rec-results', html || '<em style="color:var(--text-3);font-size:12px">No matching models found for these constraints.</em>');
  }

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

  function runOptimizer() {
    var original = (document.getElementById('opt-original')||{}).value||'';
    if (!original.trim()) return;
    var optimized = original;
    _optimizerRules.forEach(function(rule){ optimized = optimized.replace(rule[0], rule[1]); });
    optimized = optimized.trim();
    var origTok = TOKEN_ENGINE.count(original);
    var optTok  = TOKEN_ENGINE.count(optimized);
    var saving  = origTok - optTok;
    var pct     = origTok > 0 ? ((saving/origTok)*100).toFixed(1) : 0;
    var res = document.getElementById('opt-result');
    if (res) res.value = optimized;
    setEl('opt-orig-stats', '<span class="opt-stat-chip" style="background:var(--red-bg);color:var(--red)">'+origTok.toLocaleString()+' tokens</span>'
      +'<span class="opt-stat-chip" style="background:var(--bg);color:var(--text-2)">'+original.length+' chars</span>');
    setEl('opt-result-stats', '<span class="opt-stat-chip" style="background:var(--green-bg);color:var(--green)">'+optTok.toLocaleString()+' tokens</span>'
      +'<span class="opt-stat-chip" style="background:var(--bg);color:var(--text-2)">'+optimized.length+' chars</span>');
    setEl('opt-savings', saving>0 ? '✂️ Saved '+saving+' tokens ('+pct+'% reduction)' : 'Already well optimized!');
    // Show per-model savings table
    var models = STATE.getActiveModels();
    if (models.length) {
      var rows = models.map(function(m){
        var origCost = CALC.cost(m, origTok, TOKEN_ENGINE.predictOutput(original));
        var optCost  = CALC.cost(m, optTok,  TOKEN_ENGINE.predictOutput(optimized));
        var saved = origCost - optCost;
        var sname = m.name||m.id.split('/').pop();
        return '<tr><td><strong>'+esc(sname)+'</strong></td>'
          +'<td>'+CALC.fmtCost(origCost)+'</td><td>'+CALC.fmtCost(optCost)+'</td>'
          +'<td style="color:var(--green);font-weight:700">'+CALC.fmtCost(saved)+' ('+pct+'%)</td></tr>';
      }).join('');
      setEl('opt-model-savings',
        '<table class="bench-table"><thead><tr><th>Model</th><th>Original cost/call</th><th>Optimized cost/call</th><th>Savings/call</th></tr></thead><tbody>'+rows+'</tbody></table>');
    } else {
      setEl('opt-model-savings', '<p style="font-size:11px;color:var(--text-3)">Select models in the sidebar to see per-model savings.</p>');
    }
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
    var opts = '<option value="">— select model —</option>'
      + models.map(function(m){ return '<option value="'+esc(m.id)+'">'+(m.name||m.id.split('/').pop())+'</option>'; }).join('');
    ['scenario-model-a','scenario-model-b','scenario-model-c'].forEach(function(id,i){
      var el = document.getElementById(id); if (!el) return;
      el.innerHTML = opts;
      if (i===0 && models[0]) el.value = models[0].id;
      if (i===1 && models[1]) el.value = models[1].id;
    });
    _renderScenarioTurns();
  }

  function _renderScenarioTurns() {
    var list = document.getElementById('scenario-turns-list'); if (!list) return;
    list.innerHTML = _scenarioTurns.map(function(t,i){
      return '<div class="scenario-turn-item">'
        +'<span class="scenario-turn-num">T'+(i+1)+'</span>'
        +'<textarea class="scenario-turn-input" rows="2" onchange="V6.scenarioUpdateTurn('+i+',this.value)">'+esc(t)+'</textarea>'
        +'<button class="scenario-turn-del" onclick="V6.scenarioRemoveTurn('+i+')" title="Remove">✕</button>'
        +'</div>';
    }).join('');
  }

  function scenarioAddTurn() {
    _scenarioTurns.push('New turn — describe what the user says here.');
    _renderScenarioTurns();
  }
  function scenarioRemoveTurn(i) {
    _scenarioTurns.splice(i,1);
    _renderScenarioTurns();
  }
  function scenarioUpdateTurn(i,v) { _scenarioTurns[i]=v; }

  function runScenario() {
    var modelIds = ['scenario-model-a','scenario-model-b','scenario-model-c']
      .map(function(id){ return (document.getElementById(id)||{}).value; })
      .filter(Boolean);
    if (!modelIds.length) { TOAST.warning('Select at least one model in the Scenario Builder.'); return; }
    var models = modelIds.map(function(id){ return STATE.getModels().find(function(m){return m.id===id;}); }).filter(Boolean);
    var turns = _scenarioTurns.filter(function(t){return t.trim();});

    var results = models.map(function(m){
      var ctx=0, totalCost=0, totalIn=0, totalOut=0, totalPower=0, rows='';
      turns.forEach(function(prompt,i){
        var pTok = TOKEN_ENGINE.count(prompt);
        var inTok = ctx + pTok;
        var outTok = TOKEN_ENGINE.predictOutput(prompt);
        var c = CALC.cost(m, inTok, outTok);
        var pw = CALC.power(m.id, inTok, outTok);
        ctx += pTok + outTok;
        totalCost += c; totalIn += inTok; totalOut += outTok; totalPower += pw;
        rows += '<tr><td>T'+(i+1)+'</td>'
          +'<td style="font-size:10px;max-width:180px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">'+esc(prompt.slice(0,60))+'</td>'
          +'<td>'+inTok.toLocaleString()+'</td><td>'+outTok.toLocaleString()+'</td>'
          +'<td>'+CALC.fmtCost(c)+'</td><td>'+ctx.toLocaleString()+'</td></tr>';
      });
      var sname = m.name || m.id.split('/').pop();
      return '<div style="margin-bottom:16px">'
        +'<div style="font-size:12px;font-weight:900;color:var(--tl);margin-bottom:6px">'+esc(sname)+'</div>'
        +'<table class="scenario-result-table"><thead><tr><th>#</th><th>Prompt (truncated)</th><th>Input tok</th><th>Output tok</th><th>Cost</th><th>Ctx total</th></tr></thead>'
        +'<tbody>'+rows+'</tbody></table>'
        +'<div style="margin-top:7px;display:flex;gap:12px;font-size:11px;flex-wrap:wrap">'
          +'<span style="font-weight:700">Total: '+CALC.fmtCost(totalCost)+'</span>'
          +'<span>In: '+totalIn.toLocaleString()+'</span>'
          +'<span>Out: '+totalOut.toLocaleString()+'</span>'
          +'<span>Power: '+CALC.fmtPower(totalPower)+'</span>'
        +'</div>'
      +'</div>';
    });
    setEl('scenario-results', results.join('<hr style="border:none;border-top:1px solid var(--border);margin:12px 0">'));
  }

  // ─────────────────────────────────────────────────
  // 4. A/B TEST MODE
  // ─────────────────────────────────────────────────
  function _populateABSelect() {
    var models = STATE.getModels().slice(0,60);
    var opts = '<option value="">— select model —</option>'
      + models.map(function(m){ return '<option value="'+esc(m.id)+'">'+(m.name||m.id.split('/').pop())+'</option>'; }).join('');
    var el = document.getElementById('ab-model'); if (el) { el.innerHTML=opts; if(models[0]) el.value=models[0].id; }
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

    var summaryHtml = '<div class="ab-summary">'
      +'<div class="ab-sum-card"><div class="asv">'+avgOut+'</div><div class="asl">Avg output tokens</div></div>'
      +'<div class="ab-sum-card"><div class="asv">'+stdDev+'</div><div class="asl">Std deviation (tokens)</div></div>'
      +'<div class="ab-sum-card"><div class="asv">'+cv+'%</div><div class="asl">Output variance (CV)</div></div>'
      +'<div class="ab-sum-card"><div class="asv">'+CALC.fmtCost(avgCost)+'</div><div class="asl">Avg cost / run</div></div>'
      +'<div class="ab-sum-card"><div class="asv">'+minOut+'–'+maxOut+'</div><div class="asl">Output token range</div></div>'
      +'<div class="ab-sum-card"><div class="asv">'+(parseFloat(cv)<5?'🟢 Stable':parseFloat(cv)<15?'🟡 Moderate':'🔴 High')+'</div><div class="asl">Consistency rating</div></div>'
      +'</div>';

    // Variance bar chart (SVG)
    var W=500,H=80,pl=40,pr=10,pt=10,pb=24;
    var iw=W-pl-pr,ih=H-pt-pb;
    var maxV=Math.max.apply(null,outToks)||1;
    var barW=iw/runs*0.65, gap=iw/runs;
    var bars='',xLabels='';
    outToks.forEach(function(v,i){
      var bh=Math.max(2,(v/maxV)*ih);
      var bx=pl+i*gap+gap*0.175;
      var by=pt+ih-bh;
      var color=Math.abs(v-avgOut)>stdDev*1.5?'var(--red)':'var(--tl)';
      bars+='<rect x="'+bx.toFixed(1)+'" y="'+by.toFixed(1)+'" width="'+barW.toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+color+'" rx="2" opacity="0.8"/>';
      xLabels+='<text x="'+(pl+i*gap+gap/2).toFixed(1)+'" y="'+(H-pb+12)+'" text-anchor="middle" font-size="9" fill="#888">R'+(i+1)+'</text>';
    });
    // avg line
    var avgY=(pt+ih-(avgOut/maxV)*ih).toFixed(1);
    var svgHtml='<svg width="'+W+'" height="'+H+'" style="max-width:100%;display:block;margin-bottom:10px">'
      +'<text x="'+pl+'" y="9" font-size="9" fill="#888">Output tokens per run (red = outlier > 1.5σ)</text>'
      +'<line x1="'+pl+'" y1="'+avgY+'" x2="'+(W-pr)+'" y2="'+avgY+'" stroke="var(--blue)" stroke-dasharray="4,3" stroke-width="1.5"/>'
      +'<text x="'+(W-pr-2)+'" y="'+(parseFloat(avgY)-3)+'" text-anchor="end" font-size="8" fill="var(--blue)">avg</text>'
      +bars+xLabels+'</svg>';

    var runCards = '<div class="ab-results-grid">'
      +runData.map(function(r,i){
        return '<div class="ab-run-card">'
          +'<div class="ab-run-card-head">'
            +'<span class="ab-run-card-title">Run '+(i+1)+'</span>'
            +'<span style="font-size:10px;color:var(--text-3)">'+r.outTok+' tok · '+CALC.fmtCost(r.cost)+' · ~'+r.eta+'s</span>'
          +'</div>'
          +'<div class="ab-run-body">'+esc(r.resp.slice(0,220))+(r.resp.length>220?'…':'')+'</div>'
        +'</div>';
      }).join('')+'</div>';

    setEl('ab-results',
      '<div style="font-size:12px;font-weight:900;color:var(--tl);margin-bottom:10px">'+runs+' runs · '+esc(sname)+'</div>'
      +summaryHtml+svgHtml+runCards);
  }

  return {openModal, closeModal, runRecommender, runOptimizer, runScenario, scenarioAddTurn, scenarioRemoveTurn, scenarioUpdateTurn, runABTest};
})();


