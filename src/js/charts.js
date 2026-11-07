/* ══════════════════════════════════════════════════════════
   MODULE 6 — CHARTS
   SVG sparklines, context bar class, growth chart SVG
   ══════════════════════════════════════════════════════════ */
window.CHARTS = (function() {

  function sparkline(values, opts) {
    opts = opts || {};
    var w = opts.w||250, h = opts.h||38;
    var color = opts.color||'#0A6B3C', fill = opts.fill||'rgba(10,107,60,0.12)';
    if (!values || values.length < 2) {
      return '<svg width="'+w+'" height="'+h+'"><text x="'+(w/2)+'" y="'+(h/2+4)+'" text-anchor="middle" font-size="10" fill="#999">No data yet</text></svg>';
    }
    var max = Math.max.apply(null, values); if (!max) max = 1;
    var pad = 4, xStep = (w - pad*2) / (values.length - 1);
    var pts = values.map(function(v,i) { return [pad+i*xStep, h-pad-(v/max)*(h-pad*2)]; });
    var dPath = pts.map(function(p,i) { return (i?'L':'M')+p[0].toFixed(1)+','+p[1].toFixed(1); }).join(' ');
    var last  = pts[pts.length-1];
    var dFill = dPath+' L'+last[0].toFixed(1)+','+h+' L'+pad+','+h+' Z';
    return '<svg width="'+w+'" height="'+h+'">'
      +'<path d="'+dFill+'" fill="'+fill+'"/>'
      +'<path d="'+dPath+'" fill="none" stroke="'+color+'" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>'
      +'<circle cx="'+last[0].toFixed(1)+'" cy="'+last[1].toFixed(1)+'" r="3" fill="'+color+'"/>'
      +'</svg>';
  }

  function ctxBarClass(pct) {
    if (pct > 80) return 'ctx-bar-fill crit';
    if (pct > 60) return 'ctx-bar-fill warn';
    return 'ctx-bar-fill';
  }

  function growthSVG(sessions, modelIds) {
    var w=540, h=180, pad={t:14,r:16,b:36,l:62};
    var iw=w-pad.l-pad.r, ih=h-pad.t-pad.b;
    var colors=['#0A6B3C','#0072A3','#1A9456','#B85C00','#054D29','#29B76A','#5C2D91','#D13212','#003087','#00627A'];
    var maxT=0, maxC=0;
    modelIds.forEach(function(id) {
      var s=sessions[id]; if(!s) return;
      if(s.turns.length>maxT) maxT=s.turns.length;
      s.turns.forEach(function(t) { if((t.cumCost||0)>maxC) maxC=t.cumCost; });
    });
    if (!maxT) return '<em style="font-size:11px;color:#999">Send prompts to see growth chart</em>';
    if (!maxC) maxC=0.000001;
    var xFn=function(t){return pad.l+(t/maxT)*iw;};
    var yFn=function(c){return pad.t+ih-(c/maxC)*ih;};
    var grid='', paths='', dots='', legend='';
    for (var g=0; g<=4; g++) {
      var yy=pad.t+ih*(1-g/4);
      grid+='<line x1="'+pad.l+'" y1="'+yy.toFixed(1)+'" x2="'+(w-pad.r)+'" y2="'+yy.toFixed(1)+'" stroke="#E2E2E2" stroke-dasharray="3,3"/>';
      grid+='<text x="'+(pad.l-4)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" font-size="9" fill="#999">'+CALC.fmtCost(maxC*g/4)+'</text>';
    }
    for (var t=1; t<=maxT; t++) {
      grid+='<text x="'+xFn(t).toFixed(1)+'" y="'+(h-pad.b+13)+'" text-anchor="middle" font-size="10" fill="#999">'+t+'</text>';
    }
    modelIds.forEach(function(id,ci) {
      var s=sessions[id]; if(!s||s.turns.length<1) return;
      var color=colors[ci%colors.length];
      var d=s.turns.map(function(turn,i){
        var xx=xFn(i+1).toFixed(1), yy=yFn(turn.cumCost||0).toFixed(1);
        return (i?'L':'M')+xx+','+yy;
      }).join(' ');
      paths+='<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>';
      var last=s.turns[s.turns.length-1];
      dots+='<circle cx="'+xFn(s.turns.length).toFixed(1)+'" cy="'+yFn(last.cumCost||0).toFixed(1)+'" r="4" fill="'+color+'"/>';
      var lx=8+ci*120, sname=id.split('/').pop().slice(0,13);
      legend+='<rect x="'+lx+'" y="'+(h-10)+'" width="14" height="3" fill="'+color+'" rx="1"/>';
      legend+='<text x="'+(lx+18)+'" y="'+(h-5)+'" font-size="9" fill="#666">'+sname+'</text>';
    });
    return '<svg width="'+w+'" height="'+h+'" style="max-width:100%;display:block">'
      +'<text x="'+pad.l+'" y="11" font-size="10" fill="#666">Cumulative cost per turn</text>'
      +grid+paths+dots+legend
      +'<rect x="'+pad.l+'" y="'+pad.t+'" width="'+iw+'" height="'+ih+'" fill="none" stroke="#E2E2E2"/>'
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
    var W=320, H=300, CX=145, CY=148, R=100;
    var axes = ['Cost\nEfficiency','CO₂\nEfficiency','Power\nEfficiency','Context\nSize','Speed'];
    var N = axes.length;
    var colors = ['#0A6B3C','#0072A3','#1A9456','#B85C00','#054D29','#29B76A','#5C2D91','#D13212','#003087','#00627A'];
    if (!models || !models.length) return '<em style="font-size:11px;color:#999">Select models to see radar chart</em>';

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
      grid+='<polygon points="'+pts.join(' ')+'" fill="none" stroke="#DDD" stroke-width="1"/>';
    }
    var axSVG='';
    for (var i=0;i<N;i++) {
      var ep=axPt(i,R);
      axSVG+='<line x1="'+CX+'" y1="'+CY+'" x2="'+ep[0].toFixed(1)+'" y2="'+ep[1].toFixed(1)+'" stroke="#CCC" stroke-width="1"/>';
      var lp=axPt(i,R+24); var parts=axes[i].split('\n');
      var anchor=lp[0]<CX-10?'end':lp[0]>CX+10?'start':'middle';
      parts.forEach(function(part,pi) {
        axSVG+='<text x="'+lp[0].toFixed(1)+'" y="'+(lp[1]+pi*11-((parts.length-1)*5.5)).toFixed(1)+'" text-anchor="'+anchor+'" font-size="9" fill="#666">'+part+'</text>';
      });
    }
    var polys='';
    models.forEach(function(m,mi) {
      var nv=normVals(vals[mi]); var color=colors[mi%colors.length];
      var pts=nv.map(function(v,i){var p=axPt(i,R*Math.max(0.05,v));return p[0].toFixed(1)+','+p[1].toFixed(1);});
      polys+='<polygon points="'+pts.join(' ')+'" fill="'+color+'" fill-opacity="0.13" stroke="'+color+'" stroke-width="2"/>';
      nv.forEach(function(v,i){var p=axPt(i,R*Math.max(0.05,v));polys+='<circle cx="'+p[0].toFixed(1)+'" cy="'+p[1].toFixed(1)+'" r="3" fill="'+color+'"/>';});
    });
    return '<svg width="'+W+'" height="'+H+'" style="display:block">'+grid+axSVG+polys+'</svg>';
  }

  function radarLegend(models) {
    var colors=['#0A6B3C','#0072A3','#1A9456','#B85C00','#054D29','#29B76A','#5C2D91','#D13212','#003087','#00627A'];
    return '<div class="radar-legend">'
      +models.map(function(m,i){
        var sname=m.name||m.id.split('/').pop();
        return '<div class="radar-legend-item"><div class="radar-legend-dot" style="background:'+colors[i%colors.length]+'"></div><span>'+sname+'</span></div>';
      }).join('')
      +'</div>';
  }

  return {sparkline, ctxBarClass, growthSVG, getTPS, radarSVG, radarLegend};
})();


