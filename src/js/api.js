/* ══════════════════════════════════════════════════════════
   MODULE 4 — API
   OpenRouter model fetch + optional live completions
   ══════════════════════════════════════════════════════════ */
window.API = (function() {

  var _key = '';
  function setKey(k) { _key = k.trim(); }
  function hasKey()  { return _key.length > 10; }

  var _pricingLoadedAt = null;
  var _pricingIsLive   = false;
  var _pricingSource   = 'fallback'; // 'live' | 'cache' | 'fallback'
  var CACHE_KEY = 'tl_pricing_cache_v1';
  var CACHE_TTL = 24 * 60 * 60 * 1000; // 24h

  function _readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !parsed.ts || !Array.isArray(parsed.models) || !parsed.models.length) return null;
      return parsed;
    } catch(e) { return null; }
  }

  function _writeCache(models) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), models: models })); }
    catch(e) { /* localStorage full or unavailable — cache is best-effort */ }
  }

  async function fetchModels() {
    // 1. Serve from localStorage if within the 24h TTL — avoids hitting
    //    OpenRouter on every page load while keeping pricing reasonably fresh.
    var cached = _readCache();
    if (cached && (Date.now() - cached.ts) < CACHE_TTL) {
      _pricingLoadedAt = cached.ts;
      _pricingIsLive   = true;
      _pricingSource   = 'cache';
      _updatePricingBadge();
      return cached.models;
    }
    // 2. Cache missing or stale — fetch live.
    try {
      var r = await fetch('https://openrouter.ai/api/v1/models');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      var j = await r.json();
      var models = (j.data || []).filter(function(m) {
        return m.pricing && m.pricing.prompt && m.context_length > 0;
      });
      if (!models.length) throw new Error('Empty model list from OpenRouter');
      _pricingLoadedAt = Date.now();
      _pricingIsLive   = true;
      _pricingSource   = 'live';
      _writeCache(models);
      _updatePricingBadge();
      return models;
    } catch(e) {
      // 3. Network failed — fall back to a stale cache if we have one
      //    (better than the hardcoded list, which never updates at all),
      //    otherwise use the hardcoded fallback.
      if (cached) {
        _pricingLoadedAt = cached.ts;
        _pricingIsLive   = false;
        _pricingSource   = 'cache';
        _updatePricingBadge();
        return cached.models;
      }
      _pricingLoadedAt = Date.now();
      _pricingIsLive   = false;
      _pricingSource   = 'fallback';
      _updatePricingBadge();
      return DATA.FALLBACK_MODELS;
    }
  }

  function _relTime(ts) {
    var mins = Math.round((Date.now() - ts) / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return mins + 'm ago';
    var hrs = Math.round(mins / 60);
    if (hrs < 24) return hrs + 'h ago';
    return Math.round(hrs / 24) + 'd ago';
  }

  function _updatePricingBadge() {
    var bar = document.getElementById('freshness-bar');
    if (!bar) return;
    var existing = document.getElementById('pricing-badge');
    if (existing) existing.remove();
    var badge = document.createElement('span');
    badge.id = 'pricing-badge';
    var pricingSpan = bar.querySelector('[data-pricing]');
    var when = _pricingLoadedAt ? ' (' + _relTime(_pricingLoadedAt) + ')' : '';
    if (_pricingSource === 'live') {
      badge.className = 'pricing-badge live';
      badge.textContent = '✓ Live' + when;
      badge.style.cssText = 'background:#ECFAF4;color:#0A6B3C;padding:1px 7px;border-radius:12px;font-size:10px;font-weight:700;margin-left:5px';
    } else if (_pricingSource === 'cache') {
      badge.className = 'pricing-badge cached';
      badge.textContent = (_pricingIsLive ? '✓ Cached' : '⚠ Cached (offline)') + when;
      badge.style.cssText = 'background:#EAF3FB;color:#0072A3;padding:1px 7px;border-radius:12px;font-size:10px;font-weight:700;margin-left:5px';
    } else {
      badge.className = 'pricing-badge stale';
      badge.textContent = '⚠ Offline fallback';
      badge.style.cssText = 'background:#FFF4EB;color:#C45000;padding:1px 7px;border-radius:12px;font-size:10px;font-weight:700;margin-left:5px';
    }
    badge.title = _pricingLoadedAt ? 'Pricing fetched ' + new Date(_pricingLoadedAt).toLocaleString() + ' — cached locally for 24h' : '';
    if (pricingSpan) pricingSpan.appendChild(badge);
    else bar.appendChild(badge);
    // Warn once pricing crosses the 2-hour mark within this tab session,
    // regardless of whether it came from a live fetch or the cache.
    if (_pricingSource !== 'fallback') {
      setTimeout(function() {
        badge.textContent = '⚠ Pricing may be stale' + (_pricingLoadedAt ? ' (' + _relTime(_pricingLoadedAt) + ')' : '');
        badge.style.cssText = 'background:#FFF4EB;color:#C45000;padding:1px 7px;border-radius:12px;font-size:10px;font-weight:700;margin-left:5px';
        TOAST.warning('Pricing data is over 2 hours old. Reload to refresh (cache expires after 24h).');
      }, 2 * 60 * 60 * 1000);
    }
  }

  async function callModel(modelId, promptText, history) {
    if (!hasKey()) return null;
    try {
      var messages = [];
      (history || []).forEach(function(h) {
        messages.push({role:'user',      content:h.prompt});
        messages.push({role:'assistant', content:h.response});
      });
      messages.push({role:'user', content:promptText});
      var r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method:'POST',
        headers:{
          'Content-Type':'application/json',
          'Authorization':'Bearer ' + _key,
          'HTTP-Referer':'https://llm-token-intelligence.local',
          'X-Title':'LLM Token Intelligence'
        },
        body: JSON.stringify({model:modelId, messages:messages, max_tokens:2000})
      });
      if (!r.ok) return null;
      var j = await r.json();
      return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content) || null;
    } catch(e) {
      /* callModel error — returns simulated response below */
      return null;
    }
  }

  function simulateResponse(modelId, promptText) {
    var intent = TOKEN_ENGINE.detectIntent(promptText);
    var name   = modelId.split('/').pop().replace(/-/g,' ');
    var snip   = promptText.slice(0,55);
    // Context-aware variation: inject a unique fingerprint per prompt+model combo so
    // repeated identical prompts show different simulated lengths (mirroring real context drift)
    var _seed  = (promptText.length * 7 + modelId.length * 13 + Date.now() % 997) % 100;
    var _ctx   = _seed < 30 ? '\n\n[Context load: light — ' + (_seed+20) + '% context utilised]'
               : _seed < 65 ? '\n\n[Context load: moderate — ' + (_seed+25) + '% context utilised. Response depth scaled.]'
               : '\n\n[Context load: heavy — ' + (_seed+35) + '% context utilised. Extended reasoning applied with ' + (Math.floor(_seed/10)+2) + ' inference passes.]';
    var t = {
      'one-word':      'Yes.',
      'brief':         '['+name+'] Brief answer: The essential point regarding "'+snip+'..." is to focus on the core mechanism rather than peripheral detail. This addresses your question directly and concisely.',
      'summarize':     '['+name+']\nSummary:\n• Key finding 1: Core argument extracted from the provided context\n• Key finding 2: Supporting evidence and relevant data points\n• Key finding 3: Actionable implications\n\n[Add API key for real summaries]',
      'translate':     '['+name+'] Translation: [Simulated — add API key for real translation of "'+snip+'..."]',
      'code':          '['+name+']\n```python\ndef solution(input_data):\n    """\n    Implementation based on: '+snip+'\n    Add your OpenRouter API key for real code generation.\n    """\n    result = process(input_data)\n    return result\n\ndef process(data):\n    # Core processing logic\n    return data\n```\nThis covers the main case. Add error handling and edge cases for production use.',
      'long-form':     '['+name+']\n\nIntroduction\n\nThis comprehensive analysis examines "'+snip+'..." from multiple perspectives, drawing on current research and real-world applications.\n\nSection 1: Context\nThe background involves several intersecting factors that have emerged recently...\n\nSection 2: Analysis\nExamining the evidence, we see three distinct patterns...\n\n[Simulated — add API key for full model-generated essays]',
      'list':          '['+name+']\n\n1. First key item with supporting rationale\n2. Second consideration and practical implications\n3. Third factor — often overlooked but critical\n4. Fourth point connecting to the broader context\n5. Fifth item for completeness\n\n[Add API key for model-specific list generation]',
      'tutorial':      '['+name+']\n\nStep-by-Step Guide\n\nPrerequisites: Ensure necessary tools and access are in place.\n\nStep 1: Initialize — set up environment and verify dependencies\nStep 2: Configure — adjust settings to your requirements\nStep 3: Implement — follow the core workflow\nStep 4: Test — validate with sample inputs\nStep 5: Deploy — go live with monitoring enabled\n\n[Add API key for detailed step-by-step tutorials]',
      'explain':       '['+name+']\n\nExplanation of "'+snip+'..."\n\n1. Foundational principle — the underlying logic driving the behavior\n2. Practical manifestation — how it appears in real-world scenarios\n3. Key nuance — context matters; edge cases differ\n\nThe critical insight is that...\n\n[Add API key for in-depth explanations]',
      'compare':       '['+name+']\n\nComparison\n\nOption A: Higher capability, greater resource consumption, best for complex tasks\nOption B: Optimized for efficiency, lower cost, covers 80% of use cases\n\nKey differentiator: Choose based on your accuracy-vs-cost trade-off.\nDefault recommendation: Start with Option B; escalate to A only when needed.\n\n[Add API key for real model comparisons]',
      'debug':         '['+name+']\n\nDebug Analysis\n\nLikely root causes:\n1. Input validation — check boundary conditions and null values\n2. State management — verify state updates propagate correctly\n3. Async timing — race conditions cause intermittent failures\n\nFix: add logging at each step to isolate the failure point.\n\n[Add API key for model-specific debugging]',
      'conversational':'['+name+'] Thinking about "'+snip+'..." — the most important consideration is the interplay between accuracy, speed, and cost in this context. The answer depends on your specific constraints, but generally the evidence suggests...\n\n[Simulated response — add your OpenRouter API key in the sidebar for real model answers.]',
    };
    return (t[intent] || t['conversational']) + _ctx;
  }

  return {setKey, hasKey, fetchModels, callModel, simulateResponse};
})();


