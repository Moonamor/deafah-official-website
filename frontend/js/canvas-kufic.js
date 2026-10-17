/* Al Deafah — Kufic canvas (Phase 4). <canvas data-kufic-canvas data-block="56" data-gap="8" [data-opacity=".25|.40"]>
   Draws the brand 2×2 block (assets/brand/pattern/kufic-2x2.svg, geometry loaded unchanged) as a grid of WHOLE blocks,
   ≥ 24 px from every edge (the drift budget of ±8 px is added to that inset, so a block can never reach the edge),
   ink = --pattern-ink from the computed style, alpha capped at 0.25 on surfaces / 0.40 on dark panels.
   Subtle drift with pointer and scroll; paused when off-screen (IntersectionObserver); ≤ 60 fps; DPR-aware (≤ 2).
   Reduced motion: one static frame. window.DeafahKuficCanvas.stats() reports the draw-time budget. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("no-motion");
  var SRC = (document.currentScript && document.currentScript.getAttribute("data-src")) || "assets/brand/pattern/kufic-2x2.svg";
  var INSET = 24, DRIFT = 8, MAX_ALPHA_SURFACE = 1, MAX_ALPHA_PANEL = 1;   /* owner override 2 (2026-10-17): patterns at full strength */
  var paths = null, unit = 81.553;
  var instances = [];
  var stats = { frames: 0, totalMs: 0, maxMs: 0, last: [] };

  function loadPaths() {
    return fetch(SRC).then(function (r) { return r.text(); }).then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, "image/svg+xml");
      var vb = (doc.documentElement.getAttribute("viewBox") || "0 0 81.553 81.553").split(/\s+/);
      unit = parseFloat(vb[2]) || 81.553;
      paths = Array.prototype.map.call(doc.querySelectorAll("path"), function (p) { return new Path2D(p.getAttribute("d")); });
      return true;
    }).catch(function () { return false; });
  }

  function create(canvas) {
    var ctx = canvas.getContext("2d", { alpha: true });
    var st = { canvas: canvas, ctx: ctx, w: 0, h: 0, dpr: 1, cols: 0, rows: 0, block: parseFloat(canvas.getAttribute("data-block")) || 56, gap: 0,
      px: 0, py: 0, tx: 0, ty: 0, sx: 0, visible: true, lastFrame: 0, ink: "", alpha: 0.25, dirty: true, raf: 0 };
    st.gap = parseFloat(canvas.getAttribute("data-gap")) || Math.round(st.block * 0.14);
    var inPanel = !!canvas.closest(".panel");
    var cap = inPanel ? MAX_ALPHA_PANEL : MAX_ALPHA_SURFACE;
    var wanted = parseFloat(canvas.getAttribute("data-opacity"));
    st.alpha = Math.min(cap, isNaN(wanted) ? cap : wanted);

    function readTheme() {
      var cs = getComputedStyle(canvas);
      st.ink = (cs.getPropertyValue("--pattern-ink") || "").trim() || cs.color; /* token only; the element colour is the fallback */
      st.dirty = true;
    }
    function resize() {
      var r = canvas.getBoundingClientRect();
      st.dpr = Math.min(window.devicePixelRatio || 1, 2);
      st.w = Math.max(1, Math.round(r.width)); st.h = Math.max(1, Math.round(r.height));
      canvas.width = Math.round(st.w * st.dpr); canvas.height = Math.round(st.h * st.dpr);
      var margin = INSET + DRIFT;
      var pitch = st.block + st.gap;
      st.cols = Math.max(0, Math.floor((st.w - margin * 2 + st.gap) / pitch));
      st.rows = Math.max(0, Math.floor((st.h - margin * 2 + st.gap) / pitch));
      st.ox = (st.w - (st.cols * pitch - st.gap)) / 2; /* centred grid → inset ≥ margin on both sides */
      st.oy = (st.h - (st.rows * pitch - st.gap)) / 2;
      st.dirty = true;
    }
    function draw(now) {
      var t0 = performance.now();
      var c = st.ctx;
      c.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
      c.clearRect(0, 0, st.w, st.h);
      c.globalAlpha = st.alpha;
      c.fillStyle = st.ink;
      var s = st.block / unit, pitch = st.block + st.gap;
      var dx = Math.max(-DRIFT, Math.min(DRIFT, st.tx)), dy = Math.max(-DRIFT, Math.min(DRIFT, st.ty));
      for (var r = 0; r < st.rows; r++) for (var k = 0; k < st.cols; k++) {
        c.setTransform(st.dpr * s, 0, 0, st.dpr * s, st.dpr * (st.ox + k * pitch + dx), st.dpr * (st.oy + r * pitch + dy));
        for (var i = 0; i < paths.length; i++) c.fill(paths[i]);
      }
      c.setTransform(1, 0, 0, 1, 0, 0);
      var ms = performance.now() - t0;
      stats.frames++; stats.totalMs += ms; if (ms > stats.maxMs) stats.maxMs = ms; stats.last.push(ms); if (stats.last.length > 120) stats.last.shift();
      st.dirty = false;
    }
    function tick(now) {
      st.raf = 0;
      if (!st.visible) return;
      if (now - st.lastFrame < 16) { st.raf = requestAnimationFrame(tick); return; } /* ≤ 60 fps */
      st.lastFrame = now;
      /* ease the drift toward its target */
      var gx = st.px + st.sx, gy = st.py;
      var nx = st.tx + (gx - st.tx) * 0.08, ny = st.ty + (gy - st.ty) * 0.08;
      if (Math.abs(nx - st.tx) > 0.05 || Math.abs(ny - st.ty) > 0.05 || st.dirty) { st.tx = nx; st.ty = ny; draw(now); }
      if (!reduce) st.raf = requestAnimationFrame(tick);
    }
    function schedule() { if (!st.raf && st.visible) st.raf = requestAnimationFrame(tick); }

    readTheme(); resize(); draw(performance.now());
    if (reduce) {
      /* static: redraw only on resize / theme change */
      new ResizeObserver(function () { resize(); draw(performance.now()); }).observe(canvas);
      document.addEventListener("deafah:themechange", function () { readTheme(); draw(performance.now()); });
      return st;
    }
    new ResizeObserver(function () { resize(); schedule(); }).observe(canvas);
    document.addEventListener("deafah:themechange", function () { readTheme(); schedule(); });
    var io = new IntersectionObserver(function (es) { es.forEach(function (e) { st.visible = e.isIntersecting; if (st.visible) schedule(); }); }, { threshold: 0 });
    io.observe(canvas);
    window.addEventListener("pointermove", function (e) {
      st.px = (e.clientX / window.innerWidth - 0.5) * 2 * DRIFT * 0.75;
      st.py = (e.clientY / window.innerHeight - 0.5) * 2 * DRIFT * 0.75;
      schedule();
    }, { passive: true });
    window.addEventListener("scroll", function () {
      var r = canvas.getBoundingClientRect();
      var centre = (r.top + r.height / 2 - window.innerHeight / 2) / window.innerHeight; /* −1 … 1 */
      st.sx = Math.max(-1, Math.min(1, centre)) * DRIFT * 0.5;
      schedule();
    }, { passive: true });
    schedule();
    return st;
  }

  function init() {
    var canvases = document.querySelectorAll("canvas[data-kufic-canvas]");
    if (!canvases.length) return;
    loadPaths().then(function (ok) { if (!ok) return; canvases.forEach(function (c) { instances.push(create(c)); }); });
  }
  window.DeafahKuficCanvas = {
    instances: instances,
    stats: function () {
      var last = stats.last, n = last.length || 1, sum = last.reduce(function (a, b) { return a + b; }, 0);
      var sorted = last.slice().sort(function (a, b) { return a - b; });
      return { frames: stats.frames, avgMs: +(stats.totalMs / Math.max(1, stats.frames)).toFixed(2), recentAvgMs: +(sum / n).toFixed(2), p95Ms: +(sorted[Math.floor(sorted.length * 0.95)] || 0).toFixed(2), maxMs: +stats.maxMs.toFixed(2), blocks: instances.map(function (i) { return i.cols + "x" + i.rows; }), dpr: instances[0] ? instances[0].dpr : null };
    }
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
