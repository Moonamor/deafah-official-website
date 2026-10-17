/* Al Deafah — small effects. Public API: DeafahEffects.showToast(message[, { tone, ms }]), localizeDigits, initStatCounters.
   Owner brief 2026-10-17 (F1 / F2):
   - toasts carry a tone icon (info / success / error), role=status aria-live=polite (markup: #toast);
   - theme and language switches: pressed state on the toggle + a 2.5 s polite toast naming the new state
     (user-initiated only: fired from the controls' clicks, never on load, so switching never replays page animations);
   - counters: count up over 1200 ms, power2.out, once 50 % of the number is in view, Arabic-Indic digits in Arabic;
   - scroll-progress bar under the header (scaleX, accent), back-to-top button after one viewport of scroll;
   - lazy images fade in over a themed placeholder (the frame's own background); width/height hold the box (no shift).
   Reduced motion: counters jump to the value, nothing fades, the bar still tracks (it is position feedback, not motion). */
window.DeafahEffects = (function () {
  "use strict";

  var root = document.documentElement;
  var reduce = function () { return root.classList.contains("no-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var isAr = function () { return root.getAttribute("data-lang") !== "en"; };
  var AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";

  function localizeDigits(str) {
    if (root.getAttribute("data-lang") === "en") return str;
    return String(str).replace(/\d/g, function (d) { return AR_DIGITS[+d]; });
  }
  function spriteHref() {
    var u = document.querySelector("svg use[href*='sprite']");
    return u ? u.getAttribute("href").split("#")[0] : (window.__spriteHref || "assets/icons/sprite.svg");
  }
  function iconSVG(id) { return '<svg class="icon icon--sm" aria-hidden="true"><use href="' + spriteHref() + "#" + id + '"></use></svg>'; }

  /* ---------------- counters (F2: 1200 ms power2.out at 50 % in view) ---------------- */
  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count-to"), 10) || 0;
    var suffix = el.getAttribute("data-suffix") || "";
    if (reduce()) { el.textContent = localizeDigits(target) + suffix; return; }
    var duration = 1200, start = null;
    function step(ts) {
      if (start === null) start = ts;
      var p = Math.min((ts - start) / duration, 1);
      var eased = 1 - (1 - p) * (1 - p);            /* power2.out */
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
    }, { threshold: 0.5 });
    stats.forEach(function (s) { io.observe(s); });
  }

  /* ---------------- toast ---------------- */
  var toastTimer = null;
  var TONE_ICON = { info: "circle-info", success: "circle-check", error: "circle-exclamation" };
  function showToast(message, opts) {
    var toast = document.getElementById("toast");
    if (!toast || !message) return;
    opts = opts || {};
    var tone = TONE_ICON[opts.tone] ? opts.tone : "info";
    toast.setAttribute("data-tone", tone);
    toast.innerHTML = iconSVG(TONE_ICON[tone]) + "<span></span>";
    toast.lastChild.textContent = message;
    toast.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toast.classList.remove("is-visible"); }, opts.ms || 3200);
  }

  /* ---------------- theme / language feedback ---------------- */
  var PALETTE = { "default": { ar: "الافتراضية", en: "Default" }, green: { ar: "الخضراء", en: "Green" }, red: { ar: "الحمراء", en: "Red" }, blue: { ar: "الزرقاء", en: "Blue" } };
  var SCHEME = { light: { ar: "فاتح", en: "light" }, dark: { ar: "داكن", en: "dark" } };
  function syncPressed() {
    var dark = root.getAttribute("data-scheme") === "dark";
    document.querySelectorAll("[data-theme-toggle]").forEach(function (b) { b.setAttribute("aria-pressed", dark ? "true" : "false"); });
  }
  function themeToast() {
    var p = PALETTE[root.getAttribute("data-theme") || "default"] || PALETTE["default"];
    var sc = SCHEME[root.getAttribute("data-scheme") === "dark" ? "dark" : "light"];
    showToast(isAr() ? "السمة " + p.ar + " · الوضع ال" + sc.ar : p.en + " theme · " + sc.en + " mode", { tone: "success", ms: 2500 });
  }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-theme-toggle], .theme-badge__swatch, .theme-badge__scheme")) setTimeout(function () { syncPressed(); themeToast(); }, 0);
    else if (e.target.closest("[data-lang-toggle]")) setTimeout(function () { showToast(isAr() ? "تم التبديل إلى العربية" : "Switched to English", { tone: "success", ms: 2500 }); }, 0);
  });
  document.addEventListener("deafah:themechange", syncPressed);

  /* ---------------- scroll progress + back to top ---------------- */
  function initScrollUI() {
    var bar = document.querySelector("[data-scroll-progress]");
    var btn = document.createElement("button");
    btn.type = "button"; btn.className = "to-top";
    btn.innerHTML = iconSVG("arrow-up");
    function label() { btn.setAttribute("aria-label", isAr() ? "العودة إلى أعلى الصفحة" : "Back to top"); }
    label(); document.addEventListener("deafah:langchange", label);
    btn.tabIndex = -1;
    document.body.appendChild(btn);
    btn.addEventListener("click", function () {
      var lenis = window.DeafahMotion && typeof window.DeafahMotion.lenis === "function" ? window.DeafahMotion.lenis() : null;
      if (lenis && !reduce()) lenis.scrollTo(0);
      else window.scrollTo({ top: 0, behavior: reduce() ? "auto" : "smooth" });
      var skip = document.querySelector("#main") || document.body; if (skip && skip.focus) { skip.setAttribute("tabindex", "-1"); skip.focus({ preventScroll: true }); }
    });
    var ticking = false;
    function update() {
      ticking = false;
      var y = window.scrollY || root.scrollTop, max = Math.max(1, root.scrollHeight - window.innerHeight);
      if (bar) bar.style.transform = "scaleX(" + Math.min(1, y / max).toFixed(4) + ")";
      var show = y > window.innerHeight;
      if (show !== btn.classList.contains("is-visible")) { btn.classList.toggle("is-visible", show); btn.tabIndex = show ? 0 : -1; }
    }
    window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", update);
    update();
  }

  /* ---------------- image fade-in over a themed placeholder ---------------- */
  var FADE_SCOPE = ".gallery-thumb img, .qtile img, .hotel-media img, .hl__media img:not(.is-current), [data-fade-in] img";
  function prepImage(img) {
    if (img.__fadePrepared || reduce()) return;
    img.__fadePrepared = true;
    if (img.complete && img.naturalWidth) return;                  /* already decoded: no flash */
    img.classList.add("is-pending");
    var done = function () {
      img.classList.add("is-fading");
      requestAnimationFrame(function () { img.classList.remove("is-pending"); });
      setTimeout(function () { img.classList.remove("is-fading"); }, 450);   /* hand the transition back to the component (hover scale etc.) */
    };
    img.addEventListener("load", done, { once: true });
    img.addEventListener("error", done, { once: true });
  }
  function initFades() {
    document.querySelectorAll(FADE_SCOPE).forEach(prepImage);
    if ("MutationObserver" in window) new MutationObserver(function (m) {
      m.forEach(function (r) { r.addedNodes.forEach(function (n) { if (n.nodeType === 1) { if (n.matches && n.matches(FADE_SCOPE)) prepImage(n); if (n.querySelectorAll) n.querySelectorAll(FADE_SCOPE).forEach(prepImage); } }); });
    }).observe(document.body, { childList: true, subtree: true });
  }

  /* ---------------- WhatsApp: href + accessible name follow the page language ----------------
     Built links carry data-href-ar / data-href-en / data-label-ar / data-label-en (tools/build-sections.mjs, single source
     site.json). Links rendered at run time with a bare [data-whatsapp] copy them from the first built link. */
  function syncWhatsApp() {
    var src = document.querySelector("a[data-whatsapp][data-href-ar]"); if (!src) return;
    var lang = isAr() ? "ar" : "en";
    document.querySelectorAll("a[data-whatsapp]").forEach(function (a) {
      ["data-href-ar", "data-href-en", "data-label-ar", "data-label-en"].forEach(function (k) { if (!a.hasAttribute(k)) a.setAttribute(k, src.getAttribute(k)); });
      a.setAttribute("href", a.getAttribute("data-href-" + lang));
      a.setAttribute("aria-label", a.getAttribute("data-label-" + lang));
      a.setAttribute("target", "_blank"); a.setAttribute("rel", "noopener");
    });
  }
  document.addEventListener("deafah:langchange", syncWhatsApp);

  function init() { initStatCounters(); syncPressed(); initScrollUI(); initFades(); syncWhatsApp(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  return { showToast: showToast, localizeDigits: localizeDigits, initStatCounters: initStatCounters, syncWhatsApp: syncWhatsApp };
})();
