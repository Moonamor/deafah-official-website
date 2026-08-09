

(function () {
  "use strict";

  var THEME_KEY = "deafah-theme";
  var TOGGLE_SELECTOR = "#themeToggle";

  var MODE_KEY = "deafah-theme-mode";
  var LAST_CHECK_KEY = "deafah-theme-last-check";

  var REFRESH_INTERVAL_HOURS = 6;
  var DAY_START_HOUR = 6;
  var DAY_END_HOUR = 18;

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

  function runAutoCheck() {
    applyTheme(timeBasedTheme());
    localStorage.setItem(MODE_KEY, "auto");
    localStorage.setItem(LAST_CHECK_KEY, String(Date.now()));
  }

  function init() {
    var savedTheme = localStorage.getItem(THEME_KEY);
    var mode = localStorage.getItem(MODE_KEY);
    var lastCheckRaw = localStorage.getItem(LAST_CHECK_KEY);
    var lastCheck = lastCheckRaw ? parseInt(lastCheckRaw, 10) : NaN;

    if (!savedTheme) {
      runAutoCheck();
      return;
    }

    if (!mode || isNaN(lastCheck)) {
      runAutoCheck();
      return;
    }

    if (hoursSince(lastCheck) < REFRESH_INTERVAL_HOURS) {
      return;
    }

    runAutoCheck();
  }

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

      setTimeout(markManualOverride, 0);
    });
  }

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
