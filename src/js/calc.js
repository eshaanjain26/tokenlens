/* ══════════════════════════════════════════════════════════
   MODULE 3 — CALC
   Cost · CO2 · water · currency · efficiency grades
   ══════════════════════════════════════════════════════════ */
window.CALC = (function() {

  var FX  = {USD:1, EUR:0.92, GBP:0.79, INR:83.2};
  var SYM = {USD:'$', EUR:'€', GBP:'£', INR:'₹'};
  var currency = 'USD';

  function setCurrency(c) { currency = c; }
  function getCurrency()  { return currency; }

  function cost(model, inTok, outTok) {
    var ip = parseFloat(model.pricing && model.pricing.prompt     || 0);
    var op = parseFloat(model.pricing && model.pricing.completion || 0);
    return inTok * ip + outTok * op;
  }

  function co2(modelId, inTok, outTok) {
    return ((inTok + outTok) / 1e6) * DATA.getCO2Rate(modelId);
  }

  function water(modelId, inTok, outTok) {
    return ((inTok + outTok) / 1e6) * DATA.getWaterRate(modelId);
  }

  // Power: returns Wh consumed — Luccioni et al. 2023 anchored via POWER_RATES
  function power(modelId, inTok, outTok) {
    return ((inTok + outTok) / 1e6) * DATA.getPowerRate(modelId);
  }

  // Format power: mWh < 1 Wh < 1000 Wh → kWh
  function fmtPower(wh) {
    if (wh === 0) return '0 mWh';
    if (wh < 0.001) return '<0.001 mWh';
    if (wh < 1)     return (wh * 1000).toFixed(2) + ' mWh';
    if (wh < 1000)  return wh.toFixed(4) + ' Wh';
    return (wh / 1000).toFixed(6) + ' kWh';
  }

  function fmtCost(usd) {
    var v = usd * FX[currency];
    var s = SYM[currency];
    if (v === 0)    return s + '0.000000';
    if (v < 0.001)  return s + v.toFixed(6);
    if (v < 0.01)   return s + v.toFixed(4);
    if (v < 1)      return s + v.toFixed(3);
    return s + v.toFixed(2);
  }

  function fmtCO2(g) {
    if (g < 0.001) return '<0.001g CO₂';
    if (g < 1)     return g.toFixed(3) + 'g CO₂';
    if (g < 1000)  return g.toFixed(2) + 'g CO₂';
    return (g/1000).toFixed(2) + 'kg CO₂';
  }

  function fmtWater(l) {
    if (l < 0.001) return '<0.001mL';
    if (l < 1)     return (l*1000).toFixed(1) + 'mL';
    if (l < 1000)  return l.toFixed(3) + 'L';
    return (l/1000).toFixed(3) + 'kL';
  }

  function grade(model) {
    var ip = parseFloat(model.pricing && model.pricing.prompt     || 0) * 1e6;
    var op = parseFloat(model.pricing && model.pricing.completion || 0) * 1e6;
    var avg = (ip + op) / 2;
    if (avg < 0.3)  return 'A';
    if (avg < 1.0)  return 'B';
    if (avg < 5.0)  return 'C';
    if (avg < 15.0) return 'D';
    return 'F';
  }

  // ── Prompt caching ───────────────────────────────────────
  // Cached input tokens are billed at a fraction of the normal input price.
  // Uses OpenRouter's pricing.input_cache_read / input_cache_write when the
  // live model list provides them, else falls back to published provider
  // defaults. Returns null when the provider has no prompt caching.
  var CACHE_ENERGY_FACTOR = 0.1; // assumption: a cache-read token costs ~10% of a fresh prefill in energy
  function cacheTerms(model) {
    var p  = (model && model.pricing) || {};
    var ip = parseFloat(p.prompt || 0);
    var id = ((model && model.id) || '').toLowerCase();
    var apiRead  = parseFloat(p.input_cache_read  || 0);
    var apiWrite = parseFloat(p.input_cache_write || 0);
    var def = null;
    if (/^anthropic\//.test(id))                       def = {read:0.10, write:1.25};
    else if (/^openai\//.test(id))                     def = {read:(/gpt-4\.1|o3|o4/.test(id) ? 0.25 : 0.50), write:1.0};
    else if (/^google\//.test(id))                     def = {read:0.25, write:1.0};
    else if (/^deepseek\//.test(id))                   def = {read:0.10, write:1.0};
    else if (/^x-ai\//.test(id))                       def = {read:0.25, write:1.0};
    if (ip > 0 && apiRead > 0) {
      return {supported:true, read:apiRead/ip, write:(apiWrite > 0 ? apiWrite/ip : (def ? def.write : 1.0)), source:'OpenRouter pricing'};
    }
    if (def) return {supported:true, read:def.read, write:def.write, source:'provider default'};
    return {supported:false, read:1, write:1, source:'no caching'};
  }

  // Full cost split for one turn. cached = cache-read tokens, written = cache-write tokens.
  function costDetailed(model, inTok, outTok, cached, written) {
    var ip = parseFloat(model.pricing && model.pricing.prompt     || 0);
    var op = parseFloat(model.pricing && model.pricing.completion || 0);
    var t  = cacheTerms(model);
    cached  = Math.max(0, Math.min(cached  || 0, inTok));
    written = Math.max(0, Math.min(written || 0, inTok - cached));
    var fresh = inTok - cached - written;
    var inCost  = fresh*ip + cached*ip*t.read + written*ip*t.write;
    var outCost = outTok*op;
    var noCache = inTok*ip + outTok*op;
    return {cost: inCost + outCost, noCache: noCache, saved: noCache - (inCost + outCost),
            freshCost: fresh*ip, cachedCost: cached*ip*t.read, writeCost: written*ip*t.write, outCost: outCost, fresh: fresh};
  }

  // Input tokens that actually need fresh compute once cache reads are discounted.
  function effectiveIn(inTok, cached) {
    return inTok - (cached || 0) * (1 - CACHE_ENERGY_FACTOR);
  }

  return {setCurrency, getCurrency, cost, co2, water, power, fmtCost, fmtCO2, fmtWater, fmtPower, grade,
          cacheTerms, costDetailed, effectiveIn, CACHE_ENERGY_FACTOR};
})();


