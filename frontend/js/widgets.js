/* Al Deafah — small page widgets (Phase 6), data-attribute driven, no per-page JS:
   [data-marquee]            gallery marquee: endless translate loop (GSAP), direction-aware, hover pauses; static strip under reduced motion
   [data-tabs] / [data-tab]  filter tabs: data-tab="all|room|suite|family" shows [data-type] cards; roving focus, aria-selected
   [data-availability]       availability bar: submit → opens the existing contact dialog with the values prefilled (no booking engine)
   [data-walk-slider]        "distance to the Haram" widget: minutes walking vs shuttle, Arabic-Indic digits in Arabic
   Floating CTA is plain HTML (.float-cta). */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = function () { return root.classList.contains("no-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var isAr = function () { return root.getAttribute("data-lang") !== "en"; };
  var AR = "٠١٢٣٤٥٦٧٨٩";
  var digits = function (n) { return isAr() ? String(n).replace(/\d/g, function (d) { return AR[+d]; }) : String(n); };
  window.DeafahWidgets = window.DeafahWidgets || {};

  /* ---------------- marquee ---------------- */
  function initMarquee(el) {
    if (el.getAttribute("data-marquee-ready")) return;
    var track = el.querySelector(".marquee__track"); if (!track || !track.children.length) return;
    el.setAttribute("data-marquee-ready", "1");
    if (reduce() || !window.gsap) return;
    /* duplicate once so the loop is seamless */
    var clone = track.cloneNode(true); clone.setAttribute("aria-hidden", "true");
    while (clone.firstChild) track.appendChild(clone.firstChild);
    var tween = null;
    function build() {
      if (tween) tween.kill();
      var half = track.scrollWidth / 2; if (!half) return;
      var dir = (root.getAttribute("dir") || "rtl") === "rtl" ? 1 : -1;      /* RTL content starts at the right and flows left → move right */
      gsap.set(track, { x: 0 });
      tween = gsap.to(track, { x: dir * half, duration: Math.max(20, half / 40), ease: "none", repeat: -1, modifiers: { x: function (x) { var v = parseFloat(x) % half; return v + "px"; } } });
    }
    build();
    el.addEventListener("pointerenter", function () { tween && tween.pause(); });
    el.addEventListener("pointerleave", function () { tween && tween.play(); });
    document.addEventListener("deafah:langchange", build);
    new ResizeObserver(build).observe(el);
  }

  /* ---------------- tabs ---------------- */
  function initTabs(group) {
    var tabs = Array.prototype.slice.call(group.querySelectorAll("[data-tab]"));
    var scope = document.querySelector(group.getAttribute("data-tabs-for")) || group.parentElement;
    function select(tab) {
      var key = tab.getAttribute("data-tab");
      tabs.forEach(function (t) { var on = t === tab; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; });
      scope.querySelectorAll("[data-type]").forEach(function (card) { card.hidden = key !== "all" && card.getAttribute("data-type") !== key; });
      if (window.ScrollTrigger) window.ScrollTrigger.refresh();
    }
    group.addEventListener("click", function (e) { var t = e.target.closest("[data-tab]"); if (t) select(t); });
    group.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement); if (i < 0) return;
      var rtl = (root.getAttribute("dir") || "rtl") === "rtl", d = 0;
      if (e.key === "ArrowRight") d = rtl ? -1 : 1; else if (e.key === "ArrowLeft") d = rtl ? 1 : -1; else if (e.key === "Home") { tabs[0].focus(); select(tabs[0]); e.preventDefault(); return; } else if (e.key === "End") { tabs[tabs.length - 1].focus(); select(tabs[tabs.length - 1]); e.preventDefault(); return; } else return;
      e.preventDefault(); var n = tabs[(i + d + tabs.length) % tabs.length]; n.focus(); select(n);
    });
    var current = tabs.filter(function (t) { return t.getAttribute("aria-selected") === "true"; })[0] || tabs[0];
    if (current) select(current);
  }

  /* ---------------- availability bar → contact dialog ---------------- */
  function initAvailability(form) {
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var f = new FormData(form), g = function (k) { return (f.get(k) || "").toString().trim(); };
      var hotel = form.getAttribute("data-hotel") || "";
      var lines = isAr()
        ? ["طلب توفر: " + hotel, "الوصول: " + g("checkin"), "المغادرة: " + g("checkout"), "الغرف: " + g("rooms"), "البالغون: " + g("adults") + " · الأطفال: " + g("children")]
        : ["Availability request: " + hotel, "Check-in: " + g("checkin"), "Check-out: " + g("checkout"), "Rooms: " + g("rooms"), "Adults: " + g("adults") + " · Children: " + g("children")];
      var msg = lines.join("\n");
      if (window.DeafahModal) window.DeafahModal.open("contactModal", (isAr() ? "توفر — " : "Availability — ") + hotel, form.querySelector("button[type=submit]"));
      setTimeout(function () {
        var ta = document.getElementById(isAr() ? "contactMessage-ar" : "contactMessage-en");
        if (ta) { ta.value = msg; ta.dispatchEvent(new Event("input", { bubbles: true })); }
      }, 60);
    });
  }

  /* ---------------- walking-time slider ---------------- */
  function initWalkSlider(el) {
    var input = el.querySelector("input[type=range]"), walk = el.querySelector("[data-walk]"), shuttle = el.querySelector("[data-shuttle]"), km = el.querySelector("[data-km]");
    if (!input) return;
    function render() {
      var min = +input.value;                                   /* minutes walking */
      if (walk) walk.textContent = digits(min);
      if (shuttle) shuttle.textContent = digits(Math.max(3, Math.round(min * 0.45)));
      if (km) km.textContent = digits((min * 0.08).toFixed(1));
      input.setAttribute("aria-valuetext", (isAr() ? "دقائق سيرًا: " : "minutes walking: ") + min);
    }
    input.addEventListener("input", render); document.addEventListener("deafah:langchange", render); render();
  }

  function init(scope) {
    scope = scope || document;
    scope.querySelectorAll("[data-marquee]").forEach(initMarquee);
    scope.querySelectorAll("[data-tabs]").forEach(initTabs);
    scope.querySelectorAll("form[data-availability]").forEach(initAvailability);
    scope.querySelectorAll("[data-walk-slider]").forEach(initWalkSlider);
  }
  window.DeafahWidgets.init = init; window.DeafahWidgets.digits = digits;
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { init(); }); else init();
})();
