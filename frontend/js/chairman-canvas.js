

(function () {
  "use strict";

  var canvas = document.getElementById("chairmanCanvas");
  if (!canvas || !canvas.getContext) {
    return;
  }

  var ctx = canvas.getContext("2d");

  function cssVar(name, fallback) {
    var value = getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
    return value || fallback;
  }

  function hexToRgba(hex, alpha) {
    hex = (hex || "#b89047").replace("#", "");
    if (hex.length === 3) {
      hex = hex
        .split("")
        .map(function (c) {
          return c + c;
        })
        .join("");
    }
    var r = parseInt(hex.substring(0, 2), 16);
    var g = parseInt(hex.substring(2, 4), 16);
    var b = parseInt(hex.substring(4, 6), 16);
    return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
  }

  function drawStar(cx, cy, r, strokeStyle) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = 1;

    for (var square = 0; square < 2; square++) {
      ctx.rotate(square === 0 ? 0 : Math.PI / 4);
      ctx.beginPath();
      for (var side = 0; side < 4; side++) {
        var angle = (side / 4) * Math.PI * 2;
        ctx.moveTo(Math.cos(angle) * r, Math.sin(angle) * r);
        ctx.lineTo(Math.cos(angle + Math.PI) * r, Math.sin(angle + Math.PI) * r);
      }
      ctx.stroke();
    }
    ctx.restore();
  }

  function render() {
    var section = canvas.closest(".chairman-section");
    if (!section) {
      return;
    }

    var rect = section.getBoundingClientRect();
    var width = Math.max(rect.width, 1);
    var height = Math.max(rect.height, 1);
    var dpr = window.devicePixelRatio || 1;

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = width + "px";
    canvas.style.height = height + "px";
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    var bg = cssVar("--color-bg", "#fcfaf6");
    var bgAlt = cssVar("--color-bg-alt", "#f2ece0");
    var accent = cssVar("--color-accent", "#b89047");

    var gradient = ctx.createLinearGradient(0, 0, width, height);
    gradient.addColorStop(0, bgAlt);
    gradient.addColorStop(1, bg);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);

    var spacing = 96;
    var starColor = hexToRgba(accent, 0.16);
    var cols = Math.ceil(width / spacing) + 1;
    var rows = Math.ceil(height / spacing) + 1;

    for (var row = 0; row <= rows; row++) {
      for (var col = 0; col <= cols; col++) {
        var offsetX = (row % 2) * (spacing / 2);
        drawStar(col * spacing + offsetX, row * spacing, spacing * 0.4, starColor);
      }
    }
  }

  var resizeTimer;
  window.addEventListener("resize", function () {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(render, 150);
  });

  var themeObserver = new MutationObserver(function (mutations) {
    var themeChanged = mutations.some(function (mutation) {
      return mutation.attributeName === "data-theme";
    });
    if (themeChanged) {
      render();
    }
  });
  themeObserver.observe(document.documentElement, { attributes: true });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render);
  } else {
    render();
  }
})();
