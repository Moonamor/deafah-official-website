/* Al Deafah — theme manager (SINGLE OWNER of scheme + palette).
   Base: the original time-of-day script. Preserved behaviour and keys:
     localStorage "deafah-theme"            "light" | "dark"   (the applied scheme)
     localStorage "deafah-theme-mode"       "auto"  | "manual" (manual = the user chose explicitly)
     localStorage "deafah-theme-last-check" ms timestamp of the last auto evaluation
     light between 06:00 and 18:00 local time; an auto re-check runs when the last check is ≥ 6 h old.
   Extensions (Phase 1):
     - writes <html data-scheme> (light/dark) instead of data-theme, which now carries the PALETTE
     - localStorage "deafah-palette"        "default" | "green" | "red" | "blue"
     - public API window.DeafahTheme { getScheme, setScheme, getMode, getPalette, setPalette, subscribe, timeBasedTheme }
     - any element with [data-theme-toggle] flips the scheme (replaces the duplicate toggle that lived in main.js) */
(function () {
  "use strict";

  var THEME_KEY = "deafah-theme";
  var MODE_KEY = "deafah-theme-mode";
  var LAST_CHECK_KEY = "deafah-theme-last-check";
  var PALETTE_KEY = "deafah-palette";
  var TOGGLE_SELECTOR = "#themeToggle, [data-theme-toggle]";

  var REFRESH_INTERVAL_HOURS = 6;
  var DAY_START_HOUR = 6;
  var DAY_END_HOUR = 18;
  var PALETTES = ["default", "green", "red", "blue"];

  var listeners = [];
  var root = document.documentElement;

  function get(key) { try { return localStorage.getItem(key); } catch (e) { return null; } }
  function set(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }

  function timeBasedTheme() {
    var hour = new Date().getHours();
    return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? "light" : "dark";
  }

  function emit() {
    var state = { scheme: getScheme(), palette: getPalette(), mode: getMode() };
    listeners.forEach(function (fn) { try { fn(state); } catch (e) {} });
    document.dispatchEvent(new CustomEvent("deafah:themechange", { detail: state }));
  }

  function applyTheme(theme) {
    root.setAttribute("data-scheme", theme);
    set(THEME_KEY, theme);
    emit();
  }

  function hoursSince(timestampMs) {
    return (Date.now() - timestampMs) / (1000 * 60 * 60);
  }

  function runAutoCheck() {
    applyTheme(timeBasedTheme());
    set(MODE_KEY, "auto");
    set(LAST_CHECK_KEY, String(Date.now()));
  }

  function init() {
    var savedTheme = get(THEME_KEY);
    var mode = get(MODE_KEY);
    var lastCheckRaw = get(LAST_CHECK_KEY);
    var lastCheck = lastCheckRaw ? parseInt(lastCheckRaw, 10) : NaN;

    applyPalette(getPalette(), false);

    if (!savedTheme) { runAutoCheck(); return; }
    if (!mode || isNaN(lastCheck)) { runAutoCheck(); return; }
    if (hoursSince(lastCheck) < REFRESH_INTERVAL_HOURS) {
      /* keep what the pre-paint script set; make sure the attribute matches storage */
      if (root.getAttribute("data-scheme") !== savedTheme) applyTheme(savedTheme);
      return;
    }
    runAutoCheck();
  }

  function markManualOverride() {
    set(MODE_KEY, "manual");
    set(LAST_CHECK_KEY, String(Date.now()));
  }

  /* ---- public API ---- */
  function getScheme() { return root.getAttribute("data-scheme") === "dark" ? "dark" : "light"; }
  function getMode() { return get(MODE_KEY) === "manual" ? "manual" : "auto"; }
  function setScheme(value) {
    if (value === "auto") { runAutoCheck(); return; }
    if (value !== "light" && value !== "dark") return;
    applyTheme(value);
    markManualOverride();
  }
  function getPalette() {
    var p = get(PALETTE_KEY);
    return PALETTES.indexOf(p) === -1 ? "default" : p;
  }
  function applyPalette(value, persist) {
    if (PALETTES.indexOf(value) === -1) value = "default";
    root.setAttribute("data-theme", value);
    if (persist !== false) set(PALETTE_KEY, value);
  }
  function setPalette(value) { applyPalette(value, true); emit(); }
  function subscribe(fn) { if (typeof fn === "function") listeners.push(fn); return function () { listeners = listeners.filter(function (f) { return f !== fn; }); }; }

  window.DeafahTheme = {
    getScheme: getScheme, setScheme: setScheme, getMode: getMode,
    getPalette: getPalette, setPalette: setPalette, subscribe: subscribe,
    timeBasedTheme: timeBasedTheme, palettes: PALETTES.slice()
  };

  function bindManualOverrideListener() {
    document.addEventListener("click", function (e) {
      var toggle = e.target.closest(TOGGLE_SELECTOR);
      if (!toggle) return;
      setScheme(getScheme() === "light" ? "dark" : "light");
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { init(); bindManualOverrideListener(); });
  } else {
    init();
    bindManualOverrideListener();
  }
})();
