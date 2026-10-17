/* Al Deafah — gallery grid + lightbox (anjum pattern; MOTION_SPEC rows 17–20, brand override on row 17).
   Markup: tools/build-sections.mjs ("gallery", "gallery-teaser", "lightbox"). Photo data: the JSON script inside the
   lightbox (all photos with sizes and ar/en alt text), so captions always come from the data.
   - Filters: ARIA tablist; switching fades the grid out / in with the 200 ms brand token.
   - Lightbox: native <dialog> + aria-modal; open / close 500 ms (backdrop + stage), next / previous 366 ms crossfade
     (reference fancybox config); focus moves in, Tab stays in, Esc closes, focus returns to the photo that opened it;
     ArrowLeft / ArrowRight and swipe follow the reading direction (mirrored in RTL); counter + caption.
   - Emits deafah:dialogopen / deafah:dialogclose so motion.js stops and restarts Lenis.
   - Reduced motion: no fades or scaling, every change is instant. */
(function () {
  "use strict";
  var root = document.documentElement;
  var reduce = function () { return root.classList.contains("no-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches; };
  var rtl = function () { return (root.getAttribute("dir") || "rtl") === "rtl"; };
  var AR = "٠١٢٣٤٥٦٧٨٩", arDigits = function (s) { return String(s).replace(/\d/g, function (d) { return AR[+d]; }); };
  var bi = function (o) { var e = function (s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;"); }; return '<span class="lang-ar">' + e(o.ar) + '</span><span class="lang-en">' + e(o.en) + "</span>"; };
  var FADE_MS = 200, OPEN_MS = 500, NAV_MS = 366;

  /* ---------------- filters ---------------- */
  function initFilters(grid) {
    var section = grid.closest("section"), tl = section && section.querySelector("[data-gallery-filters]");
    var emptyMsg = section && section.querySelector(".gallery-empty");
    if (!tl) return;
    var tabs = Array.prototype.slice.call(tl.querySelectorAll("[role=tab]"));
    function apply(cat) {
      var swap = function () {
        var shown = 0;
        grid.querySelectorAll(".gallery-item").forEach(function (li) { var ok = cat === "all" || li.getAttribute("data-category") === cat; li.hidden = !ok; if (ok) shown++; });
        if (emptyMsg) emptyMsg.hidden = shown > 0;
      };
      if (reduce()) { swap(); return; }
      grid.style.transition = "opacity " + FADE_MS + "ms var(--ease-brand)";
      grid.style.opacity = "0";
      setTimeout(function () { swap(); grid.style.opacity = "1"; if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }, FADE_MS);
    }
    function select(tab, focus) {
      if (tab.getAttribute("aria-selected") === "true") return;
      tabs.forEach(function (t) { var on = t === tab; t.setAttribute("aria-selected", on ? "true" : "false"); t.tabIndex = on ? 0 : -1; });
      if (focus) tab.focus();
      apply(tab.getAttribute("data-filter"));
    }
    tl.addEventListener("click", function (e) { var t = e.target.closest("[role=tab]"); if (t) select(t, false); });
    var resetBtn = section.querySelector("[data-gallery-reset]");
    if (resetBtn) resetBtn.addEventListener("click", function () { select(tabs[0], true); });
    tl.addEventListener("keydown", function (e) {
      var i = tabs.indexOf(document.activeElement); if (i < 0) return;
      var fwd = rtl() ? "ArrowLeft" : "ArrowRight", back = rtl() ? "ArrowRight" : "ArrowLeft", d = 0;
      if (e.key === fwd) d = 1; else if (e.key === back) d = -1;
      else if (e.key === "Home") { e.preventDefault(); select(tabs[0], true); return; }
      else if (e.key === "End") { e.preventDefault(); select(tabs[tabs.length - 1], true); return; }
      else return;
      e.preventDefault(); select(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  }

  /* ---------------- lightbox ---------------- */
  function Lightbox(dlg) {
    var data = JSON.parse(dlg.querySelector("[data-lightbox-data]").textContent);
    var byId = {}; data.forEach(function (d) { byId[d.id] = d; });
    var imgs = Array.prototype.slice.call(dlg.querySelectorAll("[data-lightbox-img]"));
    var caption = dlg.querySelector("[data-lightbox-caption]"), counter = dlg.querySelector("[data-lightbox-count]");
    var prevBtn = dlg.querySelector("[data-lightbox-prev]"), nextBtn = dlg.querySelector("[data-lightbox-next]");
    var list = [], index = 0, front = 0, opener = null, closing = false;

    function setImg(img, d) {
      var s = d.sizes.slice().sort(function (a, b) { return a.width - b.width; });
      img.srcset = s.map(function (x) { return x.src + " " + x.width + "w"; }).join(", ");
      img.sizes = "100vw";
      img.src = s[s.length - 1].src;
      img.width = s[s.length - 1].width; img.height = s[s.length - 1].height;
      img.alt = root.getAttribute("data-lang") === "en" ? d.alt.en : d.alt.ar;
    }
    function label() {
      var n = list.length, k = index + 1;
      counter.innerHTML = '<span class="lang-ar">' + arDigits(k + " / " + n) + '</span><span class="lang-en">' + k + " / " + n + "</span>";
      prevBtn.disabled = index === 0; nextBtn.disabled = index === n - 1;   /* reference: loop false */
    }
    function show(i, animate) {
      index = Math.max(0, Math.min(list.length - 1, i));
      var d = byId[list[index]];
      var back = 1 - front, a = imgs[front], b = imgs[back];
      setImg(b, d);
      caption.innerHTML = bi(d.alt);
      label();
      var swap = function () { b.classList.add("is-current"); b.removeAttribute("aria-hidden"); a.classList.remove("is-current"); a.setAttribute("aria-hidden", "true"); front = back; };
      if (!animate || reduce()) { dlg.classList.add("is-instant"); swap(); requestAnimationFrame(function () { dlg.classList.remove("is-instant"); }); return; }
      (b.decode ? b.decode().catch(function () {}) : Promise.resolve()).then(swap);
    }
    function trap(e) {
      if (e.key !== "Tab") return;
      var f = Array.prototype.slice.call(dlg.querySelectorAll("button:not([disabled])")).filter(function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    function open(ids, i, trigger) {
      list = ids; opener = trigger; closing = false;
      show(i, false);
      dlg.showModal();
      document.body.style.overflow = "hidden";
      document.dispatchEvent(new CustomEvent("deafah:dialogopen", { detail: { id: dlg.id, dialog: dlg } }));
      if (reduce()) dlg.classList.add("is-open");
      else requestAnimationFrame(function () { requestAnimationFrame(function () { dlg.classList.add("is-open"); }); });
      dlg.querySelector("[data-lightbox-close]").focus();
    }
    function close() {
      if (closing || !dlg.open) return;
      closing = true;
      dlg.classList.remove("is-open");
      setTimeout(function () {
        dlg.close(); closing = false;
        document.body.style.overflow = "";
        document.dispatchEvent(new CustomEvent("deafah:dialogclose", { detail: { id: dlg.id, dialog: dlg } }));
        if (opener && opener.focus) opener.focus();
      }, reduce() ? 0 : OPEN_MS);
    }
    dlg.addEventListener("cancel", function (e) { e.preventDefault(); close(); });   /* Esc → animated close */
    dlg.addEventListener("click", function (e) { if (e.target === dlg) close(); });
    dlg.querySelector("[data-lightbox-close]").addEventListener("click", close);
    prevBtn.addEventListener("click", function () { show(index - 1, true); });
    nextBtn.addEventListener("click", function () { show(index + 1, true); });
    dlg.addEventListener("keydown", function (e) {
      trap(e);
      var fwd = rtl() ? "ArrowLeft" : "ArrowRight", back = rtl() ? "ArrowRight" : "ArrowLeft";
      if (e.key === fwd && index < list.length - 1) { e.preventDefault(); show(index + 1, true); }
      else if (e.key === back && index > 0) { e.preventDefault(); show(index - 1, true); }
    });
    var x0 = null, stage = dlg.querySelector("[data-lightbox-stage]");
    stage.addEventListener("pointerdown", function (e) { x0 = e.clientX; });
    stage.addEventListener("pointerup", function (e) {
      if (x0 === null) return; var dx = e.clientX - x0; x0 = null;
      if (Math.abs(dx) < 40) return;
      var nextDir = (dx < 0) !== rtl();   /* LTR: swipe left = next; RTL: swipe right = next */
      if (nextDir && index < list.length - 1) show(index + 1, true); else if (!nextDir && index > 0) show(index - 1, true);
    });
    document.addEventListener("deafah:langchange", function () { if (dlg.open) show(index, false); });
    return { open: open };
  }

  /* alt text follows the page language (build-time markup carries ar in alt, en in data-alt-en) */
  function syncAlts() {
    var en = root.getAttribute("data-lang") === "en";
    document.querySelectorAll("img[data-alt-en]").forEach(function (img) {
      if (!img.hasAttribute("data-alt-ar")) img.setAttribute("data-alt-ar", img.getAttribute("alt") || "");
      img.alt = en ? img.getAttribute("data-alt-en") : img.getAttribute("data-alt-ar");
    });
  }
  document.addEventListener("deafah:langchange", syncAlts);

  function init() {
    syncAlts();
    var dlg = document.querySelector("[data-lightbox-dialog]");
    var lb = dlg ? new Lightbox(dlg) : null;
    document.querySelectorAll("[data-gallery]").forEach(function (grid) {
      initFilters(grid);
      if (!lb) return;
      grid.addEventListener("click", function (e) {
        var btn = e.target.closest("[data-lightbox]"); if (!btn) return;
        var visible = Array.prototype.slice.call(grid.querySelectorAll(".gallery-item:not([hidden]) [data-lightbox]"));
        lb.open(visible.map(function (b) { return b.getAttribute("data-lightbox"); }), visible.indexOf(btn), btn);
      });
    });
  }
  if (document.readyState !== "loading") init(); else document.addEventListener("DOMContentLoaded", init);
})();
