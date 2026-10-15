/* Al Deafah — logo system (Phase 2).
   mountLogo(el, { lockup, size }) and auto-mount of every [data-logo].
   Files: ONLY the byte-identical copies in assets/brand/logo/. Selection is a lookup table keyed by scheme × dir × lockup;
   the palette (default/green/red/blue) never changes the file: light surfaces take the positive logo, dark surfaces the
   NEG logo (gradient gold symbol + white name). A logo inside .panel or [data-logo-surface="dark"] is always NEG.

   No layout shift: every mount is a fixed box. Its height is `size` (px) and its width is the WIDEST file of that lockup
   (the LTR lockup is 606.5 units wide, the RTL one 587.2), so swapping scheme, theme or direction never moves anything.
   Free zone (Brand Facts §2.4) = 0.42 × rendered symbol height, applied as padding on all four sides of the box.
   Minimum sizes (decision 2026-10-14): stacked 120 px wide, horizontal 200 px wide, symbol 40 px → below them the symbol
   alone is mounted, never a shrunken full logo. */
(function () {
  "use strict";

  var script = document.currentScript;
  var BASE = (script && script.getAttribute("data-base")) || "assets/brand/logo/";
  var ALT = "مجموعة الضيافة العالمية";

  /* intrinsic viewBox of each copied file (w, h) and the symbol height inside it, in viewBox units */
  var FILES = {
    "stacked|pos": { file: "logo-stacked-pos.svg", w: 404.026, h: 328.802, symH: 245.7 },
    "stacked|neg": { file: "logo-stacked-neg.svg", w: 404.026, h: 328.397, symH: 245.7 },
    "ltr|pos":     { file: "logo-ltr-pos.svg",     w: 606.502, h: 172,     symH: 172 },
    "ltr|neg":     { file: "logo-ltr-neg.svg",     w: 606.502, h: 172,     symH: 172 },
    "rtl|pos":     { file: "logo-rtl-pos.svg",     w: 587.194, h: 172,     symH: 172 },
    "rtl|neg":     { file: "logo-rtl-neg.svg",     w: 587.622, h: 172,     symH: 172 },
    "symbol|pos":  { file: "symbol-pos.svg",       w: 242.387, h: 245.715, symH: 245.715 },
    "symbol|neg":  { file: "symbol-pos.svg",       w: 242.387, h: 245.715, symH: 245.715 } /* the gradient symbol is identical in the CMYK and NEG masters */
  };

  /* lookup: scheme | dir | lockup → FILES key. Direction only matters for the horizontal lockup. */
  var TABLE = {
    "light|rtl|horizontal": "rtl|pos",     "dark|rtl|horizontal": "rtl|neg",
    "light|ltr|horizontal": "ltr|pos",     "dark|ltr|horizontal": "ltr|neg",
    "light|rtl|stacked":    "stacked|pos", "dark|rtl|stacked":    "stacked|neg",
    "light|ltr|stacked":    "stacked|pos", "dark|ltr|stacked":    "stacked|neg",
    "light|rtl|symbol":     "symbol|pos",  "dark|rtl|symbol":     "symbol|neg",
    "light|ltr|symbol":     "symbol|pos",  "dark|ltr|symbol":     "symbol|neg"
  };

  /* fixed box per lockup: width/height ratio of the WIDEST variant, so the box never changes with dir or scheme */
  var BOX_RATIO = {
    horizontal: 606.502 / 172,      /* 3.526 — LTR lockup is the wider of the two */
    stacked: 404.026 / 328.397,     /* 1.230 — NEG file is marginally shorter → wider box at equal height */
    symbol: 242.388 / 245.714       /* 0.986 */
  };
  var SYM_RATIO = { horizontal: 1, stacked: 245.7 / 328.397, symbol: 1 }; /* symbol height ÷ rendered height */
  var MIN_WIDTH = { stacked: 120, horizontal: 200, symbol: 40 };
  var DEFAULT_SIZE = { horizontal: 64, stacked: 130, symbol: 40 };

  function surfaceOf(el) {
    var forced = el.closest("[data-logo-surface]");
    if (forced) return forced.getAttribute("data-logo-surface") === "dark" ? "dark" : "light";
    if (el.closest(".panel")) return "dark";
    return document.documentElement.getAttribute("data-scheme") === "dark" ? "dark" : "light";
  }
  function dirOf() { return (document.documentElement.getAttribute("dir") || "rtl") === "ltr" ? "ltr" : "rtl"; }

  /* resolves (lockup, size) → { lockup, key, spec, boxW, boxH, imgW, imgH, pad } */
  function resolve(lockup, size, ctx) {
    var boxH = size, boxW = Math.ceil(boxH * BOX_RATIO[lockup]);
    if (lockup !== "symbol" && boxW < MIN_WIDTH[lockup]) { lockup = "symbol"; boxH = Math.max(size, MIN_WIDTH.symbol); boxW = Math.ceil(boxH * BOX_RATIO.symbol); }
    if (lockup === "symbol" && boxH < MIN_WIDTH.symbol) { boxH = MIN_WIDTH.symbol; boxW = Math.ceil(boxH * BOX_RATIO.symbol); }
    var key = TABLE[ctx.scheme + "|" + ctx.dir + "|" + lockup];
    var spec = FILES[key];
    var imgH = boxH, imgW = Math.round(imgH * spec.w / spec.h);
    var pad = Math.round(0.42 * imgH * SYM_RATIO[lockup]);
    return { lockup: lockup, key: key, spec: spec, boxW: boxW, boxH: boxH, imgW: imgW, imgH: imgH, pad: pad };
  }

  function mountLogo(el, opts) {
    opts = opts || {};
    var requested = opts.lockup || el.getAttribute("data-logo") || "horizontal";
    var size = parseFloat(opts.size || el.getAttribute("data-logo-size")) || DEFAULT_SIZE[requested] || 64;
    var ctx = { scheme: surfaceOf(el), dir: dirOf() };
    var r = resolve(requested, size, ctx);

    var img = el.querySelector("img");
    if (!img) { img = document.createElement("img"); img.decoding = "async"; el.appendChild(img); }
    var src = BASE + r.spec.file;
    if (img.getAttribute("src") !== src) img.setAttribute("src", src);
    img.setAttribute("width", r.imgW);
    img.setAttribute("height", r.imgH);
    img.style.width = r.imgW + "px";
    img.style.height = r.imgH + "px";
    img.alt = ALT;

    el.classList.add("brand-logo");
    el.style.boxSizing = "content-box";
    el.style.width = r.boxW + "px";
    el.style.height = r.boxH + "px";
    el.style.padding = r.pad + "px";
    el.setAttribute("data-logo-file", r.spec.file);
    el.setAttribute("data-logo-lockup", r.lockup);
    el.setAttribute("data-logo-box", r.boxW + "x" + r.boxH);
    el.setAttribute("data-logo-pad", String(r.pad));
    return img;
  }

  /* responsive / state variants:
     data-logo-mobile="symbol"      lockup below 640 px
     data-logo-condensed="symbol"   lockup while #siteHeader.is-condensed (header shrink after 80 px) */
  var mq = window.matchMedia("(max-width: 639.98px)");
  function currentLockup(el) {
    var base = el.getAttribute("data-logo-base") || el.getAttribute("data-logo");
    if (!el.hasAttribute("data-logo-base")) el.setAttribute("data-logo-base", base);
    var header = el.closest("#siteHeader");
    if (mq.matches && el.hasAttribute("data-logo-mobile")) return el.getAttribute("data-logo-mobile");
    if (header && header.classList.contains("is-condensed") && el.hasAttribute("data-logo-condensed")) return el.getAttribute("data-logo-condensed");
    return base;
  }
  function mountAll() {
    document.querySelectorAll("[data-logo]").forEach(function (el) {
      var lockup = currentLockup(el);
      var sizeAttr = lockup === el.getAttribute("data-logo-base") ? el.getAttribute("data-logo-size") : (el.getAttribute("data-logo-size-" + lockup) || null);
      mountLogo(el, { lockup: lockup, size: sizeAttr || (lockup !== el.getAttribute("data-logo-base") ? DEFAULT_SIZE[lockup] : null) });
    });
  }

  window.mountLogo = mountLogo;
  window.DeafahLogo = { mountLogo: mountLogo, mountAll: mountAll, resolve: resolve, table: TABLE, files: FILES, box: BOX_RATIO, minWidth: MIN_WIDTH };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mountAll); else mountAll();
  mq.addEventListener("change", mountAll);
  document.addEventListener("deafah:themechange", mountAll);
  document.addEventListener("deafah:langchange", mountAll);
  document.addEventListener("deafah:header", mountAll);
})();
