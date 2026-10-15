/* PRE-PAINT. This file is the source of truth for the inline <script> placed in every page's <head>
   BEFORE any stylesheet (the QA grep checks that the inline copy matches this file byte-for-byte).
   It reads the existing storage keys and sets the html attributes synchronously, so there is no light flash. */
(function () {
  try {
    var d = document.documentElement, ls = window.localStorage;
    var scheme = ls.getItem("deafah-theme");            /* "light" | "dark" (existing key, owned by auto-theme-manager.js) */
    var mode = ls.getItem("deafah-theme-mode");          /* "auto" | "manual" */
    var palette = ls.getItem("deafah-palette");          /* "default" | "green" | "red" | "blue" (new) */
    var lang = ls.getItem("deafah-lang");                /* "ar" | "en" (owned by main.js) */
    if (!scheme || mode !== "manual") { var h = new Date().getHours(); scheme = h >= 6 && h < 18 ? "light" : "dark"; }
    if (scheme !== "light" && scheme !== "dark") scheme = "light";
    if (["default", "green", "red", "blue"].indexOf(palette) === -1) palette = "default";
    if (lang !== "en") lang = "ar";
    d.setAttribute("data-scheme", scheme);
    d.setAttribute("data-theme", palette);
    d.setAttribute("data-lang", lang);
    d.setAttribute("lang", lang);
    d.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) d.classList.add("no-motion");
  } catch (e) {}
})();
