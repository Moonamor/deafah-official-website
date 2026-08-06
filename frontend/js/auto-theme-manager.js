/* ==========================================================================
   Al Deafah International Group — Automatic time-based theme manager
   ==========================================================================
   Adds sunrise/sunset auto-switching ON TOP OF the existing manual
   light/dark toggle in js/main.js. This file is fully isolated: it does
   not modify main.js, it only reads/writes the same localStorage key
   main.js already owns, plus two new keys of its own, and it attaches
   its OWN click listener to the existing toggle button rather than
   editing main.js's handler.

   Integration assumptions (matching the existing implementation):
   - main.js persists the active theme as localStorage["deafah-theme"] =
     "light" | "dark", and applies it via <html data-theme="...">.
   - The manual toggle button has id="themeToggle".
   If your real key/selector names differ, change the three constants
   at the top of this file — nothing else needs to change.

   Include this file AFTER main.js:
     <script src="js/main.js"></script>
     <script src="js/auto-theme-manager.js"></script>
   (Load order doesn't actually matter for correctness — see the
   setTimeout note on markManualOverride below — but this is the
   conventional order.)
   ========================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     Config — must match the existing theme system
     ------------------------------------------------------------------- */
  var THEME_KEY = "deafah-theme";       // existing key from main.js
  var TOGGLE_SELECTOR = "#themeToggle"; // existing manual toggle button

  /* New keys this file owns; main.js never touches these. */
  var MODE_KEY = "deafah-theme-mode";             // "auto" | "manual"
  var LAST_CHECK_KEY = "deafah-theme-last-check"; // ms timestamp

  var REFRESH_INTERVAL_HOURS = 6; // re-evaluate every 5-6h; using 6 as the cap
  var DAY_START_HOUR = 6;         // 06:00 — sunrise
  var DAY_END_HOUR = 18;          // 18:00 — sunset

  /* -----------------------------------------------------------------------
     Helpers
     ------------------------------------------------------------------- */
  function timeBasedTheme() {
    var hour = new Date().getHours();
    return hour >= DAY_START_HOUR && hour < DAY_END_HOUR ? "light" : "dark";
  }

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  function hoursSince(timestampMs) {
    return (Date.now() - timestampMs) / (1000 * 60 * 60);
  }

  /* Recomputes the theme from device time, applies it, and stamps this
     moment as the last automatic check — this is what "auto mode" means. */
  function runAutoCheck() {
    applyTheme(timeBasedTheme());
    localStorage.setItem(MODE_KEY, "auto");
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  }

  /* -----------------------------------------------------------------------
     First-visit / expiration logic — runs once per page load
     ------------------------------------------------------------------- */
  function init() {
    var savedTheme = localStorage.getItem(THEME_KEY);
    var mode = localStorage.getItem(MODE_KEY);
    var lastCheckRaw = localStorage.getItem(LAST_CHECK_KEY);
    var lastCheck = lastCheckRaw ? parseInt(lastCheckRaw, 10) : NaN;

    // True first visit ever (main.js has nothing saved yet): decide by
    // device time and record it as an auto-mode check.
    if (!savedTheme) {
      runAutoCheck();
      return;
    }

    // A theme is saved but this script has never stamped a mode/timestamp
    // for it (e.g. it was set before this file existed, or storage was
    // partially cleared). Treat it as due for a fresh check.
    if (!mode || isNaN(lastCheck)) {
      runAutoCheck();
      return;
    }

    // Within the 5-6 hour window: change nothing. Whatever main.js already
    // applied on load from localStorage — manual or auto — stands as-is.
    if (hoursSince(lastCheck) < REFRESH_INTERVAL_HOURS) {
      return;
    }

    // Window expired: a manual override (if any) lapses here, and
    // automatic time-of-day evaluation takes over again.
    runAutoCheck();
  }

  /* -----------------------------------------------------------------------
     Manual override tracking
     ------------------------------------------------------------------- */
  function markManualOverride() {
    localStorage.setItem(MODE_KEY, "manual");
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  }

  function bindManualOverrideListener() {
    var toggle = document.querySelector(TOGGLE_SELECTOR);
    if (!toggle) {
      return;
    }

    toggle.addEventListener("click", function () {
      // Deferred to the next tick so it runs after main.js's own click
      // handler has already flipped data-theme/localStorage — this makes
      // the order the two <script> tags are loaded in irrelevant.
      setTimeout(markManualOverride, 0);
    });
  }

  /* -----------------------------------------------------------------------
     Boot
     ------------------------------------------------------------------- */
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      init();
      bindManualOverrideListener();
    });
  } else {
    init();
    bindManualOverrideListener();
  }
})();
