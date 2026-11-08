/* ══════════════════════════════════════════════════════════
   MODULE — UI_ANALYTICS
   Session analytics: KPI row, one time chart, share tables, projections
   ══════════════════════════════════════════════════════════ */
window.UI_ANALYTICS = (function() {

  var LS_RANGE = 'tl_ui_range', LS_METRIC = 'tl_ui_metric', LS_PREV = 'tl_ui_prev';
  var RANGES = { all: 0, '10': 10, '5': 5 };
  var _range = lsGet(LS_RANGE, 'all');
  var _metric = lsGet(LS_METRIC, 'cost');
  var _prev = lsGet(LS_PREV, '0') === '1';
  if (!(_range in RANGES)) _range = 'all';
  var _focus = null, _sortDir = 'desc', _entered = false, _wired = false;
  var _proj = { spd: 100, days: 22, growth: 0 };
  var _kpiPrev = {}, _kpiRaf = {}, _lastW = 0, _rafResize = 0;

  /* ── helpers ── */
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v == null ? d : v; } catch (e) { return d; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return window.CHARTS.esc(s); }
  function shortName(id) { return (id||'').split('/').pop().slice(0,20); }
  function finite(n) { return typeof n === 'number' && isFinite(n); }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function icon(n, s) { return window.TL_ICON ? window.TL_ICON(n, s) : ''; }

  function fmtTokens(n) {
    if (n >= 1e6) return (n/1e6).toFixed(2)+'M';
    if (n >= 1000) return (n/1000).toFixed(1)+'K';
    return String(Math.round(n));
  }
  function fmtCo2Short(g) { return CALC.fmtCO2(g).replace(' CO₂', ''); }
  function fmtCo2Axis(v) { return v < 0.001 ? (v*1000).toFixed(3)+'mg' : v.toFixed(4)+'g'; }

  var METRICS = {
    cost:  { label: 'Cost per turn', sub: 'What each model charged on every turn in the selected range.',
             pick: function(t){ return t.cost||0; }, fmt: function(v){ return CALC.fmtCost(v); } },
    cum:   { label: 'Cumulative cost', sub: 'Running spend as the conversation grows turn by turn.',
             pick: function(t){ return t.cumCost||0; }, fmt: function(v){ return CALC.fmtCost(v); } },
    co2:   { label: 'CO₂ per turn', sub: 'Grams of CO₂ equivalent per turn, with provider grid intensity applied.',
             pick: function(t){ return t.co2||0; }, fmt: fmtCo2Axis },
    water: { label: 'Water per turn', sub: 'Data centre water used on every turn.',
             pick: function(t){ return t.water||0; }, fmt: function(v){ return CALC.fmtWater(v); } }
  };
  if (!METRICS[_metric]) _metric = 'cost';

  function axisFmt(m, v) { return v === 0 ? '0' : METRICS[m].fmt(v); }

  /* ── data ── */
  function windowStart(active, sessions) {
    var n = RANGES[_range], maxT = 0;
    active.forEach(function(m){ maxT = Math.max(maxT, sessions[m.id].turns.length); });
    return n ? Math.max(0, maxT - n) : 0;
  }

  function aggregate(m, s, start) {
    var w = s.turns.slice(start), a = { id: m.id, name: shortName(m.id), turns: w.length, tin: 0, tout: 0, cost: 0, co2: 0, water: 0, power: 0 };
    w.forEach(function(t) {
      a.tin += t.inputTokens||0; a.tout += t.outputTokens||0;
      a.cost += t.cost||0; a.co2 += t.co2||0; a.water += t.water||0; a.power += t.power||0;
    });
    a.tokens = a.tin + a.tout;
    return a;
  }

  function palette(rows) {
    var map = {}, bestId = null;
    if (rows.length > 1) {
      var min = Infinity, max = -Infinity;
      rows.forEach(function(r){ if (finite(r.cost)) { min = Math.min(min, r.cost); max = Math.max(max, r.cost); } });
      if (min < max) bestId = rows.filter(function(r){ return r.cost === min; })[0].id;
    }
    var hi = _focus && rows.some(function(r){ return r.id === _focus; }) ? _focus : bestId;
    var k = 0;
    rows.forEach(function(r) {
      if (r.id === hi) map[r.id] = { c: 'var(--data)', k: -1, dash: '' };
      else { map[r.id] = { c: CHARTS.color(k), k: k, dash: CHARTS.dash(k) }; k++; }
    });
    return map;
  }

  function isDim(id) { return !!_focus && _focus !== id; }

  /* ── time chart ── */
  function timeChartSVG(active, sessions, start, pal, W) {
    var met = METRICS[_metric];
    var H = 260, direct = W >= 680 && active.length <= 8;
    var pad = { t: 12, r: direct ? 116 : 16, b: 30, l: 90 };
    var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    var series = active.map(function(m) {
      return { id: m.id, label: m.id, points: sessions[m.id].turns.slice(start).map(met.pick) };
    });
    var maxT = 0, maxV = 0;
    series.forEach(function(s){ maxT = Math.max(maxT, s.points.length); s.points.forEach(function(v){ maxV = Math.max(maxV, v); }); });
    if (!maxT) return null;
    if (!maxV) maxV = 0.000001;
    var xFn = function(i){ return pad.l + (i/(maxT-1||1))*iw; };
    var yFn = function(v){ return pad.t + ih - (v/maxV)*ih; };

    var grid = '';
    for (var i = 0; i <= 4; i++) {
      var yy = pad.t + ih*(1 - i/4);
      grid += '<line x1="'+pad.l+'" y1="'+yy.toFixed(1)+'" x2="'+(W-pad.r)+'" y2="'+yy.toFixed(1)+'" class="ch-grid"/>';
      grid += '<text x="'+(pad.l-8)+'" y="'+(yy+4).toFixed(1)+'" text-anchor="end" class="ch-tick">'+esc(axisFmt(_metric, maxV*i/4))+'</text>';
    }
    var step = Math.max(1, Math.ceil(maxT / Math.max(1, Math.floor(iw/56))));
    for (var t = 0; t < maxT; t++) {
      if (t % step) continue;
      grid += '<text x="'+xFn(t).toFixed(1)+'" y="'+(pad.t+ih+20)+'" text-anchor="middle" class="ch-tick">T'+(start+t+1)+'</text>';
    }

    var lines = '', labels = [];
    series.forEach(function(s) {
      if (!s.points.length) return;
      var p = pal[s.id];
      var pts = s.points.map(function(v, j){ return [xFn(j), yFn(v)]; });
      var ok = pts.every(function(q){ return finite(q[0]) && finite(q[1]); });
      if (!ok) return;
      var d = pts.map(function(q, j){ return (j?'L':'M')+q[0].toFixed(1)+','+q[1].toFixed(1); }).join(' ');
      lines += '<g class="an-ser'+(isDim(s.id)?' is-dim':'')+'" style="--sc:'+p.c+'">'
        + '<path d="'+d+'" fill="none" class="ch-line"'+(p.dash?' stroke-dasharray="'+p.dash+'"':'')+'/>'
        + pts.map(function(q){ return '<circle cx="'+q[0].toFixed(1)+'" cy="'+q[1].toFixed(1)+'" r="3" class="ch-pt"/>'; }).join('')
        + '</g>';
      if (direct) labels.push({ y: pts[pts.length-1][1], x: pts[pts.length-1][0], text: shortName(s.label).length > 15 ? shortName(s.label).slice(0, 14) + '…' : shortName(s.label), hi: p.k === -1, dim: isDim(s.id) });
    });
    labels.sort(function(a, b){ return a.y - b.y; });
    labels.forEach(function(l, j){ if (j && l.y - labels[j-1].y < 14) l.y = labels[j-1].y + 14; });
    var lab = labels.map(function(l) {
      return '<text x="'+(l.x+10).toFixed(1)+'" y="'+(l.y+4).toFixed(1)+'" class="an-dlabel'+(l.hi?' is-hi':'')+(l.dim?' is-dim':'')+'">'+esc(l.text)+'</text>';
    }).join('');

    var svg = '<svg width="'+W+'" height="'+H+'" role="img" aria-label="'+esc(met.label+': '+active.length+' model'+(active.length===1?'':'s')+' over '+maxT+' turn'+(maxT===1?'':'s'))+'">'
      + grid + lines + lab + '</svg>';
    var xs = [], i2;
    for (i2 = 0; i2 < maxT; i2++) xs.push(xFn(i2));
    return { svg: svg, n: maxT, xs: xs, top: pad.t, bottom: pad.t + ih, series: series, xFn: xFn, yFn: yFn };
  }

  function bindTimeChart(host, chart, pal) {
    var met = METRICS[_metric];
    CHARTS.scrub(host, {
      n: chart.n, xs: chart.xs, top: chart.top, bottom: chart.bottom,
      label: met.label + ' chart. Use the left and right arrow keys to read each turn.',
      dots: function(i) {
        return chart.series.filter(function(s){ return i < s.points.length && !isDim(s.id); }).map(function(s) {
          return { x: chart.xFn(i), y: chart.yFn(s.points[i]), color: pal[s.id].c };
        });
      },
      html: function(i) {
        var rows = chart.series.filter(function(s){ return i < s.points.length && !isDim(s.id); }).map(function(s) {
          var v = s.points[i], delta = '';
          if (_prev && i > 0 && finite(s.points[i-1])) {
            var pv = s.points[i-1], d = v - pv;
            if (pv) {
              var pct = d / pv * 100;
              delta = '<span class="chart-tip-d '+(d>0?'up':d<0?'down':'')+'">'+(d>0?'+':d<0?'−':'')+Math.abs(pct).toFixed(0)+'% vs previous</span>';
            } else delta = '<span class="chart-tip-d">no previous cost</span>';
          }
          return '<div class="chart-tip-r"><i class="an-sw" style="--sc:'+pal[s.id].c+'"></i><span class="chart-tip-n">'+esc(shortName(s.label))+'</span><span class="chart-tip-v">'+esc(met.fmt(v))+'</span>'+delta+'</div>';
        }).join('');
        return '<div class="chart-tip-h">Turn '+(windowStartCache + i + 1)+'</div>'+rows;
      }
    });
  }
  var windowStartCache = 0;

  /* ── donut (maths unchanged; render is guarded against NaN paths) ── */
  function donutSVG(slices, title, total) {
    var W=120, H=120, CX=60, CY=60, R=58, ri=26;
    if (!slices || !slices.length || !total) {
      return '<div class="an-donut-empty">No data</div>';
    }
    var a=-Math.PI/2, paths='', labels='', broken=false;
    slices.forEach(function(s){
      var frac=s.v/total, ea=a+frac*2*Math.PI;
      if (frac < 0.001) { a=ea; return; }
      var large=frac>0.5?1:0;
      var x1=CX+R*Math.cos(a), y1=CY+R*Math.sin(a);
      var x2=CX+R*Math.cos(ea), y2=CY+R*Math.sin(ea);
      var xi1=CX+ri*Math.cos(a), yi1=CY+ri*Math.sin(a);
      var xi2=CX+ri*Math.cos(ea), yi2=CY+ri*Math.sin(ea);
      var d='M'+xi1.toFixed(1)+','+yi1.toFixed(1)+' L'+x1.toFixed(1)+','+y1.toFixed(1)+' A'+R+','+R+' 0 '+large+',1 '+x2.toFixed(1)+','+y2.toFixed(1)+' L'+xi2.toFixed(1)+','+yi2.toFixed(1)+' A'+ri+','+ri+' 0 '+large+',0 '+xi1.toFixed(1)+','+yi1.toFixed(1)+' Z';
      if (d.indexOf('NaN') !== -1) { broken = true; return; }
      paths+='<path d="'+d+'" class="an-slice'+(isDim(s.id)?' is-dim':'')+'" data-model="'+esc(s.id)+'" tabindex="0" role="button" aria-pressed="'+(_focus===s.id)+'" aria-label="'+esc(s.tip.replace(/\n/g, ', '))+'" data-tip="'+esc(s.tip)+'" style="--sc:'+s.color+'"/>';
      if (frac > 0.12) {
        var ma=a+frac*Math.PI;
        var lx=CX+(R+ri)/2*Math.cos(ma), ly=CY+(R+ri)/2*Math.sin(ma);
        labels+='<text x="'+lx.toFixed(1)+'" y="'+(ly+4).toFixed(1)+'" text-anchor="middle" class="an-dl '+(s.dark?'on-dark':'on-light')+'">'+(frac*100).toFixed(0)+'%</text>';
      }
      a=ea;
    });
    if (broken || !paths) return '<div class="an-donut-empty">Chart unavailable</div>';
    return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" role="group" aria-label="'+esc(title)+' share by model">'
      +paths+labels
      +'<text x="'+CX+'" y="'+(CY+4)+'" text-anchor="middle" class="an-dc">'+esc(total)+'</text>'
      +'</svg>';
  }

  /* ── share tables ── */
  function shareBlock(cfg, rows, pal) {
    var head = '<div class="an-block-head'+(cfg.donut?' has-donut':'')+'"><div><h3 class="an-title">'+cfg.title+'</h3><p class="an-sub">'+cfg.sub+'</p></div>';
    var thead = '<div class="an-thead"><span>Model</span><span>Share</span>'
      + '<button type="button" class="an-sort" data-sort aria-label="Sort by count, '+(_sortDir==='desc'?'highest first':'lowest first')+'"><span>Count</span><span class="ic an-sortic'+(_sortDir==='asc'?' is-asc':'')+'">'+icon('chevronDown')+'</span></button></div>';
    if (!rows.length) {
      return '<section class="an-block">'+head.replace(' has-donut', '')+'</div>'+thead+'<div class="an-empty">No turns in this range yet.</div></section>';
    }
    var total = 0, max = 0;
    rows.forEach(function(r){ var v = cfg.val(r); if (finite(v)) { total += v; max = Math.max(max, v); } });
    var sorted = rows.map(function(r, i){ return { r: r, v: cfg.val(r), i: i }; })
      .sort(function(a, b){ return (_sortDir==='desc' ? b.v - a.v : a.v - b.v) || a.i - b.i; });
    var body = sorted.map(function(o, idx) {
      var r = o.r, v = o.v, p = pal[r.id];
      var share = total ? v/total*100 : 0, w = max ? Math.max(0, v/max*100) : 0;
      var tip = r.name+'\nShare '+(total?share.toFixed(1)+'%':'—')+'\n'+cfg.fmt(v)+(cfg.extra?'\n'+cfg.extra(r):'');
      return '<button type="button" class="an-trow'+(isDim(r.id)?' is-dim':'')+'" data-model="'+esc(r.id)+'" aria-pressed="'+(_focus===r.id)+'" data-tip="'+esc(tip)+'" style="--w:'+(finite(w)?w.toFixed(1):0)+'%;--i:'+idx+'">'
        + '<span class="an-tbar" aria-hidden="true"></span>'
        + '<span class="an-tname"><i class="an-sw" style="--sc:'+p.c+'"></i><span class="an-tn">'+esc(r.name)+'</span></span>'
        + '<span class="an-tshare">'+(total?share.toFixed(1)+'%':'—')+'</span>'
        + '<span class="an-tcount">'+esc(cfg.fmt(v))+'</span></button>';
    }).join('');

    var donutHtml = '';
    if (cfg.donut) {
      var slices = rows.map(function(r){ var p = pal[r.id]; return { id: r.id, label: r.name, color: p.c, dark: p.k <= 1, v: cfg.val(r),
        tip: r.name+'\n'+(total?(cfg.val(r)/total*100).toFixed(1)+'%':'—')+' of '+cfg.title.toLowerCase() }; });
      donutHtml = '<div class="an-donut">' + donutSVG(slices, cfg.donutTitle, cfg.donutLabel(total)) + '</div>';
    }
    return '<section class="an-block">'+head+donutHtml+'</div>'+thead+'<div class="an-rows">'+body+'</div></section>';
  }

  /* ── KPI row ── */
  function kv(str) {
    var m = /^([^0-9<]*<?[0-9][0-9.,]*[KM]?)\s*(.*)$/.exec(str);
    if (!m) return '<span class="an-kv">'+esc(str)+'</span>';
    return '<span class="an-kv">'+esc(m[1])+'</span>'+(m[2]?'<span class="an-ku">'+esc(m[2])+'</span>':'');
  }

  function setKpi(id, v, fmt, hasData) {
    var el = document.getElementById(id); if (!el) return;
    cancelAnimationFrame(_kpiRaf[id] || 0);
    if (!hasData) { el.innerHTML = '<span class="an-kv">—</span>'; el.title = 'No data yet'; _kpiPrev[id] = 0; return; }
    var from = _kpiPrev[id] || 0;
    _kpiPrev[id] = v;
    el.title = fmt(v);
    if (reduced() || from === v || !finite(v) || !finite(from)) { el.innerHTML = kv(fmt(v)); return; }
    var t0 = performance.now(), D = 360;
    (function step(now) {
      var p = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - p, 3);
      el.innerHTML = kv(fmt(p >= 1 ? v : from + (v - from) * e));
      if (p < 1) _kpiRaf[id] = requestAnimationFrame(step);
    })(t0);
  }

  function renderKpis(rows) {
    var has = rows.length > 0;
    var sum = function(k){ return rows.reduce(function(a, r){ return a + (r[k]||0); }, 0); };
    var turns = rows.reduce(function(a, r){ return Math.max(a, r.turns); }, 0);
    setKpi('an-kpi-turns',  turns, function(v){ return String(Math.round(v)); }, true);
    setKpi('an-kpi-tokens', sum('tokens'), function(v){ return fmtTokens(v); }, true);
    setKpi('an-kpi-cost',   sum('cost'),  function(v){ return CALC.fmtCost(v); }, has);
    setKpi('an-kpi-co2',    sum('co2'),   function(v){ return CALC.fmtCO2(v); }, has);
    setKpi('an-kpi-water',  sum('water'), function(v){ return CALC.fmtWater(v); }, has);
    setKpi('an-kpi-power',  sum('power'), function(v){ return CALC.fmtPower(v); }, has);
  }

  function syncControls(hasData) {
    document.querySelectorAll('#an-range [data-range]').forEach(function(b) {
      b.setAttribute('aria-pressed', b.getAttribute('data-range') === _range ? 'true' : 'false');
    });
    var ex = document.getElementById('an-export');
    if (ex) { ex.setAttribute('aria-disabled', hasData ? 'false' : 'true'); ex.title = hasData ? 'Download the table data as CSV' : 'Run a prompt to enable export'; }
  }

  function skeleton() {
    return '<div class="an-root" aria-busy="true" aria-label="Loading analytics">'
      + '<div class="an-skel an-skel-chart"></div>'
      + '<div class="an-shares"><div class="an-skel an-skel-block"></div><div class="an-skel an-skel-block"></div><div class="an-skel an-skel-block"></div><div class="an-skel an-skel-block"></div></div>'
      + '</div>';
  }

  /* ── projection ── */
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

  function projectionHTML() {
    function slider(label, id, lbl, min, max, val, text) {
      return '<div class="an-slider-row"><label for="'+id+'">'+label+' <span id="'+lbl+'">'+text+'</span></label>'
        + '<input type="range" min="'+min+'" max="'+max+'" value="'+val+'" id="'+id+'" oninput="UI_ANALYTICS.updateProjection()"></div>';
    }
    return '<section class="an-section an-proj">'
      + '<div class="an-block-head"><div><h3 class="an-title">Scale projections</h3><p class="an-sub">What this session costs and emits per month at a given volume. Move the sliders to see it compound.</p></div></div>'
      + '<div class="an-sliders">'
        + slider('Sessions per day', 'an-s-per-day', 'an-s-per-day-lbl', 1, 10000, _proj.spd, String(_proj.spd))
        + slider('Days per month', 'an-days', 'an-days-lbl', 1, 31, _proj.days, String(_proj.days))
        + slider('Growth factor', 'an-growth', 'an-growth-lbl', 0, 500, _proj.growth, '+'+_proj.growth+'%')
      + '</div>'
      + '<div id="an-proj-results" class="an-proj-results"></div>'
    + '</section>';
  }

  function updateProjection() {
    var sp = document.getElementById('an-s-per-day'), dy = document.getElementById('an-days'), gr = document.getElementById('an-growth');
    if (!sp || !dy || !gr) return;
    var spd = parseInt(sp.value)||100, days = parseInt(dy.value)||22, growth = parseInt(gr.value)||0;
    _proj = { spd: spd, days: days, growth: growth };
    var lbl1 = document.getElementById('an-s-per-day-lbl'), lbl2 = document.getElementById('an-days-lbl'), lbl3 = document.getElementById('an-growth-lbl');
    if (lbl1) lbl1.textContent = spd >= 1000 ? (spd/1000).toFixed(1)+'K' : String(spd);
    if (lbl2) lbl2.textContent = String(days);
    if (lbl3) lbl3.textContent = '+'+growth+'%';

    var res = calcProjection(spd, days, growth);
    var el = document.getElementById('an-proj-results');
    if (!el) return;
    if (!res.length) { el.innerHTML = '<div class="an-empty">No session data yet. Run a prompt to project it.</div>'; return; }

    var tot = { cost:0, co2:0, water:0, power:0, tokens:0 };
    res.forEach(function(r){ tot.cost+=r.cost; tot.co2+=r.co2; tot.water+=r.water; tot.power+=r.power; tot.tokens+=r.tokens; });

    function item(val, label, equiv) {
      return '<div class="an-kpi"><div class="an-kpi-lbl">'+label+' / month</div><div class="an-kpi-val an-kpi-sm">'+kv(val)+'</div><div class="an-kpi-eq">'+(equiv ? esc(equiv) : '&nbsp;')+'</div></div>';
    }
    var co2kg = tot.co2 / 1000;
    var waterL = tot.water / 1000;
    var html = '<div class="an-kpis an-kpis-proj">'
      + item(CALC.fmtCost(tot.cost), 'Cost', spd+' sessions/day')
      + item(tot.tokens>=1e6?(tot.tokens/1e6).toFixed(2)+'M': tot.tokens>=1000?(tot.tokens/1000).toFixed(1)+'K':tot.tokens.toFixed(0), 'Tokens', '')
      + item(co2kg>=1?co2kg.toFixed(2)+' kg': tot.co2.toFixed(2)+' g', 'CO₂', co2kg>0.001?(co2kg/0.404).toFixed(1)+' km driven':'')
      + item(waterL>=1?waterL.toFixed(2)+' L': tot.water.toFixed(1)+' mL', 'Water', waterL>0.25?(waterL/0.25).toFixed(1)+' glasses':'')
      + item(tot.power>=1000?(tot.power/1000).toFixed(3)+' kWh': tot.power.toFixed(4)+' Wh', 'Power', tot.power>=10?((tot.power/10.8)*100).toFixed(2)+'% of avg US daily':'')
      + '</div>';

    if (res.length > 1) {
      html += '<div><div class="an-thead an-thead-proj"><span>Model</span><span>Cost</span><span>CO₂</span><span>Water</span></div><div class="an-rows">'
        + res.map(function(r) {
            return '<div class="an-trow an-trow-static an-trow-proj"><span class="an-tname"><span class="an-tn">'+esc(r.name)+'</span></span>'
              + '<span class="an-tcount">'+esc(CALC.fmtCost(r.cost))+'</span>'
              + '<span class="an-tcount">'+(r.co2>=1?r.co2.toFixed(3)+'g':(r.co2*1000).toFixed(2)+'mg')+'</span>'
              + '<span class="an-tcount">'+r.water.toFixed(2)+' mL</span></div>';
          }).join('')
        + '</div></div>';
    }
    el.innerHTML = html;
  }

  /* ── main render ── */
  function render() {
    wire();
    var models = STATE.getActiveModels();
    var sessions = {};
    models.forEach(function(m){ sessions[m.id] = STATE.getSession(m.id); });
    var active = models.filter(function(m){ var s=sessions[m.id]; return s && s.turns.length>0; });
    var body = document.getElementById('an-body');
    if (!body) return;

    if (_focus && !active.some(function(m){ return m.id === _focus; })) _focus = null;

    var start = windowStart(active, sessions);
    windowStartCache = start;
    var rows = active.map(function(m){ return aggregate(m, sessions[m.id], start); });
    var pal = palette(rows);

    renderKpis(rows);
    syncControls(active.length > 0);

    if (!STATE.getModels().length) { body.innerHTML = skeleton(); return; }

    var met = METRICS[_metric];
    var W = Math.floor(body.clientWidth) || 640;
    _lastW = W;
    var chart = active.length ? timeChartSVG(active, sessions, start, pal, W) : null;

    var tabs = '<div class="an-tabs" role="tablist" aria-label="Chart metric">'
      + Object.keys(METRICS).map(function(k) {
          return '<button type="button" role="tab" class="an-tab" data-metric="'+k+'" aria-selected="'+(k===_metric)+'" tabindex="'+(k===_metric?0:-1)+'">'+METRICS[k].label+'</button>';
        }).join('')
      + '</div>';
    var legend = rows.length ? '<div class="an-legend" role="group" aria-label="Models. Select one to isolate it.">'
      + rows.map(function(r) {
          return '<button type="button" class="an-leg-item'+(isDim(r.id)?' is-dim':'')+'" data-model="'+esc(r.id)+'" aria-pressed="'+(_focus===r.id)+'"><i class="an-sw" style="--sc:'+pal[r.id].c+'"></i>'+esc(r.name)+'</button>';
        }).join('')
      + '</div>' : '';

    var timeHTML = '<section class="an-section an-time">'
      + '<div class="an-block-head an-time-head"><div><h3 class="an-title" id="an-time-title">'+met.label+'</h3><p class="an-sub">'+met.sub+'</p></div>'
      + '<div class="an-time-tools">'+tabs+'<button type="button" class="an-link" data-prev-toggle aria-pressed="'+_prev+'">Compare to previous turn</button></div></div>'
      + legend
      + (chart ? '<div class="an-chart" id="an-chart">'+chart.svg+'</div>'
               : '<div class="an-empty an-empty-chart">No turns yet. Run a prompt in Compare and every turn plots here.</div>')
      + '</section>';

    var cfgs = [
      { title: 'Tokens by model', sub: 'Input plus output tokens each model used.', val: function(r){ return r.tokens; }, fmt: fmtTokens,
        extra: function(r){ return 'In '+fmtTokens(r.tin)+' · Out '+fmtTokens(r.tout); },
        donut: true, donutTitle: 'Token', donutLabel: function(){ return fmtTokens(rows.reduce(function(a, r){ return a + r.tokens; }, 0)); } },
      { title: 'CO₂ by model', sub: 'Carbon each model emitted over the selected turns.', val: function(r){ return r.co2; }, fmt: fmtCo2Short,
        donut: true, donutTitle: 'CO₂', donutLabel: function(t){ return t < 0.01 ? (t*1000).toFixed(2)+'mg' : t.toFixed(3)+'g'; } },
      { title: 'Cost by model', sub: 'What each model billed over the selected turns.', val: function(r){ return r.cost; }, fmt: function(v){ return CALC.fmtCost(v); } },
      { title: 'Water by model', sub: 'Data centre water each model used.', val: function(r){ return r.water; }, fmt: function(v){ return CALC.fmtWater(v); } }
    ];
    var shares = '<div class="an-shares">' + cfgs.map(function(c){ return shareBlock(c, rows, pal); }).join('') + '</div>';

    body.innerHTML = '<div class="an-root'+(!_entered && active.length ? ' an-enter' : '')+'">' + timeHTML + shares + (active.length ? projectionHTML() : '') + '</div>';
    if (active.length) _entered = true;

    if (chart) bindTimeChart(document.getElementById('an-chart'), chart, pal);
    if (active.length) updateProjection();
  }

  /* ── interactions ── */
  function setFocus(id) {
    _focus = _focus === id ? null : id;
    var y = window.scrollY;
    render();
    window.scrollTo(window.scrollX, y);
    var sel = _focus ? '[data-model="'+(window.CSS && CSS.escape ? CSS.escape(_focus) : _focus)+'"]' : null;
    var back = document.querySelector('#an-body ' + (sel || '.an-leg-item'));
    if (back) back.focus({ preventScroll: true });
  }

  function setMetric(k) {
    if (!METRICS[k] || k === _metric) return;
    _metric = k; lsSet(LS_METRIC, k);
    render();
    var t = document.querySelector('#an-body .an-tab[data-metric="'+k+'"]'); if (t) t.focus({ preventScroll: true });
  }

  function setRange(r) {
    if (!(r in RANGES)) return;
    _range = r; lsSet(LS_RANGE, r);
    render();
  }

  function togglePrev() {
    _prev = !_prev; lsSet(LS_PREV, _prev ? '1' : '0');
    var b = document.querySelector('#an-body [data-prev-toggle]'); if (b) b.setAttribute('aria-pressed', String(_prev));
    var host = document.getElementById('an-chart');
    if (host && host.getAttribute('data-index') != null) { host.blur(); host.focus({ preventScroll: true }); }
  }

  function exportCSV() {
    var models = STATE.getActiveModels();
    var sessions = {};
    models.forEach(function(m){ sessions[m.id] = STATE.getSession(m.id); });
    var active = models.filter(function(m){ var s=sessions[m.id]; return s && s.turns.length>0; });
    if (!active.length) { TOAST.info('Run a prompt first, then export.'); return; }
    var start = windowStart(active, sessions);
    var rows = active.map(function(m){ return aggregate(m, sessions[m.id], start); });
    var tot = function(k){ return rows.reduce(function(a, r){ return a + (r[k]||0); }, 0); };
    var pct = function(v, t){ return t ? (v/t*100).toFixed(2) : ''; };
    var tt = tot('tokens'), tc = tot('cost'), tco = tot('co2'), tw = tot('water');
    var head = ['model','turns','input_tokens','output_tokens','total_tokens','token_share_pct','cost_usd','cost_share_pct','co2_g','co2_share_pct','water_l','water_share_pct','power_wh'];
    var lines = [head.join(',')].concat(rows.map(function(r) {
      return ['"'+r.id.replace(/"/g, '""')+'"', r.turns, r.tin, r.tout, r.tokens, pct(r.tokens, tt), r.cost, pct(r.cost, tc), r.co2, pct(r.co2, tco), r.water, pct(r.water, tw), r.power].join(',');
    }));
    var blob = new Blob([lines.join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'tokenlens-analytics-' + (_range === 'all' ? 'all-turns' : 'last-' + _range) + '.csv';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
    TOAST.success('Exported ' + rows.length + ' model' + (rows.length === 1 ? '' : 's') + ' to CSV.');
  }

  function wire() {
    if (_wired) return;
    var panel = document.getElementById('analytics-panel');
    if (!panel) return;
    _wired = true;
    panel.addEventListener('click', function(e) {
      var t = e.target.closest ? e.target : null; if (!t) return;
      var m = t.closest('[data-model]');
      if (m && panel.contains(m) && m.getAttribute('data-model') && !m.classList.contains('an-trow-static')) { setFocus(m.getAttribute('data-model')); return; }
      var met = t.closest('[data-metric]'); if (met) { setMetric(met.getAttribute('data-metric')); return; }
      if (t.closest('[data-prev-toggle]')) { togglePrev(); return; }
      if (t.closest('[data-sort]')) { _sortDir = _sortDir === 'desc' ? 'asc' : 'desc'; render(); var sb = document.querySelector('#an-body [data-sort]'); if (sb) sb.focus({ preventScroll: true }); }
    });
    panel.addEventListener('keydown', function(e) {
      var t = e.target;
      if (t.getAttribute && t.getAttribute('role') === 'button' && t.tagName !== 'BUTTON' && (e.key === 'Enter' || e.key === ' ') && t.getAttribute('data-model')) {
        e.preventDefault(); setFocus(t.getAttribute('data-model')); return;
      }
      if (t.getAttribute && t.getAttribute('role') === 'tab' && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        var keys = Object.keys(METRICS), i = keys.indexOf(t.getAttribute('data-metric'));
        i = (i + (e.key === 'ArrowRight' ? 1 : keys.length - 1)) % keys.length;
        e.preventDefault(); setMetric(keys[i]);
      }
    });
    if (window.ResizeObserver) {
      new ResizeObserver(function() {
        var body = document.getElementById('an-body');
        if (!body || !panel.classList.contains('active')) return;
        if (Math.abs(Math.floor(body.clientWidth) - _lastW) < 6) return;
        cancelAnimationFrame(_rafResize);
        _rafResize = requestAnimationFrame(render);
      }).observe(panel);
    }
  }

  return { render: render, updateProjection: updateProjection, setRange: setRange, exportCSV: exportCSV };
})();
