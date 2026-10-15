/* Taj Park page renderer (Phase 6). Reads data/mock/taj-park.json (TEST DATA) and fills [data-fill="…"] slots.
   Script attributes: data-src (JSON), data-base (site root prefix for asset paths), data-sprite (icon sprite). */
(function () {
  "use strict";
  var script = document.currentScript;
  var SRC = script.getAttribute("data-src"), BASE = script.getAttribute("data-base") || "", SPRITE = script.getAttribute("data-sprite") || (window.__spriteHref || "assets/icons/sprite.svg");
  var AR = "٠١٢٣٤٥٦٧٨٩";
  var bi = function (o) { return '<span class="lang-ar">' + o.ar + '</span><span class="lang-en">' + o.en + "</span>"; };
  var icon = function (n, cls) { return '<svg class="icon ' + (cls || "") + '" aria-hidden="true"><use href="' + SPRITE + "#" + n + '"></use></svg>'; };
  var asset = function (p) { return window.__asset ? window.__asset(BASE + p) : BASE + p; };
  var arNum = function (n) { return String(n).replace(/\d/g, function (d) { return AR[+d]; }); };
  var biNum = function (n, arSuffix, enSuffix) { return '<span class="lang-ar"><span class="num">' + n + "</span> " + arSuffix + '</span><span class="lang-en"><span class="num">' + n + "</span> " + enSuffix + "</span>"; };

  function fill(key, html) { document.querySelectorAll('[data-fill="' + key + '"]').forEach(function (el) { el.innerHTML = html; }); }

  function render(d) {
    document.title = d.name.ar + " — مجموعة الضيافة العالمية";
    fill("headline", bi(d.headline)); fill("intro", bi(d.intro));
    fill("facts", d.facts.map(function (f) { return '<div class="stat"><span class="icon-box !mb-2" aria-hidden="true">' + icon(f.icon) + '</span><span class="stat-number">' + f.value + "</span><span class=\"muted\">" + bi(f.unit) + "</span></div>"; }).join(""));
    fill("rooms", d.rooms.map(function (r) {
      var viewTag = r.view === "haram" ? '<span class="badge">' + bi({ ar: "إطلالة على الحرم", en: "Haram view" }) + "</span>" : "";
      return '<article class="room-card card bg-surface p-0 overflow-hidden flex flex-col" data-type="' + r.type + '" data-layer-card>' +
        '<div class="hotel-media">' + viewTag.replace('class="badge"', 'class="badge absolute top-3 start-3"') + '<img src="' + asset(r.image) + '" alt="' + r.name.en + '" width="640" height="480" loading="lazy"></div>' +
        '<div class="p-6 flex flex-col gap-3 grow"><h3 class="t-title">' + bi(r.name) + "</h3>" +
        '<ul class="muted text-sm grid gap-1"><li class="flex items-center gap-2">' + icon("rooms", "icon--sm") + '<span>' + biNum(r.m2, "م²", "m²") + "</span></li><li class=\"flex items-center gap-2\">" + icon("bed", "icon--sm") + "<span>" + bi(r.beds) + "</span></li><li class=\"flex items-center gap-2\">" + icon(r.view === "haram" ? "haram-distance" : "location", "icon--sm") + "<span>" + bi(r.view === "haram" ? { ar: "إطلالة على الحرم", en: "Haram view" } : { ar: "إطلالة على المدينة", en: "City view" }) + "</span></li></ul>" +
        '<div class="mt-auto flex items-center justify-between gap-4 pt-3 border-t border-brand border-border"><span class="price"><small class="lang-ar">من</small><small class="lang-en">From</small><span class="num">SAR ' + r.price_from_sar + '</span><small class="lang-ar">/ الليلة</small><small class="lang-en">/night</small></span>' +
        '<a href="#contact" class="btn btn--ghost btn--sm" data-modal-open="contactModal" data-subject="' + r.name.ar + '">' + bi({ ar: "تحقق من التوفر", en: "Check availability" }) + "</a></div></div></article>";
    }).join(""));
    fill("packages", d.packages.map(function (p) {
      return '<article class="pkg card bg-surface' + (p.popular ? " pkg--popular" : "") + '">' + (p.popular ? '<span class="badge pkg__badge">' + bi({ ar: "الأكثر طلبًا", en: "Most popular" }) + "</span>" : "") +
        '<h3 class="t-title mb-2">' + bi(p.name) + '</h3><p class="pkg__price num">SAR ' + p.price_sar + '</p><p class="muted mb-4">' + biNum(p.nights, "ليالٍ", "nights") + "</p>" +
        '<p class="t-label mb-2">' + bi({ ar: "ماذا يشمل", en: "What's included" }) + '</p><ul class="list-rule grid gap-2 mb-6">' + p.includes.ar.map(function (x, i) { return "<li>" + bi({ ar: x, en: p.includes.en[i] }) + "</li>"; }).join("") + "</ul>" +
        '<div class="flex flex-wrap gap-2"><a href="#contact" class="btn" data-modal-open="contactModal" data-subject="' + p.name.ar + '">' + bi({ ar: "احجز", en: "Book" }) + '</a><a href="#faq" class="btn btn--secondary">' + bi({ ar: "التفاصيل", en: "Details" }) + "</a></div></article>";
    }).join("") + '<article class="card card--outline flex flex-col justify-between gap-4"><div><h3 class="t-title mb-2">' + bi({ ar: "خصّص باقتك عبر واتساب", en: "Customise your package on WhatsApp" }) + '</h3><p class="muted">' + bi({ ar: "أخبرنا بعدد الأفراد والليالي والغرفة المطلوبة، ونرد عليك بعرض خلال ساعات العمل.", en: "Tell us the group size, nights and room type and we reply with an offer during working hours." }) + '</p></div><a class="btn btn--secondary" href="https://wa.me/' + d.whatsapp.replace(/\D/g, "") + '" rel="noopener" target="_blank">' + icon("whatsapp", "icon--sm") + bi({ ar: "واتساب", en: "WhatsApp" }) + "</a></article>");
    fill("dining", d.dining.map(function (x) { return '<article class="card bg-surface p-0 overflow-hidden" data-layer-card><div class="hotel-media"><img src="' + asset(x.image) + '" alt="' + x.name.en + '" width="640" height="480" loading="lazy"></div><div class="p-6"><h3 class="t-title mb-1">' + bi(x.name) + '</h3><p class="muted text-sm">' + bi(x.note) + "</p></div></article>"; }).join(""));
    fill("amenities", d.amenities.map(function (a) { return '<li class="flex items-start gap-4"><span class="icon-box !mb-0 shrink-0" aria-hidden="true">' + icon(a.icon) + '</span><span class="pt-3 font-semibold">' + bi(a) + "</span></li>"; }).join(""));
    fill("address", bi(d.location.address));
    document.querySelectorAll("[data-map-link]").forEach(function (a) { a.href = d.location.map_url; });
    fill("location-steps", d.location.steps.map(function (s, i) { return '<div class="reveal" data-step><span class="icon-box" aria-hidden="true">' + icon(s.icon) + '</span><h3 class="t-title mb-1">' + bi(s.title) + '</h3><p class="muted">' + bi(s.text) + "</p></div>"; }).join(""));
    fill("gallery", d.gallery.map(function (g) { return '<img src="' + asset(g.image) + '" alt="' + g.alt.en + '" loading="lazy" decoding="async">'; }).join(""));
    fill("guests", d.guests.map(function (g) { return '<blockquote class="guest"><p class="mb-2">' + bi(g.text) + '</p><footer class="muted text-sm">' + g.name + " · " + bi(g.country) + "</footer></blockquote>"; }).join(""));
    fill("faq", d.faq.map(function (f) { return "<details><summary>" + bi(f.q) + icon("chevron-down", "icon--sm") + "</summary><div>" + bi(f.a) + "</div></details>"; }).join(""));
    document.querySelectorAll("[data-whatsapp]").forEach(function (a) { a.href = "https://wa.me/" + d.whatsapp.replace(/\D/g, ""); });
    document.querySelectorAll("[data-phone]").forEach(function (a) { a.href = "tel:" + d.phone.replace(/\s/g, ""); });
    document.querySelectorAll("form[data-availability]").forEach(function (f) { f.setAttribute("data-hotel", d.name.ar); });
    if (window.DeafahWidgets) window.DeafahWidgets.init();
    if (window.DeafahEffects && window.DeafahEffects.initStatCounters) window.DeafahEffects.initStatCounters();
    if (window.DeafahMotion) setTimeout(window.DeafahMotion.rebuild, 50);
    document.dispatchEvent(new CustomEvent("deafah:page-rendered"));
  }
  fetch(SRC, { cache: "no-cache" }).then(function (r) { return r.json(); }).then(render).catch(function (e) { console.error("[hotel-page] data failed", e); });
})();
