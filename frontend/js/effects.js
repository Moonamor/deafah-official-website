/* Al Deafah — small effects (vanilla rewrite of the previous version). Public API kept: DeafahEffects.showToast(message).
   Stat counters: Arabic-Indic digits when the page is Arabic. Blob parallax / card tilt were removed with the glass look. */
window.DeafahEffects = (function () {
  "use strict";

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

  function localizeDigits(str) {
    if (document.documentElement.getAttribute("data-lang") === "en") return str;
    return String(str).replace(/\d/g, function (d) { return AR_DIGITS[+d]; });
  }

  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count-to"), 10) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    var duration = reducedMotion ? 1 : 1600;
    var start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = localizeDigits(Math.round(eased * target)) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function initStatCounters() {
    var stats = Array.prototype.filter.call(document.querySelectorAll("[data-count-to]"), function (s) { return !s.hasAttribute("data-count-observed"); });
    stats.forEach(function (s) { s.setAttribute("data-count-observed", "1"); });
    if (!stats.length) return;
    if (!("IntersectionObserver" in window)) { stats.forEach(animateCount); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { animateCount(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.4 });
    stats.forEach(function (s) { io.observe(s); });
  }

  var toastTimer = null;
  function showToast(message) {
    var toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, 3200);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initStatCounters);
  else initStatCounters();

  return { showToast: showToast, localizeDigits: localizeDigits, initStatCounters: initStatCounters };
})();
