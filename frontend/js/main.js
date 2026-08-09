

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

  var lastScroll = 0;

  $(window).on("scroll", function () {
    var current = $(window).scrollTop();
    $header.toggleClass("is-condensed", current > 80);
    lastScroll = current;
  });

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

  $(".filter-bar").on("click", ".chip", function () {
    $(this).addClass("is-active").siblings(".chip").removeClass("is-active");
  });

  $("#bookingWidget").on("submit", function (e) {
    e.preventDefault();
    window.DeafahEffects.showToast(
      isArabic() ? "جاري البحث عن التوفر في 14 فندقًا..." : "Searching availability across 14 hotels…"
    );
  });

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

  var CONTACT_MSG_MIN = 100;
  var CONTACT_MSG_MAX = 200;

  function updateCharCount($textarea) {
    var lang = $textarea.hasClass("lang-ar") ? "ar" : "en";
    var length = $textarea.val().length;

    $('.char-count-value[data-lang="' + lang + '"]').text(length);
    $("#contactCharCount").toggleClass(
      "is-invalid",
      length > 0 && length < CONTACT_MSG_MIN
    );
  }

  $(".contact-message").on("input", function () {
    updateCharCount($(this));
  });

  $("#contactModal").on("show.bs.modal", function () {
    $(this).find(".contact-message").val("");
    $(this).find(".char-count-value").text("0");
    $("#contactCharCount").removeClass("is-invalid");
    $(this).find("input, textarea").removeClass("is-invalid");
  });

  $("#contactForm").on("submit", function (e) {
    e.preventDefault();

    var $message = isArabic() ? $("#contactMessage-ar") : $("#contactMessage-en");
    var length = $message.val().trim().length;

    if (length < CONTACT_MSG_MIN || length > CONTACT_MSG_MAX) {
      $message.addClass("is-invalid");
      $("#contactCharCount").addClass("is-invalid");
      return;
    }

    $message.removeClass("is-invalid");

    var modalEl = document.getElementById("contactModal");
    var modalInstance = bootstrap.Modal.getInstance(modalEl);
    if (modalInstance) {
      modalInstance.hide();
    }

    this.reset();
    window.DeafahEffects.showToast(
      isArabic() ? "تم إرسال رسالتك بنجاح." : "Your message has been sent."
    );
  });

  $("#currentYear-ar, #currentYear-en").text(new Date().getFullYear());
});
