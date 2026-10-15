/* Mobile navigation (replaces the framework collapse plugin). Button [data-nav-toggle] controls #primaryNav. */
(function () {
  "use strict";
  var btn = document.querySelector("[data-nav-toggle]");
  var nav = document.getElementById("primaryNav");
  if (!btn || !nav) return;
  var mq = window.matchMedia("(min-width: 1024px)");

  function setOpen(open) {
    nav.hidden = !open && !mq.matches;
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    btn.setAttribute("aria-label", open ? btn.getAttribute("data-label-close") : btn.getAttribute("data-label-open"));
    var useEl = btn.querySelector("use");
    if (useEl) useEl.setAttribute("href", "assets/icons/sprite.svg#" + (open ? "close" : "menu"));
  }
  function sync() { setOpen(false); }
  mq.addEventListener("change", sync);
  sync();

  btn.addEventListener("click", function () { setOpen(nav.hidden); });
  nav.addEventListener("click", function (e) { if (e.target.closest("a, button") && !mq.matches) setOpen(false); });
  document.addEventListener("keydown", function (e) { if (e.key === "Escape" && !nav.hidden && !mq.matches) { setOpen(false); btn.focus(); } });
  document.addEventListener("click", function (e) { if (!mq.matches && !nav.hidden && !e.target.closest("#siteHeader")) setOpen(false); });
})();
