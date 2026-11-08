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

  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function icon(name) { return window.TL_ICON ? window.TL_ICON(name) : ''; }

  /* ── source citation HTML ── */
  function _src(title, desc, url) {
    return '<p class="expl-source"><strong>'+title+'</strong> '
      +(url ? '<a href="'+url+'" target="_blank" rel="noopener">'+desc+'</a>' : desc)
    +'</p>';
  }

  /* ── kv HTML ── */
  function _kv(label, val, sub) {
    return '<div class="expl-kv"><div class="expl-kv-label">'+label+'</div><div class="expl-kv-val">'+val+'</div>'+(sub?'<div class="expl-kv-sub">'+sub+'</div>':'')+'</div>';
  }
  function _kvs(inner) { return '<div class="expl-kvs">'+inner+'</div>'; }

  /* ── equivalents list ── */
  function _eqs(items) {
    return '<ul class="expl-equivs">'+items.map(function(t){ return '<li>'+t+'</li>'; }).join('')+'</ul>';
  }

  /* ── formula HTML ── */
  function _formula(lines) {
    return '<pre class="expl-formula">'+lines+'</pre>';
  }
  function _c(t) { return '<span class="hf-comment">'+t+'</span>'; }
  function _out(t) { return '<span class="hf-out">'+t+'</span>'; }

  var CLOSED_KEY = 'tl_ui_expl_closed';
  function _closedSet() {
    try { return JSON.parse(localStorage.getItem(CLOSED_KEY) || '[]'); } catch(e) { return []; }
  }
  function _section(key, title, inner) {
    var closed = _closedSet().indexOf(key) > -1;
    var id = 'expl-sec-' + key;
    return '<section class="expl-section fold'+(closed ? '' : ' is-open')+'" data-key="'+key+'">'
      +'<h3><button type="button" class="fold-btn" aria-expanded="'+(!closed)+'" aria-controls="'+id+'"><span>'+title+'</span><span class="ic">'+icon('chevronDown')+'</span></button></h3>'
      +'<div class="fold-body" id="'+id+'"'+(closed ? ' inert' : '')+'><div class="fold-inner">'+inner+'</div></div>'
    +'</section>';
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

    var ceq = _co2Equiv(co2_g);
    var weq = _waterEquiv(water_mL);
    var peq = _powerEquiv(power_Wh);

    var title = document.getElementById('explain-modal-title');
    var sub   = document.getElementById('explain-modal-sub');
    var body  = document.getElementById('explain-modal-body');
    title.textContent = 'Turn ' + turnData.turnNum + ' · ' + modelId;
    sub.textContent   = 'Step-by-step calculation from research anchors and live pricing';

    body.innerHTML =
      '<div class="expl-tools"><button type="button" class="bn-copy" data-expl-copy aria-label="Copy the full breakdown"><span class="ic">'+icon('copy')+'</span><span class="bn-copy-label">Copy breakdown</span></button></div>'

      +_section('tokens', 'Token counting',
        _kvs(
          _kv('Input tokens', iT.toLocaleString(), 'from prompt text (BPE approx.)')
          +_kv('Output tokens', oT.toLocaleString(), 'generated response')
          +_kv('Total tokens', total_T.toLocaleString(), 'input + output')
          +_kv('Context total', (turnData.contextTokens||0).toLocaleString(), 'accumulated this turn')
        )
        +_formula(
          _c('// BPE ≈ 1 token per 3.8 chars (cl100k_base calibration)')+'\n'
          +'inputTokens  = '+iT+'\n'
          +'outputTokens = '+oT
        )
        +_src('OpenAI BPE tokenizer', 'platform.openai.com/tokenizer', 'https://platform.openai.com/tokenizer'))

      +_section('cost', 'Cost calculation',
        _formula(
          _c('// Live pricing from OpenRouter API (USD per 1M tokens)')+'\n'
          +'inputCost  = '+iT+' / 1,000,000 × $'+_fmt(inPrice,4)+'/M  = $'+_fmt(iT/1e6*inPrice,6)+'\n'
          +'outputCost = '+oT+' / 1,000,000 × $'+_fmt(outPrice,4)+'/M = $'+_fmt(oT/1e6*outPrice,6)+'\n'
          +_out('totalCost  = $'+_fmt(cost,6))
        )
        +_kvs(
          _kv('Input price', '$'+_fmt(inPrice,4)+'/1M', 'from OpenRouter live API')
          +_kv('Output price', '$'+_fmt(outPrice,4)+'/1M', 'from OpenRouter live API')
          +_kv('Input cost', '$'+_fmt(iT/1e6*inPrice,6), iT+' tokens billed')
          +_kv('Output cost', '$'+_fmt(oT/1e6*outPrice,6), oT+' tokens billed')
        )
        +_src('OpenRouter models API', 'openrouter.ai/api/v1/models (public, no auth required)', 'https://openrouter.ai/api/v1/models'))

      +_section('power', 'Power consumption',
        _formula(
          _c('// Anchor: Luccioni et al. 2023, Table 3: 6B model ≈ 540 Wh/1M tokens')+'\n'
          +'totalTokens = '+iT+' + '+oT+' = '+total_T+'\n'
          +'powerRate   = '+_fmt(pRate,0)+' Wh/1M tokens  '+_c('// model-specific research anchor')+'\n'
          +_out('power_Wh    = '+total_T+' / 1,000,000 × '+_fmt(pRate,0)+' = '+_fmt(power_Wh,4)+' Wh')
        )
        +_kvs(
          _kv('Power rate', _fmt(pRate,0)+' Wh/1M', 'research-anchored for this model family')
          +_kv('Turn power', _fmt(power_Wh,4)+' Wh', total_T+' tokens processed')
        )
        +_src('Luccioni et al. 2023', 'arXiv:2311.16863, "Power Hungry Processing: Watts Driving the Cost of AI Deployment?"', 'https://arxiv.org/abs/2311.16863')
        +_eqs([peq.charges, peq.led]))

      +_section('co2', 'CO₂ emissions',
        _formula(
          _c('// Provider: '+provPrefix+' → '+prov.host+'  carbon intensity: '+prov.co2+' gCO₂/kWh')+'\n'
          +'power_kWh = '+_fmt(power_Wh,4)+' Wh ÷ 1000 = '+_fmt(power_Wh/1000,6)+' kWh\n'
          +_out('co2_grams = '+_fmt(power_Wh/1000,6)+' × '+prov.co2+' = '+_fmt(co2_g,4)+' g CO₂')
        )
        +_kvs(
          _kv('Grid intensity', prov.co2+' gCO₂/kWh', prov.host)
          +_kv('CO₂ this turn', _fmt(co2_g,4)+' g', (co2_g*1000).toFixed(2)+' mg')
        )
        +_src('Provider sustainability reports', 'Google, AWS and Azure disclosures plus EPA eGRID 2023', 'https://www.epa.gov/egrid')
        +_eqs([ceq.car, ceq.fly]))

      +_section('water', 'Water consumption',
        _formula(
          _c('// WUE = Water Usage Effectiveness; '+prov.host+' WUE ≈ '+prov.water+' L/kWh')+'\n'
          +'power_kWh  = '+_fmt(power_Wh/1000,6)+' kWh\n'
          +'water_L    = '+_fmt(power_Wh/1000,6)+' × '+prov.water+' = '+_fmt(power_Wh/1000*prov.water,6)+' L\n'
          +_out('water_mL   = '+_fmt(water_mL,3)+' mL')
        )
        +_kvs(
          _kv('WUE', prov.water+' L/kWh', prov.host+' (Li 2023 framework)')
          +_kv('Water this turn', _fmt(water_mL,3)+' mL', weq.glasses)
        )
        +_src('Li et al. 2023', 'arXiv:2304.03271, "Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models"', 'https://arxiv.org/abs/2304.03271')
        +_eqs([weq.glasses, weq.teaspoons]));

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
    var el = document.getElementById('hiw-result');
    el._ran = true;

    if (!promptText) {
      el.innerHTML = '<div class="hiw-warn">Enter some prompt text above to see the calculation.</div>';
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

    function kpi(label, val, sub) {
      return '<div class="bn-kpi"><div class="bn-kpi-l">'+label+'</div><div class="bn-kpi-v">'+val+'</div><div class="bn-kpi-s">'+sub+'</div></div>';
    }
    el.innerHTML =
      '<div class="bn-kpis">'
        +kpi('Input tokens', iT.toLocaleString(), '≈ '+promptText.length+' chars ÷ 3.8')
        +kpi('Output tokens', oT.toLocaleString(), '≈ input × 1.8')
        +kpi('Power', power.toFixed(4)+' Wh', total+' tokens × '+powerRate+' Wh/1M')
        +kpi('CO₂', co2.toFixed(4)+' g', power.toFixed(4)+' Wh ÷ 1000 × '+prov.co2+' gCO₂/kWh')
        +kpi('Water', water.toFixed(3)+' mL', power.toFixed(4)+' Wh ÷ 1000 × '+prov.water+' L/kWh × 1000')
      +'</div>'
      +'<p class="hiw-eqv">Real-world equivalents: '+ceq.car+', '+ceq.fly+', '+weq.glasses+', '+peq.charges+'.</p>';
  }

  /* ══ Page behaviour: collapsibles, copy, table of contents ══ */
  function _toggleFold(btn) {
    var box = btn.closest('.fold');
    if (!box) return;
    var open = !box.classList.contains('is-open');
    box.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', open);
    var body = box.querySelector('.fold-body');
    if (body) { if (open) body.removeAttribute('inert'); else body.setAttribute('inert', ''); }
    var key = box.getAttribute('data-key');
    if (key) {
      var set = _closedSet().filter(function(k) { return k !== key; });
      if (!open) set.push(key);
      try { localStorage.setItem(CLOSED_KEY, JSON.stringify(set)); } catch(e) {}
    }
  }

  function _copy(btn, text, done) {
    var ui = window.UI_BENCHMARKS;
    if (!ui) return;
    ui.copyText(text).then(function(ok) { ui.flashCopied(btn, ok, done); });
  }

  function citationText() {
    return 'TokenLens. "How every number is calculated." Methodology for cost, power, CO2 and water estimates. '
      + location.origin + location.pathname + '. Accessed ' + new Date().toISOString().slice(0, 10) + '.';
  }

  function initHiw() {
    var panel = document.getElementById('howitworks-panel');
    if (!panel || panel._init) return;
    panel._init = true;

    panel.querySelectorAll('[data-calc="cache-factor"]').forEach(function(n) {
      if (window.CALC && CALC.CACHE_ENERGY_FACTOR != null) n.textContent = Math.round(CALC.CACHE_ENERGY_FACTOR * 100) + '%';
    });

    var links = [].slice.call(panel.querySelectorAll('[data-hiw-link]'));
    var secs = links.map(function(a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    var list = panel.querySelector('.hiw-toc-list');
    var current = null;

    function setActive(id) {
      if (current === id) return;
      current = id;
      links.forEach(function(a) {
        var on = a.getAttribute('href') === '#' + id;
        if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
        if (on && list && list.scrollWidth > list.clientWidth + 2 && getComputedStyle(list).flexDirection === 'row') {
          list.scrollTo({ left: a.offsetLeft - (list.clientWidth - a.offsetWidth) / 2, behavior: reduced() ? 'auto' : 'smooth' });
        }
      });
    }
    setActive('hiw-overview');

    if ('IntersectionObserver' in window) {
      var io = null, rt = null;
      var observe = function() {
        if (io) io.disconnect();
        var line = window.innerWidth < 1100 ? 150 : 100;
        io = new IntersectionObserver(function(entries) {
          if (atBottom()) { setActive(secs[secs.length - 1].id); return; }
          entries.forEach(function(e) { if (e.isIntersecting) setActive(e.target.id); });
        }, { rootMargin: '-' + line + 'px 0px -' + Math.max(0, window.innerHeight - line - 1) + 'px 0px', threshold: 0 });
        secs.forEach(function(s) { if (s) io.observe(s); });
      };
      var atBottom = function() {
        var d = document.documentElement;
        return panel.classList.contains('active') && d.scrollHeight > window.innerHeight + 400 && window.innerHeight + window.scrollY >= d.scrollHeight - 4;
      };
      observe();
      window.addEventListener('scroll', function() {
        if (atBottom()) setActive(secs[secs.length - 1].id);
      }, { passive: true });
      window.addEventListener('resize', function() { clearTimeout(rt); rt = setTimeout(observe, 150); });
    }

    panel.addEventListener('click', function(e) {
      var a = e.target.closest('[data-hiw-link]');
      if (a) {
        e.preventDefault();
        var id = a.getAttribute('href').slice(1), t = document.getElementById(id);
        if (!t) return;
        setActive(id);
        t.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
        var h = t.querySelector('h2');
        if (h) { h.setAttribute('tabindex', '-1'); h.focus({ preventScroll: true }); }
        return;
      }
      var f = e.target.closest('.fold-btn');
      if (f) { _toggleFold(f); return; }
      var c = e.target.closest('[data-hiw-copy]');
      if (c) { _copy(c, c.closest('.hiw-code').querySelector('pre').textContent.trim(), 'Copied'); return; }
      var r = e.target.closest('[data-hiw-copy-ref]');
      if (r) { _copy(r, r.closest('li').querySelector('.bn-cite-body').textContent.replace(/\s+/g, ' ').trim(), 'Copied'); return; }
      var cb = e.target.closest('[data-hiw-cite]');
      if (cb) { _copy(cb, citationText(), 'Copied'); }
    });

    var timer = null;
    function rerun() {
      var res = document.getElementById('hiw-result');
      if (!res || !res._ran) return;
      clearTimeout(timer);
      timer = setTimeout(runLiveCalc, 200);
    }
    ['hiw-prompt', 'hiw-provider', 'hiw-power-rate'].forEach(function(id) {
      var n = document.getElementById(id);
      if (n) n.addEventListener(id === 'hiw-provider' ? 'change' : 'input', rerun);
    });
    var ta = document.getElementById('hiw-prompt');
    if (ta) ta.addEventListener('keydown', function(e) {
      if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); runLiveCalc(); }
    });
  }

  function initExplainer() {
    var body = document.getElementById('explain-modal-body');
    if (!body || body._init) return;
    body._init = true;
    body.addEventListener('click', function(e) {
      var f = e.target.closest('.fold-btn');
      if (f) { _toggleFold(f); return; }
      var c = e.target.closest('[data-expl-copy]');
      if (c) {
        var parts = [].slice.call(body.querySelectorAll('.expl-section')).map(function(sec) {
          return sec.querySelector('h3').textContent.trim() + '\n' + [].slice.call(sec.querySelectorAll('.expl-formula')).map(function(p) { return p.textContent; }).join('\n');
        });
        _copy(c, document.getElementById('explain-modal-title').textContent + '\n\n' + parts.join('\n\n'), 'Copied');
      }
    });
  }

  // Close on overlay click
  document.addEventListener('click', function(e) {
    if (e.target.id === 'explain-overlay') close();
  });
  // Close on Escape
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
      var ov = document.getElementById('explain-overlay');
      if (ov && ov.classList.contains('open')) close();
    }
  });

  initHiw();
  initExplainer();

  return { showTurnExplainer: showTurnExplainer, close: close, runLiveCalc: runLiveCalc, initHiw: initHiw };
})();
