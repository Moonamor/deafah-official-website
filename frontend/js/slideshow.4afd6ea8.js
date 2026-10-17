/* Al Deafah — hero slideshow + highlights slider (anjum pattern; MOTION_SPEC rows 1 and 7).
   Hero  [data-slideshow]: opacity crossfade, target fade 1000 ms, interval 7000 ms, GSAP "sine.inOut" (reference
         jQuery "swing"). Autoplay pauses while the hero is off-screen, while the tab is hidden and when the visitor
         presses the pause button (WCAG 2.2.2). Reduced motion: no autoplay, the first slide stays.
   Highlights [data-feature-slider]: image crossfade + text track slide, 300 ms CSS `ease` (reference slick config),
         prev / next buttons, swipe, wraps around (reference `infinite: true`); the track moves in the reading
         direction. Non-current text slides are aria-hidden + inert. Timings live in CSS (site.css §5b). */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = function () { return root.classList.contains("no-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var rtl = function () { return (root.getAttribute("dir") || "rtl") === "rtl"; };
  var AR = "٠١٢٣٤٥٦٧٨٩", arDigits = function (s) { return String(s).replace(/\d/g, function (d) { return AR[+d]; }); };

  /* ---------------- hero ---------------- */
  function Hero(el) {
    var slides = Array.prototype.slice.call(el.querySelectorAll(".hero-slide"));
    var btn = (el.closest("section") || document).querySelector("[data-slideshow-toggle]");
    var interval = +el.getAttribute("data-interval") || 7000, fade = (+el.getAttribute("data-fade") || 1000) / 1000;
    var i = 0, timer = null, paused = false, visible = true;
    if (slides.length < 2) { if (btn) btn.hidden = true; return; }
    if (reduce()) { if (btn) btn.hidden = true; return; }

    /* deferred slides (data-src / data-srcset): each one is attached just in time, 2.5 s before its turn, so the hidden
       slides never compete with the first (LCP) photo */
    var preloadTimer = null;
    function attach(s) { if (s.hasAttribute("data-srcset")) { s.setAttribute("srcset", s.getAttribute("data-srcset")); s.removeAttribute("data-srcset"); } if (s.hasAttribute("data-src")) { s.setAttribute("src", s.getAttribute("data-src")); s.removeAttribute("data-src"); } }
    function ready(img) {
      attach(img); return img.complete && img.naturalWidth ? Promise.resolve() : new Promise(function (r) { img.addEventListener("load", r, { once: true }); img.addEventListener("error", r, { once: true }); }); }
    function show(n) {
      var cur = slides[i], nxt = slides[n];
      ready(nxt).then(function () {
        if (window.gsap) {
          window.gsap.to(nxt, { opacity: 1, duration: fade, ease: "sine.inOut", overwrite: true });
          window.gsap.to(cur, { opacity: 0, duration: fade, ease: "sine.inOut", overwrite: true });
        } else { nxt.style.opacity = "1"; cur.style.opacity = "0"; }
        cur.classList.remove("is-current"); nxt.classList.add("is-current");
        i = n;
        schedule();
      });
    }
    function schedule() {
      clearTimeout(timer); clearTimeout(preloadTimer);
      if (!paused && visible && !document.hidden) {
        timer = setTimeout(function () { show((i + 1) % slides.length); }, interval);
        preloadTimer = setTimeout(function () { attach(slides[(i + 1) % slides.length]); }, Math.max(0, interval - 2500));
      }
    }
    function setPaused(p) {
      paused = p;
      if (btn) { btn.setAttribute("aria-pressed", p ? "true" : "false"); btn.setAttribute("aria-label", btn.getAttribute(p ? "data-label-play" : "data-label-pause")); btn.classList.toggle("is-paused", p); }
      if (p) clearTimeout(timer); else schedule();
    }
    if (btn) btn.addEventListener("click", function () { setPaused(!paused); });
    document.addEventListener("visibilitychange", schedule);
    if ("IntersectionObserver" in window) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; schedule(); }).observe(el);
    slides.forEach(function (s, k) { s.style.opacity = k === 0 ? "1" : "0"; });
    schedule();
  }

  /* ---------------- highlights ---------------- */
  function Feature(el) {
    var items = Array.prototype.slice.call(el.querySelectorAll(".hl__item"));
    var imgs = Array.prototype.slice.call(el.querySelectorAll(".hl__img"));
    var track = el.querySelector(".hl__track"), count = el.querySelector("[data-slide-count]");
    var n = items.length, i = 0;
    if (!n) return;
    /* images 2..n (data-src / data-srcset) are attached when the slider comes within 300 px of the viewport, or on the
       first move — they are hidden until then and must not load with the page */
    function hydrate() { imgs.forEach(function (s) { if (s.hasAttribute("data-srcset")) { s.setAttribute("srcset", s.getAttribute("data-srcset")); s.removeAttribute("data-srcset"); } if (s.hasAttribute("data-src")) { s.setAttribute("src", s.getAttribute("data-src")); s.removeAttribute("data-src"); } }); }
    if ("IntersectionObserver" in window) { var hio = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { hydrate(); hio.disconnect(); } }, { rootMargin: "300px 0px" }); hio.observe(el); } else hydrate();
    function paint() {
      track.style.transform = "translateX(" + (i * 100 * (rtl() ? 1 : -1)) + "%)";
      items.forEach(function (it, k) { var on = k === i; it.setAttribute("aria-hidden", on ? "false" : "true"); if (on) it.removeAttribute("inert"); else it.setAttribute("inert", ""); });
      imgs.forEach(function (im, k) { im.classList.toggle("is-current", k === i); });
      if (count) count.innerHTML = '<span class="lang-ar">' + arDigits((i + 1) + " / " + n) + '</span><span class="lang-en">' + (i + 1) + " / " + n + "</span>";
    }
    function go(d) { hydrate(); i = (i + d + n) % n; paint(); }
    el.querySelector("[data-slide-prev]").addEventListener("click", function () { go(-1); });
    el.querySelector("[data-slide-next]").addEventListener("click", function () { go(1); });
    var x0 = null;
    el.addEventListener("pointerdown", function (e) { if (e.pointerType !== "mouse") x0 = e.clientX; });
    el.addEventListener("pointerup", function (e) {
      if (x0 === null) return; var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) < 40) return;
      go((dx < 0) !== rtl() ? 1 : -1);   /* swipe toward the reading direction's start = next */
    });
    document.addEventListener("deafah:langchange", paint);
    el.classList.add("is-ready");
    paint();
  }

  function init() {
    document.querySelectorAll("[data-slideshow]").forEach(function (el) { if (!el.__s) el.__s = new Hero(el); });
    document.querySelectorAll("[data-feature-slider]").forEach(function (el) { if (!el.__s) el.__s = new Feature(el); });
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
