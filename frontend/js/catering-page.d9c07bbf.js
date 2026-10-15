/* Catering page renderer (Phase 6). Reads data/mock/catering.json (TEST DATA) and fills [data-fill="…"] slots. */
(function () {
  "use strict";
  var script = document.currentScript;
  var SRC = script.getAttribute("data-src"), BASE = script.getAttribute("data-base") || "", SPRITE = script.getAttribute("data-sprite") || (window.__spriteHref || "assets/icons/sprite.svg");
  var bi = function (o) { return '<span class="lang-ar">' + o.ar + '</span><span class="lang-en">' + o.en + "</span>"; };
  var icon = function (n, cls) { return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="' + SPRITE + "#" + n + '"></use></svg>'; };
  var asset = function (p) { return window.__asset ? window.__asset(BASE + p) : BASE + p; };
  function fill(key, html) { document.querySelectorAll('[data-fill="' + key + '"]').forEach(function (el) { el.innerHTML = html; }); }

  function render(d) {
    fill("headline", bi(d.headline)); fill("intro", bi(d.intro));
    fill("packages", d.packages.map(function (p) {
      return '<article class="pkg card bg-surface' + (p.popular ? " pkg--popular" : "") + '">' + (p.popular ? '<span class="badge pkg__badge">' + bi({ ar: "الأكثر طلبًا", en: "Most popular" }) + "</span>" : "") +
        '<h3 class="t-title mb-2">' + bi(p.name) + '</h3><p class="pkg__price num">SAR ' + p.price_sar + '</p><p class="muted mb-4">' + bi(p.per) + "</p>" +
        '<p class="t-label mb-2">' + bi({ ar: "ماذا يشمل", en: "What's included" }) + '</p><ul class="list-rule grid gap-2 mb-6">' + p.includes.ar.map(function (x, i) { return "<li>" + bi({ ar: x, en: p.includes.en[i] }) + "</li>"; }).join("") + "</ul>" +
        '<a href="#contact" class="btn" data-modal-open="contactModal" data-subject="إعاشة — ' + p.name.ar + '">' + bi({ ar: "اطلب عرض سعر", en: "Request a quote" }) + "</a></article>";
    }).join(""));
    fill("menu", d.menu.map(function (m) { return '<article class="card bg-surface"><span class="eyebrow">' + bi(m.time) + '</span><ul class="list-rule grid gap-2">' + m.items.ar.map(function (x, i) { return "<li>" + bi({ ar: x, en: m.items.en[i] }) + "</li>"; }).join("") + "</ul></article>"; }).join(""));
    fill("counters", d.counters.map(function (c) { return '<div class="stat reveal"><span class="stat-number" data-count-to="' + c.value + '" data-suffix="' + c.suffix + '">0</span><span class="muted">' + bi(c.label) + "</span></div>"; }).join(""));
    fill("badges", d.badges.map(function (b) { return '<li class="chip">' + icon("check", "icon--sm") + bi(b) + "</li>"; }).join(""));
    fill("gallery", d.gallery.map(function (g) { return '<img src="' + asset(g.image) + '" alt="' + g.alt.en + '"' + (g.w ? ' width="' + g.w + '" height="' + g.h + '"' : "") + ' loading="lazy" decoding="async">'; }).join(""));
    document.querySelectorAll("[data-whatsapp]").forEach(function (a) { a.href = "https://wa.me/" + d.whatsapp.replace(/\D/g, ""); });
    document.querySelectorAll("[data-phone]").forEach(function (a) { a.href = "tel:" + d.phone.replace(/\s/g, ""); });
    if (window.DeafahWidgets) window.DeafahWidgets.init();
    if (window.DeafahEffects && window.DeafahEffects.initStatCounters) window.DeafahEffects.initStatCounters();
    if (window.DeafahMotion) setTimeout(window.DeafahMotion.rebuild, 50);
    document.dispatchEvent(new CustomEvent("deafah:page-rendered"));
  }
  fetch(SRC, { cache: "no-cache" }).then(function (r) { return r.json(); }).then(render).catch(function (e) { console.error("[catering-page] data failed", e); });
})();
