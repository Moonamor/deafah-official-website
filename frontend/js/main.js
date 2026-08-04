/* ==========================================================================
   Al Deafah International Group — Main interactions
   Navigation, theme toggle, header condense, glass-lite capability check.
   ========================================================================== */

$(function () {
  "use strict";

  var $html = $("html");
  var $header = $("#siteHeader");
  var $themeToggle = $("#themeToggle");
  var $langToggle = $("#langToggle");
  var THEME_KEY = "deafah-theme";
  var LANG_KEY = "deafah-lang";

  function isArabic() {
    return $html.attr("data-lang") !== "en";
  }

  /* -----------------------------------------------------------------------
     Capability check — enable glass-lite fallback where needed
     ------------------------------------------------------------------- */
  function supportsBackdropFilter() {
    return (
      window.CSS &&
      (CSS.supports("backdrop-filter", "blur(1px)") ||
        CSS.supports("-webkit-backdrop-filter", "blur(1px)"))
    );
  }

  var lowEndDevice =
    (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);

  var saveData =
    navigator.connection && navigator.connection.saveData === true;

  if (!supportsBackdropFilter() || lowEndDevice || saveData) {
    $html.addClass("glass-lite");
  }

  /* -----------------------------------------------------------------------
     Theme toggle (dark / light), persisted
     ------------------------------------------------------------------- */
  function applyTheme(theme) {
    $html.attr("data-theme", theme);
    localStorage.setItem(THEME_KEY, theme);
  }

  var savedTheme = localStorage.getItem(THEME_KEY);
  if (savedTheme) {
    applyTheme(savedTheme);
  }

  $themeToggle.on("click", function () {
    var current = $html.attr("data-theme") === "light" ? "light" : "dark";
    applyTheme(current === "light" ? "dark" : "light");
  });

  /* -----------------------------------------------------------------------
     Language toggle (ar / en), persisted. Arabic is the default; the
     dir/lang attributes drive layout mirroring, [data-lang] drives which
     .lang-ar/.lang-en element is visible (see styles.css).
     ------------------------------------------------------------------- */
  function applyLang(lang) {
    $html.attr("data-lang", lang);
    $html.attr("lang", lang);
    $html.attr("dir", lang === "ar" ? "rtl" : "ltr");
    localStorage.setItem(LANG_KEY, lang);
  }

  var savedLang = localStorage.getItem(LANG_KEY);
  if (savedLang) {
    applyLang(savedLang);
  }

  $langToggle.on("click", function () {
    applyLang(isArabic() ? "en" : "ar");
  });

  /* -----------------------------------------------------------------------
     Mobile drawer — handled by Bootstrap's Offcanvas component
     (data-bs-toggle/data-bs-dismiss attributes in the markup); no
     custom JS needed for open/close/backdrop/Esc/focus trap.
     ------------------------------------------------------------------- */

  /* -----------------------------------------------------------------------
     Header condense on scroll
     ------------------------------------------------------------------- */
  var lastScroll = 0;

  $(window).on("scroll", function () {
    var current = $(window).scrollTop();
    $header.toggleClass("is-condensed", current > 80);
    lastScroll = current;
  });

  /* -----------------------------------------------------------------------
     Smooth-scroll anchor links (accounts for sticky header height)
     ------------------------------------------------------------------- */
  $('a[href^="#"]').on("click", function (e) {
    var targetId = $(this).attr("href");
    if (targetId === "#" || targetId === "#top") {
      return;
    }
    var $target = $(targetId);
    if ($target.length) {
      e.preventDefault();
      var headerHeight = $header.outerHeight() || 0;
      $("html, body").animate(
        { scrollTop: $target.offset().top - headerHeight - 16 },
        380
      );
    }
  });

  /* -----------------------------------------------------------------------
     Guest / room stepper
     ------------------------------------------------------------------- */
  var guestCount = 2;
  var $guestCount = $("#guestCount");

  function renderGuestCount() {
    $guestCount.find(".lang-ar").text(guestCount + (guestCount === 1 ? " ضيف" : " ضيوف"));
    $guestCount.find(".lang-en").text(guestCount + (guestCount === 1 ? " Guest" : " Guests"));
  }
  renderGuestCount();

  $("#guestStepper").on("click", ".stepper-btn", function () {
    var action = $(this).data("action");
    if (action === "increment" && guestCount < 12) {
      guestCount += 1;
    } else if (action === "decrement" && guestCount > 1) {
      guestCount -= 1;
    }
    renderGuestCount();
  });

  /* -----------------------------------------------------------------------
     Filter chips (visual state only — this is a static prototype)
     ------------------------------------------------------------------- */
  $(".filter-bar").on("click", ".chip", function () {
    $(this).addClass("is-active").siblings(".chip").removeClass("is-active");
  });

  /* -----------------------------------------------------------------------
     Booking widget submit — demo feedback, no backend
     ------------------------------------------------------------------- */
  $("#bookingWidget").on("submit", function (e) {
    e.preventDefault();
    window.DeafahEffects.showToast(
      isArabic() ? "جاري البحث عن التوفر في 14 فندقًا..." : "Searching availability across 14 hotels…"
    );
  });

  /* -----------------------------------------------------------------------
     Newsletter form — client-side validation only. Two inputs exist
     (#newsletterEmail-ar / -en); only the one matching the active
     language is visible, so read/validate that one.
     ------------------------------------------------------------------- */
  $("#newsletterForm").on("submit", function (e) {
    e.preventDefault();
    var $input = isArabic() ? $("#newsletterEmail-ar") : $("#newsletterEmail-en");
    var $hint = $("#newsletterHint");
    var value = $input.val().trim();
    var emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailPattern.test(value)) {
      $input.addClass("is-invalid");
      $hint.attr("class", "form-hint is-error").text(
        isArabic() ? "يرجى إدخال بريد إلكتروني صحيح." : "Enter a valid email address."
      );
      return;
    }

    $input.removeClass("is-invalid").val("");
    $hint.attr("class", "form-hint is-success").text(
      isArabic() ? "تم الاشتراك — شكرًا لك." : "Subscribed — thank you."
    );
    window.DeafahEffects.showToast(isArabic() ? "تم تسجيلك بنجاح." : "You're on the list.");
  });

  /* -----------------------------------------------------------------------
     Footer year
     ------------------------------------------------------------------- */
  $("#currentYear-ar, #currentYear-en").text(new Date().getFullYear());
});
