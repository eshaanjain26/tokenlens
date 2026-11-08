/* ══════════════════════════════════════════════════════════
   MODULE 6 — CHARTS
   Shared chart helpers: palette, tooltip, scrub (crosshair), sparkline, radar
   ══════════════════════════════════════════════════════════ */
window.CHARTS = (function() {

  var SERIES = 10;
  var DASH = ['', '', '', '6 4', '6 4', '6 4', '2 3', '2 3', '2 3', '8 3 2 3'];

  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
  function color(i)  { return 'var(--ch-' + (i % SERIES) + ')'; }
  function dash(i)   { return DASH[i % SERIES]; }
  function finite(n) { return typeof n === 'number' && isFinite(n); }

  /* ── Tooltip ── */
  var _tip = null;
  function tipEl() {
    if (_tip && document.body.contains(_tip)) return _tip;
    _tip = document.createElement('div');
    _tip.className = 'chart-tip';
    _tip.setAttribute('role', 'tooltip');
    _tip.id = 'chart-tip';
    document.body.appendChild(_tip);
    return _tip;
  }
  function showTip(html, x, y) {
    var t = tipEl();
    t.innerHTML = html;
    t.classList.add('is-on');
    var w = t.offsetWidth, h = t.offsetHeight, m = 8;
    var left = x + 14, top = y - h / 2;
    if (left + w > window.innerWidth - m) left = x - w - 14;
    if (left < m) left = m;
    top = Math.max(m, Math.min(top, window.innerHeight - h - m));
    t.style.left = left.toFixed(0) + 'px';
    t.style.top  = top.toFixed(0) + 'px';
  }
  function hideTip() { if (_tip) _tip.classList.remove('is-on'); }

  function tipText(el) {
    return String(el.getAttribute('data-tip') || '').split('\n').map(function(l, i) {
      return i === 0 ? '<div class="chart-tip-h">' + esc(l) + '</div>' : '<div class="chart-tip-r">' + esc(l) + '</div>';
    }).join('');
  }

  document.addEventListener('pointermove', function(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (el) showTip(tipText(el), e.clientX, e.clientY);
    else if (_tip && _tip.classList.contains('is-on') && !(e.target.closest && e.target.closest('[data-scrub]'))) hideTip();
  });
  document.addEventListener('focusin', function(e) {
    var el = e.target && e.target.closest ? e.target.closest('[data-tip]') : null;
    if (!el) return;
    var r = el.getBoundingClientRect();
    showTip(tipText(el), r.left + r.width / 2, r.top + r.height / 2);
  });
  document.addEventListener('focusout', function(e) {
    if (e.target && e.target.closest && e.target.closest('[data-tip]')) hideTip();
  });
  document.addEventListener('keydown', function(e) { if (e.key === 'Escape') hideTip(); });

  /* ── Scrub: crosshair + tooltip following pointer and arrow keys ──
     host: element wrapping one <svg>; cfg: { n, xs[], top, bottom, html(i), dots(i)->[{x,y,color}], label } */
  function scrub(host, cfg) {
    var svg = host && host.querySelector('svg');
    if (!svg || !cfg || !cfg.n) return;
    var NS = 'http://www.w3.org/2000/svg';
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'ch-hover');
    g.setAttribute('visibility', 'hidden');
    var line = document.createElementNS(NS, 'line');
    line.setAttribute('class', 'ch-cross');
    line.setAttribute('y1', cfg.top);
    line.setAttribute('y2', cfg.bottom);
    g.appendChild(line);
    svg.appendChild(g);
    var cur = -1;

    host.setAttribute('tabindex', '0');
    host.setAttribute('data-scrub', '');
    host.setAttribute('role', 'group');
    host.setAttribute('aria-label', cfg.label || 'Chart. Use the left and right arrow keys to read each point.');

    function scale() {
      var vb = svg.viewBox && svg.viewBox.baseVal;
      var r = svg.getBoundingClientRect();
      return { k: vb && vb.width ? r.width / vb.width : 1, r: r };
    }
    function show(i, fromPointer, ev) {
      i = Math.max(0, Math.min(cfg.n - 1, i));
      cur = i;
      var s = scale();
      var x = cfg.xs[i];
      line.setAttribute('x1', x); line.setAttribute('x2', x);
      while (g.childNodes.length > 1) g.removeChild(g.lastChild);
      (cfg.dots ? cfg.dots(i) : []).forEach(function(d) {
        if (!finite(d.x) || !finite(d.y)) return;
        var c = document.createElementNS(NS, 'circle');
        c.setAttribute('class', 'ch-dot');
        c.setAttribute('cx', d.x); c.setAttribute('cy', d.y); c.setAttribute('r', 4);
        c.setAttribute('style', '--sc:' + d.color);
        g.appendChild(c);
      });
      g.setAttribute('visibility', 'visible');
      var cx = s.r.left + x * s.k;
      var cy = fromPointer && ev ? ev.clientY : s.r.top + ((cfg.top + cfg.bottom) / 2) * s.k;
      showTip(cfg.html(i), cx, cy);
      host.setAttribute('data-index', String(i));
    }
    function hide() {
      g.setAttribute('visibility', 'hidden');
      hideTip();
      cur = -1;
      host.removeAttribute('data-index');
    }
    function nearest(clientX) {
      var s = scale();
      var x = (clientX - s.r.left) / s.k, best = 0, bd = Infinity;
      for (var i = 0; i < cfg.n; i++) { var d = Math.abs(cfg.xs[i] - x); if (d < bd) { bd = d; best = i; } }
      return best;
    }
    host.addEventListener('pointermove', function(e) { show(nearest(e.clientX), true, e); });
    host.addEventListener('pointerleave', function() { if (document.activeElement !== host) hide(); });
    host.addEventListener('focus', function() { if (cur < 0) show(cfg.n - 1, false); });
    host.addEventListener('blur', hide);
    host.addEventListener('keydown', function(e) {
      var k = e.key;
      if (k === 'ArrowLeft' || k === 'ArrowDown') show((cur < 0 ? cfg.n : cur) - 1, false);
      else if (k === 'ArrowRight' || k === 'ArrowUp') show((cur < 0 ? -1 : cur) + 1, false);
      else if (k === 'Home') show(0, false);
      else if (k === 'End') show(cfg.n - 1, false);
      else if (k === 'Escape') { hide(); return; }
      else return;
      e.preventDefault();
    });
  }

  /* ── Sparkline ── */
  function sparkline(values, opts) {
    opts = opts || {};
    var w = opts.w||250, h = opts.h||38;
    var stroke = opts.color || 'var(--text)';
    if (!values || values.length < 2) {
      return '<svg width="'+w+'" height="'+h+'"><text x="'+(w/2)+'" y="'+(h/2+4)+'" text-anchor="middle" font-size="12" style="fill:var(--faint)">No data yet</text></svg>';
    }
    var max = Math.max.apply(null, values); if (!max) max = 1;
    var pad = 4, xStep = (w - pad*2) / (values.length - 1);
    var pts = values.map(function(v,i) { return [pad+i*xStep, h-pad-(v/max)*(h-pad*2)]; });
    var dPath = pts.map(function(p,i) { return (i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' ');
    var last  = pts[pts.length-1];
    var ok = pts.every(function(p) { return finite(p[0]) && finite(p[1]); });
    if (!ok) {
      return '<svg width="'+w+'" height="'+h+'"><text x="'+(w/2)+'" y="'+(h/2+4)+'" text-anchor="middle" font-size="12" style="fill:var(--faint)">No data yet</text></svg>';
    }
    return '<svg width="'+w+'" height="'+h+'">'
      +'<path d="'+dPath+'" fill="none" style="stroke:'+stroke+'" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>'
      +'<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="3" style="fill:var(--data)"/>'
      +'</svg>';
  }

  function ctxBarClass(pct) {
    if (pct > 80) return 'ctx-bar-fill crit';
    if (pct > 60) return 'ctx-bar-fill warn';
    return 'ctx-bar-fill';
  }

  /* ── Cumulative cost growth (per-turn lines) ── */
  function growthSVG(sessions, modelIds) {
    var w=540, h=200, pad={t:14,r:16,b:40,l:64};
    var iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
    var maxT=0, maxC=0;
    modelIds.forEach(function(id) {
      var s=sessions[id]; if(!s) return;
      if(s.turns.length>maxT) maxT=s.turns.length;
      s.turns.forEach(function(t) { if((t.cumCost||0)>maxC) maxC=t.cumCost; });
    });
    if (!maxT) return '<div class="an-empty">Send prompts to see cumulative cost.</div>';
    if (!maxC) maxC=0.000001;
    var xFn=function(t){return pad.l+(t/maxT)*iw;};
    var yFn=function(c){return pad.t+ih-(c/maxC)*ih;};
    var grid='', paths='', dots='';
    for (var g=0; g<=4; g++) {
      var yy=pad.t+ih*(1-g/4);
      grid+='<line x1="'+pad.l+'" y1="'+yy.toFixed(1)+'" x2="'+(w-pad.r)+'" y2="'+yy.toFixed(1)+'" class="ch-grid"/>';
      grid+='<text x="'+(pad.l-6)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" class="ch-tick">'+CALC.fmtCost(maxC*g/4)+'</text>';
    }
    for (var t=1; t<=maxT; t++) {
      grid+='<text x="'+xFn(t).toFixed(1)+'" y="'+(h-pad.b+16)+'" text-anchor="middle" class="ch-tick">'+t+'</text>';
    }
    modelIds.forEach(function(id,ci) {
      var s=sessions[id]; if(!s||s.turns.length<1) return;
      var d=s.turns.map(function(turn,i){
        var xx=xFn(i+1).toFixed(1), yy=yFn(turn.cumCost||0).toFixed(1);
        return (i?'L':'M')+xx+','+yy;
      }).join(' ');
      if (d.indexOf('NaN') !== -1) return;
      var dsh = dash(ci);
      paths+='<path d="'+d+'" fill="none" class="ch-line" style="--sc:'+color(ci)+'"'+(dsh?' stroke-dasharray="'+dsh+'"':'')+'/>';
      var last=s.turns[s.turns.length-1];
      dots+='<circle cx="'+xFn(s.turns.length).toFixed(1)+'" cy="'+yFn(last.cumCost||0).toFixed(1)+'" r="4" class="ch-dot" style="--sc:'+color(ci)+'"/>';
    });
    return '<svg width="'+w+'" height="'+h+'" style="max-width:100%;display:block" role="img" aria-label="Cumulative cost per turn">'
      +grid+paths+dots
      +'</svg>';
  }

  // Tokens per second estimate by model class
  function getTPS(modelId) {
    var id = (modelId || '').toLowerCase();
    if (/\bo3\b|o1|reasoning/.test(id)) return 15;
    if (/opus|claude-3-opus|llama.*405b|gpt-4-turbo|deepseek-r1/.test(id)) return 25;
    if (/gpt-4o[^-]|claude.*sonnet|gemini.*pro|llama.*70b|mistral-large|grok-3/.test(id)) return 45;
    if (/mini|haiku|flash|nano|tiny|8b|7b|3b/.test(id)) return 90;
    return 40;
  }

  // SVG radar/spider chart comparing active models across 5 dimensions
  function radarSVG(models) {
    var W=340, H=300, CX=170, CY=148, R=100;
    var axes = ['Cost\nEfficiency','CO₂\nEfficiency','Power\nEfficiency','Context\nSize','Speed'];
    var AXN = ['Cost efficiency','CO₂ efficiency','Power efficiency','Context size','Speed'];
    var N = axes.length;
    if (!models || !models.length) return '<div class="an-empty">Select models to see the radar chart.</div>';

    var vals = models.map(function(m) {
      var ip = parseFloat(m.pricing&&m.pricing.prompt||0)*1e6;
      var op = parseFloat(m.pricing&&m.pricing.completion||0)*1e6;
      return { cost:(ip+op)/2||0.001, co2:DATA.getCO2Rate(m.id)||1, power:DATA.getPowerRate(m.id)||1,
               ctx:m.context_length||4096, tps:getTPS(m.id) };
    });
    var maxCost=Math.max.apply(null,vals.map(function(v){return v.cost;}))||1;
    var maxCO2=Math.max.apply(null,vals.map(function(v){return v.co2;}))||1;
    var maxPow=Math.max.apply(null,vals.map(function(v){return v.power;}))||1;
    var maxCtx=Math.max.apply(null,vals.map(function(v){return v.ctx;}))||1;
    var maxTPS=Math.max.apply(null,vals.map(function(v){return v.tps;}))||1;

    function normVals(v) {
      return [1-(v.cost/maxCost), 1-(v.co2/maxCO2), 1-(v.power/maxPow), v.ctx/maxCtx, v.tps/maxTPS];
    }
    function axPt(i,r) {
      var a=(i/N)*2*Math.PI - Math.PI/2;
      return [CX+r*Math.cos(a), CY+r*Math.sin(a)];
    }
    var grid='';
    for (var ring=1;ring<=4;ring++) {
      var pts=[];
      for (var i=0;i<N;i++) { var p=axPt(i,R*ring/4); pts.push(p[0].toFixed(1)+','+p[1].toFixed(1)); }
      grid+='<polygon points="'+pts.join(' ')+'" fill="none" class="ch-grid"/>';
    }
    var axSVG='';
    for (var j=0;j<N;j++) {
      var ep=axPt(j,R);
      axSVG+='<line x1="'+CX+'" y1="'+CY+'" x2="'+ep[0].toFixed(1)+'" y2="'+ep[1].toFixed(1)+'" class="ch-grid"/>';
      var lp=axPt(j,R+24); var parts=axes[j].split('\n');
      var anchor=lp[0]<CX-10?'end':lp[0]>CX+10?'start':'middle';
      parts.forEach(function(part,pi) {
        axSVG+='<text x="'+lp[0].toFixed(1)+'" y="'+(lp[1]+pi*13-((parts.length-1)*6.5)+4).toFixed(1)+'" text-anchor="'+anchor+'" class="ch-tick">'+part+'</text>';
      });
    }
    var polys='';
    models.forEach(function(m,mi) {
      var nv=normVals(vals[mi]);
      var pts=nv.map(function(v,i){var p=axPt(i,R*Math.max(0.05,v));return p[0].toFixed(1)+','+p[1].toFixed(1);});
      var dsh = dash(mi);
      polys+='<polygon points="'+pts.join(' ')+'" class="ch-radar" style="--sc:'+color(mi)+'"'+(dsh?' stroke-dasharray="'+dsh+'"':'')+'/>';
      nv.forEach(function(v,i){
        var p=axPt(i,R*Math.max(0.05,v));
        var tip=(m.name||m.id.split('/').pop())+'\n'+AXN[i]+': '+(v*100).toFixed(0)+' of 100';
        polys+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="4" class="ch-dot" tabindex="0" data-tip="'+esc(tip)+'" style="--sc:'+color(mi)+'"/>';
      });
    });
    return '<svg width="'+W+'" height="'+H+'" style="display:block" role="group" aria-label="Radar chart comparing models on cost, CO₂, power, context size and speed">'+grid+axSVG+polys+'</svg>';
  }

  function radarLegend(models) {
    return '<div class="radar-legend">'
      +models.map(function(m,i){
        var sname=esc(m.name||m.id.split('/').pop());
        return '<div class="radar-legend-item"><div class="radar-legend-dot" style="background:'+color(i)+'"></div><span>'+sname+'</span></div>';
      }).join('')
      +'</div>';
  }

  return {sparkline: sparkline, ctxBarClass: ctxBarClass, growthSVG: growthSVG, getTPS: getTPS, radarSVG: radarSVG, radarLegend: radarLegend,
          color: color, dash: dash, finite: finite, esc: esc, showTip: showTip, hideTip: hideTip, scrub: scrub};
})();
