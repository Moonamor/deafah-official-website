/* Taj Park 3D — loader (classic script, tiny). For every [data-scene="taj-park-3d"]:
   shows the poster, and only when the section comes within one viewport imports three.min.js + the scene module.
   Stays on the poster when: prefers-reduced-motion / html.no-motion, navigator.connection.saveData, or no WebGL.
   Performance marks: tp3d:near → tp3d:import-start → tp3d:module-ready → tp3d:first-frame (time-to-interactive = first-frame − near). */
(function () {
  "use strict";
  var root = document.documentElement;
  var sections = document.querySelectorAll('[data-scene="taj-park-3d"]');
  if (!sections.length) return;

  function reduce() { return root.classList.contains("no-motion") || window.matchMedia("(prefers-reduced-motion: reduce)").matches; }
  function saveData() { var c = navigator.connection; return !!(c && c.saveData); }
  function webgl() { try { var c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch (e) { return false; } }

  sections.forEach(function (section) {
    var reason = reduce() ? "reduced-motion" : saveData() ? "save-data" : !webgl() ? "no-webgl" : null;
    if (reason) { section.setAttribute("data-3d", "poster"); section.setAttribute("data-3d-reason", reason); return; }
    section.setAttribute("data-3d", "waiting");
    var src = section.getAttribute("data-module") || "js/taj-park-3d.js";
    var started = false;
    function boot() {
      if (started) return; started = true;
      performance.mark("tp3d:near");
      section.setAttribute("data-3d", "loading");
      performance.mark("tp3d:import-start");
      import(src).then(function (mod) {
        return mod.mount(section, { reduce: false });
      }).catch(function (err) {
        console.error("[taj-park-3d] failed, keeping the poster", err);
        section.setAttribute("data-3d", "poster"); section.setAttribute("data-3d-reason", "error");
      });
    }
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (es) { if (es.some(function (e) { return e.isIntersecting; })) { io.disconnect(); boot(); } }, { rootMargin: "100% 0px" });
      io.observe(section);
    } else boot();
  });

  window.DeafahTajParkLoader = {
    timings: function () {
      var get = function (n) { var m = performance.getEntriesByName(n)[0]; return m ? +m.startTime.toFixed(1) : null; };
      var near = get("tp3d:near"), first = get("tp3d:first-frame");
      return { near: near, importStart: get("tp3d:import-start"), moduleReady: get("tp3d:module-ready"), firstFrame: first, ttiMs: near !== null && first !== null ? +(first - near).toFixed(1) : null };
    }
  };
})();
