(function () {
  "use strict";

  var currentScript = document.currentScript;

  var HONEYPOT_NAME = "deafah_hp_field";
  var THROTTLE_KEY = "deafah-contact-last-sent";

  // Last chance for 2 language, used only if config.json fail to load. 
  // because config.messages (the real user text) not here yet, 
  // so nothing else to get from."
  var FALLBACK_CONFIG_ERROR = { ar: "تعذّر تحميل إعدادات الإرسال. يرجى المحاولة لاحقًا.", en: "We couldn't load the contact settings. Please try again later." };

  function activeLang() {
    var lang = document.documentElement.lang || "ar";
    return lang.indexOf("en") === 0 ? "en" : "ar";
  }

  function t(config, key) {
    var lang = activeLang();
    var bucket = (config.messages && config.messages[lang]) || {};
    return bucket[key] || key;
  }

  function normalizeDigits(value) {
    var easternArabic = "٠١٢٣٤٥٦٧٨٩";
    var persian = "۰۱۲۳۴۵۶۷۸۹";
    return String(value).replace(/[٠-٩۰-۹]/g, function (ch) {
      var idx = easternArabic.indexOf(ch);
      if (idx === -1) idx = persian.indexOf(ch);
      return idx === -1 ? ch : String(idx);
    });
  }

  function isValidName(value) {
    return value.trim().length >= 2;
  }

  function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  }

  function isValidMobile(value) {
    var digits = value.replace(/[^\d+]/g, "");
    var ksaPattern = /^(?:\+?9665\d{8}|05\d{8})$/;
    var intlPattern = /^\+?\d{8,15}$/;
    return ksaPattern.test(digits) || intlPattern.test(digits);
  }

  function isValidMessage(value) {
    return value.trim().length >= 5;
  }

  function resolveFieldEl(baseId, lang) {
    return (
      document.getElementById(baseId + "-" + lang) ||
      document.getElementById(baseId + "-" + (lang === "ar" ? "en" : "ar")) ||
      document.getElementById(baseId)
    );
  }

  function ready(fn) {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", fn);
    } else {
      fn();
    }
  }

  ready(function () {
    if (typeof window.emailjs === "undefined") {
      console.error("[contact-form] EmailJS SDK not found — is the CDN script tag present before contact-form.js?");
      return;
    }

    var form = document.querySelector("#contactForm");
    if (!form) {
      console.error("[contact-form] #contactForm not found on this page.");
      return;
    }

    var configUrl;
    try {
      var scriptSrc = (currentScript && currentScript.src) || "js/contact-form.js";
      configUrl = new URL("../config.json", scriptSrc).href;
    } catch (err) {
      configUrl = "config.json";
    }

    var configPromise = fetch(configUrl, { cache: "no-cache" })
      .then(function (res) {
        if (!res.ok) throw new Error("config.json responded with " + res.status);
        return res.json();
      })
      .then(function (config) {
        if (config.emailjs && config.emailjs.publicKey && config.emailjs.publicKey !== "REPLACE_ME") {
          window.emailjs.init({ publicKey: config.emailjs.publicKey });
        }
        return config;
      })
      .catch(function (err) {
        console.error(
          "[contact-form] Failed to load config.json.",
          location.protocol === "file:"
            ? "This page is running from file:// — fetch() cannot load local files there; serve the site over http(s) (e.g. `python3 -m http.server`)."
            : err
        );
        return null;
      });

    var honeypot = document.createElement("input");
    honeypot.type = "text";
    honeypot.name = HONEYPOT_NAME;
    honeypot.tabIndex = -1;
    honeypot.autocomplete = "off";
    honeypot.setAttribute("aria-hidden", "true");
    honeypot.style.position = "absolute";
    honeypot.style.insetInlineStart = "-10000px";
    honeypot.style.width = "1px";
    honeypot.style.height = "1px";
    honeypot.style.overflow = "hidden";
    honeypot.style.opacity = "0";
    form.appendChild(honeypot);

    function showStatus(message) {
      if (window.DeafahEffects && typeof window.DeafahEffects.showToast === "function") {
        window.DeafahEffects.showToast(message);
        return;
      }
      var live = document.getElementById("contactFormStatus");
      if (!live) {
        live = document.createElement("div");
        live.id = "contactFormStatus";
        live.setAttribute("role", "status");
        live.setAttribute("aria-live", "polite");
        live.style.position = "absolute";
        live.style.insetInlineStart = "-10000px";
        document.body.appendChild(live);
      }
      live.textContent = message;
    }

    function markInvalid(el, message) {
      if (el) {
        el.classList.add("is-invalid");
        el.focus();
      }
      showStatus(message);
    }

    function clearInvalid(el) {
      if (el) el.classList.remove("is-invalid");
    }

    function throttledRemainingMs(config) {
      try {
        var last = window.sessionStorage.getItem(THROTTLE_KEY);
        if (!last) return 0;
        var minMs = (config.form.minSecondsBetweenSends || 0) * 1000;
        var elapsed = Date.now() - parseInt(last, 10);
        return elapsed < minMs ? minMs - elapsed : 0;
      } catch (err) {
        return 0;
      }
    }

    function markSent() {
      try {
        window.sessionStorage.setItem(THROTTLE_KEY, String(Date.now()));
      } catch (err) {
        // sessionStorage unavailable — do not block the user.
      }
    }

    function closeModal(config) {
      var modalSelector = (config.form && config.form.modalSelector) || "#contactModal";
      var modalEl = document.querySelector(modalSelector);
      if (!modalEl) return;

      if (window.bootstrap && window.bootstrap.Modal) {
        var instance = window.bootstrap.Modal.getInstance(modalEl) || window.bootstrap.Modal.getOrCreateInstance(modalEl);
        instance.hide();
        return;
      }
      var dismissBtn = modalEl.querySelector('[data-bs-dismiss="modal"]');
      if (dismissBtn) dismissBtn.click();
    }

    function getSubmitButton(config) {
      var selector = (config.form && config.form.submitButtonSelector) ||
        '#contactModal button[type="submit"][form="contactForm"]';
      return document.querySelector(selector);
    }

    function handleSubmit(config) {
      if (!config) {
        var lang = activeLang();
        showStatus(FALLBACK_CONFIG_ERROR[lang]);
        return;
      }

      if (
        !config.emailjs ||
        config.emailjs.publicKey === "REPLACE_ME" ||
        config.emailjs.serviceId === "REPLACE_ME" ||
        config.emailjs.templateId === "REPLACE_ME"
      ) {
        showStatus(t(config, "configError"));
        console.error("[contact-form] EmailJS keys in config.json are still placeholders — see CONTACT-FORM-SETUP.md.");
        return;
      }

      if (honeypot.value) {
        showStatus(t(config, "success"));
        return;
      }

      if (throttledRemainingMs(config) > 0) {
        showStatus(t(config, "throttled"));
        return;
      }

      var lang = activeLang();
      var fields = config.form.fields;

      var nameEl = resolveFieldEl(fields.fullName, lang);
      var emailEl = resolveFieldEl(fields.email, lang);
      var mobileEl = resolveFieldEl(fields.mobile, lang);
      var messageEl = resolveFieldEl(fields.message, lang);

      [nameEl, emailEl, mobileEl, messageEl].forEach(clearInvalid);

      var nameValue = nameEl ? nameEl.value : "";
      var emailValue = emailEl ? emailEl.value : "";
      var mobileValue = normalizeDigits(mobileEl ? mobileEl.value : "");
      var messageValue = messageEl ? messageEl.value : "";

      if (!isValidName(nameValue)) {
        markInvalid(nameEl, t(config, "invalidName"));
        return;
      }
      if (!isValidEmail(emailValue)) {
        markInvalid(emailEl, t(config, "invalidEmail"));
        return;
      }
      if (!isValidMobile(mobileValue)) {
        markInvalid(mobileEl, t(config, "invalidMobile"));
        return;
      }
      if (!isValidMessage(messageValue)) {
        markInvalid(messageEl, t(config, "invalidMessage"));
        return;
      }

      var submitBtn = getSubmitButton(config);
      var originalHTML = submitBtn ? submitBtn.innerHTML : null;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.setAttribute("aria-busy", "true");
        submitBtn.innerHTML =
          '<span class="lang-ar">' + config.messages.ar.sending + '</span>' +
          '<span class="lang-en">' + config.messages.en.sending + '</span>';
      }

      var params = {
        to_email: config.contact.destinationEmail,
        to_name: config.contact.destinationName,
        from_name: nameValue.trim(),
        from_email: emailValue.trim(),
        reply_to: emailValue.trim(),
        mobile: mobileValue,
        message: messageValue.trim(),
        page_url: location.href,
        submitted_at: new Date().toISOString()
      };

      window.emailjs
        .send(config.emailjs.serviceId, config.emailjs.templateId, params)
        .then(function () {
          markSent();
          form.reset();
          showStatus(t(config, "success"));
          if (config.form.closeModalOnSuccess) {
            window.setTimeout(function () {
              closeModal(config);
            }, config.form.closeDelayMs || 0);
          }
        })
        .catch(function (err) {
          console.error("[contact-form] EmailJS send failed.", err);
          showStatus(t(config, "error"));
        })
        .finally(function () {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.removeAttribute("aria-busy");
            if (originalHTML !== null) submitBtn.innerHTML = originalHTML;
          }
        });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      e.stopImmediatePropagation();
      configPromise.then(handleSubmit);
    }, true);
  });
})();
