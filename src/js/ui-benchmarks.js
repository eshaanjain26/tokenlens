/* ══════════════════════════════════════════════════════════
   MODULE 8 — UI_BENCHMARKS
   Benchmarks tab — training, inference, calculators, scorecard, citations
   ══════════════════════════════════════════════════════════ */
window.UI_BENCHMARKS = (function() {

  var LS = 'tl_ui_bench_';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function load(k, d) {
    try { var v = localStorage.getItem(LS + k); return v ? JSON.parse(v) : d; } catch (e) { return d; }
  }
  function save(k, v) {
    try { localStorage.setItem(LS + k, JSON.stringify(v)); } catch (e) {}
  }
  function reduced() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  function icon(name) { return window.TL_ICON ? window.TL_ICON(name) : ''; }
  function plain(html) {
    var t = document.createElement('div');
    t.innerHTML = html;
    return t.textContent;
  }

  function copyText(text) {
    function fallback() {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', '');
      ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      return ok;
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).then(function() { return true; }, function() { return fallback(); });
    }
    return Promise.resolve(fallback());
  }

  function flashCopied(btn, ok, doneLabel) {
    var label = btn.querySelector('.bn-copy-label');
    var prev = btn.getAttribute('data-label') || (label ? label.textContent : '');
    btn.setAttribute('data-label', prev);
    btn.classList.toggle('is-done', ok);
    if (label) label.textContent = ok ? (doneLabel || 'Copied') : 'Copy failed';
    var ic = btn.querySelector('.ic');
    if (ic) ic.innerHTML = icon(ok ? 'check' : 'copy');
    clearTimeout(btn._t);
    btn._t = setTimeout(function() {
      btn.classList.remove('is-done');
      if (label) label.textContent = prev;
      if (ic) ic.innerHTML = icon('copy');
    }, 1600);
  }

  /* ── count-up for result values ── */
  var tweens = {};
  function setNum(id, text) {
    var el = document.getElementById(id);
    if (!el) return;
    var m = String(text).match(/-?\d+(?:\.\d+)?/);
    if (!m || reduced()) { el.textContent = text; el.setAttribute('data-v', m ? m[0] : ''); return; }
    var to = parseFloat(m[0]);
    var from = parseFloat(el.getAttribute('data-v'));
    if (isNaN(from)) from = 0;
    var dec = (m[0].split('.')[1] || '').length;
    var pre = text.slice(0, m.index), post = text.slice(m.index + m[0].length);
    var t0 = performance.now(), dur = 320;
    el.setAttribute('data-v', m[0]);
    if (tweens[id]) cancelAnimationFrame(tweens[id]);
    function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 3);
      el.textContent = p >= 1 ? text : pre + (from + (to - from) * e).toFixed(dec) + post;
      if (p < 1) tweens[id] = requestAnimationFrame(step);
    }
    tweens[id] = requestAnimationFrame(step);
  }

  /* ══ Chart: one question per chart, hairline grid, visible y-scale, hover crosshair ══ */
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var p = Math.pow(10, Math.floor(Math.log10(v)));
    var f = v / p;
    var n = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
    return n * p;
  }

  function drawChart(wrap, spec) {
    if (!wrap) return;
    if (wrap._ro) { wrap._ro.disconnect(); wrap._ro = null; }
    var N = spec.xLabels.length;
    var bars = spec.type === 'bar';
    var lastW = 0, active = -1;

    wrap.classList.add('lc');
    wrap.setAttribute('tabindex', '0');
    wrap.setAttribute('role', 'group');
    wrap.setAttribute('aria-label', spec.label + '. Use the left and right arrow keys to read each point.');

    function paint() {
      var W = Math.max(280, Math.floor(wrap.clientWidth || 640));
      lastW = W;
      var H = W < 480 ? 210 : 250;
      var allVals = [];
      spec.series.forEach(function(s) { allVals = allVals.concat(s.values); });
      var top = niceMax(Math.max.apply(null, allVals.concat([0])));
      var tickTxt = [0, 1, 2, 3, 4].map(function(g) { return spec.fmtY(top * g / 4); });
      var yW = Math.max.apply(null, tickTxt.map(function(t) { return t.length; })) * 7 + 16;
      var labelW = spec.endLabels ? Math.min(124, Math.round(W * 0.28)) : 0;
      var pad = { t: 22, r: spec.endLabels ? labelW + 10 : 12, b: 36, l: yW };
      var iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
      var band = iw / N;
      function fx(i) { return bars ? pad.l + (i + 0.5) * band : pad.l + (N === 1 ? iw / 2 : i * iw / (N - 1)); }
      function fy(v) { return pad.t + ih - (v / top) * ih; }

      var s = '';
      for (var g = 0; g <= 4; g++) {
        var yy = pad.t + ih * (1 - g / 4);
        s += '<line class="lc-grid" x1="' + pad.l + '" x2="' + (W - pad.r) + '" y1="' + yy.toFixed(1) + '" y2="' + yy.toFixed(1) + '"/>';
        s += '<text class="lc-tick" x="' + (pad.l - 8) + '" y="' + (yy + 4).toFixed(1) + '" text-anchor="end">' + esc(tickTxt[g]) + '</text>';
      }
      var step = Math.max(1, Math.ceil(N / Math.max(1, Math.floor(iw / 44))));
      for (var i = 0; i < N; i++) {
        if (i % step === 0) {
          s += '<text class="lc-tick" x="' + fx(i).toFixed(1) + '" y="' + (H - pad.b + 16) + '" text-anchor="middle">' + esc(spec.xLabels[i]) + '</text>';
        }
      }
      if (spec.xTitle) s += '<text class="lc-tick lc-axis" x="' + (pad.l + iw / 2).toFixed(1) + '" y="' + (H - 4) + '" text-anchor="middle">' + esc(spec.xTitle) + '</text>';

      var ends = [];
      spec.series.forEach(function(sr, si) {
        if (bars) {
          sr.values.forEach(function(v, i) {
            var bw = Math.min(56, band * 0.62);
            var h = Math.max(1, ih - (fy(v) - pad.t));
            s += '<rect class="lc-bar' + (i === spec.hi ? ' lc-bar--hi' : '') + '" data-i="' + i + '" x="' + (fx(i) - bw / 2).toFixed(1) + '" y="' + (pad.t + ih - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"/>';
            if (spec.valueLabels && spec.valueLabels.indexOf(i) > -1) {
              s += '<text class="lc-vlabel' + (i === spec.hi ? ' lc-vlabel--hi' : '') + '" x="' + fx(i).toFixed(1) + '" y="' + (pad.t + ih - h - 6).toFixed(1) + '" text-anchor="middle">' + esc(spec.fmtY(v)) + '</text>';
            }
          });
        } else {
          var d = sr.values.map(function(v, i) { return (i ? 'L' : 'M') + fx(i).toFixed(1) + ',' + fy(v).toFixed(1); }).join(' ');
          s += '<path class="lc-line lc-line--' + sr.cls + (sr.dash ? ' lc-line--dash' : '') + '" d="' + d + '"/>';
          var li = sr.values.length - 1;
          s += '<circle class="lc-dot lc-dot--' + sr.cls + '" cx="' + fx(li).toFixed(1) + '" cy="' + fy(sr.values[li]).toFixed(1) + '" r="3.5"/>';
          ends.push({ name: sr.name, cls: sr.cls, y: fy(sr.values[li]) });
        }
      });
      if (spec.endLabels) {
        ends.sort(function(a, b) { return a.y - b.y; });
        for (var e = 1; e < ends.length; e++) if (ends[e].y - ends[e - 1].y < 14) ends[e].y = ends[e - 1].y + 14;
        var maxCh = Math.max(4, Math.floor(labelW / 6.4));
        ends.forEach(function(en) {
          var nm = en.name.length > maxCh ? en.name.slice(0, maxCh - 1) + '…' : en.name;
          s += '<text class="lc-end lc-end--' + en.cls + '" x="' + (W - pad.r + 8) + '" y="' + (en.y + 4).toFixed(1) + '">' + esc(nm) + '</text>';
        });
      }
      s += '<g class="lc-cross" hidden><line class="lc-cross-line" y1="' + pad.t + '" y2="' + (pad.t + ih) + '"/>';
      if (!bars) spec.series.forEach(function(sr) { s += '<circle class="lc-hdot lc-hdot--' + sr.cls + '" r="4.5"/>'; });
      s += '</g><rect class="lc-hit" x="' + pad.l + '" y="' + pad.t + '" width="' + iw + '" height="' + ih + '"/>';

      wrap.innerHTML = '<svg class="lc-svg" width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true">' + s + '</svg>'
        + '<div class="lc-tip" hidden></div><div class="sr-only" aria-live="polite"></div>';

      var svg = wrap.querySelector('svg'), tip = wrap.querySelector('.lc-tip'),
          cross = wrap.querySelector('.lc-cross'), live = wrap.querySelector('[aria-live]');

      function show(i, speak) {
        i = Math.max(0, Math.min(N - 1, i));
        active = i;
        var t = spec.tip(i), cx = fx(i);
        cross.removeAttribute('hidden');
        var line = cross.querySelector('line');
        line.setAttribute('x1', cx.toFixed(1)); line.setAttribute('x2', cx.toFixed(1));
        var dots = cross.querySelectorAll('circle');
        spec.series.forEach(function(sr, si) {
          if (dots[si]) { dots[si].setAttribute('cx', cx.toFixed(1)); dots[si].setAttribute('cy', fy(sr.values[i]).toFixed(1)); }
        });
        wrap.querySelectorAll('.lc-bar').forEach(function(b) { b.classList.toggle('is-on', +b.getAttribute('data-i') === i); });
        tip.innerHTML = '<div class="lc-tip-t">' + esc(t.title) + '</div>' + t.rows.map(function(r) {
          return '<div class="lc-tip-r">' + (r.cls ? '<span class="lc-sw lc-sw--' + r.cls + '"></span>' : '') + '<span>' + esc(r.label) + '</span><span class="lc-tip-v">' + esc(r.value) + '</span></div>';
        }).join('');
        tip.hidden = false;
        var tw = tip.offsetWidth;
        var left = cx + 14;
        if (left + tw > W - 4) left = cx - 14 - tw;
        tip.style.left = Math.max(4, left) + 'px';
        tip.style.top = (pad.t + 4) + 'px';
        if (speak) live.textContent = t.title + ', ' + t.rows.map(function(r) { return r.label + ' ' + r.value; }).join(', ');
      }
      function hide() {
        active = -1;
        cross.setAttribute('hidden', ''); tip.hidden = true;
        wrap.querySelectorAll('.lc-bar.is-on').forEach(function(b) { b.classList.remove('is-on'); });
      }
      wrap._show = show; wrap._hide = hide;

      function idxAt(e) {
        var r = svg.getBoundingClientRect();
        var x = e.clientX - r.left - pad.l;
        return bars ? Math.floor(x / band) : Math.round(x / (N === 1 ? 1 : iw / (N - 1)));
      }
      svg.addEventListener('pointermove', function(e) { show(idxAt(e), false); });
      svg.addEventListener('pointerdown', function(e) { show(idxAt(e), false); });
      svg.addEventListener('pointerleave', function() { if (document.activeElement !== wrap) hide(); });
      if (active > -1) show(active, false);
    }

    if (!wrap._kbd) {
      wrap._kbd = true;
      wrap.addEventListener('keydown', function(e) {
        if (!wrap._show) return;
        var cur = active < 0 ? (wrap._lastIdx == null ? N - 1 : wrap._lastIdx) : active;
        var nxt = null;
        if (e.key === 'ArrowRight') nxt = cur + (active < 0 ? 0 : 1);
        else if (e.key === 'ArrowLeft') nxt = cur - (active < 0 ? 0 : 1);
        else if (e.key === 'Home') nxt = 0;
        else if (e.key === 'End') nxt = N - 1;
        else if (e.key === 'Escape') { wrap._hide(); return; }
        if (nxt == null) return;
        e.preventDefault();
        nxt = Math.max(0, Math.min(N - 1, nxt));
        wrap._lastIdx = nxt;
        wrap._show(nxt, true);
      });
      wrap.addEventListener('focus', function() {
        if (wrap.matches(':focus-visible') && wrap._show) wrap._show(wrap._lastIdx == null ? N - 1 : wrap._lastIdx, true);
      });
      wrap.addEventListener('blur', function() { if (wrap._hide) wrap._hide(); });
    }
    wrap._lastIdx = null;

    paint();
    if (window.ResizeObserver) {
      wrap._ro = new ResizeObserver(function() {
        var w = Math.floor(wrap.clientWidth);
        if (w && w !== lastW) paint();
      });
      wrap._ro.observe(wrap);
    }
  }

  /* ══ Ledger table: sortable, filterable, selectable, sticky header ══ */
  function ledger(cfg) {
    var root = document.getElementById(cfg.id);
    if (!root) return;
    var saved = cfg.persist ? load(cfg.id, {}) : {};
    var rows = cfg.rows;
    var state = { sort: saved.sort || null, dir: saved.dir || 'desc', chip: saved.chip || 'all', q: '', sel: [], cmp: false };
    if (!cfg.cols.some(function(c) { return c.key === state.sort; })) state.sort = null;
    if (!(cfg.chips || []).some(function(c) { return c.key === state.chip; })) state.chip = 'all';

    var maxes = {};
    cfg.cols.forEach(function(c) {
      if (c.bar) maxes[c.key] = c.barMax || Math.max.apply(null, rows.map(function(r) { return +c.val(r) || 0; }).concat([0])) || 1;
    });
    var bestOf = {};
    cfg.cols.forEach(function(c) {
      if (c.best) bestOf[c.key] = Math.max.apply(null, rows.map(function(r) { return +c.val(r) || 0; }));
    });

    var hasTools = !!((cfg.chips && cfg.chips.length) || cfg.search || cfg.selectable);
    root.classList.add('lt');
    root.innerHTML =
      (hasTools ? '<div class="lt-tools">'
        + (cfg.chips && cfg.chips.length ? '<div class="lt-chips" role="group" aria-label="' + esc(cfg.chipLabel || 'Filter') + '">'
            + cfg.chips.map(function(c) { return '<button type="button" class="lt-chip" data-chip="' + c.key + '" aria-pressed="' + (c.key === state.chip) + '">' + esc(c.label) + '</button>'; }).join('') + '</div>' : '')
        + '<span class="lt-grow"></span>'
        + (cfg.search ? '<label class="lt-search"><span class="sr-only">Search ' + esc(cfg.name) + '</span><span class="ic">' + icon('search') + '</span><input type="search" placeholder="Search" autocomplete="off" spellcheck="false"></label>' : '')
        + (cfg.selectable ? '<button type="button" class="lt-cmp-btn" disabled aria-expanded="false">Compare selected</button>' : '')
        + '</div>' : '')
      + '<div class="lt-scroll" tabindex="0" role="region" aria-label="' + esc(cfg.name) + ' table">'
        + '<table class="bench-table lt-table"><thead><tr>'
        + cfg.cols.map(function(c) {
            return '<th scope="col" data-key="' + c.key + '"' + (c.num ? ' class="is-num"' : '') + ' aria-sort="none"><button type="button" class="lt-sort">' + esc(c.label) + '<span class="lt-caret">' + icon('chevronDown') + '</span></button></th>';
          }).join('')
        + '</tr></thead><tbody></tbody></table>'
        + '<div class="lt-empty" hidden>No rows match this filter.</div>'
      + '</div>'
      + '<p class="lt-hint"><span class="ic">' + icon('chevronRight') + '</span>Scroll sideways for all columns</p>'
      + '<p class="lt-count" aria-live="polite"></p>'
      + (cfg.selectable ? '<div class="lt-compare" hidden></div>' : '');

    var tbody = root.querySelector('tbody'), scroller = root.querySelector('.lt-scroll'),
        empty = root.querySelector('.lt-empty'), count = root.querySelector('.lt-count'),
        cmpBtn = root.querySelector('.lt-cmp-btn'), cmpBox = root.querySelector('.lt-compare');

    function cmpVal(a, b, c, dir) {
      var x = c.val(a), y = c.val(b);
      var nx = x == null || x === '', ny = y == null || y === '';
      if (nx || ny) return nx && ny ? 0 : nx ? 1 : -1;
      var r = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y));
      return dir === 'asc' ? r : -r;
    }

    function visible() {
      var chip = (cfg.chips || []).filter(function(c) { return c.key === state.chip; })[0];
      var q = state.q.trim().toLowerCase();
      var out = rows.filter(function(r) {
        if (chip && chip.test && !chip.test(r)) return false;
        if (q && cfg.search(r).toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
      if (state.sort) {
        var col = cfg.cols.filter(function(c) { return c.key === state.sort; })[0];
        out = out.slice().sort(function(a, b) { return cmpVal(a, b, col, state.dir); });
      }
      return out;
    }

    function cell(c, r, first) {
      var inner = c.html ? c.html(r) : esc(c.text(r));
      if (c.bar) {
        var w = Math.max(0, Math.min(100, (+c.val(r) || 0) / maxes[c.key] * 100));
        var best = c.best && (+c.val(r) || 0) === bestOf[c.key] && bestOf[c.key] > 0;
        inner = '<span class="lt-fill' + (best ? ' is-best' : '') + '" style="--w:' + w.toFixed(1) + '%"></span><span class="lt-val">' + inner + '</span>';
      }
      if (first && cfg.selectable) {
        var on = state.sel.indexOf(r._i) > -1;
        inner = '<label class="lt-pick"><input type="checkbox" data-i="' + r._i + '"' + (on ? ' checked' : '') + ' aria-label="Select ' + esc(c.text(r)) + ' to compare"><span class="lt-name">' + inner + '</span></label>';
      }
      return '<td' + (c.num ? ' class="is-num' + (c.bar ? ' has-fill' : '') + '"' : c.bar ? ' class="has-fill"' : '') + (first ? ' data-first="1"' : '') + '>' + inner + '</td>';
    }

    function renderBody() {
      var vis = visible();
      tbody.innerHTML = vis.map(function(r) {
        return '<tr' + (state.sel.indexOf(r._i) > -1 ? ' class="is-sel"' : '') + '>' + cfg.cols.map(function(c, ci) { return cell(c, r, ci === 0); }).join('') + '</tr>';
      }).join('');
      empty.hidden = vis.length > 0;
      count.textContent = vis.length === rows.length ? rows.length + ' rows' : vis.length + ' of ' + rows.length + ' rows';
      root.querySelectorAll('th[data-key]').forEach(function(th) {
        th.setAttribute('aria-sort', th.getAttribute('data-key') === state.sort ? (state.dir === 'asc' ? 'ascending' : 'descending') : 'none');
      });
      edge();
    }

    function renderCompare() {
      if (!cmpBox) return;
      var n = state.sel.length;
      cmpBtn.disabled = n < 2;
      cmpBtn.textContent = n ? 'Compare selected (' + n + ')' : 'Compare selected';
      if (n < 2) state.cmp = false;
      cmpBtn.setAttribute('aria-expanded', state.cmp);
      cmpBox.hidden = !state.cmp;
      if (!state.cmp) return;
      var picked = state.sel.map(function(i) { return rows[i]; });
      var numeric = cfg.cols.filter(function(c) { return c.num; });
      var html = '<div class="lt-cmp-head"><h3>Side by side</h3><span>Lowest value in each row is highlighted. The multiple is against that lowest value.</span>'
        + '<button type="button" class="lt-cmp-clear">Clear selection</button></div>'
        + '<div class="lt-cmp-scroll"><table class="bench-table lt-table lt-cmp-table"><thead><tr><th scope="col"></th>'
        + picked.map(function(r) { return '<th scope="col" class="is-num">' + esc(cfg.cols[0].text(r)) + '</th>'; }).join('')
        + '</tr></thead><tbody>';
      numeric.forEach(function(c) {
        var vals = picked.map(function(r) { return c.val(r); });
        var lo = Math.min.apply(null, vals.filter(function(v) { return v != null && v > 0; }));
        html += '<tr><th scope="row">' + esc(c.label) + '</th>' + picked.map(function(r, i) {
          var v = vals[i];
          if (v == null) return '<td class="is-num">&mdash;</td>';
          var isLo = isFinite(lo) && v === lo;
          var mult = isFinite(lo) && lo > 0 && v > 0 ? (v / lo >= 100 ? Math.round(v / lo) : (v / lo).toFixed(1)) + '×' : '';
          return '<td class="is-num' + (isLo ? ' is-lo' : '') + '">' + esc(c.text(r)) + (mult ? '<span class="lt-mult">' + mult + '</span>' : '') + '</td>';
        }).join('') + '</tr>';
      });
      html += '</tbody></table></div>';
      cmpBox.innerHTML = html;
    }

    function edge() {
      var scrollable = scroller.scrollWidth > scroller.clientWidth + 2;
      var atEnd = scroller.scrollLeft + scroller.clientWidth >= scroller.scrollWidth - 2;
      root.classList.toggle('is-scrollable', scrollable);
      root.classList.toggle('is-end', atEnd);
      root.classList.toggle('is-scrolled', scroller.scrollLeft > 2);
    }

    function persist() {
      if (cfg.persist) save(cfg.id, { sort: state.sort, dir: state.dir, chip: state.chip });
    }

    root.addEventListener('click', function(e) {
      var sortBtn = e.target.closest('.lt-sort');
      if (sortBtn) {
        var key = sortBtn.parentNode.getAttribute('data-key');
        var col = cfg.cols.filter(function(c) { return c.key === key; })[0];
        var first = col.num ? 'desc' : 'asc', second = first === 'desc' ? 'asc' : 'desc';
        if (state.sort !== key) { state.sort = key; state.dir = first; }
        else if (state.dir === first) state.dir = second;
        else { state.sort = null; }
        persist(); renderBody(); return;
      }
      var chip = e.target.closest('.lt-chip');
      if (chip) {
        state.chip = chip.getAttribute('data-chip');
        root.querySelectorAll('.lt-chip').forEach(function(b) { b.setAttribute('aria-pressed', b === chip); });
        persist(); renderBody(); return;
      }
      if (e.target.closest('.lt-cmp-btn')) {
        state.cmp = !state.cmp; renderCompare();
        if (state.cmp) cmpBox.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
        return;
      }
      if (e.target.closest('.lt-cmp-clear')) {
        state.sel = []; state.cmp = false; renderBody(); renderCompare(); return;
      }
    });
    root.addEventListener('change', function(e) {
      var cb = e.target.closest('input[type=checkbox][data-i]');
      if (!cb) return;
      var i = +cb.getAttribute('data-i'), at = state.sel.indexOf(i);
      if (cb.checked) {
        if (state.sel.length >= 4) {
          cb.checked = false;
          if (window.TOAST) TOAST.info('Compare up to 4 rows at a time.');
          return;
        }
        if (at === -1) state.sel.push(i);
      } else if (at > -1) state.sel.splice(at, 1);
      cb.closest('tr').classList.toggle('is-sel', cb.checked);
      renderCompare();
    });
    var search = root.querySelector('.lt-search input');
    if (search) search.addEventListener('input', function() { state.q = search.value; renderBody(); });
    scroller.addEventListener('scroll', edge, { passive: true });
    if (window.ResizeObserver) new ResizeObserver(edge).observe(scroller);

    renderBody();
    renderCompare();
  }

  /* ══ page ══ */
  function parseParams(p) {
    var m = String(p).match(/([\d.]+)\s*([MBT])/i);
    if (!m) return null;
    return parseFloat(m[1]) * { M: 1e6, B: 1e9, T: 1e12 }[m[2].toUpperCase()];
  }
  var STATUS = {
    verified: { label: 'Verified', cls: 'positive' },
    research: { label: 'Research', cls: 'info' },
    estimated: { label: 'Estimated', cls: 'warning' }
  };
  function statusPill(key, label) {
    var s = STATUS[key];
    return '<span class="pill ' + s.cls + '">' + esc(label || s.label) + '</span>';
  }
  var STATUS_CHIPS = [
    { key: 'all', label: 'All' },
    { key: 'verified', label: 'Verified', test: function(r) { return r.status === 'verified'; } },
    { key: 'research', label: 'Research', test: function(r) { return r.status === 'research'; } },
    { key: 'estimated', label: 'Estimated', test: function(r) { return r.status === 'estimated'; } }
  ];

  function trainingTable() {
    var rows = DATA.TRAINING_BENCHMARKS.map(function(b, i) {
      return { _i: i, model: b.model, params: b.params, pnum: parseParams(b.params), co2: b.co2, water: b.water, energy: b.energy, status: b.status, citation: b.citation };
    });
    function num(k, unit) { return function(r) { return r[k] ? r[k].toLocaleString() : '—'; }; }
    ledger({
      id: 'bn-train', name: 'Training footprints', persist: true, selectable: true, search: function(r) { return r.model + ' ' + r.params + ' ' + r.citation; },
      chips: STATUS_CHIPS, chipLabel: 'Filter by evidence status', rows: rows,
      cols: [
        { key: 'model', label: 'Model', val: function(r) { return r.model; }, text: function(r) { return r.model; } },
        { key: 'params', label: 'Parameters', val: function(r) { return r.pnum; }, text: function(r) { return r.params; } },
        { key: 'co2', label: 'CO₂e (t)', num: true, bar: true, val: function(r) { return r.co2; }, text: num('co2') },
        { key: 'water', label: 'Water (L)', num: true, val: function(r) { return r.water; }, text: num('water') },
        { key: 'energy', label: 'Energy (MWh)', num: true, val: function(r) { return r.energy; }, text: num('energy') },
        { key: 'status', label: 'Status', val: function(r) { return r.status; }, text: function(r) { return STATUS[r.status].label; }, html: function(r) { return statusPill(r.status); } },
        { key: 'citation', label: 'Source', val: function(r) { return r.citation; }, text: function(r) { return r.citation; }, html: function(r) { return '<span class="lt-src">' + esc(r.citation) + '</span>'; } }
      ]
    });
  }

  function inferenceTable() {
    var rows = DATA.INFERENCE_BENCHMARKS.map(function(b, i) {
      var key = b.src.indexOf('Google') > -1 ? 'research' : b.src.indexOf('Luccioni') > -1 ? 'verified' : 'estimated';
      var label = key === 'verified' ? 'Luccioni 2023' : key === 'research' ? 'Report' : 'Estimated';
      return { _i: i, model: b.model, cls: b.cls, power: b.power_wh, co2: b.co2, water: b.water, cost: b.cost, wue: b.wue, status: key, statusLabel: label };
    });
    ledger({
      id: 'bn-inf', name: 'Inference impact', persist: true, selectable: true, search: function(r) { return r.model + ' ' + r.cls + ' ' + r.wue + ' ' + r.statusLabel; },
      chips: STATUS_CHIPS, chipLabel: 'Filter by evidence status', rows: rows,
      cols: [
        { key: 'model', label: 'Model', val: function(r) { return r.model; }, text: function(r) { return r.model; } },
        { key: 'cls', label: 'Class', val: function(r) { return r.cls; }, text: function(r) { return r.cls; } },
        { key: 'power', label: 'Power / 1M tok', num: true, bar: true, val: function(r) { return r.power; }, text: function(r) { return r.power >= 1000 ? (r.power / 1000).toFixed(1) + ' kWh' : r.power + ' Wh'; } },
        { key: 'co2', label: 'CO₂ / 1M tok', num: true, val: function(r) { return r.co2; }, text: function(r) { return r.co2.toFixed(0) + ' g'; } },
        { key: 'water', label: 'Water / 1M tok', num: true, val: function(r) { return r.water; }, text: function(r) { return r.water.toFixed(1) + ' L'; } },
        { key: 'cost', label: 'Cost / 1M tok', num: true, val: function(r) { return r.cost; }, text: function(r) { return '$' + r.cost.toFixed(2); } },
        { key: 'wue', label: 'DC WUE', val: function(r) { return r.wue; }, text: function(r) { return r.wue; } },
        { key: 'status', label: 'Source', val: function(r) { return r.status; }, text: function(r) { return r.statusLabel; }, html: function(r) { return statusPill(r.status, r.statusLabel); } }
      ]
    });
  }

  function sec(id, title, sub, body, cls) {
    return '<section class="bn-sec' + (cls ? ' ' + cls : '') + '" aria-labelledby="' + id + '-h"><h2 id="' + id + '-h">' + title + '</h2>'
      + (sub ? '<p class="bn-sub">' + sub + '</p>' : '') + body + '</section>';
  }
  function eqv(items) {
    return '<dl class="bn-eqv">' + items.map(function(it) { return '<div class="bn-eqv-row"><dt>' + it[0] + '</dt><dd>' + it[1] + '</dd></div>'; }).join('') + '</dl>';
  }
  function cite(author, title, key) {
    var text = plain(author + ' ' + title + ' ' + key);
    return '<li class="bn-cite"><div class="bn-cite-body"><span class="bn-cite-author">' + author + '</span> ' + title + '<span class="bn-cite-key">' + key + '</span></div>'
      + '<button type="button" class="bn-copy" data-cite="' + esc(text) + '" aria-label="Copy citation"><span class="ic">' + icon('copy') + '</span><span class="bn-copy-label">Copy</span></button></li>';
  }

  function render() {
    var panel = document.getElementById('benchmarks-panel');
    var ctxModels = [
      ['0.0000025', 'GPT-4o ($2.50/1M in)'], ['0.00000015', 'GPT-4o mini ($0.15/1M in)'], ['0.000015', 'Claude Opus 4 ($15/1M in)'],
      ['0.000003', 'Claude Sonnet 4 ($3/1M in)'], ['0.0000008', 'Claude Haiku ($0.80/1M in)'], ['0.00000125', 'Gemini 2.5 Pro ($1.25/1M in)'],
      ['0.0000001', 'Gemini 2.0 Flash ($0.10/1M in)'], ['0.00000059', 'Llama 3.3 70B ($0.59/1M in)'], ['0.000010', 'o3 ($10/1M in)'],
      ['0.00000055', 'DeepSeek R1 ($0.55/1M in)']
    ];

    panel.innerHTML =
      '<div class="bn">'
      + '<header class="bn-head"><h1>Benchmarks</h1><p>The research figures behind every power, CO₂, water and cost number in TokenLens. Estimated values are marked as such.</p></header>'

      + sec('bn-training', 'Training footprints',
          'One-time cost to train each model, spread across billions of inference calls. Frontier models with undisclosed architecture are estimated from scaling laws.',
          '<div id="bn-train"></div><p class="bn-note">GPT-4 parameter count is unconfirmed. OpenAI has not disclosed the architecture.</p>')

      + sec('bn-inference', 'Inference impact per 1M tokens',
          'Power is anchored to Luccioni et al. 2023 (direct GPU measurement). CO₂ and water follow from power and each provider\'s grid and cooling profile.',
          '<div id="bn-inf"></div><p class="bn-note">Luccioni 2023 anchor: a 6B model draws about 540 to 640 Wh per 1M tokens on an A100. Larger models scale as parameters^0.65. Reasoning models add 4 to 20 times for extended chain-of-thought compute. Versioned OpenRouter IDs (for example claude-3-5-sonnet-20241022) resolve by provider-prefix match.</p>')

      + sec('bn-context', 'How context growth drives cost',
          'Every turn re-sends the whole conversation, so turn k bills P + (k−1) × (P+O) input tokens. Cost per turn climbs roughly in step with the turn number.',
          '<div class="bn-form">'
            + '<div class="bn-fld"><label for="cc-p">Prompt tokens per turn (P)</label><input type="number" id="cc-p" value="100" min="1" max="5000" oninput="UI_BENCHMARKS.calcCtx()"></div>'
            + '<div class="bn-fld"><label for="cc-o">Output tokens per turn (O)</label><input type="number" id="cc-o" value="300" min="1" max="5000" oninput="UI_BENCHMARKS.calcCtx()"></div>'
            + '<div class="bn-fld"><label for="cc-n">Number of turns: <span id="cc-n-val">5</span></label>'
              + '<input type="range" id="cc-n" min="1" max="20" value="5" oninput="document.getElementById(\'cc-n-val\').textContent=this.value;UI_BENCHMARKS.calcCtx()"></div>'
            + '<div class="bn-fld"><label for="cc-model">Model (input price)</label><select id="cc-model" onchange="UI_BENCHMARKS.calcCtx()">'
              + ctxModels.map(function(m) { return '<option value="' + m[0] + '">' + m[1] + '</option>'; }).join('')
            + '</select></div>'
          + '</div>'
          + '<div class="bn-kpis">'
            + '<div class="bn-kpi"><div class="bn-kpi-l">Turn 1 cost</div><div class="bn-kpi-v" id="cc-r1">$0.00</div></div>'
            + '<div class="bn-kpi"><div class="bn-kpi-l">Last turn cost</div><div class="bn-kpi-v" id="cc-rn">$0.00</div></div>'
            + '<div class="bn-kpi"><div class="bn-kpi-l">Total session cost</div><div class="bn-kpi-v" id="cc-total">$0.00</div></div>'
            + '<div class="bn-kpi"><div class="bn-kpi-l">Last turn vs first</div><div class="bn-kpi-v" id="cc-mult">1×</div></div>'
          + '</div>'
          + '<div id="cc-chart" class="bn-chart"></div>')

      + sec('bn-breakeven', 'Break-even between two models',
          'Monthly cost of each model as volume grows, with the output-to-input ratio held fixed. The cheaper model is drawn in green.',
          '<div class="bn-form">'
            + '<div class="bn-fld"><label for="be-a">Model A</label><select id="be-a" onchange="UI_BENCHMARKS.calcBreakEven()"><option value="">Select a model</option></select></div>'
            + '<div class="bn-fld"><label for="be-b">Model B</label><select id="be-b" onchange="UI_BENCHMARKS.calcBreakEven()"><option value="">Select a model</option></select></div>'
            + '<div class="bn-fld"><label for="be-in">Monthly input tokens</label><input type="number" id="be-in" value="10000000" min="1" oninput="UI_BENCHMARKS.calcBreakEven()"></div>'
            + '<div class="bn-fld"><label for="be-out">Monthly output tokens</label><input type="number" id="be-out" value="3000000" min="1" oninput="UI_BENCHMARKS.calcBreakEven()"></div>'
          + '</div>'
          + '<div class="be-results bn-kpis" id="be-results"></div>'
          + '<div class="be-chart-wrap bn-chart" id="be-chart"></div>')

      + sec('bn-scorecard', 'Selected models on five dimensions',
          'Scores run from 0 to 100 against the highest value among your selected models. Cost, CO₂ and power are inverted so higher is better on every column. The leader in each column is green.',
          '<div id="bench-radar-card"><div id="bench-radar-wrap"></div></div>')

      + '<div class="bn-pair">'
        + sec('bn-water', 'Water usage equivalents', 'Based on Li et al. 2023, "Making AI Less Thirsty".',
            eqv([['~2 glasses', 'Per 20-question ChatGPT session (~500 mL)'], ['1 bottle', 'Per 40-question GPT-4 session (~500 mL)'], ['0.008 showers', 'GPT-4 session vs a 65 L shower'],
                 ['1–5 mL', 'Per email draft (mini model)'], ['50–200 mL', 'Long research prompt (frontier model)'], ['700,000 L', 'To train GPT-3 once (Li et al. 2023)']])
            + '<p class="bn-note">WUE: Google ~0.71 L/kWh, Azure ~1.2–2.0 L/kWh, AWS ~0.5 L/kWh. Varies by region and cooling method.</p>')
        + sec('bn-co2', 'CO₂ emission equivalents', 'Inference carbon next to everyday activity.',
            eqv([['~2.3 km', 'Per gram CO₂, driving equivalent'], ['~8 charges', 'Per gram CO₂, smartphone charges'], ['~0.5 g', 'GPT-4o prompt, about one brewed coffee'],
                 ['~40 min', 'Per gram CO₂ absorbed by one tree'], ['~0.001 flight', 'NY to LA flight emits ~200 kg CO₂'], ['~0.5 Wh', 'Per gram CO₂ (US average grid 386 g/kWh)']])
            + '<p class="bn-note">US grid 2023: ~386 g CO₂/kWh (EPA). Data centers with renewable sourcing run well below that.</p>')
      + '</div>'

      + sec('bn-power', 'Power consumption equivalents per 1M tokens',
          'Based on Luccioni et al. 2023 power measurements. An average US home uses about 30 kWh a day.',
          eqv([['~0.6 Wh', 'Gemini Flash / Claude Haiku (most efficient)'], ['~3.2 Wh', 'GPT-4o / Claude Sonnet (frontier MoE)'], ['~9.5 Wh', 'DeepSeek R1 reasoning'], ['~24 Wh', 'OpenAI o3 extended reasoning'],
               ['1 phone charge ≈ 5 Wh', 'A frontier model uses 0.6 to 5 phone charges per 1M tokens'], ['~1,700 Wh = 1 kWh', 'Run ~500K frontier-model tokens on 1 kWh'],
               ['US home: 30 kWh/day', 'o3 at 24 Wh: 1M tokens is 0.08% of a day\'s home energy'], ['EV: 0.3 kWh/mile', '1M GPT-4o tokens is about 0.01 miles of EV driving']]))

      + sec('bn-method', 'Methodology',
          '',
          '<div class="bn-prose"><p>Power (Wh per 1M tokens) is the primary metric. It is anchored to the Luccioni et al. 2023 direct GPU measurement of a 6B parameter model, about 540 to 640 Wh per 1M tokens. Larger models scale as parameters^0.65, which is sublinear because inference is memory-bandwidth limited.</p>'
          + '<p>CO₂ is power times grid carbon intensity (gCO₂/kWh) divided by 1000. Water is power times WUE (L/kWh) divided by 1000. Provider profiles come from the Google Environmental Report 2023, the Microsoft Sustainability Report 2023 and the AWS Sustainability Report 2023.</p>'
          + '<p>Every model therefore shows its own research-grounded numbers, even when its exact ID is missing from the lookup table.</p></div>')

      + sec('bn-cites', 'Research citations',
          'Primary sources for the benchmark data in this dashboard.',
          '<ol class="bn-cites">'
          + cite('Luccioni, A.S., Viguier, S., &amp; Ligozat, A. (2023).', '&ldquo;Power Hungry Processing: Watts Driving the Cost of AI Deployment?&rdquo;', 'arXiv:2311.16863. Primary anchor for all power estimates. Direct GPU measurement across model sizes; a 6B model draws about 540–640 Wh per 1M tokens.')
          + cite('de Vries, A. (2023).', '&ldquo;The growing energy footprint of artificial intelligence.&rdquo;', 'Joule, Vol. 7, Issue 10. About 1 g CO₂ per ChatGPT query. Used to calibrate GPT-4 class power estimates and cross-check POWER_RATES.')
          + cite('Li, P., Yang, J., Islam, M.A., &amp; Ren, S. (2023).', '&ldquo;Making AI Less Thirsty: Uncovering and Addressing the Secret Water Footprint of AI Models.&rdquo;', 'arXiv:2304.03271. GPT-3: about 700,000 L for training and 500 mL per 20-question session. Water is power times WUE (L/kWh): Azure ~1.2–2.0, AWS ~0.5, GCP ~0.71.')
          + cite('Strubell, E., Ganesh, A., &amp; McCallum, A. (2019).', '&ldquo;Energy and Policy Considerations for Deep Learning in NLP.&rdquo;', 'ACL 2019. BERT-base: 0.65 tCO₂e for training. First widely cited study of NLP carbon footprint.')
          + cite('Patterson, D. et al. (2021).', '&ldquo;Carbon Emissions and Large Neural Network Training.&rdquo;', 'arXiv:2104.10350. T5-Large: 46.7 tCO₂e. Transformer and Megatron-LM benchmarks. Google data center PUE method.')
          + cite('Touvron, H. et al. (2023).', '&ldquo;LLaMA&rdquo; and &ldquo;LLaMA 2: Open Foundation and Fine-Tuned Chat Models.&rdquo;', 'arXiv:2302.13971 and 2307.09288. LLaMA 65B: 539 tCO₂e. LLaMA 2 70B: 291 tCO₂e. Full training energy disclosure.')
          + cite('Scao, T. et al. / BigScience (2022).', '&ldquo;BLOOM: A 176B-Parameter Open-Access Multilingual Language Model.&rdquo;', 'arXiv:2211.05100. BLOOM 176B: 433 tCO₂e. Jean Zay supercomputer, France (largely nuclear grid).')
          + cite('Rae, J. W. et al. / DeepMind (2021).', '&ldquo;Scaling Language Models: Methods, Analysis &amp; Insights from Training Gopher.&rdquo;', 'arXiv:2112.11446. Gopher 280B: 380 tCO₂e.')
          + cite('Google LLC (2023).', '&ldquo;Google Environmental Report 2023.&rdquo;', 'WUE of about 0.71 L/kWh across Google data centers (2022). Used for Gemini water rate estimates.')
          + cite('Microsoft Corporation (2023).', '&ldquo;Microsoft Environmental Sustainability Report 2023.&rdquo;', 'Azure WUE of about 1.2–2.0 L/kWh, higher in warm climates with evaporative cooling. Used for GPT family water estimates.')
          + '</ol>')
      + '</div>';

    trainingTable();
    inferenceTable();
    calcCtx();
    setTimeout(function() { renderRadar(); populateBreakEvenSelects(); calcBreakEven(); }, 0);

    if (!panel._wired) {
      panel._wired = true;
      panel.addEventListener('click', function(e) {
        var b = e.target.closest('.bn-copy[data-cite]');
        if (!b) return;
        copyText(b.getAttribute('data-cite')).then(function(ok) { flashCopied(b, ok, 'Copied'); });
      });
    }
  }

  function fcUsd(v) {
    if (v < 0.0001) return '$' + v.toFixed(6);
    if (v < 0.01) return '$' + v.toFixed(4);
    return '$' + v.toFixed(3);
  }
  function tickUsd(v) {
    if (v === 0) return '$0';
    if (v < 0.001) return '$' + v.toFixed(5);
    if (v < 0.1) return '$' + v.toFixed(4);
    return '$' + v.toFixed(3);
  }

  function calcCtx() {
    var P  = parseInt((document.getElementById('cc-p') && document.getElementById('cc-p').value) || 100);
    var O  = parseInt((document.getElementById('cc-o') && document.getElementById('cc-o').value) || 300);
    var N  = parseInt((document.getElementById('cc-n') && document.getElementById('cc-n').value) || 5);
    var ip = parseFloat((document.getElementById('cc-model') && document.getElementById('cc-model').value) || 0.0000025);
    var op = ip * 3;
    var total = 0, t1 = 0, tN = 0, perTurn = [], cumCosts = [];
    for (var k = 1; k <= N; k++) {
      var inp = P + (k - 1) * (P + O);
      var c   = inp * ip + O * op;
      total  += c; perTurn.push(c); cumCosts.push(total);
      if (k === 1) t1 = c;
      if (k === N) tN = c;
    }
    var mult = t1 > 0 ? (tN / t1).toFixed(1) : '1.0';
    setNum('cc-r1', fcUsd(t1));
    setNum('cc-rn', fcUsd(tN));
    setNum('cc-total', fcUsd(total));
    setNum('cc-mult', mult + '×');
    renderBarChart(perTurn, cumCosts, N);
  }

  function renderBarChart(perTurn, cumCosts, N) {
    var chartEl = document.getElementById('cc-chart');
    if (!chartEl) return;
    drawChart(chartEl, {
      type: 'bar',
      label: 'Cost per turn over ' + N + ' turns, from ' + fcUsd(perTurn[0]) + ' to ' + fcUsd(perTurn[N - 1]),
      xLabels: perTurn.map(function(v, i) { return String(i + 1); }),
      xTitle: 'Turn number',
      series: [{ name: 'Cost per turn', cls: 'grey', values: perTurn }],
      hi: N - 1,
      valueLabels: N > 1 ? [0, N - 1] : [0],
      fmtY: tickUsd,
      tip: function(i) {
        return { title: 'Turn ' + (i + 1), rows: [
          { label: 'Cost this turn', value: fcUsd(perTurn[i]) },
          { label: 'Running total', value: fcUsd(cumCosts[i]) }
        ] };
      }
    });
  }

  function scoreRows(models) {
    var vals = models.map(function(m) {
      var ip = parseFloat(m.pricing && m.pricing.prompt || 0) * 1e6;
      var op = parseFloat(m.pricing && m.pricing.completion || 0) * 1e6;
      return { cost: (ip + op) / 2 || 0.001, co2: DATA.getCO2Rate(m.id) || 1, power: DATA.getPowerRate(m.id) || 1,
               ctx: m.context_length || 4096, tps: CHARTS.getTPS(m.id) };
    });
    function mx(k) { return Math.max.apply(null, vals.map(function(v) { return v[k]; })) || 1; }
    var maxCost = mx('cost'), maxCO2 = mx('co2'), maxPow = mx('power'), maxCtx = mx('ctx'), maxTPS = mx('tps');
    return models.map(function(m, i) {
      var v = vals[i];
      function pct(x) { return Math.round(Math.max(0.05, x) * 100); }
      return { _i: i, name: m.name || m.id.split('/').pop(),
               cost: pct(1 - v.cost / maxCost), co2: pct(1 - v.co2 / maxCO2), power: pct(1 - v.power / maxPow),
               ctx: pct(v.ctx / maxCtx), speed: pct(v.tps / maxTPS) };
    });
  }

  function renderRadar() {
    var wrap = document.getElementById('bench-radar-wrap');
    if (!wrap) return;
    var models = STATE.getActiveModels();
    if (!models.length) {
      wrap.innerHTML = '<div class="bn-empty">Select models in the model panel to score them here.</div>';
      return;
    }
    wrap.innerHTML = '<div id="bn-score"></div>';
    function col(key, label) {
      return { key: key, label: label, num: true, bar: true, best: true, barMax: 100, val: function(r) { return r[key]; }, text: function(r) { return String(r[key]); } };
    }
    ledger({
      id: 'bn-score', name: 'Model scorecard', rows: scoreRows(models),
      cols: [
        { key: 'name', label: 'Model', val: function(r) { return r.name; }, text: function(r) { return r.name; } },
        col('cost', 'Cost efficiency'), col('co2', 'CO₂ efficiency'), col('power', 'Power efficiency'), col('ctx', 'Context size'), col('speed', 'Speed')
      ]
    });
  }

  function populateBreakEvenSelects() {
    var models = STATE.getModels().slice(0, 60);
    var opts = '<option value="">Select a model</option>'
      + models.map(function(m) {
          var sname = m.name || m.id.split('/').pop();
          return '<option value="' + esc(m.id) + '">' + esc(sname) + '</option>';
        }).join('');
    var sa = document.getElementById('be-a'), sb = document.getElementById('be-b');
    if (sa) sa.innerHTML = opts;
    if (sb) sb.innerHTML = opts;
    if (sa && models.length > 0) sa.value = models[0].id;
    if (sb && models.length > 1) sb.value = models[1].id;
  }

  function calcBreakEven() {
    var aId = (document.getElementById('be-a') || {}).value;
    var bId = (document.getElementById('be-b') || {}).value;
    var inTok = parseInt((document.getElementById('be-in') || {}).value || 10000000);
    var outTok = parseInt((document.getElementById('be-out') || {}).value || 3000000);
    var resEl = document.getElementById('be-results');
    var chartEl = document.getElementById('be-chart');
    if (!aId || !bId || aId === bId || !resEl) return;
    var mA = STATE.getModels().find(function(m) { return m.id === aId; });
    var mB = STATE.getModels().find(function(m) { return m.id === bId; });
    if (!mA || !mB) return;
    var costA = CALC.cost(mA, inTok, outTok);
    var costB = CALC.cost(mB, inTok, outTok);
    var savings = Math.abs(costA - costB);
    var nameA = mA.name || mA.id.split('/').pop();
    var nameB = mB.name || mB.id.split('/').pop();
    var cheaper = costA < costB ? nameA : nameB;
    var savPct = (costA && costB) ? (savings / Math.max(costA, costB) * 100).toFixed(0) : 0;
    function fc(v) { return CALC.fmtCost(v); }
    resEl.innerHTML =
      '<div class="be-result-card bn-kpi"><div class="brl bn-kpi-l">' + esc(nameA) + ' per month</div><div class="brv bn-kpi-v">' + fc(costA) + '</div></div>'
      + '<div class="be-result-card bn-kpi"><div class="brl bn-kpi-l">' + esc(nameB) + ' per month</div><div class="brv bn-kpi-v">' + fc(costB) + '</div></div>'
      + '<div class="be-result-card bn-kpi"><div class="brl bn-kpi-l">Monthly savings with ' + esc(cheaper) + '</div><div class="brv bn-kpi-v be-save">' + savPct + '% · ' + fc(savings) + '</div></div>';
    if (!chartEl) return;
    var steps = 10, ptsA = [], ptsB = [], labels = [], vols = [];
    for (var i = 1; i <= steps; i++) {
      var vol = (inTok / steps) * i;
      ptsA.push(CALC.cost(mA, vol, (outTok / inTok) * vol));
      ptsB.push(CALC.cost(mB, vol, (outTok / inTok) * vol));
      labels.push((vol / 1e6).toFixed(1) + 'M');
      vols.push(vol);
    }
    var aCheaper = costA < costB;
    drawChart(chartEl, {
      type: 'line',
      label: 'Monthly cost of ' + nameA + ' and ' + nameB + ' as input volume grows to ' + labels[steps - 1] + ' tokens',
      xLabels: labels,
      xTitle: 'Monthly input tokens',
      series: [
        { name: nameA, cls: aCheaper ? 'data' : 'ink', values: ptsA },
        { name: nameB, cls: aCheaper ? 'ink' : 'data', values: ptsB, dash: true }
      ],
      endLabels: true,
      fmtY: function(v) { var t = CALC.fmtCost(v); return v === 0 ? t.replace(/[.,]0+$/, '') : t; },
      tip: function(i) {
        return { title: labels[i] + ' input tokens', rows: [
          { label: nameA, value: fc(ptsA[i]), cls: aCheaper ? 'data' : 'ink' },
          { label: nameB, value: fc(ptsB[i]), cls: aCheaper ? 'ink' : 'data' }
        ] };
      }
    });
  }

  return { render: render, calcCtx: calcCtx, renderRadar: renderRadar, populateBreakEvenSelects: populateBreakEvenSelects, calcBreakEven: calcBreakEven, copyText: copyText, flashCopied: flashCopied };
})();
