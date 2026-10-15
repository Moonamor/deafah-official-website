/* Renders the hotel roster from data/hotels.json into #hotelGrid using the <template id="hotelCardTpl">
   (the pre-overhaul card markup). Also fills every [data-hotel-count] with the roster size. */
(function () {
  "use strict";
  var AR = "٠١٢٣٤٥٦٧٨٩";
  var script = document.currentScript;
  var src = (script && script.getAttribute("data-src")) || "data/hotels.json";
  var base = (script && script.getAttribute("data-base")) || "";
  var exclude = (script && script.getAttribute("data-exclude")) || "";

  function ar(n) { return String(n).replace(/\d/g, function (d) { return AR[+d]; }); }
  function arMinutes(m) { return m === 1 ? "دقيقة واحدة سيرًا" : m === 2 ? "دقيقتان سيرًا" : m >= 3 && m <= 10 ? ar(m) + " دقائق سيرًا" : ar(m) + " دقيقة سيرًا"; }
  function arHotels(n) { return n === 1 ? "فندق واحد" : n === 2 ? "فندقان" : n >= 3 && n <= 10 ? ar(n) + " فنادق" : ar(n) + " فندقًا"; }

  function fillCounts(n) {
    document.querySelectorAll("[data-hotel-count]").forEach(function (el) {
      var fmt = el.getAttribute("data-hotel-count");
      if (fmt === "ar-words") el.textContent = arHotels(n);
      else if (fmt === "ar") el.textContent = ar(n);
      else el.textContent = String(n);
    });
    document.querySelectorAll("[data-count-to='HOTELS']").forEach(function (el) { el.setAttribute("data-count-to", String(n)); });
  }

  function starsHTML(stars) {
    if (stars === null || stars === undefined) {
      return '<span class="stars" aria-label="rating pending"><span class="lang-ar">التقييم قيد الإضافة</span><span class="lang-en">Rating pending</span></span>';
    }
    var full = "★★★★★".slice(0, stars), dim = "★★★★★".slice(stars);
    return '<span class="stars" aria-label="' + stars + ' out of 5 stars">' + full + (dim ? '<span class="star-dim">' + dim + "</span>" : "") + "</span>";
  }

  function fillCopy(data) {
    var n = data.hotels.length, copy = data.copy || {};
    function sub(str, lang) { return String(str || "").replace("{n}", lang === "ar" ? arHotels(n) : String(n)); }
    document.querySelectorAll("[data-hotel-copy]").forEach(function (el) {
      var c = copy[el.getAttribute("data-hotel-copy")]; if (!c) return;
      var keep = el.querySelector("svg") ? el.querySelector("svg").outerHTML : "";
      el.innerHTML = '<span class="lang-ar">' + sub(c.ar, "ar") + '</span><span class="lang-en">' + sub(c.en, "en") + "</span>" + keep;
      if (c.subject) el.setAttribute("data-subject", c.subject);
    });
    window.DeafahHotelsCopy = { get: function (key, lang) { var c = copy[key]; return c ? sub(c[lang], lang) : ""; } };
  }

  function render(data) {
    fillCopy(data);
    var grid = document.getElementById("hotelGrid");
    var tpl = document.getElementById("hotelCardTpl");
    fillCounts(data.hotels.length);
    window.DeafahHotels = { count: data.hotels.length, hotels: data.hotels, bySlug: function (s) { return data.hotels.filter(function (h) { return h.slug === s; })[0] || null; } };
    if (!grid || !tpl) { document.dispatchEvent(new CustomEvent("deafah:hotels", { detail: window.DeafahHotels })); return; }
    grid.innerHTML = "";
    data.hotels.filter(function (h) { return h.slug !== exclude; }).forEach(function (h, i) {
      var node = tpl.content.cloneNode(true);
      var card = node.querySelector(".hotel-card");
      card.setAttribute("data-slug", h.slug);
      var img = node.querySelector("img");
      var dark = document.documentElement.getAttribute("data-scheme") === "dark";
      img.src = base + (dark && h.image_dark ? h.image_dark : h.image); if (h.srcset) img.srcset = h.srcset.split(",").map(function (s) { return base + s.trim(); }).join(", ");
      if (h.image_dark) { img.setAttribute("data-src-light", base + h.image); img.setAttribute("data-src-dark", base + h.image_dark); }
      img.sizes = "(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw";
      img.alt = h.name_en; img.loading = i < 3 ? "eager" : "lazy"; img.width = 640; img.height = 480;
      node.querySelector(".badge .lang-ar").textContent = arMinutes(h.walk_minutes);
      node.querySelector(".badge .lang-en").textContent = h.walk_minutes + " min walk";
      node.querySelector("h3 .lang-ar").textContent = h.name_ar;
      node.querySelector("h3 .lang-en").textContent = h.name_en;
      node.querySelector(".hotel-stars").innerHTML = starsHTML(h.stars);
      node.querySelector(".hotel-area .lang-ar").textContent = h.area_ar;
      node.querySelector(".hotel-area .lang-en").textContent = h.area_en;
      node.querySelector(".price-value").textContent = "SAR " + h.price_from_sar;
      var btn = node.querySelector(".hotel-details");
      if (h.details_url) { btn.setAttribute("href", base + h.details_url); btn.removeAttribute("aria-disabled"); }
      else { btn.setAttribute("href", "#contact"); btn.setAttribute("data-modal-open", "contactModal"); btn.setAttribute("data-subject", h.name_ar); }
      grid.appendChild(node);
    });
    document.dispatchEvent(new CustomEvent("deafah:hotels", { detail: window.DeafahHotels }));
  }

  document.addEventListener("deafah:themechange", function () {
    var dark = document.documentElement.getAttribute("data-scheme") === "dark";
    document.querySelectorAll("img[data-src-dark]").forEach(function (img) { var s = img.getAttribute(dark ? "data-src-dark" : "data-src-light"); if (img.getAttribute("src") !== s) img.setAttribute("src", s); });
  });
  fetch(src, { cache: "no-cache" }).then(function (r) { return r.json(); }).then(render).catch(function (err) {
    console.error("[hotels] could not load " + src + (location.protocol === "file:" ? " — serve the site over http(s)" : ""), err);
  });
})();
