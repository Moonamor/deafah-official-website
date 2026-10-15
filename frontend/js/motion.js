/* Al Deafah — motion system (Phase 4). Lenis + GSAP ScrollTrigger (+ SplitText), data-attribute driven, no per-page JS.
   Motion scale [مقترح, BRAND_GAPS G11]: micro 200 ms · reveals 600–900 ms power3.out · scrubbed scenes scrub 0.6–1.
   Reduced motion (prefers-reduced-motion or html.no-motion): Lenis is not started, every scrubbed scene is static,
   reveals are instant, the horizontal roster stays a grid.
   Direction: anything that moves horizontally multiplies by DIR (ltr = 1, rtl = −1) and is rebuilt on language change.

   Recipes (section attribute → behaviour)
     data-scene="hero-pin"      pinned hero; [data-layer][data-depth] layers move at different rates; [data-split] headline lines lift in
     data-scene="layers"        cards interleave (staggered lift while scrolling) and images reveal through a clip-path mask
     data-scene="horizontal"    pinned horizontal gallery of [data-track] children (≥ 1024 px), mirrored in RTL
     data-scene="counter"       [data-count-to] count-ups (effects.js draws the digits, Arabic-Indic in Arabic)
     data-scene="sticky-media"  sticky [data-sticky-media] + [data-step] text steps; the active step is highlighted,
                                optional [data-media-for="<step index>"] media swap
     .reveal                    entrance reveal (IntersectionObserver contract from Phase 1) */
