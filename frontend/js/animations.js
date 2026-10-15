/* Phase-1 reveals. Deterministic: an IntersectionObserver adds .is-in (CSS makes the element visible);
   when GSAP is present the entrance is tweened, otherwise the CSS transition runs. Reduced motion → instant.
   Replaced by js/motion.js in Phase 4 (Lenis + data-scene recipes), which keeps this contract. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches || root.classList.contains("no-motion");
  var gsap = window.gsap;
  var els = Array.prototype.slice.call(document.querySelectorAll(".reveal"));
  if (!els.length) return;

  function show(el, i) {
    if (el.classList.contains("is-in")) return;
    el.classList.add("is-in");
    if (reduce || !gsap) return;
    gsap.fromTo(el, { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: 0.7, delay: Math.min(i, 6) * 0.08, ease: "power3.out", overwrite: true, clearProps: "transform" });
  }

  if (reduce || !("IntersectionObserver" in window)) { els.forEach(function (el) { el.classList.add("is-in"); }); return; }

  var queue = [];
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      queue.push(e.target);
    });
    if (queue.length) { var batch = queue.splice(0); batch.forEach(show); }
  }, { rootMargin: "0px 0px -10% 0px", threshold: 0.05 });
  els.forEach(function (el) { io.observe(el); });

  /* safety net: anything still hidden 4 s after load becomes visible (e.g. observers blocked by a tab in the background) */
  window.addEventListener("load", function () {
    setTimeout(function () { els.forEach(function (el) { if (!el.classList.contains("is-in") && el.getBoundingClientRect().top < window.innerHeight) show(el, 0); }); }, 4000);
  });
})();
