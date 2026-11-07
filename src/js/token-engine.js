/* ══════════════════════════════════════════════════════════
   MODULE 2 — TOKEN ENGINE
   Counting · intent detection · dynamic output prediction
   Context-aware input accumulation (key fix v3)
   ══════════════════════════════════════════════════════════ */
window.TOKEN_ENGINE = (function() {

  // FIX #3: Content-aware tokenizer — English prose ≈ 4 chars/tok,
  // code ≈ 2.5 chars/tok (symbols tokenize individually),
  // CJK/Arabic ≈ 1.5 chars/tok (multi-byte chars = multiple BPE tokens),
  // mixed content uses a weighted blend.
  function count(text) {
    if (!text) return 0;
    var len = text.length;
    if (len === 0) return 0;

    // Detect content type proportions
    var codeChars = (text.match(/```[\s\S]*?```|`[^`]+`|[{}()\[\];=<>!&|^~%]/g) || []).join('').length;
    var cjkChars  = (text.match(/[　-鿿豈-﫿가-힯؀-ۿ]/g) || []).length;
    var probeChars = len - codeChars - cjkChars;

    var codeFrac = Math.min(codeChars / (len || 1), 1);
    var cjkFrac  = Math.min(cjkChars  / (len || 1), 1);
    var proseFrac = Math.max(0, 1 - codeFrac - cjkFrac);

    // Weighted chars-per-token
    var charsPerTok = proseFrac * 4.0 + codeFrac * 2.5 + cjkFrac * 1.5;
    charsPerTok = Math.max(1.5, charsPerTok);

    return Math.max(1, Math.ceil(len / charsPerTok));
  }

  function detectIntent(text) {
    var t = text.toLowerCase().trim();
    if (/\bone[ -]?word\b|yes or no|true or false|single word/.test(t)) return 'one-word';
    if (/\bbrief|concise|short answer|quick|tldr|tl;dr/.test(t)) return 'brief';
    if (/\bsummariz|recap|condense/.test(t)) return 'summarize';
    if (/\btranslat/.test(t)) return 'translate';
    if (/\b(write|create|implement|build|generate)\b.*\b(code|script|function|class|program|app|component|api)\b/.test(t)) return 'code';
    if (/\b(essay|article|blog|report|story|guide|comprehensive|in[ -]depth|detailed|thorough|\d{3,}[ -]?word)\b/.test(t)) return 'long-form';
    if (/\blist\b|\bbullet\b|\bsteps?\b/.test(t)) return 'list';
    if (/\bstep[ -]by[ -]step\b|\bhow to\b|\btutorial\b/.test(t)) return 'tutorial';
    if (/\bexplain\b|\banalyze\b|\bdescrib|\bwhat is\b|\bwhat are\b/.test(t)) return 'explain';
    if (/\bcompare\b|\bdifference\b|\bvs\.?\b|\bversus\b/.test(t)) return 'compare';
    if (/\bdebug\b|\bfix\b|\berror\b|\bbug\b|\bwhy.*not work/.test(t)) return 'debug';
    return 'conversational';
  }

  // Dynamic output prediction based on prompt intent — NOT a fixed value
  function predictOutput(text) {
    if (!text || !text.trim()) return 0;
    var inp = count(text);
    var intent = detectIntent(text);
    var map = {
      'one-word':      function() { return 5; },
      'brief':         function() { return Math.max(40,  Math.round(inp * 0.8)); },
      'summarize':     function() { return Math.max(80,  Math.round(inp * 0.6)); },
      'translate':     function() { return Math.max(inp, Math.round(inp * 1.1)); },
      'code':          function() { return Math.max(400, Math.round(inp * 10)); },
      'long-form':     function() { return Math.max(800, Math.round(inp * 15)); },
      'list':          function() { return Math.max(200, Math.round(inp * 4)); },
      'tutorial':      function() { return Math.max(350, Math.round(inp * 7)); },
      'explain':       function() { return Math.max(200, Math.round(inp * 5)); },
      'compare':       function() { return Math.max(250, Math.round(inp * 6)); },
      'debug':         function() { return Math.max(200, Math.round(inp * 5)); },
      'conversational':function() { return Math.max(100, Math.round(inp * 3)); },
    };
    return (map[intent] || map['conversational'])();
  }

  function intentLabel(text) {
    if (!text || !text.trim()) return 'Start typing to see estimates';
    var labels = {
      'one-word':      '🎯 One-word answer detected',
      'brief':         '⚡ Brief response expected',
      'summarize':     '📌 Summarization task',
      'translate':     '🌍 Translation task',
      'code':          '💻 Code generation — large output expected',
      'long-form':     '📝 Long-form writing — high token count',
      'list':          '📋 List / bullet format',
      'tutorial':      '📚 Step-by-step tutorial',
      'explain':       '💡 Explanation / analysis',
      'compare':       '⚖️ Comparison task',
      'debug':         '🔧 Debug / fix task',
      'conversational':'💬 Conversational reply',
    };
    return labels[detectIntent(text)] || '💬 Conversational reply';
  }

  // CRITICAL FIX: input for turn N = all prior context + new prompt tokens
  function computeTurnInput(session, promptTokens) {
    return session.contextTokens + promptTokens;
  }

  return {count, detectIntent, predictOutput, intentLabel, computeTurnInput};
})();


