/* Al Deafah — logo system. mountLogo(el, { lockup, size }) and auto-mount of [data-logo].
   Files: ONLY the byte-identical copies in assets/brand/logo/. Selection is a lookup table keyed by
   (scheme, dir, lockup). The palette (default/green/red/blue) never changes the file: light surfaces take the
   positive logo, dark surfaces the NEG logo (gradient gold symbol + white name) in every theme.
   Minimum sizes (approved 2026-10-14): stacked 120 px, horizontal 200 px, symbol 40 px → below them the symbol alone.
   Free zone 0.42 × symbol height is applied as padding around the <img>. */
(function () {
  "use strict";

  var BASE = (document.currentScript && document.currentScript.getAttribute("data-base")) || "assets/brand/logo/";

  /* intrinsic viewBox sizes of the copied files (width, height) and the symbol height inside each lockup */
  var FILES = {
    "stacked|pos": { file: "logo-stacked-pos.svg", w: 404.026, h: 328.802, symH: 245.7 },
    "stacked|neg": { file: "logo-stacked-neg.svg", w: 404.026, h: 328.397, symH: 245.7 },
    "ltr|pos":     { file: "logo-ltr-pos.svg",     w: 606.502, h: 172,     symH: 172 },
    "ltr|neg":     { file: "logo-ltr-neg.svg",     w: 606.502, h: 172,     symH: 172 },
    "rtl|pos":     { file: "logo-rtl-pos.svg",     w: 587.194, h: 172,     symH: 172 },
    "rtl|neg":     { file: "logo-rtl-neg.svg",     w: 587.622, h: 172,     symH: 172 },
    "symbol|pos":  { file: "symbol-pos.svg",       w: 242.387, h: 245.715, symH: 245.715 },
    "symbol|neg":  { file: "symbol-pos.svg",       w: 242.387, h: 245.715, symH: 245.715 }, /* the gradient symbol is identical in CMYK and NEG masters */
    "symbol|black":{ file: "symbol-black.svg",     w: 242.388, h: 245.714, symH: 245.714 },
    "symbol|white":{ file: "symbol-white.svg",     w: 242.388, h: 245.714, symH: 245.714 }
  };
  var MIN_WIDTH = { stacked: 120, horizontal: 200, symbol: 40 };
  var ALT = "مجموعة الضيافة العالمية";

  /* lookup table: scheme × dir × lockup → key into FILES */
  var TABLE = {
    "light|rtl|horizontal": "rtl|pos",  "dark|rtl|horizontal": "rtl|neg",
    "light|ltr|horizontal": "ltr|pos",  "dark|ltr|horizontal": "ltr|neg",
    "light|rtl|stacked":    "stacked|pos", "dark|rtl|stacked": "stacked|neg",
    "light|ltr|stacked":    "stacked|pos", "dark|ltr|stacked": "stacked|neg",
    "light|rtl|symbol":     "symbol|pos", "dark|rtl|symbol": "symbol|neg",
    "light|ltr|symbol":     "symbol|pos", "dark|ltr|symbol": "symbol|neg"
  };

  function context(el) {
    /* a logo inside .panel (always dark) or inside [data-logo-surface="dark"] uses the NEG file regardless of scheme */
    var forced = el.closest("[data-logo-surface]");
    var scheme = forced ? forced.getAttribute("data-logo-surface") : (el.closest(".panel") ? "dark" : document.documentElement.getAttribute("data-scheme") || "light");
    var dir = (document.documentElement.getAttribute("dir") || "rtl") === "ltr" ? "ltr" : "rtl";
    return { scheme: scheme === "dark" ? "dark" : "light", dir: dir };
  }

  function pick(lockup, width, ctx) {
    var effective = lockup;
    if (lockup !== "symbol" && width < MIN_WIDTH[lockup]) effective = "symbol";
    var key = TABLE[ctx.scheme + "|" + ctx.dir + "|" + effective];
    return { key: key, spec: FILES[key], lockup: effective };
  }

  function mountLogo(el, opts) {
    opts = opts || {};
    var lockup = opts.lockup || el.getAttribute("data-logo") || "horizontal";
    var width = parseFloat(opts.width || el.getAttribute("data-logo-width")) || (lockup === "symbol" ? 40 : lockup === "stacked" ? 160 : 220);
    var ctx = context(el);
    var p = pick(lockup, width, ctx);
    var spec = p.spec;
    var renderW = p.lockup === "symbol" && lockup !== "symbol" ? MIN_WIDTH.symbol : width;
    var renderH = renderW * spec.h / spec.w;
    var symPx = renderH * (spec.symH / spec.h);
    var pad = Math.round(0.42 * symPx);

    var img = el.querySelector("img");
    if (!img) { img = document.createElement("img"); img.alt = ALT; img.decoding = "async"; el.appendChild(img); }
    var src = BASE + spec.file;
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.setAttribute("width", Math.round(renderW));
    img.setAttribute("height", Math.round(renderH));
    img.style.width = renderW + "px";
    img.style.height = renderH + "px";
    img.alt = ALT;
    el.style.padding = pad + "px";
    el.setAttribute("data-logo-file", spec.file);
    el.setAttribute("data-logo-lockup", p.lockup);
    el.classList.add("brand-logo");
    return img;
  }

  function mountAll() {
    document.querySelectorAll("[data-logo]").forEach(function (el) { mountLogo(el); });
  }

  /* responsive: header switches to the symbol below 640 px via data-logo-mobile="symbol" */
  var mq = window.matchMedia("(max-width: 639.98px)");
  function applyResponsive() {
    document.querySelectorAll("[data-logo-mobile]").forEach(function (el) {
      if (!el.hasAttribute("data-logo-desktop")) el.setAttribute("data-logo-desktop", el.getAttribute("data-logo"));
      el.setAttribute("data-logo", mq.matches ? el.getAttribute("data-logo-mobile") : el.getAttribute("data-logo-desktop"));
      if (!el.hasAttribute("data-logo-width-desktop")) el.setAttribute("data-logo-width-desktop", el.getAttribute("data-logo-width") || "");
      el.setAttribute("data-logo-width", mq.matches ? "40" : el.getAttribute("data-logo-width-desktop"));
    });
    mountAll();
  }

  window.mountLogo = mountLogo;
  window.DeafahLogo = { mountLogo: mountLogo, mountAll: mountAll, table: TABLE, files: FILES };

  function boot() { applyResponsive(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
  mq.addEventListener("change", applyResponsive);
  document.addEventListener("deafah:themechange", mountAll);
  document.addEventListener("deafah:langchange", mountAll);
})();
