/* ==========================================================================
   Al Deafah International Group — Scroll & Interaction Animations
   ==========================================================================
   Powered by GSAP + ScrollTrigger (CDN, see index.html <script> tags).
   Fully isolated from main.js / effects.js: it does not modify either
   file's behavior. It DOES take over the .reveal fade-in job that used
   to live in effects.js (removed there) — two engines writing
   opacity/transform on the same elements would visibly fight each
   other, so this file is now the single owner of that concern.

   Untouched, still owned by effects.js: blob mouse-parallax, the
   hotel/why-card 3D tilt, stat count-up, and the toast helper.

   To disable any one animation block below, comment out its call in
   the INIT section near the bottom — each block is a standalone
   function with no dependency on the others.
   ========================================================================== */

(function () {
  "use strict";

  /* -----------------------------------------------------------------------
     SAFETY GUARDS — must run before anything else touches .reveal
     ------------------------------------------------------------------- */

  // If the GSAP CDN failed to load (offline, blocked, etc.), reveal
  // everything immediately so content is never stuck invisible — the
  // .reveal base CSS state is opacity:0 by design (see styles.css).
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

  // Accessibility compliance: skip every animation below, snap
  // everything to its resting/visible state instead.
  if (prefersReducedMotion) {
    gsap.set(".reveal", { opacity: 1, y: 0, scale: 1 });
    return;
  }

  var isTouch = window.matchMedia("(hover: none)").matches;

  /* -----------------------------------------------------------------------
     HERO SECTION ANIMATIONS
     Above-the-fold content, so it plays once immediately on load rather
     than waiting on a scroll trigger: eyebrow -> title -> sub ->
     booking widget, staggered in.
     ------------------------------------------------------------------- */
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

  /* -----------------------------------------------------------------------
     SCROLL-TRIGGERED REVEALS
     Every .reveal element outside the hero (Why-Deafah cards, filter
     bar, hotel cards, stats, CTA band) fades/lifts/scales in once as
     it enters the viewport. Elements that enter together (e.g. the
     four Why-Deafah cards) are batched so they stagger as a group
     instead of firing individually.
     ------------------------------------------------------------------- */
  function initScrollReveals() {
    if (!ScrollTrigger) {
      // No ScrollTrigger available for some reason — still reveal
      // everything so content isn't permanently hidden.
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

  /* -----------------------------------------------------------------------
     MICRO-INTERACTIONS
     A satisfying press-and-release bounce on click/tap for buttons,
     icon buttons, filter chips, and the stepper +/- controls.
     Deliberately excludes .hotel-card / .why-card — those already
     have their own continuous 3D-tilt transform in effects.js, and a
     second animation engine writing "transform" on the same elements
     would fight it.
     ------------------------------------------------------------------- */
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

  /* -----------------------------------------------------------------------
     MAGNETIC CTA BUTTONS
     The primary calls-to-action (hero "Explore Services"-style buttons
     and the header "Book Now") subtly pull toward the cursor within
     their own bounds, then spring back on mouse-leave. Skipped on
     touch devices, where hover has no meaning.
     ------------------------------------------------------------------- */
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

  /* -----------------------------------------------------------------------
     HERO SCROLL PARALLAX
     As the user scrolls past the hero, its content drifts upward at a
     different rate than the page scroll — a classic depth cue. This is
     scroll-linked and complements (not duplicates) the mouse-linked
     ambient blob parallax already running in effects.js.
     ------------------------------------------------------------------- */
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

  /* -----------------------------------------------------------------------
     INIT — comment out any line here to disable that animation block
     ------------------------------------------------------------------- */
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
})();
