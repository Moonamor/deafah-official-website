(function () {
  "use strict";

  var hero = document.getElementById("chairmanHero");
  if (!hero) return;

  var prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (prefersReducedMotion) return;

  var isTouch = window.matchMedia("(hover: none)").matches;
  var floats = hero.querySelectorAll(".chairman-float");

  if (!isTouch) {
    hero.addEventListener("mousemove", function (e) {
      var rect = hero.getBoundingClientRect();
      var xRatio = (e.clientX - rect.left) / rect.width - 0.5;
      var yRatio = (e.clientY - rect.top) / rect.height - 0.5;

      floats.forEach(function (el, i) {
        var strength = 10 + i * 6;
        el.style.translate = xRatio * strength + "px " + yRatio * strength + "px";
      });
    });

    hero.addEventListener("mouseleave", function () {
      floats.forEach(function (el) {
        el.style.translate = "0px 0px";
      });
    });
  }

  if (!isTouch && window.gsap && window.ScrollTrigger) {
    window.gsap.to(hero, {
      y: -36,
      ease: "none",
      scrollTrigger: {
        trigger: hero,
        start: "top bottom",
        end: "bottom top",
        scrub: true
      }
    });
  }
})();
