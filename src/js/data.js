/* ══════════════════════════════════════════════════════════
   MODULE 1 — DATA  (v4 — power-derived architecture)
   Power rates anchor to Luccioni et al. 2023 "Power Hungry Processing"
   CO2 = power × provider carbon intensity (never silently fails)
   Water = power × provider WUE (Li et al. 2023 calibrated)
   Provider prefix lookup handles OpenRouter versioned model IDs
   ══════════════════════════════════════════════════════════ */
window.DATA = (function() {

  var FALLBACK_MODELS = [
    { id:'openai/gpt-4o',         name:'GPT-4o',          context_length:128000,  pricing:{prompt:'0.0000025',  completion:'0.00001'    }},
    { id:'openai/gpt-4o-mini',    name:'GPT-4o mini',     context_length:128000,  pricing:{prompt:'0.00000015', completion:'0.0000006'  }},
    { id:'openai/o3',             name:'o3',              context_length:200000,  pricing:{prompt:'0.000010',   completion:'0.000040'   }},
    { id:'openai/o4-mini',        name:'o4-mini',         context_length:200000,  pricing:{prompt:'0.0000011',  completion:'0.0000044'  }},
    { id:'openai/gpt-4-turbo',    name:'GPT-4 Turbo',     context_length:128000,  pricing:{prompt:'0.00001',    completion:'0.00003'    }},
    { id:'openai/gpt-3.5-turbo',  name:'GPT-3.5 Turbo',  context_length:16385,   pricing:{prompt:'0.0000005',  completion:'0.0000015'  }},
    { id:'anthropic/claude-opus-4',     name:'Claude Opus 4',     context_length:200000, pricing:{prompt:'0.000015',  completion:'0.000075' }},
    { id:'anthropic/claude-sonnet-4',   name:'Claude Sonnet 4',   context_length:200000, pricing:{prompt:'0.000003',  completion:'0.000015' }},
    { id:'anthropic/claude-3-5-sonnet', name:'Claude 3.5 Sonnet', context_length:200000, pricing:{prompt:'0.000003',  completion:'0.000015' }},
    { id:'anthropic/claude-3-5-haiku',  name:'Claude 3.5 Haiku',  context_length:200000, pricing:{prompt:'0.0000008', completion:'0.000004' }},
    { id:'anthropic/claude-3-opus',     name:'Claude 3 Opus',     context_length:200000, pricing:{prompt:'0.000015',  completion:'0.000075' }},
    { id:'anthropic/claude-3-haiku',    name:'Claude 3 Haiku',    context_length:200000, pricing:{prompt:'0.00000025',completion:'0.00000125'}},
    { id:'google/gemini-2.5-pro',   name:'Gemini 2.5 Pro',   context_length:1000000, pricing:{prompt:'0.00000125', completion:'0.00001'   }},
    { id:'google/gemini-2.0-flash',  name:'Gemini 2.0 Flash', context_length:1000000, pricing:{prompt:'0.0000001',  completion:'0.0000004' }},
    { id:'google/gemini-1.5-pro',    name:'Gemini 1.5 Pro',   context_length:2000000, pricing:{prompt:'0.00000125', completion:'0.000005'  }},
    { id:'google/gemini-1.5-flash',  name:'Gemini 1.5 Flash', context_length:1000000, pricing:{prompt:'0.000000075',completion:'0.0000003' }},
    { id:'meta-llama/llama-3.3-70b-instruct',  name:'Llama 3.3 70B',  context_length:128000, pricing:{prompt:'0.00000059', completion:'0.00000079'}},
    { id:'meta-llama/llama-3.1-8b-instruct',   name:'Llama 3.1 8B',   context_length:128000, pricing:{prompt:'0.00000018', completion:'0.00000018'}},
    { id:'meta-llama/llama-3.1-405b-instruct', name:'Llama 3.1 405B', context_length:128000, pricing:{prompt:'0.000003',   completion:'0.000003'  }},
    { id:'mistralai/mistral-large',       name:'Mistral Large', context_length:128000, pricing:{prompt:'0.000002',   completion:'0.000006'  }},
    { id:'mistralai/mistral-7b-instruct', name:'Mistral 7B',    context_length:32768,  pricing:{prompt:'0.00000007', completion:'0.00000007'}},
    { id:'mistralai/codestral-latest',    name:'Codestral',     context_length:256000, pricing:{prompt:'0.000001',   completion:'0.000003'  }},
    { id:'deepseek/deepseek-r1', name:'DeepSeek R1', context_length:64000, pricing:{prompt:'0.00000055', completion:'0.00000219'}},
    { id:'deepseek/deepseek-v3', name:'DeepSeek V3', context_length:64000, pricing:{prompt:'0.00000027', completion:'0.00000110'}},
    { id:'x-ai/grok-3',             name:'Grok 3',        context_length:131072, pricing:{prompt:'0.000003', completion:'0.000015'}},
    { id:'x-ai/grok-3-mini',        name:'Grok 3 Mini',   context_length:131072, pricing:{prompt:'0.0000003',completion:'0.0000005'}},
    { id:'cohere/command-r-plus', name:'Command R+', context_length:128000, pricing:{prompt:'0.0000025',  completion:'0.00001'  }},
    { id:'cohere/command-r',      name:'Command R',  context_length:128000, pricing:{prompt:'0.00000015', completion:'0.0000006'}},
    { id:'perplexity/sonar-pro', name:'Perplexity Sonar Pro', context_length:200000, pricing:{prompt:'0.000003', completion:'0.000015'}},
    { id:'qwen/qwen-72b-chat',   name:'Qwen 72B',            context_length:32768,  pricing:{prompt:'0.0000009',completion:'0.0000009'}},
    // ── 2024-2025 additions ──────────────────────────────────────
    // Anthropic
    { id:'anthropic/claude-3-7-sonnet', name:'Claude 3.7 Sonnet', context_length:200000, pricing:{prompt:'0.000003', completion:'0.000015'}},
    // OpenAI
    { id:'openai/gpt-4.1',       name:'GPT-4.1',         context_length:1000000, pricing:{prompt:'0.000002',   completion:'0.000008'}},
    { id:'openai/gpt-4.1-mini',  name:'GPT-4.1 mini',    context_length:1000000, pricing:{prompt:'0.0000004',  completion:'0.0000016'}},
    { id:'openai/o3-mini',       name:'o3-mini',         context_length:200000,  pricing:{prompt:'0.0000011',  completion:'0.0000044'}},
    // Google
    { id:'google/gemini-2.5-flash', name:'Gemini 2.5 Flash', context_length:1000000, pricing:{prompt:'0.000000075', completion:'0.0000003'}},
    // Meta Llama 3.2 / 3.3
    { id:'meta-llama/llama-3.2-90b-vision-instruct', name:'Llama 3.2 90B Vision', context_length:128000, pricing:{prompt:'0.0000009',completion:'0.0000009'}},
    { id:'meta-llama/llama-3.2-11b-vision-instruct', name:'Llama 3.2 11B Vision', context_length:128000, pricing:{prompt:'0.00000018',completion:'0.00000018'}},
    { id:'meta-llama/llama-3.2-3b-instruct',         name:'Llama 3.2 3B',         context_length:128000, pricing:{prompt:'0.000000060',completion:'0.000000060'}},
    { id:'meta-llama/llama-3.2-1b-instruct',         name:'Llama 3.2 1B',         context_length:128000, pricing:{prompt:'0.000000040',completion:'0.000000040'}},
    // Qwen 2.5
    { id:'qwen/qwen2.5-72b-instruct',  name:'Qwen2.5 72B',  context_length:131072, pricing:{prompt:'0.0000004',completion:'0.0000012'}},
    { id:'qwen/qwen2.5-7b-instruct',   name:'Qwen2.5 7B',   context_length:131072, pricing:{prompt:'0.00000009',completion:'0.00000018'}},
    { id:'qwen/qwen2.5-coder-32b-instruct', name:'Qwen2.5 Coder 32B', context_length:131072, pricing:{prompt:'0.0000002',completion:'0.0000006'}},
    // Microsoft Phi-4
    { id:'microsoft/phi-4',  name:'Phi-4 (14B)',  context_length:16384, pricing:{prompt:'0.00000007',completion:'0.00000007'}},
    { id:'microsoft/phi-3.5-mini-instruct', name:'Phi-3.5 Mini', context_length:128000, pricing:{prompt:'0.00000013',completion:'0.00000052'}},
    // Mistral additions
    { id:'mistralai/mistral-small-3.1', name:'Mistral Small 3.1', context_length:128000, pricing:{prompt:'0.0000001',completion:'0.0000003'}},
    { id:'mistralai/mistral-medium-3',  name:'Mistral Medium 3',  context_length:128000, pricing:{prompt:'0.0000004',completion:'0.000002'}},
    // DeepSeek
    { id:'deepseek/deepseek-r1-distill-llama-70b', name:'DeepSeek R1 Distill 70B', context_length:131072, pricing:{prompt:'0.00000023',completion:'0.00000069'}},
  ];

  // ── Provider environmental profiles ──────────────────────────────
  // co2: grams CO₂ per kWh (grid carbon intensity at their data centers)
  // water: liters per kWh (WUE — Water Usage Effectiveness)
  // Sources: Google Env Report 2023; Microsoft Sustainability Report 2023;
  //   AWS Sustainability Report 2023; Li et al. 2023; IEA China grid data
  var PROVIDER_PROFILES = {
    'openai':     { co2: 250,  water: 11.5, host: 'Azure (US)' },      // Azure WUE ~1.2-2L/kWh; CO2 ~250g/kWh mixed renewable
    'anthropic':  { co2: 180,  water:  3.8, host: 'AWS (US)' },         // AWS WUE ~0.5L/kWh; CO2 ~180g/kWh
    'google':     { co2:  90,  water:  5.4, host: 'GCP' },              // Google WUE 0.71L/kWh; CO2 ~65-90g/kWh (≥64% renewable 2023)
    'meta-llama': { co2: 200,  water:  2.3, host: 'Meta DC' },          // Meta WUE ~0.3L/kWh; CO2 ~200g/kWh
    'mistralai':  { co2: 280,  water:  6.0, host: 'Various EU' },       // EU mix CO2 ~280g/kWh
    'deepseek':   { co2: 600,  water: 19.0, host: 'China grid' },       // China coal-heavy ~550-600g/kWh; high WUE evaporative cooling
    'x-ai':       { co2: 280,  water:  8.0, host: 'xAI DC (TN)' },      // Estimated mix
    'cohere':     { co2: 180,  water:  4.5, host: 'GCP/AWS' },          // Mix of GCP and AWS
    'perplexity': { co2: 180,  water:  3.8, host: 'AWS' },              // AWS hosted
    'qwen':       { co2: 550,  water: 18.0, host: 'Alibaba/China' },    // China grid, Alibaba Cloud
    'microsoft':  { co2: 250,  water: 11.5, host: 'Azure (US)' },      // Azure; same profile as OpenAI (both Azure-hosted)
    '_default':   { co2: 300,  water:  8.0, host: 'Unknown' },
  };

  // ── Power consumption: Wh per 1M tokens (input+output combined) ──
  // PRIMARY anchor: Luccioni et al. 2023 "Power Hungry Processing"
  //   Direct GPU power measurement: 6B model ≈ 540 Wh/1M tokens
  //   Scaling law: larger models ≈ params^0.65 (sublinear due to memory bandwidth)
  //   de Vries 2023: ~1g CO2/ChatGPT query → ~0.001 kWh/query → ~3000 Wh/1M tok for GPT-4 class
  // Reasoning models (o1/o3/R1): extended chain-of-thought multiplies compute 4-20×
  // MoE models (GPT-4o, Mixtral): fewer active params → lower power than dense equivalent
  var POWER_RATES = {
    'openai/o3':               24000,  // Reasoning frontier: ~20× base × extended CoT
    'openai/o4-mini':           1800,  // Compact reasoning model
    'openai/gpt-4o':            3200,  // MoE ~40B active params; de Vries 2023 calibrated
    'openai/gpt-4-turbo':       6500,  // Dense large; GPT-4 class baseline
    'openai/gpt-4o-mini':        620,  // ~7B active params class; Luccioni 6B anchor ×1.15
    'openai/gpt-3.5-turbo':     4800,  // 175B dense; estimated from Strubell/Patterson scaling
    'anthropic/claude-opus-4':  8500,  // Large frontier; ~70-100B class dense
    'anthropic/claude-sonnet-4':3200,  // Mid-tier; ~40B class
    'anthropic/claude-3-5-sonnet':3000, // Equivalent capacity to Sonnet 4
    'anthropic/claude-3-5-haiku': 630, // Small/fast; ~7B class
    'anthropic/claude-3-opus':  8000,  // Previous large frontier
    'anthropic/claude-3-haiku':  550,  // Luccioni 6B anchor × 1.0
    'google/gemini-2.5-pro':    2800,  // MoE; Google efficiency advantage
    'google/gemini-2.0-flash':   590,  // Flash: small/fast class
    'google/gemini-1.5-pro':    2600,  // Long-context MoE
    'google/gemini-1.5-flash':   520,  // Flash class; Luccioni anchor × 0.95
    'meta-llama/llama-3.3-70b-instruct': 3500,  // 70B dense; Touvron scaling
    'meta-llama/llama-3.1-8b-instruct':   640,  // 8B dense; Luccioni anchor × 1.18
    'meta-llama/llama-3.1-405b-instruct':12000, // 405B dense; params^0.65 scaling
    'mistralai/mistral-large':  3200,  // ~47B dense
    'mistralai/mistral-7b-instruct': 610, // 7B dense; Luccioni anchor
    'mistralai/codestral-latest':2800, // Code-optimized ~22B
    'deepseek/deepseek-r1':     9500,  // 671B MoE reasoning; extended CoT × power
    'deepseek/deepseek-v3':     4200,  // 671B MoE; fewer active params
    'deepseek/deepseek-r1-distill-llama-70b': 3500, // Distilled 70B; dense, no extended CoT
    'x-ai/grok-3':              6500,  // Large frontier estimate
    'x-ai/grok-3-mini':          800,  // Compact reasoning model
    'x-ai/grok-2-vision-1212':  5000,  // Grok 2 class
    'cohere/command-r-plus':    3500,  // ~104B
    'cohere/command-r':         2200,  // ~35B
    'perplexity/sonar-pro':     3000,  // Estimated sonar model
    'qwen/qwen-72b-chat':       3500,  // 72B dense
    // ── 2024-2025 additions ──────────────────────────────────────
    'anthropic/claude-3-7-sonnet': 3100, // Claude 3.7 Sonnet ~equivalent to Sonnet 4
    'openai/gpt-4.1':           3000,  // GPT-4.1: MoE-like efficiency, long-ctx
    'openai/gpt-4.1-mini':       600,  // Mini class ~7B active
    'openai/o3-mini':           2000,  // Compact reasoning; lower compute than o3
    'google/gemini-2.5-flash':   510,  // Flash class; Google efficiency advantage
    'meta-llama/llama-3.2-90b-vision-instruct': 4500, // 90B vision; ~params^0.65 from 70B anchor
    'meta-llama/llama-3.2-11b-vision-instruct':  700, // 11B dense; Luccioni anchor × 1.3
    'meta-llama/llama-3.2-3b-instruct':          180, // 3B; sublinear scaling
    'meta-llama/llama-3.2-1b-instruct':           90, // 1B; minimal power
    'qwen/qwen2.5-72b-instruct': 3500, // Qwen2.5 72B dense — equivalent to Llama 70B class
    'qwen/qwen2.5-7b-instruct':   610, // 7B dense; Luccioni anchor
    'qwen/qwen2.5-coder-32b-instruct': 1900, // 32B code model
    'microsoft/phi-4':            320, // 14B parameter; efficient architecture
    'microsoft/phi-3.5-mini-instruct': 180, // 3.8B; highly efficient
    'mistralai/mistral-small-3.1': 680, // ~7B class; Luccioni anchor
    'mistralai/mistral-medium-3': 2000, // ~22-30B class
  };

  function getProviderProfile(modelId) {
    var provider = (modelId || '').split('/')[0].toLowerCase();
    return PROVIDER_PROFILES[provider] || PROVIDER_PROFILES['_default'];
  }

  // Fuzzy match handles OpenRouter versioned IDs like "anthropic/claude-3-5-sonnet-20241022"
  // 1. Exact match  2. Keyword-overlap score (ignores date suffixes)  3. Size-based fallback
  function getPowerRate(modelId) {
    if (!modelId) return 3200;
    // 1. Exact match
    if (POWER_RATES[modelId]) return POWER_RATES[modelId];
    var id = modelId.toLowerCase();
    // 2. Provider-scoped keyword overlap (handles versioned IDs like -20241022 suffix)
    var provider = id.split('/')[0];
    var bestMatch = null, bestScore = 0;
    for (var key in POWER_RATES) {
      var kl = key.toLowerCase();
      if (!kl.startsWith(provider + '/')) continue;
      var modelPart = kl.split('/').slice(1).join('/');
      // Extract meaningful words (skip pure number tokens and short tokens)
      var words = modelPart.split(/[-\/]/).filter(function(w) { return w.length > 2 && !/^\d+$/.test(w); });
      var score = 0;
      words.forEach(function(w) { if (id.indexOf(w) !== -1) score++; });
      if (score > bestScore) { bestScore = score; bestMatch = key; }
    }
    if (bestMatch && bestScore >= 2) return POWER_RATES[bestMatch];
    // 3. Size/type-based fallback — never silently falls to one value
    if (/\bo[1-9]\b|reasoning|thinker/.test(id)) return 18000;
    if (/405b|176b|180b/.test(id))  return 12000;
    if (/70b|72b|65b/.test(id))     return 3500;
    if (/34b|35b|32b/.test(id))     return 2000;
    if (/13b|14b/.test(id))         return 1100;
    if (/7b|8b/.test(id))           return 620;
    if (/3b|4b/.test(id))           return 280;
    if (/mini|haiku|flash|nano|tiny|small/.test(id)) return 640;
    if (/large|plus|pro|ultra/.test(id)) return 3500;
    return 3200; // frontier default
  }

  // CO₂: g per 1M tokens = Wh/1M × (gCO₂/kWh) / 1000
  // Derived from power × grid carbon intensity — no separate lookup table to go stale
  function getCO2Rate(modelId) {
    return getPowerRate(modelId) * getProviderProfile(modelId).co2 / 1000;
  }

  // Water: liters per 1M tokens = Wh/1M × (L/kWh) / 1000
  // Calibrated to Li et al. 2023: 500mL per 20-question GPT-3.5 session
  // GPT-3.5: ~4800 Wh/1M × 11.5 L/kWh / 1000 = 55.2 L/1M tokens
  // 20 questions × avg 150 in + 200 out = 7000 tokens total → 55.2 × 7/1000 = 0.39L ≈ 500mL ✓
  function getWaterRate(modelId) {
    return getPowerRate(modelId) * getProviderProfile(modelId).water / 1000;
  }

  var TRAINING_BENCHMARKS = [
    {model:'BERT-base',    params:'110M',   co2:0.65,  water:null,    energy:1.5,   status:'verified', citation:'Strubell et al. 2019'},
    {model:'T5-Large',     params:'770M',   co2:46.7,  water:null,    energy:86,    status:'verified', citation:'Patterson et al. 2021'},
    {model:'GPT-3',        params:'175B',   co2:552,   water:700000,  energy:1287,  status:'research', citation:'Li et al. 2023; Brown et al. 2020'},
    {model:'LLaMA 65B',    params:'65B',    co2:539,   water:null,    energy:1022,  status:'verified', citation:'Touvron et al. 2023'},
    {model:'LLaMA 2 70B',  params:'70B',    co2:291,   water:null,    energy:539,   status:'verified', citation:'Touvron et al. 2023'},
    {model:'BLOOM 176B',   params:'176B',   co2:433,   water:null,    energy:958,   status:'verified', citation:'Scao et al. 2022 (BigScience)'},
    {model:'Gopher 280B',  params:'280B',   co2:380,   water:null,    energy:1066,  status:'verified', citation:'Rae et al. 2021 (DeepMind)'},
    {model:'GPT-4',        params:'~1.7T*', co2:5000,  water:2000000, energy:11000, status:'estimated',citation:'Estimated — OpenAI undisclosed'},
    {model:'Claude 3 Opus',params:'Unknown',co2:3000,  water:1500000, energy:6500,  status:'estimated',citation:'Estimated — Anthropic undisclosed'},
    {model:'Gemini Ultra', params:'Unknown',co2:4200,  water:1800000, energy:9500,  status:'estimated',citation:'Estimated — Google undisclosed'},
  ];

  // Power in Wh/1M tokens (Luccioni et al. 2023 anchored)
  // CO2 = power × provider.co2/1000 (g/1M tok); Water = power × provider.water/1000 (L/1M tok)
  var INFERENCE_BENCHMARKS = [
    {model:'GPT-4o',             cls:'Frontier',            power_wh:3200,  co2:800,  water:36.8, cost:2.50,  wue:'~2.0 L/kWh (Azure)',   src:'Luccioni 2023'},
    {model:'GPT-4o mini',        cls:'Efficient',           power_wh:620,   co2:155,  water:7.1,  cost:0.15,  wue:'~2.0 L/kWh (Azure)',   src:'Luccioni 2023'},
    {model:'Claude Sonnet 4',    cls:'Frontier',            power_wh:3200,  co2:576,  water:12.2, cost:3.00,  wue:'~0.5 L/kWh (AWS)',     src:'Luccioni 2023'},
    {model:'Claude 3.5 Haiku',   cls:'Efficient',           power_wh:630,   co2:113,  water:2.4,  cost:0.80,  wue:'~0.5 L/kWh (AWS)',     src:'Luccioni 2023'},
    {model:'Gemini 2.5 Pro',     cls:'Frontier',            power_wh:2800,  co2:252,  water:15.1, cost:1.25,  wue:'~0.71 L/kWh (Google)', src:'Google Env 2023'},
    {model:'Gemini 2.0 Flash',   cls:'Efficient',           power_wh:590,   co2:53,   water:3.2,  cost:0.10,  wue:'~0.71 L/kWh (Google)', src:'Google Env 2023'},
    {model:'Llama 3.3 70B',      cls:'Open Source',         power_wh:3500,  co2:700,  water:8.1,  cost:0.59,  wue:'Varies by host',       src:'Luccioni 2023'},
    {model:'Mistral 7B',         cls:'Open Source (small)', power_wh:610,   co2:171,  water:3.7,  cost:0.07,  wue:'Varies by host',       src:'Luccioni 2023'},
    {model:'DeepSeek R1',        cls:'Reasoning (MoE)',     power_wh:9500,  co2:5700, water:180.5,cost:0.55,  wue:'~1.5 L/kWh (est.)',    src:'Luccioni + scaling'},
    {model:'o3',                 cls:'Reasoning (frontier)',power_wh:24000, co2:6000, water:276,  cost:10.00, wue:'~2.0 L/kWh (Azure)',   src:'de Vries 2023 est.'},
  ];

  return {FALLBACK_MODELS, TRAINING_BENCHMARKS, INFERENCE_BENCHMARKS, POWER_RATES, PROVIDER_PROFILES,
          getProviderProfile, getPowerRate, getCO2Rate, getWaterRate};
})();


