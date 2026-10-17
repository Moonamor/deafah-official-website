/* Al Deafah — hotels carousel + filters (anjum pattern, MOTION_SPEC rows 11 and 12).
   Markup: tools/build-sections.mjs ("hotel-filters"); cards: js/hotels.js (data-stars, data-walk on each .hotel-card).
   - Centred carousel: native horizontal scroll with scroll-snap (swipe / trackpad / keyboard); the prev / next buttons
     tween the scroll position over 500 ms with the reference easing (CSS `ease` = cubic-bezier(.25,.1,.25,1)).
   - "Next" follows the reading direction: DOM order, which runs right → left in RTL.
   - Non-current cards scale to .94 and their photo is quieted (CSS); the text keeps full contrast.
   - Live result count ("٤ فنادق", aria-live polite), progress dots (decorative, click to jump), empty state with a reset.
   - Filters: two ARIA tablists (rating, walking time) combine with AND; switching fades the set out and in with the
     200 ms brand token. Reduced motion: instant jumps, no fades. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = function () { return root.classList.contains("no-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var rtl = function () { return (root.getAttribute("dir") || "rtl") === "rtl"; };
  var isAr = function () { return root.getAttribute("data-lang") !== "en"; };
  var AR = "٠١٢٣٤٥٦٧٨٩", arDigits = function (s) { return String(s).replace(/\d/g, function (d) { return AR[+d]; }); };
  var SLIDE_MS = 500, FADE_MS = 200;

  /* CSS `ease` as a JS easing function (cubic-bezier .25,.1,.25,1), so GSAP reproduces the reference curve exactly */
  function bezier(x1, y1, x2, y2) {
    return function (x) {
      var lo = 0, hi = 1, t = x;
      for (var i = 0; i < 30; i++) { t = (lo + hi) / 2; var bx = 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t; if (bx < x) lo = t; else hi = t; }
      return 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
    };
  }
  var cssEase = bezier(0.25, 0.1, 0.25, 1);

  function Carousel(el) {
    var vp = el.querySelector("[data-track]"), prev = el.querySelector("[data-carousel-prev]"), next = el.querySelector("[data-carousel-next]");
    var status = el.querySelector("[data-carousel-status]"), empty = el.querySelector("[data-carousel-empty]");
    var dotsEl = el.querySelector("[data-carousel-dots]"), reset = el.querySelector("[data-carousel-reset]");
    var countEl = (el.closest("section") || document).querySelector("[data-carousel-count-text]");
    var section = el.closest("section") || document;
    var tablists = Array.prototype.slice.call(section.querySelectorAll("[data-filter-group]"));
    var current = 0, tween = null, scrollTimer = null;
    var filters = {};

    function cards() { return Array.prototype.slice.call(vp.querySelectorAll(".hotel-card")).filter(function (c) { return !c.hidden; }); }

    function nearest() {
      var list = cards(), r = vp.getBoundingClientRect(), mid = r.left + r.width / 2, best = 0, bestD = Infinity;
      list.forEach(function (c, i) { var b = c.getBoundingClientRect(), d = Math.abs(b.left + b.width / 2 - mid); if (d < bestD) { bestD = d; best = i; } });
      return best;
    }

    function paint() {
      var list = cards(), n = list.length;
      vp.querySelectorAll(".hotel-card").forEach(function (c) { c.classList.remove("is-current"); });
      if (list[current]) list[current].classList.add("is-current");
      if (status) status.innerHTML = n ? '<span class="lang-ar">' + arDigits((current + 1) + " / " + n) + '</span><span class="lang-en">' + (current + 1) + " / " + n + "</span>" : "";
      if (dotsEl) {
        if (dotsEl.children.length !== n) { dotsEl.innerHTML = ""; for (var k = 0; k < n; k++) { var d = document.createElement("span"); d.className = "hcar__dot"; d.setAttribute("data-i", String(k)); dotsEl.appendChild(d); } }
        Array.prototype.forEach.call(dotsEl.children, function (d, k) { d.classList.toggle("is-current", k === current); });
      }
      if (prev) prev.disabled = current <= 0;
      if (next) next.disabled = current >= n - 1;
    }

    function offsetFor(card) {
      var r = vp.getBoundingClientRect(), b = card.getBoundingClientRect();
      return vp.scrollLeft + (b.left + b.width / 2) - (r.left + r.width / 2);   /* same sign rule in LTR and RTL */
    }

    function goTo(i, animate) {
      var list = cards(); if (!list.length) return;
      current = Math.max(0, Math.min(list.length - 1, i));
      var target = offsetFor(list[current]);
      if (tween) { tween.kill(); tween = null; }
      if (!animate || reduce() || !window.gsap) { vp.classList.add("is-animating"); vp.scrollLeft = target; vp.classList.remove("is-animating"); paint(); return; }
      var state = { v: vp.scrollLeft };
      vp.classList.add("is-animating");   /* scroll-snap off while tweening, otherwise snapping fights the tween */
      tween = window.gsap.to(state, { v: target, duration: SLIDE_MS / 1000, ease: cssEase, onUpdate: function () { vp.scrollLeft = state.v; },
        onComplete: function () { vp.classList.remove("is-animating"); tween = null; } });
      paint();
    }

    vp.addEventListener("scroll", function () {
      if (tween) return;
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(function () { var i = nearest(); if (i !== current) { current = i; paint(); } }, 90);
    }, { passive: true });

    if (prev) prev.addEventListener("click", function () { goTo(current - 1, true); });
    if (next) next.addEventListener("click", function () { goTo(current + 1, true); });
    vp.addEventListener("keydown", function (e) {
      var fwd = rtl() ? "ArrowLeft" : "ArrowRight", back = rtl() ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd) { e.preventDefault(); goTo(current + 1, true); }
      else if (e.key === back) { e.preventDefault(); goTo(current - 1, true); }
      else if (e.key === "Home") { e.preventDefault(); goTo(0, true); }
      else if (e.key === "End") { e.preventDefault(); goTo(cards().length - 1, true); }
    });

    /* ---- filters ---- */
    function matches(card) {
      return tablists.every(function (tl) {
        var group = tl.getAttribute("data-filter-group"), tab = filters[group];
        if (!tab || tab.getAttribute("data-filter") === "all") return true;
        if (group === "rating") return card.getAttribute("data-stars") === tab.getAttribute("data-stars");
        var w = +card.getAttribute("data-walk"), min = +(tab.getAttribute("data-min") || 0), max = tab.getAttribute("data-max");
        return w >= min && (max === "" || max === null || w <= +max);
      });
    }
    function applyFilters() {
      var swap = function () {
        var all = vp.querySelectorAll(".hotel-card"), shown = 0;
        all.forEach(function (c) { var ok = matches(c); c.hidden = !ok; if (ok) shown++; });
        if (empty) empty.hidden = shown > 0;
        el.classList.toggle("is-empty", shown === 0);
        count(shown);
        goTo(0, false);
      };
      if (reduce()) { swap(); return; }
      vp.style.transition = "opacity " + FADE_MS + "ms var(--ease-brand)";
      vp.style.opacity = "0";
      setTimeout(function () { swap(); vp.style.opacity = "1"; }, FADE_MS);
    }
    tablists.forEach(function (tl) {
      var tabs = Array.prototype.slice.call(tl.querySelectorAll("[role=tab]"));
      filters[tl.getAttribute("data-filter-group")] = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0];
      function select(tab, focus) {
        if (filters[tl.getAttribute("data-filter-group")] === tab) return;
        tabs.forEach(function (t) { var on = t === tab; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; t.classList.toggle("is-active", on); });
        if (focus) tab.focus();
        filters[tl.getAttribute("data-filter-group")] = tab;
        applyFilters();
      }
      tl.addEventListener("click", function (e) { var t = e.target.closest("[role=tab]"); if (t) select(t, false); });
      tl.addEventListener("keydown", function (e) {
        var i = tabs.indexOf(document.activeElement); if (i < 0) return;
        var d = 0, fwd = rtl() ? "ArrowLeft" : "ArrowRight", back = rtl() ? "ArrowRight" : "ArrowLeft";
        if (e.key === fwd) d = 1; else if (e.key === back) d = -1;
        else if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); return; }
        else if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); return; }
        else return;
        e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true);
      });
    });

    function count(n) {
      if (!countEl) return;
      var arWord = n === 0 ? "لا فنادق" : n === 1 ? "فندق واحد" : n === 2 ? "فندقان" : n <= 10 ? arDigits(n) + " فنادق" : arDigits(n) + " فندقًا";
      countEl.innerHTML = '<span class="lang-ar">' + arWord + '</span><span class="lang-en">' + n + (n === 1 ? " hotel" : " hotels") + "</span>";
    }
    if (dotsEl) dotsEl.addEventListener("click", function (e) { var d = e.target.closest(".hcar__dot"); if (d) goTo(+d.getAttribute("data-i"), true); });
    if (reset) reset.addEventListener("click", function () {
      tablists.forEach(function (tl) {
        var tabs = tl.querySelectorAll("[role=tab]");
        tabs.forEach(function (t, k) { var on = k === 0; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; t.classList.toggle("is-active", on); });
        filters[tl.getAttribute("data-filter-group")] = tabs[0];
      });
      applyFilters();
      var first = tablists[0] && tablists[0].querySelector("[role=tab]"); if (first) first.focus();
    });
    count(cards().length);
    function recentre() { goTo(current, false); }
    document.addEventListener("deafah:langchange", function () { setTimeout(recentre, 80); });   /* direction flipped */
    window.addEventListener("resize", function () { clearTimeout(scrollTimer); scrollTimer = setTimeout(recentre, 120); });
    el.classList.add("is-ready");
    goTo(0, false);
  }

  function init() {
    document.querySelectorAll("[data-carousel]").forEach(function (el) {
      if (el.__carousel || !el.querySelector(".hotel-card")) return;
      el.__carousel = new Carousel(el);
    });
  }
  document.addEventListener("deafah:hotels", function () { setTimeout(init, 0); });
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
