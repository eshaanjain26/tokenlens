/* ══════════════════════════════════════════════════════════
   MODULE — EXPLAIN  (Calculation Transparency)
   showTurnExplainer(modelId, turn) — per-turn formula modal
   runLiveCalc()                    — How It Works live calc
   ══════════════════════════════════════════════════════════ */
window.EXPLAIN = (function() {

  /* ── provider profiles (mirrors DATA.PROVIDER_PROFILES) ── */
  var PROV = {
    'openai':     { co2: 250,  water: 11.5, host: 'Azure (US)' },
    'anthropic':  { co2: 180,  water:  3.8, host: 'AWS (US)' },
    'google':     { co2:  90,  water:  5.4, host: 'GCP' },
    'meta-llama': { co2: 200,  water:  2.3, host: 'Meta DC' },
    'mistralai':  { co2: 280,  water:  6.0, host: 'Various EU' },
    'deepseek':   { co2: 600,  water: 19.0, host: 'China grid' },
    'x-ai':       { co2: 280,  water:  8.0, host: 'xAI DC (TN)' },
    'cohere':     { co2: 180,  water:  4.5, host: 'GCP/AWS' },
    'perplexity': { co2: 180,  water:  3.8, host: 'AWS' },
    'qwen':       { co2: 550,  water: 18.0, host: 'Alibaba/China' },
    'microsoft':  { co2: 250,  water: 11.5, host: 'Azure (US)' },
    '_default':   { co2: 300,  water:  8.0, host: 'Unknown' },
  };

  function _getProvider(modelId) {
    var prefix = (modelId||'').split('/')[0].toLowerCase();
    return PROV[prefix] || PROV['_default'];
  }

  /* ── equivalents ── */
  function _co2Equiv(grams) {
    var km_car = (grams / 404).toFixed(3);
    var km_fly = (grams / 255).toFixed(3);
    return { car: km_car + ' km driven (petrol car)', fly: km_fly + ' km flown (economy)' };
  }
  function _waterEquiv(mL) {
    var glasses = (mL / 250).toFixed(2);
    var teaspoons = (mL / 5).toFixed(1);
    return { glasses: glasses + ' drinking glasses (250 mL)', teaspoons: teaspoons + ' teaspoons' };
  }
  function _powerEquiv(wh) {
    var charges = (wh / 15).toFixed(2);
    var ledHours = (wh / 10).toFixed(2);
    return { charges: charges + ' phone charges (15 Wh)', led: ledHours + ' hrs of LED bulb (10W)' };
  }

  function _fmt(n, dec) { return (+n).toFixed(dec !== undefined ? dec : 4); }

  /* ── source citation HTML ── */
  function _src(icon, title, desc, url) {
    return '<div class="expl-source-row">'
      +'<div class="expl-source-icon">'+icon+'</div>'
      +'<div class="expl-source-body">'
        +'<strong>'+title+'</strong>'
        +(url ? '<a href="'+url+'" target="_blank" rel="noopener">'+desc+'</a>' : '<span style="font-size:10px;color:var(--text-2)">'+desc+'</span>')
      +'</div>'
    +'</div>';
  }

  /* ── kv card HTML ── */
  function _kv(label, val, sub) {
    return '<div class="expl-kv"><div class="expl-kv-label">'+label+'</div><div class="expl-kv-val">'+val+'</div>'+(sub?'<div class="expl-kv-sub">'+sub+'</div>':'')+'</div>';
  }

  /* ── equiv row HTML ── */
  function _eq(icon, text, cls) {
    return '<div class="expl-equiv-row '+(cls||'')+'">'
      +'<span style="font-size:18px">'+icon+'</span>'
      +'<span style="font-weight:600;font-size:12px">'+text+'</span>'
    +'</div>';
  }

  /* ── formula line HTML ── */
  function _formula(lines) {
    return '<div class="expl-formula-box"><div style="font-family:monospace;font-size:11.5px;line-height:2">'+lines+'</div></div>';
  }

  function _sectionTitle(emoji, title) {
    return '<div class="expl-section-title">'+emoji+' '+title+'</div>';
  }

  /* ══ MAIN: show per-turn explainer ══ */
  function showTurnExplainer(modelId, turnData) {
    var prov     = _getProvider(modelId);
    var iT       = turnData.inputTokens;
    var oT       = turnData.outputTokens;
    var total_T  = iT + oT;
    var cost     = turnData.cost;
    var power_Wh = turnData.power;
    var co2_g    = turnData.co2;
    var water_mL = turnData.water;
    var pRate    = turnData.powerRate || (power_Wh / (total_T / 1e6) || 0);
    var inPrice  = turnData.priceIn  || 0;
    var outPrice = turnData.priceOut || 0;
    var provPrefix = (modelId||'').split('/')[0];

    // equivalents
    var ceq = _co2Equiv(co2_g);
    var weq = _waterEquiv(water_mL);
    var peq = _powerEquiv(power_Wh);

    var title = document.getElementById('explain-modal-title');
    var sub   = document.getElementById('explain-modal-sub');
    var body  = document.getElementById('explain-modal-body');
    title.textContent = '🔬 Turn ' + turnData.turnNum + ' · ' + modelId;
    sub.textContent   = 'Step-by-step calculation — all values from research anchors and live pricing';

    body.innerHTML =

      /* ── Token counting ── */
      '<div class="expl-section">'
        +_sectionTitle('📝','Token Counting')
        +'<div class="expl-grid-2">'
          +_kv('Input tokens', iT.toLocaleString(), 'from prompt text (BPE approx.)')
          +_kv('Output tokens', oT.toLocaleString(), 'generated response')
          +_kv('Total tokens', total_T.toLocaleString(), 'input + output')
          +_kv('Context total', (turnData.contextTokens||0).toLocaleString(), 'accumulated this turn')
        +'</div>'
        +_formula(
          '<span style="color:#94A3B8;font-size:10px">// BPE ≈ 1 token per 3.8 chars (cl100k_base calibration)</span>\n'
          +'inputTokens  = '+iT+'\n'
          +'outputTokens = '+oT+'\n'
        )
        +_src('📖','OpenAI BPE Tokenizer','platform.openai.com/tokenizer','https://platform.openai.com/tokenizer')
      +'</div>'

      /* ── Cost ── */
      +'<div class="expl-section">'
        +_sectionTitle('💰','Cost Calculation')
        +_formula(
          '<span style="color:#94A3B8;font-size:10px">// Live pricing from OpenRouter API (USD per 1M tokens)</span>\n'
          +'inputCost  = '+iT+' / 1,000,000 × $'+_fmt(inPrice,4)+'/M  = $'+_fmt(iT/1e6*inPrice,6)+'\n'
          +'outputCost = '+oT+' / 1,000,000 × $'+_fmt(outPrice,4)+'/M = $'+_fmt(oT/1e6*outPrice,6)+'\n'
          +'<span style="color:#34D399;font-weight:900;font-size:13px">totalCost  = $'+_fmt(cost,6)+'</span>'
        )
        +'<div class="expl-grid-2">'
          +_kv('Input price', '$'+_fmt(inPrice,4)+'/1M', 'from OpenRouter live API')
          +_kv('Output price', '$'+_fmt(outPrice,4)+'/1M', 'from OpenRouter live API')
          +_kv('Input cost', '$'+_fmt(iT/1e6*inPrice,6), iT+' tokens billed')
          +_kv('Output cost', '$'+_fmt(oT/1e6*outPrice,6), oT+' tokens billed')
        +'</div>'
        +_src('🔗','OpenRouter Models API','openrouter.ai/api/v1/models — public, no auth required','https://openrouter.ai/api/v1/models')
      +'</div>'

      /* ── Power ── */
      +'<div class="expl-section">'
        +_sectionTitle('⚡','Power Consumption')
        +_formula(
          '<span style="color:#94A3B8;font-size:10px">// Anchor: Luccioni et al. 2023, Table 3 — 6B model ≈ 540 Wh/1M tokens</span>\n'
          +'totalTokens = '+iT+' + '+oT+' = '+total_T+'\n'
          +'powerRate   = '+_fmt(pRate,0)+' Wh/1M tokens  <span style="color:#64748B;font-size:10px">// model-specific research anchor</span>\n'
          +'<span style="color:#34D399;font-weight:900;font-size:13px">power_Wh    = '+total_T+' / 1,000,000 × '+_fmt(pRate,0)+' = '+_fmt(power_Wh,4)+' Wh</span>'
        )
        +_src('📄','Luccioni et al. 2023','arXiv:2311.16863 — "Power Hungry Processing: Watts Driving the Cost of AI Deployment?"','https://arxiv.org/abs/2311.16863')
        +'<div class="expl-grid-2">'
          +_kv('Power rate', _fmt(pRate,0)+' Wh/1M', 'research-anchored for this model family')
          +_kv('Turn power', _fmt(power_Wh,4)+' Wh', total_T+' tokens processed')
        +'</div>'
        +_eq('🔌', peq.charges, 'blue')
        +_eq('💡', peq.led, 'blue')
      +'</div>'

      /* ── CO2 ── */
      +'<div class="expl-section">'
        +_sectionTitle('🌱','CO₂ Emissions')
        +_formula(
          '<span style="color:#94A3B8;font-size:10px">// Provider: '+provPrefix+' → '+prov.host+'  carbon intensity: '+prov.co2+' gCO₂/kWh</span>\n'
          +'power_kWh = '+_fmt(power_Wh,4)+' Wh ÷ 1000 = '+_fmt(power_Wh/1000,6)+' kWh\n'
          +'<span style="color:#34D399;font-weight:900;font-size:13px">co2_grams = '+_fmt(power_Wh/1000,6)+' × '+prov.co2+' = '+_fmt(co2_g,4)+' g CO₂</span>'
        )
        +'<div class="expl-grid-2">'
          +_kv('Grid intensity', prov.co2+' gCO₂/kWh', prov.host)
          +_kv('CO₂ this turn', _fmt(co2_g,4)+' g', (co2_g*1000).toFixed(2)+' mg')
        +'</div>'
        +_src('🌍','Provider Sustainability Reports','Google/AWS/Azure sustainability disclosures + EPA eGRID 2023','https://www.epa.gov/egrid')
        +_eq('🚗', ceq.car, 'amber')
        +_eq('✈️', ceq.fly, 'amber')
      +'</div>'

      /* ── Water ── */
      +'<div class="expl-section">'
        +_sectionTitle('💧','Water Consumption')
        +_formula(
          '<span style="color:#94A3B8;font-size:10px">// WUE = Water Usage Effectiveness; '+prov.host+' WUE ≈ '+prov.water+' L/kWh</span>\n'
          +'power_kWh  = '+_fmt(power_Wh/1000,6)+' kWh\n'
          +'water_L    = '+_fmt(power_Wh/1000,6)+' × '+prov.water+' = '+_fmt(power_Wh/1000*prov.water,6)+' L\n'
          +'<span style="color:#34D399;font-weight:900;font-size:13px">water_mL   = '+_fmt(water_mL,3)+' mL</span>'
        )
        +'<div class="expl-grid-2">'
          +_kv('WUE', prov.water+' L/kWh', prov.host+' (Li 2023 framework)')
          +_kv('Water this turn', _fmt(water_mL,3)+' mL', weq.glasses+' drinking glasses')
        +'</div>'
        +_src('📄','Li et al. 2023','arXiv:2304.03271 — "Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models"','https://arxiv.org/abs/2304.03271')
        +_eq('💧', weq.glasses, 'blue')
        +_eq('🥄', weq.teaspoons, 'blue')
      +'</div>';

    document.getElementById('explain-overlay').classList.add('open');
  }

  function close() {
    document.getElementById('explain-overlay').classList.remove('open');
  }

  /* ══ Live calculator (How It Works tab) ══ */
  function runLiveCalc() {
    var promptText = (document.getElementById('hiw-prompt').value || '').trim();
    var provKey    = document.getElementById('hiw-provider').value;
    var powerRate  = parseFloat(document.getElementById('hiw-power-rate').value) || 2800;
    var prov       = PROV[provKey] || PROV['_default'];

    if (!promptText) {
      document.getElementById('hiw-result').innerHTML = '<div style="color:var(--amber);font-size:12px;padding:8px">Please enter some prompt text above.</div>';
      return;
    }

    var iT     = Math.ceil(promptText.length / 3.8);
    var oT     = Math.ceil(iT * 1.8);
    var total  = iT + oT;
    var power  = total / 1e6 * powerRate;
    var co2    = power / 1000 * prov.co2;
    var water  = power / 1000 * prov.water * 1000;
    var ceq    = _co2Equiv(co2);
    var weq    = _waterEquiv(water);
    var peq    = _powerEquiv(power);

    var el = document.getElementById('hiw-result');
    el.innerHTML =
      '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:10px;margin-bottom:14px">'
        +'<div class="hiw-result-card" style="background:white;border:1.5px solid var(--tl-border);border-radius:10px;padding:12px">'
          +'<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">📥 Input tokens</div>'
          +'<div style="font-size:18px;font-weight:900;color:var(--tl)">'+iT.toLocaleString()+'</div>'
          +'<div style="font-size:10px;color:var(--text-2)">≈ '+promptText.length+' chars ÷ 3.8</div>'
        +'</div>'
        +'<div class="hiw-result-card" style="background:white;border:1.5px solid var(--tl-border);border-radius:10px;padding:12px">'
          +'<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">📤 Output tokens</div>'
          +'<div style="font-size:18px;font-weight:900;color:var(--tl)">'+oT.toLocaleString()+'</div>'
          +'<div style="font-size:10px;color:var(--text-2)">≈ input × 1.8</div>'
        +'</div>'
        +'<div class="hiw-result-card" style="background:white;border:1.5px solid var(--tl-border);border-radius:10px;padding:12px">'
          +'<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">⚡ Power</div>'
          +'<div style="font-size:18px;font-weight:900;color:var(--amber)">'+power.toFixed(4)+' Wh</div>'
          +'<div style="font-size:10px;color:var(--text-2)">'+total+' tokens × '+powerRate+' Wh/1M</div>'
        +'</div>'
        +'<div class="hiw-result-card" style="background:white;border:1.5px solid var(--tl-border);border-radius:10px;padding:12px">'
          +'<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">🌱 CO₂</div>'
          +'<div style="font-size:18px;font-weight:900;color:var(--green)">'+co2.toFixed(4)+' g</div>'
          +'<div style="font-size:10px;color:var(--text-2)">'+power.toFixed(4)+' Wh ÷ 1000 × '+prov.co2+' gCO₂/kWh</div>'
        +'</div>'
        +'<div class="hiw-result-card" style="background:white;border:1.5px solid var(--tl-border);border-radius:10px;padding:12px">'
          +'<div style="font-size:10px;color:var(--text-3);margin-bottom:4px">💧 Water</div>'
          +'<div style="font-size:18px;font-weight:900;color:#0369A1">'+water.toFixed(3)+' mL</div>'
          +'<div style="font-size:10px;color:var(--text-2)">'+power.toFixed(4)+' Wh ÷ 1000 × '+prov.water+' L/kWh × 1000</div>'
        +'</div>'
      +'</div>'
      +'<div style="font-size:11px;color:var(--text-2);line-height:1.8;background:white;border-radius:8px;padding:10px 14px;border:1px solid var(--border)">'
        +'<strong>Real-world equivalents:</strong> '
        +ceq.car+' &nbsp;·&nbsp; '+ceq.fly+' &nbsp;·&nbsp; '+weq.glasses+' &nbsp;·&nbsp; '+peq.charges
      +'</div>';
  }

  // Close on overlay click
  document.addEventListener('click', function(e) {
    if (e.target.id === 'explain-overlay') close();
  });
  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') close();
  });

  return { showTurnExplainer: showTurnExplainer, close: close, runLiveCalc: runLiveCalc };
})();

