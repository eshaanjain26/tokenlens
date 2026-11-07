/* ══════════════════════════════════════════════════════════
   MODULE 8 — UI_BENCHMARKS
   Benchmarks tab — training, inference, calculator, citations
   ══════════════════════════════════════════════════════════ */
window.UI_BENCHMARKS = (function() {

  function render() {
    var panel = document.getElementById('benchmarks-panel');

    var trainRows = DATA.TRAINING_BENCHMARKS.map(function(b) {
      var bc = b.status==='verified'?'verified':b.status==='research'?'research':'estimated';
      var bl = b.status==='verified'?'&#10003; Verified':b.status==='research'?'&#128300; Research':'&#9888; Estimated';
      return '<tr><td><strong>'+b.model+'</strong></td><td>'+b.params+'</td>'
        +'<td class="num">'+b.co2.toLocaleString()+' tCO₂e</td>'
        +'<td class="num">'+(b.water?b.water.toLocaleString()+' L':'&mdash;')+'</td>'
        +'<td class="num">'+(b.energy?b.energy.toLocaleString()+' MWh':'&mdash;')+'</td>'
        +'<td><span class="bench-badge '+bc+'">'+bl+'</span></td>'
        +'<td style="font-size:10px;color:#666">'+b.citation+'</td></tr>';
    }).join('');

    var infRows = DATA.INFERENCE_BENCHMARKS.map(function(b) {
      var bc = b.src.includes('Google') ? 'research' : b.src.includes('Luccioni') ? 'verified' : 'estimated';
      var bl = bc==='verified' ? '&#10003; Luccioni 2023' : bc==='research' ? '&#128300; Report' : '&#9888; Estimated';
      // Format power_wh nicely
      var pwStr = b.power_wh >= 1000 ? (b.power_wh/1000).toFixed(1)+' kWh' : b.power_wh+' Wh';
      return '<tr><td><strong>'+b.model+'</strong></td><td>'+b.cls+'</td>'
        +'<td class="num" style="color:var(--amber)">'+pwStr+'</td>'
        +'<td class="num">'+b.co2.toFixed(0)+'g</td>'
        +'<td class="num">'+b.water.toFixed(1)+'L</td>'
        +'<td class="num">$'+b.cost.toFixed(2)+'</td>'
        +'<td style="font-size:10px">'+b.wue+'</td>'
        +'<td><span class="bench-badge '+bc+'">'+bl+'</span></td></tr>';
    }).join('');

    panel.innerHTML=
      '<h1 class="bench-page-title">&#128202; Research Benchmarks &amp; Verified Data</h1>'
      +'<p class="bench-page-sub">All figures drawn from peer-reviewed papers and official environmental reports. Estimated values are clearly marked.</p>'
      +'<div class="bench-grid">'

      // Training
      +'<div class="bench-card full">'
        +'<h2>&#127981; Training Environmental Footprints</h2>'
        +'<p class="sub">One-time cost to train each model — amortized across billions of inference calls. Frontier models with undisclosed architecture are estimated via scaling laws.</p>'
        +'<div style="overflow-x:auto">'
          +'<table class="bench-table"><thead><tr>'
            +'<th>Model</th><th>Parameters</th><th>CO₂ Emitted</th><th>Water Used</th><th>Energy</th><th>Status</th><th>Source</th>'
          +'</tr></thead><tbody>'+trainRows+'</tbody></table>'
        +'</div>'
        +'<p style="font-size:10px;color:var(--text-3);margin-top:8px">* GPT-4 parameter count is unconfirmed — OpenAI has not officially disclosed model architecture.</p>'
      +'</div>'

      // Inference
      +'<div class="bench-card full">'
        +'<h2>&#9889; Inference Impact per 1M Tokens</h2>'
        +'<p class="sub">Power = Wh/1M tokens anchored to <strong>Luccioni et al. 2023 "Power Hungry Processing"</strong> (direct GPU measurement). CO₂ and water are derived from Power × provider grid intensity — not independent lookups. Versioned OpenRouter IDs (e.g. claude-3-5-sonnet-20241022) resolved by provider-prefix fuzzy match.</p>'
        +'<div style="overflow-x:auto">'
          +'<table class="bench-table"><thead><tr>'
            +'<th style="color:#FFD700">⚡ Power / 1M tok</th><th>Model</th><th>Class</th><th>CO₂ / 1M tok</th><th>Water / 1M tok</th><th>Cost / 1M tok</th><th>DC WUE</th><th>Source</th>'
          +'</tr></thead><tbody>'+infRows+'</tbody></table>'
        +'</div>'
        +'<p style="font-size:10px;color:var(--text-3);margin-top:8px">Luccioni 2023 anchor: 6B model ≈ 540–640 Wh/1M tokens (A100 GPU, direct measurement). Larger models scale as params^0.65. Reasoning models add 4–20× for extended chain-of-thought compute.</p>'
      +'</div>'

      // Calculator
      +'<div class="bench-card full">'
        +'<h2>&#128208; Context Window Cost Multiplier Calculator</h2>'
        +'<p class="sub">Each turn adds all previous context to the input. Turn k input tokens = P + (k&#8722;1)&times;(P+O). Total cost grows quadratically &#8212; turn N costs roughly N&times; more than turn 1.</p>'
        +'<div class="ctx-calc">'
          +'<div class="ctx-calc-field"><label>Avg prompt tokens per turn (P)</label><input type="number" id="cc-p" value="100" min="1" max="5000" oninput="UI_BENCHMARKS.calcCtx()"></div>'
          +'<div class="ctx-calc-field"><label>Avg output tokens per turn (O)</label><input type="number" id="cc-o" value="300" min="1" max="5000" oninput="UI_BENCHMARKS.calcCtx()"></div>'
          +'<div class="ctx-calc-field"><label>Number of turns &#8212; <strong id="cc-n-val" style="color:var(--tl)">5</strong></label>'
            +'<input type="range" id="cc-n" min="1" max="20" value="5" oninput="document.getElementById(\'cc-n-val\').textContent=this.value;UI_BENCHMARKS.calcCtx()"></div>'
          +'<div class="ctx-calc-field"><label>Model (input price)</label>'
            +'<select id="cc-model" onchange="UI_BENCHMARKS.calcCtx()">'
              +'<option value="0.0000025">GPT-4o ($2.50/1M in)</option>'
              +'<option value="0.00000015">GPT-4o mini ($0.15/1M in)</option>'
              +'<option value="0.000015">Claude Opus 4 ($15/1M in)</option>'
              +'<option value="0.000003">Claude Sonnet 4 ($3/1M in)</option>'
              +'<option value="0.0000008">Claude Haiku ($0.80/1M in)</option>'
              +'<option value="0.00000125">Gemini 2.5 Pro ($1.25/1M in)</option>'
              +'<option value="0.0000001">Gemini 2.0 Flash ($0.10/1M in)</option>'
              +'<option value="0.00000059">Llama 3.3 70B ($0.59/1M in)</option>'
              +'<option value="0.000010">o3 ($10/1M in)</option>'
              +'<option value="0.00000055">DeepSeek R1 ($0.55/1M in)</option>'
            +'</select>'
          +'</div>'
          +'<div class="ctx-result-row">'
            +'<div class="ctx-result-item"><div class="crv" id="cc-r1">$0.00</div><div class="crl">Turn 1 cost</div></div>'
            +'<div class="ctx-result-item"><div class="crv" id="cc-rn">$0.00</div><div class="crl">Last turn cost</div></div>'
            +'<div class="ctx-result-item"><div class="crv" id="cc-total">$0.00</div><div class="crl">Total session cost</div></div>'
            +'<div class="ctx-result-item"><div class="crv" id="cc-mult">1&#215;</div><div class="crl">Cost multiplier (last vs. first)</div></div>'
          +'</div>'
        +'</div>'
        +'<div id="cc-chart" style="margin-top:16px;overflow-x:auto"></div>'
      +'</div>'

      // Water equivalents
      +'<div class="bench-card">'
        +'<h2>&#128167; Water Usage Equivalents</h2>'
        +'<p class="sub">Based on Li et al. 2023 &#8212; &#8220;Making AI Less Thirsty&#8221;</p>'
        +'<div class="equiv-grid">'
          +eq('&#129380;','~2 glasses','Per 20-question ChatGPT session (~500mL)')
          +eq('&#129398;','1 bottle','Per 40-question GPT-4 session (~500mL)')
          +eq('&#128703;','0.008 showers','GPT-4 session vs 65L shower')
          +eq('&#128140;','1&#8211;5 mL','Per email draft (mini model)')
          +eq('&#128218;','50&#8211;200 mL','Long research prompt (frontier model)')
          +eq('&#127754;','700,000 L','To train GPT-3 once (Li et al. 2023)')
        +'</div>'
        +'<p style="font-size:10px;color:var(--text-3);margin-top:10px">WUE: Google ~0.71 L/kWh &middot; Azure ~1.2&#8211;2.0 L/kWh &middot; AWS ~0.5 L/kWh. Varies by region and cooling method.</p>'
      +'</div>'

      // CO2 equivalents
      +'<div class="bench-card">'
        +'<h2>&#127807; CO₂ Emissions Equivalents</h2>'
        +'<p class="sub">Putting inference carbon in everyday perspective</p>'
        +'<div class="equiv-grid">'
          +eq('&#128663;','~2.3 km','Per gram CO₂ driving equivalent')
          +eq('&#128241;','~8 charges','Per gram CO₂ (smartphone charges)')
          +eq('&#9749;','~0.5g eq.','GPT-4o prompt &asymp; brewing one coffee')
          +eq('&#127794;','~40 min','Per gram CO₂ absorbed by one tree')
          +eq('&#9992;','~0.001 flight','NY&#x2192;LA flight emits ~200kg CO₂')
          +eq('&#128161;','~0.5 Wh','Per gram CO₂ (US avg grid 386g/kWh)')
        +'</div>'
        +'<p style="font-size:10px;color:var(--text-3);margin-top:10px">US grid 2023: ~386g CO₂/kWh (EPA). Data centers with renewable energy sourcing have significantly lower carbon intensity.</p>'
      +'</div>'

      // Power equivalents
      +'<div class="bench-card full">'
        +'<h2>&#9889; Power Consumption Equivalents (per 1M tokens)</h2>'
        +'<p class="sub">Based on Luccioni et al. 2023 power measurements. kWh = Wh/1000. Average US home uses ~30 kWh/day.</p>'
        +'<div class="equiv-grid" style="grid-template-columns:repeat(4,1fr)">'
          +eq('&#128162;','~0.6 Wh','Gemini Flash / Claude Haiku per 1M tok (most efficient)')
          +eq('&#128161;','~3.2 Wh','GPT-4o / Claude Sonnet per 1M tok (frontier MoE)')
          +eq('&#128293;','~9.5 Wh','DeepSeek R1 reasoning per 1M tok')
          +eq('&#127774;','~24 Wh','OpenAI o3 extended reasoning per 1M tok')
          +eq('&#128222;','1 phone charge ≈ 5 Wh','Frontier model = 0.6–5 phone charges per 1M tok')
          +eq('&#127774;','~1,700 Wh = 1 kWh','Run ~500K frontier-model tokens on 1 kWh')
          +eq('&#127968;','US home: 30 kWh/day','o3 at 24 Wh: 1M tok = 0.08% of daily home energy')
          +eq('&#128664;','EV: 0.3 kWh/mile','1M GPT-4o tokens ≈ 0.01 miles of EV driving')
        +'</div>'
        +'<div style="margin-top:12px;padding:10px 12px;background:var(--blue-bg);border-radius:var(--radius);font-size:11px;line-height:1.6">'
          +'<strong style="color:var(--blue)">&#128202; Methodology:</strong> Power (Wh/1M tok) is the primary metric anchored to Luccioni et al. 2023 direct GPU measurement of a 6B parameter model (≈540–640 Wh/1M). '
          +'Larger models scale as params^0.65 (sublinear — memory bandwidth limited). '
          +'CO₂ = Power × grid carbon intensity (gCO₂/kWh) / 1000. '
          +'Water = Power × WUE (L/kWh) / 1000. '
          +'Provider profiles use Google Env Report 2023, Microsoft Sustainability Report 2023, and AWS Sustainability Report 2023. '
          +'This ensures each model shows <em>different, research-grounded numbers</em> regardless of whether the exact model ID is in the lookup table.'
        +'</div>'
      +'</div>'

      // Radar chart
      +'<div class="bench-card full" id="bench-radar-card">'
        +'<h2>🕸 Model Radar Comparison</h2>'
        +'<p class="sub">Normalized across 5 dimensions: Cost Efficiency (inverse cost), CO₂ Efficiency, Power Efficiency, Context Size, and Speed (tokens/sec). Outer = better. Select models in the sidebar to populate.</p>'
        +'<div class="radar-wrap" id="bench-radar-wrap"><em style="font-size:11px;color:#999">Select models from the sidebar to render radar chart.</em></div>'
      +'</div>'

      // Break-even calculator
      +'<div class="bench-card full">'
        +'<h2>💰 Break-even Calculator</h2>'
        +'<p class="sub">Compare two models at scale. Find the crossover point where switching pays off.</p>'
        +'<div class="be-grid">'
          +'<div class="be-field"><label>Model A</label><select id="be-a" onchange="UI_BENCHMARKS.calcBreakEven()"><option value="">— select model —</option></select></div>'
          +'<div class="be-field"><label>Model B</label><select id="be-b" onchange="UI_BENCHMARKS.calcBreakEven()"><option value="">— select model —</option></select></div>'
          +'<div class="be-field"><label>Monthly input tokens</label><input type="number" id="be-in" value="10000000" min="1" oninput="UI_BENCHMARKS.calcBreakEven()"></div>'
          +'<div class="be-field"><label>Monthly output tokens</label><input type="number" id="be-out" value="3000000" min="1" oninput="UI_BENCHMARKS.calcBreakEven()"></div>'
          +'<div class="be-results" id="be-results"></div>'
          +'<div class="be-chart-wrap" id="be-chart"></div>'
        +'</div>'
      +'</div>'

      // Citations
      +'<div class="bench-card full">'
        +'<h2>&#128218; Research Citations</h2>'
        +'<p class="sub">Primary sources for all benchmark data in this dashboard.</p>'
        +'<ul class="citation-list">'
          +cite('Luccioni, A.S., Viguier, S., &amp; Ligozat, A. (2023)','&ldquo;Power Hungry Processing: Watts Driving the Cost of AI Deployment?&rdquo;','arXiv:2311.16863 &middot; <strong>Primary anchor for all power estimates.</strong> Direct GPU measurement across model sizes. 6B model ≈ 540–640 Wh/1M tokens. Derives per-inference energy via hardware-level profiling.')
          +cite('de Vries, A. (2023)','&ldquo;The growing energy footprint of artificial intelligence&rdquo;','Joule, Vol. 7, Issue 10 &middot; ~1g CO₂ per ChatGPT query baseline. Used to calibrate GPT-4 class power estimates and cross-validate POWER_RATES.')
          +cite('Li, P., Yang, J., Islam, M.A., &amp; Ren, S. (2023)','&ldquo;Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models&rdquo;','arXiv:2304.03271 &middot; GPT-3: ~700,000L training; ~500mL per 20-question session. Water derived as Power × WUE (L/kWh): Azure ~1.2–2.0, AWS ~0.5, GCP ~0.71 L/kWh.')
          +cite('Strubell, E., Ganesh, A., &amp; McCallum, A. (2019)','&ldquo;Energy and Policy Considerations for Deep Learning in NLP&rdquo;','ACL 2019 &middot; BERT-base: 0.65 tCO₂e training. First widely-cited study on NLP carbon footprint.')
          +cite('Patterson, D. et al. (2021)','&ldquo;Carbon Emissions and Large Neural Network Training&rdquo;','arXiv:2104.10350 &middot; T5-Large: 46.7 tCO₂e. Transformer, Megatron-LM benchmarks. Google data center PUE methodology.')
          +cite('Touvron, H. et al. (2023)','&ldquo;LLaMA&rdquo; &amp; &ldquo;LLaMA 2: Open Foundation and Fine-Tuned Chat Models&rdquo;','arXiv:2302.13971 &amp; 2307.09288 &middot; LLaMA 65B: 539 tCO₂e &middot; LLaMA 2 70B: 291 tCO₂e &middot; Full training energy disclosure.')
          +cite('Scao, T. et al. / BigScience (2022)','&ldquo;BLOOM: A 176B-Parameter Open-Access Multilingual Language Model&rdquo;','arXiv:2211.05100 &middot; BLOOM 176B: 433 tCO₂e &middot; Jean Zay supercomputer, France (largely nuclear power grid).')
          +cite('Rae, J. W. et al. / DeepMind (2021)','&ldquo;Scaling Language Models: Methods, Analysis &amp; Insights from Training Gopher&rdquo;','arXiv:2112.11446 &middot; Gopher 280B: 380 tCO₂e.')
          +cite('Google LLC (2023)','&ldquo;Google Environmental Report 2023&rdquo;','WUE: ~0.71 L/kWh average across Google data centers (2022). Used for Gemini water rate estimates.')
          +cite('Microsoft Corporation (2023)','&ldquo;Microsoft Environmental Sustainability Report 2023&rdquo;','Azure WUE: ~1.2&#8211;2.0 L/kWh. Higher in warmer climates with evaporative cooling. Used for GPT family water estimates.')
        +'</ul>'
      +'</div>'

    +'</div>'; // bench-grid

    calcCtx();
    // Defer so DOM is populated first
    setTimeout(function(){ renderRadar(); populateBreakEvenSelects(); calcBreakEven(); }, 0);
  }

  function eq(icon, val, label) {
    return '<div class="equiv-item"><div class="ei">'+icon+'</div><div class="ev">'+val+'</div><div class="el">'+label+'</div></div>';
  }
  function cite(author, title, key) {
    return '<li><strong>'+author+'</strong><br>'+title+'<br><span class="cite-key">'+key+'</span></li>';
  }

  function calcCtx() {
    var P  = parseInt((document.getElementById('cc-p')&&document.getElementById('cc-p').value)||100);
    var O  = parseInt((document.getElementById('cc-o')&&document.getElementById('cc-o').value)||300);
    var N  = parseInt((document.getElementById('cc-n')&&document.getElementById('cc-n').value)||5);
    var ip = parseFloat((document.getElementById('cc-model')&&document.getElementById('cc-model').value)||0.0000025);
    var op = ip * 3;
    var total=0, t1=0, tN=0, perTurn=[], cumCosts=[];
    for (var k=1; k<=N; k++) {
      var inp = P + (k-1)*(P+O); // quadratic context accumulation
      var c   = inp*ip + O*op;
      total  += c; perTurn.push(c); cumCosts.push(total);
      if (k===1) t1=c;
      if (k===N) tN=c;
    }
    var mult = t1>0 ? (tN/t1).toFixed(1) : '1.0';
    function fc(v) {
      if (v<0.0001) return '$'+v.toFixed(6);
      if (v<0.01)   return '$'+v.toFixed(4);
      return '$'+v.toFixed(3);
    }
    sEl('cc-r1',    fc(t1));
    sEl('cc-rn',    fc(tN));
    sEl('cc-total', fc(total));
    sEl('cc-mult',  mult+'×');
    renderBarChart(perTurn, cumCosts, N);
  }

  function renderBarChart(perTurn, cumCosts, N) {
    var chartEl=document.getElementById('cc-chart'); if(!chartEl) return;
    var w=620, h=190, pad={t:14,r:16,b:36,l:64};
    var iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
    var maxT=Math.max.apply(null,perTurn.concat([0.000001]));
    var maxC=Math.max.apply(null,cumCosts.concat([0.000001]));
    var xStep=iw/N;
    function fy(v) { return v<0.0001?'$'+v.toFixed(6):v<0.01?'$'+v.toFixed(4):'$'+v.toFixed(3); }
    var grid='', bars='', line='', dots='';
    for (var g=0; g<=4; g++) {
      var yy=pad.t+ih*(1-g/4);
      grid+='<line x1="'+pad.l+'" y1="'+yy.toFixed(1)+'" x2="'+(w-pad.r)+'" y2="'+yy.toFixed(1)+'" stroke="#E2E2E2" stroke-dasharray="3,3"/>';
      grid+='<text x="'+(pad.l-4)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#999">'+fy(maxT*g/4)+'</text>';
    }
    var linePts=[];
    for (var k=0; k<N; k++) {
      var bh=(perTurn[k]/maxT)*ih*0.75;
      var bx=pad.l+k*xStep+xStep*0.15, by=pad.t+ih-bh;
      bars+='<rect x="'+bx.toFixed(1)+'" y="'+by.toFixed(1)+'" width="'+(xStep*0.7).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="var(--tl)" opacity="0.65" rx="3"/>';
      grid+='<text x="'+(pad.l+(k+0.5)*xStep).toFixed(1)+'" y="'+(h-pad.b+13)+'" text-anchor="middle" font-size="10" fill="#666">'+(k+1)+'</text>';
      var cx=pad.l+(k+0.5)*xStep, cy=pad.t+ih-(cumCosts[k]/maxC)*ih*0.9;
      linePts.push([cx.toFixed(1),cy.toFixed(1)]);
      dots+='<circle cx="'+cx.toFixed(1)+'" cy="'+cy.toFixed(1)+'" r="3.5" fill="var(--blue)"/>';
    }
    line='<path d="'+linePts.map(function(p,i){return (i?'L':'M')+p[0]+','+p[1];}).join(' ')+'" fill="none" stroke="var(--blue)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
    chartEl.innerHTML='<svg width="'+w+'" height="'+h+'" style="max-width:100%;display:block">'
      +'<text x="'+pad.l+'" y="11" font-size="10" fill="#888">Per-turn cost (magenta bars) vs. Cumulative cost (blue line) &mdash; quadratic growth</text>'
      +grid+bars+line+dots
      +'<rect x="'+pad.l+'" y="'+pad.t+'" width="'+iw+'" height="'+ih+'" fill="none" stroke="#E2E2E2"/>'
      +'<text x="'+(pad.l+iw/2)+'" y="'+(h-2)+'" text-anchor="middle" font-size="10" fill="#888">Turn number</text>'
      +'</svg>';
  }

  function sEl(id,v) { var e=document.getElementById(id); if(e) e.textContent=v; }

  function renderRadar() {
    var wrap = document.getElementById('bench-radar-wrap'); if (!wrap) return;
    var models = STATE.getActiveModels();
    if (!models.length) {
      wrap.innerHTML = '<em style="font-size:11px;color:#999">Select models from the sidebar to render radar chart.</em>'; return;
    }
    wrap.innerHTML = '<div style="display:flex;gap:20px;align-items:flex-start;flex-wrap:wrap">'
      + CHARTS.radarSVG(models)
      + CHARTS.radarLegend(models)
      + '<div style="font-size:10px;color:#999;max-width:200px;line-height:1.6;margin-top:10px">'
        + '<strong>How to read:</strong><br>'
        + '• Outer edge = best in class<br>'
        + '• Efficiency axes are inverted (lower cost/CO₂/power = better = outer)<br>'
        + '• Context & Speed: higher = outer'
      + '</div>'
    + '</div>';
  }

  function populateBreakEvenSelects() {
    var models = STATE.getModels().slice(0, 60);
    var opts = '<option value="">— select model —</option>'
      + models.map(function(m){
          var sname = m.name || m.id.split('/').pop();
          return '<option value="'+m.id+'">'+sname+'</option>';
        }).join('');
    var sa = document.getElementById('be-a'), sb = document.getElementById('be-b');
    if (sa) sa.innerHTML = opts;
    if (sb) sb.innerHTML = opts;
    if (sa && models.length > 0) sa.value = models[0].id;
    if (sb && models.length > 1) sb.value = models[1].id;
  }

  function calcBreakEven() {
    var aId = (document.getElementById('be-a')||{}).value;
    var bId = (document.getElementById('be-b')||{}).value;
    var inTok = parseInt((document.getElementById('be-in')||{}).value||10000000);
    var outTok = parseInt((document.getElementById('be-out')||{}).value||3000000);
    var resEl = document.getElementById('be-results');
    var chartEl = document.getElementById('be-chart');
    if (!aId || !bId || aId === bId || !resEl) return;
    var mA = STATE.getModels().find(function(m){return m.id===aId;});
    var mB = STATE.getModels().find(function(m){return m.id===bId;});
    if (!mA || !mB) return;
    var costA = CALC.cost(mA, inTok, outTok);
    var costB = CALC.cost(mB, inTok, outTok);
    var savings = Math.abs(costA - costB);
    var cheaper = costA < costB ? (mA.name||mA.id.split('/').pop()) : (mB.name||mB.id.split('/').pop());
    var savPct = (costA && costB) ? (savings / Math.max(costA,costB) * 100).toFixed(0) : 0;
    var nameA = mA.name || mA.id.split('/').pop();
    var nameB = mB.name || mB.id.split('/').pop();
    function fc(v) { return CALC.fmtCost(v); }
    resEl.innerHTML =
      '<div class="be-result-card"><div class="brv">'+fc(costA)+'</div><div class="brl">'+nameA+' / month</div></div>'
      +'<div class="be-result-card"><div class="brv">'+fc(costB)+'</div><div class="brl">'+nameB+' / month</div></div>'
      +'<div class="be-result-card"><div class="brv" style="color:var(--green)">'+savPct+'% · '+fc(savings)+'</div><div class="brl">Monthly savings choosing '+cheaper+'</div></div>';
    // Crossover SVG chart
    if (chartEl) {
      var maxVol = inTok * 3; var steps = 10;
      var pts = [], ptsB = [], labels = [];
      for (var i=1; i<=steps; i++) {
        var vol = (inTok / steps) * i;
        pts.push(CALC.cost(mA, vol, (outTok/inTok)*vol));
        ptsB.push(CALC.cost(mB, vol, (outTok/inTok)*vol));
        labels.push((vol/1e6).toFixed(1)+'M');
      }
      var W=560, H=160, pl=60, pr=14, pt=14, pb=34;
      var iw=W-pl-pr, ih=H-pt-pb;
      var maxC=Math.max.apply(null,pts.concat(ptsB).concat([0.000001]));
      function fx(i){return pl+(i/(steps-1))*iw;}
      function fy(v){return pt+ih-(v/maxC)*ih;}
      var gridSVG=''; var lineA=''; var lineB='';
      for (var g=0;g<=3;g++){
        var yy=pt+ih*(1-g/3);
        gridSVG+='<line x1="'+pl+'" y1="'+yy.toFixed(1)+'" x2="'+(W-pr)+'" y2="'+yy.toFixed(1)+'" stroke="#E2E2E2" stroke-dasharray="3,3"/>';
        gridSVG+='<text x="'+(pl-3)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#999">'+fc(maxC*g/3)+'</text>';
      }
      pts.forEach(function(v,i){lineA+=(i?'L':'M')+fx(i).toFixed(1)+','+fy(v).toFixed(1);});
      ptsB.forEach(function(v,i){lineB+=(i?'L':'M')+fx(i).toFixed(1)+','+fy(v).toFixed(1);});
      labels.forEach(function(l,i){
        gridSVG+='<text x="'+fx(i).toFixed(1)+'" y="'+(H-pb+13)+'" text-anchor="middle" font-size="9" fill="#888">'+l+'</text>';
      });
      chartEl.innerHTML='<svg width="'+W+'" height="'+H+'" style="max-width:100%;display:block">'
        +'<text x="'+pl+'" y="11" font-size="9" fill="#999">Monthly cost vs token volume — input tokens (output scaled proportionally)</text>'
        +gridSVG
        +'<path d="'+lineA+'" fill="none" stroke="#0A6B3C" stroke-width="2.5" stroke-linecap="round"/>'
        +'<path d="'+lineB+'" fill="none" stroke="#0062CC" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="6,3"/>'
        +'<rect x="'+pl+'" y="'+pt+'" width="'+iw+'" height="'+ih+'" fill="none" stroke="#E2E2E2"/>'
        +'<rect x="'+(W-pr-130)+'" y="'+(pt+4)+'" width="12" height="3" fill="#0A6B3C" rx="1"/>'
        +'<text x="'+(W-pr-114)+'" y="'+(pt+10)+'" font-size="9" fill="#666">'+nameA+'</text>'
        +'<rect x="'+(W-pr-130)+'" y="'+(pt+17)+'" width="12" height="3" fill="#0062CC" rx="1"/>'
        +'<text x="'+(W-pr-114)+'" y="'+(pt+23)+'" font-size="9" fill="#666">'+nameB+'</text>'
        +'</svg>';
    }
  }

  return {render, calcCtx, renderRadar, populateBreakEvenSelects, calcBreakEven};
})();


