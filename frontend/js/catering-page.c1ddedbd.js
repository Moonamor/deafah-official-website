/* Catering page renderer (Phase 6). Reads data/mock/catering.json (TEST DATA) and fills [data-fill="…"] slots. */
(function () {
  "use strict";
  var script = document.currentScript;
  var SRC = script.getAttribute("data-src"), BASE = script.getAttribute("data-base") || "", SPRITE = script.getAttribute("data-sprite") || (window.__spriteHref || "assets/icons/sprite.svg");
  var bi = function (o) { return '<span class="lang-ar">' + o.ar + '</span><span class="lang-en">' + o.en + "</span>"; };
  var icon = function (n, cls) { return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="' + SPRITE + "#" + n + '"></use></svg>'; };
  var asset = function (p) { return window.__asset ? window.__asset(BASE + p) : BASE + p; };
  function fill(key, html) { document.querySelectorAll('[data-fill="' + key + '"]').forEach(function (el) { el.innerHTML = html; }); }

  /* icons (owner brief E5): packages, meals, counters, badges — Font Awesome Solid via the build-time sprite */
  var PKG_ICON = ["meal", "tray", "chef"], MEAL_ICON = ["coffee", "meal", "coffee", "restaurant", "clock"], COUNTER_ICON = ["meal", "kitchen", "clock", "users"];
  function render(d) {
    fill("headline", bi(d.headline)); fill("intro", bi(d.intro));
    fill("packages", d.packages.map(function (p, i) {
      return '<article class="pkg card bg-surface' + (p.popular ? " pkg--popular" : "") + '">' + (p.popular ? '<span class="badge pkg__badge">' + bi({ ar: "الأكثر طلبًا", en: "Most popular" }) + "</span>" : "") +
        '<span class="icon-box" aria-hidden="true">' + icon(PKG_ICON[i % PKG_ICON.length]) + '</span><h3 class="t-title mb-2">' + bi(p.name) + '</h3><p class="pkg__price ico-label">' + icon("tag", "icon--sm accent-icon") + '<span class="num">SAR ' + p.price_sar + '</span></p><p class="muted mb-4">' + bi(p.per) + "</p>" +
        '<p class="t-label mb-2">' + bi({ ar: "ماذا يشمل", en: "What's included" }) + '</p><ul class="list-rule grid gap-2 mb-6">' + p.includes.ar.map(function (x, i) { return "<li>" + bi({ ar: x, en: p.includes.en[i] }) + "</li>"; }).join("") + "</ul>" +
        '<a href="#contact" class="btn" data-modal-open="contactModal" data-subject="إعاشة — ' + p.name.ar + '">' + icon("message", "icon--sm") + bi({ ar: "اطلب عرض سعر", en: "Request a quote" }) + "</a></article>";
    }).join(""));
    fill("menu", d.menu.map(function (m, i) { return '<article class="card bg-surface"><span class="eyebrow ico-label">' + icon(MEAL_ICON[i % MEAL_ICON.length], "icon--sm accent-icon") + "<span>" + bi(m.time) + '</span></span><ul class="list-rule grid gap-2">' + m.items.ar.map(function (x, i) { return "<li>" + bi({ ar: x, en: m.items.en[i] }) + "</li>"; }).join("") + "</ul></article>"; }).join(""));
    fill("counters", d.counters.map(function (c, i) { return '<div class="stat reveal"><span class="icon-box" aria-hidden="true">' + icon(COUNTER_ICON[i % COUNTER_ICON.length]) + '</span><span class="stat-number" data-count-to="' + c.value + '" data-suffix="' + c.suffix + '">0</span><span class="muted">' + bi(c.label) + "</span></div>"; }).join(""));
    fill("badges", d.badges.map(function (b) { return '<li class="chip">' + icon("certificate", "icon--xs accent-icon") + bi(b) + "</li>"; }).join(""));
    document.querySelectorAll("[data-whatsapp]").forEach(function (a) {
      if (d.whatsapp) { a.href = "https://wa.me/" + d.whatsapp.replace(/\D/g, ""); return; }
      a.removeAttribute("href"); a.removeAttribute("target"); a.setAttribute("aria-disabled", "true"); a.setAttribute("role", "img"); a.classList.add("is-pending");
      a.setAttribute("aria-label", "واتساب — الرقم غير متاح بعد");
      a.setAttribute("title", "WhatsApp — " + (document.documentElement.getAttribute("data-lang") === "en" ? "number not available yet" : "الرقم غير متاح بعد"));
    });
    document.querySelectorAll("[data-phone]").forEach(function (a) { a.href = "tel:" + d.phone.replace(/\s/g, ""); });
    if (window.DeafahWidgets) window.DeafahWidgets.init();
    if (window.DeafahEffects && window.DeafahEffects.initStatCounters) window.DeafahEffects.initStatCounters();
    if (window.DeafahMotion) setTimeout(window.DeafahMotion.rebuild, 50);
    document.dispatchEvent(new CustomEvent("deafah:page-rendered"));
  }
  fetch(SRC, { cache: "no-cache" }).then(function (r) { return r.json(); }).then(render).catch(function (e) { console.error("[catering-page] data failed", e); });
})();
