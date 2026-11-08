/* ══════════════════════════════════════════════════════════
   MODULE — COMPARE_UX
   Interaction layer for the Compare tab: model highlight, pinning,
   keyboard column navigation, copy, show more, chart hover, count-up.
   Reads the DOM that UI_COMPARE, MATRIX and VERDICT render; no logic of its own.
   ══════════════════════════════════════════════════════════ */
window.COMPARE_UX = (function() {
  var VIEW_KEY = 'tl_ui_compare_view';
  var PIN_KEY  = 'tl_ui_compare_pins';
  var reduceMq = window.matchMedia('(prefers-reduced-motion: reduce)');
  var hl = null;
  var lastVerdict = {};

  function $(id) { return document.getElementById(id); }
  function store(key, val) { try { localStorage.setItem(key, val); } catch (e) {} }
  function read(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }

  /* ── Highlight a model across columns, matrix, verdict and responses ── */
  function modelName(id) {
    var m = STATE.getModels().filter(function(x) { return x.id === id; })[0];
    return m ? (m.name || m.id) : id;
  }

  function applyHighlight() {
    var p = $('compare-panel');
    if (!p) return;
    if (hl && !STATE.isActive(hl)) hl = null;
    p.querySelectorAll('[data-model]').forEach(function(el) {
      var on = !!hl && el.getAttribute('data-model') === hl;
      el.classList.toggle('is-hl', on);
      el.classList.toggle('is-dim', !!hl && !on);
    });
    p.querySelectorAll('.js-model').forEach(function(b) {
      b.setAttribute('aria-pressed', hl && b.getAttribute('data-hl') === hl ? 'true' : 'false');
    });
    var chip = $('hl-clear');
    if (chip) {
      chip.hidden = !hl;
      if (hl) {
        var name = modelName(hl);
        chip.querySelector('.hl-clear-name').textContent = 'Following ' + name;
        chip.setAttribute('aria-label', 'Stop following ' + name);
      }
    }
  }

  function setHighlight(id) {
    hl = hl === id ? null : id;
    applyHighlight();
  }

  function clearHighlight() { hl = null; applyHighlight(); }

  /* ── Pin columns to the front ── */
  function getPins() {
    try { return JSON.parse(read(PIN_KEY) || '[]'); } catch (e) { return []; }
  }

  function applyPins() {
    var pins = getPins();
    document.querySelectorAll('#columns-area .model-col').forEach(function(c) {
      var on = pins.indexOf(c.getAttribute('data-model')) >= 0;
      c.classList.toggle('is-pinned', on);
      var b = c.querySelector('.js-pin');
      if (b) {
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.title = on ? 'Unpin this column' : 'Pin to the first column';
      }
    });
  }

  function togglePin(id) {
    var pins = getPins();
    var i = pins.indexOf(id);
    if (i >= 0) pins.splice(i, 1); else pins.push(id);
    store(PIN_KEY, JSON.stringify(pins));
    applyPins();
  }

  /* ── Copy with confirmation ── */
  function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    return new Promise(function(resolve, reject) {
      var ta = document.createElement('textarea');
      ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) {}
      ta.remove();
      if (ok) resolve(); else reject(new Error('copy blocked'));
    });
  }

  function copyFrom(btn) {
    var target = $(btn.getAttribute('data-target'));
    if (!target) return;
    copyText(target.textContent).then(function() {
      var label = btn.getAttribute('aria-label');
      btn.classList.add('copied');
      btn.innerHTML = TL_ICON('check');
      btn.setAttribute('aria-label', 'Copied');
      btn.title = 'Copied';
      setTimeout(function() {
        btn.classList.remove('copied');
        btn.innerHTML = TL_ICON('copy');
        btn.setAttribute('aria-label', label);
        btn.title = 'Copy response';
      }, 1600);
    }, function() {
      TOAST.warning('The browser blocked clipboard access. Select the text and copy it manually.');
    });
  }

  /* ── Show more / show less ── */
  function toggleMore(btn) {
    var el = $(btn.getAttribute('aria-controls'));
    if (!el) return;
    var open = !el.classList.contains('is-open');
    if (open) {
      el.style.maxHeight = el.scrollHeight + 'px';
      el.classList.add('is-open');
    } else {
      el.style.maxHeight = el.scrollHeight + 'px';
      void el.offsetHeight;
      el.style.maxHeight = '';
      el.classList.remove('is-open');
    }
    btn.textContent = open ? 'Show less' : 'Show more';
    btn.setAttribute('aria-expanded', open ? 'true' : 'false');
  }

  function measureClamps() {
    document.querySelectorAll('#compare-panel .js-clamp').forEach(function(el) {
      var more = el.nextElementSibling;
      if (!more || !more.classList.contains('js-more')) return;
      if (el.classList.contains('is-open')) { more.hidden = false; return; }
      if (!el.offsetParent) return;
      more.hidden = el.scrollHeight <= el.clientHeight + 1;
    });
  }

  /* ── Chart hover and keyboard readout on the context sparkline ── */
  function sparkShow(spark, idx) {
    var vals = (spark.getAttribute('data-values') || '').split(',').filter(Boolean).map(Number);
    if (vals.length < 2) return;
    idx = Math.max(0, Math.min(vals.length - 1, idx));
    spark.setAttribute('data-idx', idx);
    var cursor = spark.querySelector('.spark-cursor');
    if (cursor) { cursor.hidden = false; cursor.style.left = (idx / (vals.length - 1) * 100) + '%'; }
    var read = spark.parentNode.querySelector('.sparkline-read');
    if (read) read.textContent = 'Turn ' + (idx + 1) + ': ' + vals[idx].toLocaleString();
  }

  function sparkReset(spark) {
    var cursor = spark.querySelector('.spark-cursor');
    if (cursor) cursor.hidden = true;
    spark.removeAttribute('data-idx');
    var read = spark.parentNode.querySelector('.sparkline-read');
    if (read) read.textContent = read.getAttribute('data-default') || '';
  }

  /* ── Count-up on totals ── */
  var NUM = /\d[\d,]*(?:\.\d+)?/;

  function splitNum(text) {
    var m = NUM.exec(text);
    if (!m) return null;
    var raw = m[0];
    return {
      pre: text.slice(0, m.index), suf: text.slice(m.index + raw.length), val: parseFloat(raw.replace(/,/g, '')),
      dec: (raw.split('.')[1] || '').length, commas: raw.indexOf(',') >= 0
    };
  }

  function fmtNum(n, v) {
    var s = v.toFixed(n.dec);
    if (n.commas) s = Number(s).toLocaleString('en-US', { minimumFractionDigits: n.dec, maximumFractionDigits: n.dec });
    return n.pre + s + n.suf;
  }

  function countUp(el, fromText, toText) {
    if (reduceMq.matches || fromText === toText) return;
    var a = splitNum(fromText), b = splitNum(toText);
    if (!a || !b || a.pre !== b.pre || a.suf !== b.suf || a.val === b.val) return;
    if (el.__tlRaf) cancelAnimationFrame(el.__tlRaf);
    var t0 = performance.now(), dur = 400;
    function step(now) {
      var t = Math.min(1, (now - t0) / dur);
      var eased = 1 - Math.pow(1 - t, 3);
      var text = t >= 1 ? toText : fmtNum(b, a.val + (b.val - a.val) * eased);
      el.__tlWrote = text;
      el.textContent = text;
      el.__tlRaf = t < 1 ? requestAnimationFrame(step) : 0;
    }
    el.__tlRaf = requestAnimationFrame(step);
  }

  var COUNT_SEL = '.total-item .tv, .stat-card .sv';

  function onCountMutations(records) {
    records.forEach(function(r) {
      var el = r.target;
      if (el.nodeType === 1 && el.matches(COUNT_SEL) && r.removedNodes.length) {
        if (el.__tlWrote === el.textContent) return;
        var prev = r.removedNodes[0].textContent;
        var next = el.textContent;
        el.__tlWrote = next;
        countUp(el, prev, next);
      }
      r.addedNodes.forEach(function(n) {
        if (n.nodeType !== 1) return;
        n.querySelectorAll('.vb-val[data-dim]').forEach(function(v) {
          var dim = v.getAttribute('data-dim'), now = v.textContent, before = lastVerdict[dim];
          lastVerdict[dim] = now;
          if (before) countUp(v, before, now);
        });
      });
    });
  }

  /* ── Arrow-key movement between columns ── */
  function columnsInOrder() {
    var cols = Array.prototype.slice.call(document.querySelectorAll('#columns-area .model-col'));
    return cols.map(function(c, i) { return { c: c, k: (c.classList.contains('is-pinned') ? 0 : 1) * 100 + i }; })
      .sort(function(x, y) { return x.k - y.k; }).map(function(x) { return x.c; });
  }

  function onKeydown(e) {
    if (e.key === 'Escape' && hl) { clearHighlight(); return; }
    var t = e.target;
    if (t.classList && t.classList.contains('spark')) {
      var n = (t.getAttribute('data-values') || '').split(',').filter(Boolean).length;
      var cur = t.hasAttribute('data-idx') ? parseInt(t.getAttribute('data-idx'), 10) : n - 1;
      if (e.key === 'ArrowLeft') { e.preventDefault(); sparkShow(t, cur - 1); }
      else if (e.key === 'ArrowRight') { e.preventDefault(); sparkShow(t, cur + 1); }
      return;
    }
    if (!t.classList || !t.classList.contains('col-name')) return;
    if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].indexOf(e.key) < 0) return;
    var cols = columnsInOrder();
    var i = cols.indexOf(t.closest('.model-col'));
    var next = e.key === 'ArrowLeft' ? i - 1 : e.key === 'ArrowRight' ? i + 1 : e.key === 'Home' ? 0 : cols.length - 1;
    if (next < 0 || next >= cols.length || next === i) return;
    e.preventDefault();
    var target = cols[next].querySelector('.col-name');
    target.focus();
    cols[next].scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: reduceMq.matches ? 'auto' : 'smooth' });
  }

  function onClick(e) {
    var t = e.target.closest && e.target.closest('.js-model, .js-copy, .js-more, .js-pin, .js-remove');
    if (!t) return;
    if (t.classList.contains('js-model')) setHighlight(t.getAttribute('data-hl'));
    else if (t.classList.contains('js-copy')) copyFrom(t);
    else if (t.classList.contains('js-more')) toggleMore(t);
    else if (t.classList.contains('js-pin')) togglePin(t.getAttribute('data-model-id'));
    else if (t.classList.contains('js-remove')) {
      var id = t.getAttribute('data-model-id');
      if (hl === id) hl = null;
      APP.toggleModel(id);
    }
  }

  function onPointerMove(e) {
    var s = e.target.closest && e.target.closest('.spark');
    if (!s) return;
    var vals = (s.getAttribute('data-values') || '').split(',').filter(Boolean);
    if (vals.length < 2) return;
    var r = s.getBoundingClientRect();
    sparkShow(s, Math.round((e.clientX - r.left) / r.width * (vals.length - 1)));
  }

  function onPointerOut(e) {
    var s = e.target.closest && e.target.closest('.spark');
    if (s && !s.contains(e.relatedTarget) && document.activeElement !== s) sparkReset(s);
  }

  function onFocusIn(e) {
    if (e.target.classList && e.target.classList.contains('spark')) {
      var n = (e.target.getAttribute('data-values') || '').split(',').filter(Boolean).length;
      if (n > 1) sparkShow(e.target, n - 1);
    }
  }

  function onFocusOut(e) {
    if (e.target.classList && e.target.classList.contains('spark')) sparkReset(e.target);
  }

  function init() {
    var p = $('compare-panel');
    if (!p) return;
    document.addEventListener('click', onClick);
    document.addEventListener('keydown', onKeydown);
    document.addEventListener('transitionend', function(e) {
      var el = e.target;
      if (e.propertyName === 'max-height' && el.classList && el.classList.contains('js-clamp') && el.classList.contains('is-open')) el.style.maxHeight = 'none';
    });
    p.addEventListener('pointermove', onPointerMove);
    p.addEventListener('pointerout', onPointerOut);
    p.addEventListener('focusin', onFocusIn);
    p.addEventListener('focusout', onFocusOut);

    var raf = 0;
    function refresh() {
      raf = 0;
      applyPins();
      applyHighlight();
      measureClamps();
    }
    new MutationObserver(function(records) {
      var structural = records.some(function(r) {
        return Array.prototype.some.call(r.addedNodes, function(n) { return n.nodeType === 1; })
          || Array.prototype.some.call(r.removedNodes, function(n) { return n.nodeType === 1; });
      });
      if (structural && !raf) raf = requestAnimationFrame(refresh);
    }).observe(p, { childList: true, subtree: true });

    if (window.ResizeObserver) {
      var ro = new ResizeObserver(function() { if (!raf) raf = requestAnimationFrame(refresh); });
      ['columns-area', 'op-cards', 'matrix-area'].forEach(function(id) { var el = $(id); if (el) ro.observe(el); });
    }

    var counter = new MutationObserver(onCountMutations);
    ['columns-area', 'verdict-banner', 'sidebar'].forEach(function(id) {
      var el = $(id);
      if (el) counter.observe(el, { childList: true, subtree: true });
    });

    var send = $('send-btn');
    if (send) {
      new MutationObserver(function() {
        document.querySelectorAll('#columns-area .model-col').forEach(function(c) { c.classList.toggle('is-loading', send.disabled); });
      }).observe(send, { attributes: true, attributeFilter: ['disabled'] });
    }

    if (read(VIEW_KEY) === 'matrix' && window.MATRIX) MATRIX.switchView('matrix');
    applyPins();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  return { setHighlight: setHighlight, clearHighlight: clearHighlight };
})();
