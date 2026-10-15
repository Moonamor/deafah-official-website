/* Al Deafah — theme switcher badge (Phase 3).
   Fixed at bottom 16 px / inset-inline-start 16 px (bottom-left in RTL, bottom-right in LTR).
   Collapsed: a 44 px chip with the current theme's colour dot. Expanded: 4 palette swatches (radiogroup) + light/dark/auto.
   Wired to window.DeafahTheme (auto-theme-manager.js): "auto" restores the time-of-day behaviour, explicit choices persist
   through the existing keys (deafah-theme, deafah-theme-mode, deafah-theme-last-check) and deafah-palette. No new keys.
   Keyboard: Enter/Space opens, Esc closes (focus returns to the chip); arrows move within a group (direction-aware),
   Home/End jump, Space/Enter select; Tab leaves the badge and closes it. The markup is generated here once per page. */
(function () {
  "use strict";
  if (!window.DeafahTheme) return;
  var T = window.DeafahTheme;
  var root = document.documentElement;

  var PALETTES = [
    { id: "default", ar: "الأساسي", en: "Default" },
    { id: "green",   ar: "الأخضر",  en: "Green" },
    { id: "red",     ar: "الأحمر",  en: "Red" },
    { id: "blue",    ar: "الأزرق",  en: "Blue" }
  ];
  var SCHEMES = [
    { id: "light", ar: "فاتح",   en: "Light", icon: "sun" },
    { id: "dark",  ar: "داكن",   en: "Dark",  icon: "moon" },
    { id: "auto",  ar: "تلقائي", en: "Auto",  icon: "auto" }
  ];
  var SPRITE = (document.currentScript && document.currentScript.getAttribute("data-sprite")) || "assets/icons/sprite.svg";
  window.__spriteHref = SPRITE;

  function bi(ar, en) { return '<span class="lang-ar">' + ar + '</span><span class="lang-en">' + en + "</span>"; }
  function icon(name, cls) { return '<svg class="icon ' + (cls || "icon--sm") + '" aria-hidden="true"><use href="' + SPRITE + "#" + name + '"></use></svg>'; }

  /* ---- markup ---- */
  var badge = document.createElement("div");
  badge.className = "theme-badge";
  badge.id = "themeBadge";
  badge.innerHTML =
    '<button type="button" class="theme-badge__chip" id="themeBadgeChip" aria-expanded="false" aria-controls="themeBadgePanel" aria-haspopup="true">' +
      '<span class="theme-badge__dot" aria-hidden="true"></span>' +
      icon("palette") +
      '<span class="sr-only">' + bi("المظهر والألوان", "Appearance and colours") + "</span>" +
    "</button>" +
    '<div class="theme-badge__panel" id="themeBadgePanel" role="dialog" aria-labelledby="themeBadgeTitle" hidden>' +
      '<p class="t-label theme-badge__title" id="themeBadgeTitle">' + bi("المظهر", "Appearance") + "</p>" +
      '<p class="theme-badge__group-label" id="themeBadgePaletteLabel">' + bi("اللوحة", "Palette") + "</p>" +
      '<div class="theme-badge__palettes" role="radiogroup" aria-labelledby="themeBadgePaletteLabel">' +
        PALETTES.map(function (p) {
          return '<button type="button" role="radio" aria-checked="false" tabindex="-1" data-palette="' + p.id + '" class="theme-badge__swatch">' +
            '<span class="theme-badge__dot theme-badge__dot--' + p.id + '" aria-hidden="true"></span>' + bi(p.ar, p.en) + "</button>";
        }).join("") +
      "</div>" +
      '<p class="theme-badge__group-label" id="themeBadgeSchemeLabel">' + bi("الوضع", "Mode") + "</p>" +
      '<div class="theme-badge__schemes" role="group" aria-labelledby="themeBadgeSchemeLabel">' +
        SCHEMES.map(function (s) {
          return '<button type="button" aria-pressed="false" tabindex="-1" data-scheme="' + s.id + '" class="theme-badge__scheme">' + icon(s.icon) + bi(s.ar, s.en) + "</button>";
        }).join("") +
      "</div>" +
    "</div>";
  document.body.appendChild(badge);

  var chip = badge.querySelector("#themeBadgeChip");
  var panel = badge.querySelector("#themeBadgePanel");
  var swatches = Array.prototype.slice.call(badge.querySelectorAll("[data-palette]"));
  var schemes = Array.prototype.slice.call(badge.querySelectorAll("[data-scheme]"));

  /* ---- state → UI ---- */
  function sync() {
    var palette = T.getPalette(), scheme = T.getScheme(), mode = T.getMode();
    var activeScheme = mode === "auto" ? "auto" : scheme;
    swatches.forEach(function (b) {
      var on = b.getAttribute("data-palette") === palette;
      b.setAttribute("aria-checked", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    schemes.forEach(function (b, i) {
      var on = b.getAttribute("data-scheme") === activeScheme;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      b.tabIndex = on ? 0 : -1;
    });
    if (!schemes.some(function (b) { return b.tabIndex === 0; })) schemes[0].tabIndex = 0;
    badge.setAttribute("data-current-palette", palette);
    badge.setAttribute("data-mode", mode);
  }

  /* 200 ms token crossfade around a change (CSS: html.theme-anim) */
  var animTimer = null;
  function withCrossfade(fn) {
    if (!root.classList.contains("no-motion")) {
      root.classList.add("theme-anim");
      clearTimeout(animTimer);
      animTimer = setTimeout(function () { root.classList.remove("theme-anim"); }, 240);
    }
    fn();
  }

  /* ---- open / close ---- */
  function setOpen(open) {
    panel.hidden = !open;
    chip.setAttribute("aria-expanded", open ? "true" : "false");
    badge.classList.toggle("is-open", open);
    if (open) {
      sync();
      var first = swatches.filter(function (b) { return b.tabIndex === 0; })[0] || swatches[0];
      first.focus();
    }
  }
  function isOpen() { return !panel.hidden; }

  chip.addEventListener("click", function () { setOpen(!isOpen()); });

  /* selection */
  badge.addEventListener("click", function (e) {
    var sw = e.target.closest(".theme-badge__swatch");
    if (sw) { withCrossfade(function () { T.setPalette(sw.getAttribute("data-palette")); }); sync(); return; }
    var sc = e.target.closest(".theme-badge__scheme");
    if (sc) { withCrossfade(function () { T.setScheme(sc.getAttribute("data-scheme")); }); sync(); }
  });

  /* keyboard: roving tabindex within each group, direction-aware arrows */
  function moveWithin(list, current, delta) {
    var i = list.indexOf(current);
    var n = (i + delta + list.length) % list.length;
    list[n].focus();
    return list[n];
  }
  badge.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (isOpen()) { e.preventDefault(); setOpen(false); chip.focus(); } return; }
    var target = e.target;
    var list = target.closest(".theme-badge__palettes") ? swatches : target.closest(".theme-badge__schemes") ? schemes : null;
    if (!list) return;
    var rtl = (root.getAttribute("dir") || "rtl") === "rtl";
    var next = null;
    switch (e.key) {
      case "ArrowRight": next = moveWithin(list, target, rtl ? -1 : 1); break;
      case "ArrowLeft":  next = moveWithin(list, target, rtl ? 1 : -1); break;
      case "ArrowDown":  next = moveWithin(list, target, 1); break;
      case "ArrowUp":    next = moveWithin(list, target, -1); break;
      case "Home":       next = list[0]; next.focus(); break;
      case "End":        next = list[list.length - 1]; next.focus(); break;
      case " ": case "Enter": e.preventDefault(); target.click(); return;
      default: return;
    }
    e.preventDefault();
    if (list === swatches && next) next.click(); /* radios select on move */
  });

  /* close on outside click, on focus leaving the badge, and on resize to avoid stale geometry */
  document.addEventListener("click", function (e) { if (isOpen() && !badge.contains(e.target)) setOpen(false); });
  badge.addEventListener("focusout", function (e) { if (isOpen() && !badge.contains(e.relatedTarget)) setOpen(false); });
  document.addEventListener("deafah:themechange", sync);
  document.addEventListener("deafah:langchange", sync);

  sync();
  window.DeafahThemeBadge = { open: function () { setOpen(true); }, close: function () { setOpen(false); }, sync: sync, element: badge };
})();
