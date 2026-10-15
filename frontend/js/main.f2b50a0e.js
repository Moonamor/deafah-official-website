/* Al Deafah — page behaviour (vanilla rewrite of the previous version).
   Owns ONLY localStorage "deafah-lang" ("ar" | "en"). Scheme/palette belong to auto-theme-manager.js. */
(function () {
  "use strict";

  var root = document.documentElement;
  var LANG_KEY = "deafah-lang";

  function isArabic() { return root.getAttribute("data-lang") !== "en"; }

  function applyLang(lang) {
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang);
    root.setAttribute("dir", lang === "ar" ? "rtl" : "ltr");
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    document.dispatchEvent(new CustomEvent("deafah:langchange", { detail: { lang: lang } }));
  }
  window.DeafahLang = { get: function () { return isArabic() ? "ar" : "en"; }, set: applyLang, isArabic: isArabic };

  document.addEventListener("click", function (e) {
    var t = e.target.closest("#langToggle, [data-lang-toggle]");
    if (t) applyLang(isArabic() ? "en" : "ar");
  });

  /* header: condensed after 80 px, hidden on scroll-down, shown on scroll-up */
  var header = document.getElementById("siteHeader");
  var lastY = window.scrollY, ticking = false;
  function onScroll() {
    var y = window.scrollY;
    if (header) {
      var condensed = y > 80;
      if (header.classList.contains("is-condensed") !== condensed) {
        header.classList.toggle("is-condensed", condensed);
        document.dispatchEvent(new CustomEvent("deafah:header", { detail: { condensed: condensed } }));
      }
      var navOpen = document.querySelector(".nav-links:not([hidden])") && window.matchMedia("(max-width: 1023.98px)").matches;
      header.classList.toggle("is-hidden", y > 160 && y > lastY && !navOpen);
    }
    lastY = y; ticking = false;
  }
  window.addEventListener("scroll", function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* smooth anchors with header offset (Lenis takes over in Phase 4 when present) */
  document.addEventListener("click", function (e) {
    var a = e.target.closest('a[href^="#"]');
    if (!a) return;
    var id = a.getAttribute("href");
    if (id === "#" || id === "#top") return;
    var target = document.querySelector(id);
    if (!target) return;
    e.preventDefault();
    var offset = (header ? header.offsetHeight : 0) + 16;
    var top = target.getBoundingClientRect().top + window.scrollY - offset;
    if (window.lenis && typeof window.lenis.scrollTo === "function") window.lenis.scrollTo(top);
    else window.scrollTo({ top: top, behavior: root.classList.contains("no-motion") ? "auto" : "smooth" });
    history.replaceState(null, "", id);
  });

  /* guest stepper (booking demo) */
  var guestCount = 2;
  var guestEl = document.getElementById("guestCount");
  function renderGuestCount() {
    if (!guestEl) return;
    var ar = guestEl.querySelector(".lang-ar"), en = guestEl.querySelector(".lang-en");
    if (ar) ar.textContent = guestCount + (guestCount === 1 ? " ضيف" : " ضيوف");
    if (en) en.textContent = guestCount + (guestCount === 1 ? " Guest" : " Guests");
  }
  renderGuestCount();
  var stepper = document.getElementById("guestStepper");
  if (stepper) stepper.addEventListener("click", function (e) {
    var b = e.target.closest(".stepper-btn"); if (!b) return;
    var action = b.getAttribute("data-action");
    if (action === "increment" && guestCount < 12) guestCount += 1;
    else if (action === "decrement" && guestCount > 1) guestCount -= 1;
    renderGuestCount();
  });

  /* filter chips (visual only, as before) */
  document.querySelectorAll(".filter-bar").forEach(function (bar) {
    bar.addEventListener("click", function (e) {
      var chip = e.target.closest(".chip"); if (!chip) return;
      bar.querySelectorAll(".chip").forEach(function (c) { c.classList.remove("is-active"); c.setAttribute("aria-pressed", "false"); });
      chip.classList.add("is-active"); chip.setAttribute("aria-pressed", "true");
    });
  });

  /* booking widget — demo */
  var booking = document.getElementById("bookingWidget");
  if (booking) booking.addEventListener("submit", function (e) {
    e.preventDefault();
    var lang = isArabic() ? "ar" : "en";
    var msg = window.DeafahHotelsCopy ? window.DeafahHotelsCopy.get("search_toast", lang) : "";
    window.DeafahEffects.showToast(msg || (isArabic() ? "جاري البحث عن التوفر..." : "Searching availability…"));
  });

  /* newsletter — demo */
  var newsletter = document.getElementById("newsletterForm");
  if (newsletter) newsletter.addEventListener("submit", function (e) {
    e.preventDefault();
    var input = document.getElementById(isArabic() ? "newsletterEmail-ar" : "newsletterEmail-en");
    var hint = document.getElementById("newsletterHint");
    var value = (input.value || "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      input.classList.add("is-invalid");
      hint.className = "form-hint is-error";
      hint.textContent = isArabic() ? "يرجى إدخال بريد إلكتروني صحيح." : "Enter a valid email address.";
      return;
    }
    input.classList.remove("is-invalid"); input.value = "";
    hint.className = "form-hint is-success";
    hint.textContent = isArabic() ? "تم الاشتراك — شكرًا لك." : "Subscribed — thank you.";
    window.DeafahEffects.showToast(isArabic() ? "تم تسجيلك بنجاح." : "You're on the list.");
  });

  /* contact message counter (contact-form.54cb0118.js does the sending) */
  var MIN = 100;
  document.querySelectorAll(".contact-message").forEach(function (ta) {
    ta.addEventListener("input", function () {
      var lang = ta.classList.contains("lang-ar") ? "ar" : "en";
      var len = ta.value.length;
      var out = document.querySelector('.char-count-value[data-lang="' + lang + '"]');
      if (out) out.textContent = len;
      var cc = document.getElementById("contactCharCount");
      if (cc) cc.classList.toggle("is-invalid", len > 0 && len < MIN);
    });
  });
  document.addEventListener("deafah:dialogopen", function (e) {
    if (!e.detail || e.detail.id !== "contactModal") return;
    var dlg = e.detail.dialog;
    dlg.querySelectorAll(".contact-message").forEach(function (ta) { ta.value = ""; });
    dlg.querySelectorAll(".char-count-value").forEach(function (el) { el.textContent = "0"; });
    var cc = document.getElementById("contactCharCount"); if (cc) cc.classList.remove("is-invalid");
    dlg.querySelectorAll("input, textarea").forEach(function (el) { el.classList.remove("is-invalid"); });
  });

  /* demo ribbons (بيانات تجريبية) — dismiss per session */
  document.querySelectorAll(".demo-ribbon").forEach(function (r) {
    var key = "deafah-demo-ribbon-" + (r.getAttribute("data-ribbon") || "x");
    try { if (sessionStorage.getItem(key)) r.hidden = true; } catch (e) {}
    var btn = r.querySelector("[data-dismiss]");
    if (btn) btn.addEventListener("click", function () { r.hidden = true; try { sessionStorage.setItem(key, "1"); } catch (e) {} });
  });

  var y = String(new Date().getFullYear());
  ["currentYear-ar", "currentYear-en"].forEach(function (id) { var el = document.getElementById(id); if (el) el.textContent = y; });
})();
