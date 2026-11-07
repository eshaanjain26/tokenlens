/* ══════════════════════════════════════════════════════════
   MODULE 5 — STATE
   Session management, active models, global totals
   ══════════════════════════════════════════════════════════ */
window.STATE = (function() {

  var allModels   = [];
  var activeIds   = {};  // modelId → true
  var sessions    = {};  // modelId → session object
  var activeOrder = [];  // insertion order

  function setModels(m) { allModels = m; }
  function getModels()  { return allModels; }

  function getActiveModels() {
    return activeOrder.map(function(id) {
      return allModels.find(function(m) { return m.id === id; });
    }).filter(Boolean);
  }

  function newSession() {
    return {turns:[], contextTokens:0, totalIn:0, totalOut:0, totalCost:0, totalCO2:0, totalWater:0, totalPower:0,
            totalCached:0, totalCacheWrite:0, totalCostNoCache:0, totalCO2NoCache:0, totalWaterNoCache:0, totalPowerNoCache:0};
  }

  function toggleModel(id) {
    if (activeIds[id]) {
      delete activeIds[id];
      delete sessions[id];
      activeOrder = activeOrder.filter(function(x) { return x !== id; });
    } else {
      if (activeOrder.length >= 10) return false;
      activeIds[id] = true;
      sessions[id]  = newSession();
      activeOrder.push(id);
    }
    return true;
  }

  function isActive(id)   { return !!activeIds[id]; }
  function activeCount()  { return activeOrder.length; }
  function getSession(id) { return sessions[id]; }

  function addTurn(modelId, turn) {
    var s = sessions[modelId];
    if (!s) return;
    s.turns.push(turn);
    // accumulate context for the NEXT turn's input calculation
    s.contextTokens += turn.promptTokens + turn.outputTokens;
    s.totalIn    += turn.inputTokens;
    s.totalOut   += turn.outputTokens;
    s.totalCost  += turn.cost;
    s.totalCO2   += turn.co2;
    s.totalWater += turn.water;
    s.totalPower += turn.power;
    s.totalCached         += turn.cachedTokens || 0;
    s.totalCacheWrite     += turn.cacheWriteTokens || 0;
    s.totalCostNoCache    += (turn.costNoCache  != null ? turn.costNoCache  : turn.cost);
    s.totalCO2NoCache     += (turn.co2NoCache   != null ? turn.co2NoCache   : turn.co2);
    s.totalWaterNoCache   += (turn.waterNoCache != null ? turn.waterNoCache : turn.water);
    s.totalPowerNoCache   += (turn.powerNoCache != null ? turn.powerNoCache : turn.power);
  }

  function maxTurns() {
    var m = 0;
    activeOrder.forEach(function(id) {
      if (sessions[id] && sessions[id].turns.length > m) m = sessions[id].turns.length;
    });
    return m;
  }

  function globalTotals() {
    var cost=0, co2=0, water=0, power=0, tin=0, tout=0, cached=0, written=0, costNC=0, co2NC=0, waterNC=0, powerNC=0;
    activeOrder.forEach(function(id) {
      var s = sessions[id];
      if (s) {
        cost+=s.totalCost; co2+=s.totalCO2; water+=s.totalWater; power+=s.totalPower;
        tin+=s.totalIn; tout+=s.totalOut; cached+=(s.totalCached||0); written+=(s.totalCacheWrite||0);
        costNC+=(s.totalCostNoCache||0); co2NC+=(s.totalCO2NoCache||0); waterNC+=(s.totalWaterNoCache||0); powerNC+=(s.totalPowerNoCache||0);
      }
    });
    return {turns:maxTurns(), cost:cost, co2:co2, water:water, power:power,
            tokensIn:tin, tokensOut:tout, cached:cached, cacheWrite:written,
            costNoCache:costNC, co2NoCache:co2NC, waterNoCache:waterNC, powerNoCache:powerNC};
  }

  function clearSession(modelId) { sessions[modelId] = newSession(); }

  function saveHistory() {
    var models = getActiveModels(); if (!models.length || !maxTurns()) return;
    var entry = {
      id: Date.now(), date: new Date().toISOString(),
      models: models.map(function(m){ return {id:m.id, name:m.name}; }),
      turns: maxTurns(), totalCost: globalTotals().cost,
      sessions: {}
    };
    models.forEach(function(m){ entry.sessions[m.id] = sessions[m.id]; });
    var hist=[];
    try { hist=JSON.parse(localStorage.getItem('lti_sessions_v1')||'[]'); } catch(e){}
    hist.unshift(entry);
    if (hist.length>10) hist=hist.slice(0,10);
    try { localStorage.setItem('lti_sessions_v1', JSON.stringify(hist)); } catch(e){}
  }

  function loadHistory() {
    try { return JSON.parse(localStorage.getItem('lti_sessions_v1')||'[]'); } catch(e){ return []; }
  }

  function clearHistory() {
    try { localStorage.removeItem('lti_sessions_v1'); } catch(e){}
  }

  return {setModels, getModels, getActiveModels, toggleModel, isActive, activeCount, getSession, addTurn, maxTurns, globalTotals, clearSession, saveHistory, loadHistory, clearHistory};
})();


