/* ==========================================================================
   Al Deafah International Group — Liquid Glass motion effects
   Blob parallax, card tilt, scroll reveal, count-up stats, toast.
   ========================================================================== */

window.DeafahEffects = (function ($) {
  "use strict";

  var reducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;

  var isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;

  /* -----------------------------------------------------------------------
     Ambient blob parallax — blobs drift slightly toward the pointer
     ------------------------------------------------------------------- */
  function initBlobParallax() {
    if (reducedMotion || isTouch) return;

    var $blobs = $(".blob");
    if (!$blobs.length) return;

    var strengths = [18, 14, 10, 16];

    $(window).on("mousemove", function (e) {
      var xRatio = e.clientX / window.innerWidth - 0.5;
      var yRatio = e.clientY / window.innerHeight - 0.5;

      $blobs.each(function (i) {
        var strength = strengths[i % strengths.length];
        $(this).css(
          "translate",
          xRatio * strength + "px " + yRatio * strength + "px"
        );
      });
    });
  }

  /* -----------------------------------------------------------------------
     Glass card tilt — subtle 3D tilt following the cursor
     ------------------------------------------------------------------- */
  function initCardTilt() {
    if (reducedMotion || isTouch) return;

    var $cards = $(".hotel-card, .why-card");
    $cards.addClass("tilt-target");

    $cards.on("mousemove", function (e) {
      var rect = this.getBoundingClientRect();
      var px = (e.clientX - rect.left) / rect.width - 0.5;
      var py = (e.clientY - rect.top) / rect.height - 0.5;
      var rotateX = (-py * 6).toFixed(2);
      var rotateY = (px * 6).toFixed(2);

      $(this).css(
        "transform",
        "perspective(800px) rotateX(" +
          rotateX +
          "deg) rotateY(" +
          rotateY +
          "deg) translateY(-6px)"
      );
    });

    $cards.on("mouseleave", function () {
      $(this).css("transform", "");
    });
  }

  /* -----------------------------------------------------------------------
     Scroll reveal — now owned by js/animations.js (GSAP + ScrollTrigger).
     Removed here to avoid two engines fighting over the same elements'
     opacity/transform. See js/animations.js "SCROLL-TRIGGERED REVEALS".
     ------------------------------------------------------------------- */

  /* -----------------------------------------------------------------------
     Stat counters — count up once, on entering the viewport
     ------------------------------------------------------------------- */
  function initStatCounters() {
    var $stats = $(".stat-number");
    if (!$stats.length) return;

    function animateCount($el) {
      var target = parseInt($el.data("count-to"), 10) || 0;
      var suffix = $el.data("suffix") || "";
      var duration = reducedMotion ? 1 : 1600;
      var start = null;

      function step(timestamp) {
        if (start === null) start = timestamp;
        var progress = Math.min((timestamp - start) / duration, 1);
        var eased = 1 - Math.pow(1 - progress, 3);
        var value = Math.round(eased * target);
        $el.text(value + suffix);
        if (progress < 1) {
          window.requestAnimationFrame(step);
        }
      }

      window.requestAnimationFrame(step);
    }

    if (!("IntersectionObserver" in window)) {
      $stats.each(function () {
        animateCount($(this));
      });
      return;
    }

    var observer = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            animateCount($(entry.target));
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.4 }
    );

    $stats.each(function () {
      observer.observe(this);
    });
  }

  /* -----------------------------------------------------------------------
     Toast notifications
     ------------------------------------------------------------------- */
  var toastTimer = null;

  function showToast(message) {
    var $toast = $("#toast");
    $toast.text(message).addClass("is-visible");

    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(function () {
      $toast.removeClass("is-visible");
    }, 3200);
  }

  /* -----------------------------------------------------------------------
     Init
     ------------------------------------------------------------------- */
  $(function () {
    initBlobParallax();
    initCardTilt();
    initStatCounters();
  });

  return {
    showToast: showToast
  };
})(jQuery);
