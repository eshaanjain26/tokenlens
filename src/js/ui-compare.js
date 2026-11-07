/* ══════════════════════════════════════════════════════════
   MODULE 7 — UI_COMPARE
   Column builder, turn cards, live preview, send prompt
   ══════════════════════════════════════════════════════════ */
window.UI_COMPARE = (function() {

  var _colEls = {};

  function cid(modelId) { return 'col-'+modelId.replace(/[/]/g,'-'); }
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function setEl(id, v) { var e=document.getElementById(id); if(e) e.textContent=v; }

  function renderAll() {
    var area   = document.getElementById('columns-area');
    var models = STATE.getActiveModels();
    if (!models.length) {
      area.innerHTML='<div class="no-models-msg"><div class="big">🤖</div><h3>Select models from the sidebar</h3><p style="font-size:13px">Choose up to 10 models to compare side-by-side</p></div>';
      _colEls = {};
      return;
    }
    var placeholder = area.querySelector('.no-models-msg');
    if (placeholder) placeholder.remove();
    Object.keys(_colEls).forEach(function(id) {
      if (!STATE.isActive(id)) {
        var el = document.getElementById(cid(id));
        if (el) el.remove();
        delete _colEls[id];
      }
    });
    models.forEach(function(m) {
      if (!_colEls[m.id]) {
        var col = buildColumn(m);
        area.appendChild(col);
        _colEls[m.id] = col;
      }
    });
  }

  function buildColumn(model) {
    var g   = CALC.grade(model);
    var ip  = (parseFloat(model.pricing&&model.pricing.prompt||0)*1e6).toFixed(3);
    var op  = (parseFloat(model.pricing&&model.pricing.completion||0)*1e6).toFixed(3);
    var id  = cid(model.id);
    var ctxK= (model.context_length/1000).toFixed(0);
    var col = document.createElement('div');
    col.className='model-col'; col.id=id;
    // Token efficiency score: output tokens per dollar (normalized to 1M out tokens per $1 cost)
    var outPerDollar = (parseFloat(model.pricing&&model.pricing.completion||0) > 0)
      ? (1 / (parseFloat(model.pricing.completion) * 1e6)).toFixed(0) : '∞';
    var tps = CHARTS.getTPS(model.id);
    var gradeIcon = {A:'🟢',B:'🔵',C:'🟡',D:'🟠',F:'🔴'}[g] || '⚪';
    function _gradeTooltip(gr) {
      var tips = {
        A: 'A: Cheapest tier (<$0.30/1M avg) — budget/flash models',
        B: 'B: Economy tier ($0.30–$1/1M avg) — mid-range models',
        C: 'C: Mid-range ($1–$5/1M avg) — capable mid-tier models',
        D: 'D: Premium ($5–$15/1M avg) — frontier-class models',
        F: 'F: Ultra-premium (>$15/1M avg) — top frontier models. Grades compare vs ALL 500+ models globally, not just your session.'
      };
      return tips[gr] || 'Grade vs global model pricing landscape';
    }
    // Provider color dot
    var provColors = { anthropic:'#D4A0FF', openai:'#74AA9C', google:'#4285F4', mistral:'#FF7000', meta:'#0668E1', cohere:'#39594D' };
    var provKey = (model.id||'').toLowerCase().match(/claude|anthropic/) ? 'anthropic' :
                  (model.id||'').toLowerCase().match(/gpt|openai/) ? 'openai' :
                  (model.id||'').toLowerCase().match(/gemini|google/) ? 'google' :
                  (model.id||'').toLowerCase().match(/mistral/) ? 'mistral' :
                  (model.id||'').toLowerCase().match(/llama|meta/) ? 'meta' :
                  (model.id||'').toLowerCase().match(/command|cohere/) ? 'cohere' : 'other';
    var provDotColor = provColors[provKey] || '#9CA3AF';

    col.innerHTML=
      '<div class="col-header">'
        +'<div style="display:flex;align-items:flex-start;justify-content:space-between;gap:8px">'
          +'<div style="flex:1;min-width:0">'
            +'<div style="display:flex;align-items:center;gap:7px;margin-bottom:4px">'
              +'<span style="width:8px;height:8px;border-radius:50%;background:'+provDotColor+';flex-shrink:0;display:inline-block"></span>'
              +'<div class="model-id" style="font-size:13px">'+esc(model.name||model.id)+'</div>'
            +'</div>'
            +'<div class="model-meta" style="font-size:10px;padding-left:15px">'+ctxK+'K ctx · $'+ip+' in · $'+op+' out /1M</div>'
          +'</div>'
          +'<span class="grade-badge '+g+'">'
            +gradeIcon+' '+g
            +'<span class="grade-tip">'+_gradeTooltip(g)+'</span>'
          +'</span>'
        +'</div>'
        +'<div style="display:flex;gap:5px;margin-top:8px;padding-left:15px;flex-wrap:wrap">'
          +'<span style="font-size:10px;font-weight:600;color:var(--ink-3,var(--text-2));background:var(--s2,var(--tl-bg));padding:2px 7px;border-radius:4px">⚡ ~'+tps+'tk/s</span>'
          +'<span style="font-size:10px;font-weight:600;color:var(--ink-3,var(--text-2));background:var(--s2,var(--tl-bg));padding:2px 7px;border-radius:4px">🌱 '+DATA.getCO2Rate(model.id).toFixed(0)+'g/1M</span>'
          +'<span style="font-size:10px;font-weight:600;color:var(--ink-3,var(--text-2));background:var(--s2,var(--tl-bg));padding:2px 7px;border-radius:4px">💎 '+outPerDollar+'K tok/$</span>'
        +'</div>'
      +'</div>'
      +'<div class="ctx-bar-wrap">'
        +'<div class="ctx-bar-label"><span>Context Window</span><span id="'+id+'-ctx-pct">0%</span></div>'
        +'<div class="ctx-bar"><div id="'+id+'-ctx-fill" class="ctx-bar-fill" style="width:0%"></div></div>'
      +'</div>'
      +'<div class="sparkline-wrap">'
        +'<div class="sparkline-label">📈 Input tokens per turn (grows with context accumulation)</div>'
        +'<div id="'+id+'-spark">'+CHARTS.sparkline([])+'</div>'
      +'</div>'
      +'<div class="col-turns" id="'+id+'-turns"></div>'
      +'<div class="col-totals">'
        +'<div class="col-totals-label">∑ Cumulative totals across all turns</div>'
        +'<div class="total-item"><div class="tv" id="'+id+'-t-cost">$0.00</div><div class="tl">💰 Cost</div></div>'
        +'<div class="total-item"><div class="tv" id="'+id+'-t-in" style="color:var(--blue)">0</div><div class="tl" id="'+id+'-t-in-lbl">📥 Total In</div></div>'
        +'<div class="total-item"><div class="tv" id="'+id+'-t-out" style="color:var(--tl)">0</div><div class="tl">📤 Total Out</div></div>'
        +'<div class="total-item"><div class="tv" id="'+id+'-t-co2">0g</div><div class="tl">🌱 CO₂</div></div>'
        +'<div class="total-item"><div class="tv" id="'+id+'-t-water">0mL</div><div class="tl">💧 Water</div></div>'
        +'<div class="total-item"><div class="tv" id="'+id+'-t-power" style="color:var(--amber)">0mWh</div><div class="tl">⚡ Power</div></div>'
      +'</div>'
      +'<div class="col-export">'
        +'<button class="export-btn" onclick="UI_COMPARE.exportJSON(\''+esc(model.id)+'\')">⬇ JSON</button>'
        +'<button class="export-btn" onclick="UI_COMPARE.exportCSV(\''+esc(model.id)+'\')">⬇ CSV</button>'
        +'<button class="export-btn" onclick="UI_COMPARE.clearModel(\''+esc(model.id)+'\')">🗑 Clear</button>'
      +'</div>';
    return col;
  }

  // Global map so inline onclick can retrieve turn data for explainer
  var _turnStore = {};

  function appendTurn(model, turn) {
    var id      = cid(model.id);
    var turnsEl = document.getElementById(id+'-turns');
    if (!turnsEl) return;
    var card = document.createElement('div');
    card.className = 'turn-card';
    // Store turn for explainer modal
    var storeKey = id + '_t' + turn.turnNum;
    _turnStore[storeKey] = { modelId: model.id, turn: turn };
    var simCls  = API.hasKey() ? '' : ' simulated';
    var simNote = API.hasKey()
      ? '📤 Model Response &nbsp;·&nbsp; ' + turn.outputTokens + ' tokens'
      : '📤 Simulated Response &nbsp;·&nbsp; ' + turn.outputTokens + ' tokens &nbsp;·&nbsp; <em style="font-weight:400">Add API key for real output</em>';
    var respId  = 'resp-' + model.id.replace(/[^a-z0-9]/gi,'-') + '-' + turn.turnNum;
    card.innerHTML =
      '<div class="turn-card-header">'
        +'<span class="turn-n">Turn '+turn.turnNum+'</span>'
        +'<span>&middot;</span>'
        +'<span>'+esc(turn.intentLabel)+'</span>'
        +'<span style="margin-left:auto;font-size:9px;color:var(--text-3)">'+new Date(turn.ts).toLocaleTimeString()+'</span>'
      +'</div>'
      +'<div style="padding:4px 11px 2px;font-size:9px;font-weight:700;letter-spacing:0.4px;text-transform:uppercase;color:var(--tl);background:var(--tl-bg)">📝 Prompt</div>'
      +'<div class="turn-prompt-text">'+esc(turn.prompt)+'</div>'
      +'<div class="turn-response-label">'+simNote+'</div>'
      +'<div class="turn-response-text'+simCls+'" id="'+respId+'">'+esc(turn.response)+'</div>'
      +(function(){
          var tps = CHARTS.getTPS(model.id);
          var eta = (turn.outputTokens / tps).toFixed(1);
          var tpsStr = '~'+tps+'tk/s · ~'+eta+'s';
          return '<div class="turn-stats" style="grid-template-columns:repeat(4,1fr)">'
            +tstat(turn.inputTokens.toLocaleString() + (turn.cachedTokens ? '<div style="font-size:9px;font-weight:700;color:var(--ok)">' + turn.cachedTokens.toLocaleString() + ' cached</div>' : ''), '📥 Input tokens', '')
            +tstat(turn.outputTokens.toLocaleString(), '📤 Output tokens','')
            +tstat(CALC.fmtCost(turn.cost) + ((turn.costNoCache - turn.cost) > 1e-12 ? '<div style="font-size:9px;font-weight:700;color:var(--ok)">saved ' + CALC.fmtCost(turn.costNoCache - turn.cost) + '</div>' : ''), '💰 Turn cost',    'cost')
            +tstat(tpsStr,                             '⏱ Speed est.',    '')
            +tstat(turn.contextTokens.toLocaleString(),'🧠 Context total','')
            +tstat(CALC.fmtCO2(turn.co2),             '🌱 CO₂',          'co2')
            +tstat(CALC.fmtWater(turn.water),          '💧 Water',        'water')
            +tstat(CALC.fmtPower(turn.power),          '⚡ Power',        'power')
          +'</div>'
          +'<div style="padding:5px 10px 8px;text-align:right">'
            +'<button class="expl-turn-btn" onclick="(function(){var d=UI_COMPARE._getTurnData(\''+storeKey+'\');if(d)EXPLAIN.showTurnExplainer(d.modelId,d.turn);})()" aria-label="Show calculation breakdown for turn '+turn.turnNum+'">'
              +'🔍 How was this calculated?'
              +'<span class="expl-inline-pop">'
                +'<div style="font-size:11px;font-weight:800;color:#9EDFC0;margin-bottom:6px">Quick Formula ⚡</div>'
                +'<div class="eip-row"><span class="eip-label">Input tokens</span><span class="eip-val">'+turn.inputTokens.toLocaleString()+'</span></div>'
                +'<div class="eip-row"><span class="eip-label">Output tokens</span><span class="eip-val">'+turn.outputTokens.toLocaleString()+'</span></div>'
                +'<div class="eip-row"><span class="eip-label">Cost</span><span class="eip-val">'+CALC.fmtCost(turn.cost)+'</span></div>'
                +'<div class="eip-row"><span class="eip-label">CO₂</span><span class="eip-val">'+CALC.fmtCO2(turn.co2)+'</span></div>'
                +'<div class="eip-row"><span class="eip-label">Water</span><span class="eip-val">'+CALC.fmtWater(turn.water)+'</span></div>'
                +'<div style="font-size:9px;color:#64748B;margin-top:7px;border-top:1px solid #1E3A2A;padding-top:6px">Click for full breakdown →</div>'
              +'</span>'
            +'</button>'
          +'</div>'
          // Ratings + Bookmarks row
          +(typeof RATINGS !== 'undefined' ? RATINGS.getRatingHtml(model.id, turn.turnNum) : '')
          +(typeof BOOKMARKS !== 'undefined' ? BOOKMARKS.getAnnotationHtml(model.id, turn.turnNum) : '');
        })();
    turnsEl.appendChild(card);
    // Scroll so the TOP of the new turn card is visible — user sees prompt then response then stats
    requestAnimationFrame(function() {
      turnsEl.scrollTop = card.offsetTop;
    });
    refreshMeta(model);
  }

  function tstat(val,label,cls) {
    return '<div class="turn-stat '+cls+'"><div class="tsv">'+val+'</div><div class="tsl">'+label+'</div></div>';
  }

  function refreshMeta(model) {
    var s = STATE.getSession(model.id); if (!s) return;
    var id = cid(model.id);
    setEl(id+'-t-cost',  CALC.fmtCost(s.totalCost));
    setEl(id+'-t-in',    s.totalIn.toLocaleString());
    var inLbl = document.getElementById(id+'-t-in-lbl');
    if (inLbl) inLbl.textContent = (s.totalCached > 0 && s.totalIn > 0)
      ? '📥 In · ' + Math.round(s.totalCached / s.totalIn * 100) + '% cached'
      : '📥 Total In';
    setEl(id+'-t-out',   s.totalOut.toLocaleString());
    setEl(id+'-t-co2',   CALC.fmtCO2(s.totalCO2));
    setEl(id+'-t-water', CALC.fmtWater(s.totalWater));
    setEl(id+'-t-power', CALC.fmtPower(s.totalPower));
    var pct = Math.min(100, (s.contextTokens/Math.max(model.context_length,1))*100);
    var fillEl = document.getElementById(id+'-ctx-fill');
    var pctEl  = document.getElementById(id+'-ctx-pct');
    if (fillEl) { fillEl.style.width=pct.toFixed(1)+'%'; fillEl.className=CHARTS.ctxBarClass(pct); }
    if (pctEl)  pctEl.textContent = pct.toFixed(1)+'%';
    var sparkEl = document.getElementById(id+'-spark');
    if (sparkEl) sparkEl.innerHTML = CHARTS.sparkline(s.turns.map(function(t){return t.inputTokens;}));
  }

  function updateLivePreview(text) {
    setEl('prev-in',     TOKEN_ENGINE.count(text).toLocaleString());
    setEl('prev-out',    TOKEN_ENGINE.predictOutput(text).toLocaleString());
    setEl('prev-intent', TOKEN_ENGINE.intentLabel(text));
  }

  async function sendPrompt(promptText) {
    if (!promptText.trim()) return;
    var models = STATE.getActiveModels();
    if (!models.length) { TOAST.warning('Select at least one model from the sidebar first.'); return; }
    var btn = document.getElementById('send-btn');
    btn.disabled=true; btn.textContent='⏳ Sending…';
    var iLabel = TOKEN_ENGINE.intentLabel(promptText);
    var promises = models.map(async function(model) {
      var s           = STATE.getSession(model.id);
      var promptTok   = TOKEN_ENGINE.count(promptText);
      var turnInput   = TOKEN_ENGINE.computeTurnInput(s, promptTok); // includes accumulated context
      var estOutput   = TOKEN_ENGINE.predictOutput(promptText);
      var response;
      var isSimulated;
      if (API.hasKey()) {
        var hist = s.turns.map(function(t){return {prompt:t.prompt,response:t.response};});
        var apiResponse = await API.callModel(model.id, promptText, hist);
        // FIX #23: mark as simulated if API returned null (error/invalid key), regardless of key presence
        if (apiResponse) {
          response = apiResponse;
          isSimulated = false;
        } else {
          response = API.simulateResponse(model.id, promptText);
          isSimulated = true; // API failed — fallback to simulation
        }
      } else {
        response = API.simulateResponse(model.id, promptText);
        isSimulated = true;
      }
      // Count actual response tokens.
      // FIX #2: outMult ONLY for simulated responses — real API text is counted as-is.
      var rawOut = TOKEN_ENGINE.count(response);
      var actualOut;
      if (isSimulated) {
        var outMult = (function(id) {
          if (/o3|o1|reasoning/.test(id)) return 1.9;
          if (/opus|claude-3-opus|gpt-4-turbo|gpt-3\.5/.test(id)) return 1.4;
          if (/sonnet|gpt-4o[^-]|gemini.*pro|llama.*70b|mistral-large|grok-3|command-r-plus|deepseek-v/.test(id)) return 1.15;
          if (/mini|haiku|flash|nano|tiny|8b|7b|3b/.test(id)) return 0.72;
          return 1.0;
        })(model.id.toLowerCase());
        actualOut = Math.max(5, Math.round(rawOut * outMult));
      } else {
        actualOut = Math.max(1, rawOut); // real API response — use exact count
      }
      // FIX #9: Guard NaN on cost calculation
      // Prompt caching: prior context is the cacheable prefix on turn 2+.
      var cachePlan = CACHE.plan(model, s, promptTok, turnInput);
      var cd     = CALC.costDetailed(model, turnInput, actualOut, cachePlan.cached, cachePlan.written);
      var effIn  = CALC.effectiveIn(turnInput, cachePlan.cached);
      var tCost  = cd.cost;
      var tCO2   = CALC.co2(model.id, effIn, actualOut);
      var tWater = CALC.water(model.id, effIn, actualOut);
      var tPower = CALC.power(model.id, effIn, actualOut);
      var tCostNC  = cd.noCache;
      var tCO2NC   = CALC.co2(model.id, turnInput, actualOut);
      var tWaterNC = CALC.water(model.id, turnInput, actualOut);
      var tPowerNC = CALC.power(model.id, turnInput, actualOut);
      // Safety: replace NaN with 0 for all computed metrics
      tCost  = isNaN(tCost)  ? 0 : tCost;
      tCO2   = isNaN(tCO2)   ? 0 : tCO2;
      tWater = isNaN(tWater) ? 0 : tWater;
      tPower = isNaN(tPower) ? 0 : tPower;
      tCostNC  = isNaN(tCostNC)  ? 0 : tCostNC;
      tCO2NC   = isNaN(tCO2NC)   ? 0 : tCO2NC;
      tWaterNC = isNaN(tWaterNC) ? 0 : tWaterNC;
      tPowerNC = isNaN(tPowerNC) ? 0 : tPowerNC;
      var turn = {
        turnNum:       s.turns.length + 1,
        prompt:        promptText,
        response:      response,
        promptTokens:  promptTok,
        inputTokens:   turnInput,      // = prior context + new prompt
        outputTokens:  actualOut,
        contextTokens: s.contextTokens + promptTok + actualOut,
        cost:          tCost,
        co2:           tCO2,
        water:         tWater,
        power:         tPower,
        cachedTokens:     cachePlan.cached,
        cacheWriteTokens: cachePlan.written,
        cacheOn:          cachePlan.on,
        costNoCache:   tCostNC,
        co2NoCache:    tCO2NC,
        waterNoCache:  tWaterNC,
        powerNoCache:  tPowerNC,
        cumCost:       s.totalCost + tCost,
        intentLabel:   iLabel,
        isSimulated:   isSimulated,
        ts:            Date.now(),
        // for Calculation Explainer
        priceIn:       parseFloat(model.pricing && model.pricing.prompt     || 0) * 1e6,
        priceOut:      parseFloat(model.pricing && model.pricing.completion || 0) * 1e6,
        powerRate:     DATA.getPowerRate(model.id),
      };
      STATE.addTurn(model.id, turn);
      appendTurn(model, turn);
    });
    await Promise.all(promises);
    updateOutputPanel();   // refresh the dedicated response panel
    updateGlobalStats();
    STATE.saveHistory();   // auto-save to localStorage
    // silently refresh analytics panel if it's visible
    var anPanel = document.getElementById('analytics-panel');
    if (anPanel && anPanel.classList.contains('active')) UI_ANALYTICS.render();
    btn.disabled=false; btn.textContent = API.hasKey() ? 'Send ▶' : 'Simulate ▶';
    document.getElementById('prompt-input').value='';
    updateLivePreview('');
  }

  // Provider brand colors for output panel card headers
  var PROVIDER_COLORS = {
    'openai':'#10a37f', 'anthropic':'#c9561e', 'google':'#4285F4',
    'meta-llama':'#1877F2', 'mistralai':'#FF7000', 'deepseek':'#2563EB',
    'x-ai':'#222222', 'cohere':'#0047FF', 'perplexity':'#20B2AA',
    'qwen':'#FF6A00', 'perceptron':'#7C3AED', '_default':'#555555',
  };

  function updateOutputPanel() {
    var panel = document.getElementById('output-panel');
    var cardsEl = document.getElementById('op-cards');
    if (!panel || !cardsEl) return;
    var models = STATE.getActiveModels();
    var maxTurn = 0;
    var html = models.map(function(model) {
      var s = STATE.getSession(model.id);
      if (!s || !s.turns.length) return '';
      var lt = s.turns[s.turns.length - 1]; // latest turn
      if (lt.turnNum > maxTurn) maxTurn = lt.turnNum;
      var provider = model.id.split('/')[0].toLowerCase();
      var color = PROVIDER_COLORS[provider] || PROVIDER_COLORS['_default'];
      var sname = (model.name || model.id.split('/').pop());
      var simCls = API.hasKey() ? '' : ' simulated';
      var metaStr = 'Turn ' + lt.turnNum
        + ' &nbsp;·&nbsp; ' + lt.outputTokens.toLocaleString() + ' tokens'
        + ' &nbsp;·&nbsp; ' + CALC.fmtCost(lt.cost)
        + ' &nbsp;·&nbsp; ' + CALC.fmtCO2(lt.co2);
      return '<div class="op-card">'
        + '<div class="op-card-head" style="background:' + color + '">'
          + '<span class="ocm">' + esc(sname) + '</span>'
          + '<span class="occ">' + metaStr + '</span>'
        + '</div>'
        + '<div class="op-card-body' + simCls + '">' + esc(lt.response) + '</div>'
        + '</div>';
    }).join('');
    if (!html) return;
    cardsEl.innerHTML = html;
    setEl('op-meta', 'Turn ' + maxTurn + ' &nbsp;·&nbsp; ' + models.length + ' model' + (models.length !== 1 ? 's' : ''));
    panel.classList.add('visible');
  }

  function hideOutputPanel() {
    var p = document.getElementById('output-panel');
    if (p) p.classList.remove('visible');
  }

  function updateGlobalStats() {
    var g = STATE.globalTotals();
    setEl('sess-turns', g.turns);
    setEl('sess-cost',  CALC.fmtCost(g.cost));
    setEl('sess-co2',   CALC.fmtCO2(g.co2));
    setEl('sess-water', CALC.fmtWater(g.water));
    setEl('sess-power', CALC.fmtPower(g.power));
    if (typeof USAGE !== 'undefined') USAGE.refresh();
    // Update Budget Guard, Verdict Banner, and Matrix view
    if (typeof BUDGET  !== 'undefined') BUDGET.update();
    if (typeof VERDICT !== 'undefined') VERDICT.render();
    if (typeof MATRIX  !== 'undefined') MATRIX.render();
  }

  function refreshAllCurrencies() {
    STATE.getActiveModels().forEach(function(m) { refreshMeta(m); });
    updateGlobalStats();
  }

  function clearModel(modelId) {
    STATE.clearSession(modelId);
    var id = cid(modelId);
    var t  = document.getElementById(id+'-turns');
    if (t) t.innerHTML='';
    var m = STATE.getActiveModels().find(function(x){return x.id===modelId;});
    if (m) refreshMeta(m);
    updateGlobalStats();
    updateOutputPanel(); // re-render response panel after clearing
  }

  function exportJSON(modelId) {
    var s=STATE.getSession(modelId); if(!s) return;
    dl(modelId.replace(/\//g,'-')+'.json',
      JSON.stringify({model:modelId, exportedAt:new Date().toISOString(), session:s},null,2),
      'application/json');
  }

  function exportCSV(modelId) {
    var s=STATE.getSession(modelId); if(!s||!s.turns.length) return;
    var rows='Turn,Prompt,InputTokens,OutputTokens,ContextTokens,CostUSD,CO2g,WaterL,PowerWh\n'
      +s.turns.map(function(t) {
        return [t.turnNum,'"'+(t.prompt||'').replace(/"/g,'""').slice(0,100)+'"',
          t.inputTokens,t.outputTokens,t.contextTokens,
          t.cost.toFixed(8),t.co2.toFixed(6),t.water.toFixed(6),(t.power||0).toFixed(8)].join(',');
      }).join('\n');
    dl(modelId.replace(/\//g,'-')+'.csv', rows, 'text/csv');
  }

  function dl(name, content, mime) {
    var blob=new Blob([content],{type:mime});
    var url=URL.createObjectURL(blob);
    var a=document.createElement('a');
    a.href=url; a.download=name; a.click();
    URL.revokeObjectURL(url);
  }

  function _getTurnData(key) { return _turnStore[key] || null; }
  return {renderAll, updateLivePreview, sendPrompt, updateOutputPanel, hideOutputPanel, updateGlobalStats, refreshAllCurrencies, clearModel, exportJSON, exportCSV, _getTurnData};
})();