(function () {
  "use strict";
  var root = document.documentElement;
  var gsap = window.gsap, ST = window.ScrollTrigger, SplitText = window.SplitText, Lenis = window.Lenis;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("no-motion");
  var DIR = function () { return (root.getAttribute("dir") || "rtl") === "rtl" ? -1 : 1; };
  var headerH = function () { var h = document.getElementById("siteHeader"); return h ? h.getBoundingClientRect().height : 0; };
  var scenes = [];      /* { kill() } per built scene */
  var lenis = null;

  /* ------------------------------------------------------------------ reveals (works without GSAP too) */
  var revealIO = null;
  function initReveals() {
    /* incremental: pages that render content later (hotel/catering mock data) call rebuild(), which re-runs this and observes only the new elements */
    var els = Array.prototype.slice.call(document.querySelectorAll(".reveal:not([data-reveal-bound])"));
    if (!els.length) return;
    els.forEach(function (el) { el.setAttribute("data-reveal-bound", "1"); });
    function show(el, i) {
      if (el.classList.contains("is-in")) return;
      el.classList.add("is-in");
      if (reduce || !gsap) return;
      gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, delay: Math.min(i, 6) * 0.08, ease: "power3.out", overwrite: true, clearProps: "transform" });
    }
    if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-in"); }); return; }
    if (!revealIO) revealIO = new IntersectionObserver(function (entries) {
      var batch = entries.filter(function (e) { return e.isIntersecting; }).map(function (e) { revealIO.unobserve(e.target); return e.target; });
      batch.forEach(show);
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
    els.forEach(function (el) { revealIO.observe(el); });
    setTimeout(function () { els.forEach(function (el) { if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < window.innerHeight) show(el, 0); }); }, 4000);   /* safety net */
  }

  /* ------------------------------------------------------------------ Lenis ↔ ScrollTrigger bridge */
  function initLenis() {
    if (reduce || !Lenis || !gsap || !ST) return;
    lenis = new Lenis({ autoRaf: false, lerp: 0.1, smoothWheel: true, syncTouch: false });
    lenis.on("scroll", ST.update);                       /* Lenis drives the scroll position → ScrollTrigger reads it */
    gsap.ticker.add(function (time) { lenis.raf(time * 1000); });  /* one clock: gsap.ticker calls lenis.raf */
    gsap.ticker.lagSmoothing(0);
    window.lenis = lenis; /* Lenis manages html.lenis / .lenis-scrolling classes itself */
  }

  /* ------------------------------------------------------------------ helpers */
  function visibleLang(el) { return el.querySelector(':scope > .lang-' + (root.getAttribute("data-lang") === "en" ? "en" : "ar")) || el; }
  function splitLines(el) {
    if (!SplitText) return null;
    var target = visibleLang(el);
    try { return SplitText.create(target, { type: "lines", mask: "lines", linesClass: "split-line" }); } catch (e) { return null; }
  }
  function tracked(scene) { scenes.push(scene); return scene; }

  /* ------------------------------------------------------------------ hero-pin */
  function buildHeroPin(section) {
    var head = section.querySelector("[data-split]");
    var split = null;
    if (head && !reduce && gsap) {
      /* split after the web font is in, otherwise the fallback font's line breaks are frozen into the split */
      var ready = document.fonts && document.fonts.status !== "loaded" ? document.fonts.ready : Promise.resolve();
      gsap.set(head, { opacity: 0 });
      ready.then(function () {
        split = splitLines(head);
        gsap.set(head, { opacity: 1 });
        if (split && split.lines.length) gsap.from(split.lines, { yPercent: 110, opacity: 0, duration: 0.9, stagger: 0.09, ease: "power3.out" });
      });
    }
    if (reduce || !gsap || !ST) return tracked({ kill: function () { if (split) split.revert(); } });
    var layers = Array.prototype.slice.call(section.querySelectorAll("[data-layer]"));
    var tl = gsap.timeline({ scrollTrigger: { trigger: section, start: function () { return "top " + headerH() + "px"; }, end: "+=60%", pin: true, pinSpacing: true, scrub: 0.8, invalidateOnRefresh: true } });
    layers.forEach(function (layer) {
      var depth = parseFloat(layer.getAttribute("data-depth")) || 0.5;
      var kind = layer.getAttribute("data-layer");
      if (kind === "photo") tl.to(layer, { yPercent: 10 * depth * 2, scale: 1.04, ease: "none" }, 0);
      else if (kind === "veil") tl.to(layer, { opacity: 1, ease: "none" }, 0);
      else tl.to(layer, { y: -140 * depth, opacity: kind === "cta" || kind === "copy" ? 0 : 1, ease: "none" }, 0);
    });
    return tracked({ kill: function () { tl.scrollTrigger && tl.scrollTrigger.kill(true); tl.kill(); if (split) split.revert(); } });
  }

  /* ------------------------------------------------------------------ layers */
  function buildLayers(section) {
    var cards = Array.prototype.slice.call(section.querySelectorAll("[data-layer-card], .card")).filter(function (c) { return !c.closest("[data-track]"); });
    var imgs = Array.prototype.slice.call(section.querySelectorAll(".hotel-media img, [data-mask] img, img[data-mask]"));
    if (reduce || !gsap || !ST) { imgs.forEach(function (i) { i.style.clipPath = "none"; }); return tracked({ kill: function () {} }); }
    var kills = [];
    cards.forEach(function (card, i) {
      var tw = gsap.fromTo(card, { y: 48 + (i % 4) * 16 }, { y: 0, ease: "none", scrollTrigger: { trigger: card, start: "top 95%", end: "top 45%", scrub: 0.6 } });
      kills.push(tw);
    });
    imgs.forEach(function (img) {
      var tw = gsap.fromTo(img, { clipPath: "inset(0 0 100% 0)" }, { clipPath: "inset(0 0 0% 0)", duration: 0.9, ease: "power3.out", scrollTrigger: { trigger: img, start: "top 90%", once: true } });
      kills.push(tw);
    });
    return tracked({ kill: function () { kills.forEach(function (t) { t.scrollTrigger && t.scrollTrigger.kill(true); t.kill(); }); } });
  }

  /* ------------------------------------------------------------------ horizontal */
  function buildHorizontal(section) {
    var track = section.querySelector("[data-track]");
    if (!track) return null;
    var wide = window.matchMedia("(min-width: 1024px)").matches;
    if (reduce || !gsap || !ST || !wide || track.children.length < 2) { section.classList.remove("is-horizontal"); return tracked({ kill: function () {} }); }
    section.classList.add("is-horizontal");
    var dir = DIR();
    /* the track is as wide as its content (max-content), so the visible width is its parent's content box */
    var distance = function () {
      var parent = track.parentElement, cs = getComputedStyle(parent);
      var visible = parent.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
      return Math.max(0, Math.round(track.scrollWidth - visible));
    };
    var imgs = Array.prototype.slice.call(track.querySelectorAll(".hotel-media img"));
    imgs.forEach(function (img) { img.loading = "eager"; });          /* lazy images off to the side would never load inside a pinned track */
    var cards = Array.prototype.slice.call(track.children);
    var revealed = [];
    /* image reveals follow the gallery's own progress (works in both directions; containerAnimation triggers assume LTR) */
    function thresholds() {
      var d = distance(), visibleW = track.parentElement.clientWidth, out = [];
      cards.forEach(function (card) {
        var offset = dir === -1 ? track.scrollWidth - (card.offsetLeft + card.offsetWidth) : card.offsetLeft; /* distance from the inline-start edge */
        out.push(d > 0 ? Math.max(0, (offset + card.offsetWidth * 0.35 - visibleW) / d) : 0);
      });
      return out;
    }
    var th = thresholds();
    imgs.forEach(function (img) { gsap.set(img, { clipPath: "inset(0 0 100% 0)" }); });
    function reveal(p) {
      cards.forEach(function (card, i) {
        if (revealed[i] || p < th[i]) return;
        revealed[i] = true;
        var img = card.querySelector(".hotel-media img");
        if (img) gsap.to(img, { clipPath: "inset(0 0 0% 0)", duration: 0.9, ease: "power3.out" });
      });
    }
    var tw = gsap.to(track, {
      x: function () { return -distance() * dir; },
      ease: "none",
      scrollTrigger: { trigger: section, start: function () { return "top " + headerH() + "px"; }, end: function () { return "+=" + distance(); }, pin: true, scrub: 1, invalidateOnRefresh: true, anticipatePin: 1,
        onRefresh: function () { th = thresholds(); }, onUpdate: function (st) { reveal(st.progress); } }
    });
    reveal(0);
    section.setAttribute("data-horizontal-dir", dir === 1 ? "ltr" : "rtl");
    return tracked({ kill: function () { tw.scrollTrigger && tw.scrollTrigger.kill(true); tw.kill(); gsap.set(track, { clearProps: "transform" }); imgs.forEach(function (i) { i.style.clipPath = ""; }); section.classList.remove("is-horizontal"); } });
  }

  /* ------------------------------------------------------------------ sticky-media */
  function buildStickyMedia(section) {
    var steps = Array.prototype.slice.call(section.querySelectorAll("[data-step]"));
    var media = Array.prototype.slice.call(section.querySelectorAll("[data-media-for]"));
    function activate(i) {
      steps.forEach(function (s, j) { s.classList.toggle("is-active", j === i); });
      media.forEach(function (m) { m.classList.toggle("is-active", parseInt(m.getAttribute("data-media-for"), 10) === i); });
    }
    if (!steps.length) return null;
    if (reduce || !ST) { steps.forEach(function (s) { s.classList.add("is-active"); }); if (media[0]) media[0].classList.add("is-active"); return tracked({ kill: function () {} }); }
    var triggers = steps.map(function (s, i) { return ST.create({ trigger: s, start: "top 60%", end: "bottom 40%", onEnter: function () { activate(i); }, onEnterBack: function () { activate(i); } }); });
    activate(0);
    return tracked({ kill: function () { triggers.forEach(function (t) { t.kill(); }); } });
  }

  /* ------------------------------------------------------------------ header hide / show is in main.js (scroll direction) */

  /* ------------------------------------------------------------------ build / rebuild */
  function build() {
    initReveals();                                   /* observe .reveal elements added since the last build */
    document.querySelectorAll("[data-scene]").forEach(function (section) {
      switch (section.getAttribute("data-scene")) {
        case "hero-pin": buildHeroPin(section); break;
        case "layers": buildLayers(section); break;
        case "horizontal": buildHorizontal(section); break;
        case "sticky-media": buildStickyMedia(section); break;
        case "counter": break; /* effects.js */
      }
    });
    if (ST) ST.refresh();
  }
  function teardown() { scenes.splice(0).forEach(function (s) { try { s.kill(); } catch (e) {} }); }
  function rebuild() { teardown(); build(); }

  function init() {
    if (gsap && ST) gsap.registerPlugin(ST);
    if (gsap && SplitText) gsap.registerPlugin(SplitText);
    initReveals();
    initLenis();
    build();
    document.addEventListener("deafah:hotels", function () { setTimeout(rebuild, 50); });        /* roster rendered → horizontal gallery */
    document.addEventListener("deafah:langchange", function () { setTimeout(rebuild, 50); });    /* direction flips → mirror */
    var mq = window.matchMedia("(min-width: 1024px)"); mq.addEventListener("change", rebuild);
    window.addEventListener("load", function () { if (ST) ST.refresh(); });
    document.fonts && document.fonts.ready.then(function () { if (ST) ST.refresh(); });
  }

  window.DeafahMotion = { rebuild: rebuild, teardown: teardown, scenes: scenes, reduce: reduce, dir: DIR, lenis: function () { return lenis; } };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
