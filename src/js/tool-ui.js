/* ══════════════════════════════════════════════════════════
   TLUI — shared building blocks for the tool dialogs
   Markup helpers (KPI row, ledger table, meters, pills), charts with
   hover and keyboard tooltips, copy/download with toasts, count-up,
   sortable tables, two-step confirm buttons and persisted toggles.
   ══════════════════════════════════════════════════════════ */
window.TLUI = (function() {
  var PREFIX = 'tl_ui_';

  function esc(s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
  function reduced() { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); }
  function store(key, val) {
    try {
      if (val === undefined) return localStorage.getItem(PREFIX + key);
      localStorage.setItem(PREFIX + key, val);
    } catch (e) {}
    return null;
  }
  function debounce(fn, ms) {
    var t;
    return function() {
      var a = arguments, self = this;
      clearTimeout(t);
      t = setTimeout(function() { fn.apply(self, a); }, ms);
    };
  }

  /* ── Markup helpers ─────────────────────────── */
  function kpi(label, value, opts) {
    opts = opts || {};
    return '<div class="tl-kpi"><div class="tl-kpi-l">' + esc(label) + '</div>'
      + '<div class="tl-kpi-v' + (opts.money ? ' money' : '') + (opts.tone ? ' ' + opts.tone : '') + '">' + value + '</div>'
      + (opts.sub ? '<div class="tl-kpi-s">' + opts.sub + '</div>' : '') + '</div>';
  }
  function kpis(items) {
    return '<div class="tl-kpis">' + items.map(function(k) { return kpi(k[0], k[1], k[2]); }).join('') + '</div>';
  }
  function pill(text, tone) { return '<span class="pill' + (tone ? ' ' + tone : '') + '">' + text + '</span>'; }
  function sample(note) {
    return '<span class="pill tl-sample" title="' + esc(note || 'Illustrative values, not read from your account') + '">Sample data</span>';
  }
  function empty(text) { return '<div class="tl-empty">' + text + '</div>'; }
  function meter(pct, tone) {
    var p = Math.max(0, Math.min(100, pct || 0));
    return '<div class="tl-meter' + (tone ? ' ' + tone : '') + '" role="presentation"><i style="--p:' + (p / 100).toFixed(4) + '"></i></div>';
  }
  function block(title, sub, inner, head) {
    return '<section class="tl-block"><div class="tl-block-head"><div><h3 class="tl-h">' + title + '</h3>'
      + (sub ? '<p class="tl-sub">' + sub + '</p>' : '') + '</div>' + (head || '') + '</div>' + inner + '</section>';
  }

  /* Ledger: header of grey labels, 44px rows, share-of-largest bar behind the row.
     cols: CSS grid template. head: [{label, num, sort, cls}]. rows: [{cells, sort, w, cls, attrs}] */
  function ledger(o) {
    var head = '<div class="tl-row head" role="row">' + o.head.map(function(h, i) {
      var cls = (h.num ? ' num' : '') + (h.cls ? ' ' + h.cls : '');
      var inner = h.sort
        ? '<button type="button" class="tl-th" data-sort="' + i + '" aria-label="Sort by ' + esc(h.label) + '">' + esc(h.label) + '</button>'
        : esc(h.label);
      return '<div class="tl-cell' + cls + '" role="columnheader"' + (h.sort ? ' aria-sort="none"' : '') + '>' + inner + '</div>';
    }).join('') + '</div>';
    var rows = o.rows.map(function(r, ri) {
      var data = '';
      (r.sort || []).forEach(function(v, i) { if (v != null) data += ' data-s' + i + '="' + esc(v) + '"'; });
      var w = r.w == null ? null : Math.max(0, Math.min(1, r.w));
      return '<div class="tl-row' + (w == null ? '' : ' bar') + (r.cls ? ' ' + r.cls : '') + '" role="row" style="--i:' + ri + (w == null ? '' : ';--w:' + (w * 100).toFixed(1) + '%') + (r.style ? ';' + r.style : '') + '"' + data + (r.attrs || '') + '>'
        + r.cells.map(function(c, i) {
            var h = o.head[i] || {};
            return '<div class="tl-cell' + (h.num ? ' num' : '') + (h.cls ? ' ' + h.cls : '') + '" role="cell">' + c + '</div>';
          }).join('')
        + '</div>';
    }).join('');
    return '<div class="tl-scroll"><div class="tl-ledger" role="table" aria-label="' + esc(o.label || '') + '" style="--cols:' + o.cols + (o.colsSm ? ';--cols-sm:' + o.colsSm : '') + (o.min ? ';--min:' + o.min + 'px' : '') + '"' + (o.attrs || '') + '>' + head + '<div class="tl-rows">' + rows + '</div></div></div>';
  }

  /* ── Copy / download ────────────────────────── */
  function copy(text, msg) {
    function ok() { if (window.TOAST) TOAST.success(msg || 'Copied.'); }
    function fail() {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.select();
        var done = document.execCommand('copy');
        ta.remove();
        if (done) { ok(); return; }
      } catch (e) {}
      if (window.TOAST) TOAST.warning('Copy was blocked. Select the text and copy it manually.');
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, fail);
    else fail();
  }
  function download(name, text, mime) {
    var blob = new Blob([text], { type: mime || 'text/plain' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function() { URL.revokeObjectURL(url); }, 1000);
    if (window.TOAST) TOAST.success('Saved ' + name + '.');
  }

  /* ── Count-up for KPI values ─────────────────── */
  function countUp(root) {
    if (reduced() || !root) return;
    root.querySelectorAll('.tl-kpi-v').forEach(function(el) {
      if (el.children.length) return;
      var txt = el.textContent;
      var m = txt.match(/-?\d[\d,]*\.?\d*/);
      if (!m) return;
      var target = parseFloat(m[0].replace(/,/g, ''));
      if (!isFinite(target) || target === 0) return;
      var dec = (m[0].split('.')[1] || '').length, comma = m[0].indexOf(',') > -1;
      var pre = txt.slice(0, m.index), post = txt.slice(m.index + m[0].length);
      var t0 = performance.now();
      function fmt(v) {
        var s = v.toFixed(dec);
        if (comma) { var p = s.split('.'); p[0] = p[0].replace(/\B(?=(\d{3})+(?!\d))/g, ','); s = p.join('.'); }
        return s;
      }
      function step(now) {
        var p = Math.min(1, (now - t0) / 360);
        el.textContent = p < 1 ? pre + fmt(target * (1 - Math.pow(1 - p, 3))) + post : txt;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    });
  }

  /* ── Charts ──────────────────────────────────── */
  function niceMax(v) {
    if (!(v > 0)) return 1;
    var raw = v / 4, mag = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / mag;
    var step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
    return step * 4;
  }

  function mount(el, draw) {
    el.classList.add('tl-chart');
    if (el._ro) { el._ro.disconnect(); el._ro = null; }
    var last = 0;
    function paint() {
      var w = Math.max(260, Math.floor(el.clientWidth || 600));
      last = el.clientWidth;
      draw(w);
    }
    paint();
    if (window.ResizeObserver) {
      el._ro = new ResizeObserver(function() { if (el.clientWidth && Math.abs(el.clientWidth - last) > 1) paint(); });
      el._ro.observe(el);
    }
  }

  function wire(el, svg, n, xAt, show, hide) {
    var idx = -1, live = el.querySelector('.tl-live');
    function at(i) {
      idx = Math.max(0, Math.min(n - 1, i));
      el.classList.add('hov');
      var msg = show(idx);
      if (live && msg) live.textContent = msg;
    }
    function off() { idx = -1; el.classList.remove('hov'); hide(); }
    svg.addEventListener('pointermove', function(e) {
      var r = svg.getBoundingClientRect(), x = e.clientX - r.left, best = 0, bd = 1e9;
      for (var i = 0; i < n; i++) { var d = Math.abs(xAt(i) - x); if (d < bd) { bd = d; best = i; } }
      at(best);
    });
    svg.addEventListener('pointerleave', function() { if (document.activeElement !== svg) off(); });
    svg.addEventListener('focus', function() { if (idx < 0) at(n - 1); });
    svg.addEventListener('blur', off);
    svg.addEventListener('keydown', function(e) {
      if (e.key === 'ArrowRight' || e.key === 'ArrowUp') { e.preventDefault(); at(idx < 0 ? 0 : idx + 1); }
      else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') { e.preventDefault(); at(idx < 0 ? n - 1 : idx - 1); }
      else if (e.key === 'Home') { e.preventDefault(); at(0); }
      else if (e.key === 'End') { e.preventDefault(); at(n - 1); }
    });
  }

  function tipHtml(title, rows) {
    return '<div class="tl-tip-t">' + esc(title) + '</div>' + rows.map(function(r) {
      return '<div class="tl-tip-r"><span class="sw ' + (r.tone || 'ink') + '"></span><span>' + esc(r.name) + '</span><b>' + esc(r.value) + '</b></div>';
    }).join('');
  }
  function place(tip, x, w) {
    tip.hidden = false;
    var tw = tip.offsetWidth || 150;
    tip.style.transform = 'translateX(' + Math.round(x + 12 + tw > w - 4 ? Math.max(4, x - 12 - tw) : x + 12) + 'px)';
  }

  /* cfg: { label, height, xs[], xTicks[], series[{name,values[],tone}], fmtY, fmtX, refs[{value,label,tone}], markers[{i,label}] } */
  function lineChart(el, cfg) {
    mount(el, function(w) {
      var H = cfg.height || 220, n = cfg.xs.length, pt = 14, pb = 26, pr = 12;
      var all = [];
      cfg.series.forEach(function(s) { all = all.concat(s.values); });
      (cfg.refs || []).forEach(function(r) { all.push(r.value); });
      var ymax = niceMax(Math.max.apply(null, all.concat([0])));
      var fmtY = cfg.fmtY || String;
      var pl = 12 + Math.max.apply(null, [0, 1, 2, 3, 4].map(function(k) { return String(fmtY(ymax * k / 4)).length; })) * 6.6;
      var iw = w - pl - pr, ih = H - pt - pb;
      function X(i) { return pl + (n === 1 ? iw / 2 : (i / (n - 1)) * iw); }
      function Y(v) { return pt + (1 - v / ymax) * ih; }
      var g = '';
      for (var k = 0; k <= 4; k++) {
        var yv = ymax * k / 4;
        g += '<line class="g" x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(yv).toFixed(1) + '" y2="' + Y(yv).toFixed(1) + '"/>'
          + '<text class="t" x="' + (pl - 8) + '" y="' + (Y(yv) + 4).toFixed(1) + '" text-anchor="end">' + esc(fmtY(yv)) + '</text>';
      }
      var fmtX = cfg.fmtX || String;
      (cfg.xTicks || []).forEach(function(i) {
        g += '<text class="t" x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="' + (i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle') + '">' + esc(fmtX(i)) + '</text>';
      });
      var refs = (cfg.refs || []).map(function(r) {
        return '<line class="ref ' + (r.tone || 'neg') + '" x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(r.value).toFixed(1) + '" y2="' + Y(r.value).toFixed(1) + '"/>'
          + '<text class="lab ' + (r.tone || 'neg') + '" x="' + (w - pr) + '" y="' + (Y(r.value) - 5).toFixed(1) + '" text-anchor="end">' + esc(r.label) + '</text>';
      }).join('');
      var marks = (cfg.markers || []).map(function(m) {
        return '<line class="mark" x1="' + X(m.i).toFixed(1) + '" x2="' + X(m.i).toFixed(1) + '" y1="' + pt + '" y2="' + (pt + ih) + '"/>'
          + '<text class="lab data" x="' + (X(m.i) + 6).toFixed(1) + '" y="' + (pt + 12) + '">' + esc(m.label) + '</text>';
      }).join('');
      var lines = cfg.series.map(function(s) {
        var d = s.values.map(function(v, i) { return (i ? 'L' : 'M') + X(i).toFixed(1) + ',' + Y(v).toFixed(1); }).join(' ');
        return '<path class="s ' + (s.tone || 'ink') + (s.dash ? ' dash' : '') + '" d="' + d + '"/>';
      }).join('');
      var ends = '', lastY = [];
      cfg.series.forEach(function(s) {
        var y = Y(s.values[n - 1]) - 7;
        lastY.forEach(function(p) { if (Math.abs(p - y) < 14) y = p + 15; });
        lastY.push(y);
        ends += '<text class="lab ' + (s.tone || 'ink') + '" x="' + (w - pr) + '" y="' + y.toFixed(1) + '" text-anchor="end">' + esc(s.name) + '</text>';
      });
      var dots = cfg.series.map(function(s) { return '<circle class="dot ' + (s.tone || 'ink') + '" r="4" cx="-9" cy="-9"/>'; }).join('');
      el.innerHTML = '<svg width="' + w + '" height="' + H + '" viewBox="0 0 ' + w + ' ' + H + '" tabindex="0" role="img" aria-label="' + esc(cfg.label || 'Chart') + '. Use the arrow keys to read values.">'
        + g + refs + marks + lines + ends + '<line class="xh" y1="' + pt + '" y2="' + (pt + ih) + '" x1="-9" x2="-9"/>' + dots + '</svg>'
        + '<div class="tl-tip" hidden></div><div class="sr-only tl-live" aria-live="polite"></div>';
      var svg = el.querySelector('svg'), tip = el.querySelector('.tl-tip'), xh = el.querySelector('.xh'), dl = el.querySelectorAll('.dot');
      wire(el, svg, n, X, function(i) {
        xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.style.display = 'block';
        cfg.series.forEach(function(s, k) { dl[k].setAttribute('cx', X(i)); dl[k].setAttribute('cy', Y(s.values[i])); });
        var rows = cfg.series.map(function(s) { return { name: s.name, value: fmtY(s.values[i], true), tone: s.tone }; });
        tip.innerHTML = tipHtml(fmtX(i, true), rows);
        place(tip, X(i), w);
        return fmtX(i, true) + ': ' + rows.map(function(r) { return r.name + ' ' + r.value; }).join(', ');
      }, function() {
        xh.style.display = 'none'; tip.hidden = true;
        dl.forEach(function(d) { d.setAttribute('cx', -9); d.setAttribute('cy', -9); });
      });
    });
  }

  /* cfg: { label, height, labels[], values[], flags[bool], avg, fmtY, fmtTip(i) } */
  function barChart(el, cfg) {
    mount(el, function(w) {
      var H = cfg.height || 200, n = cfg.values.length, pt = 14, pb = 26, pr = 12;
      var ymax = niceMax(Math.max.apply(null, cfg.values.concat([cfg.avg || 0, 0])));
      var fmtY = cfg.fmtY || String;
      var pl = 12 + Math.max.apply(null, [0, 1, 2, 3, 4].map(function(k) { return String(fmtY(ymax * k / 4)).length; })) * 6.6;
      var iw = w - pl - pr, ih = H - pt - pb, slot = iw / n, bw = Math.min(48, slot * 0.6);
      function X(i) { return pl + slot * i + slot / 2; }
      function Y(v) { return pt + (1 - v / ymax) * ih; }
      var g = '';
      for (var k = 0; k <= 4; k++) {
        var yv = ymax * k / 4;
        g += '<line class="g" x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(yv).toFixed(1) + '" y2="' + Y(yv).toFixed(1) + '"/>'
          + '<text class="t" x="' + (pl - 8) + '" y="' + (Y(yv) + 4).toFixed(1) + '" text-anchor="end">' + esc(fmtY(yv)) + '</text>';
      }
      var step = Math.ceil(n / Math.max(1, Math.floor(iw / 40)));
      var bars = cfg.values.map(function(v, i) {
        var h = Math.max(2, ih - (Y(v) - pt));
        var lab = i % step === 0 ? '<text class="t" x="' + X(i).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle">' + esc(cfg.labels[i]) + '</text>' : '';
        return '<rect class="bar' + (cfg.flags && cfg.flags[i] ? ' flag' : '') + '" data-i="' + i + '" style="--i:' + i + '" x="' + (X(i) - bw / 2).toFixed(1) + '" y="' + (pt + ih - h).toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3"/>' + lab;
      }).join('');
      var avg = cfg.avg ? '<line class="ref data" x1="' + pl + '" x2="' + (w - pr) + '" y1="' + Y(cfg.avg).toFixed(1) + '" y2="' + Y(cfg.avg).toFixed(1) + '"/>'
        + '<text class="lab data" x="' + (w - pr) + '" y="' + (Y(cfg.avg) - 5).toFixed(1) + '" text-anchor="end">avg ' + esc(fmtY(cfg.avg, true)) + '</text>' : '';
      el.innerHTML = '<svg width="' + w + '" height="' + H + '" viewBox="0 0 ' + w + ' ' + H + '" tabindex="0" role="img" aria-label="' + esc(cfg.label || 'Chart') + '. Use the arrow keys to read values.">'
        + g + bars + avg + '</svg><div class="tl-tip" hidden></div><div class="sr-only tl-live" aria-live="polite"></div>';
      var svg = el.querySelector('svg'), tip = el.querySelector('.tl-tip'), rects = el.querySelectorAll('.bar');
      wire(el, svg, n, X, function(i) {
        rects.forEach(function(r, k) { r.classList.toggle('on', k === i); });
        tip.innerHTML = tipHtml(cfg.labels[i], [{ name: cfg.seriesName || 'Value', value: fmtY(cfg.values[i], true), tone: cfg.flags && cfg.flags[i] ? 'neg' : 'ink' }].concat(cfg.extra ? cfg.extra(i) : []));
        place(tip, X(i), w);
        return cfg.labels[i] + ': ' + fmtY(cfg.values[i], true);
      }, function() { rects.forEach(function(r) { r.classList.remove('on'); }); tip.hidden = true; });
    });
  }

  /* ── Delegated behaviour ─────────────────────── */
  document.addEventListener('click', function(e) {
    var b = e.target.closest && e.target.closest('[data-confirm]');
    if (!b) return;
    if (b.dataset.armed) { clearTimeout(b._t); b.dataset.armed = ''; if (b._orig != null) b.innerHTML = b._orig; return; }
    e.stopImmediatePropagation(); e.preventDefault();
    b._orig = b.innerHTML; b.dataset.armed = '1'; b.textContent = b.dataset.confirm;
    b._t = setTimeout(function() { b.dataset.armed = ''; b.innerHTML = b._orig; }, 3000);
  }, true);

  document.addEventListener('click', function(e) {
    var th = e.target.closest && e.target.closest('.tl-th[data-sort]');
    if (!th) return;
    var root = th.closest('.tl-ledger'), idx = th.dataset.sort, cell = th.parentNode;
    var dir = cell.getAttribute('aria-sort') === 'ascending' ? 'descending' : 'ascending';
    root.querySelectorAll('[aria-sort]').forEach(function(c) { c.setAttribute('aria-sort', 'none'); });
    cell.setAttribute('aria-sort', dir);
    var holder = root.querySelector('.tl-rows');
    var rows = Array.prototype.slice.call(holder.children);
    rows.sort(function(a, b) {
      var x = a.dataset['s' + idx], y = b.dataset['s' + idx];
      var nx = parseFloat(x), ny = parseFloat(y), r;
      if (isFinite(nx) && isFinite(ny) && String(nx) === String(x).trim() && String(ny) === String(y).trim()) r = nx - ny;
      else r = String(x || '').localeCompare(String(y || ''));
      return dir === 'ascending' ? r : -r;
    });
    rows.forEach(function(r) { holder.appendChild(r); });
  });

  function applySeg(seg, v, save) {
    var target = document.getElementById(seg.dataset.for);
    if (target) target.dataset[seg.dataset.attr || 'view'] = v;
    seg.querySelectorAll('button').forEach(function(b) { b.setAttribute('aria-pressed', b.dataset.v === v ? 'true' : 'false'); });
    if (save && seg.dataset.persist) store(seg.dataset.persist, v);
    if (save && target) target.dispatchEvent(new CustomEvent('tl-seg', { bubbles: true, detail: { attr: seg.dataset.attr, value: v } }));
  }
  document.addEventListener('click', function(e) {
    var b = e.target.closest && e.target.closest('.tl-seg[data-for] button[data-v]');
    if (b) applySeg(b.parentNode, b.dataset.v, true);
  });
  function initSegs() {
    document.querySelectorAll('.tl-seg[data-for]').forEach(function(seg) {
      var saved = seg.dataset.persist ? store(seg.dataset.persist) : null;
      var def = seg.querySelector('button[aria-pressed="true"]');
      applySeg(seg, saved || (def && def.dataset.v) || seg.querySelector('button').dataset.v, false);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initSegs); else initSegs();

  document.addEventListener('keydown', function(e) {
    var t = e.target;
    if (!t.matches || !t.matches('[role="tab"]')) return;
    var tabs = Array.prototype.slice.call(t.parentNode.querySelectorAll('[role="tab"]')), i = tabs.indexOf(t), n = -1;
    if (e.key === 'ArrowRight') n = (i + 1) % tabs.length;
    else if (e.key === 'ArrowLeft') n = (i - 1 + tabs.length) % tabs.length;
    else if (e.key === 'Home') n = 0;
    else if (e.key === 'End') n = tabs.length - 1;
    if (n < 0) return;
    e.preventDefault();
    tabs[n].focus(); tabs[n].click();
  });

  return {
    esc: esc, store: store, debounce: debounce, reduced: reduced,
    kpi: kpi, kpis: kpis, pill: pill, sample: sample, empty: empty, meter: meter, block: block, ledger: ledger,
    copy: copy, download: download, countUp: countUp, lineChart: lineChart, barChart: barChart
  };
})();
