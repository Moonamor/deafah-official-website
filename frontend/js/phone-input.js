(function () {
  "use strict";

  var COUNTRIES = window.DeafahCountries || [];
  var DEFAULT_ISO2 = "SA";
  var instances = {};
  var uid = 0;

  var MESSAGES = {
    ar: {
      searchPlaceholder: "ابحث عن دولة...",
      invalidLength: function (c) {
        return "رقم الجوال يجب أن يتكون من " + lengthLabel(c) + " أرقام لـ" + c.arName;
      },
      required: "الرجاء إدخال رقم الجوال."
    },
    en: {
      searchPlaceholder: "Search country...",
      invalidLength: function (c) {
        return "Mobile number must be " + lengthLabel(c) + " digits for " + c.enName;
      },
      required: "Please enter a mobile number."
    }
  };

  function lengthLabel(c) {
    return c.minLength === c.maxLength ? String(c.minLength) : c.minLength + "-" + c.maxLength;
  }

  // Arabic normalization for search: unify letter variants that a Saudi
  // user's IME/keyboard commonly produces interchangeably (alef forms,
  // taa marbuta/haa, alef maqsura/yaa, hamza carriers), and strip
  // tashkeel (Arabic diacritics, U+064B-U+0652) and tatweel (U+0640) so
  // "السعوديه" / "السعودية" / "الَسعودية" all match the same entry.
  function normalizeArabic(str) {
    return String(str)
      .replace(/[أإآٱ]/g, "ا")
      .replace(/ة/g, "ه")
      .replace(/ى/g, "ي")
      .replace(/ؤ/g, "و")
      .replace(/ئ/g, "ي")
      .replace(/[ً-ْـ]/g, "");
  }

  function normalizeLatin(str) {
    return String(str)
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase();
  }

  function normalizeQuery(str) {
    return normalizeLatin(normalizeArabic(str)).trim();
  }

  // Eastern-Arabic / Persian digit normalization, duplicated (not
  // imported) from js/contact-form.js by design — this file must stay
  // self-contained per the "own dedicated file" constraint.
  function normalizeDigits(value) {
    var eastern = "٠١٢٣٤٥٦٧٨٩";
    var persian = "۰۱۲۳۴۵۶۷۸۹";
    return String(value).replace(/[٠-٩۰-۹]/g, function (ch) {
      var idx = eastern.indexOf(ch);
      if (idx === -1) idx = persian.indexOf(ch);
      return idx === -1 ? ch : String(idx);
    });
  }

  function digitsOnly(value) {
    return normalizeDigits(value).replace(/[^\d]/g, "");
  }

  // Leading trunk-zero rule: a single leading "0" (national dialing
  // prefix) is not part of the E.164 national significant number, so
  // it is stripped before validation/storage — 0501234567 -> 501234567.
  function stripTrunkZero(digits) {
    return digits.length > 1 && digits.charAt(0) === "0" ? digits.slice(1) : digits;
  }

  function flagEmoji(iso2) {
    return iso2
      .toUpperCase()
      .replace(/./g, function (ch) {
        return String.fromCodePoint(127397 + ch.charCodeAt(0));
      });
  }

  function findCountry(iso2) {
    for (var i = 0; i < COUNTRIES.length; i++) {
      if (COUNTRIES[i].iso2 === iso2) return COUNTRIES[i];
    }
    return COUNTRIES[0];
  }

  // Longest-dial-code-match resolution for smart paste: "+1868..." must
  // resolve to Trinidad and Tobago (+1868), not Canada/US (+1), so every
  // candidate whose dialCode is a prefix of the pasted digits is
  // collected and the longest one wins.
  function resolveDialCode(plusDigits) {
    var best = null;
    for (var i = 0; i < COUNTRIES.length; i++) {
      var c = COUNTRIES[i];
      if (plusDigits.indexOf(c.dialCode) === 0) {
        if (!best || c.dialCode.length > best.dialCode.length) best = c;
      }
    }
    return best;
  }

  function activeLang() {
    var lang = document.documentElement.lang || "ar";
    return lang.indexOf("en") === 0 ? "en" : "ar";
  }

  function matches(country, query) {
    if (!query) return true;
    var qDigits = query.replace(/^\+/, "");
    if (/^\d+$/.test(qDigits) && country.dialCode.replace("+", "").indexOf(qDigits) === 0) return true;
    var qNorm = normalizeQuery(query);
    return (
      normalizeQuery(country.arName).indexOf(qNorm) !== -1 ||
      normalizeLatin(country.enName).indexOf(normalizeLatin(query)) !== -1 ||
      country.iso2.toLowerCase().indexOf(qNorm) !== -1
    );
  }

  function mount(selector, options) {
    var host = typeof selector === "string" ? document.querySelector(selector) : selector;
    if (!host) return null;

    options = options || {};
    var lang = options.lang === "en" ? "en" : "ar";
    var idBase = options.idBase || host.id || "pi-" + ++uid;
    var defaultIso2 = options.defaultCountry || DEFAULT_ISO2;

    var state = {
      country: findCountry(defaultIso2),
      digits: "",
      touched: false,
      isValid: false,
      open: false,
      activeIndex: -1
    };

    // ---- build DOM -------------------------------------------------
    // Note: `dir` is deliberately left to inherit from the page (rtl by
    // default) so the flex row below flips sides automatically between
    // RTL/LTR. Only the number input itself is forced dir="ltr" (see
    // template below), since phone digits always read left-to-right.
    host.classList.add("pi-root");

    var listboxId = idBase + "-listbox";
    var errorId = idBase + "-error";

    host.innerHTML =
      '<div class="pi-control">' +
      '<button type="button" class="pi-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="' + listboxId + '">' +
      '<span class="pi-flag" aria-hidden="true"></span>' +
      '<span class="pi-dial"></span>' +
      '<i class="fa-solid fa-chevron-down pi-caret" aria-hidden="true"></i>' +
      "</button>" +
      '<input type="tel" inputmode="numeric" autocomplete="tel-national" dir="ltr" class="pi-number" id="' + idBase + '-number" aria-describedby="' + errorId + '">' +
      "</div>" +
      '<p class="pi-error" role="alert" aria-live="polite" id="' + errorId + '" hidden></p>' +
      '<div class="pi-panel-wrap" hidden>' +
      '<div class="pi-panel glass glass--2" hidden>' +
      '<div class="pi-panel-head">' +
      '<input type="text" class="pi-search" role="combobox" aria-expanded="false" aria-controls="' + listboxId + '" aria-activedescendant="" autocomplete="off">' +
      '<button type="button" class="pi-panel-close" aria-label="Close">' +
      '<i class="fa-solid fa-xmark" aria-hidden="true"></i>' +
      "</button>" +
      "</div>" +
      '<ul class="pi-listbox" role="listbox" id="' + listboxId + '"></ul>' +
      "</div>" +
      "</div>";

    var triggerEl = host.querySelector(".pi-trigger");
    var flagEl = host.querySelector(".pi-flag");
    var dialEl = host.querySelector(".pi-dial");
    var numberEl = host.querySelector(".pi-number");
    var errorEl = host.querySelector(".pi-error");
    var panelWrapEl = host.querySelector(".pi-panel-wrap");
    var panelEl = host.querySelector(".pi-panel");
    var searchEl = host.querySelector(".pi-search");
    var closeBtnEl = host.querySelector(".pi-panel-close");
    var listboxEl = host.querySelector(".pi-listbox");

    // Render performance: ~200 options are built ONCE as real <li>
    // elements and kept in the DOM permanently; filtering toggles the
    // "hidden" attribute rather than re-rendering. At this list size a
    // full re-render or virtualization/windowing layer would add
    // complexity for no measurable benefit — hidden-toggle on ~200
    // lightweight nodes is well under a frame budget in every browser.
    var optionEls = COUNTRIES.map(function (c) {
      var li = document.createElement("li");
      li.className = "pi-option";
      li.id = idBase + "-opt-" + c.iso2;
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.dataset.iso2 = c.iso2;
      li.innerHTML =
        '<span class="pi-flag" aria-hidden="true">' + flagEmoji(c.iso2) + "</span>" +
        '<span class="pi-option-name">' + (lang === "ar" ? c.arName : c.enName) + "</span>" +
        '<span class="pi-option-dial">' + c.dialCode + "</span>";
      listboxEl.appendChild(li);
      return li;
    });

    // `options.fieldId` (e.g. "contactPhone-ar") is the id contract with
    // js/contact-form.js: the primary hidden input below reuses that
    // exact id so its existing getElementById lookup keeps working
    // completely unmodified.
    function ensureHidden(id) {
      var el = document.getElementById(id);
      if (!el) {
        el = document.createElement("input");
        el.type = "hidden";
        el.id = id;
        host.parentNode.insertBefore(el, host.nextSibling);
      }
      return el;
    }

    var primaryFieldId = options.fieldId || idBase;
    var hiddenPrimary = ensureHidden(primaryFieldId);
    var hiddenCountry = ensureHidden(primaryFieldId + "-country");
    var hiddenDial = ensureHidden(primaryFieldId + "-dial");
    var hiddenNational = ensureHidden(primaryFieldId + "-national");
    var hiddenValid = ensureHidden(primaryFieldId + "-valid");

    // ---- rendering ---------------------------------------------------
    function computeValid() {
      var len = state.digits.length;
      return len >= state.country.minLength && len <= state.country.maxLength;
    }

    function syncHidden() {
      var e164 = state.digits ? state.country.dialCode + state.digits : "";
      hiddenPrimary.value = e164;
      hiddenCountry.value = state.country.iso2;
      hiddenDial.value = state.country.dialCode;
      hiddenNational.value = state.digits;
      hiddenValid.value = String(state.isValid);
    }

    function renderTrigger() {
      flagEl.textContent = flagEmoji(state.country.iso2);
      dialEl.textContent = state.country.dialCode;
      numberEl.placeholder = state.country.example;
      // +1 so a typed/pasted leading trunk zero isn't truncated by the
      // browser's native maxlength BEFORE applyDigits() ever sees it and
      // strips that zero — the true cap is enforced in applyDigits()
      // itself, against the post-strip digit count.
      numberEl.maxLength = state.country.maxLength + 1;
    }

    function renderError() {
      var show = state.touched && !state.isValid;
      errorEl.hidden = !show;
      numberEl.classList.toggle("is-invalid", show);
      numberEl.setAttribute("aria-invalid", show ? "true" : "false");
      if (show) {
        var msgs = MESSAGES[lang];
        errorEl.textContent = state.digits.length === 0 ? msgs.required : msgs.invalidLength(state.country);
      } else {
        errorEl.textContent = "";
      }
    }

    function recompute(forceTouched) {
      if (forceTouched) state.touched = true;
      state.isValid = state.digits.length > 0 && computeValid();
      syncHidden();
      renderError();
    }

    // ---- panel open/close --------------------------------------------
    function filterOptions(query) {
      var firstVisible = null;
      COUNTRIES.forEach(function (c, i) {
        var visible = matches(c, query);
        optionEls[i].hidden = !visible;
        if (visible && !firstVisible) firstVisible = i;
      });
      state.activeIndex = firstVisible === null ? -1 : firstVisible;
      updateActiveDescendant();
    }

    function visibleIndexes() {
      var out = [];
      optionEls.forEach(function (el, i) {
        if (!el.hidden) out.push(i);
      });
      return out;
    }

    function updateActiveDescendant() {
      optionEls.forEach(function (el) {
        el.classList.remove("is-active");
      });
      if (state.activeIndex !== -1) {
        var el = optionEls[state.activeIndex];
        el.classList.add("is-active");
        searchEl.setAttribute("aria-activedescendant", el.id);
        el.scrollIntoView({ block: "nearest" });
      } else {
        searchEl.setAttribute("aria-activedescendant", "");
      }
    }

    function openPanel() {
      if (state.open) return;
      state.open = true;
      panelWrapEl.hidden = false;
      panelEl.hidden = false;
      triggerEl.setAttribute("aria-expanded", "true");
      searchEl.setAttribute("aria-expanded", "true");
      searchEl.value = "";
      filterOptions("");
      optionEls.forEach(function (el) {
        el.setAttribute("aria-selected", el.dataset.iso2 === state.country.iso2 ? "true" : "false");
      });
      var selectedIdx = COUNTRIES.findIndex(function (c) {
        return c.iso2 === state.country.iso2;
      });
      if (selectedIdx !== -1 && !optionEls[selectedIdx].hidden) {
        state.activeIndex = selectedIdx;
        updateActiveDescendant();
      }
      window.setTimeout(function () {
        searchEl.focus();
      }, 0);
      document.addEventListener("mousedown", onDocumentMouseDown, true);
    }

    function closePanel(restoreFocus) {
      if (!state.open) return;
      state.open = false;
      panelWrapEl.hidden = true;
      panelEl.hidden = true;
      triggerEl.setAttribute("aria-expanded", "false");
      searchEl.setAttribute("aria-expanded", "false");
      document.removeEventListener("mousedown", onDocumentMouseDown, true);
      if (restoreFocus) triggerEl.focus();
    }

    function onDocumentMouseDown(e) {
      // On mobile the sheet's scrim is the wrap element itself (see
      // phone-input.css), so a direct hit on panelWrapEl — not one of
      // its children — is an "outside" tap too.
      var clickedOutside = e.target === panelWrapEl || (!panelWrapEl.contains(e.target) && e.target !== triggerEl);
      if (clickedOutside) closePanel(false);
    }

    function selectByIso2(iso2, refocusNumber) {
      var country = findCountry(iso2);
      state.country = country;
      // Country switch re-validates the EXISTING value against the new
      // country's rules rather than clearing it.
      renderTrigger();
      recompute(false);
      closePanel(false);
      if (refocusNumber !== false) numberEl.focus();
    }

    // ---- number input --------------------------------------------------
    function applyDigits(raw, fromPaste) {
      var clean = digitsOnly(raw);
      clean = stripTrunkZero(clean);
      clean = clean.slice(0, state.country.maxLength);
      state.digits = clean;
      numberEl.value = clean;
      if (state.touched) recompute(false);
      else syncHidden();
    }

    numberEl.addEventListener("input", function () {
      applyDigits(numberEl.value, false);
    });

    numberEl.addEventListener("blur", function () {
      recompute(true);
    });

    numberEl.addEventListener("paste", function (e) {
      var text = (e.clipboardData || window.clipboardData).getData("text");
      if (!text) return;
      var normalized = normalizeDigits(text).trim();
      var plusForm = normalized.replace(/^00/, "+").replace(/[^\d+]/g, "");
      if (plusForm.charAt(0) === "+" || normalized.indexOf("00") === 0) {
        var digitsWithPlus = plusForm.charAt(0) === "+" ? plusForm : "+" + plusForm;
        var match = resolveDialCode(digitsWithPlus);
        if (match) {
          e.preventDefault();
          state.country = match;
          renderTrigger();
          var remainder = digitsWithPlus.slice(match.dialCode.length).replace(/\D/g, "");
          applyDigits(remainder, true);
          recompute(true);
          return;
        }
      }
      // Not a recognized "+"/"00" international form — fall through to
      // normal paste handling (browser inserts text, "input" listener
      // sanitizes it to digits-only on the next tick).
    });

    // ---- trigger + panel interaction -----------------------------------
    triggerEl.addEventListener("click", function () {
      if (state.open) closePanel(true);
      else openPanel();
    });

    triggerEl.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " " || e.key === "ArrowDown") {
        e.preventDefault();
        openPanel();
      }
    });

    searchEl.addEventListener("input", function () {
      filterOptions(searchEl.value);
    });

    searchEl.addEventListener("keydown", function (e) {
      var visible;
      switch (e.key) {
        case "ArrowDown":
          e.preventDefault();
          visible = visibleIndexes();
          if (!visible.length) return;
          var nextPos = visible.indexOf(state.activeIndex);
          state.activeIndex = visible[Math.min(nextPos + 1, visible.length - 1)] !== undefined && nextPos !== -1
            ? visible[Math.min(nextPos + 1, visible.length - 1)]
            : visible[0];
          updateActiveDescendant();
          break;
        case "ArrowUp":
          e.preventDefault();
          visible = visibleIndexes();
          if (!visible.length) return;
          var prevPos = visible.indexOf(state.activeIndex);
          state.activeIndex = prevPos > 0 ? visible[prevPos - 1] : visible[0];
          updateActiveDescendant();
          break;
        case "Home":
          e.preventDefault();
          visible = visibleIndexes();
          if (visible.length) {
            state.activeIndex = visible[0];
            updateActiveDescendant();
          }
          break;
        case "End":
          e.preventDefault();
          visible = visibleIndexes();
          if (visible.length) {
            state.activeIndex = visible[visible.length - 1];
            updateActiveDescendant();
          }
          break;
        case "Enter":
          e.preventDefault();
          if (state.activeIndex !== -1) {
            selectByIso2(optionEls[state.activeIndex].dataset.iso2);
          }
          break;
        case "Escape":
          e.preventDefault();
          closePanel(true);
          break;
        case "Tab":
          closePanel(false);
          break;
        default:
          break;
      }
    });

    listboxEl.addEventListener("click", function (e) {
      var li = e.target.closest(".pi-option");
      if (li) selectByIso2(li.dataset.iso2);
    });

    closeBtnEl.addEventListener("click", function () {
      closePanel(true);
    });

    // ---- init ------------------------------------------------------
    renderTrigger();
    syncHidden();
    searchEl.placeholder = MESSAGES[lang].searchPlaceholder;

    var api = {
      getValue: function () {
        return {
          countryIso2: state.country.iso2,
          dialCode: state.country.dialCode,
          nationalNumber: state.digits,
          e164: state.digits ? state.country.dialCode + state.digits : "",
          isValid: state.isValid
        };
      },
      setValue: function (value) {
        var normalized = normalizeDigits(String(value || "")).replace(/[^\d+]/g, "");
        if (normalized.charAt(0) === "+") {
          var match = resolveDialCode(normalized);
          if (match) {
            state.country = match;
            renderTrigger();
            applyDigits(normalized.slice(match.dialCode.length), false);
            recompute(false);
            return;
          }
        }
        applyDigits(normalized, false);
        recompute(false);
      },
      validate: function () {
        recompute(true);
        return state.isValid;
      },
      reset: function () {
        state.country = findCountry(defaultIso2);
        state.digits = "";
        state.touched = false;
        state.isValid = false;
        numberEl.value = "";
        renderTrigger();
        renderError();
        syncHidden();
      },
      destroy: function () {
        closePanel(false);
        document.removeEventListener("mousedown", onDocumentMouseDown, true);
        host.innerHTML = "";
        host.classList.remove("pi-root");
        delete instances[idBase];
      }
    };

    instances[idBase] = api;
    return api;
  }

  // Validates whichever instance matches the page's current active
  // language (mirroring js/contact-form.js's own activeLang() logic),
  // used by the pre-submit gate in the integration snippet.
  function validateActive() {
    var lang = activeLang();
    var inst = instances["contactPhoneField-" + lang];
    return inst ? inst.validate() : true;
  }

  window.PhoneInput = {
    mount: mount,
    validateActive: validateActive,
    instances: instances
  };

  // ---- auto-init for this page's contact modal --------------------
  // Mounts both bilingual instances (matching the site's existing
  // duplicate -ar/-en markup pattern) and installs a capture-phase
  // submit listener on #contactForm. This script is loaded with
  // `defer` BEFORE js/contact-form.js's own `defer` tag (see the HTML
  // integration), and defer scripts execute in document order before
  // DOMContentLoaded — which is also before contact-form.js's jQuery
  // ready handler runs (jQuery's ready fires ON DOMContentLoaded). So
  // this listener always registers on #contactForm first, and same-
  // element listeners fire in registration order regardless of
  // capture/bubble — meaning an invalid phone number here calls
  // stopImmediatePropagation() and reliably blocks contact-form.js's
  // handler from ever running, with zero changes to that file.
  function autoInit() {
    var mountAr = document.getElementById("contactPhoneField-ar");
    var mountEn = document.getElementById("contactPhoneField-en");
    if (mountAr) {
      mount(mountAr, { lang: "ar", defaultCountry: "SA", fieldId: "contactPhone-ar" });
    }
    if (mountEn) {
      mount(mountEn, { lang: "en", defaultCountry: "SA", fieldId: "contactPhone-en" });
    }

    var form = document.getElementById("contactForm");
    if (form && (mountAr || mountEn)) {
      form.addEventListener(
        "submit",
        function (e) {
          if (!validateActive()) {
            e.preventDefault();
            e.stopImmediatePropagation();
          }
        },
        true
      );
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();
