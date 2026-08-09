

(function () {
  "use strict";

  if (typeof window.gsap === "undefined") {
    document.querySelectorAll(".reveal").forEach(function (el) {
      el.style.opacity = "1";
      el.style.transform = "none";
    });
    return;
  }

  var gsap = window.gsap;
  var ScrollTrigger = window.ScrollTrigger;
  if (ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
  }

  var prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  if (prefersReducedMotion) {
    gsap.set(".reveal", { opacity: 1, y: 0, scale: 1 });
    return;
  }

  var isTouch = window.matchMedia("(hover: none)").matches;

  function initHeroEntrance() {
    var hero = document.querySelector(".hero");
    if (!hero) return;

    var elements = hero.querySelectorAll(".reveal");
    if (!elements.length) return;

    gsap.set(elements, { opacity: 0, y: 32 });

    gsap.to(elements, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: "power3.out",
      stagger: 0.12,
      delay: 0.15
    });
  }

  function initScrollReveals() {
    if (!ScrollTrigger) {

      gsap.set(".reveal", { opacity: 1, y: 0, scale: 1 });
      return;
    }

    var elements = Array.prototype.filter.call(
      document.querySelectorAll(".reveal"),
      function (el) {
        return !el.closest(".hero");
      }
    );
    if (!elements.length) return;

    gsap.set(elements, { opacity: 0, y: 32, scale: 0.97 });

    ScrollTrigger.batch(elements, {
      start: "top 88%",
      once: true,
      onEnter: function (batch) {
        gsap.to(batch, {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.7,
          ease: "power2.out",
          stagger: 0.1
        });
      }
    });
  }

  function initMicroInteractions() {
    var pressTargets = document.querySelectorAll(
      ".btn, .icon-btn, .chip, .stepper-btn"
    );

    pressTargets.forEach(function (el) {
      el.addEventListener("pointerdown", function () {
        gsap.to(el, { scale: 0.92, duration: 0.12, ease: "power2.out" });
      });

      var release = function () {
        gsap.to(el, { scale: 1, duration: 0.45, ease: "back.out(3)" });
      };
      el.addEventListener("pointerup", release);
      el.addEventListener("pointerleave", release);
    });
  }

  function initMagneticButtons() {
    if (isTouch) return;

    var magnets = document.querySelectorAll(".btn-primary.btn-lg, .header-cta");

    magnets.forEach(function (el) {
      el.addEventListener("mousemove", function (e) {
        var rect = el.getBoundingClientRect();
        var x = e.clientX - rect.left - rect.width / 2;
        var y = e.clientY - rect.top - rect.height / 2;
        gsap.to(el, { x: x * 0.25, y: y * 0.4, duration: 0.4, ease: "power2.out" });
      });

      el.addEventListener("mouseleave", function () {
        gsap.to(el, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      });
    });
  }

  function initHeroParallax() {
    if (!ScrollTrigger || isTouch) return;

    var heroInner = document.querySelector(".hero-inner");
    if (!heroInner) return;

    gsap.to(heroInner, {
      y: -80,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true
      }
    });
  }

  function init() {
    initHeroEntrance();
    initScrollReveals();
    initMicroInteractions();
    initMagneticButtons();
    initHeroParallax();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  if (ScrollTrigger) {
    window.addEventListener("load", function () {
      ScrollTrigger.refresh();
    });
  }
})();
