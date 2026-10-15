/* Kufic field: tiles WHOLE 2×2 blocks only (assets/brand/pattern/kufic-2x2.svg), computes the maximum whole-block
   count from the container, keeps ≥ 24 px inset, never crops. Fill comes from --pattern-ink via currentColor.
   Markup: <div class="kufic-field" data-kufic data-block="56" data-gap="8" data-rows="auto|N" data-cols="auto|N"></div> */
(function () {
  "use strict";
  var SRC = (document.currentScript && document.currentScript.getAttribute("data-src")) || "assets/brand/pattern/kufic-2x2.svg";
  var INSET = 24;
  var symbolReady = null;

  function ensureSymbol() {
    if (symbolReady) return symbolReady;
    symbolReady = fetch(SRC).then(function (r) { return r.text(); }).then(function (txt) {
      var doc = new DOMParser().parseFromString(txt, "image/svg+xml");
      var svg = doc.documentElement;
      var vb = svg.getAttribute("viewBox") || "0 0 81.553 81.553";
      var host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      host.setAttribute("style", "position:absolute;width:0;height:0;overflow:hidden");
      host.setAttribute("aria-hidden", "true");
      var sym = document.createElementNS("http://www.w3.org/2000/svg", "symbol");
      sym.setAttribute("id", "kufic-2x2");
      sym.setAttribute("viewBox", vb);
      Array.prototype.slice.call(svg.childNodes).forEach(function (n) { sym.appendChild(document.importNode(n, true)); });
      /* geometry untouched; only the fill attribute is removed so currentColor (= --pattern-ink) applies */
      sym.querySelectorAll("[fill]").forEach(function (n) { n.removeAttribute("fill"); });
      host.appendChild(sym);
      document.body.insertBefore(host, document.body.firstChild);
      return true;
    }).catch(function () { return false; });
    return symbolReady;
  }

  function layout(el) {
    var block = parseFloat(el.getAttribute("data-block")) || 56;
    var gap = parseFloat(el.getAttribute("data-gap")) || Math.round(block * 0.14);
    var w = el.clientWidth - INSET * 2, h = el.clientHeight - INSET * 2;
    var colsAttr = el.getAttribute("data-cols"), rowsAttr = el.getAttribute("data-rows");
    var fixedCols = colsAttr && colsAttr !== "auto", fixedRows = rowsAttr && rowsAttr !== "auto";
    /* a shrink-to-fit field (absolute column) has no width until it has children: explicit data-cols sizes it */
    if ((w <= 0 && !fixedCols) || (h <= 0 && !fixedRows)) return;
    var maxCols = w > 0 ? Math.floor((w + gap) / (block + gap)) : Infinity;
    var maxRows = h > 0 ? Math.floor((h + gap) / (block + gap)) : Infinity;
    var cols = fixedCols ? Math.min(parseInt(colsAttr, 10), fixedCols && w <= 0 ? Infinity : maxCols) : maxCols;
    var rows = fixedRows ? Math.min(parseInt(rowsAttr, 10), fixedRows && h <= 0 ? Infinity : maxRows) : maxRows;
    if (!isFinite(cols) || !isFinite(rows)) return;
    cols = Math.max(0, cols); rows = Math.max(0, rows);
    var n = cols * rows;
    el.style.setProperty("--kufic-block", block + "px");
    el.style.setProperty("--kufic-gap", gap + "px");
    el.style.gridTemplateColumns = "repeat(" + cols + ", " + block + "px)";
    el.style.gridAutoFlow = "row";
    el.style.padding = INSET + "px";
    var current = el.children.length;
    for (var i = current; i < n; i++) {
      var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      s.setAttribute("aria-hidden", "true");
      var u = document.createElementNS("http://www.w3.org/2000/svg", "use");
      u.setAttribute("href", "#kufic-2x2");
      s.appendChild(u); el.appendChild(s);
    }
    while (el.children.length > n) el.removeChild(el.lastChild);
    el.setAttribute("data-kufic-count", cols + "x" + rows);
  }

  function init() {
    var fields = document.querySelectorAll("[data-kufic]");
    if (!fields.length) return;
    ensureSymbol().then(function (ok) {
      if (!ok) return;
      fields.forEach(layout);
      if ("ResizeObserver" in window) {
        var ro = new ResizeObserver(function (entries) { entries.forEach(function (e) { layout(e.target); }); });
        fields.forEach(function (f) { ro.observe(f); });
      } else window.addEventListener("resize", function () { fields.forEach(layout); });
    });
  }
  window.DeafahKufic = { layout: layout, init: init };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init); else init();
})();
