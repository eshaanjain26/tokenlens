/* ══════════════════════════════════════════════════════════
   MODULE 7 — UI_COMPARE
   Column builder, turn cards, live preview, send prompt
   ══════════════════════════════════════════════════════════ */
window.UI_COMPARE = (function() {

  var _colEls = {};

  function cid(modelId) { return 'col-'+modelId.replace(/[/]/g,'-'); }
  function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function setEl(id, v) { var e=document.getElementById(id); if(e) e.textContent=v; }

  function emptyStateHtml() {
    return '<div class="no-models-msg" id="no-models-msg">'
      +'<p>Select models from the sidebar to see them side by side.</p>'
      +'<button type="button" class="empty-action" onclick="UI_COMPARE.pickPopular()">Pick 3 popular models</button>'
      +'</div>';
  }

  function renderAll() {
    var area   = document.getElementById('columns-area');
    var models = STATE.getActiveModels();
    if (!models.length) {
      area.innerHTML = emptyStateHtml();
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

  var POPULAR = [
    /^openai\/gpt-4o$/, /^anthropic\/claude-(sonnet-4|3\.5-sonnet)/, /^google\/gemini-2\.5-pro/,
    /^anthropic\/claude/, /^openai\/gpt/, /^google\/gemini/, /^meta-llama\//
  ];

  function pickPopular() {
    var all = STATE.getModels();
    if (!all.length) { TOAST.warning('Models are still loading. Try again in a moment.'); return; }
    var picked = [];
    POPULAR.forEach(function(re) {
      if (picked.length >= 3) return;
      var hit = all.find(function(m) { return re.test(m.id) && picked.indexOf(m.id) < 0; });
      if (hit) picked.push(hit.id);
    });
    all.forEach(function(m) { if (picked.length < 3 && picked.indexOf(m.id) < 0) picked.push(m.id); });
    picked.forEach(function(id) { if (!STATE.isActive(id)) APP.toggleModel(id); });
  }

  function gradeTip(gr) {
    var tips = {
      A: 'Grade A: cheapest tier, under $0.30 per 1M tokens on average.',
      B: 'Grade B: economy tier, $0.30 to $1 per 1M tokens on average.',
      C: 'Grade C: mid-range, $1 to $5 per 1M tokens on average.',
      D: 'Grade D: premium, $5 to $15 per 1M tokens on average.',
      F: 'Grade F: ultra-premium, over $15 per 1M tokens on average. Grades compare against every model listed, not only this session.'
    };
    return tips[gr] || 'Grade against the global model pricing landscape.';
  }

  function sparkHtml(values) {
    var n = values.length;
    if (n < 2) {
      return '<span class="spark-empty">' + (n ? 'One more turn draws the trend.' : 'No turns yet.') + '</span>';
    }
    var max = Math.max.apply(null, values) || 1;
    var pts = values.map(function(v, i) {
      return (i / (n - 1) * 100).toFixed(2) + ',' + (36 - (v / max) * 32).toFixed(2);
    });
    var last = pts[n - 1].split(',');
    return '<svg class="spark-svg" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">'
      +'<line class="spark-base" x1="0" y1="39.5" x2="100" y2="39.5"/>'
      +'<polyline class="spark-line" points="' + pts.join(' ') + '"/>'
      +'</svg>'
      +'<span class="spark-dot" style="left:' + last[0] + '%;top:' + (parseFloat(last[1]) / 40 * 100).toFixed(2) + '%"></span>'
      +'<span class="spark-cursor" hidden></span>';
  }

  function buildColumn(model) {
    var g   = CALC.grade(model);
    var ip  = (parseFloat(model.pricing&&model.pricing.prompt||0)*1e6).toFixed(3);
    var op  = (parseFloat(model.pricing&&model.pricing.completion||0)*1e6).toFixed(3);
    var id  = cid(model.id);
    var ctxK= (model.context_length/1000).toFixed(0);
    var col = document.createElement('div');
    col.className='model-col'; col.id=id;
    col.setAttribute('data-model', model.id);
    var outPerDollar = (parseFloat(model.pricing&&model.pricing.completion||0) > 0)
      ? (1 / (parseFloat(model.pricing.completion) * 1e6)).toFixed(0) : '∞';
    var tps = CHARTS.getTPS(model.id);
    var name = esc(model.name||model.id);
    var mid  = esc(model.id);
    var tip  = gradeTip(g);

    col.innerHTML=
      '<div class="col-header">'
        +'<div class="col-title-row">'
          +'<button type="button" class="model-id col-name js-model" data-hl="'+mid+'" aria-pressed="false" title="Highlight '+name+' across the page">'+name+'</button>'
          +'<span class="grade-badge '+g+'" tabindex="0" role="img" aria-label="'+esc(tip)+'">'+g+'<span class="grade-tip" role="tooltip">'+esc(tip)+'</span></span>'
          +'<div class="col-actions">'
            +'<button type="button" class="col-icon-btn js-pin" data-model-id="'+mid+'" aria-pressed="false" aria-label="Pin '+name+' to the first column" title="Pin to the first column">'+TL_ICON('pin')+'</button>'
            +'<button type="button" class="col-icon-btn js-remove" data-model-id="'+mid+'" aria-label="Remove '+name+' from the comparison" title="Remove from the comparison">'+TL_ICON('x')+'</button>'
          +'</div>'
        +'</div>'
        +'<div class="model-meta">'+ctxK+'K context · $'+ip+' in · $'+op+' out per 1M tokens</div>'
        +'<dl class="col-facts">'
          +'<div title="Typical generation speed for this class of model. Estimated, not measured."><dt>Speed</dt><dd>~'+tps+' tk/s</dd></div>'
          +'<div title="Grams of CO₂ per 1M tokens, from the provider energy profile."><dt>CO₂ per 1M</dt><dd>'+DATA.getCO2Rate(model.id).toFixed(0)+' g</dd></div>'
          +'<div title="Output tokens per dollar at this model\'s output price."><dt>Output per $</dt><dd>'+outPerDollar+'K tok</dd></div>'
        +'</dl>'
      +'</div>'
      +'<div class="ctx-bar-wrap">'
        +'<div class="ctx-bar-label"><span>Context window</span><span id="'+id+'-ctx-pct">0%</span></div>'
        +'<div class="ctx-bar" role="progressbar" aria-label="Context window used" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0" id="'+id+'-ctx-bar"><div id="'+id+'-ctx-fill" class="ctx-bar-fill" style="width:0%"></div></div>'
      +'</div>'
      +'<div class="sparkline-wrap">'
        +'<div class="sparkline-head"><span class="sparkline-label">Input tokens per turn</span><span class="sparkline-read" id="'+id+'-spark-read" aria-live="polite"></span></div>'
        +'<div id="'+id+'-spark" class="spark" tabindex="0" role="img" aria-label="Input tokens per turn, grows as context accumulates" data-values="">'+sparkHtml([])+'</div>'
      +'</div>'
      +'<div class="col-turns" id="'+id+'-turns" tabindex="0" role="region" aria-label="Turns for '+name+'"></div>'
      +'<div class="col-totals">'
        +'<div class="col-totals-label">Totals across all turns</div>'
        +'<div class="total-item"><div class="tl">Cost</div><div class="tv" id="'+id+'-t-cost">$0.00</div></div>'
        +'<div class="total-item"><div class="tl" id="'+id+'-t-in-lbl">Input</div><div class="tv" id="'+id+'-t-in">0</div></div>'
        +'<div class="total-item"><div class="tl">Output</div><div class="tv" id="'+id+'-t-out">0</div></div>'
        +'<div class="total-item"><div class="tl">CO₂</div><div class="tv" id="'+id+'-t-co2">0g</div></div>'
        +'<div class="total-item"><div class="tl">Water</div><div class="tv" id="'+id+'-t-water">0mL</div></div>'
        +'<div class="total-item"><div class="tl">Power</div><div class="tv" id="'+id+'-t-power">0mWh</div></div>'
      +'</div>'
      +'<div class="col-export">'
        +'<button class="export-btn" onclick="UI_COMPARE.exportJSON(\''+mid+'\')">'+TL_ICON('download')+'JSON</button>'
        +'<button class="export-btn" onclick="UI_COMPARE.exportCSV(\''+mid+'\')">'+TL_ICON('download')+'CSV</button>'
        +'<button class="export-btn" onclick="UI_COMPARE.clearModel(\''+mid+'\')">'+TL_ICON('trash')+'Clear</button>'
      +'</div>';
    return col;
  }

  // Global map so inline onclick can retrieve turn data for explainer
  var _turnStore = {};

  function money(v) { return CALC.fmtCost(v); }

  function appendTurn(model, turn) {
    var id      = cid(model.id);
    var turnsEl = document.getElementById(id+'-turns');
    if (!turnsEl) return;
    var card = document.createElement('div');
    card.className = 'turn-card';
    var storeKey = id + '_t' + turn.turnNum;
    _turnStore[storeKey] = { modelId: model.id, turn: turn };
    var simulated = !API.hasKey();
    var simCls  = simulated ? ' simulated' : '';
    var respId  = 'resp-' + model.id.replace(/[^a-z0-9]/gi,'-') + '-' + turn.turnNum;
    var tps = CHARTS.getTPS(model.id);
    var eta = (turn.outputTokens / tps).toFixed(1);
    var saved = turn.costNoCache - turn.cost;
    var priceIn  = (turn.priceIn  || 0).toFixed(3);
    var priceOut = (turn.priceOut || 0).toFixed(3);
    var inTitle = turn.inputTokens.toLocaleString() + ' tokens sent: your prompt (' + (turn.promptTokens || 0).toLocaleString()
      + ') plus the context carried over from earlier turns.' + (turn.cachedTokens ? ' ' + turn.cachedTokens.toLocaleString() + ' were served from the prompt cache.' : '');
    var costTitle = turn.inputTokens.toLocaleString() + ' input tokens at $' + priceIn + ' per 1M plus ' + turn.outputTokens.toLocaleString()
      + ' output tokens at $' + priceOut + ' per 1M' + (saved > 1e-12 ? ', after the prompt-cache discount.' : '.');
    var rate = turn.cacheOn ? 'effective input (cache reads count at 10% of a fresh token)' : 'input plus output tokens';
    card.innerHTML =
      '<div class="turn-card-header">'
        +'<span class="turn-n">Turn '+turn.turnNum+'</span>'
        +'<span class="turn-intent">'+esc(String(turn.intentLabel||'').replace(/^[^\p{L}\p{N}]+/u,''))+'</span>'
        +'<time class="turn-time">'+new Date(turn.ts).toLocaleTimeString()+'</time>'
      +'</div>'
      +'<div class="turn-block">'
        +'<div class="turn-label">Prompt</div>'
        +'<div class="turn-prompt-text">'+esc(turn.prompt)+'</div>'
      +'</div>'
      +'<div class="turn-block">'
        +'<div class="turn-response-label">'
          +'<span class="turn-label">Response</span>'
          +'<span class="turn-label-meta">'+turn.outputTokens.toLocaleString()+' tokens</span>'
          +(simulated ? '<span class="pill-sim" title="No API key is set, so this text is generated locally. Add a key for real model output.">Simulated</span>' : '')
          +'<button type="button" class="turn-copy js-copy" data-target="'+respId+'" aria-label="Copy response from turn '+turn.turnNum+'" title="Copy response">'+TL_ICON('copy')+'</button>'
        +'</div>'
        +'<div class="turn-response-text js-clamp'+simCls+'" id="'+respId+'">'+esc(turn.response)+'</div>'
        +'<button type="button" class="turn-more js-more" aria-expanded="false" aria-controls="'+respId+'" hidden>Show more</button>'
      +'</div>'
      +'<div class="turn-stats">'
        +tstat(turn.inputTokens.toLocaleString() + (turn.cachedTokens ? '<small class="ts-note">' + turn.cachedTokens.toLocaleString() + ' cached</small>' : ''), 'Input tokens', '', inTitle)
        +tstat(turn.outputTokens.toLocaleString(), 'Output tokens', '', turn.outputTokens.toLocaleString() + ' tokens in the reply' + (simulated ? ', counted from the simulated text.' : '.'))
        +tstat(money(turn.cost) + (saved > 1e-12 ? '<small class="ts-note">saved ' + money(saved) + '</small>' : ''), 'Turn cost', 'cost', costTitle)
        +tstat('~'+tps+' tk/s<small class="ts-note">~'+eta+' s</small>', 'Speed est.', '', 'About ' + eta + ' s to generate ' + turn.outputTokens.toLocaleString() + ' tokens at a typical ~' + tps + ' tokens per second for this model class. Estimated, not measured.')
        +tstat(turn.contextTokens.toLocaleString(), 'Context total', '', 'Tokens in the context window after this turn: earlier context, this prompt and this reply.')
        +tstat(CALC.fmtCO2(turn.co2), 'CO₂', 'co2', 'Tokens counted as ' + rate + ', divided by 1M, times this model\'s grams of CO₂ per 1M tokens.')
        +tstat(CALC.fmtWater(turn.water), 'Water', 'water', 'Tokens counted as ' + rate + ', divided by 1M, times this model\'s water use per 1M tokens.')
        +tstat(CALC.fmtPower(turn.power), 'Power', 'power', 'Tokens counted as ' + rate + ', divided by 1M, times this model\'s watt-hours per 1M tokens.')
      +'</div>'
      +'<div class="turn-actions">'
        +'<button type="button" class="expl-turn-btn" onclick="(function(){var d=UI_COMPARE._getTurnData(\''+storeKey+'\');if(d)EXPLAIN.showTurnExplainer(d.modelId,d.turn);})()" aria-label="Show calculation breakdown for turn '+turn.turnNum+'">'
          +TL_ICON('info')+'How was this calculated?'
        +'</button>'
        +(typeof RATINGS !== 'undefined' ? RATINGS.getRatingHtml(model.id, turn.turnNum) : '')
        +(typeof BOOKMARKS !== 'undefined' ? BOOKMARKS.getAnnotationHtml(model.id, turn.turnNum) : '')
      +'</div>';
    turnsEl.appendChild(card);
    requestAnimationFrame(function() {
      turnsEl.scrollTop = card.offsetTop;
    });
    refreshMeta(model);
  }

  function tstat(val,label,cls,title) {
    return '<div class="turn-stat '+cls+'" title="'+esc(title||'')+'"><div class="tsv">'+val+'</div><div class="tsl">'+label+'</div></div>';
  }

  function refreshMeta(model) {
    var s = STATE.getSession(model.id); if (!s) return;
    var id = cid(model.id);
    setEl(id+'-t-cost',  CALC.fmtCost(s.totalCost));
    setEl(id+'-t-in',    s.totalIn.toLocaleString());
    var inLbl = document.getElementById(id+'-t-in-lbl');
    if (inLbl) inLbl.textContent = (s.totalCached > 0 && s.totalIn > 0)
      ? 'In · ' + Math.round(s.totalCached / s.totalIn * 100) + '% cached'
      : 'Input';
    if (inLbl) inLbl.title = s.totalCached > 0 ? 'Input tokens, with the share served from the prompt cache' : '';
    setEl(id+'-t-out',   s.totalOut.toLocaleString());
    setEl(id+'-t-co2',   CALC.fmtCO2(s.totalCO2));
    setEl(id+'-t-water', CALC.fmtWater(s.totalWater));
    setEl(id+'-t-power', CALC.fmtPower(s.totalPower));
    var pct = Math.min(100, (s.contextTokens/Math.max(model.context_length,1))*100);
    var fillEl = document.getElementById(id+'-ctx-fill');
    var pctEl  = document.getElementById(id+'-ctx-pct');
    var barEl  = document.getElementById(id+'-ctx-bar');
    if (fillEl) { fillEl.style.width=pct.toFixed(1)+'%'; fillEl.className=CHARTS.ctxBarClass(pct); }
    if (pctEl)  pctEl.textContent = pct.toFixed(1)+'%';
    if (barEl) {
      barEl.setAttribute('aria-valuenow', pct.toFixed(1));
      barEl.title = s.contextTokens.toLocaleString() + ' of ' + (model.context_length || 0).toLocaleString() + ' tokens in the context window';
    }
    var sparkEl = document.getElementById(id+'-spark');
    if (sparkEl) {
      var vals = s.turns.map(function(t){return t.inputTokens;});
      sparkEl.innerHTML = sparkHtml(vals);
      sparkEl.setAttribute('data-values', vals.join(','));
      var readEl = document.getElementById(id+'-spark-read');
      if (readEl) readEl.textContent = vals.length ? 'Peak ' + Math.max.apply(null, vals).toLocaleString() : '';
      if (readEl) readEl.setAttribute('data-default', readEl.textContent);
    }
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
    btn.disabled=true; btn.textContent='Sending…';
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
    btn.disabled=false; btn.textContent = API.hasKey() ? 'Send' : 'Simulate';
    document.getElementById('prompt-input').value='';
    updateLivePreview('');
  }

  function updateOutputPanel() {
    var panel = document.getElementById('output-panel');
    var cardsEl = document.getElementById('op-cards');
    if (!panel || !cardsEl) return;
    var models = STATE.getActiveModels();
    var maxTurn = 0;
    var html = models.map(function(model, i) {
      var s = STATE.getSession(model.id);
      if (!s || !s.turns.length) return '';
      var lt = s.turns[s.turns.length - 1]; // latest turn
      if (lt.turnNum > maxTurn) maxTurn = lt.turnNum;
      var sname = (model.name || model.id.split('/').pop());
      var simCls = API.hasKey() ? '' : ' simulated';
      var bodyId = 'op-resp-' + i;
      var metaStr = 'Turn ' + lt.turnNum
        + ' · ' + lt.outputTokens.toLocaleString() + ' tokens'
        + ' · ' + CALC.fmtCost(lt.cost)
        + ' · ' + CALC.fmtCO2(lt.co2);
      return '<article class="op-card" data-model="' + esc(model.id) + '">'
        + '<div class="op-card-head">'
          + '<button type="button" class="ocm js-model" data-hl="' + esc(model.id) + '" aria-pressed="false" title="Highlight ' + esc(sname) + ' across the page">' + esc(sname) + '</button>'
          + '<button type="button" class="turn-copy js-copy" data-target="' + bodyId + '" aria-label="Copy latest response from ' + esc(sname) + '" title="Copy response">' + TL_ICON('copy') + '</button>'
        + '</div>'
        + '<div class="occ">' + metaStr + (simCls ? '<span class="pill-sim" title="No API key is set, so this text is generated locally.">Simulated</span>' : '') + '</div>'
        + '<div class="op-card-body js-clamp' + simCls + '" id="' + bodyId + '">' + esc(lt.response) + '</div>'
        + '<button type="button" class="turn-more js-more" aria-expanded="false" aria-controls="' + bodyId + '" hidden>Show more</button>'
        + '</article>';
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
  return {renderAll, pickPopular, updateLivePreview, sendPrompt, updateOutputPanel, hideOutputPanel, updateGlobalStats, refreshAllCurrencies, clearModel, exportJSON, exportCSV, _getTurnData};
})();
