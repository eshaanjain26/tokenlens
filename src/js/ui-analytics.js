/* ══════════════════════════════════════════════════════════
   MODULE — UI_ANALYTICS
   Interactive session analytics: charts, projections, footprint
   ══════════════════════════════════════════════════════════ */
window.UI_ANALYTICS = (function() {

  var COLORS = ['#0A6B3C','#B85C00','#0072A3','#7C3AED','#054D29','#C82020','#0891B2','#A16B00','#29B76A','#D97706'];
  var _activeMetric = 'co2'; // default projection metric

  /* ── helpers ── */
  function esc(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;'); }
  function fmt2(n) { return Number(n).toFixed(2); }
  function shortName(id) { return (id||'').split('/').pop().slice(0,20); }

  /* ── SVG bar chart ── */
  function barChartSVG(opts) {
    // opts: { title, groups:[{label,values:[{v,color}]}], yLabel, fmtY, W, H }
    var W = opts.W||520, H = opts.H||220;
    var pad = {t:28, r:16, b:52, l:60};
    var iw = W-pad.l-pad.r, ih = H-pad.t-pad.b;
    var groups = opts.groups || [];
    var allVals = []; groups.forEach(function(g){ g.values.forEach(function(v){ allVals.push(v.v); }); });
    var maxV = Math.max.apply(null, allVals.concat([0.000001]));
    var nGroups = groups.length;
    var barW = Math.min(32, (iw / (nGroups||1)) * 0.7);
    var gapW = (iw - barW * nGroups) / (nGroups + 1);
    var fmt = opts.fmtY || function(v){ return v.toFixed(2); };
    var yLabel = opts.yLabel || '';

    var grid = '';
    for (var i = 0; i <= 4; i++) {
      var yy = pad.t + ih * (1 - i/4);
      grid += '<line x1="'+pad.l+'" y1="'+yy.toFixed(1)+'" x2="'+(W-pad.r)+'" y2="'+yy.toFixed(1)+'" stroke="#DCE8E2" stroke-dasharray="3,3"/>';
      grid += '<text x="'+(pad.l-5)+'" y="'+(yy+3.5).toFixed(1)+'" text-anchor="end" font-size="9" fill="#8AA89A">'+fmt(maxV*i/4)+'</text>';
    }
    grid += '<text x="'+(pad.l-40)+'" y="'+(pad.t+ih/2)+'" text-anchor="middle" font-size="9" fill="#8AA89A" transform="rotate(-90,'+(pad.l-40)+','+(pad.t+ih/2)+')">'+yLabel+'</text>';

    var bars = '', xlabels = '';
    groups.forEach(function(g, gi) {
      var cx = pad.l + gapW*(gi+1) + barW*(gi+0.5);
      // stacked or single bar — just show first value for now (total per model)
      var barH = ih * (g.values[0].v / maxV);
      var by = pad.t + ih - barH;
      bars += '<rect x="'+(cx-barW/2).toFixed(1)+'" y="'+by.toFixed(1)+'" width="'+barW+'" height="'+barH.toFixed(1)+'" fill="'+g.values[0].color+'" rx="3"/>';
      // value label on top
      if (barH > 12) {
        bars += '<text x="'+cx.toFixed(1)+'" y="'+(by-3).toFixed(1)+'" text-anchor="middle" font-size="8.5" fill="'+g.values[0].color+'" font-weight="700">'+fmt(g.values[0].v)+'</text>';
      }
      // x label
      var parts = g.label.split(' ');
      parts.forEach(function(p, pi) {
        xlabels += '<text x="'+cx.toFixed(1)+'" y="'+(pad.t+ih+14+pi*11)+'" text-anchor="middle" font-size="9" fill="#4A6358">'+p+'</text>';
      });
    });

    return '<svg width="'+W+'" height="'+H+'" style="max-width:100%;display:block">'
      + '<text x="'+pad.l+'" y="17" font-size="10" fill="#0A6B3C" font-weight="700">'+esc(opts.title||'')+'</text>'
      + grid + bars + xlabels
      + '<rect x="'+pad.l+'" y="'+pad.t+'" width="'+iw+'" height="'+ih+'" fill="none" stroke="#DCE8E2"/>'
      + '</svg>';
  }

  /* ── SVG grouped bar chart (tokens: input vs output) ── */
  function groupedBarChartSVG(opts) {
    var W = opts.W||520, H = opts.H||220;
    var pad = {t:28, r:16, b:52, l:70};
    var iw = W-pad.l-pad.r, ih = H-pad.t-pad.b;
    var groups = opts.groups || []; // [{label, a, b}]  a=input, b=output
    var maxV = 0;
    groups.forEach(function(g){ maxV = Math.max(maxV, g.a+g.b); });
    if (!maxV) maxV = 1;
    var fmt = opts.fmtY || function(v){ return v >= 1000 ? (v/1000).toFixed(1)+'K' : v.toFixed(0); };
    var nG = groups.length;
    var slotW = iw / (nG || 1);
    var bw = Math.min(22, slotW * 0.28);

    var grid = '';
    for (var i=0; i<=4; i++) {
      var yy = pad.t + ih*(1-i/4);
      grid += '<line x1="'+pad.l+'" y1="'+yy.toFixed(1)+'" x2="'+(W-pad.r)+'" y2="'+yy.toFixed(1)+'" stroke="#DCE8E2" stroke-dasharray="3,3"/>';
      grid += '<text x="'+(pad.l-4)+'" y="'+(yy+3.5).toFixed(1)+'" text-anchor="end" font-size="9" fill="#8AA89A">'+fmt(maxV*i/4)+'</text>';
    }
    var bars='', xlabels='';
    groups.forEach(function(g, gi) {
      var cx = pad.l + slotW*(gi+0.5);
      var ahH = ih*(g.a/maxV), bhH = ih*(g.b/maxV);
      var ay = pad.t+ih-ahH, by2 = pad.t+ih-bhH;
      bars += '<rect x="'+(cx-bw-1).toFixed(1)+'" y="'+ay.toFixed(1)+'" width="'+bw+'" height="'+ahH.toFixed(1)+'" fill="#0A6B3C" rx="2" opacity="0.9"/>';
      bars += '<rect x="'+(cx+1).toFixed(1)+'" y="'+by2.toFixed(1)+'" width="'+bw+'" height="'+bhH.toFixed(1)+'" fill="#29B76A" rx="2" opacity="0.9"/>';
      var lparts = g.label.split(' ');
      lparts.forEach(function(p,pi){
        xlabels += '<text x="'+cx.toFixed(1)+'" y="'+(pad.t+ih+13+pi*10)+'" text-anchor="middle" font-size="8.5" fill="#4A6358">'+p+'</text>';
      });
    });
    // legend
    var leg = '<rect x="'+pad.l+'" y="'+(H-8)+'" width="10" height="8" fill="#0A6B3C" rx="1"/>'
            + '<text x="'+(pad.l+13)+'" y="'+(H-1)+'" font-size="9" fill="#4A6358">Input tokens</text>'
            + '<rect x="'+(pad.l+90)+'" y="'+(H-8)+'" width="10" height="8" fill="#29B76A" rx="1"/>'
            + '<text x="'+(pad.l+103)+'" y="'+(H-1)+'" font-size="9" fill="#4A6358">Output tokens</text>';

    return '<svg width="'+W+'" height="'+H+'" style="max-width:100%;display:block">'
      + '<text x="'+pad.l+'" y="17" font-size="10" fill="#0A6B3C" font-weight="700">'+esc(opts.title||'')+'</text>'
      + grid + bars + xlabels + leg
      + '<rect x="'+pad.l+'" y="'+pad.t+'" width="'+iw+'" height="'+ih+'" fill="none" stroke="#DCE8E2"/>'
      + '</svg>';
  }

  /* ── SVG multi-line chart (per-turn metric over time, all models) ── */
  function lineChartSVG(opts) {
    var W = opts.W||520, H = opts.H||200;
    var pad = {t:26, r:18, b:44, l:62};
    var iw = W-pad.l-pad.r, ih = H-pad.t-pad.b;
    var series = opts.series || []; // [{label, color, points:[v,v,...]}]
    var maxT = 0, maxV = 0;
    series.forEach(function(s){ maxT = Math.max(maxT, s.points.length); s.points.forEach(function(v){ maxV = Math.max(maxV, v); }); });
    if (!maxT) return '<em style="font-size:11px;color:#8AA89A">No turn data yet</em>';
    if (!maxV) maxV = 0.000001;
    var fmt = opts.fmtY || function(v){ return v.toFixed(4); };
    var xFn = function(i){ return pad.l + (i/(maxT-1||1))*iw; };
    var yFn = function(v){ return pad.t + ih - (v/maxV)*ih; };

    var grid='';
    for (var i=0;i<=4;i++){
      var yy=pad.t+ih*(1-i/4);
      grid+='<line x1="'+pad.l+'" y1="'+yy.toFixed(1)+'" x2="'+(W-pad.r)+'" y2="'+yy.toFixed(1)+'" stroke="#DCE8E2" stroke-dasharray="3,3"/>';
      grid+='<text x="'+(pad.l-4)+'" y="'+(yy+3.5).toFixed(1)+'" text-anchor="end" font-size="9" fill="#8AA89A">'+fmt(maxV*i/4)+'</text>';
    }
    for (var t=0;t<maxT;t++){
      grid+='<text x="'+xFn(t).toFixed(1)+'" y="'+(H-pad.b+13)+'" text-anchor="middle" font-size="9" fill="#8AA89A">T'+(t+1)+'</text>';
    }

    var lines='', dots='', leg='';
    series.forEach(function(s,si){
      if (!s.points.length) return;
      var d = s.points.map(function(v,i){ return (i?'L':'M')+xFn(i).toFixed(1)+','+yFn(v).toFixed(1); }).join(' ');
      var last = s.points[s.points.length-1];
      lines += '<path d="'+d+'" fill="none" stroke="'+s.color+'" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" opacity="0.9"/>';
      dots  += '<circle cx="'+xFn(s.points.length-1).toFixed(1)+'" cy="'+yFn(last).toFixed(1)+'" r="4" fill="'+s.color+'" stroke="white" stroke-width="1.5"/>';
      var lx = pad.l + si*130;
      leg += '<rect x="'+lx+'" y="'+(H-9)+'" width="14" height="3" fill="'+s.color+'" rx="1"/>';
      leg += '<text x="'+(lx+17)+'" y="'+(H-4)+'" font-size="9" fill="#4A6358">'+esc(shortName(s.label))+'</text>';
    });

    return '<svg width="'+W+'" height="'+H+'" style="max-width:100%;display:block">'
      + '<text x="'+pad.l+'" y="17" font-size="10" fill="#0A6B3C" font-weight="700">'+esc(opts.title||'')+'</text>'
      + grid + lines + dots + leg
      + '<rect x="'+pad.l+'" y="'+pad.t+'" width="'+iw+'" height="'+ih+'" fill="none" stroke="#DCE8E2"/>'
      + '</svg>';
  }

  /* ── SVG horizontal stacked bar (sustainability comparison) ── */
  function sustainabilityCompSVG(models, sessions) {
    var W=520, H=Math.max(180, models.length*52+60);
    var pad={t:30,r:100,b:20,l:130};
    var iw=W-pad.l-pad.r, ih=H-pad.t-pad.b;
    var rowH=ih/models.length;
    var metrics=[
      {key:'totalCO2',   label:'CO₂ (g)',   color:'#0A7A48'},
      {key:'totalWater', label:'Water (mL)', color:'#0072A3'},
      {key:'totalPower', label:'Power (Wh)', color:'#B85C00'},
    ];
    var maxVals={};
    metrics.forEach(function(m){ maxVals[m.key]=0; });
    models.forEach(function(m){
      var s=sessions[m.id]; if(!s) return;
      metrics.forEach(function(mt){ maxVals[mt.key]=Math.max(maxVals[mt.key], s[mt.key]||0); });
    });

    var rows='', ylabels='';
    models.forEach(function(m, mi){
      var s=sessions[m.id]||{totalCO2:0,totalWater:0,totalPower:0};
      var y=pad.t+mi*rowH+rowH/2;
      ylabels+='<text x="'+(pad.l-6)+'" y="'+(y+4)+'" text-anchor="end" font-size="9.5" fill="#0F1F18">'+esc(shortName(m.id))+'</text>';
      metrics.forEach(function(mt, mti){
        var bw=iw*(3/4)*(1/metrics.length);
        var bx=pad.l+mti*(bw+4);
        var mx=maxVals[mt.key]||0.000001;
        var frac=Math.max(0,Math.min(1,(s[mt.key]||0)/mx));
        var bh=Math.max(2,rowH*0.35);
        rows+='<rect x="'+bx.toFixed(1)+'" y="'+(y-bh/2).toFixed(1)+'" width="'+(bw*frac).toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="'+mt.color+'" rx="2" opacity="0.85"/>';
        rows+='<rect x="'+bx.toFixed(1)+'" y="'+(y-bh/2).toFixed(1)+'" width="'+bw.toFixed(1)+'" height="'+bh.toFixed(1)+'" fill="none" stroke="'+mt.color+'" stroke-opacity="0.3" rx="2"/>';
      });
    });

    var legend='';
    metrics.forEach(function(mt,mi){
      legend+='<rect x="'+(W-pad.r+8)+'" y="'+(pad.t+mi*18)+'" width="10" height="10" fill="'+mt.color+'" rx="2"/>';
      legend+='<text x="'+(W-pad.r+21)+'" y="'+(pad.t+mi*18+8)+'" font-size="9" fill="#4A6358">'+mt.label+'</text>';
    });

    return '<svg width="'+W+'" height="'+H+'" style="max-width:100%;display:block">'
      +'<text x="'+pad.l+'" y="17" font-size="10" fill="#0A6B3C" font-weight="700">Sustainability footprint per model (relative to session max)</text>'
      +ylabels+rows+legend
      +'</svg>';
  }

  /* ── SVG donut chart ── */
  function donutSVG(slices, title, total) {
    var W=200, H=200, CX=100, CY=95, R=68, ri=44;
    if (!slices || !slices.length || !total) {
      return '<svg width="'+W+'" height="'+H+'"><text x="100" y="100" text-anchor="middle" font-size="11" fill="#8AA89A">No data</text></svg>';
    }
    var a=-Math.PI/2, paths='', labels='';
    slices.forEach(function(s){
      var frac=s.v/total, ea=a+frac*2*Math.PI;
      if (frac < 0.001) { a=ea; return; }
      var large=frac>0.5?1:0;
      var x1=CX+R*Math.cos(a), y1=CY+R*Math.sin(a);
      var x2=CX+R*Math.cos(ea), y2=CY+R*Math.sin(ea);
      var xi1=CX+ri*Math.cos(a), yi1=CY+ri*Math.sin(a);
      var xi2=CX+ri*Math.cos(ea), yi2=CY+ri*Math.sin(ea);
      paths+='<path d="M'+xi1.toFixed(1)+','+yi1.toFixed(1)+' L'+x1.toFixed(1)+','+y1.toFixed(1)+' A'+R+','+R+' 0 '+large+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' L'+xi2.toFixed(1)+','+yi2.toFixed(1)+' A'+ri+','+ri+' 0 '+large+',0 '+xi1.toFixed(1)+','+yi1.toFixed(1)+' Z" fill="'+s.color+'" opacity="0.9"/>';
      if (frac > 0.1) {
        var ma=a+frac*Math.PI;
        var lx=CX+(R+ri)/2*Math.cos(ma), ly=CY+(R+ri)/2*Math.sin(ma);
        labels+='<text x="'+lx.toFixed(1)+'" y="'+(ly+3.5).toFixed(1)+'" text-anchor="middle" font-size="8.5" fill="white" font-weight="700">'+(frac*100).toFixed(0)+'%</text>';
      }
      a=ea;
    });
    return '<svg width="'+W+'" height="'+H+'" style="display:block">'
      +paths+labels
      +'<text x="'+CX+'" y="'+(CY-5)+'" text-anchor="middle" font-size="9" fill="#8AA89A">'+esc(title)+'</text>'
      +'<text x="'+CX+'" y="'+(CY+10)+'" text-anchor="middle" font-size="13" fill="#0F1F18" font-weight="900">'+total+'</text>'
      +'<text x="'+CX+'" y="'+(CY+24)+'" text-anchor="middle" font-size="8" fill="#8AA89A">total</text>'
      +'</svg>';
  }

  /* ── Projection calc ── */
  function calcProjection(sessionsPerDay, daysPerMonth, growthPct) {
    var models = STATE.getActiveModels();
    var results = [];
    var factor = growthPct / 100 + 1;
    models.forEach(function(m) {
      var s = STATE.getSession(m.id); if (!s || !s.turns.length) return;
      var monthly_runs = sessionsPerDay * daysPerMonth;
      var total_cost   = s.totalCost  * monthly_runs * factor;
      var total_co2    = s.totalCO2   * monthly_runs * factor;
      var total_water  = s.totalWater * monthly_runs * factor;
      var total_power  = s.totalPower * monthly_runs * factor;
      var total_tokens = (s.totalIn + s.totalOut) * monthly_runs * factor;
      results.push({ id: m.id, name: shortName(m.id), cost: total_cost, co2: total_co2, water: total_water, power: total_power, tokens: total_tokens });
    });
    return results;
  }

  /* ── card HTML helper ── */
  function card(title, sub, bodyHTML, legendHTML) {
    return '<div class="an-card">'
      +'<div class="an-card-head"><div><div class="an-card-title">'+title+'</div><div class="an-card-sub">'+sub+'</div></div></div>'
      +'<div class="an-card-body an-chart-wrap">'+bodyHTML+'</div>'
      +(legendHTML ? '<div class="an-legend">'+legendHTML+'</div>' : '')
    +'</div>';
  }

  function legendDot(color, label) {
    return '<div class="an-leg-item"><div class="an-leg-dot" style="background:'+color+'"></div>'+esc(label)+'</div>';
  }

  /* ── MAIN RENDER ── */
  function render() {
    var models = STATE.getActiveModels();
    var sessions = {};
    models.forEach(function(m){ sessions[m.id] = STATE.getSession(m.id); });

    // filter to models with data
    var active = models.filter(function(m){ var s=sessions[m.id]; return s && s.turns.length>0; });

    // ── KPI row ──
    var g = STATE.globalTotals();
    var totalTokens = 0;
    active.forEach(function(m){ var s=sessions[m.id]; totalTokens += (s.totalIn||0)+(s.totalOut||0); });
    document.getElementById('an-kpi-turns').textContent  = g.turns || '0';
    document.getElementById('an-kpi-tokens').textContent = totalTokens >= 1000 ? (totalTokens/1000).toFixed(1)+'K' : String(totalTokens||0);
    document.getElementById('an-kpi-cost').textContent   = CALC.fmtCost(g.cost);
    document.getElementById('an-kpi-co2').textContent    = CALC.fmtCO2(g.co2);
    document.getElementById('an-kpi-water').textContent  = CALC.fmtWater(g.water);

    var body = document.getElementById('an-body');
    if (!active.length) {
      body.innerHTML = '<div class="an-no-data"><div class="an-nd-icon">🌱</div><p>Run some prompts in the Compare tab, then return here to see your session analytics.</p></div>';
      return;
    }

    var W = Math.min(520, (body.clientWidth || 520) - 32);

    // ── Chart 1: Token volume grouped bar ──
    var tokenGroups = active.map(function(m,mi){
      var s=sessions[m.id];
      return { label: shortName(m.id).replace(/-/g,' '), a: s.totalIn||0, b: s.totalOut||0 };
    });
    var tokenSVG = groupedBarChartSVG({ title:'Token Volume by Model — Input vs Output', groups: tokenGroups, W: W, H: 220,
      fmtY: function(v){ return v>=1000?(v/1000).toFixed(1)+'K':v.toFixed(0); } });

    // ── Chart 2: Cost per turn line chart ──
    var costSeries = active.map(function(m,mi){
      var s=sessions[m.id];
      return { label: m.id, color: COLORS[mi%COLORS.length], points: s.turns.map(function(t){ return t.cost||0; }) };
    });
    var costLineSVG = lineChartSVG({ title:'Cost per Turn (USD)', series: costSeries, W: W, H: 200,
      fmtY: function(v){ return '$'+(v<0.001?v.toFixed(6):v.toFixed(4)); } });

    // ── Chart 3: CO2 per turn ──
    var co2Series = active.map(function(m,mi){
      var s=sessions[m.id];
      return { label: m.id, color: COLORS[mi%COLORS.length], points: s.turns.map(function(t){ return t.co2||0; }) };
    });
    var co2LineSVG = lineChartSVG({ title:'CO₂ per Turn (grams)', series: co2Series, W: W, H: 200,
      fmtY: function(v){ return v<0.001?(v*1000).toFixed(3)+'mg':v.toFixed(4)+'g'; } });

    // ── Chart 4: Water per turn ──
    var waterSeries = active.map(function(m,mi){
      var s=sessions[m.id];
      return { label: m.id, color: COLORS[mi%COLORS.length], points: s.turns.map(function(t){ return t.water||0; }) };
    });
    var waterLineSVG = lineChartSVG({ title:'Water per Turn (mL)', series: waterSeries, W: W, H: 200,
      fmtY: function(v){ return v.toFixed(3)+'mL'; } });

    // ── Chart 5: Cumulative cost line ──
    var cumCostSeries = active.map(function(m,mi){
      var s=sessions[m.id];
      return { label: m.id, color: COLORS[mi%COLORS.length], points: s.turns.map(function(t){ return t.cumCost||0; }) };
    });
    var cumCostSVG = lineChartSVG({ title:'Cumulative Cost Over Turns (USD)', series: cumCostSeries, W: W, H: 200,
      fmtY: function(v){ return '$'+(v<0.001?v.toFixed(6):v.toFixed(5)); } });

    // ── Chart 6: Sustainability comparison bars ──
    var susBarSVG = sustainabilityCompSVG(active, sessions);

    // ── Chart 7: Token share donut ──
    var donutSlices = active.map(function(m,mi){
      var s=sessions[m.id]; return { label: shortName(m.id), color: COLORS[mi%COLORS.length], v: (s.totalIn||0)+(s.totalOut||0) };
    });
    var totalTok = donutSlices.reduce(function(a,b){ return a+b.v; },0);
    var donutHtml = '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
      + donutSVG(donutSlices, 'tokens', totalTokens >= 1000 ? (totalTokens/1000).toFixed(1)+'K' : String(totalTokens||0))
      + '<div style="display:flex;flex-direction:column;gap:5px">'
      + donutSlices.map(function(s){ return legendDot(s.color, s.label+' — '+(totalTok?((s.v/totalTok)*100).toFixed(1)+'%':'—')); }).join('')
      + '</div></div>';

    // ── Chart 8: CO2 donut ──
    var co2Slices = active.map(function(m,mi){
      var s=sessions[m.id]; return { label: shortName(m.id), color: COLORS[mi%COLORS.length], v: s.totalCO2||0 };
    });
    var totalCO2 = co2Slices.reduce(function(a,b){ return a+b.v; },0);
    var co2DonutHtml = '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">'
      + donutSVG(co2Slices, 'CO₂', totalCO2 < 0.01 ? (totalCO2*1000).toFixed(2)+'mg' : totalCO2.toFixed(3)+'g')
      + '<div style="display:flex;flex-direction:column;gap:5px">'
      + co2Slices.map(function(s){ return legendDot(s.color, s.label+' — '+(totalCO2?(s.v/totalCO2*100).toFixed(1)+'%':'—')); }).join('')
      + '</div></div>';

    // ── Projection section ──
    var projHTML = '<div class="an-proj-section">'
      +'<div class="an-proj-title">🔭 Scale Projections</div>'
      +'<div class="an-proj-sub">Model what your token usage and sustainability footprint looks like at scale. Adjust the sliders and see how costs and impact compound.</div>'
      +'<div class="an-slider-group">'
        +'<div class="an-slider-row"><label>Sessions per day <span id="an-s-per-day-lbl">100</span></label><input type="range" min="1" max="10000" value="100" id="an-s-per-day" oninput="UI_ANALYTICS.updateProjection()"></div>'
        +'<div class="an-slider-row"><label>Days per month <span id="an-days-lbl">22</span></label><input type="range" min="1" max="31" value="22" id="an-days" oninput="UI_ANALYTICS.updateProjection()"></div>'
        +'<div class="an-slider-row"><label>Growth factor <span id="an-growth-lbl">+0%</span></label><input type="range" min="0" max="500" value="0" id="an-growth" oninput="UI_ANALYTICS.updateProjection()"></div>'
      +'</div>'
      +'<div id="an-proj-results" class="an-proj-results"></div>'
    +'</div>';

    // ── Line chart legend shared ──
    var lineLeg = active.map(function(m,mi){ return legendDot(COLORS[mi%COLORS.length], shortName(m.id)); }).join('');

    // ── Assemble layout ──
    body.innerHTML =
      // Row 1: tokens grouped bar + token donut
      '<div class="an-row cols-2">'
        + card('🪙 Token Volume', 'Input vs. output tokens per model this session', tokenSVG, lineLeg)
        + card('🍩 Token Share', 'Which models consumed the most tokens', donutHtml)
      +'</div>'
      // Row 2: cost per turn + cumulative cost
      +'<div class="an-row cols-2">'
        + card('💰 Cost per Turn', 'Per-turn billing across models — steeper = more expensive', costLineSVG, lineLeg)
        + card('📈 Cumulative Cost', 'Running total spend as conversation grows', cumCostSVG, lineLeg)
      +'</div>'
      // Row 3: CO2 per turn + water per turn
      +'<div class="an-row cols-2">'
        + card('🌱 CO₂ per Turn', 'Grams of CO₂ equivalent per turn — provider grid intensity applied', co2LineSVG, lineLeg)
        + card('💧 Water per Turn', 'Data center water evaporation per turn (mL)', waterLineSVG, lineLeg)
      +'</div>'
      // Row 4: sustainability comparison + CO2 donut
      +'<div class="an-row cols-2">'
        + card('🌍 Sustainability Footprint', 'CO₂, water and power relative to session max per model', '<div class="an-chart-wrap">'+susBarSVG+'</div>')
        + card('🌿 CO₂ Share', 'Carbon footprint distribution across selected models', co2DonutHtml)
      +'</div>'
      // Row 5: projections (full width)
      +'<div>'+ projHTML +'</div>';

    // init projection
    updateProjection();
  }

  function updateProjection() {
    var spd = parseInt(document.getElementById('an-s-per-day').value)||100;
    var days = parseInt(document.getElementById('an-days').value)||22;
    var growth = parseInt(document.getElementById('an-growth').value)||0;
    var lbl1 = document.getElementById('an-s-per-day-lbl');
    var lbl2 = document.getElementById('an-days-lbl');
    var lbl3 = document.getElementById('an-growth-lbl');
    if (lbl1) lbl1.textContent = spd >= 1000 ? (spd/1000).toFixed(1)+'K' : String(spd);
    if (lbl2) lbl2.textContent = String(days);
    if (lbl3) lbl3.textContent = '+'+growth+'%';

    var res = calcProjection(spd, days, growth);
    var el = document.getElementById('an-proj-results');
    if (!el) return;
    if (!res.length) { el.innerHTML = '<div style="font-size:12px;color:var(--text-3);padding:8px">No session data yet — run some prompts first.</div>'; return; }

    // Aggregate across models
    var tot = { cost:0, co2:0, water:0, power:0, tokens:0 };
    res.forEach(function(r){ tot.cost+=r.cost; tot.co2+=r.co2; tot.water+=r.water; tot.power+=r.power; tot.tokens+=r.tokens; });

    function pcard(icon, val, label, equiv, color) {
      return '<div class="an-proj-card">'
        +'<div class="apv" style="color:'+color+'">'+icon+' '+val+'</div>'
        +'<div class="apl">'+label+' / month</div>'
        +(equiv ? '<div class="ape">≈ '+equiv+'</div>' : '')
      +'</div>';
    }
    var co2kg = tot.co2 / 1000;
    var waterL = tot.water / 1000;
    el.innerHTML =
      pcard('💰', CALC.fmtCost(tot.cost), 'Cost', spd+' sessions/day', 'var(--amber)')
      +pcard('🪙', tot.tokens>=1e6?(tot.tokens/1e6).toFixed(2)+'M': tot.tokens>=1000?(tot.tokens/1000).toFixed(1)+'K':tot.tokens.toFixed(0), 'Tokens', '', 'var(--tl)')
      +pcard('🌱', co2kg>=1?co2kg.toFixed(2)+' kg': tot.co2.toFixed(2)+' g', 'CO₂', co2kg>0.001?(co2kg/0.404).toFixed(1)+' km driven':'—', 'var(--green)')
      +pcard('💧', waterL>=1?waterL.toFixed(2)+' L': tot.water.toFixed(1)+' mL', 'Water', waterL>0.25?(waterL/0.25).toFixed(1)+' glasses':'—', '#0072A3')
      +pcard('⚡', tot.power>=1000?(tot.power/1000).toFixed(3)+' kWh': tot.power.toFixed(4)+' Wh', 'Power', tot.power>=10?((tot.power/10.8)*100).toFixed(2)+'% of avg US daily':'—', 'var(--amber)');

    // Per-model breakdown
    if (res.length > 1) {
      el.innerHTML += '<div style="grid-column:1/-1;margin-top:8px;font-size:11px;font-weight:700;color:var(--text-2)">Per-model breakdown:</div>';
      res.forEach(function(r, ri) {
        el.innerHTML += '<div class="an-proj-card" style="border-color:'+COLORS[ri%COLORS.length]+';border-width:2px">'
          +'<div style="font-size:11px;font-weight:900;color:'+COLORS[ri%COLORS.length]+'">'+esc(r.name)+'</div>'
          +'<div style="font-size:10px;color:var(--text-2);margin-top:5px">'+CALC.fmtCost(r.cost)+'</div>'
          +'<div style="font-size:10px;color:var(--green)">'+(r.co2>=1?r.co2.toFixed(3)+'g':( r.co2*1000).toFixed(2)+'mg')+' CO₂</div>'
          +'<div style="font-size:10px;color:#0072A3">'+r.water.toFixed(2)+' mL H₂O</div>'
        +'</div>';
      });
    }
  }

  return { render: render, updateProjection: updateProjection };
})();

